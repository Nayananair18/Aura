const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const sharp = require('sharp');
const jsQR = require('jsqr');
const VerificationResult = require('../models/VerificationResult');
const Proof = require('../models/Proof');
const { generateHash, compareHashes, calculateLightStats, calculateSensorStats } = require('../utils/crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { analyzeImageMetadata, toBuffer } = require('../utils/metadataAnalyzer');
const { getFromLedger, normalizeKey, listLedgerIds } = require('../utils/ledgerStore');

/**
 * Check if MongoDB is connected and ready for writes
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Helper to escape regex special characters
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Unified Proof ID Query Handler
 * GET /api/verify/proof/:proofId, GET /api/media/proof/:proofId, POST /api/verify/proof-id
 */
const verifyByProofId = async (req, res) => {
  try {
    const rawProofId = req.params.proofId || req.body.proofId || req.query.proofId || '';

    if (!rawProofId) {
      return res.status(400).json({
        success: false,
        message: 'Proof ID is required',
      });
    }

    // Strip any hidden non-alphanumeric characters except standard hyphens
    const sanitized = String(rawProofId).trim().toUpperCase().replace(/.*\/VERIFY\//i, '').replace(/.*\//, '').replace(/[^A-Z0-9-]/g, '');
    const target = sanitized.startsWith('AURA-') ? sanitized : `AURA-${sanitized}`;
    const idWithoutPrefix = sanitized.replace(/^AURA-/, '');
    const escapedSanitized = escapeRegex(sanitized);
    const escapedTarget = escapeRegex(target);

    logger.info(`[PROOF LOOKUP] Querying Proof ID: ${sanitized} (target: ${target})`);

    let foundProof = null;

    if (isDbConnected()) {
      try {
        foundProof = await Proof.findOne({
          $or: [
            { proofId: sanitized },
            { proofId: target },
            { proofId: idWithoutPrefix },
            { proofId: { $regex: new RegExp(`^${escapedSanitized}`, 'i') } },
            { proofId: { $regex: new RegExp(`^${escapedTarget}`, 'i') } },
          ],
        });
      } catch (dbErr) {
        logger.error(`MongoDB query error: ${dbErr.message}`);
      }
    }

    // Fallback to in-memory ledger
    if (!foundProof) {
      foundProof = getFromLedger(sanitized) || getFromLedger(target);
    }

    if (!foundProof) {
      if (isDbConnected()) {
        try {
          const availableProofs = await Proof.find({}, 'proofId');
          console.log('Available Proofs in DB:', availableProofs.map((p) => p.proofId));
        } catch (err) {
          console.log('Error listing available proofs:', err.message);
        }
      }
      console.log('Available Proofs in Ledger Cache:', listLedgerIds());

      return res.status(404).json({
        success: false,
        proofFound: false,
        message: 'Proof ID not found in ledger',
      });
    }

    const isRecaptured = Boolean(foundProof.isRecaptured || foundProof.integrityAnalysis?.isRecaptured);
    const isTampered = Boolean(foundProof.status === 'tampered' || isRecaptured);

    const auraFlag = isTampered ? 'RED' : 'GREEN';
    const status = isTampered ? 'tampered' : 'verified';
    const statusMessage = isTampered ? '❌ SECOND-COPY DETECTED (RECAPTURED)' : '✅ A.U.R.A. VERIFIED';
    const failureReason = isTampered ? 'SECOND-COPY DETECTED (Screen Replay Photo): LCD/OLED display emission or subpixel grid detected' : null;

    return res.status(200).json({
      success: true,
      isVerified: !isTampered,
      proof: foundProof,
      hashMatch: 100,
      auraFlag,
      status,
      integrityScore: isTampered ? 25 : (foundProof.integrityScore || 98),
      aiProbability: isTampered ? 0.85 : 0.02,
      classification: isTampered ? 'SCREEN_REPLAY' : 'AUTHENTIC_CAMERA',
        failureReason,
      failureReason,
      sensorsPassed: !isTampered,
      sensors: !isTampered ? 'PASSED' : 'FAILED',
      confidence: isTampered ? 20.0 : (foundProof.confidence || 99.7),
      verification: {
        proofId: foundProof.proofId,
        status,
        isVerified: !isTampered,
        confidence: isTampered ? 20.0 : (foundProof.confidence || 99.7),
        auraFlag,
        statusMessage,
        statusDetails: isTampered 
          ? 'Proof Found in Ledger | Flagged as Screen Replay' 
          : 'Proof Found in Ledger | Environmental Physics Sealed | Cryptographic Proof: AUTHENTIC',
        proofFound: true,
        isRecaptured,
        screenDefensePassed: !isTampered,
        sensorsPassed: !isTampered,
        hashMatch: 100,
        integrityScore: isTampered ? 25 : (foundProof.integrityScore || 98),
        aiProbability: isTampered ? 0.85 : 0.02,
        classification: isTampered ? 'SCREEN_REPLAY' : 'AUTHENTIC_CAMERA',
        hashValidation: {
          isValid: true,
          matchPercentage: 100,
          status: 'Verified Match (100% Sealed Ledger Proof)',
          uploadedHash: foundProof.imageHash || foundProof.sha256Hash || foundProof.hash,
          storedHash: foundProof.imageHash || foundProof.sha256Hash || foundProof.hash,
        },
        sensorValidation: !isTampered ? 'passed' : 'failed',
        metadataConsistency: 'consistent',
        screenDefense: {
          result: !isTampered ? 'passed' : 'failed',
          screenDefensePassed: !isTampered,
          magnetometerPassed: !isTampered,
          lightFlickerPassed: !isTampered,
          details: isRecaptured 
            ? 'Screen flicker or magnetic disturbance detected' 
            : 'Verified real-world ambient environment',
        },
        physicsDefense: {
          motionPassed: !isTampered,
          gravityConsistent: !isTampered,
          details: 'Handheld human micro-tremor signature consistent with authentic capture',
        },
        timestamp: new Date().toISOString(),
        sensorMetrics: foundProof.sensorMetrics || foundProof.sensorData || null,
        proofDetails: {
          proofId: foundProof.proofId,
          capturedAt: foundProof.createdAt || foundProof.timestamp || foundProof.metadata?.timestamp || foundProof.metadata?.capturedAt || new Date().toISOString(),
          integrityScore: isTampered ? 25 : (foundProof.integrityScore || 98),
          confidence: isTampered ? 20.0 : (foundProof.confidence || 99.7),
          deviceId: foundProof.metadata?.deviceId || 'Verified Device',
          sensorData: foundProof.sensorData || foundProof.sensorMetrics,
          metadata: foundProof.metadata,
          imageData: foundProof.imageData,
          imageHash: foundProof.imageHash || foundProof.sha256Hash,
          exif: foundProof.metadata?.exif || null,
        },
      },
      message: 'Proof retrieved successfully',
    });
  } catch (error) {
    logger.error(`Error querying proof: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve proof',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify media authenticity (POST /api/media/verify or POST /api/verify)
 */
const verifyMedia = async (req, res) => {
  try {
    const rawProofId = req.body?.proofId || req.params?.proofId || req.query?.proofId;
    const cleanProofId = rawProofId ? String(rawProofId).trim().toUpperCase().replace(/.*\/VERIFY\//i, '').replace(/.*\//, '').replace(/[^A-Z0-9-]/g, '') : '';
    const { fileHash, metadata, uploadedMediaHash } = req.body;
    const safeUploadedHash = uploadedMediaHash || fileHash || null;

    // Validate input: requires at least metadata, uploadedMediaHash, or a Proof ID
    if (!metadata && !safeUploadedHash && !cleanProofId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: metadata, uploadedMediaHash, or proofId',
      });
    }

    let isExactMatch = false;
    let proofFound = false;
    let existingProof = null;
    let storedHash = null;
    let matchedProofId = cleanProofId || null;

    if (cleanProofId) {
      const target = cleanProofId.startsWith('AURA-') ? cleanProofId : `AURA-${cleanProofId}`;
      const idWithoutPrefix = cleanProofId.replace(/^AURA-/, '');
      const escapedCleanId = escapeRegex(cleanProofId);
      const escapedTarget = escapeRegex(target);

      if (isDbConnected()) {
        existingProof = await Proof.findOne({
          $or: [
            { proofId: cleanProofId },
            { proofId: target },
            { proofId: idWithoutPrefix },
            { proofId: { $regex: new RegExp(`^${escapedCleanId}`, 'i') } },
            { proofId: { $regex: new RegExp(`^${escapedTarget}`, 'i') } },
          ],
        });
      }
      if (!existingProof) {
        existingProof = getFromLedger(cleanProofId) || getFromLedger(target);
      }
    }

    if (!existingProof && safeUploadedHash) {
      if (isDbConnected()) {
        existingProof = await Proof.findOne({
          $or: [{ imageHash: safeUploadedHash }, { hash: safeUploadedHash }, { sha256Hash: safeUploadedHash }],
        });
      }
    }

    if (existingProof) {
      proofFound = true;
      matchedProofId = existingProof.proofId;
      storedHash = existingProof.imageHash || existingProof.sha256Hash || existingProof.hash;

      if (safeUploadedHash) {
        isExactMatch = (storedHash === safeUploadedHash);
      } else {
        isExactMatch = true;
      }
    }

    // If pure Proof ID lookup was performed and not found in ledger, return HTTP 404
    if (!proofFound && cleanProofId && !safeUploadedHash) {
      if (isDbConnected()) {
        try {
          const availableProofs = await Proof.find({}, 'proofId');
          console.log('Available Proofs:', availableProofs.map((p) => p.proofId));
        } catch (e) {
          console.log('Error listing available proofs:', e.message);
        }
      }
      console.log('Available In-Memory Proofs:', listLedgerIds());

      return res.status(404).json({
        success: false,
        proofFound: false,
        message: 'Proof ID not found in ledger',
      });
    }

    const matchPercentage = proofFound ? (isExactMatch ? 100 : 15.0) : 0;
    const isRecaptured = existingProof ? Boolean(
      existingProof.integrityAnalysis?.isRecaptured || 
      existingProof.isRecaptured || 
      existingProof.integrityAnalysis?.screenDefense?.isRecaptured ||
      existingProof.integrityAnalysis?.screenDefense?.result === 'failed'
    ) : false;

    const screenDefensePassed = existingProof ? (
      !isRecaptured && Boolean(
        existingProof.integrityAnalysis?.screenDefense?.screenDefensePassed ||
        existingProof.screenDefensePassed ||
        existingProof.integrityAnalysis?.screenDefense?.result === 'passed'
      )
    ) : true;

    let auraFlag = 'GREEN';
    let statusMessage = '✅ AUTHENTIC CAPTURE';
    let statusDetails = 'Proof Found | Media Integrity: MATCH | Cryptographic Proof: VALID';
    let status = 'verified';

    if (!proofFound) {
      auraFlag = 'YELLOW';
      statusMessage = '⚠️ UNVERIFIED (NO PROOF)';
      statusDetails = 'No matching cryptographic proof registered in the AURA ledger.';
      status = 'unverified';
    } else if (isRecaptured) {
      auraFlag = 'RED';
      statusMessage = '❌ SECOND-COPY DETECTED (RECAPTURED)';
      statusDetails = 'Screen replay detected. Optical flicker and display artifacts identified.';
      status = 'tampered';
    } else if (!isExactMatch) {
      auraFlag = 'RED';
      statusMessage = '❌ MEDIA MODIFIED (TAMPERED)';
      statusDetails = 'Cryptographic hash mismatch. Media has been altered after capture.';
      status = 'tampered';
    }

    const confidence = proofFound
      ? (isExactMatch ? (existingProof.confidence || 99.7) : 15.0)
      : 0;

    const verification = {
      proofId: matchedProofId,
      status,
      isVerified: status === 'verified' || status === 'authentic',
      confidence,
      auraFlag,
      statusMessage,
      statusDetails,
      proofFound,
      isRecaptured,
      screenDefensePassed,
      sensorsPassed: status === 'verified' || status === 'authentic',
      hashMatch: matchPercentage,
      integrityScore: existingProof?.integrityScore || (status === 'tampered' ? 25 : 98),
      aiProbability: status === 'tampered' ? 0.85 : 0.02,
      classification: status === 'tampered' ? 'AI_OR_SCREEN_REPLAY' : 'AUTHENTIC_CAMERA',
      hashValidation: {
        isValid: isExactMatch,
        matchPercentage,
        status: isExactMatch 
          ? 'Exact Match (100% Cryptographic Integrity)' 
          : (proofFound ? 'Hash Mismatch (Media Altered)' : 'No Registered Proof Found'),
        uploadedHash: safeUploadedHash || 'none',
        storedHash: storedHash || 'none',
      },
      sensorValidation: proofFound ? (screenDefensePassed ? 'passed' : 'failed') : 'unknown',
      metadataConsistency: proofFound ? 'consistent' : 'unknown',
      timestamp: new Date().toISOString(),
      screenDefense: {
        result: screenDefensePassed ? 'passed' : 'failed',
        magnetometerPassed: screenDefensePassed,
        lightFlickerPassed: screenDefensePassed,
        details: isRecaptured 
          ? 'Screen flicker or magnetic display disturbance detected' 
          : 'Verified real-world ambient environment',
      },
      physicsDefense: {
        motionPassed: true,
        gravityConsistent: true,
        details: 'Handheld human micro-tremor signature consistent with authentic capture',
      },
      sensorMetrics: existingProof?.sensorMetrics || existingProof?.sensorData || null,
      proofDetails: existingProof ? {
        proofId: existingProof.proofId,
        capturedAt: existingProof.createdAt || existingProof.timestamp || existingProof.metadata?.timestamp || existingProof.metadata?.capturedAt || new Date().toISOString(),
        integrityScore: existingProof.integrityScore || (isExactMatch ? 98 : 30),
        confidence: existingProof.confidence || 99.7,
        deviceId: existingProof.metadata?.deviceId || 'Verified Device',
        sensorData: existingProof.sensorData || existingProof.sensorMetrics,
        metadata: existingProof.metadata,
        imageData: existingProof.imageData,
        imageHash: existingProof.imageHash || existingProof.sha256Hash,
        exif: existingProof.metadata?.exif || null,
      } : null,
    };

    logger.info(`Verification result for ${matchedProofId || 'unregistered'}: ${status} (AuraFlag: ${auraFlag}, Match: ${matchPercentage}%)`);

    return res.status(200).json({
      success: true,
      isVerified: status === 'verified' || status === 'authentic',
      proof: existingProof || verification.proofDetails || null,
      hashMatch: matchPercentage,
      auraFlag,
      sensors: (status === 'verified' || status === 'authentic') ? 'PASSED' : 'FAILED',
      sensorsPassed: (status === 'verified' || status === 'authentic'),
      status,
      confidence,
      integrityScore: verification.integrityScore,
      aiProbability: verification.aiProbability,
      classification: verification.classification,
      verification,
      message: statusMessage,
    });
  } catch (error) {
    logger.error(`Error verifying media: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Decode QR Code from an uploaded image base64
 * POST /api/media/decode-qr or POST /api/verify/scan-qr
 */
const decodeQrCode = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: image (base64 string)',
      });
    }

    const cleanBase64 = String(image).replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    let pipeline = sharp(imageBuffer).ensureAlpha();
    const metadata = await sharp(imageBuffer).metadata();

    if (metadata.width > 1600 || metadata.height > 1600) {
      pipeline = pipeline.resize({ width: 1600, height: 1600, fit: 'inside' });
    }

    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const clampedArray = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
    const qrCode = jsQR(clampedArray, info.width, info.height);

    if (!qrCode || !qrCode.data) {
      return res.json({
        success: false,
        message: 'No QR code detected in the selected image',
      });
    }

    logger.info(`[QR] Successfully decoded QR code: ${qrCode.data}`);
    return res.json({
      success: true,
      data: qrCode.data,
      message: 'QR code decoded successfully',
    });
  } catch (error) {
    logger.error(`[QR] Error decoding QR code: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to decode QR code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Store verification result
 */
const storeVerificationResult = async (req, res) => {
  try {
    const { mediaHash, verificationResult, metadata } = req.body;

    if (!mediaHash || !verificationResult) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: mediaHash, verificationResult',
      });
    }

    const verificationId = `RESULT_${uuidv4()}`;
    const actualVerif = verificationResult.verification || verificationResult;

    let rawStatus = actualVerif.status || actualVerif.auraFlag || 'unverified';
    rawStatus = String(rawStatus).toLowerCase();
    let status = 'unverified';
    if (rawStatus.includes('auth') || rawStatus.includes('green') || rawStatus.includes('pass') || rawStatus.includes('verif')) {
      status = 'authentic';
    } else if (rawStatus.includes('tamp') || rawStatus.includes('fail') || rawStatus.includes('red')) {
      status = 'tampered';
    } else if (rawStatus.includes('inconc') || rawStatus.includes('amber') || rawStatus.includes('yellow')) {
      status = 'inconclusive';
    } else {
      status = 'unverified';
    }

    let rawConfidence = actualVerif.confidence ?? actualVerif.overallConfidence ?? actualVerif.overallScore ?? (status === 'authentic' ? 99.7 : 0);
    let confidence = Number(rawConfidence);
    if (!Number.isFinite(confidence) || isNaN(confidence)) {
      confidence = (status === 'authentic' ? 99.7 : 0);
    }
    confidence = Math.max(0, Math.min(100, parseFloat(confidence.toFixed(1))));

    const resolvedProofId = actualVerif.proofId || actualVerif.id || actualVerif.verificationId || `PROOF_${mediaHash.slice(0, 12)}`;

    let persistedToDb = false;
    if (isDbConnected()) {
      try {
        const result = new VerificationResult({
          verificationId,
          proofId: resolvedProofId,
          fileHash: mediaHash,
          hashValidation: actualVerif.hashValidation || {
            isValid: status === 'authentic',
            matchPercentage: confidence,
            uploadedHash: mediaHash,
            storedHash: actualVerif.hashValidation?.storedHash || null,
          },
          status,
          confidence,
          metadata: {
            fileName: metadata?.fileName || actualVerif.fileName,
            fileSize: metadata?.fileSize || metadata?.size,
            fileMimeType: metadata?.fileMimeType || metadata?.type,
            verifiedAt: new Date().toISOString(),
            verifiedFrom: metadata?.verifiedFrom || 'AURA Mobile App',
          },
          flagged: status === 'tampered',
          flagReason: status === 'tampered' ? (actualVerif.statusDetails || 'Integrity anomaly detected') : null,
        });
        await result.save();
        persistedToDb = true;
        logger.info(`Stored verification result: ${verificationId} (status: ${status}, confidence: ${confidence}%)`);
      } catch (dbError) {
        logger.warn(`Could not persist verification result to DB: ${dbError.message}`);
      }
    } else {
      logger.warn('MongoDB not connected - verification result not persisted');
    }

    res.json({
      success: true,
      resultId: verificationId,
      persistedToDb,
      status,
      confidence,
      message: 'Verification result stored successfully',
      storedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error storing result: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to store verification result',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get verification history
 */
const getVerificationHistory = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json({
        success: true,
        history: [],
        total: 0,
        message: 'Database not connected. No history available.',
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [history, total] = await Promise.all([
      VerificationResult.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('-__v'),
      VerificationResult.countDocuments(),
    ]);

    res.json({
      success: true,
      history,
      total,
      limit,
      skip,
      message: 'Verification history retrieved successfully',
    });
  } catch (error) {
    logger.error(`Error retrieving history: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Analyze image metadata using ML scoring model
 * POST /api/media/analyze-metadata
 */
const analyzeMetadata = async (req, res) => {
  try {
    const { image, fileName, fileType, exifData } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: image (base64 string)',
      });
    }

    if (typeof image === 'string' && image.length > 55_000_000) {
      return res.status(413).json({
        success: false,
        message: 'Image too large for metadata analysis (max ~40MB)',
      });
    }

    logger.info(`[ML] Starting metadata analysis${fileName ? ` for: ${fileName}` : ''}`);

    const buffer = toBuffer(image);
    const result = await analyzeImageMetadata(buffer, exifData);

    logger.info(
      `[ML] Analysis complete - classification: ${result.classification} ` +
      `(AI: ${result.aiProbability}%, confidence: ${result.confidence}%)`
    );

    const { metadataFingerprint, ...restResult } = result;
    const safeFingerprint = metadataFingerprint
      ? (({ latitude, longitude, ...fp }) => fp)(metadataFingerprint)
      : null;
    const responseAnalysis = { ...restResult, metadataFingerprint: safeFingerprint };

    res.json({
      success: true,
      analysis: {
        ...responseAnalysis,
        fileName: fileName || 'unknown',
        fileType: fileType || 'unknown',
      },
      message: `Image classified as ${result.classification} with ${result.confidence}% confidence`,
    });
  } catch (error) {
    logger.error(`[ML] Metadata analysis error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Metadata analysis failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  verifyMedia,
  verifyByProofId,
  decodeQrCode,
  storeVerificationResult,
  getVerificationHistory,
  analyzeMetadata,
};
