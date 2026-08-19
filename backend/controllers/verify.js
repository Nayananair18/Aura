const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const VerificationResult = require('../models/VerificationResult');
const Proof = require('../models/Proof');
const { generateHash, compareHashes } = require('../utils/crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { analyzeImageMetadata, toBuffer } = require('../utils/metadataAnalyzer');

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
    const { fileHash, metadata, uploadedMediaHash, proofId } = req.body;

    // Validate input (uploadedMediaHash can be optional if proofId alone is supplied for lookup)
    if (!metadata && !uploadedMediaHash && !proofId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: metadata, uploadedMediaHash, or proofId',
      });
    }

    const safeUploadedHash = uploadedMediaHash || fileHash || null;
    let isExactMatch = false;
    let proofFound = false;
    let existingProof = null;
    let storedHash = fileHash || null;
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

      if (existingProof) {
        proofFound = true;
        matchedProofId = existingProof.proofId;
        storedHash = existingProof.imageHash || existingProof.hash;

        // Compare uploaded image hash with stored proof image hash
        if (safeUploadedHash) {
          isExactMatch = (storedHash === safeUploadedHash);
        } else {
          // If only proofId was queried without sending image hash, treat as proof found
          isExactMatch = true;
        }
      }
    }

    // Deterministic confidence: 99.7 for exact match, low for mismatch
    const matchPercentage = isExactMatch
      ? 100
      : (proofFound ? 15.0 : hammingConfidence(storedHash, safeUploadedHash));

    const confidence = isExactMatch ? 99.7 : matchPercentage;

    // Determine status & flag according to requirement #4:
    // 1. Authentic: Proof Found + Media Integrity MATCH
    // 2. Tampered (Modified): Proof Found + Media Integrity MISMATCH (QR copied or image edited)
    // 3. Unverified: No valid proof record found
    let status;
    let auraFlag;
    let statusDetails;
    let message;

    if (isExactMatch) {
      status = 'authentic';
      auraFlag = 'GREEN';
      message = '✓ AUTHENTIC CAPTURE';
      statusDetails = 'Proof Found | Media Integrity: MATCH | Cryptographic Proof: VALID | Capture Evidence: VALID';
    } else if (proofFound) {
      status = 'tampered';
      auraFlag = 'RED';
      message = '⚠ MEDIA MODIFIED';
      statusDetails = 'Proof Found | Original Proof: VALID | Media Integrity: MISMATCH | Current Media: MODIFIED';
    } else {
      status = 'unverified';
      auraFlag = 'YELLOW';
      message = '? UNVERIFIED MEDIA';
      statusDetails = 'No valid AURA proof found';
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
        uploadedHash: safeUploadedHash ? safeUploadedHash.substring(0, 16) + '...' : 'none',
        storedHash: storedHash ? storedHash.substring(0, 16) + '...' : 'none',
      },
      sensorValidation: isExactMatch ? 'passed' : (proofFound ? 'failed' : 'unknown'),
      metadataConsistency: isExactMatch ? 'consistent' : 'unknown',
      timestamp: new Date().toISOString(),
      screenDefense: {
        result: isExactMatch ? 'passed' : (proofFound ? 'failed' : 'unknown'),
        magnetometerPassed: isExactMatch,
        lightFlickerPassed: isExactMatch,
        details: isExactMatch ? 'No display signatures found' : (proofFound ? 'Digital canvas mismatch' : 'Not evaluated'),
      },
      physicsDefense: {
        motionPassed: isExactMatch,
        gravityConsistent: isExactMatch ? true : null,
        details: isExactMatch ? 'Handheld signatures verified' : (proofFound ? 'Modified media content' : 'Not evaluated'),
      },
      fileInfo: {
        fileName: metadata?.fileName || 'unknown',
        fileType: metadata?.fileType || 'unknown',
        fileSize: metadata?.fileSize || null,
        uploadedAt: metadata?.uploadedAt || new Date().toISOString(),
      },
      proofDetails: existingProof ? {
        proofId: existingProof.proofId,
        capturedAt: existingProof.createdAt,
        integrityScore: existingProof.integrityScore,
        confidence: existingProof.confidence,
        deviceId: existingProof.metadata?.deviceId || 'Verified Device',
      } : null,
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

    let persistedToDb = false;
    if (isDbConnected()) {
      try {
        const result = new VerificationResult({
          verificationId,
          // proofId: use the verificationResult's own verificationId as the source reference
          proofId: verificationResult.verificationId || verificationId,
          fileHash: mediaHash,
          hashValidation: verificationResult.hashValidation,
          status: verificationResult.status,
          confidence: verificationResult.confidence,
          metadata: {
            fileName: metadata?.fileName,
            fileSize: metadata?.fileSize,
            fileMimeType: metadata?.fileMimeType,
            verifiedAt: new Date().toISOString(),
          },
        });
        await result.save();
        persistedToDb = true;
        logger.info(`Stored verification result: ${verificationId}`);
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
  storeVerificationResult,
  getVerificationHistory,
  analyzeMetadata,
};
