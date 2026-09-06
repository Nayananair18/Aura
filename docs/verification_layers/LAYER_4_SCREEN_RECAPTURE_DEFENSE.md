# 📺 Layer 4: Optical Screen Recapture & Moire Defense

## 🛡️ Overview & Threat Model

A critical attack vector in media authenticity verification is **Screen Recapture Spoofing**: An attacker takes a live photo of a laptop, TV, monitor, or tablet screen displaying a digital photo or AI image, trying to pass off the re-photographed image as a live authentic capture.

Layer 4 analyzes pixel buffers for physical display signatures including:
- **Optical PWM Flicker & Backlight Luminance Lift**
- **Subpixel Grid Moiré Interference Patterns**
- **Monitor Display Bezel & Reflection Boundaries**

---

## 🧮 Detection Signals & Thresholds

### Signal 1: Display Backlight Luminance Lift
Digital monitor screens emit backlight radiation that lifts shadow pixels above natural dark camera noise.
- Sample pixels with brightness $Y < 110$.
- If dark pixels exceed $15\%$ of frame and average brightness $\bar{Y} < 125$, the image exhibits display backlight lift.

### Signal 2: Spatial Subpixel Moiré Fringes
Interference between the camera sensor subpixel grid and the monitor subpixel matrix produces periodic spatial high-frequency moiré patterns.
- Compute high-frequency spatial periodicity in 2D FFT / spatial gradient domains.
- Calculate Chromatic Moiré Score $S_{\text{screen}} \in [0.0, 1.0]$.

---

## ⚡ Priority #1 RED Flag Override Rule

If screen recapture is detected ($\text{ScreenScore} \ge 0.50$ or classification `SCREEN_RECAPTURE`), A.U.R.A. enforces a **Priority #1 RED Flag Override**:
- `evaluatedFlag` is immediately forced to **🔴 RED (`SCREEN RECAPTURE DETECTED`)**.
- Overrides live capture mode (`isCaptureMode: true`).
- Withholds the server-side authentic seal watermark.
- Renders `📺 SCREEN CAPTURED` with confidence badge in the mobile UI.

---

## 💻 Source Code References

- **Backend Screen Analyzer**: [`backend/utils/screenRecaptureAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/screenRecaptureAnalyzer.js)
- **Backend Proof Controller**: [`backend/controllers/proof.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/controllers/proof.js)
- **Frontend Flag Engine**: [`frontend/src/screens/ResultScreen.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/screens/ResultScreen.js)
