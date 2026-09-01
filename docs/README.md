# 🛡️ A.U.R.A. Documentation Suite

Welcome to the official technical documentation suite for **A.U.R.A. (Authenticity Using Reality Analysis)** — a next-generation, physics-first authenticity verification engine designed to detect synthetic AI-generated media, screen-recaptured replays, and digital manipulation.

---

## 📚 Documentation Navigation Index

| Document | Description | Key Focus Areas |
| :--- | :--- | :--- |
| 📖 [**PROJECT OVERVIEW**](file:///d:/Projects/Java_Script/Apps/AURA/docs/PROJECT_OVERVIEW.md) | Mission, problem statement, & core philosophy | Physics-first principle, AI vs real lens, zero-adoption model, ledger sealing |
| 🏗️ [**SYSTEM ARCHITECTURE**](file:///d:/Projects/Java_Script/Apps/AURA/docs/SYSTEM_ARCHITECTURE.md) | End-to-end architecture & data flows | Mermaid sequence diagrams, sensor pipeline, database fallback resilience |
| 🛠️ [**TECHNOLOGY STACK**](file:///d:/Projects/Java_Script/Apps/AURA/docs/TECHNOLOGY_STACK.md) | Complete list of languages, frameworks & libraries | React Native, Expo, Node.js, Express, Sharp, TensorFlow.js, exifr, MongoDB |
| 🔬 [**FORENSIC ENGINE & ML**](file:///d:/Projects/Java_Script/Apps/AURA/docs/FORENSIC_ENGINE_AND_ML.md) | Deep-dive into forensic ML algorithms | 13-dim Metadata KNN ($k=5$), Visual ML CNN model, ELA, Screen Recapture analysis |
| 📡 [**API DOCUMENTATION**](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md) | Comprehensive REST API specification | Endpoints, payload schemas, QR codes, verification endpoints, rate limiting |
| 🗄️ [**DATABASE SETUP**](file:///d:/Projects/Java_Script/Apps/AURA/docs/DATABASE_SETUP.md) | MongoDB database architecture & setup guide | Proofs & VerificationResults schemas, connection fallback, indexing |
| 🏷️ [**VERIFIED MEDIA MARKER**](file:///d:/Projects/Java_Script/Apps/AURA/docs/VERIFIED_MEDIA_MARKER.md) | Cryptographic watermarking & QR overlay engine | Sharp watermark composite pipeline, QR encoding/decoding, ledger lookup |

---

## 🚀 Quick Summary of A.U.R.A.

- **Primary Goal**: Distinguish real physical camera captures from AI-generated synthetics (Midjourney, DALL-E, Stable Diffusion) and re-photographed screen displays.
- **Core Philosophy**: *"No Physical Proof = Not Verified"*. Synthetic images lack physical lens and optical sensor hardware signatures. A.U.R.A. enforces physical evidence evaluation.
- **Architecture**:
  - **Client**: Expo / React Native multi-platform app (iOS, Android, Web) with live multi-sensor telemetry collection (accelerometer, gyroscope, magnetometer, barometer, light sensor).
  - **Server**: Node.js & Express REST API with high-performance C++ `sharp` image manipulation, `exifr` metadata extraction, and `tensorflow.js` machine learning inference.
  - **Ensemble ML Engine**: Combines a **13-Dimensional Metadata KNN Classifier** with a **Visual Deep Learning / Statistical Feature Extractor**, **Error Level Analysis (ELA)**, and **Screen Recapture Moire Forensics**.
  - **Ledger Persistence**: MongoDB document store with SHA-256 cryptographic proof sealing and instant in-memory fallback for offline/disconnected environments.

---

## 🔑 Core Terminology

- **EXIF (Exchangeable Image File Format)**: Metadata embedded in digital image files containing camera make, model, shutter speed, ISO, aperture, focal length, and hardware tags.
- **KNN (K-Nearest Neighbors)**: Machine learning classification algorithm evaluating 13 physical hardware dimensions ($k=5$) against validated real-camera and AI datasets.
- **ELA (Error Level Analysis)**: Forensic method that identifies digital edits and synthetic pixels by measuring compression loss variances after controlled re-compression.
- **Screen Recapture / Replay Attack**: An attempt to pass an image off as original by photographing a laptop or monitor displaying an existing image. Detected via Moire patterns, high-frequency grid noise, and brightness distributions.
- **Cryptographic Proof ID**: Unique `AURA-XXXXXX` identifier generated via SHA-256 hashing of physical media, sensor telemetry, and hardware fingerprints.

---

## 🤝 Contributing to Documentation

When updating or extending codebase features, please keep the documentation in sync:
1. API changes should update [API_DOCUMENTATION.md](file:///d:/Projects/Java_Script/Apps/AURA/docs/API_DOCUMENTATION.md).
2. ML feature adjustments should be reflected in [FORENSIC_ENGINE_AND_ML.md](file:///d:/Projects/Java_Script/Apps/AURA/docs/FORENSIC_ENGINE_AND_ML.md).
3. New dependencies should be logged in [TECHNOLOGY_STACK.md](file:///d:/Projects/Java_Script/Apps/AURA/docs/TECHNOLOGY_STACK.md).
