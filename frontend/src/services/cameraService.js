import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

/**
 * Request camera permissions
 */
export const requestCameraPermission = async () => {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
};

/**
 * Request media library permissions
 */
export const requestMediaLibraryPermission = async () => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting media library permission:', error);
    return false;
  }
};

/**
 * Save photo to media library
 */
export const savePhotoToLibrary = async (photoUri) => {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      throw new Error('Media library permission denied');
    }

    const asset = await MediaLibrary.createAssetAsync(photoUri);
    const album = await MediaLibrary.getAlbumAsync('RealityProof');

    if (album == null) {
      await MediaLibrary.createAlbumAsync('RealityProof', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }

    return asset;
  } catch (error) {
    console.error('Error saving photo to library:', error);
    throw error;
  }
};

/**
 * Save video to media library
 */
export const saveVideoToLibrary = async (videoUri) => {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      throw new Error('Media library permission denied');
    }

    const asset = await MediaLibrary.createAssetAsync(videoUri);
    const album = await MediaLibrary.getAlbumAsync('RealityProof');

    if (album == null) {
      await MediaLibrary.createAlbumAsync('RealityProof', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }

    return asset;
  } catch (error) {
    console.error('Error saving video to library:', error);
    throw error;
  }
};

export default {
  requestCameraPermission,
  requestMediaLibraryPermission,
  savePhotoToLibrary,
  saveVideoToLibrary,
};
