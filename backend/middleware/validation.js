const { body, validationResult } = require('express-validator');

/**
 * Validate generate proof request (supports all 6 sensor types)
 */
const validateGenerateProof = [
  body('mediaData').optional(),
  body('sensorData').isObject().withMessage('Sensor data is required'),
  body('sensorData.accelerometer').isArray().optional(),
  body('sensorData.gyroscope').isArray().optional(),
  body('sensorData.magnetometer').isArray().optional(),
  body('sensorData.light').isArray().optional(),
  body('sensorData.location').isObject().optional(),
  body('sensorData.timestamp').isObject().optional(),
  body('metadata').isObject().withMessage('Metadata is required'),
  body('metadata.deviceId').notEmpty().withMessage('Device ID is required'),
  body('metadata.timestamp').notEmpty().withMessage('Timestamp is required'),
];

/**
 * Validate verify media request
 */
const validateVerifyMedia = [
  // fileHash and uploadedMediaHash are optional — proofId lookup or gallery uploads can send nullable fields
  body('fileHash').optional({ nullable: true }),
  body('metadata').optional({ nullable: true }),
  body('uploadedMediaHash').optional({ nullable: true }),
  body('proofId').optional({ nullable: true }),
  body('image').optional({ nullable: true }),
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
  body('image')
    .notEmpty().withMessage('image is required')
    .isString().withMessage('image must be a base64 string'),
  body('fileName').optional().isString().trim(),
  body('fileType').optional().isString().trim(),
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
  handleValidationErrors,
};
