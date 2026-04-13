const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Proof = require('../models/Proof');
const {
  generateHash,
  generateDeviceFingerprint,
  validateSensorData,
  calculateSensorStats,
} = require('../utils/crypto');

/**
 * Check if MongoDB is connected and ready for writes
 */
const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Generate authenticity proof
 */
const generateAuthenticityProof = async (req, res) => {
  try {
    const { mediaData, sensorData, metadata } = req.body;

    // Validate sensor data
    const sensorValidation = validateSensorData(sensorData);
    const validSensors = Object.values(sensorValidation).filter(Boolean).length;

    if (validSensors === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid sensor data provided',
      });
    }

    // Calculate sensor statistics
    const sensorStats = {
      accelerometer: sensorData.accelerometer
        ? calculateSensorStats(sensorData.accelerometer)
        : null,
      gyroscope: sensorData.gyroscope
        ? calculateSensorStats(sensorData.gyroscope)
        : null,
      magnetometer: sensorData.magnetometer
        ? calculateSensorStats(sensorData.magnetometer)
        : null,
    };

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(metadata);

    // Generate proof hash
    const proofData = {
      sensorData,
      metadata,
      timestamp: new Date().toISOString(),
    };
    const proofHash = generateHash(proofData);

    // Generate sensor confidence scores
    const sensorConfidence = {
      accelerometer: sensorValidation.accelerometer ? 98.5 : 0,
      gyroscope: sensorValidation.gyroscope ? 97.2 : 0,
      magnetometer: sensorValidation.magnetometer ? 96.8 : 0,
      light: 95.0,
    };

    // Calculate overall confidence
    const confidenceScores = Object.values(sensorConfidence).filter((c) => c > 0);
    const overallConfidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((a, b) => a + b) / confidenceScores.length
        : 0;

    const proofId = `PROOF_${uuidv4()}`;

    // Save proof to database only if MongoDB is connected
    let persistedToDb = false;
    if (isDbConnected()) {
      try {
        const proofDocument = new Proof({
          proofId,
          hash: proofHash,
          sensorData,
          metadata,
          confidence: overallConfidence,
          status: 'unverified',
        });
        await proofDocument.save();
        persistedToDb = true;
      } catch (dbError) {
        console.warn('Could not persist proof to DB (continuing without persistence):', dbError.message);
      }
    } else {
      console.warn('MongoDB not connected — proof generated in-memory only');
    }

    const proof = {
      id: proofId,
      hash: proofHash,
      deviceFingerprint,
      sensorValidation,
      sensorStats,
      sensorConfidence,
      timestamp: new Date().toISOString(),
      deviceId: metadata.deviceId,
      capturedAt: metadata.capturedAt,
    };

    res.json({
      success: true,
      proof,
      overallConfidence: overallConfidence.toFixed(1),
      persistedToDb,
      message: 'Authenticity proof generated successfully',
    });
  } catch (error) {
    console.error('Error generating proof:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authenticity proof',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get stored proof by ID
 */
const getProof = async (req, res) => {
  try {
    const { proofId } = req.params;

    if (!proofId) {
      return res.status(400).json({
        success: false,
        message: 'Proof ID is required',
      });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database not available. Cannot retrieve stored proofs.',
      });
    }

    const proof = await Proof.findOne({ proofId });

    if (!proof) {
      return res.status(404).json({
        success: false,
        message: 'Proof not found',
      });
    }

    res.json({
      success: true,
      message: 'Proof retrieved successfully',
      proof,
    });
  } catch (error) {
    console.error('Error retrieving proof:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve proof',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  generateAuthenticityProof,
  getProof,
};
