/**
 * AURA Metadata Forensics — Dual-Model ML Engine
 *
 * Classifies an image as AI-generated or real-camera capture using:
 *  1. EXIF/KNN model  — 13-dim metadata feature vector, k=5 KNN
 *  2. Visual ML model — pixel-level CNN-inspired logistic regression
 *     (noise energy, block variance, edge density, chromatic aberration…)
 *  3. Ensemble fusion — weighted combination of both model probabilities
 *  4. Weighted signal report for UI display
 */

'use strict';

const sharp = require('sharp');
const { analyzeVisualFeatures } = require('./visualMLAnalyzer');
const { analyzeELA } = require('./elaAnalyzer');

// ══════════════════════════════════════════════════════════════════
//  KNN TRAINING DATA
//  Feature vector dimensions (13 total):
//   [0] hasCameraMake     [1] hasCameraModel   [2] hasShutterSpeed
//   [3] hasAperture       [4] hasISO            [5] hasGPS
//   [6] hasXmpPrompt      [7] isPowerOf2Dims    [8] isSquare
//   [9] hasKnownAiSw      [10] hasFocalLength   [11] hasFlash
//   [12] hasExifVersion
//  Labels: 0 = REAL_CAMERA, 1 = AI_GENERATED
// ══════════════════════════════════════════════════════════════════

const TRAINING_DATA = [
  // ── Real camera images (label = 0) ──────────────────────────
  // Format: { f: featureVector, l: label, src: descriptor }
  { f: [1,1,1,1,1,1,0,0,0,0,1,1,1], l: 0, src: 'DSLR_full_exif'         },
  { f: [1,1,1,1,1,0,0,0,0,0,1,1,1], l: 0, src: 'DSLR_no_gps'            },
  { f: [1,1,1,1,1,1,0,0,0,0,1,0,1], l: 0, src: 'smartphone_no_flash'    },
  { f: [1,1,1,1,1,1,0,0,0,0,0,1,1], l: 0, src: 'mirrorless'             },
  { f: [1,1,0,1,1,0,0,0,0,0,1,1,1], l: 0, src: 'older_compact'          },
  { f: [1,1,1,1,1,1,0,0,0,0,1,1,0], l: 0, src: 'action_cam'             },
  { f: [1,1,1,0,1,1,0,0,0,0,1,0,1], l: 0, src: 'phone_wide_angle'       },
  { f: [1,1,1,1,1,0,0,0,0,0,1,1,1], l: 0, src: 'dslr_indoor'            },
  { f: [1,1,1,1,1,1,0,0,0,0,1,1,1], l: 0, src: 'mirrorless_full_frame'  },
  { f: [1,1,0,0,1,0,0,0,0,0,0,1,1], l: 0, src: 'old_phone_minimal_exif' },
  { f: [1,1,1,1,1,1,0,0,0,0,1,0,1], l: 0, src: 'iphone_portrait'        },
  { f: [1,1,1,1,1,1,0,0,0,0,1,1,1], l: 0, src: 'samsung_galaxy'         },
  { f: [1,1,1,1,1,0,0,0,0,0,1,1,1], l: 0, src: 'sony_rx100'             },
  { f: [1,1,1,1,0,1,0,0,0,0,1,1,1], l: 0, src: 'fuji_xpro'             },
  { f: [1,1,1,1,1,0,0,0,0,0,1,0,1], l: 0, src: 'gopro'                  },

  // ── AI-generated images (label = 1) ─────────────────────────
  { f: [0,0,0,0,0,0,1,1,1,1,0,0,0], l: 1, src: 'stable_diffusion_full'  },
  { f: [0,0,0,0,0,0,0,1,1,0,0,0,0], l: 1, src: 'dalle3'                 },
  { f: [0,0,0,0,0,0,1,0,0,1,0,0,0], l: 1, src: 'midjourney'             },
  { f: [0,0,0,0,0,0,1,1,0,0,0,0,0], l: 1, src: 'comfyui_txt2img'        },
  { f: [0,1,0,0,0,0,0,0,0,1,0,0,0], l: 1, src: 'ai_with_model_tag'      },
  { f: [0,0,0,0,0,0,1,1,1,0,0,0,0], l: 1, src: 'automatic1111'          },
  { f: [0,0,0,0,0,0,0,0,1,1,0,0,0], l: 1, src: 'adobe_firefly'          },
  { f: [0,0,0,0,0,0,1,0,0,0,0,0,0], l: 1, src: 'novelai'                },
  { f: [0,0,0,0,0,0,0,1,0,1,0,0,0], l: 1, src: 'bing_creator'           },
  { f: [0,0,0,0,0,0,0,0,0,1,0,0,0], l: 1, src: 'canva_ai'               },
  { f: [0,0,0,0,0,0,1,0,1,0,0,0,0], l: 1, src: 'ideogram'               },
  { f: [0,0,0,0,0,0,0,1,1,0,0,0,0], l: 1, src: 'runwayml'               },
  { f: [0,0,0,0,0,0,1,1,0,1,0,0,0], l: 1, src: 'invokeai'               },
  { f: [1,0,0,0,0,0,1,0,0,0,0,0,1], l: 1, src: 'ai_minimal_exif'        },
  { f: [0,0,0,0,0,0,0,0,0,0,0,0,0], l: 1, src: 'zero_metadata_ai'       },
];

const K = 5; // default k — consistent with your Python evaluation showing k=5 at 98%

// ══════════════════════════════════════════════════════════════════
//  SIGNAL DEFINITIONS (for UI display — not used for classification)
// ══════════════════════════════════════════════════════════════════

const SIGNALS = [
  {
    id: 'missing_camera_make',
    label: 'No Camera Manufacturer',
    weight: 15,
    check: (meta) => !meta.make || meta.make.trim() === '',
    detail: 'Real cameras embed Make (Canon, Nikon, Apple…). AI images omit this field.',
  },
  {
    id: 'missing_camera_model',
    label: 'No Camera Model',
    weight: 14,
    check: (meta) => !meta.model || meta.model.trim() === '',
    detail: 'Real cameras always embed their hardware model string.',
  },
  {
    id: 'known_ai_software',
    label: 'AI Software Tag Detected',
    weight: 20,
    check: (meta) => {
      const sw = (meta.software || '').toLowerCase();
      const AI_TOOLS = [
        'stable diffusion', 'dall-e', 'dall·e', 'midjourney', 'adobe firefly',
        'bing image creator', 'dreamstudio', 'runway', 'novelai',
        'automatic1111', 'comfyui', 'invoke ai', 'image creator', 'gpt-4o',
        'canva ai', 'ideogram', 'leonardo.ai', 'sora',
      ];
      return AI_TOOLS.some((t) => sw.includes(t));
    },
    detail: 'Software tag matches a known AI image generation tool.',
  },
  {
    id: 'missing_shutter_speed',
    label: 'No Shutter Speed',
    weight: 10,
    check: (meta) => meta.shutterSpeed == null,
    detail: 'Every real camera records shutter speed in EXIF.',
  },
  {
    id: 'missing_aperture',
    label: 'No Aperture (f-stop)',
    weight: 8,
    check: (meta) => meta.aperture == null,
    detail: 'Real optics always record aperture. Absent = no physical lens.',
  },
  {
    id: 'missing_iso',
    label: 'No ISO Sensitivity',
    weight: 6,
    check: (meta) => meta.isoSpeedRating == null,
    detail: 'ISO is a core camera parameter always embedded at capture time.',
  },
  {
    id: 'missing_gps',
    label: 'No GPS Coordinates',
    weight: 5,
    check: (meta) => meta.latitude == null && meta.longitude == null,
    detail: 'Smartphone cameras frequently embed GPS. Absence is a weak AI indicator.',
  },
  {
    id: 'xmp_prompt_field',
    label: 'XMP Prompt / Parameters Field',
    weight: 25,
    check: (meta) => {
      const xmp = JSON.stringify(meta.xmp || {}).toLowerCase();
      return ['"prompt"', '"parameters"', '"negativeprompt"', '"steps"',
              '"cfg"', '"sampler"', '"seed"', '"model_hash"', '"lora"']
        .some((k) => xmp.includes(k));
    },
    detail: 'XMP metadata contains AI generation prompt/parameters. Definitive fingerprint.',
  },
  {
    id: 'power_of_two_dimensions',
    label: 'Power-of-2 Image Dimensions',
    weight: 8,
    check: (_meta, stats) => {
      const AI_DIMS = [512, 768, 1024, 1152, 1536, 2048, 2560, 3072, 4096];
      return AI_DIMS.includes(stats?.width) && AI_DIMS.includes(stats?.height);
    },
    detail: 'Dimensions match known AI model output sizes (512×512, 1024×1024…).',
  },
  {
    id: 'exact_square',
    label: 'Exact Square Aspect Ratio',
    weight: 4,
    check: (_meta, stats) => stats?.width && stats?.height && stats.width === stats.height,
    detail: 'Perfect 1:1 square images are common in diffusion model defaults.',
  },
  {
    id: 'missing_focal_length',
    label: 'No Focal Length',
    weight: 6,
    check: (meta) => meta.focalLength == null,
    detail: 'Physical lenses always embed focal length.',
  },
  {
    id: 'missing_flash',
    label: 'No Flash Data',
    weight: 3,
    check: (meta) => meta.flash == null,
    detail: 'Real cameras record flash state (fired / not fired).',
  },
  {
    id: 'missing_exif_version',
    label: 'No EXIF Version',
    weight: 4,
    check: (meta) => !meta.exifVersion || meta.exifVersion.trim() === '',
    detail: 'EXIF version field is always populated by camera firmware.',
  },
];

// ══════════════════════════════════════════════════════════════════
//  KNN IMPLEMENTATION  (mirrors Python reference exactly)
// ══════════════════════════════════════════════════════════════════

/**
 * Euclidean distance between two equal-length numeric arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
const euclideanDistance = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

/**
 * k-Nearest Neighbours classifier.
 * Python equivalent:
 *   distances = np.abs(x_train - x_test_point)          // Euclidean here
 *   k_nearest = np.argsort(distances)[:k]
 *   labels    = y_train[k_nearest]
 *   predicted = np.bincount(labels).argmax()
 *
 * @param {number[]}   testVector   — 13-dim feature vector for the image under test
 * @param {number[][]} trainFeatures — training feature matrix
 * @param {number[]}   trainLabels   — 0=REAL, 1=AI per training sample
 * @param {number}     k
 * @returns {{ predictedClass: number, aiVoteRatio: number, distances: number[] }}
 */
const knnClassify = (testVector, trainFeatures, trainLabels, k) => {
  // Step 1 — compute distances to all training points
  const distances = trainFeatures.map((trainVec) =>
    euclideanDistance(trainVec, testVector)
  );

  // Step 2 — argsort: get indices sorted by distance ascending
  const sortedIndices = distances
    .map((dist, idx) => ({ dist, idx }))
    .sort((a, b) => a.dist - b.dist)
    .map((item) => item.idx);

  // Step 3 — k nearest labels
  const kNearestIndices = sortedIndices.slice(0, k);
  const kNearestLabels = kNearestIndices.map((i) => trainLabels[i]);

  // Step 4 — bincount → argmax (majority vote)
  const bincount = [0, 0]; // [real_votes, ai_votes]
  kNearestLabels.forEach((label) => { bincount[label]++; });
  const predictedClass = bincount[1] >= bincount[0] ? 1 : 0;
  const aiVoteRatio = bincount[1] / k;

  return { predictedClass, aiVoteRatio, bincount, kNearestIndices, distances };
};

// ══════════════════════════════════════════════════════════════════
//  FEATURE EXTRACTION
// ══════════════════════════════════════════════════════════════════

/**
 * Convert a metadata dict + sharpStats into the 13-dimensional binary feature vector.
 * @param {object} meta    — extracted EXIF fields
 * @param {object} stats   — sharp image stats (width, height, format…)
 * @returns {number[]}     — 13-element array of 0/1 values
 */
const buildFeatureVector = (meta, stats) => {
  const AI_TOOLS = [
    'stable diffusion', 'dall-e', 'dall·e', 'midjourney', 'adobe firefly',
    'bing image creator', 'dreamstudio', 'runway', 'novelai',
    'automatic1111', 'comfyui', 'invoke ai', 'image creator', 'gpt-4o',
    'canva ai', 'ideogram', 'leonardo.ai', 'sora',
  ];
  const AI_DIMS = [512, 768, 1024, 1152, 1536, 2048, 2560, 3072, 4096];
  const xmpStr  = JSON.stringify(meta.xmp || {}).toLowerCase();
  const hasXmp  = ['"prompt"', '"parameters"', '"negativeprompt"', '"steps"',
                   '"cfg"', '"sampler"', '"seed"', '"model_hash"', '"lora"']
                  .some((k) => xmpStr.includes(k));

  return [
    /* 0  hasCameraMake    */ meta.make && meta.make.trim() ? 1 : 0,
    /* 1  hasCameraModel   */ meta.model && meta.model.trim() ? 1 : 0,
    /* 2  hasShutterSpeed  */ meta.shutterSpeed != null ? 1 : 0,
    /* 3  hasAperture      */ meta.aperture != null ? 1 : 0,
    /* 4  hasISO           */ meta.isoSpeedRating != null ? 1 : 0,
    /* 5  hasGPS           */ (meta.latitude != null || meta.longitude != null) ? 1 : 0,
    /* 6  hasXmpPrompt     */ hasXmp ? 1 : 0,
    /* 7  isPowerOf2Dims   */ (AI_DIMS.includes(stats?.width) && AI_DIMS.includes(stats?.height)) ? 1 : 0,
    /* 8  isSquare         */ (stats?.width && stats?.height && stats.width === stats.height) ? 1 : 0,
    /* 9  hasKnownAiSw     */ AI_TOOLS.some((t) => (meta.software || '').toLowerCase().includes(t)) ? 1 : 0,
    /* 10 hasFocalLength   */ meta.focalLength != null ? 1 : 0,
    /* 11 hasFlash         */ meta.flash != null ? 1 : 0,
    /* 12 hasExifVersion   */ (meta.exifVersion && meta.exifVersion.trim()) ? 1 : 0,
  ];
};

// ══════════════════════════════════════════════════════════════════
//  RAW EXIF EXTRACTION  (lightweight JPEG/IFD parser — no extra deps)
// ══════════════════════════════════════════════════════════════════

const parseXmpSignals = (xmpStr) => {
  const out = {};
  const PATTERNS = [
    { key: 'prompt',         pat: /prompt[^>]*?>([^<]+)/i },
    { key: 'parameters',     pat: /parameters[^>]*?>([^<]+)/i },
    { key: 'negativePrompt', pat: /negativeprompt[^>]*?>([^<]+)/i },
    { key: 'steps',          pat: /steps[^>]*?>([^<]+)/i },
    { key: 'seed',           pat: /seed[^>]*?>([^<]+)/i },
    { key: 'sampler',        pat: /sampler[^>]*?>([^<]+)/i },
    { key: 'cfg',            pat: /cfg[^>]*?>([^<]+)/i },
  ];
  PATTERNS.forEach(({ key, pat }) => {
    const m = xmpStr.match(pat);
    if (m) out[key] = m[1].trim().slice(0, 120);
  });
  return out;
};

const extractExifTags = (buf, result) => {
  try {
    if (buf.length < 8) return;
    const byteOrder = buf.slice(0, 2).toString('ascii');
    const isLE = byteOrder === 'II';
    const read16 = (o) => isLE ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
    const read32 = (o) => isLE ? buf.readUInt32LE(o) : buf.readUInt32BE(o);

    const ifd0 = read32(4);
    if (ifd0 >= buf.length) return;

    const readStr = (off, len) => {
      try { return buf.slice(off, off + len).toString('ascii').replace(/\0/g, '').trim(); }
      catch { return ''; }
    };
    const readRat = (off) => {
      try {
        const n = read32(off), d = read32(off + 4);
        return d !== 0 ? n / d : null;
      } catch { return null; }
    };

    const TAG_MAP = {
      0x010F: 'make',         0x0110: 'model',        0x0131: 'software',
      0x0132: 'dateTime',     0x9003: 'dateTimeOriginal', 0x9004: 'dateTimeDigitized',
      0x9290: 'subSecTime',   0x9291: 'subSecTimeOriginal',
      0x8769: '_exifIFD',     0x8825: '_gpsIFD',
      0x9000: 'exifVersion',  0x829A: 'exposureTime', 0x829D: 'fNumber',
      0x8827: 'isoSpeedRating', 0x9202: 'aperture',   0x9201: 'shutterSpeed',
      0x920A: 'focalLength',  0xA405: 'focalLengthIn35mmFormat',
      0x9207: 'meteringMode', 0x9209: 'flash',        0xA402: 'exposureMode',
      0xA403: 'whiteBalance', 0x0002: 'latitude',     0x0004: 'longitude',
    };

    const parseIFD = (offset) => {
      if (offset + 2 >= buf.length) return;
      const count = read16(offset);
      if (count > 500) return;
      for (let i = 0; i < count; i++) {
        const e = offset + 2 + i * 12;
        if (e + 12 > buf.length) break;
        const tag  = read16(e);
        const type = read16(e + 2);
        const cnt  = read32(e + 4);
        const voff = e + 8;
        const name = TAG_MAP[tag];
        if (!name) continue;
        try {
          if (name === '_exifIFD' || name === '_gpsIFD') {
            parseIFD(read32(voff)); continue;
          }
          if (type === 2) {
            const off = cnt <= 4 ? voff : read32(voff);
            if (off + cnt <= buf.length) result[name] = readStr(off, cnt);
          } else if (type === 3 && cnt === 1) {
            result[name] = read16(voff);
          } else if (type === 4 && cnt === 1) {
            result[name] = read32(voff);
          } else if (type === 5) {
            result[name] = readRat(read32(voff));
          } else if (type === 7 && name === 'exifVersion') {
            const off = cnt <= 4 ? voff : read32(voff);
            if (off + cnt <= buf.length) result[name] = buf.slice(off, off + cnt).toString('ascii');
          }
        } catch { /* skip malformed tag */ }
      }
    };

    parseIFD(ifd0);
  } catch { /* tolerate corrupt EXIF */ }
};

const parseExifFromBuffer = (buf) => {
  const result = {};
  try {
    if (!buf || buf.length < 12) return result;
    let off = 2;
    while (off < buf.length - 4) {
      const marker = buf.readUInt16BE(off);
      if (marker === 0xFFE1) {
        const segLen = buf.readUInt16BE(off + 2);
        const seg = buf.slice(off + 4, off + 2 + segLen);
        if (seg.slice(0, 6).toString('ascii') === 'Exif\0\0') {
          extractExifTags(seg.slice(6), result);
        }
        const segStr = seg.toString('utf8', 0, Math.min(100, seg.length));
        if (segStr.includes('xpacket') || segStr.includes('xmp')) {
          result.xmp = parseXmpSignals(seg.toString('utf8'));
        }
        off += 2 + segLen;
      } else if ((marker & 0xFF00) === 0xFF00) {
        if (buf.length <= off + 3) break;
        off += 2 + buf.readUInt16BE(off + 2);
      } else {
        break;
      }
    }
  } catch { /* partial EXIF acceptable */ }
  return result;
};

// ══════════════════════════════════════════════════════════════════
//  MAIN ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════

/**
 * Analyze image with dual-model ensemble:
 *   Model A — KNN on EXIF metadata (weight: 0.45)
 *   Model B — Visual pixel CNN features (weight: 0.55)
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<AnalysisResult>}
 */
const analyzeImageMetadata = async (imageBuffer) => {
  // ── 1. Sharp image stats ──
  let sharpStats = {};
  try {
    const meta = await sharp(imageBuffer).metadata();
    sharpStats = {
      width: meta.width, height: meta.height, format: meta.format,
      channels: meta.channels, density: meta.density,
      hasAlpha: meta.hasAlpha, isProgressive: meta.isProgressive,
      chromaSubsampling: meta.chromaSubsampling, orientation: meta.orientation,
    };
  } catch (err) {
    sharpStats = { error: err.message };
  }

  // ── 2. EXIF extraction ──
  const exifMeta = parseExifFromBuffer(imageBuffer);
  const metadataFingerprint = { ...sharpStats, ...exifMeta };

  // ── 3. Model A: KNN on metadata ──
  const featureVector = buildFeatureVector(metadataFingerprint, sharpStats);
  const trainFeatures = TRAINING_DATA.map((d) => d.f);
  const trainLabels   = TRAINING_DATA.map((d) => d.l);
  const { aiVoteRatio, bincount, kNearestIndices } =
    knnClassify(featureVector, trainFeatures, trainLabels, K);
  const knnAiProb = aiVoteRatio * 100; // 0–100

  // ── 4. Model B: Visual pixel analysis ──
  let visualResult = null;
  let visualAiProb = 50; // neutral default if visual fails
  try {
    visualResult = await analyzeVisualFeatures(imageBuffer);
    visualAiProb = visualResult.aiProbability;
  } catch (err) {
    // Visual analysis optional — degrade gracefully
    visualResult = { error: err.message, aiProbability: 50 };
  }

  // ── 4.5. Model C: Error Level Analysis (ELA) ──
  let elaResult = null;
  let elaAiProb = 50;
  try {
    elaResult = await analyzeELA(imageBuffer);
    if (elaResult.success) {
      elaAiProb = elaResult.aiProbability * 100; // convert 0.0-1.0 to 0-100
    }
  } catch (err) {
    elaResult = { error: err.message, aiProbability: 0.5 };
  }

  // ── 5. Ensemble fusion (weighted average) ──
  //   KNN weight: 0.35 — reliable when EXIF tags present
  //   Visual weight: 0.40 — reliable for pixel-level GAN artifacts
  //   ELA weight: 0.25 — reliable for spotting inconsistent compression/variance
  const W_KNN    = 0.30;
  const W_VISUAL = 0.35;
  const W_ELA    = 0.35;
  
  const ensembleAiProb = parseFloat(
    (W_KNN * knnAiProb + W_VISUAL * visualAiProb + W_ELA * elaAiProb).toFixed(1)
  );
  const aiProbability   = ensembleAiProb;
  const realProbability = parseFloat((100 - aiProbability).toFixed(1));

  // ── 6. Classification band ──
  let classification;
  let confidence;
  if (aiProbability >= 65) {
    classification = 'AI_GENERATED';
    confidence     = parseFloat(Math.min(aiProbability + 5, 100).toFixed(1));
  } else if (aiProbability <= 38) {
    classification = 'REAL_CAMERA';
    confidence     = parseFloat(Math.min(realProbability + 5, 100).toFixed(1));
  } else {
    classification = 'UNCERTAIN';
    confidence     = parseFloat((40 + Math.abs(aiProbability - 51.5)).toFixed(1));
  }

  // ── 7. Signal report + visual signals ──
  const signals = SIGNALS.map((sig) => {
    let triggered = false;
    try { triggered = sig.check(metadataFingerprint, sharpStats); } catch { /* skip */ }
    return {
      id: sig.id,
      label: sig.label,
      weight: sig.weight,
      triggered,
      score: triggered ? sig.weight : 0,
      detail: triggered ? sig.detail : null,
    };
  });

  // Append visual model signals
  if (visualResult && !visualResult.error) {
    const f = visualResult.features;
    const vSignals = [
      {
        id: 'visual_noise_energy',
        label: 'Visual Noise Fingerprint',
        weight: 18,
        triggered: f.noiseEnergy < 0.04,
        score: f.noiseEnergy < 0.04 ? 18 : 0,
        detail: f.noiseEnergy < 0.04
          ? `Noise energy ${f.noiseEnergy.toFixed(4)} — too smooth for a real camera sensor`
          : null,
      },
      {
        id: 'visual_block_variance',
        label: 'Smooth Block Structure (GAN)',
        weight: 16,
        triggered: f.blockVariance > 0.65,
        score: f.blockVariance > 0.65 ? 16 : 0,
        detail: f.blockVariance > 0.65
          ? `Block variance score ${f.blockVariance.toFixed(3)} — GAN-typical uniform regions`
          : null,
      },
      {
        id: 'visual_chromatic',
        label: 'No Chromatic Aberration',
        weight: 14,
        triggered: f.chromaticScore > 0.75,
        score: f.chromaticScore > 0.75 ? 14 : 0,
        detail: f.chromaticScore > 0.75
          ? 'Perfect channel alignment — real lenses produce R/B fringing at edges'
          : null,
      },
      {
        id: 'visual_edge_density',
        label: 'Unnatural Edge Pattern',
        weight: 10,
        triggered: f.edgeDensity < 0.05 || f.edgeDensity > 0.45,
        score: f.edgeDensity < 0.05 || f.edgeDensity > 0.45 ? 10 : 0,
        detail: f.edgeDensity < 0.05
          ? 'Extremely smooth — diffusion model over-smoothing detected'
          : f.edgeDensity > 0.45 ? 'Unnatural edge density pattern' : null,
      },
    ];
    signals.push(...vSignals);
  }

  // Add ELA signals if abnormal
  if (elaResult && elaResult.success && elaResult.anomalyType !== 'normal') {
    signals.push({
      id: 'ela_anomaly',
      label: 'Error Level Anomaly (ELA)',
      weight: 15,
      triggered: true,
      score: 15,
      detail: elaResult.anomalyType === 'abnormally_smooth' 
        ? `ELA variance too low (${elaResult.metrics.variance.toFixed(2)}) — indicates synthetic lossless generation` 
        : `ELA variance too high (${elaResult.metrics.variance.toFixed(2)}) — inconsistent block artifacts detected`,
    });
  }

  signals.sort((a, b) => b.weight - a.weight);

  const triggeredSignals = signals.filter((s) => s.triggered);

  // ── 8. Nearest neighbours detail ──
  const nearestNeighbours = kNearestIndices.map((i) => ({
    source: TRAINING_DATA[i].src,
    label: TRAINING_DATA[i].l === 0 ? 'REAL_CAMERA' : 'AI_GENERATED',
  }));

  return {
    // Ensemble result
    classification,
    aiProbability,
    realProbability,
    confidence,

    // Model A — KNN metadata
    knnAiProbability: parseFloat(knnAiProb.toFixed(1)),
    kValue: K,
    aiVotes: bincount[1],
    realVotes: bincount[0],
    nearestNeighbours,
    featureVector,

    // Model B — Visual pixel
    visualAiProbability: parseFloat(visualAiProb.toFixed(1)),
    visualFeatures: visualResult?.features || null,
    visualError: visualResult?.error || null,

    // Model C — ELA
    elaAiProbability: parseFloat(elaAiProb.toFixed(1)),
    elaMetrics: elaResult?.success ? elaResult.metrics : null,

    // Weights used
    ensembleWeights: { knn: W_KNN, visual: W_VISUAL, ela: W_ELA },

    // Signal breakdown
    triggeredSignalCount: triggeredSignals.length,
    totalSignalCount: signals.length,
    signals,
    triggeredSignals,

    // Raw
    metadataFingerprint,
    imageStats: sharpStats,
    analyzedAt: new Date().toISOString(),
  };
};

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════

/**
 * Accept Buffer or base64 string (with or without data-URI prefix).
 * @param {Buffer|string} input
 * @returns {Buffer}
 */
const toBuffer = (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') {
    return Buffer.from(input.replace(/^data:image\/[a-z+]+;base64,/, ''), 'base64');
  }
  throw new Error('Invalid image input — expected Buffer or base64 string');
};

module.exports = { analyzeImageMetadata, toBuffer, SIGNALS, TRAINING_DATA, K };
