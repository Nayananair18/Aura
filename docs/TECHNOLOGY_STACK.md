# 🛠️ A.U.R.A. - Technology Stack & Dependencies

This document provides a comprehensive technical breakdown of all programming languages, runtime environments, frameworks, libraries, database engines, computer vision tools, machine learning modules, and developer tooling utilized in **A.U.R.A.**

---

## 📊 Tech Stack Overview Table

| Layer | Primary Technologies | Version | Key Purpose |
| :--- | :--- | :--- | :--- |
| **Mobile Client** | React Native, Expo SDK | RN 0.81 / Expo 54 | Cross-platform mobile (iOS/Android) & web app UI |
| **Mobile Sensors** | `expo-sensors`, `expo-camera` | SDK 54 | 60Hz telemetry capture & camera image acquisition |
| **Frontend Crypto** | `crypto-js`, `expo-crypto` | v4.2 / v15.0 | Client-side SHA-256 media hashing |
| **Backend Runtime** | Node.js, Express | Node v18+ / Express v4.18 | Event-driven asynchronous REST API server |
| **Image Processing**| Sharp, Jimp | Sharp v0.34 / Jimp v1.6 | C++ libvips image manipulation, ELA, & watermarking |
| **Metadata Parser**| exifr | v7.1 | Fast EXIF, TIFF, XMP, and IPTC tag parsing |
| **Machine Learning**| TensorFlow.js, Custom KNN | TFJS v4.22 | Metadata KNN classification & visual deep learning |
| **QR Code Engine** | `jsqr`, `qrcode`, `react-native-qrcode-svg` | v1.4 / v1.5 / v6.3 | QR matrix encoding, decoding, and SVG rendering |
| **Database** | MongoDB, Mongoose ODM | Mongoose v8.0 | Document store for proofs & verification audit logs |
| **Security & Utilities**| Helmet, CORS, Rate Limit, Winston | Latest | HTTP security headers, rate limiting, Winston logging |
| **Build & Tooling** | Expo Application Services (EAS), Jest | EAS / Jest v29 | Mobile binary compilation, testing & hot-reload |

---

## 📱 Frontend Technology Stack (`/frontend`)

### Core Frameworks & Runtime
- **[React 19](https://react.dev/) & [React Native 0.81](https://reactnative.dev/)**: High-performance UI component library for native iOS/Android interfaces and web compilation (`react-native-web`).
- **[Expo SDK 54](https://docs.expo.dev/)**: Application framework managing cross-platform native capabilities, asset bundling, and Expo Go development.

### Navigation & UI Controls
- **`@react-navigation/native` (v7.2) & `@react-navigation/native-stack` (v7.14)**: Native stack navigation manager providing screen transitions between Splash, Home, Capture, Verification, and Result views.
- **`react-native-svg` (v15.12)**: Vector graphics rendering engine for gauge meters, custom icons, and interactive evidence indicators.

### Native Hardware Integrations (Expo Modules)
- **`expo-camera` (v17.0)**: Direct native camera hardware integration enabling live viewfinder previews, focus adjustment, flash trigger, and high-resolution picture capture.
- **`expo-sensors` (v15.0)**: Accesses physical device sensors at high polling rates (60Hz):
  - **Accelerometer**: 3D motion acceleration $(a_x, a_y, a_z)$.
  - **Gyroscope**: 3D rotation rates $(\omega_x, \omega_y, \omega_z)$.
  - **Magnetometer**: 3D magnetic field vector ($m_x, m_y, m_z$).
  - **Light Sensor / Barometer**: Ambient illuminance and barometric pressure tracking.
- **`expo-file-system` (v19.0)**: File reading and local URI manipulation for image buffers.
- **`expo-media-library` (v18.2)**: Reads and saves verified images to the mobile device photo gallery.
- **`expo-location` (v19.0)**: Reads optional GPS coordinates for geotag verification.
- **`expo-secure-store` (v15.0)**: Encrypted key-value storage for local session proof tokens.

### Client-Side Cryptography & Utilities
- **`crypto-js` (v4.2) & `expo-crypto` (v15.0)**: Client-side SHA-256 algorithm computing cryptographic hashes of media payloads prior to upload.
- **`axios` (v1.15)**: HTTP client configured with timeout handling and multipart/form-data payload dispatching.

---

## ⚡ Backend Technology Stack (`/backend`)

### Core Server Infrastructure
- **[Node.js (v18+)](https://nodejs.org/)**: Asynchronous, event-driven JavaScript runtime engine.
- **[Express (v4.18)](https://expressjs.com/)**: Fast, minimalist web framework hosting REST endpoints.
- **`body-parser` (v1.20)**: High-capacity JSON and URL-encoded body parser configured for large base64 image strings (up to 30MB).
- **`compression` (v1.8)**: Gzip/Brotli response payload compressor optimizing mobile bandwidth.

### Security & Rate Limiting
- **`helmet` (v7.1)**: Sets secure HTTP response headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP).
- **`cors` (v2.8)**: Manages cross-origin resource sharing for web client calls.
- **`express-rate-limit` (v8.3)**: Configures global IP rate limiting (`100 requests per 15 minutes`) and endpoint-specific limits to prevent brute-force attacks.

### Logging & Diagnostics
- **`winston` (v3.19)**: Enterprise logging framework with daily rotating file transports (`logs/combined.log`, `logs/error.log`) and formatted console outputs.
- **`morgan` (v1.10)**: HTTP request logger middleware integrated into Winston logging streams.

---

## 🔬 Computer Vision, Forensics & Machine Learning

- **`sharp` (v0.34)**: High-performance C++ `libvips` image processing library. Used for ultra-fast image resizing, raw pixel buffer extraction, RGB channel separation, crop operations, and compositing watermarks.
- **`exifr` (v7.1)**: Blazing-fast EXIF parser reading binary EXIF, TIFF, IPTC, XMP, and JFIF headers directly from raw buffer byte arrays.
- **`@tensorflow/tfjs` (v4.22)**: TensorFlow JavaScript runtime powering browser and Node.js neural network inference.
- **`jimp` (v1.6)**: Pure JavaScript image manipulation library used for fallback image transformations.
- **`jsqr` (v1.4)**: Pure JS QR code reading library analyzing raw pixel RGBA arrays to decode QR verification markers.
- **`qrcode` (v1.5)**: Node.js QR code generator encoding `AURA-XXXXXX` verification URLs into PNG/SVG matrix buffers.

---

## 🗄️ Database & Storage Layer

- **[MongoDB](https://www.mongodb.com/)**: Document-oriented NoSQL database supporting JSON-like schema flexibility and indexing.
- **[Mongoose ODM (v8.0)](https://mongoosejs.com/)**: Object Document Mapper enforcing strict schemas for `Proof` and `VerificationResult` collections, automatic timestamping (`createdAt`, `updatedAt`), and connection management.
- **In-Memory Ledger Store (`ledgerStore.js`)**: Native JavaScript `Map` data structure providing zero-downtime fallback when MongoDB is unreachable.

---

## 🧪 Development, Testing & Build Utilities

- **`nodemon` (v3.0)**: Development utility automatically restarting the Node.js server upon backend source code changes.
- **`jest` (v29.7)**: JavaScript testing framework for unit tests and forensic algorithm validation.
- **`supertest` (v6.3)**: HTTP assertion library testing Express REST routes.
- **Expo Application Services (EAS)**: Cloud build system compiling standalone Android APK/AAB and iOS IPA distribution binaries.
