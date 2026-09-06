/**
 * AURA Screen Recapture Analyzer
 *
 * Detects whether an image is a photograph taken of a digital screen
 * (laptop, monitor, phone, tablet, TV) using three independent forensic signals:
 *
 *  1. MOIRÉ / DISPLAY PIXEL GRID LATTICE SCORE (weight 0.45)
 *     Patch-based 2D frequency analysis detecting the periodic subpixel lattice
 *     and Moiré interference patterns across illuminated display surfaces.
 *     Natural objects (fans, walls, skin, furniture) have random continuous noise
 *     and do NOT exhibit regular microscopic surface lattice periodicity.
 *
 *  2. DISPLAY BANDING / REFRESH ARTIFACT SCORE (weight 0.30)
 *     Multi-periodic scanline / PWM flicker detector. Detrends global lighting
 *     gradients and requires regular multi-stripe oscillations (>= 4 cycles),
 *     preventing isolated scene objects from triggering false banding alarms.
 *
 *  3. RECTANGLE / SCREEN PANEL GEOMETRY SCORE (weight 0.25)
 *     Sobel-edge boundary detector that looks for an illuminated screen panel
 *     framed by darker bezel borders (top, bottom, left, right).
 *
 * IMPORTANT DESIGN PRINCIPLES:
 *  - Real-world photographs of rooms, ceilings, fans, faces, or landscapes MUST
 *    score near 0.0 and cleanly classify as REAL when valid camera EXIF is present.
 *  - Screen photographs with visible bezels, Moiré interference, or scanline
 *    banding score >= 0.55 and classify as SCREEN_RECAPTURE.
 *  - Valid phone EXIF does NOT prevent SCREEN_RECAPTURE classification (a phone
 *    actually took the photo of the screen).
 *
 * No Python or native OpenCV dependencies. Pure Node.js + sharp.
 */

'use strict';

const sharp = require('sharp');

// ══════════════════════════════════════════════════════════════════
//  TUNABLE CONSTANTS
// ══════════════════════════════════════════════════════════════════

const ANALYSIS_SIZE = 512;
const PATCH_SIZE = 64;

// ══════════════════════════════════════════════════════════════════
//  RADIX-2 REAL-VALUED FFT (Cooley-Tukey)
// ══════════════════════════════════════════════════════════════════

const padToPowerOfTwo = (arr) => {
  let n = 1;
  while (n < arr.length) n <<= 1;
  const padded = new Float64Array(n);
  padded.set(arr.slice(0, n));
  return padded;
};

const fft = (re, im) => {
  const N = re.length;
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
};

const computeMagnitudeSpectrum = (signal) => {
  const re = padToPowerOfTwo(signal);
  const im = new Float64Array(re.length);
  fft(re, im);
  const half = re.length >> 1;
  const mag = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
};

// ══════════════════════════════════════════════════════════════════
//  SIGNAL 1: MOIRÉ & DISPLAY PIXEL GRID LATTICE
// ══════════════════════════════════════════════════════════════════

/**
 * Patch-based surface lattice analysis.
 * In a real photo (wall, ceiling, skin), flat surface patches have random noise.
 * In a screen photo, display subpixels and Moiré create regular harmonic peaks.
 *
 * @param {Float32Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {number} moireScore in [0, 1]
 */
const computeMoireScore = (gray, width, height) => {
  const patchSize = PATCH_SIZE;
  const cols = Math.floor(width / patchSize);
  const rows = Math.floor(height / patchSize);
  let surfacePatchCount = 0;
  let periodicPatchCount = 0;
  let maxGridStrength = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startX = c * patchSize;
      const startY = r * patchSize;

      const patch = new Float32Array(patchSize * patchSize);
      let pMean = 0;
      for (let y = 0; y < patchSize; y++) {
        for (let x = 0; x < patchSize; x++) {
          const v = gray[(startY + y) * width + (startX + x)];
          patch[y * patchSize + x] = v;
          pMean += v;
        }
      }
      pMean /= (patchSize * patchSize);

      let pVar = 0;
      for (let i = 0; i < patchSize * patchSize; i++) {
        const diff = patch[i] - pMean;
        pVar += diff * diff;
      }
      const pStd = Math.sqrt(pVar / (patchSize * patchSize));

      // Examine surface patches (moderate contrast, not extreme scene boundary edges)
      if (pStd > 1.5 && pStd < 55) {
        surfacePatchCount++;

        let patchPeriodicity = 0;
        for (let y = 8; y < patchSize - 8; y += 8) {
          const row = [];
          for (let x = 0; x < patchSize; x++) row.push(patch[y * patchSize + x]);
          const mag = computeMagnitudeSpectrum(row);
          let peak = 0, mean = 0, count = 0;
          for (let k = 4; k < Math.min(24, mag.length - 1); k++) {
            if (mag[k] > peak) peak = mag[k];
            mean += mag[k];
            count++;
          }
          mean = count > 0 ? (mean / count) + 1e-5 : 1e-5;
          const ratio = peak / mean;
          if (ratio > 3.2 && peak > 12.0) {
            patchPeriodicity += (ratio - 3.2);
          }
        }

        if (patchPeriodicity > 2.0) {
          periodicPatchCount++;
          if (patchPeriodicity > maxGridStrength) maxGridStrength = patchPeriodicity;
        }
      }
    }
  }

  if (surfacePatchCount === 0) return 0;

  const periodicRatio = periodicPatchCount / surfacePatchCount;
  if (periodicRatio < 0.12) return 0;

  const score = Math.min(1.0, (periodicRatio / 0.35) * 0.7 + Math.min(maxGridStrength / 10.0, 0.3));
  return parseFloat(score.toFixed(4));
};

// ══════════════════════════════════════════════════════════════════
//  SIGNAL 2: DISPLAY SCANLINE / PWM BANDING
// ══════════════════════════════════════════════════════════════════

/**
 * Detect multi-periodic horizontal scanlines from PWM or rolling shutter.
 * Detrends global scene lighting gradients so broad room illumination does
 * not trigger false positives.
 *
 * @param {Float32Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {number} bandingScore in [0, 1]
 */
const computeBandingScore = (gray, width, height) => {
  const profile = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      sum += gray[y * width + x];
    }
    profile[y] = sum / width;
  }

  const win = Math.max(8, Math.floor(height / 6));
  const residual = new Float64Array(height);
  let residualEnergy = 0;

  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (let dy = -win; dy <= win; dy++) {
      const ny = y + dy;
      if (ny >= 0 && ny < height) {
        sum += profile[ny];
        count++;
      }
    }
    const smooth = count > 0 ? sum / count : profile[y];
    residual[y] = profile[y] - smooth;
    residualEnergy += residual[y] * residual[y];
  }
  const rmsResidual = Math.sqrt(residualEnergy / height);

  if (rmsResidual < 2.0) return 0;

  const zeroCrossings = [];
  for (let y = 1; y < height; y++) {
    if ((residual[y - 1] < 0 && residual[y] >= 0) || (residual[y - 1] > 0 && residual[y] <= 0)) {
      zeroCrossings.push(y);
    }
  }

  if (zeroCrossings.length < 8) return 0;

  const intervals = [];
  for (let i = 1; i < zeroCrossings.length; i++) {
    intervals.push(zeroCrossings[i] - zeroCrossings[i - 1]);
  }
  const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const varInterval = intervals.reduce((a, b) => a + (b - meanInterval) ** 2, 0) / intervals.length;
  const stdInterval = Math.sqrt(varInterval);
  const cv = stdInterval / (meanInterval + 1e-5);

  if (cv > 0.50) return 0;

  const mag = computeMagnitudeSpectrum(residual);
  let peakVal = 0, meanVal = 0, count = 0;
  for (let k = 4; k < Math.min(32, mag.length - 1); k++) {
    if (mag[k] > peakVal) peakVal = mag[k];
    meanVal += mag[k];
    count++;
  }
  meanVal = count > 0 ? (meanVal / count) + 1e-5 : 1e-5;
  const peakToMean = peakVal / meanVal;

  if (peakToMean < 2.5) return 0;

  const score = Math.min(1.0, ((peakToMean - 2.5) / 3.5) * 0.6 + (Math.min(rmsResidual, 10.0) / 10.0) * 0.4);
  return parseFloat(score.toFixed(4));
};

// ══════════════════════════════════════════════════════════════════
//  SIGNAL 3: SCREEN BEZEL & PANEL GEOMETRY
// ══════════════════════════════════════════════════════════════════

/**
 * Detect an illuminated rectangular screen panel framed by a bezel.
 *
 * @param {Float32Array} gray
 * @param {number} width
 * @param {number} height
 * @returns {number} rectangleScore in [0, 1]
 */
const computeRectangleScore = (gray, width, height) => {
  const gxArr = new Float32Array(width * height);
  const gyArr = new Float32Array(width * height);
  const magArr = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)]
        - 2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)]
        - gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
      const gy =
        -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)]
        + gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];
      gxArr[idx] = gx;
      gyArr[idx] = gy;
      magArr[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const rowHEdge = new Float32Array(height);
  const colVEdge = new Float32Array(width);

  const EDGE_THRESH = 45;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      const m = magArr[idx];
      if (m > EDGE_THRESH) {
        if (Math.abs(gyArr[idx]) > Math.abs(gxArr[idx]) * 1.5) {
          rowHEdge[y] += m;
        }
        if (Math.abs(gxArr[idx]) > Math.abs(gyArr[idx]) * 1.5) {
          colVEdge[x] += m;
        }
      }
    }
  }

  let topHPeak = 0;
  for (let y = 5; y < Math.floor(height * 0.35); y++) {
    if (rowHEdge[y] > topHPeak) topHPeak = rowHEdge[y];
  }

  let botHPeak = 0;
  for (let y = Math.floor(height * 0.65); y < height - 5; y++) {
    if (rowHEdge[y] > botHPeak) botHPeak = rowHEdge[y];
  }

  let leftVPeak = 0;
  for (let x = 5; x < Math.floor(width * 0.35); x++) {
    if (colVEdge[x] > leftVPeak) leftVPeak = colVEdge[x];
  }

  let rightVPeak = 0;
  for (let x = Math.floor(width * 0.65); x < width - 5; x++) {
    if (colVEdge[x] > rightVPeak) rightVPeak = colVEdge[x];
  }

  const normWidth = width * 120;
  const normHeight = height * 120;
  const topHNorm = topHPeak / normWidth;
  const botHNorm = botHPeak / normWidth;
  const leftVNorm = leftVPeak / normHeight;
  const rightVNorm = rightVPeak / normHeight;

  const hPair = (topHNorm > 0.20 && botHNorm > 0.20) ? Math.min(topHNorm, botHNorm) : 0;
  const vPair = (leftVNorm > 0.20 && rightVNorm > 0.20) ? Math.min(leftVNorm, rightVNorm) : 0;
  const activeSides = (topHNorm > 0.22 ? 1 : 0) + (botHNorm > 0.22 ? 1 : 0) + (leftVNorm > 0.22 ? 1 : 0) + (rightVNorm > 0.22 ? 1 : 0);

  if (activeSides < 2 || (hPair === 0 && vPair === 0 && activeSides < 3)) {
    return 0;
  }

  let geoScore = 0;
  if (activeSides >= 3) {
    geoScore = Math.min(1.0, (topHNorm + botHNorm + leftVNorm + rightVNorm) / 2.2);
  } else if (hPair > 0 && vPair > 0) {
    geoScore = Math.min(0.85, (hPair + vPair) * 1.5);
  } else {
    geoScore = Math.min(0.50, Math.max(hPair, vPair));
  }

  return parseFloat(geoScore.toFixed(4));
};

// ══════════════════════════════════════════════════════════════════
//  MAIN SCREEN RECAPTURE ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════

/**
 * Analyze an image for screen-recapture forensic signals.
 *
 * @param {Buffer} imageBuffer — raw image bytes (JPEG, PNG, etc.)
 * @returns {Promise<ScreenAnalysisResult>}
 */
const analyzeScreenRecapture = async (imageBuffer) => {
  try {
    const { data: rgbData, info } = await sharp(imageBuffer)
      .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const pixelCount = width * height;

    const gray = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      gray[i] = 0.299 * rgbData[i * 3] + 0.587 * rgbData[i * 3 + 1] + 0.114 * rgbData[i * 3 + 2];
    }

    const moireScore     = computeMoireScore(gray, width, height);
    const bandingScore   = computeBandingScore(gray, width, height);
    const rectangleScore = computeRectangleScore(gray, width, height);

    const W_MOIRE     = 0.45;
    const W_BANDING   = 0.30;
    const W_RECTANGLE = 0.25;

    let screenScore = (W_MOIRE * moireScore + W_BANDING * bandingScore + W_RECTANGLE * rectangleScore);

    const triggeredSignalsCount = [moireScore > 0.25, bandingScore > 0.25, rectangleScore > 0.25].filter(Boolean).length;
    if (triggeredSignalsCount === 0) {
      screenScore = 0;
    } else if (moireScore > 0.20 && triggeredSignalsCount >= 2) {
      screenScore = Math.min(1.0, screenScore * 1.3);
    } else if (moireScore <= 0.15) {
      // Scene objects (keyboard keycaps, window blinds, tiles) lacking display subpixel moire grid
      screenScore = Math.min(0.35, screenScore * 0.5);
    } else {
      const maxSig = Math.max(moireScore, bandingScore, rectangleScore);
      if (maxSig >= 0.65) {
        screenScore = Math.max(screenScore, maxSig * 0.75);
      }
    }

    screenScore = parseFloat(screenScore.toFixed(4));
    const screenProbability = parseFloat((screenScore * 100).toFixed(1));

    return {
      success: true,
      screenScore,
      screenProbability,
      signals: [
        {
          id: 'screen_moire',
          label: 'Moiré / Pixel Grid Interference',
          score: parseFloat((moireScore * 100).toFixed(1)),
          rawScore: moireScore,
          weight: W_MOIRE,
          triggered: moireScore > 0.25,
          detail: moireScore > 0.25
            ? `Periodic frequency peaks detected (score: ${(moireScore * 100).toFixed(0)}%) — consistent with camera–display pixel grid interference`
            : null,
        },
        {
          id: 'screen_banding',
          label: 'Display Banding / Refresh Artifacts',
          score: parseFloat((bandingScore * 100).toFixed(1)),
          rawScore: bandingScore,
          weight: W_BANDING,
          triggered: bandingScore > 0.25,
          detail: bandingScore > 0.25
            ? `Horizontal brightness banding detected (score: ${(bandingScore * 100).toFixed(0)}%) — consistent with display refresh-rate artifacts`
            : null,
        },
        {
          id: 'screen_rectangle',
          label: 'Screen Boundary Geometry',
          score: parseFloat((rectangleScore * 100).toFixed(1)),
          rawScore: rectangleScore,
          weight: W_RECTANGLE,
          triggered: rectangleScore > 0.25,
          detail: rectangleScore > 0.25
            ? `Strong rectangular edge structure detected (score: ${(rectangleScore * 100).toFixed(0)}%) — consistent with screen bezel or monitor boundary`
            : null,
        },
      ],
      weights: { moire: W_MOIRE, banding: W_BANDING, rectangle: W_RECTANGLE },
      analysisSize: ANALYSIS_SIZE,
    };
  } catch (err) {
    return {
      success: false,
      screenScore: 0,
      screenProbability: 0,
      signals: [],
      error: err.message,
    };
  }
};

module.exports = { analyzeScreenRecapture };
