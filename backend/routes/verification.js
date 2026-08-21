const express = require('express');
const router = express.Router();
const {
  validateStoreResult,
  validateDecodeQr,
  handleValidationErrors,
} = require('../middleware/validation');
const { mlLimiter, verifyLimiter } = require('../middleware/rateLimiter');
const {
  storeVerificationResult,
  getVerificationHistory,
  decodeQrCode,
  verifyByProofId,
  verifyMedia,
} = require('../controllers/verify');

/**
 * GET /api/verify/proof/:proofId & GET /api/verification/proof/:proofId
 */
router.get(
  '/proof/:proofId',
  verifyLimiter,
  verifyByProofId
);

/**
 * POST /api/verify/proof-id & POST /api/verify/proof
 */
router.post(
  '/proof-id',
  verifyLimiter,
  verifyByProofId
);

router.post(
  '/proof',
  verifyLimiter,
  verifyByProofId
);

/**
 * POST /api/verify (alias to verifyMedia)
 */
router.post(
  '/',
  verifyLimiter,
  verifyMedia
);

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

/**
 * POST /api/verification/scan-qr & /api/verification/decode-qr
 */
router.post(
  '/scan-qr',
  mlLimiter,
  validateDecodeQr,
  handleValidationErrors,
  decodeQrCode
);

router.post(
  '/decode-qr',
  mlLimiter,
  validateDecodeQr,
  handleValidationErrors,
  decodeQrCode
);

module.exports = router;
