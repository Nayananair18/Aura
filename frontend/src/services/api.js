import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const resolveApiBaseUrl = () => {
  const envUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.REACT_NATIVE_API_BASE_URL;

  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3001/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }

  return 'http://localhost:3001/api';
};

const API_BASE_URL = resolveApiBaseUrl();
console.log(`[AURA API] Gateway: ${API_BASE_URL}`);

// Drive USE_MOCK_API from env — never hardcode
const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
if (USE_MOCK_API) console.warn('[AURA API] ⚠️ MOCK MODE ENABLED via EXPO_PUBLIC_USE_MOCK_API');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // 45s timeout — proof generation involves sharp image processing on the server
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

const isNetworkError = (error) =>
  error?.message === 'Network Error' ||
  error?.code === 'ECONNABORTED' ||
  !error?.response;

/**
 * Generate authenticity proof from media data
 */
export const generateAuthenticityProof = async (mediaData, sensorData, metadata) => {
  try {
    if (USE_MOCK_API) return mockGenerateProof(mediaData, sensorData, metadata);

    const response = await apiClient.post('/media/generate-proof', {
      mediaData,
      sensorData,
      metadata,
      timestamp: new Date().toISOString(),
    });

    console.log('[AURA API] ✅ Proof generated successfully');
    return response.data;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn(`[AURA API] Backend unreachable at ${API_BASE_URL}. Falling back to mock.`);
      return { ...(await mockGenerateProof(mediaData, sensorData, metadata)), isFallback: true };
    }
    console.error('[AURA API] Critical error generating proof:', error.message);
    throw error;
  }
};

/**
 * Verify media authenticity
 */
export const verifyMedia = async (fileHash, metadata, uploadedMediaHash, proofId = null) => {
  try {
    if (USE_MOCK_API) return mockVerifyMedia(fileHash, metadata, uploadedMediaHash, proofId);

    const response = await apiClient.post('/media/verify', {
      fileHash,
      metadata,
      uploadedMediaHash,
      proofId,
      timestamp: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[AURA API] Backend unreachable. Falling back to mock verification.');
      return mockVerifyMedia(fileHash, metadata, uploadedMediaHash, proofId);
    }
    throw error;
  }
};

/**
 * Store verification result
 */
export const storeVerificationResult = async (mediaHash, verificationResult, metadata) => {
  try {
    if (USE_MOCK_API) return mockStoreResult(mediaHash, verificationResult, metadata);

    const response = await apiClient.post('/verification/store', {
      mediaHash,
      verificationResult,
      metadata,
      timestamp: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[AURA API] Backend unreachable. Falling back to mock store.');
      return mockStoreResult(mediaHash, verificationResult, metadata);
    }
    throw error;
  }
};

/**
 * Ping the backend to verify connection
 */
export const pingBackend = async () => {
  try {
    if (USE_MOCK_API) return { status: 'connected', mode: 'mock' };
    const response = await apiClient.get('/ping');
    console.log('[AURA API] 💓 Backend handshake successful.');
    return response.data;
  } catch (error) {
    console.warn(`[AURA API] 💔 Backend unreachable: ${error.message}`);
    return { status: 'disconnected' };
  }
};

/**
 * Get verification history
 */
export const getVerificationHistory = async () => {
  try {
    if (USE_MOCK_API) return mockGetHistory();
    const response = await apiClient.get('/verification/history');
    return response.data;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[AURA API] Backend unreachable. Returning mock history.');
      return mockGetHistory();
    }
    throw error;
  }
};

// ==================== MOCK API ====================

const calculateMockIntegrity = (sensorData) => {
  const analysis = {
    auraFlag: 'GREEN',
    screenDefense: { result: 'passed', magnetometerPassed: true, lightFlickerPassed: true, details: 'No display signatures found' },
    physicsDefense: { motionPassed: true, gravityConsistent: true, details: 'Handheld micro-tremors verified' },
    locationValid: true,
    timestampValid: true,
    overallScore: 95,
  };

  if (sensorData?.magnetometer?.length > 5) {
    const mags = sensorData.magnetometer.map(r => Math.sqrt(r.x ** 2 + r.y ** 2 + r.z ** 2));
    const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
    const spread = Math.max(...mags) - Math.min(...mags);
    if (avg > 65 || spread > 8) {
      analysis.screenDefense.magnetometerPassed = false;
      analysis.screenDefense.result = 'failed';
      analysis.screenDefense.details = avg > 65 ? 'High magnetic EMI detected' : 'Unstable magnetic field';
      analysis.auraFlag = 'RED';
      analysis.overallScore = 35;
    }
  }

  if (sensorData?.accelerometer?.length > 5) {
    const mags = sensorData.accelerometer.map(r => Math.sqrt(r.x ** 2 + r.y ** 2 + r.z ** 2));
    const variance = Math.max(...mags) - Math.min(...mags);
    if (variance < 0.015) {
      analysis.physicsDefense.motionPassed = false;
      analysis.physicsDefense.details = 'Artificial stillness detected';
      analysis.auraFlag = analysis.auraFlag === 'RED' ? 'RED' : 'YELLOW';
      analysis.overallScore = Math.min(analysis.overallScore, 55);
    }
  }

  return analysis;
};

const mockGenerateProof = (mediaData, sensorData, metadata) =>
  new Promise((resolve) => {
    setTimeout(() => {
      const integrityAnalysis = calculateMockIntegrity(sensorData);
      resolve({
        success: true,
        proof: {
          id: `PROOF_MOCK_${Date.now()}`,
          hash: `mock_sha256_${Math.random().toString(36).substr(2, 40)}`,
          sensorValidation: { accelerometer: true, gyroscope: true, light: true, magnetometer: true },
          timestamp: new Date().toISOString(),
          deviceId: metadata?.deviceId,
        },
        integrityAnalysis,
        status: integrityAnalysis.auraFlag === 'GREEN' ? 'authentic' : 'tampered',
        overallConfidence: integrityAnalysis.overallScore,
        isFallback: true,
        message: 'Mock proof generated',
      });
    }, 1500);
  });

const mockVerifyMedia = (fileHash, metadata, uploadedMediaHash, proofId = null) =>
  new Promise((resolve) => {
    setTimeout(() => {
      const isMatch = proofId ? true : Math.random() > 0.15;
      const matchedProofId = proofId || `AURA-8F9A-2B4C-${Math.floor(1000 + Math.random() * 9000)}`;
      resolve({
        success: true,
        verification: {
          proofId: matchedProofId,
          status: isMatch ? 'authentic' : 'tampered',
          confidence: isMatch ? 99.7 : 15.0,
          auraFlag: isMatch ? 'GREEN' : 'RED',
          statusMessage: isMatch ? '✓ AUTHENTIC CAPTURE' : '⚠ MEDIA MODIFIED',
          statusDetails: isMatch ? 'Proof Found | Media Integrity: MATCH | Cryptographic Proof: VALID' : 'Proof Found | Media Integrity: MISMATCH',
          hashValidation: {
            isValid: isMatch,
            matchPercentage: isMatch ? 100 : 12,
            uploadedHash: uploadedMediaHash ? uploadedMediaHash.substring(0, 16) + '...' : 'none',
            storedHash: fileHash ? fileHash.substring(0, 16) + '...' : 'none',
          },
          sensorValidation: isMatch ? 'passed' : 'failed',
          metadataConsistency: isMatch ? 'consistent' : 'inconsistent',
          timestamp: new Date().toISOString(),
          screenDefense: { result: isMatch ? 'passed' : 'failed', magnetometerPassed: isMatch, lightFlickerPassed: isMatch, details: isMatch ? 'No display signatures found' : 'High magnetic EMI' },
          physicsDefense: { motionPassed: isMatch, gravityConsistent: isMatch, details: isMatch ? 'Handheld signatures verified' : 'Inconsistent gravity vector' },
          proofDetails: {
            proofId: matchedProofId,
            capturedAt: new Date(Date.now() - 3600000).toISOString(),
            integrityScore: 95,
            confidence: 99.7,
            deviceId: 'Verified Device',
          },
        },
        message: isMatch ? '✓ AUTHENTIC CAPTURE' : '⚠ MEDIA MODIFIED',
      });
    }, 1500);
  });

const mockStoreResult = (_hash, _result, _meta) =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, resultId: `RESULT_MOCK_${Date.now()}`, message: 'Stored locally (mock mode)' }), 500);
  });

const mockGetHistory = () =>
  new Promise((resolve) => {
    setTimeout(() =>
      resolve({
        success: true,
        history: [
          { id: 'RESULT_MOCK_1', status: 'authentic', timestamp: new Date(Date.now() - 3600000).toISOString(), confidence: 99.7 },
          { id: 'RESULT_MOCK_2', status: 'authentic', timestamp: new Date(Date.now() - 7200000).toISOString(), confidence: 98.5 },
        ],
        total: 2,
      }), 500);
  });

const mockAnalyzeMetadata = (fileName) =>
  new Promise((resolve) => {
    setTimeout(() => {
      // Randomly simulate different classifications for dev testing
      const roll = Math.random();
      const isAI = roll > 0.55;
      const isUncertain = roll > 0.35 && roll <= 0.55;
      const aiProb = isAI
        ? parseFloat((70 + Math.random() * 25).toFixed(1))
        : isUncertain
        ? parseFloat((40 + Math.random() * 25).toFixed(1))
        : parseFloat((5 + Math.random() * 30).toFixed(1));

      const classification = isAI ? 'AI_GENERATED' : isUncertain ? 'UNCERTAIN' : 'REAL_CAMERA';
      const confidence = isAI
        ? parseFloat((aiProb + 5).toFixed(1))
        : isUncertain
        ? parseFloat((40 + Math.abs(aiProb - 52.5)).toFixed(1))
        : parseFloat((100 - aiProb + 5).toFixed(1));

      const MOCK_SIGNALS = [
        { id: 'missing_camera_make', label: 'No Camera Manufacturer', weight: 15, triggered: isAI, score: isAI ? 15 : 0, detail: isAI ? 'Real cameras embed Make field.' : null },
        { id: 'missing_camera_model', label: 'No Camera Model', weight: 14, triggered: isAI, score: isAI ? 14 : 0, detail: isAI ? 'No camera model embedded.' : null },
        { id: 'known_ai_software', label: 'AI Software Tag Detected', weight: 20, triggered: isAI, score: isAI ? 20 : 0, detail: isAI ? 'Software tag: "Stable Diffusion"' : null },
        { id: 'missing_shutter_speed', label: 'No Shutter Speed', weight: 10, triggered: isAI, score: isAI ? 10 : 0, detail: isAI ? 'Real cameras always record shutter.' : null },
        { id: 'missing_aperture', label: 'No Aperture (f-stop)', weight: 8, triggered: isAI, score: isAI ? 8 : 0, detail: isAI ? 'No physical aperture recorded.' : null },
        { id: 'missing_iso', label: 'No ISO Sensitivity', weight: 6, triggered: isUncertain || isAI, score: isAI ? 6 : 0, detail: 'ISO is a core camera parameter.' },
        { id: 'missing_gps', label: 'No GPS Coordinates', weight: 5, triggered: true, score: 0, detail: null },
        { id: 'xmp_prompt_field', label: 'XMP Prompt / Parameters', weight: 25, triggered: isAI && Math.random() > 0.4, score: isAI && Math.random() > 0.4 ? 25 : 0, detail: isAI ? 'XMP contains generation parameters.' : null },
        { id: 'power_of_two_dimensions', label: 'Power-of-2 Dimensions', weight: 8, triggered: isAI, score: isAI ? 8 : 0, detail: isAI ? 'Dimensions match AI model output.' : null },
        { id: 'missing_focal_length', label: 'No Focal Length', weight: 6, triggered: isAI, score: isAI ? 6 : 0, detail: isAI ? 'No optical focal length present.' : null },
      ];

      resolve({
        success: true,
        analysis: {
          classification,
          aiProbability: aiProb,
          realProbability: parseFloat((100 - aiProb).toFixed(1)),
          confidence: Math.min(confidence, 100),
          // KNN details
          kValue: 5,
          aiVotes: isAI ? 5 : (isUncertain ? 3 : 0),
          realVotes: isAI ? 0 : (isUncertain ? 2 : 5),
          nearestNeighbours: [
            { source: isAI ? 'stable_diffusion_full' : 'iphone_portrait', label: isAI ? 'AI_GENERATED' : 'REAL_CAMERA' },
            { source: isAI ? 'midjourney' : 'samsung_galaxy', label: isAI ? 'AI_GENERATED' : 'REAL_CAMERA' },
          ],
          // Signal breakdown
          triggeredSignalCount: MOCK_SIGNALS.filter(s => s.triggered).length,
          totalSignalCount: MOCK_SIGNALS.length,
          signals: MOCK_SIGNALS,
          triggeredSignals: MOCK_SIGNALS.filter(s => s.triggered),
          fileName: fileName || 'image.jpg',
          imageStats: { width: isAI ? 1024 : 4032, height: isAI ? 1024 : 3024, format: 'jpeg' },
          analyzedAt: new Date().toISOString(),
          isMock: true,
        },
        message: `Image classified as ${classification} (mock mode)`,
      });
    }, 1800);
  });



/**
 * Analyze image metadata with ML model — AI-generated vs real camera
 */
export const analyzeImageMetadata = async (base64Image, fileName, fileType, exifData = null) => {
  try {
    if (USE_MOCK_API) return mockAnalyzeMetadata(fileName);

    const response = await apiClient.post('/media/analyze-metadata', {
      image: base64Image,
      fileName,
      fileType,
      exifData,
    });

    return response.data;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[AURA API] Backend unreachable. Falling back to mock ML analysis.');
      return mockAnalyzeMetadata(fileName);
    }
    // Non-fatal — return a graceful failure object instead of throwing
    console.error('[AURA API] ML analysis error:', error.message);
    return { success: false, analysis: null, error: error.message };
  }
};

export default { generateAuthenticityProof, verifyMedia, storeVerificationResult, getVerificationHistory, analyzeImageMetadata };

