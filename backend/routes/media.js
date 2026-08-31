const express = require('express');
const router = express.Router();
const {
  validateGenerateProof,
  validateVerifyMedia,
  validateAnalyzeMetadata,
  validateDecodeQr,
  handleValidationErrors,
} = require('../middleware/validation');
const { proofLimiter, verifyLimiter, mlLimiter } = require('../middleware/rateLimiter');
const { generateAuthenticityProof, getProof } = require('../controllers/proof');
const { verifyMedia, verifyByProofId, decodeQrCode, analyzeMetadata } = require('../controllers/verify');

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
 * POST /api/media/decode-qr & /api/media/scan-qr
 */
router.post(
  '/decode-qr',
  mlLimiter,
  validateDecodeQr,
  handleValidationErrors,
  decodeQrCode
);

router.post(
  '/scan-qr',
  mlLimiter,
  validateDecodeQr,
  handleValidationErrors,
  decodeQrCode
);

/**
 * GET /api/media/proof/:proofId & GET /api/media/verify/:proofId
 */
router.get(
  '/proof/:proofId',
  getProof
);

router.get(
  '/verify/:proofId',
  verifyByProofId
);

/**
 * POST /api/media/analyze-metadata
 */
router.post(
  '/analyze-metadata',
  mlLimiter,
  validateAnalyzeMetadata,
  handleValidationErrors,
  analyzeMetadata
);

module.exports = router;
