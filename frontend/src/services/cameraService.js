import { Camera } from 'expo-camera';
import { Platform } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

const MediaLibrary = Platform.OS === 'web' 
  ? null 
  : (function() {
      try {
        return require('expo-media-library/legacy');
      } catch (e) {
        return require('expo-media-library');
      }
    })();

/**
 * Request camera permissions asynchronously
 */
export const requestCameraPermission = async () => {
  try {
    if (Camera?.requestCameraPermissionsAsync) {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    return true;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
};

/**
 * Get current camera permissions asynchronously
 */
export const getCameraPermission = async () => {
  try {
    if (Camera?.getCameraPermissionsAsync) {
      const result = await Camera.getCameraPermissionsAsync();
      return result;
    }
    return { status: 'granted', granted: true };
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return { status: 'undetermined', granted: false };
  }
};

/**
 * Modern safe camera permissions hook that avoids deprecated createPermissionHook
 */
export const useCameraPermissions = () => {
  const [permission, setPermission] = useState(null);

  const requestPermission = useCallback(async () => {
    try {
      if (Camera?.requestCameraPermissionsAsync) {
        const res = await Camera.requestCameraPermissionsAsync();
        setPermission(res);
        return res;
      }
      const fallback = { status: 'granted', granted: true };
      setPermission(fallback);
      return fallback;
    } catch (e) {
      console.warn('Error requesting camera permission:', e.message);
      const denied = { status: 'denied', granted: false };
      setPermission(denied);
      return denied;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        if (Camera?.getCameraPermissionsAsync) {
          const res = await Camera.getCameraPermissionsAsync();
          if (isMounted) setPermission(res);
        } else {
          if (isMounted) setPermission({ status: 'granted', granted: true });
        }
      } catch (e) {
        if (isMounted) setPermission({ status: 'undetermined', granted: false });
      }
    };
    check();
    return () => {
      isMounted = false;
    };
  }, []);

  return [permission, requestPermission];
};

/**
 * Request media library permissions
 */
export const requestMediaLibraryPermission = async () => {
  try {
    if (!MediaLibrary || Platform.OS === 'web') return false;
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
  getCameraPermission,
  useCameraPermissions,
  requestMediaLibraryPermission,
  savePhotoToLibrary,
  saveVideoToLibrary,
};
