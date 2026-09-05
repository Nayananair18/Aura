# 📡 A.U.R.A. - REST API Specification

This document provides complete technical specifications for the **A.U.R.A. REST API**, detailing endpoints, HTTP methods, headers, request bodies, response formats, and error handling.

---

## 🌐 Server Base Information

- **Development Port**: `3001`
- **Default Base URL (Local)**: `http://localhost:3001`
- **Default Base URL (LAN)**: `http://<YOUR_LOCAL_IP>:3001`
- **Global Rate Limiter**: 100 requests per 15 minutes per IP (`/api/*`).

---

## 🔐 Request & Response Headers

### Required Request Headers
- `Content-Type: application/json` (for JSON payloads)
- `Content-Type: multipart/form-data` (for direct binary file uploads)

### Default Security Headers (Helmet Middleware)
- `X-DNS-Prefetch-Control: off`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`
- `X-Content-Type-Options: nosniff`

---

## 📑 Endpoints Summary Table

| Endpoint Path | Method | Purpose | Payload Type |
| :--- | :---: | :--- | :--- |
| [`/health`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#1-get-health) | `GET` | Server health & uptime check | None |
| [`/api/ping`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#2-get-apiping) | `GET` | Latency ping / connection heartbeat | None |
| [`/api/media/generate-proof`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#3-post-apimediagenerate-proof) | `POST` | Generate proof from media + sensor data | JSON / Multipart |
| [`/api/media/verify`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#4-post-apimediaverify) | `POST` | Verify media authenticity & ML forensics | JSON / Multipart |
| [`/api/media/analyze-metadata`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#5-post-apimediaanalyze-metadata) | `POST` | Extract EXIF & run 13-dim KNN classifier | JSON / Multipart |
| [`/api/media/decode-qr`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#6-post-apimediadecode-qr) | `POST` | Extract QR code payload from watermarked media | JSON |
| [`/api/verify/proof/:proofId`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#7-get-apiverifyproofproofid) | `GET` | Query stored proof record by Proof ID | URL Param |
| [`/api/verify/scan-qr`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#8-post-apiverifyscan-qr) | `POST` | Decode QR marker & verify against ledger | JSON |
| [`/api/verification/store`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#9-post-apiverificationstore) | `POST` | Store external verification audit log | JSON |
| [`/api/verification/history`](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md#10-get-apiverificationhistory) | `GET` | Retrieve list of recent verification audits | Query Params |

---

## 🔍 Detailed Endpoint Reference

### 1. `GET /health`
Returns the operational health status of the backend API server.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-01T17:00:00.000Z",
  "uptime": 342.15,
  "environment": "development"
}
```

---

### 2. `GET /api/ping`
Used by the React Native client to verify local network connectivity.

**Response `200 OK`**:
```json
{
  "status": "connected",
  "timestamp": "2026-09-01T17:00:00.000Z",
  "serverTime": 1788282000000
}
```

---

### 3. `POST /api/media/generate-proof`
Generates a cryptographic authenticity proof for captured media and hardware telemetry.

**Request Body (JSON)**:
```json
{
  "image": "data:image/jpeg;base64,...",
  "telemetry": {
    "accelerometer": { "x": 0.02, "y": 9.81, "z": 0.15 },
    "gyroscope": { "x": 0.001, "y": 0.002, "z": 0.000 },
    "light": 350.5
  },
  "metadata": {
    "captureTime": "2026-09-01T17:00:00.000Z",
    "location": { "latitude": 37.7749, "longitude": -122.4194 }
  }
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "proofId": "AURA-7F3A2B",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "status": "verified",
  "auraFlag": "GREEN",
  "classification": "AUTHENTIC_CAMERA",
  "confidence": 96.4,
  "integrityScore": 98.2,
  "sensorValidation": {
    "isValid": true,
    "confidence": 98.2
  },
  "watermarkedImage": "data:image/jpeg;base64,...",
  "persistedToDb": true
}
```

---

### 4. `POST /api/media/verify`
Performs full forensic inspection (Metadata KNN, Visual ML, ELA, Screen Recapture) on an uploaded image file.

**Request Body (JSON or Multipart Form)**:
```json
{
  "mediaData": "data:image/jpeg;base64,..."
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "verificationId": "v-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d",
  "status": "verified",
  "auraFlag": "GREEN",
  "classification": "AUTHENTIC_CAMERA",
  "confidence": 94.8,
  "signals": [
    {
      "id": "missing_camera_make",
      "label": "No Camera Manufacturer",
      "present": false
    },
    {
      "id": "missing_camera_model",
      "label": "No Camera Model",
      "present": false
    }
  ],
  "mlAnalysis": {
    "knnProbability": 0.04,
    "visualProbability": 0.08,
    "elaScore": 12.3,
    "isScreenRecapture": false
  }
}
```

---

### 5. `POST /api/media/analyze-metadata`
Parses raw EXIF metadata and executes the 13-dimensional KNN classifier.

**Request Body (JSON)**:
```json
{
  "mediaData": "data:image/jpeg;base64,..."
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "isAiGenerated": false,
  "aiProbability": 0.02,
  "knnClassification": "REAL_CAMERA",
  "featureVector": [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
  "parsedMetadata": {
    "make": "Apple",
    "model": "iPhone 15 Pro",
    "exposureTime": 0.008,
    "fNumber": 1.78,
    "iso": 80,
    "focalLength": 6.86
  }
}
```

---

### 6. `GET /api/verify/proof/:proofId`
Looks up an existing proof record by proof ID (e.g. `AURA-7F3A2B`).

**Response `200 OK`**:
```json
{
  "success": true,
  "status": "verified",
  "auraFlag": "GREEN",
  "classification": "AUTHENTIC_CAMERA",
  "matchPercentage": 100,
  "proof": {
    "proofId": "AURA-7F3A2B",
    "hash": "e3b0c44298...",
    "confidence": 96.4,
    "createdAt": "2026-09-01T17:00:00.000Z"
  },
  "message": "A.U.R.A. Certified Proof Verified in Ledger"
}
```

**Response `404 Not Found`**:
```json
{
  "success": false,
  "proofFound": false,
  "message": "Proof ID not found in ledger"
}
```

---

## ⚠️ Standard Error Responses

All error responses adhere to the following standard JSON error contract:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Media payload is required"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again after 15 minutes."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal Server Error",
  "error": {
    "message": "Detailed error message (only in development mode)"
  }
}
```
