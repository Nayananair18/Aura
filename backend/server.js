const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimiter');

// Ensure logs/ directory exists (required by Winston file transports in production)
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Import routes
const mediaRoutes = require('./routes/media');
const verificationRoutes = require('./routes/verification');

const app = express();

const dns = require('dns');

// Use reliable public DNS for MongoDB SRV resolution (fixes Windows/ISP ECONNREFUSED on SRV records)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  logger.warn(`DNS server configuration skipped: ${dnsErr.message}`);
}

const connectDatabase = async () => {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('✅ MongoDB connected successfully');
    logger.info(`Database: ${config.mongodbUri}`);
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    logger.warn('Running without database persistence (mock API mode)');
  }
};

// ==================== MIDDLEWARE ====================

// Compression (before other middleware)
app.use(compression());

// Security headers
app.use(helmet());

// CORS — credentials:true requires an explicit allowed origin list (never '*')
app.use(cors({
  origin: config.debug ? config.corsOrigin : config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: !config.debug, // credentials only when we have explicit origins
  optionsSuccessStatus: 200,
}));

// Body parsing — 10mb max to cover base64 images from mobile without OOM risk
app.use(bodyParser.json({ limit: config.maxRequestSize }));
app.use(bodyParser.urlencoded({ limit: config.maxRequestSize, extended: true }));

// HTTP request logging (single logger using morgan + winston stream)
app.use(morgan(config.debug ? 'dev' : 'combined', { stream: logger.stream }));

// Global rate limiter
app.use('/api', globalLimiter);

// ==================== ROUTES ====================

app.use('/api/media', mediaRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'AURA API',
    version: '1.0.0',
    description: 'A.U.R.A. Media Authenticity Verification Backend',
    endpoints: {
      health: 'GET /health',
      ping: 'GET /api/ping',
      generateProof: 'POST /api/media/generate-proof',
      verifyMedia: 'POST /api/media/verify',
      analyzeMetadata: 'POST /api/media/analyze-metadata',
      storeResult: 'POST /api/verification/store',
      getHistory: 'GET /api/verification/history',
    },
  });
});

// Client connection heartbeat
app.get('/api/ping', (req, res) => {
  logger.debug(`Heartbeat received from: ${req.ip}`);
  res.json({
    status: 'connected',
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'A.U.R.A. API Server',
    version: '1.0.0',
    status: 'running',
    docs: 'GET /api',
  });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    // Only expose error details in development
    error: config.debug ? { message: err.message, stack: err.stack } : undefined,
  });
});

// ==================== SERVER START ====================

const PORT = config.port;

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

let server;

const startServer = async () => {
  await connectDatabase();

  const localIP = getLocalIP();
  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('');
    logger.info('╔════════════════════════════════════════════╗');
    logger.info('║      🛡️  A.U.R.A. Backend Server          ║');
    logger.info('╚════════════════════════════════════════════╝');
    logger.info(`✅ Server running on LAN: http://${localIP}:${PORT}`);
    logger.info(`🏠 Local address: http://localhost:${PORT}`);
    logger.info(`📝 API Documentation: http://${localIP}:${PORT}/api`);
    logger.info(`🌍 Environment: ${config.nodeEnv}`);
    logger.info(`🛡️  A.U.R.A. Defense Engine: ACTIVE`);
  });
};

// ==================== GRACEFUL SHUTDOWN ====================

const shutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
      }
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ==================== PROCESS ERROR GUARDS ====================

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason?.message || reason}`, { reason });
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception — shutting down: ${error?.message || error}`, { stack: error?.stack });
  process.exit(1);
});

startServer();

module.exports = app;
