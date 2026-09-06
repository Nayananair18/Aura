# ⚡ A.U.R.A. - API & Web Server Layer Documentation

This document provides a comprehensive technical overview of the **API & Web Server Layer** of the A.U.R.A. platform located in [`backend/`](file:///d:/Projects/Java_Script/Apps/AURA/backend).

---

## 🏗️ Architecture & Server Stack

The API layer is built on **Node.js** and **Express 4**. It serves as the secure gateway handling incoming client verification requests, enforcing security headers, executing rate limits, coordinating parallel forensic analyzers, generating cryptographic proofs, and applying server-side watermarks.

### Core Technologies
- **Runtime**: Node.js v18+
- **HTTP Server**: Express `4.x`
- **Security Middleware**: `helmet`, `cors`, `express-rate-limit`
- **Payload Compression**: `compression` (Gzip / Brotli)
- **Image Compositing**: `sharp` (C++ libvips binding for high-speed watermarking & scaling)

---

## 📁 Directory & File Structure

```
backend/
├── server.js                   # Application entry point & HTTP listener setup
├── config/
│   └── config.js               # Environment variables, ports & rate limit configs
├── controllers/
│   ├── proof.js                # Cryptographic proof generation & watermark controller
│   └── verify.js               # Verification, metadata lookup & Groq VLM dispatcher
├── routes/
│   ├── media.js                # Router for /api/media/* endpoints
│   ├── verification.js         # Router for /api/verification/* endpoints
│   └── verify.js               # Router for /api/verify/* endpoints
└── utils/
    ├── logger.js               # Winston logging utility
    └── watermark.js            # Server-side A.U.R.A. Certified Seal compositor
```

---

## 🔒 Security & Middleware Configuration

1. **Helmet Header Protection**:
   - Disables prefetch headers.
   - Enforces `SAMEORIGIN` framing.
   - Enforces HSTS (`Strict-Transport-Security`).
   - Restricts MIME sniffing (`X-Content-Type-Options: nosniff`).

2. **Rate Limiting**:
   - Enforces 100 requests per 15-minute window per IP address on `/api/*` endpoints to prevent brute-force verification spam.

3. **Payload Protection**:
   - Restricts base64 media payloads to 40MB (`MAX_MEDIA_SIZE_BYTES`) to protect Node.js event loop and `sharp` image buffers from Out-Of-Memory (OOM) crashes.

---

## 📡 REST API Endpoint Specifications

### 1. `GET /health`
Returns server operational health status and uptime metrics.
- **Response**: `{ status: "ok", uptime: 342.1, environment: "production" }`

### 2. `GET /api/ping`
Handshake endpoint used by mobile apps to verify backend connectivity.
- **Response**: `{ status: "connected", timestamp: "...", serverTime: 1788282000000 }`

### 3. `POST /api/media/generate-proof`
Generates a cryptographic authenticity proof for captured media and hardware telemetry.
- **Workflow**:
  1. Converts base64 media to binary buffer.
  2. Runs parallel pixel ML forensics (`analyzeImageMetadata`), Groq VLM image inspection (`analyzeWithGroq`), and Groq screen replay detection (`analyzeScreenReplayWithGroq`).
  3. Evaluates screen recapture Moire and AI probability.
  4. If `finalAuraFlag === 'GREEN'`, applies server-side watermark seal via Sharp.
  5. Saves proof payload into MongoDB and in-memory ledger store (`ledgerStore.js`).
- **Response**: Returns proof document including `proofId`, `hash`, `auraFlag`, `status`, `mlAnalysis`, and `groq`.

### 4. `POST /api/media/analyze-metadata`
Extracts EXIF metadata, computes the 13-feature KNN vector, and runs parallel Groq VLM analyzers.
- **Response**:
```json
{
  "success": true,
  "analysis": {
    "classification": "REAL_CAMERA",
    "aiProbability": 2.5,
    "confidence": 97.5,
    "screenScore": 0.05
  },
  "groq": {
    "imageAnalysis": {
      "success": true,
      "aiProbability": 5.0,
      "groqClassification": "REAL_CAMERA"
    },
    "screenReplay": {
      "success": true,
      "isScreenReplay": false,
      "confidence": 98.0
    }
  }
}
```

### 5. `POST /api/media/verify`
Compares an uploaded media hash or proof ID against the cryptographic ledger to verify if the file has been modified post-issuance.

---

## 🎨 Watermark Engine ([`watermark.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/watermark.js))

When an image achieves 🟢 **GREEN** flag status:
- `watermarkImage()` creates an SVG overlay featuring the official **A.U.R.A. Certified Authentic Seal**, Proof ID, timestamp, and verification QR code.
- Sharp composites the SVG onto the image buffer at full resolution without quality loss.
