# 🛡️ RealityProof Backend Server

Complete Node.js/Express backend for the RealityProof media authenticity verification app.

## 📋 Features

✅ **Media Authenticity Proof Generation**
- Sensor data validation and processing
- Cryptographic SHA-256 hashing
- Device fingerprinting
- Real-time confidence scoring

✅ **Media Verification**
- Hash comparison and validation
- Tampering detection
- Result persistance
- Verification history tracking

✅ **Security**
- CORS configuration
- Input validation with express-validator
- Helmet.js security headers
- Error handling and logging

✅ **API Endpoints**
- POST `/api/media/generate-proof` - Generate authenticity proof
- POST `/api/media/verify` - Verify media authenticity
- POST `/api/verification/store` - Store verification result
- GET `/api/verification/history` - Get verification history

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd d:\Projects\Java_Script\Apps\AURA\backend
npm install
```

### 2. Setup Environment
```bash
# Copy the example env file
copy .env.example .env

# Edit .env if needed (optional - defaults work)
```

### 3. Start the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Verify It's Running
```
✅ Server running on http://localhost:3001
❤️  Health Check: http://localhost:3001/health
📝 API Documentation: http://localhost:3001/api
```

## 📚 API Documentation

### Health Check
```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2026-04-12T15:30:00.000Z",
  "uptime": 123.45
}
```

### Generate Authenticity Proof
```bash
POST /api/media/generate-proof

Request:
{
  "mediaData": null,
  "sensorData": {
    "accelerometer": [...],
    "gyroscope": [...],
    "magnetometer": [...]
  },
  "metadata": {
    "deviceId": "DEVICE_ABC123",
    "timestamp": "2026-04-12T15:30:00.000Z",
    "capturedAt": 1712984625000
  }
}

Response:
{
  "success": true,
  "proof": {
    "id": "PROOF_uuid",
    "hash": "sha256_...",
    "deviceFingerprint": "sha256_...",
    "sensorValidation": { ... },
    "sensorStats": { ... },
    "sensorConfidence": {
      "accelerometer": 98.5,
      "gyroscope": 97.2,
      "magnetometer": 96.8,
      "light": 95.0
    },
    "timestamp": "2026-04-12T15:30:00.000Z",
    "deviceId": "DEVICE_ABC123"
  },
  "overallConfidence": "97.1",
  "message": "Authenticity proof generated successfully"
}
```

### Verify Media
```bash
POST /api/media/verify

Request:
{
  "fileHash": "sha256_...",
  "metadata": {
    "fileName": "photo.jpg",
    "fileType": "image/jpeg",
    "fileSize": 2458624,
    "uploadedAt": "2026-04-12T15:30:00.000Z"
  },
  "uploadedMediaHash": "sha256_..."
}

Response:
{
  "success": true,
  "verification": {
    "verificationId": "VERIF_uuid",
    "status": "authentic",
    "confidence": 99.7,
    "hashValidation": {
      "status": "match",
      "originalHash": "sha256_abc123...",
      "uploadedHash": "sha256_abc123...",
      "matchPercentage": 100
    },
    "sensorValidation": "passed",
    "metadataConsistency": "consistent",
    "timestamp": "2026-04-12T15:30:00.000Z",
    "fileInfo": {
      "fileName": "photo.jpg",
      "fileType": "image/jpeg",
      "fileSize": 2458624,
      "uploadedAt": "2026-04-12T15:30:00.000Z"
    }
  },
  "message": "Media is authentic"
}
```

### Store Verification Result
```bash
POST /api/verification/store

Request:
{
  "mediaHash": "sha256_...",
  "verificationResult": { ... },
  "metadata": {
    "fileName": "photo.jpg",
    "timestamp": "2026-04-12T15:30:00.000Z"
  }
}

Response:
{
  "success": true,
  "resultId": "RESULT_uuid",
  "message": "Verification result stored successfully",
  "storedAt": "2026-04-12T15:30:00.000Z"
}
```

### Get Verification History
```bash
GET /api/verification/history?limit=10&skip=0

Response:
{
  "success": true,
  "history": [
    {
      "id": "RESULT_1712984400000",
      "status": "authentic",
      "timestamp": "2026-04-12T14:30:00.000Z",
      "hash": "sha256_abc123def456",
      "confidence": 99.7
    }
  ],
  "total": 2,
  "message": "Verification history retrieved successfully"
}
```

## 📁 Project Structure

```
backend/
├── server.js                 # Main Express app
├── package.json              # Dependencies
├── .env.example              # Environment variables template
│
├── config/
│   └── config.js            # Configuration settings
│
├── middleware/
│   └── validation.js        # Request validation
│
├── controllers/
│   ├── proof.js             # Proof generation logic
│   └── verify.js            # Verification logic
│
├── routes/
│   ├── media.js             # Media endpoints
│   └── verification.js      # Verification endpoints
│
└── utils/
    └── crypto.js            # Cryptographic utilities
```

## 🔧 Configuration

Edit `.env` file to customize:

```env
PORT=3001                              # Server port
NODE_ENV=development                   # Environment
MONGODB_URI=mongodb://...             # Database URL (when ready)
CORS_ORIGIN=http://localhost:8082     # Frontend URL
LOG_LEVEL=debug                        # Logging level
```

## 🧪 Testing with Frontend

1. **Start Backend**
```bash
cd d:\Projects\Java_Script\Apps\AURA\backend
npm run dev
```

2. **Start Frontend** (in another terminal)
```bash
cd d:\Projects\Java_Script\Apps\AURA\frontend
npm start
# Press 'w' for web
```

3. **Update Frontend API URL** (optional if not using localhost:3001)

Edit `src/services/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:3001/api';
const USE_MOCK_API = false; // Switch to real backend
```

4. **Test the Flow**
- Use frontend to capture or verify media
- Backend will receive requests on http://localhost:3001
- Check console for logs

## 📊 Verification Logic

### Authentic Status
- Hash **exactly matches** previous capture
- Sensor data is **valid** and **consistent**
- Metadata is **consistent**
- **Status**: `authentic` with 99.7%+ confidence

### Tampered Status
- Hash **does not match**
- Sensor patterns **inconsistent**
- Metadata **changed**
- **Status**: `tampered` with 10-50% confidence

## 🔐 Security Features

✅ **Cryptographic Hashing** - SHA-256
✅ **Device Fingerprinting** - Unique device ID
✅ **Input Validation** - express-validator
✅ **CORS Protection** - Configurable origins
✅ **Helmet.js** - Security headers
✅ **Error Handling** - Comprehensive error management

## 🚦 API Response Format

All endpoints follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## 🛠️ Development

### Available Commands
```bash
npm start           # Start production server
npm run dev         # Start with auto-reload (requires nodemon)
npm test            # Run tests (when configured)
```

### Debug Mode
Set `NODE_ENV=development` to see detailed error messages.

### Adding New Endpoints

1. Create controller in `controllers/`
2. Create route in `routes/`
3. Add to main router in `server.js`
4. Add validation in `middleware/validation.js`

## 📈 Future Enhancements

- [ ] MongoDB integration for data persistence
- [ ] User authentication & authorization
- [ ] Rate limiting
- [ ] Advanced analytics
- [ ] WebSocket support for real-time updates
- [ ] Machine learning for tampering detection
- [ ] Video file support
- [ ] Blockchain integration for immutable proofs

## 🐛 Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Port 3001 already in use"
```bash
# Change port in .env
PORT=3002
```

### "CORS error"
```bash
# Check CORS_ORIGIN in .env matches frontend URL
CORS_ORIGIN=http://localhost:8082
```

### "Frontend can't connect"
```bash
# Make sure backend is running
# Check that API_BASE_URL in frontend matches backend URL
# Verify network connectivity
```

## 📝 Logging

Backend logs important events:
- Server startup/shutdown
- Request method, path, timestamp
- Errors and exceptions
- Proof generation results
- Verification results

Check console output for logs during development.

## 🎓 Learning Resources

- `server.js` - Entry point and middleware setup
- `routes/` - API endpoint definitions
- `controllers/` - Business logic
- `utils/crypto.js` - Cryptographic functions
- `middleware/validation.js` - Input validation patterns

## 📞 Support

For issues or questions:
1. Check the error message in console
2. Review API documentation above
3. Check frontend configuration
4. Enable debug mode (`NODE_ENV=development`)

## 📄 License

MIT

---

**Ready to verify media authenticity!** 🛡️
