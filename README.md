# A.U.R.A. (Authenticated Unforgeable Reality Architecture)

**"The ISI Mark for Digital Reality"**

A.U.R.A. is a full-stack platform + mobile capture SDK reference designed to prove a photo or video was captured by a physical camera, in the real world, at a specific moment. It combats AI generation, screen-replay spoofing, and metadata tampering using **Environmental Cryptography** — fusing raw pixel data with live hardware MEMS sensor telemetry (light intensity, magnetic fields, 3D gravity vectors) into a cryptographically sealed, publicly verifiable ledger record.

---

## 🚀 Key Features

* **Anti-Spoof ML Engine**: Performs reject-before-seal checks including:
  * **PWM Backlight Flicker**: Detects invisible frequency oscillations from screen illumination.
  * **Magnetometer Anomalies**: Flags magnetic fields (µT) exceeding ambient thresholds, indicating close monitor/display proximity.
  * **Moiré Patterns**: Identifies pixel-grid display camera interference.
  * **Gravity Vectors**: Verifies physical tilt postures.
* **Cryptographic Sealing**: Combines raw pixels with environmental JSON payloads to compute an unforgeable SHA-256 fingerprint.
* **Metadata Watermarking**: Overlays an interactive QR stamp onto images and injects the SHA-256 seal directly into the EXIF `UserComment` structure.
* **Responsive Dashboard**: Cyber-security themed HUD console with a web-based Android camera simulator, feed audits, and threat analytics charts.

---

## 📂 Project Directory Structure

```
aura/
├── backend/
│   ├── static/               # HTML/CSS/JS web dashboard
│   │   ├── captures/         # Watermarked JPG disk persistence
│   │   ├── index.html        # Main dashboard console UI
│   │   ├── style.css         # Cyberpunk/Dark-theme design system
│   │   └── app.js            # Capture simulators & chart builders
│   ├── database.py           # SQLite local fallback & Postgres engine
│   ├── main.py               # FastAPI endpoints & business logic
│   ├── ml_engine.py          # Anti-spoof sensor evaluation algorithms
│   ├── models.py             # Database schemas (organizations, verifications)
│   ├── requirements.txt      # Python package requirements
│   ├── schemas.py            # Pydantic schema validators
│   └── sealer.py             # SHA-256 hashing & EXIF/QR overlays
├── sdk/
│   └── AuraSDK.js            # Reference React Native sensor-fusing SDK wrapper
├── verify_api.py             # Automated HTTP end-to-end verifier script
├── seed_history.py           # Populates 45 sample captures for analytics
└── .gitignore                # Excludes runtime DBs and image assets
```

---

## 🛠️ How to Run Locally

### 1. Install Python Dependencies
Install required packages using pip:
```bash
pip install -r backend/requirements.txt
```

### 2. Seed Sample Database Records
Populate a week's worth of verification logs and spoof attempts to view rich dashboards:
```bash
python seed_history.py
```

### 3. Launch the API & Web Dashboard
Start the Uvicorn web server:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Now, open your browser and navigate to:
👉 **[http://localhost:8000/](http://localhost:8000/)**

---

## 🧪 Running Automated Tests
Test API endpoint validation, authentication checks, and spoof rejections synchronously:
```bash
python verify_api.py
```

---

## 🔒 Security Configuration
* **Authentication**: The API endpoints require an `X-API-Key` header. For local development, the database seeds a default organization and device with the key: `aura_dev_secret_key_2026`.
* **Database Connection**: Set the `DATABASE_URL` environment variable to connect to a live Postgres / Supabase instance in production. If omitted, the app defaults to local `aura.db`.
