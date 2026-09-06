import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const resolveApiBaseUrl = () => {
  // Dynamically resolve local IP from Metro server in development mode
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri && __DEV__ && Platform.OS !== 'web') {
    const host = hostUri.split(':')[0];
    // If running in tunnel mode, host is non-numeric domain
    if (host && !host.includes('exp.direct') && !host.includes('ngrok')) {
      return `http://${host}:3001/api`;
    }
  }

  const envUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.REACT_NATIVE_API_BASE_URL;

  if (envUrl && envUrl.trim() !== '') return envUrl.trim();

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }

  return 'http://localhost:3001/api';
};

const API_BASE_URL = resolveApiBaseUrl();
console.log(`[AURA API] Gateway: ${API_BASE_URL}`);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 45s timeout — proof generation involves sharp image processing & Groq VLM on server
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — log outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[AURA API] → ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — unified error normalization
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 429) {
      console.warn(`[AURA API] Rate limited. Retry after: ${error.response?.data?.retryAfter}`);
    } else if (status >= 500) {
      console.error(`[AURA API] Server error ${status}: ${message}`);
    } else if (!error.response) {
      console.warn(`[AURA API] Network error: ${message}`);
    }

    return Promise.reject(error);
  }
);

const handleApiError = (actionName, error) => {
  const isNetwork = error?.message === 'Network Error' || error?.code === 'ECONNABORTED' || !error?.response;
  if (isNetwork) {
    const unreachableError = new Error(`[AURA API] Backend server unreachable at ${API_BASE_URL}. Please ensure backend is running.`);
    console.error(unreachableError.message);
    throw unreachableError;
  }
  const msg = error.response?.data?.message || error.message || `${actionName} failed`;
  console.error(`[AURA API] ${actionName} error:`, msg);
  throw new Error(msg);
};

/**
 * Generate authenticity proof from media data
 */
export const generateAuthenticityProof = async (mediaData, sensorData, metadata) => {
  try {
    const response = await apiClient.post('/media/generate-proof', {
      mediaData,
      sensorData,
      metadata,
      timestamp: new Date().toISOString(),
    });

    console.log('[AURA API] ✅ Proof generated successfully');
    return response.data;
  } catch (error) {
    handleApiError('generateAuthenticityProof', error);
  }
};

/**
 * Verify media authenticity
 */
export const verifyMedia = async (fileHash, metadata, uploadedMediaHash, proofId = null, image = null) => {
  try {
    const response = await apiClient.post('/media/verify', {
      fileHash,
      metadata,
      uploadedMediaHash,
      proofId,
      image,
      timestamp: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    handleApiError('verifyMedia', error);
  }
};

/**
 * Store verification result
 */
export const storeVerificationResult = async (mediaHash, verificationResult, metadata) => {
  try {
    const response = await apiClient.post('/verification/store', {
      mediaHash,
      verificationResult,
      metadata,
      timestamp: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    handleApiError('storeVerificationResult', error);
  }
};

/**
 * Ping the backend to verify connection
 */
export const pingBackend = async () => {
  try {
    const response = await apiClient.get('/ping');
    console.log('[AURA API] 💓 Backend handshake successful.');
    return response.data;
  } catch (error) {
    console.warn(`[AURA API] 💔 Backend unreachable at ${API_BASE_URL}: ${error.message}`);
    return { status: 'disconnected', error: error.message };
  }
};

/**
 * Get verification history
 */
export const getVerificationHistory = async () => {
  try {
    const response = await apiClient.get('/verification/history');
    return response.data;
  } catch (error) {
    handleApiError('getVerificationHistory', error);
  }
};

/**
 * Analyze image metadata with ML model — AI-generated vs real camera
 */
export const analyzeImageMetadata = async (base64Image, fileName, fileType, exifData = null) => {
  try {
    const response = await apiClient.post('/media/analyze-metadata', {
      image: base64Image,
      fileName,
      fileType,
      exifData,
    });

    return response.data;
  } catch (error) {
    handleApiError('analyzeImageMetadata', error);
  }
};

export default {
  generateAuthenticityProof,
  verifyMedia,
  storeVerificationResult,
  getVerificationHistory,
  analyzeImageMetadata,
  pingBackend,
};

