import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const CLOUD_API_BASE_URL = 'https://aura-our8.onrender.com/api';

const resolveApiBaseUrl = () => {
  // 1. Explicitly configured URL from .env takes top priority
  const envUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.REACT_NATIVE_API_BASE_URL;

  if (envUrl && envUrl.trim() !== '') return envUrl.trim();

  // 2. Dynamically resolve local IP from Metro server in development mode
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri && __DEV__ && Platform.OS !== 'web') {
    const host = hostUri.split(':')[0];
    // If running in tunnel mode, host is non-numeric domain
    if (host && !host.includes('exp.direct') && !host.includes('ngrok')) {
      return `http://${host}:3001/api`;
    }
  }

  // 3. Android emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }

  return CLOUD_API_BASE_URL;
};

let currentApiBaseUrl = resolveApiBaseUrl();
console.log(`[AURA API] Primary Gateway: ${currentApiBaseUrl}`);

const apiClient = axios.create({
  baseURL: currentApiBaseUrl,
  // 90s timeout — proof generation involves sharp image processing, QR generation, & Groq VLM
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — log outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[AURA API] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — unified error normalization & auto-failover
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isNetworkError =
      error?.message === 'Network Error' ||
      error?.code === 'ERR_NETWORK' ||
      (!error.response && error.code !== 'ECONNABORTED');

    // Auto-failover: If primary local URL failed and not yet retried, switch to Cloud
    if (isNetworkError && originalRequest && !originalRequest._retried) {
      const isCurrentlyLocal =
        currentApiBaseUrl.includes('192.168.') ||
        currentApiBaseUrl.includes('10.') ||
        currentApiBaseUrl.includes('localhost') ||
        currentApiBaseUrl.includes('10.0.2.2');

      const failoverUrl = isCurrentlyLocal ? CLOUD_API_BASE_URL : null;

      if (failoverUrl && failoverUrl !== currentApiBaseUrl) {
        console.warn(
          `[AURA API] ⚠️ Connection to ${currentApiBaseUrl} failed. Auto-failing over to Cloud gateway: ${failoverUrl}`
        );
        originalRequest._retried = true;
        currentApiBaseUrl = failoverUrl;
        apiClient.defaults.baseURL = failoverUrl;
        originalRequest.baseURL = failoverUrl;
        return apiClient(originalRequest);
      }
    }

    const status = error.response?.status;
    let message = error.response?.data?.message;
    if (!message && Array.isArray(error.response?.data?.errors)) {
      message = error.response.data.errors.map((e) => e.msg || e.message).join(', ');
    }
    if (!message) {
      message = error.message;
    }

    if (status === 429) {
      console.warn(`[AURA API] Rate limited. Retry after: ${error.response?.data?.retryAfter}`);
    } else if (status >= 500) {
      console.error(`[AURA API] Server error ${status}: ${message}`);
    } else if (status === 400) {
      console.error(`[AURA API] Bad Request (400): ${message}`);
    } else if (!error.response) {
      console.warn(`[AURA API] Network error: ${message}`);
    }

    return Promise.reject(error);
  }
);

const handleApiError = (actionName, error) => {
  const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
  if (isTimeout) {
    const timeoutError = new Error(
      `[AURA API] Request timed out. The server is taking longer than expected to process forensics or waking up from sleep. Please try again.`
    );
    console.error(timeoutError.message);
    throw timeoutError;
  }

  const isNetwork = error?.message === 'Network Error' || error?.code === 'ERR_NETWORK' || !error?.response;
  if (isNetwork) {
    const unreachableError = new Error(
      `[AURA API] Backend server unreachable at ${currentApiBaseUrl}. Please ensure backend is running and your device has network access.`
    );
    console.error(unreachableError.message);
    throw unreachableError;
  }

  const data = error.response?.data;
  let msg = data?.message;
  if (!msg && Array.isArray(data?.errors)) {
    msg = data.errors.map((e) => e.msg || e.message).join(', ');
  }
  if (!msg && typeof data?.error === 'string') {
    msg = data.error;
  }
  if (!msg) {
    msg = error.message || `${actionName} failed`;
  }
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

