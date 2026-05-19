import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Pre-processes the image for backend verification.
 * Standardizes size and converts to Base64 for transport.
 * (Watermarking is now handled on the backend to support Expo Go).
 */
export const prepareImageForVerification = async (photoUri) => {
  try {
    if (!photoUri) throw new Error('Photo URI is missing');
    
    console.log('[AURA] Pre-processing image for verification:', photoUri);

    // Standardize and convert to Base64 for the backend
    const result = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1080 } }], // Standardize width
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    return {
      uri: result.uri,
      base64: result.base64,
    };
  } catch (error) {
    console.error('[!] Pre-processing failed:', error);
    return { uri: photoUri, base64: null };
  }
};

// Legacy alias for compatibility during transition
export const applyAuraWatermark = prepareImageForVerification;
