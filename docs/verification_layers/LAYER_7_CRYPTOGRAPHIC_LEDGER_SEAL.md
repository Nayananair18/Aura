# 🔐 Layer 7: Cryptographic Ledger & SHA-256 Watermark Sealing

## 🏛️ Overview & Immutability Architecture

Layer 7 is the final verification stage in A.U.R.A. When an image successfully passes Layers 1 through 6 and receives a 🟢 **GREEN Flag (`AUTHENTIC_CAMERA`)**, Layer 7 seals the media by generating a cryptographic proof and persisting it to the verification ledger.

---

## 🧮 Cryptographic Hash Generation

$$\text{ProofHash} = \text{SHA-256}(\text{MediaBuffer} \parallel \text{SensorTelemetry} \parallel \text{Timestamp})$$

1. **Media Hash**: SHA-256 digest of the raw media byte buffer.
2. **Proof ID Formatting**: A unique, human-readable proof key `AURA-XXXXXX` (e.g. `AURA-7F3A2B`) is assigned.
3. **Spatiotemporal Binding**: Seals capture timestamp, GPS location, device ID, and sensor stats into the immutable proof document.

---

## 🖼️ Server-Side Watermarking & QR Marker

If `finalAuraFlag === 'GREEN'`, A.U.R.A. uses C++ `sharp` to composite an authentic server-side seal directly onto the image:
- **Certified Banner Overlay**: Adds the official "A.U.R.A. CERTIFIED AUTHENTIC" banner along the bottom edge of the image.
- **Embedded QR Code**: Encodes the verification URL (`https://aura-app.com/verify/AURA-XXXXXX`).
- **QR Marker Decoding**: Anyone can upload a watermarked photo to `/api/media/decode-qr` or scan the QR code with the mobile app to verify its cryptographic hash against the stored ledger record.

---

## 🗄️ Dual Resilience Storage Architecture

```
                 Proof Payload & Proof ID
                            │
                            ▼
           Save to In-Memory Map Cache (ledgerStore.js)
                            │
                 Is MongoDB Connected?
                  ├───► YES: Persist to Proof & VerificationResult Collections
                  └───► NO: Continue gracefully (Zero 500 downtime)
```

1. **Primary Persistence**: MongoDB database connected via Mongoose (`Proof` and `VerificationResult` schemas).
2. **In-Memory Cache Fallback**: [`backend/utils/ledgerStore.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/ledgerStore.js) acts as an in-memory fallback cache to ensure verification lookups never crash even during database maintenance or network outages.

---

## 💻 Source Code References

- **Backend Proof Controller**: [`backend/controllers/proof.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/controllers/proof.js)
- **Backend Verify Controller**: [`backend/controllers/verify.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/controllers/verify.js)
- **Crypto & Watermark Utilities**: [`backend/utils/crypto.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/crypto.js)
- **In-Memory Ledger Cache**: [`backend/utils/ledgerStore.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/ledgerStore.js)
- **Frontend QR Decoder**: [`frontend/src/screens/VerificationScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/VerificationScreen.js)
