require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/realityproof',
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:8082', 'http://localhost:8081'],
  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

  // Server settings — 20mb covers base64-encoded images from mobile (10MB JPEG ≈ 13.3MB base64)
  requestTimeout: 30000,
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '20mb',

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Authenticity thresholds
  sensorConfidenceThreshold: 0.90,
  hashMatchThreshold: 0.95,

  // Debug — only true in explicit development mode
  debug: process.env.NODE_ENV === 'development',
};
