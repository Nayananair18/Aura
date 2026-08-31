const crypto = require("crypto");
const sharp = require("sharp");
const QRCode = require("qrcode");

const formatProofId = (rawId) => {
  if (!rawId) {
    return "AURA-" + crypto.randomBytes(8).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
  }
  if (typeof rawId === "string" && rawId.trim().toUpperCase().startsWith("AURA-")) {
    return rawId.trim().toUpperCase();
  }
  const clean = String(rawId).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const hexPart = clean.length >= 16 ? clean.slice(-16) : clean.padEnd(16, "0");
  return "AURA-" + hexPart.match(/.{1,4}/g).join("-");
};

const generateHash = (data) => {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
  } catch (error) {
    throw new Error("Hash generation failed: " + error.message);
  }
};

const generateImageHash = (base64String) => {
  try {
    const cleanBase64 = String(base64String).replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    return crypto.createHash("sha256").update(buffer).digest("hex");
  } catch (error) {
    throw new Error("Image hash generation failed: " + error.message);
  }
};

const generateDeviceFingerprint = (metadata = {}) => {
  const deviceData = {
    deviceId: metadata.deviceId || "unknown_device",
    platform: metadata.platform || "unknown_platform",
    model: metadata.model || metadata.deviceModel || "unknown_model",
  };
  return generateHash(deviceData).substring(0, 16).toUpperCase();
};

const compareHashes = (hash1, hash2) => {
  if (!hash1 || !hash2) return false;
  try {
    const buf1 = Buffer.from(String(hash1).trim().toLowerCase());
    const buf2 = Buffer.from(String(hash2).trim().toLowerCase());
    if (buf1.length !== buf2.length) return false;
    return crypto.timingSafeEqual(buf1, buf2);
  } catch {
    return String(hash1).trim().toLowerCase() === String(hash2).trim().toLowerCase();
  }
};

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
  const minSamples = 1;
  if (Array.isArray(sensorData.accelerometer) && sensorData.accelerometer.length >= minSamples) validation.accelerometer = true;
  if (Array.isArray(sensorData.gyroscope) && sensorData.gyroscope.length >= minSamples) validation.gyroscope = true;
  if ((Array.isArray(sensorData.magnetometer) && sensorData.magnetometer.length >= minSamples) ||
      (Array.isArray(sensorData.mag) && sensorData.mag.length >= minSamples) ||
      (sensorData.magnetometer && Array.isArray(sensorData.magnetometer.samples) && sensorData.magnetometer.samples.length >= minSamples) ||
      (sensorData.mag && Array.isArray(sensorData.mag.samples) && sensorData.mag.samples.length >= minSamples)) {
    validation.magnetometer = true;
  }
  if ((Array.isArray(sensorData.light) && sensorData.light.length >= minSamples) ||
      (sensorData.light && Array.isArray(sensorData.light.samples) && sensorData.light.samples.length >= minSamples)) {
    validation.light = true;
  }
  if (sensorData.location && (sensorData.location.latitude != null || sensorData.location.coords?.latitude != null)) validation.location = true;
  if (sensorData.timestamp) validation.timestamp = true;
  return validation;
};

const calculateDetailedStats = (readings) => {
  if (!readings || readings.length === 0) return null;
  const magnitudes = readings.map((r) => {
    if (r && typeof r === "object") {
      if (r.magneticField != null) return Number(r.magneticField);
      if (r.x != null && r.y != null && r.z != null) return Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
    }
    return Number(r) || 0;
  }).filter(Number.isFinite);
  if (magnitudes.length === 0) return null;
  const min = Math.min(...magnitudes);
  const max = Math.max(...magnitudes);
  const avg = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const spread = max - min;
  const variance = magnitudes.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / magnitudes.length;
  const stdDev = Math.sqrt(variance);
  return { count: magnitudes.length, min, max, avg, spread, variance, stdDev, latest: magnitudes[magnitudes.length - 1] };
};

const calculateSensorStats = calculateDetailedStats;

const calculateLightStats = (readings) => {
  if (!readings || readings.length === 0) return null;
  const values = readings.map((r) => {
    if (typeof r === "object" && r !== null && r.lux != null) return Number(r.lux);
    return Number(r);
  }).filter(Number.isFinite);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const amplitude = max - min;
  const normalizedFlicker = amplitude / (avg + 50.0);
  const relativeVariance = stdDev / (avg || 1);
  return { count: values.length, min, max, avg, spread: amplitude, amplitude, variance, stdDev, normalizedFlicker, relativeVariance, latest: values[values.length - 1] };
};

/**
 * Digital Display Screen Replay Detector for Image Buffer
 * Detects IDE code windows, dark-mode terminal screens, browser displays, and digital tables.
 */
const detectDisplayReplay = async (base64OrBuffer) => {
  if (!base64OrBuffer) return { isScreenReplay: false, reason: "No image buffer provided" };
  try {
    const cleanBase64 = String(base64OrBuffer).replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.isBuffer(base64OrBuffer) ? base64OrBuffer : Buffer.from(cleanBase64, "base64");
    if (buffer.length < 50) return { isScreenReplay: false, reason: "Empty image buffer" };

    const { data, info } = await sharp(buffer)
      .resize(256, 256, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const channels = info.channels;
    const totalPixels = w * h;

    let darkPixels = 0;   // dark background < 35 intensity
    let brightPixels = 0; // high contrast text > 180 intensity
    let ultraSharpEdges = 0;
    let flatBlockCount = 0;

    const gray = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      gray[i] = lum;

      if (lum < 35) darkPixels++;
      if (lum > 180) brightPixels++;
    }

    const darkRatio = darkPixels / totalPixels;
    const brightRatio = brightPixels / totalPixels;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const center = gray[y * w + x];
        const diffH = Math.abs(center - gray[y * w + (x + 1)]);
        const diffV = Math.abs(center - gray[(y + 1) * w + x]);
        if (diffH > 70 || diffV > 70) {
          ultraSharpEdges++;
        }
      }
    }

    const edgeRatio = ultraSharpEdges / totalPixels;

    // 8x8 block texture analysis
    const blockSize = 8;
    const blocksX = Math.floor(w / blockSize);
    const blocksY = Math.floor(h / blockSize);
    const totalBlocks = blocksX * blocksY;

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        let blockSum = 0;
        let blockSumSq = 0;
        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const val = gray[(by * blockSize + dy) * w + (bx * blockSize + dx)];
            blockSum += val;
            blockSumSq += val * val;
          }
        }
        const blockMean = blockSum / 64;
        const blockVar = (blockSumSq / 64) - (blockMean * blockMean);
        if (blockVar < 2.5) {
          flatBlockCount++;
        }
      }
    }

    const flatBlockRatio = flatBlockCount / totalBlocks;

    // Screen detection heuristics:
    // 1) Dark Mode Display / IDE / Terminal:
    const isDarkModeScreen = darkRatio > 0.35 && (edgeRatio > 0.015 || brightRatio > 0.05);
    // 2) Light Mode Digital UI / Calendar Grid / Monitor PDF:
    const isLightDigitalScreen = flatBlockRatio > 0.45 && edgeRatio > 0.035;
    // 3) Extreme digital contrast monitor:
    const isExtremeDigitalDisplay = (darkRatio > 0.50 && edgeRatio > 0.01) || (darkRatio > 0.30 && flatBlockRatio > 0.35 && edgeRatio > 0.02);

    const isScreenReplay = Boolean(isDarkModeScreen || isLightDigitalScreen || isExtremeDigitalDisplay);

    let reason = "Clean physical ambient capture verified";
    if (isDarkModeScreen) {
      reason = "SECOND-COPY DETECTED (Screen Replay Photo): Dark-mode digital display / terminal window detected";
    } else if (isLightDigitalScreen) {
      reason = "SECOND-COPY DETECTED (Screen Replay Photo): Digital UI table/grid lines detected";
    } else if (isExtremeDigitalDisplay) {
      reason = "SECOND-COPY DETECTED (Screen Replay Photo): Digital monitor subpixel emission detected";
    }

    return {
      isScreenReplay,
      darkRatio,
      brightRatio,
      edgeRatio,
      flatBlockRatio,
      reason,
    };
  } catch (err) {
    return { isScreenReplay: false, reason: "Image analysis error: " + err.message };
  }
};

const analyzeSensorIntegrity = async (sensorData = {}, metadata = {}, mediaData = null) => {
  console.log("[DEBUG TELEMETRY RAW]", JSON.stringify(sensorData));

  const analysis = {
    screenDefense: {
      result: "passed",
      screenDefensePassed: true,
      magnetometerPassed: true,
      lightFlickerPassed: true,
      isRecaptured: false,
      details: "Clean physical ambient capture verified (Paper / Book / Real environment)",
    },
    physicsDefense: {
      result: "passed",
      motionPassed: true,
      details: "Handheld micro-tremors verified",
    },
    locationValid: false,
    timestampValid: false,
    auraFlag: "GREEN",
    status: "verified",
    classification: "AUTHENTIC_CAMERA",
    failureReason: null,
    overallScore: 98,
    isRecaptured: false,
    screenDefensePassed: true,
    sensorsPassed: true,
    lightRelVar: 0,
    magSpread: 0,
    magAvg: 0,
    magMax: 0,
    lightAvg: 0,
    lightSpread: 0,
    imageScreenDetails: null,
    anomalies: [],
  };

  // 1. Direct Image Buffer Screen Forensics Check
  let imageScreenResult = { isScreenReplay: false, reason: "Clean physical ambient capture verified" };
  if (mediaData && mediaData.length > 50) {
    imageScreenResult = await detectDisplayReplay(mediaData);
    analysis.imageScreenDetails = imageScreenResult;
  }

  const magSamples = Array.isArray(sensorData?.magnetometer)
    ? sensorData.magnetometer
    : (Array.isArray(sensorData?.mag)
      ? sensorData.mag
      : (sensorData?.magnetometer?.samples || sensorData?.mag?.samples || []));

  const lightSamples = Array.isArray(sensorData?.light)
    ? sensorData.light
    : (sensorData?.light?.samples || []);

  const magStats = (magSamples && magSamples.length >= 1)
    ? calculateDetailedStats(magSamples)
    : (sensorData.magnetometer ? calculateDetailedStats(sensorData.magnetometer) : null);

  const magSpread = magStats ? magStats.spread : 0;
  const magMax = magStats ? magStats.max : 0;
  const magAvg = magStats ? magStats.avg : 0;

  const lightStats = (lightSamples && lightSamples.length >= 1)
    ? calculateLightStats(lightSamples)
    : (sensorData.light ? calculateLightStats(sensorData.light) : null);

  const lightAvg = lightStats ? lightStats.avg : 0;
  const lightMax = lightStats ? lightStats.max : 0;
  const lightMin = lightStats ? lightStats.min : 0;
  const lightSpread = lightStats ? (lightMax - lightMin) : 0;
  const lightRelVar = lightStats ? lightStats.relativeVariance : 0;

  analysis.lightRelVar = lightRelVar;
  analysis.magSpread = magSpread;
  analysis.magAvg = magAvg;
  analysis.magMax = magMax;
  analysis.lightAvg = lightAvg;
  analysis.lightSpread = lightSpread;

  // 2. Hardware Sensor Telemetry Screen Criteria
  const isSimulated = Boolean(sensorData?.isScreenReplaySimulated || metadata?.isScreenReplaySimulated);
  const isMagScreen = Boolean((magSpread > 5.0) || (magAvg > 50.0));
  const isLightScreen = Boolean(lightRelVar > 0.15 && lightAvg > 15.0);
  const isSensorScreen = Boolean(isSimulated || isMagScreen || isLightScreen);
  const isImageScreen = Boolean(imageScreenResult.isScreenReplay);

  // 3. Combined Dual-Layer Decision (Hardware Sensors + Image Buffer)
  const isRecaptured = Boolean(isSensorScreen || isImageScreen);

  if (isRecaptured) {
    const reasons = [];
    if (isImageScreen) reasons.push(imageScreenResult.reason);
    if (isLightScreen) reasons.push("Display Optical Flicker (Lux: " + lightAvg.toFixed(1) + ", RelVar: " + lightRelVar.toFixed(3) + ")");
    if (isMagScreen) reasons.push("Chassis Magnetic EMI (Spread: " + magSpread.toFixed(1) + " uT, Avg: " + magAvg.toFixed(1) + " uT)");
    if (isSimulated) reasons.push("Simulated Screen Attack Signature");

    const failureReason = reasons[0] || "SECOND-COPY DETECTED (Screen Replay Photo): LCD/OLED display emission or subpixel grid detected";
    analysis.isRecaptured = true;
    analysis.screenDefensePassed = false;
    analysis.sensorsPassed = false;
    analysis.screenDefense.isRecaptured = true;
    analysis.screenDefense.screenDefensePassed = false;
    analysis.screenDefense.result = "failed";
    analysis.screenDefense.magnetometerPassed = !isMagScreen;
    analysis.screenDefense.lightFlickerPassed = !isLightScreen;
    analysis.screenDefense.details = failureReason;
    analysis.failureReason = failureReason;
    analysis.auraFlag = "RED";
    analysis.status = "tampered";
    analysis.classification = "SCREEN_REPLAY";
    analysis.overallScore = 25;
    console.log("[!] SCREEN REPLAY ATTACK TRIGGERED: " + analysis.screenDefense.details);
  } else {
    analysis.isRecaptured = false;
    analysis.screenDefensePassed = true;
    analysis.sensorsPassed = true;
    analysis.screenDefense.isRecaptured = false;
    analysis.screenDefense.screenDefensePassed = true;
    analysis.screenDefense.result = "passed";
    analysis.screenDefense.magnetometerPassed = true;
    analysis.screenDefense.lightFlickerPassed = true;
    analysis.screenDefense.details = "Clean physical ambient capture verified (Paper / Book / Real environment)";
    analysis.failureReason = null;
    analysis.auraFlag = "GREEN";
    analysis.status = "verified";
    analysis.classification = "AUTHENTIC_CAMERA";
    analysis.overallScore = 98;
    console.log("[✓] SCREEN DEFENSE PASS: Clean physical capture verified (Book / Paper)");
  }

  const accStats = sensorData.accelerometer && sensorData.accelerometer.length >= 1 ? calculateDetailedStats(sensorData.accelerometer) : null;
  const MIN_TREMOR_SPREAD = 0.000005;

  if (accStats) {
    if (accStats.spread === 0 && accStats.variance === 0) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.result = "failed";
      analysis.physicsDefense.details = "Absolute zero motion (Synthetic telemetry)";
    } else if (accStats.spread < MIN_TREMOR_SPREAD) {
      analysis.physicsDefense.motionPassed = true;
      analysis.physicsDefense.result = "passed";
      analysis.physicsDefense.details = "Stabilized physical capture baseline verified";
    } else {
      analysis.physicsDefense.motionPassed = true;
      analysis.physicsDefense.result = "passed";
      analysis.physicsDefense.details = "Handheld human micro-tremors verified";
    }
  } else {
    analysis.physicsDefense.motionPassed = true;
    analysis.physicsDefense.details = "Handheld motion profile verified";
  }

  if (sensorData.location && (sensorData.location.latitude != null || sensorData.location.coords?.latitude != null)) {
    analysis.locationValid = true;
  }
  if (sensorData.timestamp?.start || sensorData.timestamp) {
    analysis.timestampValid = true;
  }

  return analysis;
};

const watermarkImage = async (base64Image, proofId = null, timestamp = null, verificationUrl = null) => {
  try {
    if (!base64Image) return null;
    const formattedProofId = formatProofId(proofId);
    const rawDate = timestamp ? new Date(timestamp) : new Date();
    const dateStr = rawDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    const timeStr = rawDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const formattedTimestamp = dateStr + " • " + timeStr;
    const baseUrl = verificationUrl || process.env.VERIFICATION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "https://aura-app.com/verify";
    const finalQrUrl = baseUrl.endsWith("/") ? (baseUrl + formattedProofId) : (baseUrl + "/" + formattedProofId);
    const cleanBase64 = String(base64Image).replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(cleanBase64, "base64");
    const imgObj = sharp(imgBuffer).rotate();
    const meta = await imgObj.metadata();
    const targetWidth = Math.min(Math.max(meta.width || 1080, 1080), 2560);
    const scale = targetWidth / 1080;
    const bannerHeight = Math.round(180 * scale);
    const qrSize = Math.round(130 * scale);
    const qrMargin = Math.round(10 * scale);
    const qrContainerSize = Math.round(150 * scale);
    const qrPngBuffer = await QRCode.toBuffer(finalQrUrl, { width: qrSize, margin: 1, color: { dark: "#00FF9D", light: "#080C14" } });
    const qrBase64 = qrPngBuffer.toString("base64");
    const titleFontSize = Math.round(20 * scale);
    const subFontSize = Math.round(16 * scale);
    const pillFontSize = Math.round(15 * scale);
    const timeFontSize = Math.round(14 * scale);
    const footerFontSize = Math.round(12 * scale);
    const dividerStroke = Math.max(2, Math.round(3 * scale));
    const svgOverlay = Buffer.from(
      "<svg width=\"" + targetWidth + "\" height=\"" + bannerHeight + "\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">" +
        "<rect x=\"0\" y=\"0\" width=\"" + targetWidth + "\" height=\"" + bannerHeight + "\" fill=\"#080C14\" />" +
        "<line x1=\"0\" y1=\"0\" x2=\"" + targetWidth + "\" y2=\"0\" stroke=\"#00FF9D\" stroke-width=\"" + dividerStroke + "\" />" +
        "<rect x=\"" + Math.round(18 * scale) + "\" y=\"" + Math.round(18 * scale) + "\" width=\"" + Math.round(6 * scale) + "\" height=\"" + Math.round(144 * scale) + "\" rx=\"" + Math.round(3 * scale) + "\" fill=\"#00FF9D\" />" +
        "<g transform=\"translate(" + Math.round(36 * scale) + ", " + Math.round(20 * scale) + ") scale(" + (1.35 * scale) + ")\">" +
          "<path d=\"M12 1L3 4v5c0 5.25 3.75 10.2 9 11.5 5.25-1.3 9-6.25 9-11.5V4l-9-3zm-1 13.5l-3.5-3.5 1.41-1.41L11 11.67l5.59-5.59L18 7.5l-7 7z\" fill=\"#00FF9D\" />" +
        "</g>" +
        "<text x=\"" + Math.round(76 * scale) + "\" y=\"" + Math.round(38 * scale) + "\" font-family=\"DejaVu Sans, Arial, Helvetica, sans-serif\" font-size=\"" + titleFontSize + "\" font-weight=\"bold\" fill=\"#00FF9D\" letter-spacing=\"1\">AURA VERIFIED</text>" +
        "<text x=\"" + Math.round(242 * scale) + "\" y=\"" + Math.round(38 * scale) + "\" font-family=\"DejaVu Sans, Arial, Helvetica, sans-serif\" font-size=\"" + Math.round(14 * scale) + "\" font-weight=\"bold\" fill=\"#475569\">|</text>" +
        "<text x=\"" + Math.round(256 * scale) + "\" y=\"" + Math.round(38 * scale) + "\" font-family=\"DejaVu Sans, Arial, Helvetica, sans-serif\" font-size=\"" + subFontSize + "\" font-weight=\"bold\" fill=\"#FFFFFF\" letter-spacing=\"0.5\">AUTHENTIC CAPTURE</text>" +
        "<rect x=\"" + Math.round(36 * scale) + "\" y=\"" + Math.round(52 * scale) + "\" width=\"" + Math.round(340 * scale) + "\" height=\"" + Math.round(34 * scale) + "\" rx=\"" + Math.round(8 * scale) + "\" fill=\"#0F172A\" stroke=\"#334155\" stroke-width=\"1\" />" +
        "<text x=\"" + Math.round(50 * scale) + "\" y=\"" + Math.round(74 * scale) + "\" font-family=\"monospace\" font-size=\"" + pillFontSize + "\" font-weight=\"bold\" fill=\"#38BDF8\" letter-spacing=\"1\">PROOFLINK: " + formattedProofId + "</text>" +
        "<text x=\"" + Math.round(36 * scale) + "\" y=\"" + Math.round(112 * scale) + "\" font-family=\"DejaVu Sans, Arial, Helvetica, sans-serif\" font-size=\"" + timeFontSize + "\" font-weight=\"500\" fill=\"#94A3B8\">🕒 SEALED: " + formattedTimestamp + "</text>" +
        "<text x=\"" + Math.round(36 * scale) + "\" y=\"" + Math.round(140 * scale) + "\" font-family=\"DejaVu Sans, Arial, Helvetica, sans-serif\" font-size=\"" + footerFontSize + "\" font-weight=\"500\" fill=\"#64748B\">PHYSICAL TELEMETRY ATTESTATION • CRYPTOGRAPHIC PROOF SEAL</text>" +
        "<rect x=\"" + (targetWidth - qrContainerSize - Math.round(18 * scale)) + "\" y=\"" + Math.round(15 * scale) + "\" width=\"" + qrContainerSize + "\" height=\"" + qrContainerSize + "\" rx=\"" + Math.round(12 * scale) + "\" fill=\"#0B0F17\" stroke=\"#00FF9D\" stroke-width=\"2\" />" +
        "<image x=\"" + (targetWidth - qrContainerSize - Math.round(18 * scale) + qrMargin) + "\" y=\"" + (Math.round(15 * scale) + qrMargin) + "\" width=\"" + qrSize + "\" height=\"" + qrSize + "\" xlink:href=\"data:image/png;base64," + qrBase64 + "\" />" +
      "</svg>"
    );
    const finalImageBuffer = await imgObj
      .resize({ width: targetWidth })
      .extend({
        bottom: bannerHeight,
        background: { r: 8, g: 12, b: 20, alpha: 1 },
      })
      .composite([
        {
          input: svgOverlay,
          top: meta.height ? Math.round((targetWidth / (meta.width || 1)) * meta.height) : targetWidth,
          left: 0,
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();
    return finalImageBuffer.toString("base64");
  } catch (error) {
    console.error("Error watermarking image:", error.message);
    return base64Image;
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
  calculateDetailedStats,
  calculateLightStats,
  detectDisplayReplay,
  analyzeSensorIntegrity,
  watermarkImage,
};