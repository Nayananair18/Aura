import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { generateHashFromFile } from './hashingService';

const MediaLibrary = Platform.OS === 'web' 
  ? null 
  : (function() {
      try {
        return require('expo-media-library/legacy');
      } catch (e) {
        return require('expo-media-library');
      }
    })();

// Local storage directory for captured photos
const CAPTURE_DIRECTORY = `${FileSystem.documentDirectory}RealityProof/`;

/**
 * Initialize local storage directory
 */
export const initializeStorage = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CAPTURE_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CAPTURE_DIRECTORY, { intermediates: true });
    }
    return CAPTURE_DIRECTORY;
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
};

/**
 * Save captured photo to local storage
 */
export const saveCapturedPhoto = async (photoUri) => {
  try {
    // Initialize storage if needed
    await initializeStorage();

    // Generate unique filename
    const timestamp = new Date().getTime();
    const fileName = `photo_${timestamp}.jpg`;
    const localPath = `${CAPTURE_DIRECTORY}${fileName}`;

    // Copy photo to local storage
    await FileSystem.copyAsync({
      from: photoUri,
      to: localPath,
    });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    return {
      uri: localPath,
      name: fileName,
      size: fileInfo.size,
      mimeType: 'image/jpeg',
      timestamp,
    };
  } catch (error) {
    console.error('Error saving captured photo:', error);
    throw error;
  }
};

/**
 * List all captured photos
 */
export const listCapturedPhotos = async () => {
  try {
    await initializeStorage();
    const files = await FileSystem.readDirectoryAsync(CAPTURE_DIRECTORY);
    
    // Filter for image files
    const imageFiles = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
    
    const photoList = [];
    for (const file of imageFiles) {
      const fileUri = `${CAPTURE_DIRECTORY}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      photoList.push({
        name: file,
        uri: fileUri,
        size: fileInfo.size,
        modificationTime: fileInfo.modificationTime,
      });
    }

    // Sort by modification time (newest first)
    photoList.sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));

    return photoList;
  } catch (error) {
    console.error('Error listing photos:', error);
    return [];
  }
};

/**
 * Delete a captured photo
 */
export const deleteCapturedPhoto = async (photoUri) => {
  try {
    await FileSystem.deleteAsync(photoUri);
    return { success: true };
  } catch (error) {
    console.error('Error deleting photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save photo metadata alongside the photo
 */
export const savePhotoMetadata = async (photoData) => {
  try {
    await initializeStorage();
    
    const metadata = {
      ...photoData,
      savedAt: new Date().toISOString(),
    };

    const metadataFile = `${CAPTURE_DIRECTORY}metadata_${photoData.timestamp}.json`;
    await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(metadata, null, 2));

    return {
      success: true,
      metadataUri: metadataFile,
    };
  } catch (error) {
    console.error('Error saving photo metadata:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get total storage used
 */
export const getStorageUsage = async () => {
  try {
    await initializeStorage();
    const files = await FileSystem.readDirectoryAsync(CAPTURE_DIRECTORY);
    
    let totalSize = 0;
    for (const file of files) {
      const fileUri = `${CAPTURE_DIRECTORY}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        totalSize += fileInfo.size || 0;
      }
    }

    return {
      totalSize,
      totalSizeInMB: (totalSize / (1024 * 1024)).toFixed(2),
      directoryPath: CAPTURE_DIRECTORY,
    };
  } catch (error) {
    console.error('Error getting storage usage:', error);
    return { totalSize: 0 };
  }
};

/**
 * Clear all local storage
 */
export const clearLocalStorage = async () => {
  try {
    const files = await FileSystem.readDirectoryAsync(CAPTURE_DIRECTORY);
    
    for (const file of files) {
      const fileUri = `${CAPTURE_DIRECTORY}${file}`;
      await FileSystem.deleteAsync(fileUri);
    }

    return { success: true, filesDeleted: files.length };
  } catch (error) {
    console.error('Error clearing storage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Pick a file from device storage
 */
export const pickFile = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'video/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const file = result.assets[0];

    return {
      uri: file.uri,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
    };
  } catch (error) {
    console.error('Error picking file:', error);
    throw error;
  }
};

/**
 * Pick an image from photo library / gallery with base64 and dimension support
 */
export const pickImageFromGallery = async () => {
  try {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[AURA Gallery] Media library permission not explicitly granted, attempting picker...');
      }
    } catch (permErr) {
      console.warn('[AURA Gallery] Media library permission error:', permErr.message);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    let base64 = asset.base64;
    let finalUri = asset.uri;

    if (!base64 && finalUri) {
      base64 = await getFileAsBase64(finalUri);
    }

    return {
      uri: finalUri,
      name: asset.fileName || `gallery_${Date.now()}.jpg`,
      size: asset.fileSize || 0,
      mimeType: asset.mimeType || 'image/jpeg',
      width: asset.width,
      height: asset.height,
      base64,
    };
  } catch (error) {
    console.error('Error picking image from gallery:', error);
    // Fallback to DocumentPicker
    try {
      const docResult = await pickFile();
      if (!docResult) return null;
      const base64 = await getFileAsBase64(docResult.uri);
      return {
        ...docResult,
        base64,
      };
    } catch (fallbackErr) {
      throw error;
    }
  }
};

/**
 * Get file contents as base64.
 * Uses fetch() + FileReader which streams directly via React Native Android ContentResolver / iOS fetch,
 * bypassing ExponentFileSystem native permission locks on DocumentPicker URIs.
 */
export const getFileAsBase64 = async (fileUri) => {
  try {
    if (!fileUri) throw new Error('No file URI provided');

    // Primary: fetch(fileUri) + FileReader (works for content://, file://, and DocumentPicker URIs on Android/iOS/Web)
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64data = reader.result.split(',')[1] || reader.result;
            resolve(base64data);
          } else {
            reject(new Error('FileReader did not return string'));
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
      });
    } catch (fetchErr) {
      console.warn('[FileService] fetch base64 failed, attempting FileSystem fallback:', fetchErr.message);
    }

    // Secondary: FileSystem.readAsStringAsync fallback
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });
    return fileContent;
  } catch (error) {
    console.error('Error reading file as base64:', error);
    throw error;
  }
};

/**
 * Generate hash from file
 */
export const hashFile = async (fileUri) => {
  try {
    const fileContent = await getFileAsBase64(fileUri);
    const hash = generateHashFromFile(fileContent);
    return hash;
  } catch (error) {
    console.error('Error hashing file:', error);
    throw error;
  }
};

/**
 * Get file info (size, name, type)
 */
export const getFileInfo = async (fileUri, fileName, fileSize, mimeType) => {
  try {
    return {
      uri: fileUri,
      name: fileName,
      size: fileSize,
      mimeType: mimeType,
      sizeInMB: (fileSize / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    throw error;
  }
};

/**
 * Save file to local storage
 */
export const saveFile = async (fileUri, fileName) => {
  try {
    const localUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: fileUri,
      to: localUri,
    });
    return localUri;
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
};

/**
 * Save verified watermarked image directly into device photo gallery under "AURA Verified" album.
 * Keeps original capture and AURA Verified copy as separate files.
 */
export const saveToPhoneGallery = async (imageUri) => {
  try {
    if (Platform.OS === 'web' || !MediaLibrary) {
      console.log('[AURA Gallery] Web platform – gallery save not supported via MediaLibrary.');
      return { success: false, message: 'MediaLibrary gallery save is not supported on web' };
    }

    if (!imageUri) {
      return { success: false, message: 'No image URI provided' };
    }

    let permStatus = 'denied';
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      permStatus = perm.status;
    } catch (pErr) {
      console.warn('[AURA Gallery] Permission request retry:', pErr.message);
      try {
        const getPerm = await MediaLibrary.getPermissionsAsync(false);
        permStatus = getPerm.status;
      } catch (gErr) {
        permStatus = 'granted';
      }
    }

    if (permStatus !== 'granted') {
      console.warn('[AURA Gallery] Media library permission denied.');
      return { success: false, message: 'Gallery permission was denied.' };
    }

    let targetUri = imageUri;

    if (imageUri.startsWith('data:image')) {
      const tempPath = `${FileSystem.cacheDirectory}aura_verified_${Date.now()}.jpg`;
      const base64Data = imageUri.split(',')[1] || imageUri;
      await FileSystem.writeAsStringAsync(tempPath, base64Data, { encoding: 'base64' });
      targetUri = tempPath;
    }

    try {
      const asset = await MediaLibrary.createAssetAsync(targetUri);
      
      try {
        const albumName = 'AURA Verified';
        const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);

        if (existingAlbum) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
        } else {
          await MediaLibrary.createAlbumAsync(albumName, asset, false);
        }
        console.log(`[AURA Gallery] ✅ Photo saved to gallery album "${albumName}"!`);
        return {
          success: true,
          asset,
          albumName,
          message: `Saved to "${albumName}" album in your photos!`,
        };
      } catch (albumErr) {
        console.warn('[AURA Gallery] Album creation restricted (Expo Go mode):', albumErr.message);
        console.log('[AURA Gallery] ✅ Photo saved directly to your device Photos gallery!');
        return {
          success: true,
          asset,
          message: 'Saved to your Photos gallery!',
        };
      }
    } catch (createErr) {
      console.warn('[AURA Gallery] Asset creation fallback to saveToLibraryAsync:', createErr.message);
      await MediaLibrary.saveToLibraryAsync(targetUri);
      console.log('[AURA Gallery] ✅ Photo saved to your device Photos gallery via saveToLibraryAsync!');
      return {
        success: true,
        message: 'Saved to your Photos gallery!',
      };
    }
  } catch (error) {
    console.error('[!] Failed to save photo to gallery:', error.message);
    return {
      success: false,
      error: error.message,
      message: `Could not save photo: ${error.message}`,
    };
  }
};

export default {
  pickFile,
  pickImageFromGallery,
  getFileAsBase64,
  hashFile,
  getFileInfo,
  saveFile,
  initializeStorage,
  saveCapturedPhoto,
  listCapturedPhotos,
  deleteCapturedPhoto,
  savePhotoMetadata,
  getStorageUsage,
  clearLocalStorage,
  saveToPhoneGallery,
};
