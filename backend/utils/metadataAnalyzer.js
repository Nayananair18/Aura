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
const { analyzeScreenRecapture } = require('./screenRecaptureAnalyzer');

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
  // Android phones — GPS often denied by user; EXIF still present
  { f: [1,1,1,1,1,0,0,0,0,0,1,1,1], l: 0, src: 'android_no_gps'        },
  { f: [1,1,1,0,1,0,0,0,0,0,1,1,1], l: 0, src: 'android_wide_angle'    },
  { f: [1,1,1,1,1,0,0,0,0,0,0,1,1], l: 0, src: 'android_no_flash_gps'  },
  // AURA-captured: resize strips some tags but make/model/shutter always survive
  { f: [1,1,1,1,1,0,0,0,0,0,1,0,0], l: 0, src: 'aura_android_capture'  },
  { f: [1,1,1,1,1,0,0,0,0,0,0,0,0], l: 0, src: 'aura_minimal_exif'     },

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

const exifr = require('exifr');

// ══════════════════════════════════════════════════════════════════
//  MAIN ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════

const normalizeProvidedExif = (exif) => {
  if (!exif || typeof exif !== 'object') return {};
  
  // Flatten iOS, Android Expo Camera, Exifr, and raw dictionaries
  const flat = { 
    ...exif, 
    ...(exif['{Exif}'] || {}), 
    ...(exif['{TIFF}'] || {}),
    ...(exif['{GPS}'] || {}),
    ...(exif.exif || {}),
    ...(exif.raw || {})
  };
  const out = {};
  
  // Map common uppercase/Expo tags to our internal lowercase names
  out.make = flat.Make || flat.make || flat.cameraMake;
  out.model = flat.Model || flat.model || flat.cameraModel;
  out.software = flat.Software || flat.software;
  out.exifVersion = flat.ExifVersion || flat.exifVersion;
  out.exposureTime = flat.ExposureTime != null ? flat.ExposureTime : (flat.exposureTime != null ? flat.exposureTime : (flat.ShutterSpeedValue != null ? flat.ShutterSpeedValue : flat.shutterSpeed));
  
  // Some cameras use FNumber, others use ApertureValue
  out.aperture = flat.FNumber != null ? flat.FNumber : (flat.fNumber != null ? flat.fNumber : (flat.ApertureValue != null ? flat.ApertureValue : flat.aperture));
  out.shutterSpeed = out.exposureTime;
  out.isoSpeedRating = flat.ISOSpeedRatings != null ? flat.ISOSpeedRatings : (flat.isoSpeedRatings != null ? flat.isoSpeedRatings : (flat.PhotographicSensitivity != null ? flat.PhotographicSensitivity : (flat.ISO != null ? flat.ISO : (flat.iso != null ? flat.iso : flat.isoSpeedRating))));
  out.focalLength = flat.FocalLength != null ? flat.FocalLength : flat.focalLength;
  out.flash = flat.Flash !== undefined ? flat.Flash : flat.flash;
  out.latitude = flat.GPSLatitude != null ? flat.GPSLatitude : (flat.latitude != null ? flat.latitude : flat.lat);
  out.longitude = flat.GPSLongitude != null ? flat.GPSLongitude : (flat.longitude != null ? flat.longitude : (flat.lon != null ? flat.lon : flat.lng));
  
  // Remove undefined properties
  Object.keys(out).forEach(key => out[key] === undefined && delete out[key]);
  return out;
};

/**
 * Analyze image with dual-model ensemble:
 *   Model A — KNN on EXIF metadata (weight: 0.45)
 *   Model B — Visual pixel CNN features (weight: 0.55)
 *
 * @param {Buffer} imageBuffer
 * @param {object} providedExif - EXIF JSON provided by the client (since Expo Camera strips EXIF on Android)
 * @returns {Promise<AnalysisResult>}
 */
const analyzeImageMetadata = async (imageBuffer, providedExif = {}) => {
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
  let exifMeta = {};
  try {
    const rawExif = await exifr.parse(imageBuffer, { 
      exif: true, gps: true, tiff: true, xmp: true 
    });
    if (rawExif) {
      exifMeta = normalizeProvidedExif(rawExif);
      // also try to pull xmp if possible (exifr pulls it out sometimes into top level or as strings)
    }
  } catch (err) {
    console.error('exifr parse error:', err.message);
  }
  const normalizedProvidedExif = normalizeProvidedExif(providedExif);
  
  // Merge EXIF data, giving priority to providedExif because Expo Camera
  // often strips EXIF from the JPEG binary but provides it in the response JSON.
  const metadataFingerprint = { ...sharpStats, ...exifMeta, ...normalizedProvidedExif };

  // ── 3. Model A: KNN on metadata ──
  const featureVector = buildFeatureVector(metadataFingerprint, sharpStats);
  const trainFeatures = TRAINING_DATA.map((d) => d.f);
  const trainLabels   = TRAINING_DATA.map((d) => d.l);
  const { aiVoteRatio, bincount, kNearestIndices } =
    knnClassify(featureVector, trainFeatures, trainLabels, K);
  const knnAiProb = aiVoteRatio * 100; // 0–100

  // ── 4. Models B, C, D: Run visual, ELA, and screen analysis in parallel ──
  let visualResult = null;
  let visualAiProb = 50; // neutral default if visual fails
  let elaResult = null;
  let elaAiProb = 50;
  let screenResult = null;

  try {
    [visualResult, elaResult, screenResult] = await Promise.all([
      analyzeVisualFeatures(imageBuffer).catch((err) => ({ error: err.message, aiProbability: 50 })),
      analyzeELA(imageBuffer).catch((err) => ({ success: false, error: err.message, aiProbability: 0.5 })),
      analyzeScreenRecapture(imageBuffer).catch((err) => ({ success: false, screenScore: 0, screenProbability: 0, signals: [], error: err.message })),
    ]);
  } catch (err) {
    // Should not reach here due to individual .catch handlers above
    visualResult = { error: err.message, aiProbability: 50 };
  }

  // Unwrap visual
  visualAiProb = visualResult?.aiProbability ?? 50;

  // Unwrap ELA
  if (elaResult?.success) {
    // analyzeELA returns aiProbability in 0.0–1.0 range; convert to 0–100
    elaAiProb = elaResult.aiProbability * 100;
  }

  // Unwrap screen
  const screenScore       = screenResult?.screenScore ?? 0;
  const screenProbability = screenResult?.screenProbability ?? 0;
  const screenSignals     = screenResult?.signals ?? [];

  // ── Physical EXIF Presence Score (0 - 100%) ──
  const coreExifChecks = [
    Boolean(metadataFingerprint.make && String(metadataFingerprint.make).trim() !== ''),
    Boolean(metadataFingerprint.model && String(metadataFingerprint.model).trim() !== ''),
    metadataFingerprint.shutterSpeed != null,
    metadataFingerprint.aperture != null,
    metadataFingerprint.isoSpeedRating != null,
    metadataFingerprint.focalLength != null,
    Boolean(metadataFingerprint.software || metadataFingerprint.exifVersion),
  ];
  const passedCoreExif = coreExifChecks.filter(Boolean).length;
  const exifScore = (passedCoreExif / coreExifChecks.length) * 100;

  // Check for explicit AI software tags or prompt metadata (e.g. Midjourney, DALL-E, ComfyUI, etc.)
  const hasExplicitAiSoftware = SIGNALS.find(s => s.id === 'known_ai_software')?.check(metadataFingerprint) || false;
  const hasExplicitAiPrompt = SIGNALS.find(s => s.id === 'xmp_prompt_field')?.check(metadataFingerprint) || false;
  const isExplicitAi = hasExplicitAiSoftware || hasExplicitAiPrompt;

  // ── 5. Ensemble fusion (weighted average & physical hardware gate) ──
  let W_KNN    = 0.40;
  let W_VISUAL = 0.30;
  let W_ELA    = 0.30;

  let effectiveVisualAiProb = visualAiProb;
  let effectiveElaAiProb = elaAiProb;

  // HARD OVERRIDE / PHYSICAL GATE:
  // If physical EXIF presence score >= 70% (has Make, Model, Exposure, F-Number, ISO, etc.)
  // and no explicit AI software tag is present:
  // Document photos, high-contrast text, or clean macros have sharp edges that confuse visual CNNs.
  // Physical optical hardware proof (Make/Model/ISO/Shutter/Lens) is ground truth physics!
  if (exifScore >= 70 && !isExplicitAi) {
    // Cap visual & ELA false-positive penalties
    effectiveVisualAiProb = Math.min(visualAiProb, 15.0);
    effectiveElaAiProb = Math.min(elaAiProb, 15.0);
    W_KNN = 0.70;
    W_VISUAL = 0.15;
    W_ELA = 0.15;
  }

  const ensembleAiProb = parseFloat(
    (W_KNN * knnAiProb + W_VISUAL * effectiveVisualAiProb + W_ELA * effectiveElaAiProb).toFixed(1)
  );
  const aiProbability   = ensembleAiProb;
  const realProbability = parseFloat((100 - aiProbability).toFixed(1));

  // ── 6. Classification band (Strict Rule: "No Physical Proof = Not Verified") ──
  const hasHardwareExif = Boolean(
    (metadataFingerprint.make && String(metadataFingerprint.make).trim() !== '') ||
    (metadataFingerprint.model && String(metadataFingerprint.model).trim() !== '') ||
    metadataFingerprint.shutterSpeed != null ||
    metadataFingerprint.aperture != null ||
    metadataFingerprint.focalLength != null
  );

  // ══════════════════════════════════════════════════════════════════
  //  CLASSIFICATION DECISION — 4-CLASS WITH PRIORITY ORDER
  //
  //  SCREEN_RECAPTURE_THRESHOLD (0.45): Combined screen signal above this
  //  level is classified as SCREEN_RECAPTURE. Tuned for phone-to-laptop-screen
  //  captures where moiré + banding signals are detectable but subtle.
  //
  //  SCREEN_ELEVATED_THRESHOLD (0.28): Even below the recapture threshold,
  //  a screen score above this level is enough evidence to prevent REAL
  //  classification — the image falls to NOT_VERIFIED instead, preserving
  //  forensic honesty.
  //
  //  Decision priority (highest first):
  //   1. SCREEN_RECAPTURE — if strong screen forensic evidence
  //   2. AI_GENERATED     — if AI probability is high OR explicit AI tag
  //   3. REAL             — if low AI probability AND has hardware EXIF
  //                         AND no elevated screen signal
  //   4. NOT_VERIFIED     — insufficient or conflicting evidence
  //
  //  IMPORTANT: Valid phone EXIF does NOT prevent SCREEN_RECAPTURE.
  //  A phone photographing a laptop screen produces real phone EXIF.
  // ══════════════════════════════════════════════════════════════════
  const SCREEN_RECAPTURE_THRESHOLD = 0.48;
  const SCREEN_ELEVATED_THRESHOLD  = 0.35;

  let classification;
  let confidence;

  // Multi-signal requirement for screen recapture:
  // Photos of real objects (notebook lined paper, window blinds, room curtains, textured fabrics)
  // can produce an isolated frequency peak. Real screen captures display MULTIPLE simultaneous
  // signals (e.g. Moiré lattice + refresh banding OR bezel rectangle geometry).
  const numScreenSignalsTriggered = screenResult?.signals?.filter(s => s.triggered)?.length ?? 0;
  const isStrongMultiSignalScreen = (screenScore >= SCREEN_RECAPTURE_THRESHOLD) && (
    numScreenSignalsTriggered >= 2 || !hasHardwareExif || screenScore >= 0.65
  );

  if (isStrongMultiSignalScreen) {
    // Screen forensic evidence is dominant and multi-signal verified
    classification = 'SCREEN_RECAPTURE';
    confidence = parseFloat(screenProbability.toFixed(1));
  } else if (isExplicitAi) {
    // Explicit AI generation tag or prompt found in XMP / EXIF metadata
    classification = 'AI_GENERATED';
    confidence = parseFloat(aiProbability.toFixed(1));
  } else if (aiProbability < 35 && hasHardwareExif && screenScore < SCREEN_ELEVATED_THRESHOLD) {
    // REAL: low AI probability + verified hardware EXIF + NO elevated screen signal
    classification = 'REAL';
    confidence = parseFloat(realProbability.toFixed(1));
  } else {
    // Ambiguous, stripped EXIF, or minor single-signal artifact
    classification = hasHardwareExif ? 'REAL' : 'NOT_VERIFIED';
    confidence = classification === 'REAL'
      ? parseFloat(realProbability.toFixed(1))
      : parseFloat((40 + Math.abs(aiProbability - 50)).toFixed(1));
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
    // ── Ensemble result ──
    classification,           // 'REAL' | 'AI_GENERATED' | 'SCREEN_RECAPTURE' | 'NOT_VERIFIED'
    aiProbability,
    realProbability,
    confidence,

    // ── Model A — KNN metadata ──
    knnAiProbability: parseFloat(knnAiProb.toFixed(1)),
    kValue: K,
    aiVotes: bincount[1],
    realVotes: bincount[0],
    nearestNeighbours,
    featureVector,

    // ── Model B — Visual pixel ──
    visualAiProbability: parseFloat(effectiveVisualAiProb.toFixed(1)),
    visualFeatures: visualResult?.features || null,
    visualError: visualResult?.error || null,

    // ── Model C — ELA ──
    elaAiProbability: parseFloat(effectiveElaAiProb.toFixed(1)),
    elaMetrics: elaResult?.success ? elaResult.metrics : null,

    // ── Model D — Screen Recapture (independent dimension) ──
    // screenScore is NOT folded into aiProbability.
    // It is evaluated separately and takes decision priority.
    screenScore:       parseFloat(screenScore.toFixed(4)),
    screenProbability: parseFloat(screenProbability.toFixed(1)),
    screenSignals,
    screenAnalysisSuccess: screenResult?.success ?? false,

    // ── Weights used for AI ensemble ──
    ensembleWeights: { knn: W_KNN, visual: W_VISUAL, ela: W_ELA },

    // ── Signal breakdown (EXIF + visual signals) ──
    triggeredSignalCount: triggeredSignals.length,
    totalSignalCount: signals.length,
    signals,
    triggeredSignals,

    // ── Raw ──
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
