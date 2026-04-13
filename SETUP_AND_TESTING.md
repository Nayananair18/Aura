# AURA App - Setup & Testing Guide

## 🚀 Current Status
✅ Backend connected to MongoDB  
✅ Frontend switched from mock API to real backend  
✅ Database models created (Proof, VerificationResult)  
✅ Controllers updated to use database  

## 📋 Prerequisites

### Required
- Node.js 16+ (https://nodejs.org)
- MongoDB (https://www.mongodb.com/try/download/community)
- npm or yarn package manager

### Optional
- Postman (for API testing)
- MongoDB Compass (for viewing database)

## 🔧 Installation & Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start MongoDB (in a separate terminal)
# Windows:
mongod

# macOS/Linux:
brew services start mongodb-community
# or
mongod --dbpath /usr/local/var/mongodb
```

### 2. Start the Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Expected output:
# ✅ MongoDB connected successfully
# ✅ Server running on http://localhost:3001
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the app (via Expo)
npm start

# Follow on-screen prompts to run on:
# - iOS Simulator (press 'i')
# - Android Emulator (press 'a')
# - Web (press 'w')
```

## 🧪 Testing the Integration

### API Verification Endpoints

#### 1. Health Check
```bash
curl http://localhost:3001/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-04-13T10:30:00.000Z",
  "uptime": 120.45
}
```

#### 2. Generate Authenticity Proof
```bash
curl -X POST http://localhost:3001/api/media/generate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "mediaData": null,
    "sensorData": {
      "accelerometer": [0.1, 0.2, 0.3],
      "gyroscope": [0.4, 0.5, 0.6],
      "magnetometer": [0.7, 0.8, 0.9]
    },
    "metadata": {
      "deviceId": "DEVICE_ABC123",
      "timestamp": "2026-04-13T10:30:00.000Z",
      "capturedAt": '$(date +%s)000'
    }
  }'
```

#### 3. Verify Media
```bash
curl -X POST http://localhost:3001/api/media/verify \
  -H "Content-Type: application/json" \
  -d '{
    "fileHash": "abc123def456",
    "uploadedMediaHash": "abc123def456",
    "metadata": {
      "fileName": "photo.jpg",
      "fileType": "image/jpeg",
      "fileSize": 2048
    }
  }'
```

#### 4. Get Verification History
```bash
curl http://localhost:3001/api/verification/history?limit=10&skip=0

# Response:
{
  "success": true,
  "history": [...],
  "total": 5,
  "message": "Verification history retrieved successfully"
}
```

## 📱 Frontend Testing

### Key Flows to Test

#### 1. Capture Screen
- Navigate to "Capture" screen
- Tap "Start Capture" to collect sensor data
- Sensor stats should update in real-time
- Tap "Generate Proof" to create authenticity proof
- Verify in backend: `db.proofs.find()`

#### 2. Verification Screen
- Navigate to "Verification" screen
- Upload a media file
- Tap "Verify" to check authenticity
- Results should show from backend verification

#### 3. Check History
- View verification history from previous verifications
- Should fetch from backend database

## 🗄️ Database Management

### View Data with MongoDB Compass
1. Open MongoDB Compass
2. Connect to: `mongodb://localhost:27017`
3. Browse collections:
   - `proofs` - Generated authenticity proofs
   - `verificationresults` - Verification results

### View Data with MongoDB CLI
```bash
mongosh

# Switch to database
use realityproof

# View proofs
db.proofs.find().pretty()

# View verification results
db.verificationresults.find().pretty()

# Count documents
db.proofs.countDocuments()
db.verificationresults.countDocuments()

# Clear all data (WARNING: Irreversible!)
db.proofs.deleteMany({})
db.verificationresults.deleteMany({})
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
```
Error: connect ECONNREFUSED
Fix: Ensure MongoDB is running
- Windows: mongod
- macOS: brew services start mongodb-community
```

### Port Already in Use
```
Error: EADDRINUSE: address already in use :::3001
Fix: Kill process on port 3001
- Windows: netstat -ano | findstr :3001
- macOS/Linux: lsof -i :3001 | kill -9 <PID>
```

### Frontend Can't Connect to Backend
```
Check:
1. Backend is running on http://localhost:3001
2. Device is on same network (for physical testing)
3. Update API_BASE_URL in frontend/.env if needed
4. Check CORS settings in backend/config/config.js
```

### Clear All Data
```bash
# Clear database
mongosh realityproof --eval "db.dropDatabase()"

# Clear cache (frontend)
npm cache clean --force
rm -rf node_modules
npm install
```

## 📊 Environment Configuration

### Backend (.env)
```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/realityproof
CORS_ORIGIN=http://localhost:8082,http://localhost:8081
```

### Frontend (.env)
```
REACT_NATIVE_API_BASE_URL=http://localhost:3001/api
REACT_NATIVE_APP_ENV=development
```

## ✅ Verification Checklist

- [ ] MongoDB is installed and running
- [ ] Backend npm packages installed
- [ ] Frontend npm packages installed
- [ ] Backend server starts without errors
- [ ] Health check responds (GET /health)
- [ ] Frontend can load without connection errors
- [ ] Can generate proof from Capture screen
- [ ] Can verify media from Verification screen
- [ ] Data persists in MongoDB after refresh
- [ ] Verification history shows previous results

## 📝 Next Steps

1. **Testing** - Run through all flows above
2. **Deployment** - Set up for production environment
3. **Improvements** - Add camera integration, better UI/UX
4. **Security** - Add authentication, rate limiting
5. **Monitoring** - Add logging, error tracking

## 🆘 Need Help?

Check logs:
```bash
# Backend logs
npm run dev

# Frontend logs
npm start

# MongoDB logs
mongosh
```

Good luck! 🚀
