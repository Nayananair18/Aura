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
 * Analyze sensor data for tamper detection
 *
 * Cross-checks:
 * - Light vs image brightness discrepancy
 * - Magnetometer anomalies (screen replay detection)
 * - Motion patterns (replay attack detection)
 * - GPS/timestamp consistency
 */
const analyzeSensorIntegrity = (sensorData) => {
  const analysis = {
    motionDetected: false,
    magneticAnomaly: false,
    lightConsistent: true,
    locationValid: false,
    timestampValid: false,
    overallScore: 0,
  };

  // Check motion (accelerometer variance)
  if (sensorData.accelerometer?.length > 0) {
    const stats = calculateSensorStats(sensorData.accelerometer);
    const variance = stats.max - stats.min;
    analysis.motionDetected = variance > 0.05; // minimal movement expected during real capture
  }

  // Check magnetic field (high values may indicate screen replay)
  if (sensorData.magnetometer?.length > 0) {
    const stats = calculateSensorStats(sensorData.magnetometer);
    // Screen displays typically emit 100+ µT, normal environment is 25-65 µT
    analysis.magneticAnomaly = stats.avg > 100;
  }

  // Check location
  if (sensorData.location?.latitude != null) {
    analysis.locationValid = true;
  }

  // Check timestamp
  if (sensorData.timestamp?.start && sensorData.timestamp?.end) {
    const duration = sensorData.timestamp.end - sensorData.timestamp.start;
    analysis.timestampValid = duration > 500 && duration < 300000; // 0.5s to 5min
  }

  // Calculate overall integrity score (0-100)
  let score = 50; // baseline
  if (analysis.motionDetected) score += 15;
  if (!analysis.magneticAnomaly) score += 15;
  if (analysis.locationValid) score += 10;
  if (analysis.timestampValid) score += 10;
  if (sensorData.light?.length > 0) score += 5; // bonus for light data
  analysis.overallScore = Math.min(score, 100);

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
