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
 * ML-powered KNN metadata analysis: AI-generated vs real camera
 * Body limit is controlled globally via MAX_REQUEST_SIZE env var (default 20mb).
 */
router.post(
  '/analyze-metadata',
  mlLimiter,
  validateAnalyzeMetadata,
  handleValidationErrors,
  analyzeMetadata
);

module.exports = router;
