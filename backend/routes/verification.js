const express = require('express');
const router = express.Router();
const {
  validateStoreResult,
  handleValidationErrors,
} = require('../middleware/validation');
const {
  storeVerificationResult,
  getVerificationHistory,
} = require('../controllers/verify');

/**
 * POST /api/verification/store
 * Store verification result
 */
router.post(
  '/store',
  validateStoreResult,
  handleValidationErrors,
  storeVerificationResult
);

/**
 * GET /api/verification/history
 * Get verification history
 */
router.get(
  '/history',
  getVerificationHistory
);

module.exports = router;
