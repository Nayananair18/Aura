const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const VerificationResult = require('../models/VerificationResult');
const Proof = require('../models/Proof');
const {
  generateHash,
  compareHashes,
  formatProofId,
  generateImageHash,
  watermarkImage,
  calculateDetailedStats,
  calculateLightStats,
} = require('../utils/crypto');
const { saveToLedger, getLedgerProof } = require('../utils/ledgerStore');
const config = require('../config/config');
const logger = require('../utils/logger');
const { analyzeImageMetadata, toBuffer } = require('../utils/metadataAnalyzer');
const { analyzeWithGroq, analyzeScreenReplayWithGroq } = require('../tests/testAnalyzer');

/**
 * Check if MongoDB is connected and ready for writes
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Calculate Hamming distance between two hex strings.
 * Returns a deterministic confidence score (0–100) based on
 * how similar the hash characters are — NO Math.random().
 */
const hammingConfidence = (hashA, hashB) => {
  if (!hashA || !hashB) return 0;
  // Pad or truncate to same length
  const len = Math.min(hashA.length, hashB.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (hashA[i] === hashB[i]) matches++;
  }
  return parseFloat(((matches / len) * 100).toFixed(1));
};

/**
 * Verify media authenticity
 */
const verifyMedia = async (req, res) => {
  try {
    const { fileHash, metadata, uploadedMediaHash, proofId, image } = req.body;

    // Validate input (uploadedMediaHash can be optional if proofId alone is supplied for lookup)
    if (!metadata && !uploadedMediaHash && !proofId && !image) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: metadata, uploadedMediaHash, proofId, or image',
      });
    }

    const safeUploadedHash = uploadedMediaHash || fileHash || null;
    let isExactMatch = false;
    let proofFound = false;
    let existingProof = null;
    let storedHash = null;
    let matchedProofId = proofId || null;

    if (isDbConnected()) {
      // Step 1: If proofId is explicitly provided, look up by proofId first
      if (proofId) {
        existingProof = await Proof.findOne({ proofId: proofId.trim() });
      }

      // Step 2: If no proof found by proofId, try looking up by image hash
      if (!existingProof && safeUploadedHash) {
        existingProof = await Proof.findOne({
          $or: [{ imageHash: safeUploadedHash }, { hash: safeUploadedHash }],
        });
      }
    }

    // Step 1b: If not found in DB or DB disconnected, check in-memory ledger cache
    if (!existingProof && proofId) {
      existingProof = getLedgerProof(proofId.trim());
    }

    if (existingProof) {
      proofFound = true;
      matchedProofId = existingProof.proofId;
      storedHash = existingProof.imageHash || existingProof.hash;

      // Compare uploaded image hash with stored proof image hash
      if (safeUploadedHash) {
        isExactMatch = (storedHash === safeUploadedHash);
      } else {
        isExactMatch = true;
      }
    }

    // Step 3: If external photo upload and not found in DB ledger, perform real camera verification and auto-certify if authentic
    const imagePayload = image || metadata?.image || null;
    let autoCertifiedProof = null;
    let isExternalScreenRecapture = false;
    let isExternalAiGenerated = false;
    let externalAnalysisResults = null;

    if (!existingProof && imagePayload) {
      try {
        const targetBuffer = toBuffer(imagePayload);
        if (targetBuffer && targetBuffer.length > 0) {
          const [mlRes, groqRes, screenReplayRes] = await Promise.all([
            analyzeImageMetadata(targetBuffer, metadata?.exif),
            analyzeWithGroq(targetBuffer).catch(() => null),
            analyzeScreenReplayWithGroq(targetBuffer).catch(() => null),
          ]);

          externalAnalysisResults = { mlRes, groqRes, screenReplayRes };

          const isMlScreenRecapture = Boolean(
            mlRes?.classification === 'SCREEN_RECAPTURE' ||
            mlRes?.classification === 'SCREEN_REPLAY' ||
            (mlRes?.screenScore ?? 0) >= 0.50 ||
            (mlRes?.screenScore ?? 0) >= 50
          );
          const isGroqScreenReplay = Boolean(screenReplayRes?.isScreenReplay === true);
          const isGroqConfirmedRealWorld = Boolean(
            screenReplayRes?.success === true &&
            screenReplayRes?.isScreenReplay === false &&
            (screenReplayRes?.confidence ?? 0) >= 80
          );

          const isScreenRecaptureDetected = isGroqConfirmedRealWorld
            ? false
            : (isGroqScreenReplay || isMlScreenRecapture);

          const aiProb = mlRes?.aiProbability ?? 0;
          const groqAiProb = groqRes?.success ? (groqRes.aiProbability ?? 0) : 0;
          const isGroqAiDetected = Boolean(
            groqRes?.success &&
            (groqRes.groqClassification === 'AI_GENERATED' || groqAiProb >= 70)
          );
          const isRealCamClass = mlRes?.classification === 'REAL_CAMERA' || mlRes?.classification === 'AUTHENTIC_CAMERA' || groqRes?.groqClassification === 'REAL_CAMERA' || groqRes?.groqClassification === 'REAL_WORLD';

          if (isScreenRecaptureDetected) {
            isExternalScreenRecapture = true;
            logger.warn(`🔴 External upload rejected: Screen recapture detected (ML score: ${mlRes?.screenScore || 0}, Groq replay: ${isGroqScreenReplay})`);
          } else if (isGroqAiDetected || aiProb >= 70) {
            isExternalAiGenerated = true;
            logger.warn(`🔴 External upload rejected: AI generation detected (Groq: ${groqAiProb}%, ML: ${aiProb}%)`);
          } else if (aiProb <= 25 && groqAiProb <= 35 && isRealCamClass) {
            // Forensic ML & Groq VLM confirm real camera photo with 0% screen risk and low AI risk (<= 25%)
            const newProofId = formatProofId();
            const baseUrl = process.env.VERIFICATION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://aura-app.com/verify';
            const verificationUrl = baseUrl.endsWith('/') ? `${baseUrl}${newProofId}` : `${baseUrl}/${newProofId}`;

            let watermarkedImage = imagePayload;
            try {
              watermarkedImage = await watermarkImage(imagePayload, newProofId, metadata?.uploadedAt || new Date().toISOString(), verificationUrl);
            } catch (wErr) {
              logger.warn(`Watermarking fallback: ${wErr.message}`);
            }

            const finalImageHash = watermarkedImage ? generateImageHash(watermarkedImage) : (safeUploadedHash || generateHash({ newProofId, date: Date.now() }));

            autoCertifiedProof = {
              proofId: newProofId,
              hash: finalImageHash,
              imageHash: finalImageHash,
              status: 'authentic',
              confidence: mlRes?.confidence || 96.5,
              integrityScore: 95,
              auraFlag: 'GREEN',
              metadata: {
                ...(metadata || {}),
                exif: metadata?.exif || mlRes?.metadataFingerprint || {},
                ml: mlRes,
                groq: { imageAnalysis: groqRes, screenReplay: screenReplayRes },
                certifiedAt: new Date().toISOString(),
                verifiedFrom: 'AURA Validator (Post-Analysis Verification)',
              },
              imageData: watermarkedImage,
            };

            if (isDbConnected()) {
              try {
                const createdProofDoc = new Proof(autoCertifiedProof);
                await createdProofDoc.save();
                saveToLedger(newProofId, autoCertifiedProof);
                logger.info(`✅ Auto-certified & sealed external photo in AURA ledger (${newProofId})`);
              } catch (dbSaveErr) {
                logger.warn(`Could not save auto-certified proof to MongoDB: ${dbSaveErr.message}`);
              }
            } else {
              saveToLedger(newProofId, autoCertifiedProof);
            }

            existingProof = autoCertifiedProof;
            proofFound = true;
            matchedProofId = newProofId;
            isExactMatch = true;
            storedHash = finalImageHash;
          }
        }
      } catch (autoCertErr) {
        logger.warn(`Auto-certification analysis warning: ${autoCertErr.message}`);
      }
    }

    // Deterministic match percentage:
    // If exact match on registered proof: 100%
    // If proof found but hash mismatch (tampered): 15%
    // If not found in database ledger: 0% (Unregistered)
    const matchPercentage = proofFound
      ? (isExactMatch ? 100 : 15.0)
      : 0;

    const confidence = isExactMatch
      ? 99.7
      : (proofFound
        ? 15.0
        : (isExternalScreenRecapture
          ? (externalAnalysisResults?.screenReplayRes?.confidence || 95.0)
          : (isExternalAiGenerated
            ? Math.max(externalAnalysisResults?.groqRes?.aiProbability || 0, externalAnalysisResults?.mlRes?.aiProbability || 0, 90.0)
            : 0)));

    let status;
    let auraFlag;
    let statusDetails;
    let message;

    const isProofAuthentic = existingProof ? (existingProof.status === 'authentic' && (existingProof.integrityScore ?? 100) >= 70) : false;

    if (isExactMatch && isProofAuthentic) {
      status = 'authentic';
      auraFlag = 'GREEN';
      message = '✓ AUTHENTIC CAPTURE';
      statusDetails = 'Proof Found | Media Integrity: MATCH | Cryptographic Proof: VALID';
    } else if (proofFound) {
      status = 'tampered';
      auraFlag = 'RED';
      message = '✗ MEDIA MODIFIED';
      statusDetails = isExactMatch
        ? 'Proof Found | Media recorded as Tampered/Suspicious'
        : 'Proof Found | Media Integrity: MISMATCH';
    } else if (isExternalScreenRecapture) {
      status = 'tampered';
      auraFlag = 'RED';
      message = '🔴 SCREEN RECAPTURE DETECTED';
      statusDetails = 'External image rejected: Optical subpixel grid and PWM flicker interference detected (No AURA tag issued)';
    } else if (isExternalAiGenerated) {
      status = 'tampered';
      auraFlag = 'RED';
      message = '✗ AI-GENERATED MEDIA DETECTED';
      statusDetails = 'External image rejected: Synthetic generative AI patterns detected in image forensics (No AURA tag issued)';
    } else {
      status = 'unverified';
      auraFlag = 'YELLOW';
      message = '? UNVERIFIED MEDIA';
      statusDetails = 'No registered AURA proof found in ledger (Unverified External Hash)';
    }

    const verificationId = `VERIF_${uuidv4()}`;
    const verificationResult = {
      verificationId,
      proofId: matchedProofId,
      status,
      confidence,
      auraFlag,
      statusMessage: message,
      statusDetails,
      proofFound,
      hashValidation: {
        isValid: isExactMatch,
        matchPercentage,
        status: proofFound ? (isExactMatch ? 'Verified Match' : 'Hash Mismatch') : '0% Match / Unregistered',
        uploadedHash: safeUploadedHash ? safeUploadedHash.substring(0, 16) + '...' : 'none',
        storedHash: storedHash ? storedHash.substring(0, 16) + '...' : 'none (Unregistered)',
      },
      sensorValidation: isExactMatch ? 'passed' : (proofFound || isExternalScreenRecapture || isExternalAiGenerated ? 'failed' : 'unknown'),
      metadataConsistency: isExactMatch ? 'consistent' : 'unknown',
      timestamp: new Date().toISOString(),
      screenDefense: {
        result: (isExactMatch && isProofAuthentic) ? 'passed' : ((proofFound || isExternalScreenRecapture) ? 'failed' : 'unknown'),
        magnetometerPassed: (isExactMatch && isProofAuthentic),
        lightFlickerPassed: (isExactMatch && isProofAuthentic),
        details: isExternalScreenRecapture
          ? 'Screen Recapture detected via optical PWM & subpixel analysis'
          : ((isExactMatch && isProofAuthentic) ? 'Verified from authentic proof record' : 'Unverified external media (No telemetry sealed)'),
      },
      physicsDefense: {
        motionPassed: (isExactMatch && isProofAuthentic),
        gravityConsistent: (isExactMatch && isProofAuthentic),
        details: (isExactMatch && isProofAuthentic) ? 'Verified from authentic proof record' : 'No handheld micro-tremor telemetry found in ledger',
      },
      proofDetails: existingProof ? {
        proofId: existingProof.proofId,
        capturedAt: existingProof.timestamp,
        integrityScore: existingProof.integrityScore || 95,
        confidence: existingProof.overallConfidence || 99.7,
        deviceId: existingProof.deviceId || 'Verified Device',
        exif: existingProof.metadata?.exif || null,
        groq: existingProof.metadata?.groq || null,
        ml: existingProof.metadata?.ml || null,
        sensorStats: existingProof.sensorData ? {
          magnetometer: existingProof.sensorData.magnetometer ? calculateDetailedStats(existingProof.sensorData.magnetometer) : null,
          light: existingProof.sensorData.light ? calculateLightStats(existingProof.sensorData.light) : null,
          accelerometer: existingProof.sensorData.accelerometer ? calculateDetailedStats(existingProof.sensorData.accelerometer) : null,
        } : null,
      } : (externalAnalysisResults ? {
        proofId: null,
        capturedAt: new Date().toISOString(),
        integrityScore: 15,
        confidence: externalAnalysisResults.mlRes?.confidence || 95,
        deviceId: 'External Upload',
        exif: metadata?.exif || externalAnalysisResults.mlRes?.metadataFingerprint || null,
        groq: { imageAnalysis: externalAnalysisResults.groqRes, screenReplay: externalAnalysisResults.screenReplayRes },
        ml: externalAnalysisResults.mlRes,
      } : null),
      ml: existingProof?.metadata?.ml || externalAnalysisResults?.mlRes || null,
      groq: existingProof?.metadata?.groq || (externalAnalysisResults ? { imageAnalysis: externalAnalysisResults.groqRes, screenReplay: externalAnalysisResults.screenReplayRes } : null),
    };

    logger.info(`Verification complete: ${verificationId} — ${status} (ProofID: ${matchedProofId || 'none'})`);

    res.json({
      success: true,
      verification: verificationResult,
      message,
    });
  } catch (error) {
    logger.error(`Error verifying media: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to verify media',
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

    // Extract actual verification payload (handles both nested .verification and direct object)
    const actualVerif = verificationResult.verification || verificationResult;

    // Normalize status to valid schema enum ('authentic', 'tampered', 'inconclusive', 'unverified')
    let rawStatus = actualVerif.status || actualVerif.auraFlag || 'unverified';
    rawStatus = String(rawStatus).toLowerCase();
    let status = 'unverified';
    if (rawStatus.includes('auth') || rawStatus.includes('green') || rawStatus.includes('pass')) {
      status = 'authentic';
    } else if (rawStatus.includes('tamp') || rawStatus.includes('fail') || rawStatus.includes('red')) {
      status = 'tampered';
    } else if (rawStatus.includes('inconc') || rawStatus.includes('amber') || rawStatus.includes('yellow')) {
      status = 'inconclusive';
    } else {
      status = 'unverified';
    }

    // Normalize confidence (0 - 100 number)
    let rawConfidence = actualVerif.confidence ?? actualVerif.overallConfidence ?? actualVerif.overallScore ?? (status === 'authentic' ? 99.7 : 0);
    let confidence = Number(rawConfidence);
    if (!Number.isFinite(confidence) || isNaN(confidence)) {
      confidence = (status === 'authentic' ? 99.7 : 0);
    }
    confidence = Math.max(0, Math.min(100, parseFloat(confidence.toFixed(1))));

    // Resolve proofId
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
      logger.warn('MongoDB not connected — verification result not persisted');
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

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100); // cap at 100
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [history, total] = await Promise.all([
      VerificationResult.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('-__v'), // exclude Mongoose version key
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

    // Check rough size — base64 of 40MB image ≈ 53MB string
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
      `[ML] Analysis complete — classification: ${result.classification} ` +
      `(AI: ${result.aiProbability}%, confidence: ${result.confidence}%)`
    );

    // Always include fingerprint for the Physical Evidence card in the UI.
    // Strip only GPS coordinates from the fingerprint to protect location privacy.
    const { metadataFingerprint, ...restResult } = result;
    const safeFingerprint = metadataFingerprint
      ? (({ latitude, longitude, ...fp }) => fp)(metadataFingerprint)
      : null;
    const responseAnalysis = { ...restResult, metadataFingerprint: safeFingerprint };

    const mlAnalysisData = {
      ...responseAnalysis,
      fileName: fileName || 'unknown',
      fileType: fileType || 'unknown',
    };

    const existingMLResponse = {
      success: true,
      analysis: mlAnalysisData,
      ml: mlAnalysisData,
      message: `Image classified as ${result.classification} with ${result.confidence}% confidence`,
    };

    // Run Groq VLM image analysis and screen replay analysis in parallel
    let groqResult = {
      success: false,
      aiProbability: 50,
      groqClassification: 'UNKNOWN',
      reasoning: 'Groq analysis not run',
    };
    let screenReplayResult = {
      success: false,
      isScreenReplay: false,
      confidence: 0,
      reasoning: 'Groq screen replay analysis not run',
    };

    try {
      logger.info(`[Groq] Running parallel Groq VLM image & screen-replay analysis...`);
      const [gRes, sRes] = await Promise.all([
        analyzeWithGroq(buffer),
        analyzeScreenReplayWithGroq(buffer),
      ]);
      if (gRes) groqResult = gRes;
      if (sRes) screenReplayResult = sRes;
    } catch (groqErr) {
      logger.warn(`[Groq] Analysis failed non-fatally: ${groqErr.message}`);
      groqResult = {
        success: false,
        aiProbability: 50,
        groqClassification: 'UNKNOWN',
        reasoning: `Groq error: ${groqErr.message}`,
        error: groqErr.message,
      };
      screenReplayResult = {
        success: false,
        isScreenReplay: false,
        confidence: 0,
        reasoning: `Groq error: ${groqErr.message}`,
        error: groqErr.message,
      };
    }

    return res.json({
      ...existingMLResponse,
      groq: {
        imageAnalysis: groqResult,
        screenReplay: screenReplayResult,
      },
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
  storeVerificationResult,
  getVerificationHistory,
  analyzeMetadata,
};
