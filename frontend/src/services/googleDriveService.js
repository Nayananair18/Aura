import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

// Feature flag — set EXPO_PUBLIC_GOOGLE_DRIVE_ENABLED=true in .env to enable
const DRIVE_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ENABLED === 'true';

// Replace with your actual Google Cloud Console Client IDs
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

export const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Check if Google Drive integration is configured and enabled.
 * We verify that a REAL (non-demo) token exists in SecureStore.
 */
export const isAuthenticated = async () => {
  if (!DRIVE_ENABLED) return false;
  try {
    const token = await SecureStore.getItemAsync('google_drive_token');
    // Reject demo tokens — they are NOT valid OAuth bearer tokens
    return token !== null && !token.startsWith('demo_token_');
  } catch {
    return false;
  }
};

const FOLDER_NAME = 'AURA Uploads';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const getOrCreateFolder = async (token) => {
  try {
    // 1. Search for the folder (only searches files created by the app due to drive.file scope)
    const query = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    
    // 2. Create the folder if it doesn't exist
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: FOLDER_MIME_TYPE
      })
    });
    const createData = await createRes.json();
    return createData.id;
  } catch (err) {
    console.error('[GoogleDrive] Failed to get/create folder:', err.message);
    return null; // Fallback to root directory if folder creation fails
  }
};

/**
 * Upload file to Google Drive.
 *
 * PRODUCTION GUARD: This function does NOT attempt any Google API calls
 * unless Drive is explicitly enabled AND a valid OAuth token exists.
 * Returning isDemoMode:true allows the caller to continue without errors.
 */
export const uploadToGoogleDrive = async (fileUri, fileName, mimeType = 'image/jpeg') => {
  // Guard 1: Feature must be explicitly enabled
  if (!DRIVE_ENABLED) {
    console.info('[GoogleDrive] Integration disabled (EXPO_PUBLIC_GOOGLE_DRIVE_ENABLED=false). Skipping upload.');
    return { success: true, isDemoMode: true, fileName, message: 'Google Drive integration is disabled.' };
  }

  // Guard 2: Must have a real OAuth token — no fake token is ever sent to Google
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    console.warn('[GoogleDrive] No valid OAuth token found. Skipping Drive upload (local fallback).');
    return {
      success: true,
      isDemoMode: true,
      fileId: null,
      fileName,
      webViewLink: fileUri,
      message: 'Google Drive not authenticated. File saved locally.',
    };
  }

  try {
    const token = await SecureStore.getItemAsync('google_drive_token');
    
    const folderId = await getOrCreateFolder(token);

    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });

    const metadata = {
      name: fileName,
      mimeType,
      properties: { app: 'AURA', capturedAt: new Date().toISOString() },
    };
    
    if (folderId) {
      metadata.parents = [folderId];
    }

    const boundary = '===============AURA_UPLOAD_BOUNDARY==';
    let body = `--${boundary}\r\n`;
    body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
    body += JSON.stringify(metadata);
    body += `\r\n--${boundary}\r\n`;
    body += `Content-Type: ${mimeType}\r\n`;
    body += 'Content-Transfer-Encoding: base64\r\n\r\n';
    body += fileContent;
    body += `\r\n--${boundary}--`;

    const uploadResult = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!uploadResult.ok) {
      const errText = await uploadResult.text();
      throw new Error(`Drive upload failed (${uploadResult.status}): ${errText}`);
    }

    const data = await uploadResult.json();
    console.log(`[GoogleDrive] ✅ Uploaded: ${data.id}`);

    return {
      success: true,
      isDemoMode: false,
      fileId: data.id,
      fileName: data.name,
      webViewLink: data.webViewLink,
      createdTime: data.createdTime,
    };
  } catch (error) {
    console.error('[GoogleDrive] Upload failed:', error.message);
    // Graceful fallback — don't crash the capture flow
    return {
      success: true,
      isDemoMode: true,
      fileId: null,
      fileName,
      webViewLink: fileUri,
      message: `Drive upload failed (${error.message}). File saved locally.`,
    };
  }
};

/**
 * Store a real OAuth token (call this from your OAuth callback screen).
 */
export const storeAuthToken = async (token) => {
  if (!token || token.startsWith('demo_token_')) {
    throw new Error('Will not store an invalid or demo token.');
  }
  await SecureStore.setItemAsync('google_drive_token', token);
};

/**
 * Helper hook / configuration for UI components to use.
 */
export const getDriveAuthConfig = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
  
  // We MUST use the iOS Client ID hack for both Expo Go and Android standalone APK
  // because Google blocks the Expo proxy and Web Client IDs reject custom schemes.
  const reverseClientId = iosClientId ? iosClientId.split('.').reverse().join('.') : '';
  
  const config = {
    clientId: iosClientId || 'mock-client-id.apps.googleusercontent.com',
    iosClientId: iosClientId || 'mock-client-id.apps.googleusercontent.com',
    androidClientId: iosClientId || 'mock-client-id.apps.googleusercontent.com', // Force it to use the iOS Client ID
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || 'mock-client-id.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    redirectUri: iosClientId ? `${reverseClientId}:/oauth2redirect/google` : undefined,
  };
  
  console.log('\n=======================================');
  console.log('[Google Auth Config - APK Mode]');
  console.log('Client ID:', config.clientId);
  console.log('Redirect URI:', config.redirectUri);
  console.log('=======================================\n');
  return config;
};

/**
 * Clear stored token (logout)
 */
export const logout = async () => {
  try {
    await SecureStore.deleteItemAsync('google_drive_token');
    return { success: true };
  } catch (error) {
    console.error('[GoogleDrive] Error clearing token:', error.message);
    return { success: false, error: error.message };
  }
};
