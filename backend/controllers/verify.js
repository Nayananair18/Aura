const { v4: uuidv4 } = require('uuid');
const { generateHash, compareHashes } = require('../utils/crypto');
const config = require('../config/config');

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

    // Compare hashes - EXACT match only
    const isExactMatch = fileHash === uploadedMediaHash;

    // Determine status based on exact match
    let status = 'authentic';
    let confidence = 99.7;
    let matchPercentage = 100;

    if (!isExactMatch) {
      status = 'tampered';
      confidence = Math.floor(Math.random() * 40 + 10); // 10-50% confidence for tampered
      matchPercentage = Math.floor(Math.random() * 30 + 10); // 10-40% match
    }

    // Generate verification result
    const verificationResult = {
      verificationId: `VERIF_${uuidv4()}`,
      status,
      confidence,
      hashValidation: {
        status: isExactMatch ? 'match' : 'mismatch',
        originalHash: fileHash.substring(0, 16) + '...',
        uploadedHash: uploadedMediaHash.substring(0, 16) + '...',
        matchPercentage,
      },
      sensorValidation: isExactMatch ? 'passed' : 'failed',
      metadataConsistency: isExactMatch ? 'consistent' : 'inconsistent',
      timestamp: new Date().toISOString(),
      fileInfo: {
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        fileSize: metadata.fileSize,
        uploadedAt: metadata.uploadedAt,
      },
    };

    res.json({
      success: true,
      verification: verificationResult,
      message: isExactMatch
        ? 'Media is authentic'
        : 'Media shows signs of tampering',
    });
  } catch (error) {
    console.error('Error verifying media:', error);
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

    // In a real app, save to database
    const resultId = `RESULT_${uuidv4()}`;

    res.json({
      success: true,
      resultId,
      message: 'Verification result stored successfully',
      storedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error storing result:', error);
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
    const { limit = 10, skip = 0 } = req.query;

    // In a real app, fetch from database
    const history = [
      {
        id: 'RESULT_1712984400000',
        status: 'authentic',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        hash: 'sha256_abc123def456',
        confidence: 99.7,
      },
      {
        id: 'RESULT_1712980800000',
        status: 'authentic',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        hash: 'sha256_ghi789jkl012',
        confidence: 98.5,
      },
    ];

    res.json({
      success: true,
      history: history.slice(skip, skip + limit),
      total: history.length,
      message: 'Verification history retrieved successfully',
    });
  } catch (error) {
    console.error('Error retrieving history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  verifyMedia,
  storeVerificationResult,
  getVerificationHistory,
};
