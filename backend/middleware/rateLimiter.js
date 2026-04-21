const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,     // Disable `X-RateLimit-*` legacy headers
    message: {
      success: false,
      message,
      retryAfter: `${Math.ceil(windowMs / 60000)} minutes`,
    },
    handler: (req, res, next, options) => {
      res.status(429).json(options.message);
    },
  });

/**
 * Global limiter — applied to all API routes
 * 100 requests per 15 minutes per IP
 */
const globalLimiter = createLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMax,
  'Too many requests. Please try again later.'
);

/**
 * Proof generation limiter — computationally expensive (runs sharp + SHA-256)
 * 10 requests per 5 minutes per IP
 */
const proofLimiter = createLimiter(
  5 * 60 * 1000,
  10,
  'Too many proof generation requests. Please wait 5 minutes before trying again.'
);

/**
 * Verification limiter
 * 20 requests per 5 minutes per IP
 */
const verifyLimiter = createLimiter(
  5 * 60 * 1000,
  20,
  'Too many verification requests. Please wait 5 minutes before trying again.'
);

module.exports = { globalLimiter, proofLimiter, verifyLimiter };
