/**
 * AURA Metadata Forensics — ML Scoring Engine
 *
 * Classifies an image as AI-generated or real-camera capture by extracting
 * EXIF/metadata features and scoring them against a weighted signal model.
 *
 * Classification bands:
 *   aiProbability >= 70  => AI_GENERATED
 *   aiProbability <= 35  => REAL_CAMERA
 *   otherwise            => UNCERTAIN
 */

const sharp = require('sharp');

// ══════════════════════════════════════════════
//  SIGNAL DEFINITIONS
// ══════════════════════════════════════════════

/**
 * Each signal has:
 *  id       — unique key
 *  label    — human-readable name
 *  weight   — importance (all weights sum to 100)
 *  aiScore  — score contribution when signal fires (indicates AI origin)
 *  check    — function(metadata, stats) => boolean, true = AI indicator
 *  detail   — explanation string when triggered
 */
const SIGNALS = [
  {
    id: 'missing_camera_make',
    label: 'No Camera Manufacturer',
    weight: 15,
    aiScore: 15,
    check: (meta) => !meta.make || meta.make.trim() === '',
    detail: 'Real cameras embed Make (Canon, Nikon, Apple, etc.). AI images skip this field.',
  },
  {
    id: 'missing_camera_model',
    label: 'No Camera Model',
    weight: 14,
    aiScore: 14,
    check: (meta) => !meta.model || meta.model.trim() === '',
    detail: 'Real cameras always embed their hardware model string.',
  },
  {
    id: 'known_ai_software',
    label: 'AI Software Tag Detected',
    weight: 20,
    aiScore: 20,
    check: (meta) => {
      const sw = (meta.software || '').toLowerCase();
      const AI_TOOLS = [
        'stable diffusion', 'dall-e', 'dall·e', 'midjourney', 'adobe firefly',
        'gimp', 'bing image creator', 'dreamstudio', 'runway', 'novelai',
        'automatic1111', 'comfyui', 'invoke ai', 'image creator', 'gpt-4o',
        'canva ai', 'ideogram', 'leonardo.ai', 'sora',
      ];
      return AI_TOOLS.some((tool) => sw.includes(tool));
    },
    detail: 'Software tag matches a known AI image generation or manipulation tool.',
  },
  {
    id: 'missing_shutter_speed',
    label: 'No Shutter Speed',
    weight: 10,
    aiScore: 10,
    check: (meta) => meta.shutterSpeed === undefined || meta.shutterSpeed === null,
    detail: 'Every real camera exposure records a shutter speed value in EXIF.',
  },
  {
    id: 'missing_aperture',
    label: 'No Aperture (f-stop)',
    weight: 8,
    aiScore: 8,
    check: (meta) => meta.aperture === undefined || meta.aperture === null,
    detail: 'Real optics always record the aperture. Absent means no physical lens.',
  },
  {
    id: 'missing_iso',
    label: 'No ISO Sensitivity',
    weight: 6,
    aiScore: 6,
    check: (meta) => meta.isoSpeedRating === undefined || meta.isoSpeedRating === null,
    detail: 'ISO is a core camera parameter always embedded by real capture devices.',
  },
  {
    id: 'missing_gps',
    label: 'No GPS Coordinates',
    weight: 5,
    aiScore: 5,
    check: (meta) =>
      (meta.latitude === undefined || meta.latitude === null) &&
      (meta.longitude === undefined || meta.longitude === null),
    detail: 'Smartphone cameras frequently embed GPS. Absence is a weak AI indicator.',
  },
  {
    id: 'xmp_prompt_field',
    label: 'XMP Prompt / Parameters Field',
    weight: 25,
    aiScore: 25,
    check: (meta) => {
      const xmp = JSON.stringify(meta.xmp || {}).toLowerCase();
      const PROMPT_KEYS = [
        '"prompt"', '"parameters"', '"negativeprompt"', '"steps"',
        '"cfg"', '"sampler"', '"seed"', '"model_hash"', '"lora"',
      ];
      return PROMPT_KEYS.some((k) => xmp.includes(k));
    },
    detail: 'XMP metadata contains generation prompt/parameters. This is a definitive AI fingerprint.',
  },
  {
    id: 'power_of_two_dimensions',
    label: 'Power-of-2 Image Dimensions',
    weight: 8,
    aiScore: 8,
    check: (_meta, stats) => {
      if (!stats?.width || !stats?.height) return false;
      const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
      // Many diffusion models output 512,768,1024,1536,2048
      const AI_DIMS = [512, 768, 1024, 1152, 1536, 2048, 2560, 3072, 4096];
      return AI_DIMS.includes(stats.width) && AI_DIMS.includes(stats.height);
    },
    detail: 'Image dimensions match known AI model output sizes (512×512, 1024×1024, etc.).',
  },
  {
    id: 'exact_square',
    label: 'Exact Square Aspect Ratio',
    weight: 4,
    aiScore: 4,
    check: (_meta, stats) => stats?.width && stats?.height && stats.width === stats.height,
    detail: 'Perfect 1:1 square images are common in diffusion model defaults.',
  },
  {
    id: 'missing_focal_length',
    label: 'No Focal Length',
    weight: 6,
    aiScore: 6,
    check: (meta) => meta.focalLength === undefined || meta.focalLength === null,
    detail: 'Physical lenses always embed focal length. Missing value indicates no optical path.',
  },
  {
    id: 'missing_flash',
    label: 'No Flash Data',
    weight: 3,
    aiScore: 3,
    check: (meta) => meta.flash === undefined || meta.flash === null,
    detail: 'Real cameras record flash state (fired/not fired). Absent in AI images.',
  },
  {
    id: 'missing_exposure_mode',
    label: 'No Exposure Mode',
    weight: 4,
    aiScore: 4,
    check: (meta) => meta.exposureMode === undefined || meta.exposureMode === null,
    detail: 'Cameras embed auto/manual exposure mode. AI images omit this field.',
  },
  {
    id: 'missing_white_balance',
    label: 'No White Balance',
    weight: 3,
    aiScore: 3,
    check: (meta) => meta.whiteBalance === undefined || meta.whiteBalance === null,
    detail: 'Every camera records white balance setting at capture time.',
  },
  {
    id: 'missing_metering_mode',
    label: 'No Metering Mode',
    weight: 3,
    aiScore: 3,
    check: (meta) => meta.meteringMode === undefined || meta.meteringMode === null,
    detail: 'Cameras record light metering mode (spot/matrix/centre-weighted).',
  },
  {
    id: 'missing_exif_version',
    label: 'No EXIF Version',
    weight: 4,
    aiScore: 4,
    check: (meta) => !meta.exifVersion || meta.exifVersion.trim() === '',
    detail: 'EXIF version field is always populated by camera firmware.',
  },
  {
    id: 'date_mismatch',
    label: 'Date Modified ≠ Date Created',
    weight: 5,
    aiScore: 5,
    check: (meta) => {
      if (!meta.dateTimeOriginal || !meta.dateTimeDigitized) return false;
      try {
        const orig = new Date(meta.dateTimeOriginal).getTime();
        const dig = new Date(meta.dateTimeDigitized).getTime();
        // More than 30 minutes apart is suspicious for a real capture
        return Math.abs(orig - dig) > 30 * 60 * 1000;
      } catch {
        return false;
      }
    },
    detail: 'DateTimeOriginal and DateTimeDigitized differ significantly — suggests post-processing.',
  },
  {
    id: 'missing_subsec_time',
    label: 'No Sub-Second Timestamp',
    weight: 3,
    aiScore: 3,
    check: (meta) => !meta.subSecTimeOriginal && !meta.subSecTime,
    detail: 'Modern cameras embed sub-second capture time for precise sequencing.',
  },
  {
    id: 'suspicious_software_generic',
    label: 'Generic Editing Software',
    weight: 4,
    aiScore: 4,
    check: (meta) => {
      const sw = (meta.software || '').toLowerCase();
      const EDITORS = ['photoshop', 'lightroom', 'affinity photo', 'capture one', 'darktable', 'rawtherapee', 'luminar'];
      // Editing software alone is not proof of AI — but combined with missing camera fields it is suspicious
      return EDITORS.some((e) => sw.includes(e));
    },
    detail: 'Image was processed through editing software (not definitive alone).',
  },
  {
    id: 'missing_lens_info',
    label: 'No Lens Information',
    weight: 3,
    aiScore: 3,
    check: (meta) =>
      !meta.lensModel && !meta.lensMake && meta.focalLengthIn35mmFormat === undefined,
    detail: 'DSLR/mirrorless cameras always record lens metadata.',
  },
];

// Compute max possible AI score for normalization
const MAX_AI_SCORE = SIGNALS.reduce((sum, s) => sum + s.aiScore, 0);

// ══════════════════════════════════════════════
//  METADATA EXTRACTION (via sharp)
// ══════════════════════════════════════════════

/**
 * Flatten sharp's nested metadata object into a single-level dict.
 * @param {object} raw — raw object from sharp().metadata()
 * @returns {object}
 */
const flattenMetadata = (raw) => {
  const flat = {};

  // Top-level sharp fields
  const TOP_FIELDS = [
    'format', 'width', 'height', 'space', 'channels', 'depth',
    'density', 'chromaSubsampling', 'isProgressive', 'hasProfile', 'hasAlpha',
    'orientation', 'compression', 'background',
  ];
  TOP_FIELDS.forEach((f) => {
    if (raw[f] !== undefined) flat[f] = raw[f];
  });

  // EXIF via exif object (if sharp exposes it as a buffer, we skip for now —
  // sharp exposes parsed EXIF in raw.exif as a Buffer, but individual fields
  // are available only via 3rd-party parsers. We use the ICC profile etc.)
  // ── Note: sharp does NOT parse EXIF internally into named fields.
  // We read them from the raw buffer using EXIF marker parsing below.

  return flat;
};

/**
 * Lightweight EXIF parser for JPEG APP1 markers.
 * Extracts the most forensically relevant tags without a full dependency.
 *
 * @param {Buffer} buf — raw image buffer
 * @returns {object}
 */
const parseExifFromBuffer = (buf) => {
  const result = {};

  try {
    // JPEG SOI + APP1 marker search
    if (!buf || buf.length < 12) return result;

    let offset = 2; // skip SOI (FFD8)
    while (offset < buf.length - 4) {
      const marker = buf.readUInt16BE(offset);
      if (marker === 0xFFE1) {
        // APP1 — potentially EXIF
        const segLen = buf.readUInt16BE(offset + 2);
        const segData = buf.slice(offset + 4, offset + 2 + segLen);

        // Check for "Exif\0\0" header
        if (segData.slice(0, 6).toString('ascii') === 'Exif\0\0') {
          const exifData = segData.slice(6);
          extractExifTags(exifData, result);
        }

        // Check for XMP: "http://ns.adobe.com/xap/1.0/"
        const segStr = segData.toString('utf8', 0, Math.min(100, segData.length));
        if (segStr.includes('xpacket') || segStr.includes('xmp')) {
          const xmpStr = segData.toString('utf8');
          result.xmp = parseXmpSignals(xmpStr);
        }

        offset += 2 + segLen;
      } else if ((marker & 0xFF00) === 0xFF00) {
        if (buf.length <= offset + 3) break;
        const segLen = buf.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      } else {
        break;
      }
    }
  } catch {
    // Silent — partial EXIF is acceptable
  }

  return result;
};

/**
 * Parse XMP XML snippet for AI-generation signals.
 */
const parseXmpSignals = (xmpStr) => {
  const signals = {};
  const PROMPT_PATTERNS = [
    { key: 'prompt', pattern: /prompt[^>]*?>([^<]+)/i },
    { key: 'parameters', pattern: /parameters[^>]*?>([^<]+)/i },
    { key: 'negativePrompt', pattern: /negativeprompt[^>]*?>([^<]+)/i },
    { key: 'steps', pattern: /steps[^>]*?>([^<]+)/i },
    { key: 'seed', pattern: /seed[^>]*?>([^<]+)/i },
    { key: 'sampler', pattern: /sampler[^>]*?>([^<]+)/i },
    { key: 'cfg', pattern: /cfg[^>]*?>([^<]+)/i },
  ];
  PROMPT_PATTERNS.forEach(({ key, pattern }) => {
    const m = xmpStr.match(pattern);
    if (m) signals[key] = m[1].trim().slice(0, 120);
  });
  return signals;
};

/**
 * Parse raw EXIF IFD tags from a Buffer slice.
 * Handles both little-endian (II) and big-endian (MM) byte orders.
 */
const extractExifTags = (buf, result) => {
  try {
    if (buf.length < 8) return;

    const byteOrder = buf.slice(0, 2).toString('ascii');
    const isLE = byteOrder === 'II';
    const read16 = (o) => isLE ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
    const read32 = (o) => isLE ? buf.readUInt32LE(o) : buf.readUInt32BE(o);

    // IFD0 offset
    const ifd0Offset = read32(4);
    if (ifd0Offset >= buf.length) return;

    const readString = (offset, len) => {
      try {
        return buf.slice(offset, offset + len).toString('ascii').replace(/\0/g, '').trim();
      } catch { return ''; }
    };

    const readRational = (offset) => {
      try {
        const num = read32(offset);
        const den = read32(offset + 4);
        return den !== 0 ? num / den : null;
      } catch { return null; }
    };

    // Tag IDs we care about (IFD0 + EXIF sub-IFD)
    const TAG_MAP = {
      0x010F: 'make',
      0x0110: 'model',
      0x0131: 'software',
      0x013B: 'artist',
      0x0132: 'dateTime',
      0x9003: 'dateTimeOriginal',
      0x9004: 'dateTimeDigitized',
      0x9290: 'subSecTime',
      0x9291: 'subSecTimeOriginal',
      0x8769: '_exifSubIFD',
      0x9000: 'exifVersion',
      0x829A: 'exposureTime',        // rational
      0x829D: 'fNumber',             // rational (aperture)
      0x8827: 'isoSpeedRating',      // short
      0x9202: 'aperture',            // rational (APEX)
      0x9201: 'shutterSpeed',        // rational (APEX)
      0x920A: 'focalLength',         // rational
      0xA405: 'focalLengthIn35mmFormat', // short
      0x9207: 'meteringMode',        // short
      0x9209: 'flash',               // short
      0xA402: 'exposureMode',        // short
      0xA403: 'whiteBalance',        // short
      0x8825: '_gpsSubIFD',
      // GPS (read in sub-IFD)
      0x0002: 'latitude',
      0x0004: 'longitude',
    };

    const parseIFD = (ifdOffset, isGps = false) => {
      if (ifdOffset + 2 >= buf.length) return;
      const entryCount = read16(ifdOffset);
      if (entryCount > 500) return; // sanity

      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        if (entryOffset + 12 > buf.length) break;

        const tag = read16(entryOffset);
        const type = read16(entryOffset + 2);
        const count = read32(entryOffset + 4);
        const valueOffset = entryOffset + 8;

        const name = TAG_MAP[tag];
        if (!name) continue;

        try {
          if (name === '_exifSubIFD' || name === '_gpsSubIFD') {
            const subOffset = read32(valueOffset);
            parseIFD(subOffset, name === '_gpsSubIFD');
            continue;
          }

          // Type 2 = ASCII string
          if (type === 2) {
            const dataOffset = count <= 4 ? valueOffset : read32(valueOffset);
            if (dataOffset + count <= buf.length) {
              result[name] = readString(dataOffset, count);
            }
          }
          // Type 1 = BYTE, Type 3 = SHORT, Type 4 = LONG
          else if (type === 3 && count === 1) {
            result[name] = read16(valueOffset);
          } else if (type === 4 && count === 1) {
            result[name] = read32(valueOffset);
          }
          // Type 5 = RATIONAL
          else if (type === 5) {
            const dataOffset = read32(valueOffset);
            result[name] = readRational(dataOffset);
          }
          // Type 7 = UNDEFINED (e.g., ExifVersion stored as "0230")
          else if (type === 7 && name === 'exifVersion') {
            const dataOffset = count <= 4 ? valueOffset : read32(valueOffset);
            if (dataOffset + count <= buf.length) {
              result[name] = buf.slice(dataOffset, dataOffset + count).toString('ascii');
            }
          }
        } catch {
          // Skip malformed tag
        }
      }
    };

    parseIFD(ifd0Offset);
  } catch {
    // Tolerate corrupt EXIF
  }
};

// ══════════════════════════════════════════════
//  MAIN ANALYSIS FUNCTION
// ══════════════════════════════════════════════

/**
 * Analyze image metadata to classify as AI-generated or real camera capture.
 *
 * @param {Buffer} imageBuffer — raw image bytes
 * @returns {Promise<AnalysisResult>}
 *
 * @typedef {object} AnalysisResult
 * @property {'AI_GENERATED'|'REAL_CAMERA'|'UNCERTAIN'} classification
 * @property {number} aiProbability   — 0–100
 * @property {number} realProbability — 0–100
 * @property {number} confidence      — 0–100 (certainty of classification)
 * @property {Signal[]} signals       — list of evaluated signals
 * @property {object}  metadataFingerprint — raw extracted metadata
 * @property {object}  imageStats     — width, height, format, etc.
 */
const analyzeImageMetadata = async (imageBuffer) => {
  // ── 1. Extract image stats via sharp ──
  let sharpStats = {};
  try {
    const img = sharp(imageBuffer);
    const meta = await img.metadata();
    sharpStats = {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      channels: meta.channels,
      depth: meta.depth,
      density: meta.density,
      hasAlpha: meta.hasAlpha,
      isProgressive: meta.isProgressive,
      chromaSubsampling: meta.chromaSubsampling,
      orientation: meta.orientation,
    };
  } catch (err) {
    // sharp failed — non-fatal
    sharpStats = { error: err.message };
  }

  // ── 2. Extract EXIF from raw buffer ──
  const exifMeta = parseExifFromBuffer(imageBuffer);

  // Combine
  const metadataFingerprint = { ...sharpStats, ...exifMeta };

  // ── 3. Score each signal ──
  let totalAiScore = 0;
  const scoredSignals = SIGNALS.map((signal) => {
    let triggered = false;
    try {
      triggered = signal.check(metadataFingerprint, sharpStats);
    } catch {
      triggered = false;
    }

    const score = triggered ? signal.aiScore : 0;
    totalAiScore += score;

    return {
      id: signal.id,
      label: signal.label,
      weight: signal.weight,
      triggered,
      score,
      detail: triggered ? signal.detail : null,
    };
  });

  // ── 4. Compute probabilities ──
  const rawAiProb = (totalAiScore / MAX_AI_SCORE) * 100;
  const aiProbability = parseFloat(rawAiProb.toFixed(1));
  const realProbability = parseFloat((100 - aiProbability).toFixed(1));

  // ── 5. Classify ──
  let classification;
  let confidence;

  if (aiProbability >= 70) {
    classification = 'AI_GENERATED';
    confidence = parseFloat(Math.min(aiProbability + 5, 100).toFixed(1));
  } else if (aiProbability <= 35) {
    classification = 'REAL_CAMERA';
    confidence = parseFloat(Math.min(realProbability + 5, 100).toFixed(1));
  } else {
    classification = 'UNCERTAIN';
    // Confidence scales with distance from the 50% midpoint
    const distFromMid = Math.abs(aiProbability - 52.5);
    confidence = parseFloat((40 + distFromMid).toFixed(1));
  }

  // ── 6. Build triggered signal list (sorted by score desc) ──
  const triggeredSignals = scoredSignals
    .filter((s) => s.triggered)
    .sort((a, b) => b.score - a.score);

  const allSignals = scoredSignals.sort((a, b) => b.weight - a.weight);

  return {
    classification,
    aiProbability,
    realProbability,
    confidence,
    totalAiScore,
    maxPossibleScore: MAX_AI_SCORE,
    triggeredSignalCount: triggeredSignals.length,
    totalSignalCount: SIGNALS.length,
    signals: allSignals,
    triggeredSignals,
    metadataFingerprint,
    imageStats: sharpStats,
    analyzedAt: new Date().toISOString(),
  };
};

// ══════════════════════════════════════════════
//  HELPERS — parse base64 to buffer safely
// ══════════════════════════════════════════════

/**
 * Accept either a raw Buffer or a base64 string (with or without data-URI prefix).
 * @param {Buffer|string} input
 * @returns {Buffer}
 */
const toBuffer = (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') {
    const cleaned = input.replace(/^data:image\/[a-z+]+;base64,/, '');
    return Buffer.from(cleaned, 'base64');
  }
  throw new Error('Invalid image input — expected Buffer or base64 string');
};

module.exports = { analyzeImageMetadata, toBuffer, SIGNALS, MAX_AI_SCORE };
