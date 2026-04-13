# Photo Capture & Google Drive Integration Guide

## 🎥 Features Implemented

✅ **Real Camera Integration**
- Live camera preview with crosshair overlay
- Tap to capture photos
- Auto-save to local device storage
- Quality: 95% JPEG with EXIF data

✅ **Local Storage**
- Photos saved to `RealityProof/` directory
- Metadata stored in JSON format
- Storage usage tracking
- Easily delete captured photos

✅ **Google Drive Integration**
- OAuth 2.0 authentication support
- Upload photos directly to Google Drive
- Secure token storage
- Demo mode for testing without Google account

✅ **Sensor Data Collection**
- Accelerometer, Gyroscope, Magnetometer
- Real-time sensor statistics
- Collected while capturing photo

## 🔧 Setup Instructions

### 1. Install Required Packages

The following are already installed:
```bash
expo-camera          # Camera access
expo-file-system     # Local file storage
expo-media-library   # Media library integration
expo-secure-store    # Secure token storage
```

### 2. Configure Google Drive OAuth (Optional)

For production use, set up Google OAuth 2.0:

#### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable "Google Drive API"
4. Create OAuth 2.0 credentials:
   - Application type: iOS/Android
   - Restricted to: Google Drive

#### Step 2: Add Environment Variables
Create `.env` in frontend directory:
```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your_client_secret
```

#### Step 3: Update App.json
```json
{
  "expo": {
    "scheme": "realityproof",
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow RealityProof to access your camera"
        }
      ]
    ]
  }
}
```

### 3. Run the App

```bash
cd frontend
npm start

# Run on:
# - iOS: Press 'i'
# - Android: Press 'a'
# - Web: Press 'w'
```

## 📸 How to Capture Photos

### Step-by-Step:

1. **Open App** → Navigate to "Capture" tab
2. **Grant Permissions**
   - Camera access (tap "Allow")
   - Optional: Google Drive (automatic if configured)

3. **Start Capture**
   - Tap "Start Capture" button
   - Keep phone steady
   - Sensors will start collecting data

4. **Take Photo**
   - Frame your subject in the camera view
   - Yellow crosshair shows capture area
   - Tap the white capture button (circle) at bottom
   - Photo is automatically saved

5. **Auto-Save Process**
   - Photo saved to local storage instantly
   - ~500ms: Uploaded to Google Drive (if configured)
   - ~2 sec: Authenticity proof generated
   - Auto-navigates to result screen

6. **Review Results**
   - View captured photo
   - See authenticity proof
   - Check sensor data collected
   - Share or delete

## 📁 File Storage Structure

### Local Storage Location
```
RealityProof/
  └── photo_1712984625000.jpg          # Captured photo
  └── metadata_1712984625000.json      # Photo metadata
  └── photo_1712984631234.jpg          # Another photo
  └── metadata_1712984631234.json      # Metadata
```

### Metadata Structure
```json
{
  "photoUri": "file://...",
  "fileName": "photo_1712984625000.jpg",
  "fileSize": 2048576,
  "driveFileId": "1AbC...",
  "driveLink": "https://drive.google.com/file/d/1AbC.../view",
  "uploadedAt": "2026-04-13T10:30:00.000Z",
  "isDemoMode": false,
  "savedAt": "2026-04-13T10:30:00.000Z"
}
```

## 🌐 Google Drive Integration

### Authentication Flow

1. **First Launch**
   - Check if token exists in secure storage
   - If not, use demo mode (local storage only)

2. **Adding Real Google Account**
   - Update `.env` with credentials
   - Restart app
   - Photos auto-upload to your Google Drive

3. **Manual Upload**
   ```javascript
   import * as GoogleDrive from '../services/googleDriveService';
   
   const result = await GoogleDrive.uploadToGoogleDrive(
     fileUri,
     'photo.jpg',
     'image/jpeg'
   );
   
   console.log(result.driveLink); // Open in browser
   ```

### Demo Mode vs Real Mode

**Demo Mode** (Default - No Config)
- ✓ Photos saved locally
- ✗ Not uploaded to Google Drive
- Perfect for testing without account

**Real Mode** (With Google OAuth)
- ✓ Photos saved locally AND to Google Drive
- ✓ Accessible from any device
- ✓ Secure authentication
- ✓ Cloud backup

## 🛠️ API Reference

### Photo Capture
```javascript
// Save captured photo locally
const photo = await FileService.saveCapturedPhoto(photoUri);
// Returns: { uri, name, size, mimeType, timestamp }

// Upload to Google Drive
const result = await GoogleDrive.uploadToGoogleDrive(
  photoUri,
  'photo.jpg',
  'image/jpeg'
);
// Returns: { success, fileId, driveLink, ... }
```

### Local Storage Management
```javascript
// List all captured photos
const photos = await FileService.listCapturedPhotos();

// Get storage usage
const usage = await FileService.getStorageUsage();
console.log(usage.totalSizeInMB); // "25.5"

// Delete a photo
await FileService.deleteCapturedPhoto(photoUri);

// Clear all storage
await FileService.clearLocalStorage();
```

### Authentication
```javascript
// Check if authenticated
const isAuth = await GoogleDrive.isAuthenticated();

// Get stored token
const token = await GoogleDrive.getGoogleDriveToken();

// Logout
await GoogleDrive.logout();
```

## 📱 Camera Permissions

### iOS
- Camera: Required
- Photo Library: Optional (for gallery access)

### Android
- CAMERA
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE

### Web
- Not supported (camera not available in web)

## 🔒 Security Notes

1. **Token Storage** - Uses `expo-secure-store` (encrypted)
2. **HTTPS Only** - All Google Drive API calls use HTTPS
3. **Permissions** - App only requests necessary permissions
4. **User Control** - Easy logout option

## 🐛 Troubleshooting

### Camera Not Working
```
Problem: "Camera permission denied"
Solution:
- iOS: Settings → RealityProof → Camera → Allow
- Android: Settings → Apps → RealityProof → Permissions → Camera
```

### Google Drive Upload Failed
```
Problem: "Failed to upload to Google Drive"
Solution:
1. Check `.env` for correct credentials
2. Verify Google Drive API is enabled
3. Check internet connection
4. Restart app - will use local storage fallback
```

### Photos Not Saving
```
Problem: "Error saving captured photo"
Solution:
1. Check storage space on device
2. Verify RealityProof folder permissions
3. Restart the app
4. Clear app cache: Settings → Apps → RealityProof → Storage → Clear Cache
```

### Storage Full
```
// Check usage
const usage = await FileService.getStorageUsage();
if (usage.totalSizeInMB > 100) {
  // Delete old photos
  await FileService.clearLocalStorage();
}
```

## 📊 Performance Tips

1. **Capture Quality** - Images captured at 95% quality (balance size/quality)
2. **Async Upload** - Photos upload in background
3. **Batch Operations** - List/delete multiple photos efficiently
4. **Secure Storage** - Tokens encrypted locally

## 🚀 Next Steps

1. ✅ Test photo capture in app
2. ✅ Verify local storage saving
3. ✅ Configure Google OAuth (optional)
4. ✅ Test Google Drive upload
5. ⏳ Add camera roll gallery view
6. ⏳ Implement batch uploads
7. ⏳ Add image editing features

## 📚 Related Files

- [CameraComponent.js](src/components/CameraComponent.js) - Camera UI
- [googleDriveService.js](src/services/googleDriveService.js) - Drive integration
- [fileService.js](src/services/fileService.js) - File operations
- [CaptureScreen.js](src/screens/CaptureScreen.js) - Main capture screen

---

**Questions?** Check the [SETUP_AND_TESTING.md](SETUP_AND_TESTING.md) for more details.
