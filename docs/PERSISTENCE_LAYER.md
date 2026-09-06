# 🗄️ A.U.R.A. - Persistence & Ledger Resilience Layer Documentation

This document provides a comprehensive technical overview of the **Persistence & Ledger Resilience Layer** of the A.U.R.A. platform located in [`backend/models/`](file:///d:/Projects/Java_Script/Apps/AURA/backend/models) and [`backend/utils/ledgerStore.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/ledgerStore.js).

---

## 🏗️ Architecture & Dual-Ledger System

The Persistence Layer manages the cryptographic storage, retrieval, and audit logging of generated authenticity proofs. It features a **Dual-Ledger Architecture**:

```
                 [ Generated Proof Payload ]
                              │
                              ▼
                ┌───────────────────────────┐
                │ Proof Controller (proof.js)│
                └─────────────┬─────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   ┌──────────────────────┐      ┌────────────────────────┐
   │ Primary Persistence  │      │  Resilience Cache      │
   │ MongoDB + Mongoose   │      │ In-Memory Ledger Store │
   │ (Persistent Storage) │      │ (Instant Availability) │
   └──────────────────────┘      └────────────────────────┘
```

1. **Primary Persistence**: **MongoDB** connected via **Mongoose v8.0**.
2. **In-Memory Ledger Cache Fallback ([`ledgerStore.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/ledgerStore.js))**: A high-speed, zero-dependency Map store that guarantees instant availability during database connection drops or cloud deployment initialization.

---

## 📁 Data Models & Schema Specifications

### 1. Proof Model ([`backend/models/Proof.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/models/Proof.js))
Stores authentic proof seals generated during live captures.

| Field Name | Type | Description | Index |
| :--- | :--- | :--- | :---: |
| `proofId` | `String` | Formatted proof ID (`AURA-XXXXXX`) | **Unique** |
| `hash` | `String` | Original media SHA-256 hash | **Indexed** |
| `imageHash` | `String` | Watermarked media SHA-256 hash | **Indexed** |
| `auraFlag` | `String` | Verification status flag (`GREEN`, `YELLOW`, `RED`) | Indexed |
| `status` | `String` | High-level status (`authentic`, `suspicious`, `tampered`) | Indexed |
| `mlAnalysis` | `Object` | ML metadata KNN, CNN visual & ELA forensic scores | None |
| `groq` | `Object` | Groq VLM image analysis & screen replay results | None |
| `sensorMetrics` | `Object` | Spatiotemporal accelerometer, gyroscope, light data | None |
| `exif` | `Object` | Sanitized physical camera hardware EXIF fingerprint | None |
| `timestamp` | `Date` | Cryptographic seal creation timestamp | Indexed |

---

### 2. Verification Result Model ([`backend/models/VerificationResult.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/models/VerificationResult.js))
Stores historical audit logs for external verification lookups.

| Field Name | Type | Description | Index |
| :--- | :--- | :--- | :---: |
| `verificationId` | `String` | Unique verification UUID | **Unique** |
| `proofId` | `String` | Reference proof ID | Indexed |
| `status` | `String` | Verification outcome (`authentic`, `tampered`, `unverified`) | Indexed |
| `confidence` | `Number` | Statistical confidence score ($0.0 - 100.0$) | None |
| `hashValidation` | `Object` | Match percentage and uploaded vs stored hash comparison | None |
| `timestamp` | `Date` | Audit timestamp | Indexed |

---

## ⚡ In-Memory Ledger Store ([`ledgerStore.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/ledgerStore.js))

To prevent database unavailability from causing HTTP 500 errors to mobile users, `ledgerStore.js` implements a resilient fallback:

- **Functions**:
  - `saveToLedger(proofId, doc)`: Caches proof documents in an in-memory Map instantly.
  - `getFromLedger(proofId)`: Resolves proof documents in $<1\text{ms}$.
  - `searchLedgerByHash(hash)`: Scans cached proofs by image SHA-256 hash.
- **Graceful Fallback**: If MongoDB connection drops, operations continue seamlessly (`persistedToDb: false`), ensuring 100% API availability.

---

## 🔒 Cryptographic Payload Structure

When an image achieves 🟢 **GREEN** status, a cryptographic payload is constructed:
$$\text{ProofHash} = \text{SHA-256}(\text{MediaBuffer} \parallel \text{SensorData} \parallel \text{Timestamp})$$

The final proof document is formatted and sealed with the formatted Proof ID `AURA-XXXXXX`, ready for verification via QR code scan or REST lookup.
