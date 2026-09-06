# 📡 Layer 6: Hardware Sensor & Telemetry Defense

## 📱 Overview & Hardware Binding

When a user takes a photo live inside the A.U.R.A. app, Layer 6 binds the captured media directly to the physical environment by sampling mobile device hardware sensors at **60Hz** during the capture window.

This prevents **Virtual Camera Injectors**, **Android Emulator Replay Attacks**, and **Static Mount Recording**.

---

## 🧭 Hardware Sensor Parameters Collected

| Sensor | Sampling Rate | Physical Feature Verified | Attack Prevented |
| :--- | :---: | :--- | :--- |
| **Accelerometer** | 60Hz | Handheld micro-tremors ($9.81 m/s^2$ gravity vector + natural physiological movement) | Static file upload / Virtual camera injection |
| **Gyroscope** | 60Hz | Natural angular velocity fluctuations during shutter press | Emulator software camera feeding static video stream |
| **Magnetometer** | 60Hz | Earth's ambient magnetic field vector stability ($\mu T$) | Re-photographing electronic CRT / LCD displays emitting localized magnetic field spikes |
| **Light Sensor** | 60Hz | Ambient lux light level and AC power light flicker frequency | Re-photographing monitor displays with PWM backlight flicker |
| **Barometer** | Event | Ambient atmospheric pressure ($hPa$) | Location / elevation spoofing |

---

## 🧮 Telemetry Verification Engine

Located in [`backend/utils/crypto.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/crypto.js) (`analyzeSensorIntegrity`):

1. **Gravity Vector Validation**: Verifies total acceleration vector magnitude $\sqrt{a_x^2 + a_y^2 + a_z^2} \approx 9.81 m/s^2$.
2. **Micro-Tremor Variance**: Checks that standard deviation $\sigma_{\text{gyro}} > 0.0001$, confirming human handheld operation vs automated digital injection.
3. **Integrity Score Calculation**: Computes an overall hardware telemetry score ($0 - 100$). Scores below $60$ trigger a sensor failure warning flag (`YELLOW`/`RED`).

---

## 💻 Source Code References

- **Frontend Sensor Manager**: [`frontend/src/services/sensorManager.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/services/sensorManager.js)
- **Frontend Capture Screen**: [`frontend/src/screens/CaptureScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/CaptureScreen.js)
- **Backend Telemetry Verifier**: [`backend/utils/crypto.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/crypto.js)
