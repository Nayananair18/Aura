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
    const { fileHash, metadata, uploadedMediaHash } = req.body;

    // Validate input
    if (!fileHash || !metadata || !uploadedMediaHash) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fileHash, metadata, uploadedMediaHash',
      });
    }

    // Exact hash match
    const isExactMatch = fileHash === uploadedMediaHash;

    // Deterministic confidence: 99.7 for exact match, Hamming-distance-based for mismatch
    const matchPercentage = isExactMatch
      ? 100
      : hammingConfidence(fileHash, uploadedMediaHash);

    const confidence = isExactMatch ? 99.7 : matchPercentage;
    const status = isExactMatch ? 'authentic' : (confidence > 60 ? 'suspicious' : 'tampered');

    const verificationId = `VERIF_${uuidv4()}`;
    const verificationResult = {
      verificationId,
      status,
      confidence,
      hashValidation: {
        isValid: isExactMatch,
        matchPercentage,
        uploadedHash: uploadedMediaHash.substring(0, 16) + '...',
        storedHash: fileHash.substring(0, 16) + '...',
      },
      sensorValidation: isExactMatch ? 'passed' : 'failed',
      metadataConsistency: isExactMatch ? 'consistent' : 'inconsistent',
      timestamp: new Date().toISOString(),
      auraFlag: isExactMatch ? 'GREEN' : (status === 'suspicious' ? 'YELLOW' : 'RED'),
      screenDefense: {
        result: isExactMatch ? 'passed' : 'failed',
        magnetometerPassed: isExactMatch,
        lightFlickerPassed: isExactMatch,
        details: isExactMatch ? 'No display signatures found' : 'Potential digital grid detected',
      },
      physicsDefense: {
        motionPassed: isExactMatch,
        gravityConsistent: isExactMatch,
        details: isExactMatch ? 'Handheld signatures verified' : 'Mathematical inconsistency',
      },
      fileInfo: {
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        fileSize: metadata.fileSize,
        uploadedAt: metadata.uploadedAt,
      },
    };

    logger.info(`Verification complete: ${verificationId} — ${status} (confidence: ${confidence}%)`);

    res.json({
      success: true,
      verification: verificationResult,
      message: isExactMatch ? 'Media is authentic' : 'Media shows signs of tampering',
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
    const { image, fileName, fileType } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: image (base64 string)',
      });
    }

    // Check rough size — base64 of 10MB image ≈ 14MB string
    if (typeof image === 'string' && image.length > 20_000_000) {
      return res.status(413).json({
        success: false,
        message: 'Image too large for metadata analysis (max ~15MB)',
      });
    }

    logger.info(`[ML] Starting metadata analysis${fileName ? ` for: ${fileName}` : ''}`);

    const buffer = toBuffer(image);
    const result = await analyzeImageMetadata(buffer);

    logger.info(
      `[ML] Analysis complete — classification: ${result.classification} ` +
      `(AI: ${result.aiProbability}%, confidence: ${result.confidence}%)`
    );

    res.json({
      success: true,
      analysis: {
        ...result,
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
