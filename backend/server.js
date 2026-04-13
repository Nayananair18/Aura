const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const config = require('./config/config');

// Import routes
const mediaRoutes = require('./routes/media');
const verificationRoutes = require('./routes/verification');

const app = express();

// ==================== DATABASE CONNECTION ====================

const connectDatabase = async () => {
  try {
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
    console.log(`Database: ${config.mongodbUri}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Using mock API mode without database persistence');
  }
};

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Body parsing
app.use(bodyParser.json({ limit: config.maxRequestSize }));
app.use(bodyParser.urlencoded({ limit: config.maxRequestSize, extended: true }));

// ==================== REQUEST LOGGING ====================

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== ROUTES ====================

// API Routes
app.use('/api/media', mediaRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'RealityProof API',
    version: '1.0.0',
    description: 'Media Authenticity Verification Backend',
    endpoints: {
      health: 'GET /health',
      generateProof: 'POST /api/media/generate-proof',
      verifyMedia: 'POST /api/media/verify',
      storeResult: 'POST /api/verification/store',
      getHistory: 'GET /api/verification/history',
    },
    docs: 'http://localhost:3001/api/docs',
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'RealityProof API Server',
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
  console.error('Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    error: config.debug ? err : undefined,
  });
});

// ==================== SERVER START ====================

const PORT = config.port;

// Connect to database before starting server
connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🛡️  RealityProof Backend Server      ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    console.log('');
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`CORS Origins: ${config.corsOrigin.join(', ')}`);
    console.log('');
  });
}).catch(err => {
  console.error('Failed to start server:', err.message);
});

// Handle uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
