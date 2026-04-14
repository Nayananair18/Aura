const crypto = require('crypto');

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

  return {
    count: readings.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    latest: values[values.length - 1],
  };
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

  const samples = 5;

  // 1. Screen Defense - Magnetometer (Detects display EM signatures)
  if (sensorData.magnetometer && sensorData.magnetometer.length >= samples) {
    const stats = calculateSensorStats(sensorData.magnetometer);
    // Typical screen emission > 80µT. Normal EARTH field is ~25-65µT.
    if (stats.avg > 85) {
      analysis.screenDefense.magnetometerPassed = false;
      analysis.screenDefense.details = 'High magnetic EMI detected (possible screen replay)';
    }
  }

  // 2. Screen Defense - Light Flicker (Detects invisible 240Hz/PWM flicker)
  if (sensorData.light && sensorData.light.length >= samples) {
    const stats = calculateLightStats(sensorData.light);
    const variance = stats.max - stats.min;
    const relativeVariance = variance / (stats.avg || 1);
    
    // Screens have very precise high-frequency flicker. 
    // High relative variance in a "static" capture is a red flag.
    if (relativeVariance > 0.4 && stats.avg > 10) {
      analysis.screenDefense.lightFlickerPassed = false;
    }
  }

  // 3. Physics Defense - Motion
  if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
    const stats = calculateSensorStats(sensorData.accelerometer);
    const variance = stats.max - stats.min;
    // Replay attacks (pointing at a screen) are often too stable or have unnatural robotic movement.
    // Real handheld capture should have some micro-tremor (0.02 - 0.5 G variance).
    if (variance < 0.01) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Unnatural stability detected (possible tripod/replay)';
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
    analysis.timestampValid = duration > 400 && duration < 60000;
  }

  // Calculate A.U.R.A Integrity Score
  let score = 40; // Base baseline
  if (analysis.screenDefense.result === 'passed') score += 30;
  if (analysis.physicsDefense.motionPassed) score += 15;
  if (analysis.locationValid) score += 10;
  if (analysis.timestampValid) score += 5;

  analysis.overallScore = Math.min(score, 100);
  if (analysis.overallScore < 70 && analysis.auraFlag === 'GREEN') analysis.auraFlag = 'YELLOW';

  return analysis;
};

module.exports = {
  generateHash,
  generateDeviceFingerprint,
  compareHashes,
  validateSensorData,
  calculateSensorStats,
  calculateLightStats,
  analyzeSensorIntegrity,
};
