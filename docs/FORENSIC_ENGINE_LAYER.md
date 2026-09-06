# 🔬 A.U.R.A. - Forensic & Machine Learning Engine Layer Documentation

This document provides a comprehensive technical overview of the **Forensic & Machine Learning Engine Layer** of the A.U.R.A. platform located in [`backend/utils/`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils) and [`backend/analyzers/`](file:///d:/Projects/Java_Script/Apps/AURA/backend/analyzers).

---

## 📐 Architecture & Multi-Modal Pipeline

The Forensic Engine evaluates digital media using a **5-stage multi-modal pipeline**:

```
[ Uploaded Media Buffer ]
         │
         ├───► Stage 1: EXIF Metadata 13-Dim KNN Classifier (k=5)
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
[ Priority #1 Flag Decision Engine ] ──► [ AURA Flag (GREEN/YELLOW/RED) ]
```

---

## 📁 Analyzer Modules Breakdown

### 1. Metadata KNN Classifier ([`metadataAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/metadataAnalyzer.js))
- Parses EXIF tags using `exifr`.
- Constructs a 13-dimensional binary feature vector $\mathbf{v} \in \{0, 1\}^{13}$:
  - Camera Make, Camera Model, Shutter Speed, Aperture, ISO, GPS, XMP Prompts, Power-of-2 Dims, Square Aspect Ratio, Known AI Software, Focal Length, Flash Status, Exif Version.
- Evaluates $\mathbf{v}$ against a ground-truth dataset using K-Nearest Neighbors ($K=5$) Euclidean distance:
  $$d(\mathbf{v}, \mathbf{x}_i) = \sqrt{\sum_{j=0}^{12} (v_j - x_{i,j})^2}$$

### 2. Visual ML Engine ([`visualMLAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/visualMLAnalyzer.js))
Inspects raw RGB pixel buffers extracted via `sharp`:
- **Noise Energy Analysis**: Computes 16x16 sub-block variance $\sigma^2_b$. Low variance ($<12.0$) indicates synthetic AI oversmoothing.
- **JPEG Compression Block Variance**: Measures 8x8 DCT grid boundary variance.
- **Chromatic Aberration**: Measures Red vs Blue edge gradient displacement $C_{\text{disp}} = |\nabla I_R - \nabla I_B|$. Synthetic AI renders lack optical lens chromatic dispersion.

### 3. Error Level Analysis Engine ([`elaAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/elaAnalyzer.js))
- Re-compresses image buffer at 90% JPEG quality and calculates absolute pixel error maps $|I_{\text{orig}} - I_{\text{recomp}}|$.
- High localized variance indicates digital editing or synthetic AI inpainting.

### 4. Screen Recapture Analyzer ([`screenRecaptureAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/screenRecaptureAnalyzer.js))
Detects screen replay spoofing attacks (re-photographing a photo or video on a laptop/TV/monitor screen):
- **Luminance Lift**: Identifies monitor backlight emission by sampling pixel brightness.
- **Moire Interference**: Measures spatial periodicity caused by camera sensor subpixels interfering with display subpixel grids.
- **Screen Score**: Generates `screenScore` ($0.0 - 1.0$). Scores $\ge 0.50$ trigger screen recapture flags.

### 5. Groq VLM Vision Analyzer ([`groqAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/analyzers/groqAnalyzer.js))
Leverages `groq-sdk` with model **`qwen/qwen3.8-27b`**:
- Executes parallel calls: `analyzeWithGroq(buffer)` and `analyzeScreenReplayWithGroq(buffer)`.
- Features lazy client initialization, 4MB payload limits, triple-tier JSON extraction, and non-blended score isolation.

---

## 🚨 Priority #1 Screen Replay RED Flag Override Engine

A.U.R.A. enforces a strict global override rule for screen replay attacks across both live capture mode and verification mode:

```javascript
const isScreenReplayAttack = Boolean(
  isRecaptured ||
  screenCaptureByML ||
  (mlAnalysis?.screenScore ?? 0) >= 0.50 ||
  resolvedGroq?.screenReplay?.isScreenReplay === true
);

if (isScreenReplayAttack || status === 'tampered' || aiProbability >= 70) {
  evaluatedFlag = 'RED'; // SCREEN RECAPTURE DETECTED
}
```

If a screen recapture attack is detected:
1. `evaluatedFlag` is strictly forced to **`🔴 RED`**.
2. Title is set to **`SCREEN RECAPTURE DETECTED`**.
3. Cryptographic authentic watermark seal generation is withheld.
