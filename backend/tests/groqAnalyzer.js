/**
 * AURA Groq VLM Analyzer
 *
 * Uses Groq's vision-capable LLM (qwen/qwen3.8-27b) to classify an image
 * as AI-generated or real-camera captured, and detects screen replay attacks.
 *
 * Returns normalized results without modifying existing ML scores.
 */

'use strict';

const Groq = require('groq-sdk');

let groqClient = null;

/**
 * Lazily initialize the Groq client using the GROQ_API_KEY env variable.
 * Returns null if the key is not configured.
 */
const getGroqClient = () => {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  groqClient = new Groq({ apiKey });
  return groqClient;
};

// Groq vision model
const GROQ_MODEL = 'qwen/qwen3.8-27b';

// Hard limit: base64 images larger than ~4MB may be rejected by the API
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

/**
 * Helper to ensure input is a Buffer or convert base64/string/Uint8Array to Buffer.
 */
const toBuffer = (input) => {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') {
    // If it's a data URL, strip prefix
    const base64Str = input.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Str, 'base64');
  }
  if (input instanceof Uint8Array || ArrayBuffer.isView(input)) {
    return Buffer.from(input);
  }
  return null;
};

/**
 * Analyze an image buffer via Groq's vision LLM and predict AI probability.
 *
 * @param {Buffer|string} imageInput - Raw image bytes or base64 string
 * @returns {Promise<{
 *   success: boolean,
 *   aiProbability: number,
 *   groqClassification: string,
 *   confidence: number,
 *   reasoning: string,
 *   error?: string
 * }>}
 */
const analyzeWithGroq = async (imageInput) => {
  const client = getGroqClient();

  if (!client) {
    return {
      success: false,
      aiProbability: 50,
      groqClassification: 'UNKNOWN',
      reasoning: 'Groq API key not configured',
      error: 'GROQ_API_KEY not set',
    };
  }

  try {
    const buffer = toBuffer(imageInput);
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        aiProbability: 50,
        groqClassification: 'UNKNOWN',
        reasoning: 'Invalid or empty image data provided',
        error: 'INVALID_IMAGE',
      };
    }

    const base64Data = buffer.toString('base64');

    if (base64Data.length > MAX_BASE64_BYTES) {
      return {
        success: false,
        aiProbability: 50,
        groqClassification: 'UNKNOWN',
        reasoning: 'Image too large for Groq VLM analysis (>4MB)',
        error: 'IMAGE_TOO_LARGE',
      };
    }

    const imageUrl = `data:image/jpeg;base64,${base64Data}`;

    const prompt = `You are an expert forensic image analyst specializing in detecting AI-generated images versus authentic real-world camera captures.

Analyze this image carefully and determine whether it is:
1. AI_GENERATED — Created by an AI model (Stable Diffusion, DALL-E, Midjourney, Firefly, Sora, GAN, etc.)
2. REAL_CAMERA — A genuine photograph taken by a physical camera (smartphone, DSLR, mirrorless, etc.)

Look for these forensic signals:
- Texture and noise patterns (AI images often have smooth, uniform noise vs. sensor grain in real cameras)
- Chromatic aberration (real lenses produce R/B channel fringing at edges; AI rarely does)
- JPEG compression artifacts and block structure
- Unnaturally perfect lighting or impossible physics
- Facial or human anatomical errors common in AI synthesis
- Background consistency and depth-of-field rendering

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "classification": "AI_GENERATED",
  "ai_probability": 85,
  "confidence": 90,
  "reasoning": "One concise sentence explaining the key forensic signal."
}`;

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 256,
    });

    const rawText = response.choices?.[0]?.message?.content?.trim() || '';

    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Fallback: regex extraction
      const probMatch = rawText.match(/"ai_probability"\s*:\s*(\d+)/);
      const classMatch = rawText.match(/"classification"\s*:\s*"(AI_GENERATED|REAL_CAMERA)"/i);
      const confMatch = rawText.match(/"confidence"\s*:\s*(\d+)/);
      const reasonMatch = rawText.match(/"reasoning"\s*:\s*"([^"]+)"/);
      if (probMatch || classMatch) {
        parsed = {
          ai_probability: probMatch ? parseInt(probMatch[1], 10) : 50,
          classification: classMatch?.[1]?.toUpperCase() || 'UNKNOWN',
          confidence: confMatch ? parseInt(confMatch[1], 10) : 60,
          reasoning: reasonMatch?.[1] || 'Extracted from partial response',
        };
      } else {
        throw new Error(`Could not parse Groq response: ${rawText.slice(0, 200)}`);
      }
    }

    const aiProbability = Math.max(0, Math.min(100, Number(parsed.ai_probability) || 50));
    const groqClassification = String(parsed.classification || 'UNKNOWN').toUpperCase();
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 70));
    const reasoning = String(parsed.reasoning || '').slice(0, 300);

    return {
      success: true,
      aiProbability,
      groqClassification,
      confidence,
      reasoning,
    };
  } catch (err) {
    return {
      success: false,
      aiProbability: 50,
      groqClassification: 'UNKNOWN',
      reasoning: `Groq analysis failed: ${err.message}`,
      error: err.message,
    };
  }
};

/**
 * Analyze an image buffer via Groq's vision LLM to determine whether it is a photo of the real
 * physical world, or a photo taken OF a screen/monitor/display (a "screen replay" attack).
 *
 * @param {Buffer|string} imageInput - Raw image bytes or base64 string
 * @returns {Promise<{
 *   success: boolean,
 *   isScreenReplay: boolean,
 *   confidence: number,
 *   reasoning: string,
 *   error?: string
 * }>}
 */
const analyzeScreenReplayWithGroq = async (imageInput) => {
  const client = getGroqClient();

  if (!client) {
    return {
      success: false,
      isScreenReplay: false,
      confidence: 0,
      reasoning: 'Groq API key not configured',
      error: 'GROQ_API_KEY not set',
    };
  }

  try {
    const buffer = toBuffer(imageInput);
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        isScreenReplay: false,
        confidence: 0,
        reasoning: 'Invalid or empty image data provided',
        error: 'INVALID_IMAGE',
      };
    }

    const base64Data = buffer.toString('base64');

    if (base64Data.length > MAX_BASE64_BYTES) {
      return {
        success: false,
        isScreenReplay: false,
        confidence: 0,
        reasoning: 'Image too large for Groq VLM analysis (>4MB)',
        error: 'IMAGE_TOO_LARGE',
      };
    }

    const imageUrl = `data:image/jpeg;base64,${base64Data}`;

    const prompt = `You are an expert forensic image analyst specializing in detecting "screen replay" attacks — where someone photographs a monitor, laptop, TV, or phone screen that is DISPLAYING an image, instead of photographing the real physical subject directly.

Determine whether this photo shows:
1. SCREEN_REPLAY — The camera photographed a physical display (monitor/laptop/TV/phone) that is itself showing a picture. Look for: monitor bezels/stands, screen glare or glass reflections, a visible rectangular screen edge/frame within the photo, moiré/subpixel grid patterns, unnaturally flat backlit glow.
2. REAL_WORLD — The camera photographed real physical objects, people, or scenes directly. Reflective or glossy objects (plastic toys, metal, glass, chrome) and backlit scenes are NORMAL in real photos and are NOT evidence of a screen — do not flag them as screen replay just because they show extra contrast, glare, or color fringing.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "classification": "SCREEN_REPLAY",
  "confidence": 92,
  "reasoning": "One concise sentence explaining the key visual evidence."
}`;

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const rawText = response.choices?.[0]?.message?.content?.trim() || '';
    const jsonText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const classMatch = rawText.match(/"classification"\s*:\s*"(SCREEN_REPLAY|REAL_WORLD)"/i);
      const confMatch = rawText.match(/"confidence"\s*:\s*(\d+)/);
      const reasonMatch = rawText.match(/"reasoning"\s*:\s*"([^"]+)"/);
      if (classMatch) {
        parsed = {
          classification: classMatch[1].toUpperCase(),
          confidence: confMatch ? parseInt(confMatch[1], 10) : 60,
          reasoning: reasonMatch?.[1] || 'Extracted from partial response',
        };
      } else {
        throw new Error(`Could not parse Groq response: ${rawText.slice(0, 200)}`);
      }
    }

    const classification = String(parsed.classification || 'REAL_WORLD').toUpperCase();
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 50));
    const reasoning = String(parsed.reasoning || '').slice(0, 300);

    return {
      success: true,
      isScreenReplay: classification === 'SCREEN_REPLAY',
      confidence,
      reasoning,
    };
  } catch (err) {
    return {
      success: false,
      isScreenReplay: false,
      confidence: 0,
      reasoning: `Groq screen-replay analysis failed: ${err.message}`,
      error: err.message,
    };
  }
};

module.exports = { analyzeWithGroq, analyzeScreenReplayWithGroq };
