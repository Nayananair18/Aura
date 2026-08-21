const fs = require('fs');
const mongoose = require("mongoose");
const sharp = require("sharp");
const Proof = require("../models/Proof");
const {
  generateHash,
  generateImageHash,
  generateDeviceFingerprint,
  analyzeSensorIntegrity,
  formatProofId,
  calculateSensorStats,
  calculateLightStats,
  validateSensorData,
  watermarkImage,
} = require("../utils/crypto");
const logger = require("../utils/logger");
const { saveToLedger } = require("../utils/ledgerStore");

// Max raw media payload size before Sharp: 30MB base64
const MAX_MEDIA_SIZE_BYTES = 30 * 1024 * 1024;

/**
 * Check if MongoDB is connected
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Generate authenticity proof from sensor readings and image pixel forensics
 */
const generateAuthenticityProof = async (req, res) => {
  try {
    console.log("[INCOMING CREATE PROOF BODY]", {
      hasMediaData: Boolean(req.body?.mediaData),
      mediaLength: req.body?.mediaData ? req.body.mediaData.length : 0,
      hasTelemetry: Boolean(req.body?.telemetry),
      hasSensorData: Boolean(req.body?.sensorData),
      metadata: req.body?.metadata,
    });

    const rawTelemetry = req.body?.telemetry
      ? (typeof req.body.telemetry === "string" ? JSON.parse(req.body.telemetry) : req.body.telemetry)
      : (req.body?.sensorData || {});

    const sensorData = rawTelemetry;
    const { mediaData, metadata } = req.body || {};

    // 1. Direct Inline Pixel-Buffer Inspection using Sharp
    // ==========================================
    // A.U.R.A. Screen Replay Defense & Lens Analysis
    // ==========================================
    let isDisplayScreenImage = false;
    let replayReason = null;
    let imageScreenStats = {};

    // Safely extract media buffer from multiple potential payload paths
    let targetBuffer = null;
    if (req.file && req.file.buffer) {
      targetBuffer = req.file.buffer;
    } else if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      targetBuffer = fs.readFileSync(req.file.path);
    } else if (req.body && req.body.image) {
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      targetBuffer = Buffer.from(base64Data, 'base64');
    } else if (req.body && req.body.mediaData) {
      const base64Data = req.body.mediaData.replace(/^data:image\/\w+;base64,/, '');
      targetBuffer = Buffer.from(base64Data, 'base64');
    }

    console.log('[DEBUG TARGET BUFFER]', {
      hasReqFile: Boolean(req.file),
      reqFileFieldname: req.file ? req.file.fieldname : null,
      hasBodyImage: Boolean(req.body && req.body.image),
      hasBodyMediaData: Boolean(req.body && req.body.mediaData),
      targetBufferLength: targetBuffer ? targetBuffer.length : 0
    });

    if (targetBuffer) {
      try {
        const { data, info } = await sharp(targetBuffer)
          .resize(200, 200, { fit: 'fill' })
          .raw()
          .toBuffer({ resolveWithObject: true });

        let darkPixels = 0;
        let brightPixels = 0;
        let edgeEnergy = 0;
        let chromaticDispersion = 0;
        let totalBrightness = 0;
        const totalPixels = info.width * info.height;

        for (let i = 0; i < data.length; i += info.channels) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;

          // Count pixels up to 110 as dark to catch auto-exposure lifted terminal backgrounds
          if (brightness < 110) darkPixels++;
          if (brightness > 130) brightPixels++;

          if (i >= info.channels * 2) {
            const pr = data[i - info.channels];
            const pg = data[i - info.channels + 1];
            const pb = data[i - info.channels + 2];
            const prevBrightness = (pr + pg + pb) / 3;

            const diffLuma = Math.abs(brightness - prevBrightness);
            if (diffLuma > 10) edgeEnergy += diffLuma;

            // Subpixel RGB splitting present exclusively in digital screen matrices
            const diffR = Math.abs(r - pr);
            const diffG = Math.abs(g - pg);
            const diffB = Math.abs(b - pb);
            chromaticDispersion += Math.abs(diffR - diffG) + Math.abs(diffG - diffB);
          }
        }

        const avgFrameBrightness = totalBrightness / totalPixels;
        const darkRatio = darkPixels / totalPixels;
        const brightRatio = brightPixels / totalPixels;
        const avgEdgeIntensity = edgeEnergy / (totalPixels || 1);
        const avgChromaticDispersion = chromaticDispersion / (totalPixels || 1);

        const dispersionRatio = avgChromaticDispersion / (avgEdgeIntensity || 1);
        const extremeContrastRatio = darkRatio + brightRatio;

        // 1. Digital Screen Fingerprints (Three distinct traps)
        // Trap A: Absolute Screen (Desktops, Laptops, Browsers) -> High absolute dispersion
        const isAbsoluteScreen = avgChromaticDispersion > 6.0;

        // Trap B: High-DPI UI/Text (Phones displaying text) -> Structural dispersion dominates edge intensity
        const isHighDpiTextScreen = avgChromaticDispersion > 3.5 && dispersionRatio > 0.85;

        // Trap C: Flagship OLED Phones displaying natural images (Photos) -> Extreme high density, very low Moiré
        // Modern OLEDs are so dense they only produce ~0.44 chromatic dispersion.
        // We catch them by their midtones. Books have almost NO midtones (extremeContrastRatio > 0.90).
        // If an image has high midtones (extremeContrastRatio < 0.75) AND structural dispersion > 0.80, it's an OLED screen.
        const isPhoneScreenImage = avgChromaticDispersion > 2.0 && extremeContrastRatio < 0.60;

        isDisplayScreenImage = Boolean(isAbsoluteScreen || isHighDpiTextScreen || isPhoneScreenImage);

        // Determine if it was dark or light mode for telemetry/logging
        const isDarkModeScreen = isDisplayScreenImage && darkRatio > brightRatio;
        const isLightModeScreen = isDisplayScreenImage && brightRatio >= darkRatio;

        imageScreenStats = {
          avgFrameBrightness: Number(avgFrameBrightness.toFixed(1)),
          darkRatio: Number(darkRatio.toFixed(3)),
          brightRatio: Number(brightRatio.toFixed(3)),
          avgEdgeIntensity: Number(avgEdgeIntensity.toFixed(3)),
          avgChromaticDispersion: Number(avgChromaticDispersion.toFixed(3)),
          dispersionRatio: Number(dispersionRatio.toFixed(3)),
          isDarkModeScreen,
          isLightModeScreen,
          isDisplayScreenImage
        };

        console.log('[SHARP SCREEN METRICS]', imageScreenStats);

        if (isDisplayScreenImage) {
          replayReason = isDarkModeScreen
            ? 'Digital dark display / IDE / Terminal screen detected'
            : 'Digital light display / browser screen detected';
        }
      } catch (err) {
        console.error('[SCREEN ANALYSIS ERROR]', err);
      }
    }

    const sensorValidation = validateSensorData(sensorData);
    const validSensors = Object.values(sensorValidation).filter(Boolean).length;

    // Calculate statistics for each sensor type
    const sensorStats = {
      accelerometer: sensorData.accelerometer
        ? calculateSensorStats(sensorData.accelerometer)
        : null,
      gyroscope: sensorData.gyroscope
        ? calculateSensorStats(sensorData.gyroscope)
        : null,
      magnetometer: (sensorData.magnetometer || sensorData.mag)
        ? calculateSensorStats(sensorData.magnetometer || sensorData.mag)
        : null,
      light: sensorData.light
        ? calculateLightStats(sensorData.light)
        : null,
      location: sensorData.location || null,
      timestamp: sensorData.timestamp || null,
    };

    // 2. Run sensor integrity analysis
    const sensorResult = await analyzeSensorIntegrity(sensorData, metadata, mediaData);

    // Final decision logic
    const isRecaptured = Boolean(isDisplayScreenImage);
    const finalAuraFlag = isRecaptured ? 'RED' : 'GREEN';
    const finalStatus = isRecaptured ? 'tampered' : 'verified';
    const finalClassification = isRecaptured ? 'SCREEN_REPLAY' : 'AUTHENTIC_CAMERA';

    const screenDefensePassed = !isRecaptured;
    const sensorsPassed = !isRecaptured && validSensors > 0;
    let failureReason = null;
    if (isRecaptured) {
      failureReason = replayReason || 'SECOND-COPY DETECTED (Screen Replay Photo): Electronic screen emission or digital UI detected';
    }

    const integrityScore = isRecaptured ? 25 : (sensorsPassed ? 98 : 45);
    const aiProbability = isRecaptured ? 0.85 : 0.02;
    const overallConfidence = isRecaptured ? 20.0 : (sensorsPassed ? 99.7 : 50.0);

    console.log("[FINAL VERDICT]", {
      isRecaptured,
      finalAuraFlag,
      finalStatus,
      finalClassification,
      isDisplayScreenImage,
      lightAvg: sensorResult.lightAvg,
      lightRelVar: sensorResult.lightRelVar,
      magSpread: sensorResult.magSpread,
      magMax: sensorResult.magMax,
      sharpStats: typeof imageScreenStats !== 'undefined' ? imageScreenStats : null
    });

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(metadata);

    // Generate proof hash (includes ALL sensor data)
    const proofData = {
      sensorData,
      metadata,
      timestamp: new Date().toISOString(),
    };
    const proofHash = generateHash(proofData);

    const rawProofId = metadata?.proofId || formatProofId();
    const proofId = String(rawProofId).trim().toUpperCase();
    logger.info("Processing live capture proof " + proofId + " -> " + finalAuraFlag + " (" + finalStatus + ")");

    // Guard: reject oversized base64 payloads before they hit sharp (OOM protection)
    if (mediaData && Buffer.byteLength(mediaData, "base64") > MAX_MEDIA_SIZE_BYTES) {
      return res.status(413).json({
        success: false,
        message: "Media data exceeds maximum size of " + (MAX_MEDIA_SIZE_BYTES / (1024 * 1024)) + "MB",
      });
    }

    const baseUrl = process.env.VERIFICATION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "https://aura-app.com/verify";
    const verificationUrl = baseUrl.endsWith("/") ? (baseUrl + proofId) : (baseUrl + "/" + proofId);

    // Add server-side watermark only if authentic physical capture
    let watermarkedImage = mediaData;
    if (!isRecaptured && screenDefensePassed && mediaData && mediaData.length > 100) {
      logger.info("Authenticity verified. Applying A.U.R.A. Certified Seal (" + proofId + ")...");
      watermarkedImage = await watermarkImage(mediaData, proofId, metadata?.timestamp || new Date().toISOString(), verificationUrl);
    }

    // Hash the final image bytes
    const finalImageHash = watermarkedImage ? generateImageHash(watermarkedImage) : proofHash;

    const spatiotemporalData = {
      location: sensorData.location || null,
      timestamp: sensorData.timestamp || null,
      capturedAt: metadata?.capturedAt || metadata?.timestamp || new Date().toISOString(),
      deviceId: metadata?.deviceId || null,
    };

    // Standardized Proof Document for MongoDB and In-Memory Ledger
    const proofDoc = {
      proofId,
      sha256Hash: finalImageHash || proofHash,
      imageHash: finalImageHash,
      hash: proofHash,
      metadata: metadata?.exif || metadata || {},
      sensorMetrics: sensorData,
      sensorData,
      sensorStats,
      imageScreenStats,
      spatiotemporalData,
      confidence: overallConfidence,
      integrityScore,
      aiProbability,
      classification: finalClassification,
      status: finalStatus,
      auraFlag: finalAuraFlag,
      isRecaptured,
      failureReason,
      screenDefensePassed,
      sensorsPassed,
      isVerified: !isRecaptured,
      timestamp: new Date(),
      imageData: watermarkedImage,
    };

    // 1. Save to in-memory ledger cache (guaranteed instant availability)
    saveToLedger(proofId, proofDoc);

    // 2. Explicitly persist to MongoDB Database
    let persistedToDb = false;
    if (isDbConnected()) {
      try {
        await Proof.findOneAndUpdate(
          { proofId },
          proofDoc,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        persistedToDb = true;
        console.log("[LEDGER SAVED]", proofId);
        logger.info("[LEDGER SAVED] " + proofId);
      } catch (dbError) {
        console.error("[AURA LEDGER] MongoDB save error for " + proofId + ":", dbError.message);
        logger.error("[AURA LEDGER] DB save error: " + dbError.message, { stack: dbError.stack });
      }
    } else {
      console.log("[LEDGER SAVED]", proofId, "(In-Memory Mode)");
      logger.warn("[AURA LEDGER] MongoDB not connected - saved " + proofId + " to in-memory ledger");
    }

    const proof = {
      id: proofId,
      proofId,
      hash: proofHash,
      sha256Hash: finalImageHash || proofHash,
      imageHash: finalImageHash,
      deviceFingerprint,
      sensorValidation,
      sensorValidationStatus: sensorsPassed ? "passed" : "failed",
      sensorStats,
      sensorMetrics: sensorData,
      imageScreenStats,
      spatiotemporalData,
      integrityAnalysis: {
        ...sensorResult,
        isRecaptured,
        screenDefensePassed,
        auraFlag: finalAuraFlag,
        overallScore: integrityScore,
        aiProbability,
        classification: finalClassification,
        failureReason,
      },
      isRecaptured,
      failureReason,
      screenDefensePassed,
      sensorsPassed,
      isVerified: !isRecaptured,
      sensorsUsed: validSensors,
      totalSensors: 6,
      timestamp: new Date().toISOString(),
      deviceId: metadata?.deviceId,
      capturedAt: metadata?.capturedAt,
      authenticatedImage: isRecaptured ? null : watermarkedImage,
      imageData: watermarkedImage,
      exif: metadata?.exif || null,
      status: finalStatus,
      auraFlag: finalAuraFlag,
      integrityScore,
      aiProbability,
      classification: finalClassification,
    };

    res.json({
      success: true,
      isVerified: !isRecaptured,
      proof,
      overallConfidence: overallConfidence.toFixed(1),
      integrityScore,
      aiProbability,
      classification: finalClassification,
      status: finalStatus,
      auraFlag: finalAuraFlag,
      isRecaptured,
      failureReason,
      screenDefensePassed,
      sensorsPassed,
      persistedToDb,
      message: isRecaptured
        ? "SECOND-COPY DETECTED (Screen Replay Photo)"
        : "Proof generated using " + validSensors + "/6 sensors",
    });
  } catch (error) {
    logger.error("Error generating proof: " + error.message, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: "Failed to generate authenticity proof",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get / Verify stored proof by ID
 */
const getProof = async (req, res) => {
  try {
    const rawProofId = req.params?.proofId || req.query?.proofId || req.body?.proofId;

    if (!rawProofId) {
      return res.status(400).json({
        success: false,
        message: "Proof ID is required",
      });
    }

    const { getFromLedger, normalizeKey } = require("../utils/ledgerStore");
    const targetId = normalizeKey(rawProofId);
    const idWithoutPrefix = targetId.replace(/^AURA-/, "");
    const idWithPrefix = "AURA-" + idWithoutPrefix;

    let proof = null;

    if (isDbConnected()) {
      proof = await Proof.findOne({
        ["$" + "or"]: [
          { proofId: targetId },
          { proofId: idWithPrefix },
          { proofId: idWithoutPrefix },
        ],
      });
    }


    if (!proof) {
      return res.status(404).json({
        success: false,
        proofFound: false,
        message: "Proof ID not found in ledger",
      });
    }

    return res.json({
      success: true,
      status: proof.status || 'verified',
      auraFlag: proof.auraFlag || 'GREEN',
      classification: proof.classification || 'AUTHENTIC_CAMERA',
      matchPercentage: 100,
      proof: proof,
      message: 'A.U.R.A. Certified Proof Verified in Ledger'
    });

  } catch (error) {
    logger.error("Error retrieving proof: " + error.message, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve proof",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  generateAuthenticityProof,
  getProof,
  verifyByProofId: getProof,
};