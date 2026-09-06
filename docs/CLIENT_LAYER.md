# 📱 A.U.R.A. - Client Layer Documentation

This document provides a comprehensive technical overview of the **Client Layer** of the A.U.R.A. platform located in [`frontend/`](file:///d:/Projects/Java_Script/Apps/AURA/frontend).

---

## 🏗️ Overview & Framework Stack

The client layer is built using **React Native** with **Expo SDK 54**, targeting Android, iOS, and Web platforms. It handles camera access, physical hardware sensor tracking (accelerometer, gyroscope, magnetometer, barometer, ambient light), SHA-256 local hashing, zero-adoption web verification, and interactive visual evidence rendering.

### Core Technologies
- **Framework**: React Native `0.76+` / Expo SDK `54`
- **Navigation**: `@react-navigation/native` & `@react-navigation/stack`
- **Hardware Sensors**: `expo-sensors` (60Hz high-frequency sampling)
- **Media & File System**: `expo-camera`, `expo-image-picker`, `expo-file-system`, `expo-media-library`
- **Crypto & Security**: `expo-crypto` (SHA-256 local media hashing & UUID generation)

---

## 📁 Directory & File Structure

```
frontend/
├── App.js                      # Root entry point, fonts loading & theme provider
├── app.json                    # Expo configuration & native splash/permissions plugins
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── Card.js             # Neomorphic dark-theme container card
│   │   ├── EvidenceCard.js     # Physical Evidence 13-signal breakdown component
│   │   ├── GroqScoreCard.js    # Groq VLM image & screen replay visualization component
│   │   ├── Header.js           # Navigation bar header
│   │   ├── MLScoreCard.js      # AI Detection Analysis circular gauge & breakdown
│   │   └── SectionTitle.js     # Styled section titles
│   ├── navigation/
│   │   └── RootNavigator.js    # React Navigation stack navigator
│   ├── screens/
│   │   ├── CaptureScreen.js    # Native camera interface, sensor collector & live capture
│   │   ├── HomeScreen.js       # Main dashboard, quick action buttons & status overview
│   │   ├── ResultScreen.js     # Verification result badge, ML breakdown & flag decision engine
│   │   ├── SplashScreen.js     # Animated initial loading & app startup screen
│   │   └── VerificationScreen.js # Zero-adoption file upload & web verification screen
│   ├── services/
│   │   ├── api.js              # Axios HTTP client, base URL resolution & retry logic
│   │   ├── fileService.js      # Local file reading, gallery saving & permission requests
│   │   ├── hashService.js      # Local SHA-256 calculation
│   │   └── sensorManager.js    # 60Hz hardware sensor subscription & telemetry packager
│   └── theme/
│       └── index.js            # Dark mode palette, typography & layout constants
```

---

## 📱 Screens & UI Workflow

### 1. SplashScreen ([`SplashScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/SplashScreen.js))
- Displays the centered A.U.R.A. shield logo on launch with clean background styling (no square shadow box artifacts).
- Performs background handshake ping (`GET /ping`) to check backend API availability before navigating to `HomeScreen`.

### 2. HomeScreen ([`HomeScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/HomeScreen.js))
- Primary navigation dashboard.
- Offers two main workflows:
  - **Live Physics Capture**: Navigates to `CaptureScreen`.
  - **External Media Verification**: Navigates to `VerificationScreen`.

### 3. CaptureScreen ([`CaptureScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/CaptureScreen.js))
- Activates native hardware camera view (`expo-camera`).
- Subscribes to hardware sensors via `SensorManager.startCollecting()`.
- Captures image frame, collects 60Hz spatiotemporal telemetry (accelerometer, gyroscope, light), computes local SHA-256 hash, and calls `POST /api/media/generate-proof`.
- Safely requests device media permissions (`MediaLibrary.requestPermissionsAsync(true)`) to store authentic photos in the native gallery without triggering Android audio permission errors.

### 4. VerificationScreen ([`VerificationScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/VerificationScreen.js))
- Supports zero-adoption verification for external images (from gallery, browser, or messaging apps).
- Dispatches image payload to `POST /api/media/analyze-metadata` to trigger parallel ML metadata KNN forensics and Groq VLM vision inspection.

### 5. ResultScreen ([`ResultScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/ResultScreen.js))
- Evaluates the final flag decision engine across all signals.
- Priority #1 Global Override: If `isScreenReplayAttack` is true (detected by ML optical Moire analysis, high screen score $\ge 0.50$, or Groq screen replay), the primary status banner is strictly set to **`🔴 A.U.R.A. FLAG: RED`** with title **`SCREEN RECAPTURE DETECTED`**.
- Renders `MLScoreCard`, `GroqScoreCard`, and `EvidenceCard` detailing physical hardware signals.

---

## ⚙️ Key Client Services

### Sensor Manager ([`sensorManager.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/services/sensorManager.js))
Subscribes to hardware sensors using `expo-sensors`:
- **Accelerometer**: Reads 3-axis motion ($x, y, z$) to detect human hand micro-tremors.
- **Gyroscope**: Tracks angular velocity ($\omega_x, \omega_y, \omega_z$).
- **Magnetometer**: Detects magnetic distortion caused by nearby electronic display backlights.
- **Light Sensor**: Monitors optical flicker and lux variations during photo capture.

### File Service ([`fileService.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/services/fileService.js))
- Safely handles native storage saving.
- Requests granular media permissions (`requestPermissionsAsync(true)`) to prevent Android `RECORD_AUDIO` missing permission crashes during photo album creation.

---

## 🎨 Design Tokens & UI Aesthetics

- **Color Palette**: Dark-mode primary (`#0A0D14`), Surface (`#121824`), Card (`#1A2234`).
- **Status Flags**:
  - 🟢 **GREEN** (`#22C55E`): Verified Authentic Capture with intact hardware EXIF & sensor telemetry.
  - 🟡 **YELLOW** (`#F59E0B`): Unverified External Media (missing hardware proof or EXIF stripped).
  - 🔴 **RED** (`#EF4444`): Screen Recapture Attack, AI Generation, or Hardware Telemetry Anomaly.
