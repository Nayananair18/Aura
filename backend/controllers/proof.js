const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Proof = require('../models/Proof');
const {
  formatProofId,
  generateHash,
  generateImageHash,
  generateDeviceFingerprint,
  validateSensorData,
  calculateSensorStats,
  calculateLightStats,
  analyzeSensorIntegrity,
  watermarkImage,
} = require('../utils/crypto');
const logger = require('../utils/logger');

// Max base64 image size: ~8MB (covers a full 6MP JPEG at quality 95)
const MAX_MEDIA_SIZE_BYTES = 8 * 1024 * 1024;

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Generate authenticity proof from all 6 sensor sources
 */
const generateAuthenticityProof = async (req, res) => {
  try {
    const { mediaData, sensorData, metadata } = req.body;

    // Validate all 6 sensor types
    const sensorValidation = validateSensorData(sensorData);
    const validSensors = Object.values(sensorValidation).filter(Boolean).length;

    if (validSensors === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid sensor data provided',
      });
    }

    // Calculate statistics for each sensor type
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
      light: sensorData.light
        ? calculateLightStats(sensorData.light)
        : null,
      location: sensorData.location || null,
      timestamp: sensorData.timestamp || null,
    };

    // Run tamper detection analysis
    const integrityAnalysis = analyzeSensorIntegrity(sensorData);

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(metadata);

    // Generate proof hash (includes ALL sensor data)
    const proofData = {
      sensorData,
      metadata,
      timestamp: new Date().toISOString(),
    };
    const proofHash = generateHash(proofData);

    // Generate per-sensor confidence scores
    const sensorConfidence = {
      light: sensorValidation.light ? 95.0 : 0,
      accelerometer: sensorValidation.accelerometer ? 98.5 : 0,
      gyroscope: sensorValidation.gyroscope ? 97.2 : 0,
      magnetometer: sensorValidation.magnetometer ? 96.8 : 0,
      location: sensorValidation.location ? 94.0 : 0,
      timestamp: sensorValidation.timestamp ? 99.0 : 0,
    };

    // Calculate overall confidence
    const activeScores = Object.values(sensorConfidence).filter((c) => c > 0);
    const overallConfidence =
      activeScores.length > 0
        ? activeScores.reduce((a, b) => a + b) / activeScores.length
        : 0;

    const proofId = metadata.proofId || formatProofId();
    logger.info(`Processing proof ${proofId} (Finalized: ${metadata.isFinalized || false})`);

    // Guard: reject oversized base64 payloads before they hit sharp (OOM protection)
    if (mediaData && Buffer.byteLength(mediaData, 'base64') > MAX_MEDIA_SIZE_BYTES) {
      return res.status(413).json({
        success: false,
        message: `Media data exceeds maximum size of ${MAX_MEDIA_SIZE_BYTES / (1024 * 1024)}MB`,
      });
    }

    const baseUrl = process.env.VERIFICATION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://aura-app.com/verify';
    const verificationUrl = baseUrl.endsWith('/') ? `${baseUrl}${proofId}` : `${baseUrl}/${proofId}`;

    // Add server-side watermark if authentic
    let watermarkedImage = mediaData;
    if (integrityAnalysis.auraFlag === 'GREEN' && !integrityAnalysis.isRecaptured && integrityAnalysis.screenDefense?.screenDefensePassed && mediaData && mediaData.length > 100) {
      logger.info(`Authenticity verified. Applying A.U.R.A. Certified Seal (${proofId})...`);
      watermarkedImage = await watermarkImage(mediaData, proofId, metadata.timestamp || new Date().toISOString(), verificationUrl);
    }
    
    // Hash the final image bytes
    const finalImageHash = watermarkedImage ? generateImageHash(watermarkedImage) : null;

    // Persist to MongoDB if available
    let persistedToDb = false;
    if (isDbConnected()) {
      try {
        if (metadata.isFinalized && metadata.proofId) {
          await Proof.findOneAndUpdate(
            { proofId: metadata.proofId },
            {
              imageData: watermarkedImage,
              imageHash: finalImageHash,
              status: integrityAnalysis.auraFlag === 'GREEN' ? 'authentic' : 'tampered',
            }
          );
          persistedToDb = true;
          logger.info(`Updated proof ${metadata.proofId} in database`);
        } else {
          const proofDocument = new Proof({
            proofId,
            hash: proofHash,
            imageHash: finalImageHash,
            sensorData,
            metadata,
            confidence: overallConfidence,
            integrityScore: integrityAnalysis.overallScore,
            status: integrityAnalysis.auraFlag === 'GREEN' ? 'authentic' : 'tampered',
            imageData: watermarkedImage,
          });
          await proofDocument.save();
          persistedToDb = true;
          logger.info(`Saved new proof ${proofId} to database`);
        }
      } catch (dbError) {
        logger.warn(`DB save skipped: ${dbError.message}`);
      }
    }

    const isRecaptured = Boolean(integrityAnalysis.isRecaptured || integrityAnalysis.screenDefense?.isRecaptured || integrityAnalysis.screenDefense?.result === 'failed');
    const screenDefensePassed = !isRecaptured && Boolean(integrityAnalysis.screenDefense?.screenDefensePassed && integrityAnalysis.screenDefense?.result === 'passed');

    const proof = {
      id: proofId,
      hash: proofHash,
      deviceFingerprint,
      sensorValidation,
      sensorValidationStatus: (overallConfidence >= 70 && !isRecaptured && screenDefensePassed) ? 'passed' : 'failed',
      sensorStats,
      sensorConfidence,
      integrityAnalysis: {
        ...integrityAnalysis,
        isRecaptured,
        screenDefensePassed,
        auraFlag: isRecaptured ? 'RED' : integrityAnalysis.auraFlag,
        overallScore: isRecaptured ? Math.min(integrityAnalysis.overallScore, 30) : integrityAnalysis.overallScore,
      },
      isRecaptured,
      screenDefensePassed,
      sensorsUsed: validSensors,
      totalSensors: 6,
      timestamp: new Date().toISOString(),
      deviceId: metadata.deviceId,
      capturedAt: metadata.capturedAt,
      authenticatedImage: isRecaptured ? null : watermarkedImage,
      exif: metadata?.exif || null,
    };

    const finalIntegrityScore = isRecaptured ? Math.min(integrityAnalysis.overallScore, 30) : integrityAnalysis.overallScore;
    const responseStatus = isRecaptured 
      ? 'tampered' 
      : (integrityAnalysis.auraFlag === 'RED' ? 'tampered' : (integrityAnalysis.auraFlag === 'YELLOW' || finalIntegrityScore < 75 ? 'suspicious' : 'authentic'));

    res.json({
      success: true,
      proof,
      overallConfidence: isRecaptured ? '20.0' : overallConfidence.toFixed(1),
      integrityScore: finalIntegrityScore,
      status: responseStatus,
      isRecaptured,
      screenDefensePassed,
      persistedToDb,
      message: isRecaptured ? 'SECOND-COPY DETECTED (Screen Replay Photo - Optical PWM Flicker / Screen Emission)' : `Proof generated using ${validSensors}/6 sensors`,
    });
  } catch (error) {
    logger.error(`Error generating proof: ${error.message}`, { stack: error.stack });
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

    // Sanitize: only allow alphanumeric and underscores to prevent injection
    if (!/^[A-Za-z0-9_-]+$/.test(proofId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Proof ID format',
      });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database not available.',
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
    logger.error(`Error retrieving proof: ${error.message}`, { stack: error.stack });
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
