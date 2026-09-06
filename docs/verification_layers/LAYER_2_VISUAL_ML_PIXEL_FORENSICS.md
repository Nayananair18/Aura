# 👁️ Layer 2: Visual ML Pixel-Level Forensics

## 🔬 Overview & Optical Physics

Layer 2 inspects raw RGB pixel buffers extracted via C++ `sharp` to analyze physical optical phenomenon created by camera lenses and CMOS sensors vs synthetic pixel generation artifacts.

Physical optical systems introduce three unforgeable physical characteristics:
1. **Poisson-Gaussian Photon Shot Noise**: Random photon arrival statistics at camera sensor pixels.
2. **JPEG 8x8 Compression Block Boundaries**: Discrete Cosine Transform (DCT) quantization grid patterns from hardware Image Signal Processors (ISPs).
3. **Chromatic Aberration & Dispersion**: Wavelength-dependent light refraction across glass lens elements.

---

## 🧮 Algorithmic Sub-Modules

### Module A: Noise Energy Analysis
AI generators render smooth gradients or uniform synthetic noise. Physical camera sensors produce non-uniform photon shot noise across pixel blocks.

- The image buffer is converted to grayscale and divided into $16 \times 16$ pixel sub-blocks.
- Compute local block variance $\sigma^2_b$:
  $$\sigma^2_b = \frac{1}{256} \sum_{i=1}^{256} (p_i - \bar{p})^2$$
- **Low Noise Energy ($\sigma^2_b < 12.0$)**: Flags oversmoothed synthetic AI pixel regions.

### Module B: JPEG 8x8 Compression Block Variance
Physical cameras compress images using hardware ISP quantization matrices operating on $8 \times 8$ grid blocks.
- Compute boundary pixel deltas along $8 \times 8$ horizontal and vertical block boundaries:
  $$\Delta B = |p_{(8k)} - p_{(8k+1)}|$$
- Synthetic images generated directly in PNG or unquantized float spaces exhibit irregular or absent $8 \times 8$ ISP block variance patterns.

### Module C: Chromatic Aberration & Lens Dispersion
Because red light and blue light bend at slightly different angles through physical glass lenses, sharp contrast edges in genuine photographs exhibit subtle pixel-level channel displacement:
- Compute spatial gradient magnitude $\nabla I_R$ for the Red channel and $\nabla I_B$ for the Blue channel along high-contrast edge boundaries.
- Calculate Chromatic Dispersion Metric:
  $$C_{\text{disp}} = |\nabla I_R - \nabla I_B|$$
- **Zero Dispersion ($C_{\text{disp}} \approx 0$)**: Indicates synthetic pixel rendering without physical optical refraction.

---

## 💻 Source Code References

- **Backend Visual Analyzer**: [`backend/utils/visualMLAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/utils/visualMLAnalyzer.js)
- **Frontend ML Score Gauge**: [`frontend/src/components/MLScoreCard.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/components/MLScoreCard.js)
