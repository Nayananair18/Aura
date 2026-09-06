# 🤖 Layer 5: Groq VLM Vision & Replay Engine

## 🔬 Overview & Multi-Modal VLM Architecture

Layer 5 integrates Vision-Language Model (VLM) intelligence into A.U.R.A. via `groq-sdk` using the **`qwen/qwen3.8-27b`** vision model.

It executes two specialized parallel inspection tasks:
1. **`analyzeWithGroq(buffer)`**: Deep visual AI synthesis inspection (evaluates lighting inconsistencies, diffusion boundary smoothing, and unnatural anatomical or environmental features).
2. **`analyzeScreenReplayWithGroq(buffer)`**: Screen replay & recapture analysis (specifically checks for screen reflection, pixel grid lines, bezel borders, and PWM flicker).

---

## ⚙️ Key Implementation Specifications

```
Uploaded Image Buffer (Base64)
         │
         ├───► 1. Lazy Client Initialization via getGroqClient()
         │
         ├───► 2. Payload Guard: Check Buffer Size <= 4MB
         │
         ├───► 3. Promise.all Parallel Dispatch to Groq API
         │          ├──► analyzeWithGroq()
         │          └──► analyzeScreenReplayWithGroq()
         │
         └───► 4. Triple-Tier Robust JSON Extraction:
                    • Tier 1: Direct JSON.parse()
                    • Tier 2: Markdown Code Fence ```json Stripping
                    • Tier 3: Regex Pattern Matching Fallback
```

---

## 🔒 Deterministic Score Isolation

To ensure that A.U.R.A.'s core physical physics metrics remain 100% deterministic and mathematically reproducible:
- Groq VLM scores are **NOT blended into the ML ensemble probability score**.
- Groq analysis results are returned as an independent `groq` object in the API response.
- Rendered in a dedicated UI card (**`GroqScoreCard.js`**) directly below the ML Analysis card.

---

## 💻 Source Code References

- **Backend Groq Module**: [`backend/analyzers/groqAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/backend/analyzers/groqAnalyzer.js)
- **Root Re-Export**: [`analyzers/groqAnalyzer.js`](file:///d:/Projects/Java_Script/Apps/AURA/analyzers/groqAnalyzer.js)
- **Frontend UI Component**: [`frontend/src/components/GroqScoreCard.js`](file:///d:/Projects/Java_Script/Apps/AURA/frontend/src/components/GroqScoreCard.js)
