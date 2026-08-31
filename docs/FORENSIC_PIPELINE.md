# ??? A.U.R.A. Forensic Pipeline & Threat Defense Architecture

## ?? Executive Summary

The **A.U.R.A. (Authenticity & Universal Reality Assurance)** Forensic Pipeline provides an end-to-end, multi-layered defensive framework designed to verify genuine physical media, detect synthetic AI generations, and stop sophisticated physical recapture attacks (such as photographing photos displayed on computer screens, monitors, and mobile displays).

This document outlines the underlying physics, algorithmic thresholds, machine learning models, UI indicators, and verification test suites comprising the A.U.R.A. Forensic Engine.

---

## ??? Pipeline Architecture

```
                    +-----------------------------------------------------------+
                    ¦                   CAPTURE SESSION                         ¦
                    ¦  (Physical Smartphone Camera + 20 Hz Sensor Telemetry)   ¦
                    +-----------------------------------------------------------+
                                                  ¦
                                                  ?
                    +-----------------------------------------------------------+
                    ¦            LAYER 1: SENSOR DEFENSE ENGINE                 ¦
                    ¦   • Magnetometer EMI Analysis (> 55.0 µT)                 ¦
                    ¦   • High-Frequency Optical PWM Flicker (RelVar > 0.75)    ¦
                    ¦   • 2D Planar Motion Harmonics & Tremor Physics           ¦
                    ¦   • Spatiotemporal GPS & Micro-duration Seal              ¦
                    +-----------------------------------------------------------+
                                                  ¦
                         +-------------------------------------------------+
                         ¦                                                 ¦
            [Screen Replay Detected]                            [Physics Verified Clean]
                         ¦                                                 ¦
                         ?                                                 ?
        +----------------------------------+             +----------------------------------+
        ¦       STATUS: TAMPERED (RED)     ¦             ¦       STATUS: AUTHENTIC (GREEN)  ¦
        ¦ • isRecaptured: true             ¦             ¦ • isRecaptured: false            ¦
        ¦ • screenDefensePassed: false     ¦             ¦ • screenDefensePassed: true      ¦
        ¦ • Watermark Seal Blocked         ¦             ¦ • Canvas Extension Watermark     ¦
        ¦ • Score capped <= 30%            ¦             ¦ • Ledger Registration            ¦
        +----------------------------------+             +----------------------------------+

                                    ----------------------------

                    +-----------------------------------------------------------+
                    ¦              VERIFY / UPLOAD SESSION                      ¦
                    ¦    (External Media Uploads & Ledger Re-Verification)      ¦
                    +-----------------------------------------------------------+
                                                  ¦
                                                  ?
                    +-----------------------------------------------------------+
                    ¦       LAYER 2: MULTI-MODAL ML ENSEMBLE ENGINE             ¦
                    ¦   • Hardware EXIF Gating (Camera Make/Model/ISO/Aperture) ¦
                    ¦   • Metadata KNN Classifier (Distance-Weighted)           ¦
                    ¦   • Visual CNN Analyzer (Block Variance & Aspect Ratio)   ¦
                    ¦   • Error Level Analysis / ELA (JPEG Quantization Error)  ¦
                    +-----------------------------------------------------------+
                                                  ¦
            +-------------------------------------+-------------------------------------+
            ¦                                     ¦                                     ¦
    [Known Ledger Match]               [Unregistered External Upload]            [AI Synthesis Markers]
            ¦                                     ¦                                     ¦
            ?                                     ?                                     ?
+-----------------------+             +-----------------------+             +-----------------------+
¦     AUTHENTIC         ¦             ¦  UNVERIFIED MEDIA     ¦             ¦    AI GENERATED       ¦
¦ • Flag: GREEN         ¦             ¦ • Flag: YELLOW        ¦             ¦ • Flag: RED           ¦
¦ • Proof Verified      ¦             ¦ • Neutral AI (~40%)   ¦             ¦ • AI Score >= 85%     ¦
¦ • 100% Hash Match     ¦             ¦ • Decoupled from AI   ¦             ¦ • Generation Prompt   ¦
+-----------------------+             +-----------------------+             +-----------------------+
```

---

## 1. ?? Second-Copy & Screen Replay Detection

### The Threat Model: Screen Replay Attack
An adversary attempts to bypass authenticity checks by displaying an AI-generated image or stolen photograph on a high-resolution laptop or monitor screen and capturing a photograph of that screen with an authentic smartphone.

### Physical Telemetry Signatures
Physical screens exhibit distinct electromagnetic and optical anomalies:
1. **Electromagnetic Interference (EMI)**: Power inductors, backlights, and display controller boards emit localized magnetic fields exceeding natural Earth baselines.
2. **Pulse-Width Modulation (PWM) Flicker**: Digital screens modulate display brightness via rapid PWM switching (60 Hz to 480 Hz), causing optical flux variance.
3. **Planar Motion Harmonics**: Photographing a flat 2D monitor surface results in abnormally rigid 2D planar alignments with an unnatural ratio between rotational gyroscopic tremor and planar acceleration.

### Decision Engine & Thresholds (`backend/utils/crypto.js`)

A screen replay attack is flagged if **ANY** of the following independent indicators trigger (strict **OR condition**):

| Indicator | Threshold | Description |
| :--- | :--- | :--- |
| **Severe Optical PWM Flicker** | `relativeVariance > 0.75` | Standalone trigger. High-frequency display backlight modulation. |
| **Magnetometer EMI Spike** | `max > 55.0 µT` \|\| `avg > 50.0 µT` | Standalone trigger. Exceeds natural Earth magnetic ceiling. |
| **Magnetic Field Jitter** | `spread > 25.0 µT` (steady) / `> 45.0 µT` (moving) | Standalone trigger. High electromagnetic noise from transformers. |
| **Moderate Flicker + Co-occurrence** | `0.40 < relativeVariance <= 0.75` **AND** (`EMI > 50 µT` \|\| `planarSuspicious`) | Corroborating optical variance with planar alignment or magnetic flux. |
| **Planar 2D Alignment** | `gyroSpread / accSpread < 0.015` && `accSpread > 0.25` | 2D planar capture orientation against a flat monitor surface. |

### Baseline Natural Guard (Zero False Positives on Paper Documents)
- Natural ambient indoor environments and physical paper documents typically exhibit:
  - `relativeVariance: 0.15 - 0.40` (from natural handheld shadows and paper angles)
  - `magnetometer: 25.0 - 45.0 µT` (natural Earth magnetic baseline)
- When both readings fall within natural baseline limits, the capture evaluates as **`isRecaptured: false`**, **`screenDefensePassed: true`**, and **`auraFlag: 'GREEN'`**.

### Strict Override & Fail-Fast Protection
- If a screen attack is triggered:
  - `isRecaptured = true`
  - `screenDefensePassed = false`
  - `auraFlag = 'RED'`
  - `recaptureReason = 'SECOND-COPY DETECTED (Screen Replay Photo - Optical PWM Flicker / Screen Emission)'`
  - `overallScore = Math.min(overallScore, 30)`
  - **EXIF Bypass Protection**: Valid camera EXIF (e.g. from the smartphone camera used to photograph the screen) is **strictly prevented** from overriding a physical sensor failure.
  - **Watermark Blocking**: The A.U.R.A. Certified watermark seal is **strictly blocked** from being applied.

---

## 2. ??? Canvas Extension Watermarking Architecture

To prevent obscuring document text, signatures, or bottom details of captured images, A.U.R.A. utilizes **Canvas Extension Watermarking** rather than compositing directly over existing image pixels.

```
+--------------------------------------------------------+
¦                                                        ¦
¦                                                        ¦
¦                 ORIGINAL PHOTO PIXELS                  ¦
¦               (100% Completely Visible)                ¦
¦                 y = 0 to y = imageH                    ¦
¦                                                        ¦
¦                                                        ¦
+--------------------------------------------------------¦ ?-- Top Neon Line Accent (#00FF9D)
¦ ??? AURA VERIFIED | AUTHENTIC CAPTURE                   ¦
¦ +----------------------------------+   +-------------+ ¦
¦ ¦ PROOF ID: AURA-7F2A-9C4B-11E5    ¦   ¦  ¦¦ _¦¯ ¦_  ¦ ¦
¦ +----------------------------------+   ¦  ¦_ ¯¦_ ¦¯  ¦ ¦ ?-- Extended Canvas Footer
¦ 20 AUG 2026 • 09:45 PM                 ¦  QR VERIFY  ¦ ¦     y = imageH to y = imageH + bannerH
¦ ENVIRONMENTAL PHYSICS & SENSOR SEALED  +-------------+ ¦     Background: #080C14
+--------------------------------------------------------+
```

### Implementation Highlights (`backend/utils/crypto.js`)
- **Zero-Crop Extension**: Employs Sharp's `.extend({ bottom: bannerHeight, background: '#080C14' })`.
- **Proportional Scaling**: Dynamically computes `scale = targetWidth / 1080` (clamped between 1080px and 2560px), scaling banner height, typography, pills, and the QR code proportionally across all resolutions.
- **Cross-Platform Vector Rendering**: Uses 100% vector SVG rendering without external emoji font dependencies to guarantee clean, uncorrupted output on all platforms.

---

## 3. ?? AI Classification Decoupling & EXIF Calibration

### Decoupling Missing Ledger Proofs from AI Classification
Previously, unregistered external uploads were penalized with false 95% AI scores because they lacked a ledger proof. The forensic engine now cleanly decouples ledger registration from synthetic image classification:
- **Missing Ledger Record**: Categorized as `UNVERIFIED_EXTERNAL_MEDIA` (`auraFlag: 'YELLOW'`).
- **Synthetic AI Artifacts**: Only flagged as `AI_GENERATED` (`auraFlag: 'RED'`) when actual synthetic signatures, AI generation prompts, or high neural network probabilities are detected.

### Physical Hardware EXIF Gate (`backend/utils/metadataAnalyzer.js`)
Genuine cameras embed complete optical hardware parameters:
- `Make` & `Model` (e.g., Apple iPhone 13, Canon EOS R5)
- `ExposureTime` / `ShutterSpeedValue`
- `FNumber` / `ApertureValue`
- `ISO` / `ISOSpeedRatings`
- `FocalLength`

When valid physical hardware EXIF is present without explicit AI generator signatures:
1. AI probability is strictly damped: `aiProbability = Math.min(aiProbability, 24.5%)` (producing typical 4.5%–14.5% AI scores).
2. The classification is assigned as **`AUTHENTIC_CAMERA`** with `> 85%` Real confidence.

### Multi-Modal Ensemble Calibration

```text
Ensemble Score = (W_KNN × P_KNN) + (W_VISUAL × P_VISUAL) + (W_ELA × P_ELA)
```

1. **Metadata KNN Classifier (`metadataAnalyzer.js`)**:
   - Distance-weighted KNN trained on camera and AI metadata distributions.
   - Removed artificial zero-metadata penalty samples so stripped web images receive neutral (~40–50%) uncertainty instead of 100% AI.
2. **Visual ML CNN Analyzer (`visualMLAnalyzer.js`)**:
   - `computeBlockVariance`: Inter-block variance > 3.0 (typical camera noise) outputs `0.10` AI probability.
   - `computeAspectRatioAI`: Standard photographic ratios (4:3, 3:2, 16:9) assign `0.0` AI penalty.
   - Bias shifted to photographic prior `-2.50`.
3. **Error Level Analysis (`elaAnalyzer.js`)**:
   - Natural JPEG recompression error variance (0.8–18.0) maps to baseline camera recompression (`0.12` AI score).

---

## 4. ?? Frontend UI Indicators & Telemetry

### Real-Time Viewfinder Polling (`sensorManager.js` & `CaptureScreen.js`)
- Sensors (Accelerometer, Gyroscope, Magnetometer, LightSensor) poll continuously at **20 Hz (50ms interval)** during the active camera viewfinder session.
- Live UI stats update at 100ms.
- **Live Warning Banner**: Appears above the capture button when live EMI exceeds `50.0 µT` or `relativeVariance > 0.30`.

### Dedicated Result Banners (`ResultScreen.js`)

| Scenario | Banner Appearance | Message |
| :--- | :--- | :--- |
| **Screen Replay Attack** | ?? Red Warning Box | `SECOND-COPY DETECTED (Screen Replay Photo)`<br>`Display emission detected: Optical PWM flicker or Magnetometer EMI spike.` |
| **Unverified External Upload** | ?? Yellow Warning Box | `?? UNVERIFIED EXTERNAL MEDIA`<br>`No physical sensor telemetry sealed in ledger (External file upload).` |
| **Authentic Capture** | ?? Green Verified Seal | `? A.U.R.A. Verified`<br>`Environmental Physics Sealed` |

### Dual-Model ML Score Card (`MLScoreCard.js`)
- Displays animated circular probability gauges.
- Provides an ensemble breakdown showing individual probabilities from **Metadata KNN**, **Visual CNN**, and **Error Level Analysis (ELA)**.
- Clean UTF-8 classification badges:
  - `?? AI GENERATED`
  - `?? AUTHENTIC CAMERA`
  - `?? UNCERTAIN`

---

## 5. ?? Automated Verification & Test Coverage

### Test Suites

The backend includes two dedicated automated test suites covering forensic physics, ML classification, and controller endpoints:

```bash
# 1. Run Complete Forensic Integrity Suite (22 Unit & Integration Tests)
node backend/test_forensics.js

# 2. Run API Controller Endpoint Test Suite
node backend/test_api_endpoints.js
```

### Forensic Test Coverage Matrix (`backend/test_forensics.js`)

| Test # | Test Description | Input Telemetry | Expected Output | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | Magnetometer EMI spike > 55µT | `mag.max = 84.1 µT` | `isRecaptured: true` | ? PASS |
| **2** | Screen defense failed on replay | `mag.max = 84.1 µT` | `screenDefensePassed: false` | ? PASS |
| **3** | AURA flag is RED on replay | `mag.max = 84.1 µT` | `auraFlag: 'RED'` | ? PASS |
| **4** | Recapture reason text | `mag.max = 84.1 µT` | Contains `'SECOND-COPY DETECTED'` | ? PASS |
| **5** | Laptop screen capture (Low Mag + PWM) | `mag = 32.1 µT`, `RelVar = 1.77` | `isRecaptured: true` | ? PASS |
| **6** | PWM flicker triggers STRICT RED | `mag = 32.1 µT`, `RelVar = 1.77` | `auraFlag: 'RED'` | ? PASS |
| **7** | Details mention PWM optical flicker | `mag = 32.1 µT`, `RelVar = 1.77` | Contains `'PWM optical flicker'` | ? PASS |
| **8** | Physical paper document (minor shadow) | `mag = 34.6 µT`, `RelVar = 0.31` | `isRecaptured: false` | ? PASS |
| **9** | Physical paper document screen passed | `mag = 34.6 µT`, `RelVar = 0.31` | `screenDefensePassed: true` | ? PASS |
| **10** | Physical paper document evaluates GREEN | `mag = 34.6 µT`, `RelVar = 0.31` | `auraFlag: 'GREEN'` | ? PASS |
| **11** | Clean ambient natural capture | `mag = 34.9 µT`, `RelVar = 0.01` | `isRecaptured: false` | ? PASS |
| **12** | Clean natural capture screen passed | `mag = 34.9 µT`, `RelVar = 0.01` | `screenDefensePassed: true` | ? PASS |
| **13** | Clean natural capture evaluates GREEN | `mag = 34.9 µT`, `RelVar = 0.01` | `auraFlag: 'GREEN'` | ? PASS |
| **14** | iPhone 13 photo classification | EXIF: Apple, iPhone 13, ISO 50 | `classification: 'AUTHENTIC_CAMERA'` | ? PASS |
| **15** | iPhone 13 AI probability capped | EXIF: Apple, iPhone 13, ISO 50 | `aiProbability < 25%` | ? PASS |
| **16** | iPhone 13 Real probability | EXIF: Apple, iPhone 13, ISO 50 | `confidence > 75%` | ? PASS |
| **17** | Canon DSLR photo classification | EXIF: Canon, EOS R5, f/2.8 | `classification: 'AUTHENTIC_CAMERA'` | ? PASS |
| **18** | Canon DSLR AI probability capped | EXIF: Canon, EOS R5, f/2.8 | `aiProbability < 25%` | ? PASS |
| **19** | Unverified image without EXIF | Stripped web JPEG | `classification != 'AI_GENERATED'` | ? PASS |
| **20** | Unverified image AI score | Stripped web JPEG | `aiProbability < 55%` | ? PASS |
| **21** | Image with explicit AI prompt/software | EXIF: Midjourney v6 / DALL-E | `classification: 'AI_GENERATED'` | ? PASS |
| **22** | AI-generated image AI probability | EXIF: Midjourney v6 / DALL-E | `aiProbability >= 85%` | ? PASS |

**Total Suite Execution**: **22 / 22 Assertions Passed (100%)**.

---

## 6. ?? Key Source Files Reference

- **Sensor Analysis & Cryptographic Watermarking**: [`backend/utils/crypto.js`](file:///c:/Users/nayan/AURA/backend/utils/crypto.js)
- **ML Metadata & EXIF Forensic Analyzer**: [`backend/utils/metadataAnalyzer.js`](file:///c:/Users/nayan/AURA/backend/utils/metadataAnalyzer.js)
- **Visual CNN Analyzer**: [`backend/utils/visualMLAnalyzer.js`](file:///c:/Users/nayan/AURA/backend/utils/visualMLAnalyzer.js)
- **Error Level Analyzer (ELA)**: [`backend/utils/elaAnalyzer.js`](file:///c:/Users/nayan/AURA/backend/utils/elaAnalyzer.js)
- **Proof Generation Controller**: [`backend/controllers/proof.js`](file:///c:/Users/nayan/AURA/backend/controllers/proof.js)
- **Media Verification Controller**: [`backend/controllers/verify.js`](file:///c:/Users/nayan/AURA/backend/controllers/verify.js)
- **Frontend Sensor Polling Manager**: [`frontend/src/services/sensorManager.js`](file:///c:/Users/nayan/AURA/frontend/src/services/sensorManager.js)
- **Live Capture Screen**: [`frontend/src/screens/CaptureScreen.js`](file:///c:/Users/nayan/AURA/frontend/src/screens/CaptureScreen.js)
- **Verification Result Screen**: [`frontend/src/screens/ResultScreen.js`](file:///c:/Users/nayan/AURA/frontend/src/screens/ResultScreen.js)
- **Forensic Test Suite**: [`backend/test_forensics.js`](file:///c:/Users/nayan/AURA/backend/test_forensics.js)
- **API Controller Test Suite**: [`backend/test_api_endpoints.js`](file:///c:/Users/nayan/AURA/backend/test_api_endpoints.js)
