# 🔬 A.U.R.A. - Forensic Engine & Machine Learning Architecture

This document presents the detailed mathematical and algorithmic specification of the **A.U.R.A. Forensic Engine and Machine Learning Suite** located in [`backend/utils/`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils) and [`backend/analyzers/`](file:///d:/Projects/Java_Script/Apps/AURA/backend/analyzers).

---

## 📐 Forensic Pipeline Overview

A.U.R.A. evaluates digital media using a **5-stage multi-modal forensic pipeline**:

```
[ Uploaded Media Buffer ]
         │
         ├───► Stage 1: EXIF Metadata Extraction & 13-Dim KNN Classifier (k=5)
         │
         ├───► Stage 2: Visual ML Pixel Analysis (Noise Energy, Block Var, Edges)
         │
         ├───► Stage 3: Error Level Analysis (ELA Re-compression Variance)
         │
         ├───► Stage 4: Screen Recapture Moire & Luminance Forensics
         │
         └───► Stage 5: Parallel Groq VLM Vision & Screen-Replay Inspection
         │
         ▼
[ Multi-Engine Fusion & Override Rules ] ──► [ AURA Flag & Cryptographic SHA-256 Ledger Seal ]
```

---

## 📚 Dedicated Verification Layer Guides

For full technical specifications of each verification stage, refer to the dedicated guides below:

1. [📜 **Layer 1: EXIF Metadata & Hardware Fingerprint Forensics**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_1_EXIF_METADATA_KNN.md)
2. [👁️ **Layer 2: Visual ML Pixel-Level Forensics**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_2_VISUAL_ML_PIXEL_FORENSICS.md)
3. [🧪 **Layer 3: Error Level Analysis (ELA)**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_3_ERROR_LEVEL_ANALYSIS.md)
4. [📺 **Layer 4: Optical Screen Recapture & Moire Defense**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_4_SCREEN_RECAPTURE_DEFENSE.md)
5. [🤖 **Layer 5: Groq VLM Vision & Replay Engine**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_5_GROQ_VLM_VISION_ENGINE.md)
6. [📡 **Layer 6: Hardware Sensor & Telemetry Defense**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_6_HARDWARE_SENSOR_TELEMETRY.md)
7. [🔐 **Layer 7: Cryptographic Ledger & SHA-256 Watermark Sealing**](file:///d:/Projects/Java_Script/Apps/AURA/docs/verification_layers/LAYER_7_CRYPTOGRAPHIC_LEDGER_SEAL.md)

---

## 1. Metadata KNN Model ($k=5$)

Located in [`backend/utils/metadataAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/metadataAnalyzer.js).

### 13-Dimensional Feature Vector Format

Every image submitted to A.U.R.A. is parsed via `exifr` into a binary feature vector $\mathbf{v} \in \{0, 1\}^{13}$:

| Dim Index | Feature Name | Description | Real Camera Typical | AI Generator Typical |
| :---: | :--- | :--- | :---: | :---: |
| `[0]` | `hasCameraMake` | `Make` EXIF tag present (e.g., Apple, Canon, Sony) | `1` | `0` |
| `[1]` | `hasCameraModel` | `Model` EXIF tag present (e.g., iPhone 15, EOS R5) | `1` | `0` |
| `[2]` | `hasShutterSpeed` | `ExposureTime` or `ShutterSpeedValue` tag present | `1` | `0` |
| `[3]` | `hasAperture` | `FNumber` or `ApertureValue` tag present | `1` | `0` |
| `[4]` | `hasISO` | `ISO` or `ISOSpeedRatings` tag present | `1` | `0` |
| `[5]` | `hasGPS` | `GPSLatitude` / `GPSLongitude` present | `1` or `0` | `0` |
| `[6]` | `hasXmpPrompt` | XMP metadata contains AI prompt fields (`prompt`, `workflow`) | `0` | `1` |
| `[7]` | `isPowerOf2Dims` | Image dimensions are power of 2 (512x512, 1024x1024) | `0` | `1` |
| `[8]` | `isSquare` | Aspect ratio exactly 1:1 ($W = H$) | `0` | `1` |
| `[9]` | `hasKnownAiSw` | Software tag contains "Midjourney", "Stable Diffusion", etc. | `0` | `1` |
| `[10]` | `hasFocalLength` | `FocalLength` tag present | `1` | `0` |
| `[11]` | `hasFlash` | `Flash` trigger status tag present | `1` or `0` | `0` |
| `[12]` | `hasExifVersion` | `ExifVersion` standard header tag present | `1` | `0` |

### KNN Classification Algorithm
The vector $\mathbf{v}$ is evaluated against the `TRAINING_DATA` array containing ground-truth vectors $\{\mathbf{x}_i, y_i\}_{i=1}^N$ where $y_i \in \{0 = \text{REAL\_CAMERA}, 1 = \text{AI\_GENERATED}\}$.

1. Compute Euclidean Distance to all training samples:
   $$d(\mathbf{v}, \mathbf{x}_i) = \sqrt{ \sum_{j=0}^{12} (v_j - x_{i,j})^2 }$$
2. Sort training samples by distance $d$ in ascending order and select top $K=5$ nearest neighbors.
3. Calculate the metadata AI probability:
   $$P_{\text{meta}}(\text{AI}) = \frac{1}{K} \sum_{k=1}^{K} y_{(k)}$$

---

## 2. Visual ML Engine (Pixel-Level Forensics)

Located in [`backend/utils/visualMLAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/visualMLAnalyzer.js).

The visual analyzer inspects raw RGB pixel buffers extracted via `sharp`:

### A. Noise Energy Analysis
Physical camera sensors exhibit Poisson-Gaussian photon shot noise and read noise. AI generators generate oversmoothed pixel regions or uniform Gaussian noise.
- The image is split into 16x16 pixel sub-blocks.
- Compute local pixel variance $\sigma^2_b$ for each block.
- **Low Noise Energy ($\text{Variance} < 12.0$)** indicates synthetic AI oversmoothing.

### B. Compression Block Variance (8x8 JPEG Grid)
JPEG compression operates on 8x8 discrete cosine transform (DCT) blocks.
- Real camera photos processed by hardware image signal processors (ISP) exhibit consistent grid boundary variances.
- Synthetic AI images lack authentic ISP quantization matrices, creating abnormal block edge variances $\Delta B$.

### C. Chromatic Aberration & Lens Dispersion
Real camera lenses suffer from wavelength-dependent refraction, causing slight color fringe displacement between Red and Blue channels along high-contrast edges.
- Compute gradient intensity $\nabla I_R$ and $\nabla I_B$.
- Calculate channel displacement metric $C_{\text{disp}} = |\nabla I_R - \nabla I_B|$.
- Absolute zero chromatic dispersion across sharp edges indicates synthetic rendering.

---

## 3. Error Level Analysis (ELA) Engine

Located in [`backend/utils/elaAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/elaAnalyzer.js).

Error Level Analysis detects digital manipulation and synthetic compositing by analyzing JPEG compression degradation.

```
Original Image Buffer ──► Save as JPEG @ 90% Quality ──► Re-compressed Buffer
         │                                                      │
         └───────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                   Compute Absolute Pixel Delta:
                 |Pixel_Original - Pixel_Recompressed|
                                 │
                                 ▼
                     ELA Variance Score (0 - 100)
```

- **Uniform Low ELA Variance**: Indicates uniform original image compression (Authentic Camera Capture).
- **Localized High ELA Variance**: Indicates edited, digitally modified, or AI-infilled image regions.

---

## 4. Screen Recapture & Replay Attack Defense

Located in [`backend/utils/screenRecaptureAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/screenRecaptureAnalyzer.js) & [`backend/controllers/proof.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/controllers/proof.js).

When an attacker attempts to pass off an existing photo or AI image by taking a picture of a monitor screen:

1. **Luminance Lift Detection**: Monitor displays have backlight emissions and lifted black levels. The engine samples pixel brightness:
   - If dark pixels ($<110$ brightness) exceed 15% of frame, and average brightness $\bar{Y} < 125$, the image is flagged for dark terminal or monitor display recapture.
2. **Moire Pattern Spatial Frequency**: Interference between the camera sensor subpixel grid and the monitor subpixel matrix creates high-frequency spatial periodicity.
3. **Chromatic Moire Fringes**: High color channel variance along regular grid intervals triggers a `RECAPTURED_SCREEN` warning flag.

---

## 5. Groq VLM Vision & Screen Replay Engine

Located in [`backend/analyzers/groqAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/analyzers/groqAnalyzer.js).

A.U.R.A. integrates Vision-Language Model capabilities via `groq-sdk` using the **`qwen/qwen3.8-27b`** model to execute parallel image forensics and dedicated screen-replay detection:

1. **Lazy Client Initialization**: Client instances are instantiated on-demand via `getGroqClient()`.
2. **Payload Protection**: Images exceeding 4MB are safely skipped to prevent network bottlenecks.
3. **Structured JSON Output & Parsing**:
   - `analyzeWithGroq(buffer)`: Returns `{ success, aiProbability, groqClassification, reasoning }`.
   - `analyzeScreenReplayWithGroq(buffer)`: Returns `{ success, isScreenReplay, confidence, reasoning }`.
   - Employs triple-tier JSON extraction (direct `JSON.parse`, markdown code fence stripping, and regex fallback extraction).
4. **Score Isolation**: Groq VLM scores are presented independently in the UI (`GroqScoreCard.js`) and NOT blended into the deterministic ML ensemble probability to guarantee verifiable physics metrics.

---

## 6. Multi-Engine Fusion & Priority #1 Flag Rules

### Priority #1 Override Rule: Screen Replay Attack Defense
If **ANY** of the following conditions are true:
- ML optical analysis returns `classification === 'SCREEN_RECAPTURE'` or `SCREEN_REPLAY`
- ML optical screen score $\text{ScreenScore} \ge 0.50$ (50%)
- Groq VLM screen replay analyzer returns `isScreenReplay === true`
- Mobile sensor telemetry flags magnet/light flicker defense failure

Then **`evaluatedFlag` IS IMMEDIATELY FORCED TO 🔴 RED** (`SCREEN RECAPTURE DETECTED`), overriding live camera capture mode and preventing authentic cryptographic seal generation.

### Classification Thresholds & AURA Flags

```
           0.0                        0.35                      0.65                      1.0
Flag:       │        🟢 GREEN         │       🟡 YELLOW         │         🔴 RED          │
Status:     │   AUTHENTIC_CAMERA      │   SUSPECTED_SYNTHETIC   │       AI_GENERATED      │
```

- **🟢 GREEN (`AUTHENTIC_CAMERA`)**: $P_{\text{final}} < 0.35$ AND hardware EXIF verified AND no screen replay detected.
- **🟡 YELLOW (`UNVERIFIED / SUSPECTED`)**: $0.35 \le P_{\text{final}} < 0.65$ or missing EXIF on external uploads.
- **🔴 RED (`AI_GENERATED / SCREEN_RECAPTURE`)**: $P_{\text{final}} \ge 0.65$ OR screen replay detected OR physical sensor violation.

### Cryptographic SHA-256 Ledger Sealing
When an image achieves 🟢 **GREEN** status, a cryptographic payload is constructed:
$$\text{ProofHash} = \text{SHA-256}(\text{MediaBuffer} \parallel \text{SensorTelemetry} \parallel \text{Timestamp})$$
The proof is assigned a formatted identifier `AURA-XXXXXX` and persisted to the MongoDB ledger or in-memory fallback cache.
