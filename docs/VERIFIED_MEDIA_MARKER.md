# 🛡️ A.U.R.A. Verified Media Marker & Re-Verification Protocol

## 📌 Overview

The **A.U.R.A. Verified Media Marker** is an anti-tamper visual and cryptographic sealing mechanism for physical camera captures. When an image successfully passes sensor-based physical telemetry verification, A.U.R.A. stamps a sleek, lower-third **Verified Proof Card** onto the photo canvas and registers the proof record in the A.U.R.A. ledger.

The marked image remains **re-verifiable** even after being shared across social media and messaging platforms (WhatsApp, Instagram, Telegram, Email, iMessage) where EXIF metadata is stripped.

---

## 🎨 Visual Marker Specification

The verified marker is rendered server-side using Node.js `sharp` and vector `SVG` overlays to guarantee pixel-perfect cross-platform rendering across all operating systems.

```text
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|                                    ORIGINAL PHOTO CANVAS                                |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
| [|] 🛡️ AURA VERIFIED | AUTHENTIC CAPTURE                           +------------------+ |
|     +-----------------------------------------+                     |                  | |
|     | PROOF ID: AURA-8F9A-2B4C-71D2           |                     |   SCANNABLE QR   | |
|     +-----------------------------------------+                     |       CODE       | |
|     19 AUG 2026 • 10:24 PM                                          |                  | |
|     ENVIRONMENTAL PHYSICS & SENSOR INTEGRITY SEALED                 +------------------+ |
+-----------------------------------------------------------------------------------------+
```

### Key Design Specs:
- **Card Dimensions**: `1080px × 180px` (standardized responsive overlay)
- **Background**: Deep obsidian glassmorphism (`rgba(8, 12, 22, 0.92)`)
- **Accent Theme**: Neon Green (`#00FF9D`) top border line & left vertical pill accent
- **Vector Icons**: 100% SVG path vectors for Shield + Checkmark (zero emoji font dependencies to prevent missing character boxes like `[01F6E1]`)
- **Proof ID Container**: Monospace pill badge (`PROOF ID: AURA-XXXX-XXXX-XXXX`)
- **Timestamp & Seal**: Human-readable date/time + `ENVIRONMENTAL PHYSICS & SENSOR INTEGRITY SEALED`
- **QR Code Box**: Framed dark container (`150px × 150px`) holding a high-resolution QR code pointing to `https://<AURA-DOMAIN>/verify/<PROOF_ID>`

---

## 🔐 Verification Security Model

Scanning a QR code or entering a Proof ID fetches the original sealed proof record from MongoDB. A.U.R.A. then validates the uploaded media's cryptographic hash against the original sealed proof hash.

```text
QR Scan / Proof ID Input
         │
         ▼
Find MongoDB Proof Record
         │
         ├─── Proof Record Found? ────► NO ───► ? UNVERIFIED MEDIA (Yellow)
         │
        YES
         │
         ▼
Validate Cryptographic Hash Match
(Uploaded Hash vs. Stored Sealed Hash)
         │
         ├─── Hash Matches Original? ─► YES ──► ✓ AUTHENTIC CAPTURE (Green)
         │
        NO
         │
         ▼
 ⚠ MEDIA MODIFIED (Red)
 (QR code copied to modified/edited image)
```

### Verification States:

| Verification Result | Badge / Flag | Explanation |
| :--- | :--- | :--- |
| **✓ AUTHENTIC CAPTURE** | 🟢 `GREEN` | Proof record found **AND** image hash matches original sealed capture. |
| **⚠ MEDIA MODIFIED** | 🔴 `RED` | Proof record found, but image hash **mismatches** (image edited or QR copied). |
| **? UNVERIFIED MEDIA** | 🟡 `YELLOW` | No valid proof record found in the ledger. |

---

## 📱 Phone Gallery Integration

The verified copy is saved into the user's mobile device gallery while preserving the original capture as a separate file.

### 3-Tier Fallback Hierarchy (`fileService.js`):
1. **Tier 1 (Standalone Build / Production APK)**: Creates an asset and organizes it into a dedicated **"AURA Verified"** album in the device gallery.
2. **Tier 2 (Expo Go Mode Fallback)**: Catches album restriction errors on Android 13/14 and saves the verified photo asset directly to the phone's **Photos / Gallery**.
3. **Tier 3 (Emergency Fallback)**: Calls `MediaLibrary.saveToLibraryAsync()` to guarantee successful saving across restricted sandboxes.

---

## 🔎 Multi-Method Verification Engine

The `VerificationScreen` supports 3 intuitive input tabs that funnel into the same backend validation engine:

### 1. 📁 Upload File
- Pick any photo from gallery.
- Computes SHA-256 hash.
- Checks A.U.R.A. ledger by hash.

### 2. 🔢 Enter Proof ID
- Text field formatted for `AURA-XXXX-XXXX-XXXX`.
- Queries MongoDB by Proof ID and validates image content.

### 3. 📷 Scan QR Code
- Built-in camera scanner (`CameraView`).
- Automatically detects QR code, extracts `AURA-XXXX-XXXX-XXXX`, and triggers instant verification.

---

## 🔌 API Endpoints Reference

### 1. Generate Proof & Marker
- **Endpoint**: `POST /api/media/generate-proof`
- **Request Body**:
  ```json
  {
    "mediaData": "<base64_image>",
    "sensorData": { "accelerometer": [], "gyroscope": [], "magnetometer": [], "light": [], "location": {}, "timestamp": {} },
    "metadata": { "deviceId": "DEVICE_123", "timestamp": "2026-08-19T22:00:00Z" }
  }
  ```
- **Response**: Returns `proof.id` (`AURA-XXXX-XXXX-XXXX`) and `proof.authenticatedImage` (watermarked base64 with Proof Card).

### 2. Verify Media
- **Endpoint**: `POST /api/media/verify`
- **Request Body**:
  ```json
  {
    "uploadedMediaHash": "<sha256_hash>",
    "proofId": "AURA-8F9A-2B4C-71D2",
    "metadata": { "fileName": "photo.jpg" }
  }
  ```
- **Response**: Returns 3-state `status` (`authentic`, `tampered`, or `unverified`), `confidence`, `auraFlag`, and `statusDetails`.

---

## 💻 Developer Testing Guide

### Fast Terminal Verification Test
Run the automated test script inside the `backend` folder:
```bash
cd backend
node -e "
const { watermarkImage, formatProofId, generateImageHash } = require('./utils/crypto.js');
const proofId = formatProofId();
console.log('Proof ID:', proofId);
const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
watermarkImage(dummyBase64, proofId, new Date().toISOString()).then(base64 => {
  console.log('Watermarked Base64 Length:', base64.length);
  console.log('Image Hash:', generateImageHash(base64));
  console.log('✅ ALL BACKEND FUNCTIONS WORKING!');
});
"
```
