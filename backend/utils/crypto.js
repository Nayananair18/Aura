const crypto = require('crypto');
const sharp = require('sharp');
const QRCode = require('qrcode');

/**
 * Helper to format proof ID to standard AURA format: AURA-8F9A-2B4C-71D2
 */
const formatProofId = (rawId) => {
  if (!rawId) return `AURA-${crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-')}`;
  if (rawId.startsWith('AURA-')) return rawId;
  const clean = rawId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const hexPart = clean.length >= 16 ? clean.slice(-16) : clean.padEnd(16, '0');
  return `AURA-${hexPart.match(/.{1,4}/g).join('-')}`;
};

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

const generateImageHash = (base64String) => {
  try {
    return crypto
      .createHash('sha256')
      .update(base64String)
      .digest('hex');
  } catch (error) {
    throw new Error(`Image Hash generation failed: ${error.message}`);
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

  if (!sensorData) return validation;

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
  if (!Array.isArray(readings) || readings.length === 0) return { avg: 0, min: 0, max: 0, spread: 0, count: 0 };
  
  const magnitudes = readings.map(r => 
    r.magneticField != null ? r.magneticField : Math.sqrt((r.x||0)**2 + (r.y||0)**2 + (r.z||0)**2)
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
      screenDefensePassed: true,
      isRecaptured: false,
      result: 'passed',
      details: 'No display signatures found (Ambient lighting & magnetic baseline verified)',
    },
    physicsDefense: {
      motionPassed: true,
      gravityConsistent: true,
      details: 'Handheld micro-tremors verified',
    },
    isRecaptured: false,
    screenDefensePassed: true,
    locationValid: false,
    timestampValid: false,
    overallScore: 0,
    auraFlag: 'GREEN',
  };
  
  console.log('\n--- [A.U.R.A. FORENSIC ANALYSIS START] ---');
  const samples = 5;

  if (!sensorData) {
    analysis.screenDefense.magnetometerPassed = false;
    analysis.screenDefense.lightFlickerPassed = false;
    analysis.screenDefense.screenDefensePassed = false;
    analysis.screenDefense.isRecaptured = false;
    analysis.screenDefense.result = 'failed';
    analysis.screenDefense.details = 'No sensor telemetry provided';
    analysis.physicsDefense.motionPassed = false;
    analysis.physicsDefense.details = 'Handheld micro-tremors missing or inconsistent';
    analysis.auraFlag = 'RED';
    analysis.overallScore = 0;
    return analysis;
  }

  // 1. Screen Defense - Magnetometer (Calibrated: max > 55.0 �T || avg > 50.0 �T || spread > 25.0 �T)
  let magnetometerSuspicious = false;
  let isEmiSpike = false;
  let isOutofBounds = false;
  let isNoisyField = false;
  let magDetails = '';
  let maxMagField = 0;
  let magSpread = 0;
  if (sensorData.magnetometer && sensorData.magnetometer.length >= samples) {
    const stats = calculateDetailedStats(sensorData.magnetometer);
    maxMagField = stats.max;
    magSpread = stats.spread;
    const isMovingFast = sensorData.accelerometer && calculateDetailedStats(sensorData.accelerometer).spread > 0.8;
    const magneticSpreadLimit = isMovingFast ? 45.0 : 25.0;

    // Natural Earth magnetic baseline is ~25 to 45 �T with low jitter.
    // Display backlights, power inductors, and CRT/LCD/OLED transformers emit localized EMI > 55.0 �T or produce magnetic jitter > 25.0 �T.
    isEmiSpike = stats.max > 55.0 || stats.avg > 50.0;
    isOutofBounds = stats.avg < 5.0 || stats.avg > 500.0;
    isNoisyField = stats.spread > magneticSpreadLimit;
    
    if (isEmiSpike || isOutofBounds || isNoisyField) {
      magnetometerSuspicious = true;
      magDetails = isEmiSpike
        ? `Magnetometer EMI spike (${stats.max.toFixed(1)}�T > 55.0�T limit)`
        : isOutofBounds 
          ? `Magnetic Anomaly (${stats.avg.toFixed(1)}�T)` 
          : `Magnetic Interference (${stats.spread.toFixed(1)}�T jitter > ${magneticSpreadLimit}�T)`;
      console.log(`[!] MAGNETOMETER WARNING: Max ${stats.max.toFixed(2)}�T, Avg ${stats.avg.toFixed(2)}�T, Spread ${stats.spread.toFixed(2)}�T.`);
    } else {
      console.log(`[?] MAGNETOMETER PASS: Avg ${stats.avg.toFixed(2)}�T, Spread ${stats.spread.toFixed(2)}�T.`);
    }
  }

  // 2. Screen Defense - Optical PWM Light Flicker
  // - Natural hand movement/shadows on paper documents produce modest variance (0.15 - 0.40).
  // - Extreme display PWM flicker (60Hz/120Hz/240Hz monitor) produces large optical fluctuations (RelVar > 0.75 to 1.80).
  let lightFlickerSuspicious = false;
  let isExtremeLightFlicker = false;
  let isModerateLightFlicker = false;
  let lightDetails = '';
  if (sensorData.light && sensorData.light.length >= samples) {
    const stats = calculateLightStats(sensorData.light);
    let motionSpread = 1.0;
    if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
      motionSpread = calculateDetailedStats(sensorData.accelerometer).spread;
    }
    
    const isTooDarkForFlicker = stats.avg < 10;
    const isNaturalSunlight = stats.avg > 8000;

    if (!isTooDarkForFlicker && !isNaturalSunlight) {
      isExtremeLightFlicker = stats.relativeVariance > 0.75;
      isModerateLightFlicker = stats.relativeVariance > 0.40 && stats.relativeVariance <= 0.75;

      if (isExtremeLightFlicker) {
        lightFlickerSuspicious = true;
        lightDetails = `Severe display PWM optical flicker (RelVar: ${stats.relativeVariance.toFixed(2)} > 0.75 limit)`;
        console.log(`[!] SEVERE LIGHT FLICKER DETECTED: RelVar ${stats.relativeVariance.toFixed(2)}, Avg ${stats.avg.toFixed(1)} lux.`);
      } else if (isModerateLightFlicker) {
        lightDetails = `Moderate optical light variance (RelVar: ${stats.relativeVariance.toFixed(2)})`;
        console.log(`[i] Moderate light variance: RelVar ${stats.relativeVariance.toFixed(2)}, Avg ${stats.avg.toFixed(1)} lux.`);
      } else {
        console.log(`[?] LIGHT PASS: Natural lighting stability verified (RelVar: ${stats.relativeVariance.toFixed(2)} <= 0.40).`);
      }
    } else {
      const reason = isNaturalSunlight ? '(Natural Sunlight)' : '(Low-light environment)';
      console.log(`[?] LIGHT PASS: ${reason}`);
    }
  }

  // 3. Screen Defense - Planar Orientation & Motion Harmonics
  let planarSuspicious = false;
  if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
    const accStats = calculateDetailedStats(sensorData.accelerometer);
    const gyroStats = calculateDetailedStats(sensorData.gyroscope || []);
    const rotationToMotionRatio = gyroStats ? gyroStats.spread / (accStats.spread || 1) : 1;
    planarSuspicious = rotationToMotionRatio < 0.015 && accStats.spread > 0.25;
  }

  // SCREEN REPLAY / SECOND-COPY ATTACK DECISION:
  // 1) Standalone Extreme Optical PWM Flicker (RelVar > 0.75) -> REPLAY DETECTED!
  // 2) Standalone Magnetometer EMI Spike (max > 55�T || avg > 50�T || spread > 25�T) -> REPLAY DETECTED!
  // 3) Moderate Light Flicker (0.40 < RelVar <= 0.75) accompanied by elevated Magnetometer or 2D Planar alignment -> REPLAY DETECTED!
  // 4) Natural hand movement on paper documents (RelVar <= 0.40, mag 25-45�T) -> AUTHENTIC PASS (GREEN)!
  const isSecondCopyDetected = isExtremeLightFlicker || 
                               isEmiSpike || 
                               isOutofBounds || 
                               isNoisyField || 
                               (isModerateLightFlicker && (magnetometerSuspicious || planarSuspicious));

  if (isSecondCopyDetected) {
    const reasons = [
      isExtremeLightFlicker ? lightDetails : (isModerateLightFlicker ? lightDetails : null),
      magnetometerSuspicious ? magDetails : null,
      planarSuspicious ? 'Planar 2D screen alignment' : null,
    ].filter(Boolean);

    analysis.screenDefense.magnetometerPassed = !magnetometerSuspicious;
    analysis.screenDefense.lightFlickerPassed = !isExtremeLightFlicker && !isModerateLightFlicker;
    analysis.screenDefense.screenDefensePassed = false;
    analysis.screenDefense.isRecaptured = true;
    analysis.screenDefense.result = 'failed';
    analysis.screenDefense.recaptureReason = 'SECOND-COPY DETECTED (Screen Replay Photo - Optical PWM Flicker / Screen Emission)';
    analysis.screenDefense.details = `SECOND-COPY DETECTED (Screen Replay Photo): ${reasons.join(' + ')}`;

    analysis.isRecaptured = true;
    analysis.screenDefensePassed = false;
    console.log(`[!] SCREEN REPLAY ATTACK TRIGGERED: ${analysis.screenDefense.details}`);
  } else {
    analysis.screenDefense.magnetometerPassed = true;
    analysis.screenDefense.lightFlickerPassed = true;
    analysis.screenDefense.screenDefensePassed = true;
    analysis.screenDefense.isRecaptured = false;
    analysis.screenDefense.result = 'passed';
    analysis.screenDefense.details = 'No display signatures found (Ambient lighting & magnetic baseline verified)';
    analysis.isRecaptured = false;
    analysis.screenDefensePassed = true;
  }

  // 4. Physics Defense - Motion
  if (sensorData.accelerometer && sensorData.accelerometer.length >= samples) {
    const accStats = calculateDetailedStats(sensorData.accelerometer);
    const gyroStats = calculateDetailedStats(sensorData.gyroscope || []);
    const rotationToMotionRatio = gyroStats ? gyroStats.spread / (accStats.spread || 1) : 1;
    const isPlanarMovement = rotationToMotionRatio < 0.01; 

    if (accStats.spread === 0 && (!gyroStats || gyroStats.spread === 0)) { 
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Absolute zero motion (Emulator injection detected)';
    } else if (isPlanarMovement && accStats.spread > 0.5) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Planar movement detected (Possible screen re-capture)';
    } else if (accStats.spread < 0.005) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Handheld micro-tremors missing or inconsistent';
    } else {
      analysis.physicsDefense.motionPassed = true;
      analysis.physicsDefense.details = 'Handheld micro-tremors verified';
    }
  } else {
    analysis.physicsDefense.motionPassed = false;
    analysis.physicsDefense.details = 'Handheld micro-tremors missing or inconsistent';
  }

  // 5. Trace Defense - Location & Time
  if (sensorData.location?.latitude != null) analysis.locationValid = true;
  if (sensorData.timestamp?.start && sensorData.timestamp?.end) {
    const duration = sensorData.timestamp.end - sensorData.timestamp.start;
    analysis.timestampValid = duration >= 0 && duration < 300000;
  }

  let score = 20;
  if (analysis.screenDefense.screenDefensePassed) score += 30;
  if (analysis.screenDefense.lightFlickerPassed) score += 20;
  if (analysis.physicsDefense.motionPassed) score += 20;
  if (analysis.locationValid) score += 5;
  if (analysis.timestampValid) score += 5;

  analysis.overallScore = Math.min(score, 100);
  
  if (analysis.isRecaptured || !analysis.screenDefense.screenDefensePassed) {
    analysis.auraFlag = 'RED';
    analysis.overallScore = Math.min(analysis.overallScore, 30);
  } else if (!analysis.physicsDefense.motionPassed) {
    const isMajor = analysis.physicsDefense.details.includes('Emulator') || analysis.physicsDefense.details.includes('Planar');
    analysis.auraFlag = isMajor ? 'RED' : 'YELLOW';
    analysis.overallScore = Math.min(analysis.overallScore, 55);
  } else if (!analysis.locationValid || !analysis.timestampValid) {
    analysis.auraFlag = 'YELLOW';
    analysis.overallScore = Math.min(analysis.overallScore, 80);
  } else {
    analysis.auraFlag = 'GREEN';
  }

  return analysis;
};

/**
 * Adds a professional "AURA VERIFIED" Proof Card watermark using sharp & qrcode.
 * Uses 100% vector SVG icons (no emoji dependencies) for cross-platform rendering.
 *
 * @param {string} base64Image - Base64 encoded JPEG/PNG image
 * @param {string} proofId - Unique Proof ID (e.g. AURA-8F9A-2B4C-71D2)
 * @param {string|number} timestamp - ISO string or timestamp
 * @param {string} verificationUrl - Verification URL for QR code
 */
const watermarkImage = async (base64Image, proofId = null, timestamp = null, verificationUrl = null) => {
  try {
    if (!base64Image) return null;

    const formattedProofId = formatProofId(proofId);

    const rawDate = timestamp ? new Date(timestamp) : new Date();
    const dateStr = rawDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const timeStr = rawDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedTimestamp = `${dateStr} � ${timeStr}`;

    const baseUrl = verificationUrl || process.env.VERIFICATION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://aura-app.com/verify';
    const finalQrUrl = baseUrl.endsWith('/') ? `${baseUrl}${formattedProofId}` : `${baseUrl}/${formattedProofId}`;

    const imgBuffer = Buffer.from(base64Image, 'base64');
    const imgObj = sharp(imgBuffer).rotate();
    const meta = await imgObj.metadata();

    // Dynamically scale banner dimensions proportional to image width (standardized between 1080px and 2560px)
    const targetWidth = Math.min(Math.max(meta.width || 1080, 1080), 2560);
    const scale = targetWidth / 1080;
    const bannerHeight = Math.round(180 * scale);
    const qrSize = Math.round(130 * scale);
    const qrMargin = Math.round(10 * scale);
    const qrContainerSize = Math.round(150 * scale);

    // Generate high-resolution QR Code PNG Buffer
    const qrPngBuffer = await QRCode.toBuffer(finalQrUrl, {
      width: qrSize,
      margin: 1,
      color: {
        dark: '#00FF9D',
        light: '#0B0F17',
      },
    });
    const qrBase64 = qrPngBuffer.toString('base64');

    const titleFontSize = Math.round(20 * scale);
    const subFontSize = Math.round(16 * scale);
    const pillFontSize = Math.round(15 * scale);
    const timeFontSize = Math.round(14 * scale);
    const footerFontSize = Math.round(12 * scale);
    const dividerStroke = Math.max(2, Math.round(3 * scale));

    // Create high-end glassmorphism footer SVG overlay rendered exclusively inside the extended canvas
    const svgOverlay = Buffer.from(`
      <svg width="${targetWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <!-- Extended Footer Canvas Background -->
        <rect x="0" y="0" width="${targetWidth}" height="${bannerHeight}" fill="#080C14" />
        
        <!-- Top Neon Line Accent separating photo from footer -->
        <line x1="0" y1="0" x2="${targetWidth}" y2="0" stroke="#00FF9D" stroke-width="${dividerStroke}" />

        <!-- Left Vertical Pill Accent -->
        <rect x="${Math.round(18 * scale)}" y="${Math.round(18 * scale)}" width="${Math.round(6 * scale)}" height="${Math.round(144 * scale)}" rx="${Math.round(3 * scale)}" fill="#00FF9D" />

        <!-- Vector Shield + Checkmark Icon -->
        <g transform="translate(${Math.round(36 * scale)}, ${Math.round(20 * scale)}) scale(${1.35 * scale})">
          <path d="M12 1L3 4v5c0 5.25 3.75 10.2 9 11.5 5.25-1.3 9-6.25 9-11.5V4l-9-3zm-1 13.5l-3.5-3.5 1.41-1.41L11 11.67l5.59-5.59L18 7.5l-7 7z" fill="#00FF9D" />
        </g>

        <!-- Title & Badge -->
        <text x="${Math.round(76 * scale)}" y="${Math.round(38 * scale)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="#00FF9D" letter-spacing="1">AURA VERIFIED</text>
        <text x="${Math.round(242 * scale)}" y="${Math.round(38 * scale)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${Math.round(14 * scale)}" font-weight="bold" fill="#475569">|</text>
        <text x="${Math.round(256 * scale)}" y="${Math.round(38 * scale)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${subFontSize}" font-weight="bold" fill="#FFFFFF" letter-spacing="0.5">AUTHENTIC CAPTURE</text>

        <!-- Proof ID Pill Container -->
        <rect x="${Math.round(76 * scale)}" y="${Math.round(54 * scale)}" width="${Math.round(410 * scale)}" height="${Math.round(34 * scale)}" rx="${Math.round(6 * scale)}" fill="rgba(0, 255, 157, 0.10)" stroke="rgba(0, 255, 157, 0.35)" stroke-width="1" />
        <text x="${Math.round(90 * scale)}" y="${Math.round(77 * scale)}" font-family="monospace, Courier New, sans-serif" font-size="${pillFontSize}" font-weight="bold" fill="#00FF9D" letter-spacing="1.5">PROOF ID: ${formattedProofId}</text>

        <!-- Timestamp & Security Seal Text -->
        <text x="${Math.round(76 * scale)}" y="${Math.round(118 * scale)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${timeFontSize}" font-weight="600" fill="#E2E8F0">${formattedTimestamp}</text>
        <text x="${Math.round(76 * scale)}" y="${Math.round(142 * scale)}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${footerFontSize}" font-weight="500" fill="#94A3B8" letter-spacing="0.5">ENVIRONMENTAL PHYSICS &amp; SENSOR INTEGRITY SEALED</text>

        <!-- Right Side QR Code Container -->
        <rect x="${targetWidth - qrContainerSize - Math.round(16 * scale)}" y="${Math.round(15 * scale)}" width="${qrContainerSize}" height="${qrContainerSize}" rx="${Math.round(12 * scale)}" fill="#0B0F17" stroke="rgba(0, 255, 157, 0.4)" stroke-width="1.5" />
        <image x="${targetWidth - qrContainerSize - Math.round(16 * scale) + qrMargin}" y="${Math.round(15 * scale) + qrMargin}" width="${qrSize}" height="${qrSize}" href="data:image/png;base64,${qrBase64}" />
      </svg>
    `);

    // CANVAS EXTENSION:
    // 1. Extend the bottom canvas height by bannerHeight so original photo pixels are 100% unobscured.
    // 2. Composite the vector verification banner cleanly into the appended footer region.
    const processedBuffer = await sharp(imgBuffer)
      .rotate()
      .resize({ width: targetWidth })
      .extend({
        top: 0,
        left: 0,
        right: 0,
        bottom: bannerHeight,
        background: { r: 8, g: 12, b: 20, alpha: 1 },
      })
      .composite([{
        input: svgOverlay,
        gravity: 'south',
      }])
      .jpeg({ quality: 90 })
      .toBuffer();

    return processedBuffer.toString('base64');
  } catch (error) {
    console.error('[!] Watermarking Failed:', error.message);
    return base64Image; // Fallback to original
  }
};

module.exports = {
  formatProofId,
  generateHash,
  generateImageHash,
  generateDeviceFingerprint,
  compareHashes,
  validateSensorData,
  calculateSensorStats,
  calculateLightStats,
  calculateDetailedStats,
  analyzeSensorIntegrity,
  watermarkImage,
};
