# 📜 Layer 1: EXIF Metadata & Hardware Fingerprint Forensics

## 🔬 Overview & Physics Rationale

When a physical digital camera (or mobile phone camera) captures an image, the camera hardware's Image Signal Processor (ISP) writes an unforgeable physical signature into the file's EXIF (Exchangeable Image File Format) and XMP metadata headers. 

Synthetic AI image generators (such as Midjourney, DALL-E 3, Stable Diffusion) generate raw pixel arrays directly via neural diffusion models. **They do not possess optical camera hardware, physical lenses, or ISP chips**, and therefore omit physical EXIF metadata headers (or insert synthetic generation prompts into XMP fields).

Layer 1 inspects 13 distinct metadata parameters and classifies the image using a **13-Dimensional K-Nearest Neighbors ($k=5$) Machine Learning Model**.

---

## 📐 13-Dimensional Binary Feature Vector

Every uploaded image is parsed using `exifr` into a binary vector $\mathbf{v} \in \{0, 1\}^{13}$:

| Vector Index | Feature Key | Physical Meaning | Real Camera Value | AI Generator Value |
| :---: | :--- | :--- | :---: | :---: |
| `[0]` | `hasCameraMake` | Presence of camera manufacturer tag (e.g. `Apple`, `Canon`, `Sony`) | `1` | `0` |
| `[1]` | `hasCameraModel` | Presence of camera device model (e.g. `iPhone 15 Pro`, `EOS R5`) | `1` | `0` |
| `[2]` | `hasShutterSpeed` | Presence of `ExposureTime` or `ShutterSpeedValue` | `1` | `0` |
| `[3]` | `hasAperture` | Presence of `FNumber` or `ApertureValue` | `1` | `0` |
| `[4]` | `hasISO` | Presence of sensor light sensitivity rating (`ISO`) | `1` | `0` |
| `[5]` | `hasGPS` | Presence of spatiotemporal location tags (`GPSLatitude`/`Longitude`) | `1` or `0` | `0` |
| `[6]` | `hasXmpPrompt` | Presence of text prompt fields (`prompt`, `workflow`, `generation_params`) | `0` | `1` |
| `[7]` | `isPowerOf2Dims` | Image width and height are powers of 2 (512x512, 1024x1024) | `0` | `1` |
| `[8]` | `isSquare` | Aspect ratio is exactly 1:1 ($W = H$) | `0` | `1` |
| `[9]` | `hasKnownAiSw` | `Software` header contains "Midjourney", "Stable Diffusion", "Automatic1111" | `0` | `1` |
| `[10]` | `hasFocalLength` | Presence of physical lens focal length in mm (`FocalLength`) | `1` | `0` |
| `[11]` | `hasFlash` | Presence of physical strobe trigger data (`Flash`) | `1` or `0` | `0` |
| `[12]` | `hasExifVersion` | Presence of EXIF header specification format (`ExifVersion`) | `1` | `0` |

---

## 🧮 KNN Classification Algorithm ($k=5$)

The binary vector $\mathbf{v}$ is evaluated against a pre-trained ground-truth dataset $\{\mathbf{x}_i, y_i\}_{i=1}^N$ containing labeled feature vectors ($y_i = 0$ for Real Camera, $y_i = 1$ for AI Generated):

1. **Euclidean Distance Metric**:
   $$d(\mathbf{v}, \mathbf{x}_i) = \sqrt{ \sum_{j=0}^{12} (v_j - x_{i,j})^2 }$$
2. **Nearest Neighbor Selection**: The training dataset is sorted by distance $d$, and the $K=5$ nearest samples are selected.
3. **Probability Calculation**:
   $$P_{\text{meta}}(\text{AI}) = \frac{1}{5} \sum_{k=1}^{5} y_{(k)}$$

---

## 💻 Source Code References

- **Backend Analyzer**: [`backend/utils/metadataAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/metadataAnalyzer.js)
- **Frontend Evidence Display**: [`frontend/src/components/EvidenceCard.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/components/EvidenceCard.js)

---

## 🎨 User Interface Representation

The results of Layer 1 are rendered in the app's **Physical Evidence Card**, detailing each of the 13 physical signals (green check for verified hardware tags, amber warning for missing signatures or AI indicators).
