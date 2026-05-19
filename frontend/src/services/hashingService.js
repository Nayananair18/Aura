import CryptoJS from 'crypto-js';

/**
 * Generate SHA256 hash of content
 */
export const generateHash = (content) => {
  try {
    const hash = CryptoJS.SHA256(content).toString();
    return hash;
  } catch (error) {
    console.error('Error generating hash:', error);
    throw error;
  }
};

/**
 * Generate hash from file using base64 content
 */
export const generateHashFromFile = (fileContent) => {
  try {
    const hash = CryptoJS.SHA256(fileContent).toString();
    return hash;
  } catch (error) {
    console.error('Error generating hash from file:', error);
    throw error;
  }
};

/**
 * Create device fingerprint
 */
export const createDeviceFingerprint = (deviceInfo) => {
  try {
    const fingerprint = CryptoJS.SHA256(
      JSON.stringify(deviceInfo)
    ).toString();
    return fingerprint;
  } catch (error) {
    console.error('Error creating device fingerprint:', error);
    throw error;
  }
};

/**
 * Combine multiple data sources into single hash
 */
export const createCombinedHash = (mediaHash, sensorHash, metadataHash) => {
  try {
    const combined = `${mediaHash}:${sensorHash}:${metadataHash}`;
    const hash = CryptoJS.SHA256(combined).toString();
    return hash;
  } catch (error) {
    console.error('Error creating combined hash:', error);
    throw error;
  }
};

/**
 * Verify hash match between two values
 */
export const verifyHashMatch = (hash1, hash2) => {
  try {
    return hash1 === hash2;
  } catch (error) {
    console.error('Error verifying hash match:', error);
    return false;
  }
};

export default {
  generateHash,
  generateHashFromFile,
  createDeviceFingerprint,
  createCombinedHash,
  verifyHashMatch,
};
