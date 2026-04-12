const express = require('express');
const router = express.Router();
const {
  validateGenerateProof,
  validateVerifyMedia,
  handleValidationErrors,
} = require('../middleware/validation');
const { generateAuthenticityProof } = require('../controllers/proof');
const { verifyMedia } = require('../controllers/verify');

/**
 * POST /api/media/generate-proof
 * Generate authenticity proof from sensor data
 */
router.post(
  '/generate-proof',
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
  validateVerifyMedia,
  handleValidationErrors,
  verifyMedia
);

module.exports = router;
