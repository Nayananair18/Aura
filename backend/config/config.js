require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/realityproof',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8082', 'http://localhost:8081'],
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Server settings
  requestTimeout: 30000,
  maxRequestSize: '100mb',
  
  // Authenticity thresholds
  sensorConfidenceThreshold: 0.90,
  hashMatchThreshold: 0.95,
  
  // Debug
  debug: process.env.NODE_ENV === 'development',
};
