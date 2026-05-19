import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { generateHashFromFile } from './hashingService';

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
    
    const photos = [];
    for (const file of files) {
      if (file.endsWith('.jpg') || file.endsWith('.png')) {
        const fileUri = `${CAPTURE_DIRECTORY}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        photos.push({
          uri: fileUri,
          name: file,
          size: fileInfo.size,
          mimeType: file.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
        });
      }
    }
    
    return photos;
  } catch (error) {
    console.error('Error listing captured photos:', error);
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
 * Save photo metadata locally
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
    });

    if (result.canceled) {
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
 * Get file contents as base64
 */
export const getFileAsBase64 = async (fileUri) => {
  try {
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });
    return fileContent;
  } catch (error) {
    console.error('Error reading file:', error);
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

export default {
  pickFile,
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
};
