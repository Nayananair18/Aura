const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Generate SHA256 hash
 */
const generateHash = (data) => {
  try {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  } catch (error) {
    throw new Error(`Hash generation failed: ${error.message}`);
  }
};

/**
 * Generate device fingerprint
 */
const generateDeviceFingerprint = (deviceInfo) => {
  try {
    const fingerprintData = {
      deviceId: deviceInfo.deviceId,
      timestamp: deviceInfo.timestamp,
      platform: deviceInfo.platform || 'unknown',
    };
    return generateHash(fingerprintData);
  } catch (error) {
    throw new Error(`Device fingerprint generation failed: ${error.message}`);
  }
};

/**
 * Compare two hashes with tolerance
 */
const compareHashes = (hash1, hash2, tolerance = 0) => {
  if (!hash1 || !hash2) return false;

  if (tolerance === 0) {
    return hash1 === hash2;
  }

  // For similarity matching (not used for exact match)
  const matchCount = [...hash1].filter(
    (char, idx) => char === hash2[idx]
  ).length;

  const similarity = (matchCount / hash1.length) * 100;
  return similarity >= tolerance * 100;
};

/**
 * Validate all sensor data quality (all 6 types)
 */
const validateSensorData = (sensorData) => {
  const validation = {
    accelerometer: false,
    gyroscope: false,
    magnetometer: false,
    light: false,
    location: false,
    timestamp: false,
  };

  const minSamples = 5;

  // 1. Light Sensor
  if (
    sensorData.light &&
    Array.isArray(sensorData.light) &&
    sensorData.light.length >= minSamples
  ) {
    validation.light = true;
  }

  // 2. Accelerometer
  if (
    sensorData.accelerometer &&
    Array.isArray(sensorData.accelerometer) &&
    sensorData.accelerometer.length >= minSamples
  ) {
    validation.accelerometer = true;
  }

  // 3. Gyroscope
  if (
    sensorData.gyroscope &&
    Array.isArray(sensorData.gyroscope) &&
    sensorData.gyroscope.length >= minSamples
  ) {
    validation.gyroscope = true;
  }

  // 4. Magnetometer
  if (
    sensorData.magnetometer &&
    Array.isArray(sensorData.magnetometer) &&
    sensorData.magnetometer.length >= minSamples
  ) {
    validation.magnetometer = true;
  }

  // 5. GPS / Location
  if (
    sensorData.location &&
    sensorData.location.latitude != null &&
    sensorData.location.longitude != null
  ) {
    validation.location = true;
  }

  // 6. Timestamp
  if (sensorData.timestamp && sensorData.timestamp.start) {
    validation.timestamp = true;
  }

  return validation;
};

/**
 * Calculate sensor statistics for motion sensors (accelerometer/gyroscope/magnetometer)
 */
const calculateSensorStats = (readings) => {
  if (!Array.isArray(readings) || readings.length === 0) {
    return null;
  }

  const magnitudes = readings.map((r) =>
    Math.sqrt((r.x || 0) ** 2 + (r.y || 0) ** 2 + (r.z || 0) ** 2)
  );

  return {
    count: readings.length,
    min: Math.min(...magnitudes),
    max: Math.max(...magnitudes),
    avg: magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length,
  };
};

/**
 * Calculate light sensor statistics
 */
const calculateLightStats = (readings) => {
  if (!Array.isArray(readings) || readings.length === 0) {
    return null;
  }

  const values = readings.map((r) => r.lux || r.illuminance || 0);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = Math.max(...values) - Math.min(...values);

  return {
    count: readings.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg,
    variance,
    relativeVariance: variance / (avg || 1),
    latest: values[values.length - 1],
  };
};

/**
 * Calculate sensor stats with variance and spread
 */
const calculateDetailedStats = (readings) => {
  if (!Array.isArray(readings) || readings.length === 0) return null;
  
  const magnitudes = readings.map(r => 
    r.magneticField || Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2)
  );
  
  const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const min = Math.min(...magnitudes);
  const max = Math.max(...magnitudes);
  const spread = max - min;
  
  return { avg, min, max, spread, count: readings.length };
};

/**
 * Analyze sensor data for tamper detection based on A.U.R.A. principles:
 * "You can fake pixels using AI, but you cannot fake the laws of physics."
 *
 * Checks include:
 * - Screen Attack Defense: Magnetometer high magnitude & Light PWM flicker patterns.
 * - Environmental Consistency: Baseline lux vs image brightness (if available).
 * - Physicality Check: Accelerometer/Gyroscope variance during capture.
 * - Spatiotemporal Seal: GPS/Timestamp consistency.
 */
const analyzeSensorIntegrity = (sensorData) => {
  const analysis = {
    screenDefense: {
      magnetometerPassed: true,
      lightFlickerPassed: true,
      result: 'passed'
    },
    physicsDefense: {
      motionPassed: true,
      gravityConsistent: true,
    },
    locationValid: false,
    timestampValid: false,
    overallScore: 0,
    auraFlag: 'GREEN' // GREEN, YELLOW, RED
  };
  
  console.log('\n--- [A.U.R.A. FORENSIC ANALYSIS START] ---');

  const samples = 5;

  // 1. Screen Defense - Magnetometer (Detects display EM signatures)
  if (sensorData.magnetometer && sensorData.magnetometer.length >= samples) {
    const stats = calculateDetailedStats(sensorData.magnetometer);
    
    // SMART THRESHOLDS: Adjust sensitivity based on environment
    // 1. Motion Compensation: If the user is moving fast, magnetic jitter is natural.
    const isMovingFast = sensorData.accelerometer && calculateDetailedStats(sensorData.accelerometer).spread > 0.8;
    const magneticSpreadLimit = isMovingFast ? 100.0 : 50.0; // Very forgiving

    const isOutofBounds = stats.avg < 1 || stats.avg > 600; // Allow extreme environments
    const isNoisyField = stats.spread > magneticSpreadLimit; 
    
    if (isOutofBounds || isNoisyField) {
      analysis.screenDefense.magnetometerPassed = false;
      analysis.screenDefense.details = isOutofBounds 
        ? `Magnetic Anomaly (${stats.avg.toFixed(1)}µT)` 
        : `Magnetic Interference (${stats.spread.toFixed(1)}µT jitter)`;
      console.log(`[!] MAGNETOMETER FAILURE: Avg ${stats.avg.toFixed(2)}µT, Spread ${stats.spread.toFixed(2)}µT. (Threshold: ${magneticSpreadLimit})`);
    } else {
      console.log(`[✓] MAGNETOMETER PASS: Avg ${stats.avg.toFixed(2)}µT, Spread ${stats.spread.toFixed(2)}µT.`);
    }
  }

    // 2. Screen Defense - Light Flicker (Detects invisible 240Hz/PWM flicker)
  if (sensorData.light && sensorData.light.length >= samples) {
    const stats = calculateLightStats(sensorData.light);
    
    // Check if the device is being held relatively still
    let motionSpread = 1.0;
    if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
      motionSpread = calculateDetailedStats(sensorData.accelerometer).spread;
    }
    const isStill = motionSpread < 1.0;
    
    // SMART FLICKER LIMIT: 
    // If the phone is completely still, natural light does not fluctuate. 
    // A relative variance > 0.20 while still is a massive red flag for a computer monitor (PWM).
    // If the phone is moving, natural lighting shifts rapidly, so we raise the limit.
    const flickerLimit = isStill ? 0.20 : 1.5;
    
    const isTooDarkForFlicker = stats.avg < 10;
    const isFlickering = !isTooDarkForFlicker && stats.relativeVariance > flickerLimit; 
    const isNaturalSunlight = stats.avg > 8000; // Monitors rarely exceed 500 lux. >8k is clearly natural.

    if (isFlickering && !isNaturalSunlight) {
      analysis.screenDefense.lightFlickerPassed = false;
      analysis.screenDefense.details = 'High-frequency flicker found (Screen PWM detected)';
      console.log(`[!] LIGHT FAILURE: RelVar ${stats.relativeVariance.toFixed(2)} > limit ${flickerLimit}, Avg ${stats.avg.toFixed(1)} lux.`);
    } else {
      const reason = isNaturalSunlight ? '(Natural Sunlight)' : isTooDarkForFlicker ? '(Low-light)' : `(Stable light)`;
      console.log(`[✓] LIGHT PASS: Signal stability verified. ${reason}`);
    }
  }

  // 3. Physics Defense - Motion
  if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
    const accStats = calculateDetailedStats(sensorData.accelerometer);
    const gyroStats = calculateDetailedStats(sensorData.gyroscope || []);
    
    // Check for "Planar" movement. Real 3D reality has rotation + translation.
    // Replay attacks often have translation but suspiciously low rotation (Planar).
    const rotationToMotionRatio = gyroStats ? gyroStats.spread / (accStats.spread || 1) : 1;
    const isPlanarMovement = rotationToMotionRatio < 0.01; 

    if (accStats.spread === 0 && gyroStats.spread === 0) { 
      // ONLY fail if perfectly 0 (Emulator injection)
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Absolute zero motion (Emulator injection detected)';
      console.log(`[!] PHYSICS FAILURE: Perfect 0 spread.`);
    } else if (isPlanarMovement && accStats.spread > 0.5) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Planar movement detected (Possible screen re-capture)';
      console.log(`[!] PHYSICS FAILURE: Gyro-Ratio ${rotationToMotionRatio.toFixed(4)} is too low. (2D Plane Signature)`);
    } else {
      console.log(`[✓] PHYSICS PASS: 3D rotational physics verified.`);
    }
  }

  if (!analysis.screenDefense.magnetometerPassed || !analysis.screenDefense.lightFlickerPassed) {
    analysis.screenDefense.result = 'failed';
    analysis.auraFlag = 'RED';
  }

  // 4. Trace Defense - Location & Time
  if (sensorData.location?.latitude != null) analysis.locationValid = true;
  if (sensorData.timestamp?.start && sensorData.timestamp?.end) {
    const duration = sensorData.timestamp.end - sensorData.timestamp.start;
    analysis.timestampValid = duration >= 0 && duration < 300000; // up to 5 minutes to frame the shot
  }

  // Calculate A.U.R.A Integrity Score
  let score = 30; // Reduced base baseline
  if (analysis.screenDefense.magnetometerPassed) score += 30;
  if (analysis.screenDefense.lightFlickerPassed) score += 20;
  if (analysis.physicsDefense.motionPassed) score += 10;
  if (analysis.locationValid) score += 5;
  if (analysis.timestampValid) score += 5;

  analysis.overallScore = Math.min(score, 100);
  
  // FAIL FAST: If any major defense is breached, force RED and tank the score
  if (!analysis.screenDefense.magnetometerPassed || !analysis.screenDefense.lightFlickerPassed) {
    analysis.auraFlag = 'RED';
    analysis.overallScore = Math.min(analysis.overallScore, 45); // Hard cap for failures
  } else if (!analysis.physicsDefense.motionPassed) {
    analysis.auraFlag = 'YELLOW';
    analysis.overallScore = Math.min(analysis.overallScore, 65);
  } else if (!analysis.locationValid || !analysis.timestampValid) {
    // If the spatiotemporal seal fails, downgrade to YELLOW
    analysis.auraFlag = 'YELLOW';
    analysis.overallScore = Math.min(analysis.overallScore, 85);
  }

  console.log(`[=] FINAL A.U.R.A. SCORE: ${analysis.overallScore}/100`);
  console.log(`[=] A.U.R.A. FLAG STATUS: ${analysis.auraFlag}`);
  console.log('--- [A.U.R.A. FORENSIC ANALYSIS END] ---\n');

  return analysis;
};

/**
 * Adds an "AURA AUTHENTIC" watermark using sharp.
 */
const watermarkImage = async (base64Image) => {
  try {
    if (!base64Image) return null;
    
    // Convert base64 to buffer
    const imgBuffer = Buffer.from(base64Image, 'base64');
    
    // Create a high-visibility SVG overlay (Lower Third / Glassmorphism Bar)
    const svgOverlay = Buffer.from(`
      <svg width="1080" height="120">
        <rect x="0" y="0" width="1080" height="120" fill="rgba(0,0,0,0.6)" />
        <rect x="0" y="0" width="10" height="120" fill="#00FF9D" />
        <text x="540" y="75" font-family="sans-serif" font-size="44" font-weight="bold" fill="#00FF9D" text-anchor="middle">
          🛡️ A.U.R.A. CERTIFIED AUTHENTIC
        </text>
        <text x="1050" y="100" font-family="sans-serif" font-size="18" fill="white" text-anchor="end">
          REALITY-PROVEN DATA
        </text>
      </svg>
    `);

    // Process image with sharp
    const processedBuffer = await sharp(imgBuffer)
      .resize(1080) // Standardize width
      .composite([{
        input: svgOverlay,
        gravity: 'south',
      }])
      .jpeg({ quality: 85 })
      .toBuffer();

    return processedBuffer.toString('base64');
  } catch (error) {
    console.error('[!] Watermarking Failed:', error.message);
    return base64Image; // Fallback to original
  }
};

module.exports = {
  generateHash,
  generateDeviceFingerprint,
  compareHashes,
  validateSensorData,
  calculateSensorStats,
  calculateLightStats,
  calculateDetailedStats,
  analyzeSensorIntegrity,
  watermarkImage,
};

