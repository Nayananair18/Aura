const express = require('express');
const router = express.Router();
const {
  validateGenerateProof,
  validateVerifyMedia,
  validateAnalyzeMetadata,
  handleValidationErrors,
} = require('../middleware/validation');
const { proofLimiter, verifyLimiter, mlLimiter } = require('../middleware/rateLimiter');
const { generateAuthenticityProof } = require('../controllers/proof');
const { verifyMedia, analyzeMetadata } = require('../controllers/verify');

/**
 * POST /api/media/generate-proof
 * Generate authenticity proof from sensor data
 */
router.post(
  '/generate-proof',
  proofLimiter,
  validateGenerateProof,
  handleValidationErrors,
  generateAuthenticityProof
);

/**
 * POST /api/media/verify
 * Verify media authenticity
 */
router.post(
  '/verify',
  verifyLimiter,
  validateVerifyMedia,
  handleValidationErrors,
  verifyMedia
);

/**
 * POST /api/media/analyze-metadata
 * ML-powered metadata analysis: AI-generated vs real camera
 * Uses its own 20mb JSON body limit (base64 images can be ~13MB)
 * and its own tighter rate limiter.
 */
router.post(
  '/analyze-metadata',
  express.json({ limit: '20mb' }),   // route-level override — larger than global 10mb
  mlLimiter,
  validateAnalyzeMetadata,
  handleValidationErrors,
  analyzeMetadata
);

module.exports = router;

