# 🚀 Backend Setup Instructions

Follow these steps to set up and run the RealityProof backend server.

## Prerequisites

- **Node.js** v14+ (Download from https://nodejs.org/)
- **npm** (comes with Node.js)
- Command line/Terminal

## Step 1: Navigate to Backend Folder

```bash
cd d:\Projects\Java_Script\Apps\AURA\backend
```

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages:
- **express** - Web framework
- **cors** - Cross-origin requests
- **dotenv** - Environment variables
- **helmet** - Security headers
- **express-validator** - Input validation
- **uuid** - Unique IDs
- **nodemon** - Auto-reload (dev)

**Expected Output:**
```
added 50+ packages in 5s
```

## Step 3: Create Environment File

Option A: Copy the example
```bash
copy .env.example .env
```

Option B: Create `.env` manually with defaults:
```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8082,http://localhost:8081
```

## Step 4: Start the Server

### Option A: Development Mode (Recommended)
```bash
npm run dev
```
- Auto-reloads on file changes
- Shows detailed error messages
- Better for development

### Option B: Production Mode
```bash
npm start
```
- Standard server
- Production-ready
- Less verbose

## Step 5: Verify It Works

When the server starts, you'll see:

```
╔════════════════════════════════════════════╗
║     🛡️  RealityProof Backend Server      ║
╚════════════════════════════════════════════╝

✅ Server running on http://localhost:3001
📝 API Documentation: http://localhost:3001/api
❤️  Health Check: http://localhost:3001/health

Environment: development
CORS Origins: http://localhost:8082, http://localhost:8081

Endpoints:
  POST /api/media/generate-proof
  POST /api/media/verify
  POST /api/verification/store
  GET  /api/verification/history
```

## Step 6: Test the API

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T15:30:00.000Z",
  "uptime": 10.5
}
```

## Step 7: Connect Frontend

The frontend will automatically work with the backend when:

1. Backend is running on `http://localhost:3001`
2. Frontend is running on `http://localhost:8082`

To switch frontend from mock API to real backend:

Edit `src/services/api.js` in the frontend:
```javascript
// Line 5-6
const API_BASE_URL = 'http://localhost:3001/api';
const USE_MOCK_API = false; // Change to false
```

## 🧪 Test Complete Flow

### Terminal 1: Start Backend
```bash
cd d:\Projects\Java_Script\Apps\AURA\backend
npm run dev
```

Wait for "✅ Server running" message

### Terminal 2: Start Frontend
```bash
cd d:\Projects\Java_Script\Apps\AURA\frontend
npm start
# Press 'w' for web
```

### Terminal 3: Optional - Test API
```bash
# Test health
curl http://localhost:3001/health

# Test generate proof (requires JSON)
curl -X POST http://localhost:3001/api/media/generate-proof \
  -H "Content-Type: application/json" \
  -d '{"sensorData":{"accelerometer":[]},"metadata":{"deviceId":"TEST"}}'
```

### Browser: Test Frontend
1. Visit http://localhost:8082
2. Try "Capture Media" or "Verify Media"
3. Backend will receive requests!

## 🔧 Configuration Options

### Change Port
Edit `.env`:
```
PORT=3002
```

### Change Frontend URL
Edit `.env`:
```
CORS_ORIGIN=http://192.168.1.100:8082
```

### Enable Debug Logging
Set NODE_ENV to development (already set by default)

## 📊 Project Structure

```
backend/
├── server.js              ← Main server
├── package.json           ← Dependencies
├── .env                   ← Your config (after setup)
├── .env.example           ← Config template
├── README.md              ← Full documentation
│
├── config/
│   └── config.js         ← Load .env settings
│
├── middleware/
│   └── validation.js     ← Validate requests
│
├── controllers/
│   ├── proof.js          ← Generate proof logic
│   └── verify.js         ← Verify logic
│
├── routes/
│   ├── media.js          ← /api/media/* routes
│   └── verification.js   ← /api/verification/* routes
│
└── utils/
    └── crypto.js         ← SHA256, hashing
```

## ✅ Verification Checklist

- [ ] Node.js installed (`node --version`)
- [ ] In backend folder (`cd backend`)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created
- [ ] Server starts (`npm run dev`)
- [ ] Health check works (`curl http://localhost:3001/health`)
- [ ] Frontend connects without errors

## 🐛 Troubleshooting

### Error: "Cannot find module 'express'"
```bash
npm install
```

### Error: "EADDRINUSE: address already in use :::3001"
Another process is using port 3001. Either:
- Kill that process
- Change PORT in `.env` to 3002

### Error: "CORS error" in frontend
Verify in `.env`:
- Frontend is running on the correct port
- CORS_ORIGIN includes that port

### Error: "Cannot read property 'charAt' of undefined"
Your `.env` file is missing. Copy from `.env.example`:
```bash
copy .env.example .env
```

### Frontend shows mock data instead of backend data
Check that:
1. Backend is running (`npm run dev`)
2. Frontend has `USE_MOCK_API = false` in `src/services/api.js`
3. Frontend has correct API URL: `http://localhost:3001/api`

## 📚 API Quick Reference

```bash
# Health check
GET http://localhost:3001/health

# API docs
GET http://localhost:3001/api

# Generate proof
POST http://localhost:3001/api/media/generate-proof
Body: { sensorData, metadata }

# Verify media
POST http://localhost:3001/api/media/verify
Body: { fileHash, metadata, uploadedMediaHash }

# Store result
POST http://localhost:3001/api/verification/store
Body: { mediaHash, verificationResult, metadata }

# Get history
GET http://localhost:3001/api/verification/history
```

## 🎓 What's Running

Your backend now:
- ✅ Listens on http://localhost:3001
- ✅ Accepts requests from the frontend
- ✅ Generates authenticity proofs
- ✅ Verifies media authenticity
- ✅ Handles errors gracefully
- ✅ Logs important events
- ✅ Validates all inputs

## 🚀 Next Steps

1. **Test the Flow**: Use frontend to capture/verify
2. **Monitor Logs**: Watch backend console for requests
3. **Add Database**: Eventually MongoDB for persistence
4. **Enhance Security**: Add authentication when needed
5. **Deploy**: Move to production server

## 📝 For Production

When deploying to production:

1. Change `NODE_ENV=production` in `.env`
2. Set `CORS_ORIGIN` to your frontend domain
3. Use a process manager (PM2)
4. Add monitoring and logging
5. Enable HTTPS
6. Set up database

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name realityproof
```

## 💡 Tips

- Keep backend running while testing
- Check console for detailed error messages
- API returns JSON for easy debugging
- All timestamps are ISO 8601 format
- Hash values are SHA-256 hex strings

---

**Backend is ready to verify media authenticity!** 🛡️

For more details, see [README.md](README.md)
