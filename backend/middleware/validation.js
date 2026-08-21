const { body, validationResult } = require('express-validator');

/**
 * Validate generate proof request (supports all 6 sensor types)
 */
const validateGenerateProof = [
  body('mediaData').optional(),
  body('sensorData').optional(),
  body('telemetry').optional(),
  body('metadata').optional(),
];

/**
 * Validate verify media request
 * Supports both Proof ID lookup and direct media hash/image upload verification
 */
const validateVerifyMedia = [
  body('proofId').optional({ nullable: true }).isString().trim(),
  body('fileHash').optional({ nullable: true }),
  body('uploadedMediaHash').optional({ nullable: true }),
  body('metadata').optional({ nullable: true }).isObject().withMessage('Metadata must be an object'),
  body('metadata.fileName').optional({ nullable: true }),
];

/**
 * Validate store result request
 */
const validateStoreResult = [
  body('mediaHash').notEmpty().withMessage('Media hash is required'),
  body('verificationResult').isObject().withMessage('Verification result is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
];

/**
 * Validate ML metadata analysis request
 */
const validateAnalyzeMetadata = [
  body('image').optional(),
  body('fileName').optional().isString().trim(),
  body('fileType').optional().isString().trim(),
];

/**
 * Validate decode QR request
 */
const validateDecodeQr = [
  body('image')
    .notEmpty().withMessage('image is required')
    .isString().withMessage('image must be a base64 string'),
];

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  validateGenerateProof,
  validateVerifyMedia,
  validateStoreResult,
  validateAnalyzeMetadata,
  validateDecodeQr,
  handleValidationErrors,
};
