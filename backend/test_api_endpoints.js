const sharp = require('sharp');
const { generateAuthenticityProof } = require('./controllers/proof');
const { verifyMedia } = require('./controllers/verify');

async function createNaturalPhotoBuffer() {
  const width = 800, height = 600, channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const noise = (Math.random() - 0.5) * 15;
      const gradient = (x / width) * 40;
      raw[idx]     = Math.min(255, Math.max(0, 110 + gradient + noise));
      raw[idx + 1] = Math.min(255, Math.max(0, 130 + gradient + noise));
      raw[idx + 2] = Math.min(255, Math.max(0, 160 + gradient + noise));
    }
  }
  return await sharp(raw, { raw: { width, height, channels } }).jpeg({ quality: 85 }).toBuffer();
}

async function testEndpoints() {
  console.log('\n--- TESTING CONTROLLER ENDPOINTS ---');
  const imgBuf = await createNaturalPhotoBuffer();
  const base64Img = imgBuf.toString('base64');

  function createMockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonData = data; return this; }
    };
  }

  // 1. Proof generation with Screen Replay EMI spike
  const replayReq = {
    body: {
      mediaData: base64Img,
      metadata: { deviceId: 'test_device_1', capturedAt: new Date().toISOString() },
      sensorData: {
        magnetometer: [
          { magneticField: 32.1 }, { magneticField: 32.1 }, { magneticField: 32.2 },
          { magneticField: 80.0 }, { magneticField: 84.0 }
        ],
        light: [{ lux: 80 }, { lux: 420 }, { lux: 95 }, { lux: 510 }, { lux: 110 }],
        accelerometer: [{ x: 0.1, y: 9.8, z: 0.2 }, { x: 0.12, y: 9.78, z: 0.22 }, { x: 0.11, y: 9.81, z: 0.19 }, { x: 0.1, y: 9.79, z: 0.21 }, { x: 0.13, y: 9.82, z: 0.2 }],
        gyroscope: [{ x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 }],
        location: { latitude: 37.77, longitude: -122.41 },
        timestamp: { start: 1000, end: 3000 }
      }
    }
  };

  const replayRes = createMockRes();
  await generateAuthenticityProof(replayReq, replayRes);

  console.log('[1] Replay Proof Response:');
  console.log('    status:', replayRes.jsonData.status);
  console.log('    isRecaptured:', replayRes.jsonData.isRecaptured);
  console.log('    message:', replayRes.jsonData.message);

  if (replayRes.jsonData.isRecaptured === true && replayRes.jsonData.status === 'tampered') {
    console.log('    ? Screen Replay Proof Controller: PASS');
  } else {
    console.error('    ? Screen Replay Proof Controller: FAIL');
  }

  // 2. Proof generation with Clean Ambient Telemetry
  const cleanReq = {
    body: {
      mediaData: base64Img,
      metadata: { deviceId: 'test_device_2', capturedAt: new Date().toISOString() },
      sensorData: {
        magnetometer: [
          { magneticField: 35.0 }, { magneticField: 35.5 }, { magneticField: 35.2 },
          { magneticField: 35.8 }, { magneticField: 35.4 }
        ],
        light: [{ lux: 350 }, { lux: 352 }, { lux: 349 }, { lux: 351 }, { lux: 350 }],
        accelerometer: [{ x: 0.1, y: 9.8, z: 0.5 }, { x: 0.18, y: 9.72, z: 0.58 }, { x: 0.08, y: 9.85, z: 0.44 }, { x: 0.15, y: 9.76, z: 0.52 }, { x: 0.12, y: 9.81, z: 0.48 }],
        gyroscope: [{ x: 0.02, y: 0.03, z: 0.01 }, { x: 0.04, y: 0.02, z: 0.03 }, { x: 0.03, y: 0.04, z: 0.02 }, { x: 0.02, y: 0.03, z: 0.01 }, { x: 0.03, y: 0.02, z: 0.02 }],
        location: { latitude: 37.77, longitude: -122.41 },
        timestamp: { start: 1000, end: 3000 }
      }
    }
  };

  const cleanRes = createMockRes();
  await generateAuthenticityProof(cleanReq, cleanRes);

  console.log('[2] Clean Proof Response:');
  console.log('    status:', cleanRes.jsonData.status);
  console.log('    isRecaptured:', cleanRes.jsonData.isRecaptured);
  console.log('    auraFlag:', cleanRes.jsonData.proof.integrityAnalysis.auraFlag);

  if (cleanRes.jsonData.isRecaptured === false && (cleanRes.jsonData.status === 'authentic' || cleanRes.jsonData.status === 'verified')) {
    console.log('    ? Authentic Capture Controller: PASS');
  } else {
    console.error('    ? Authentic Capture Controller: FAIL');
  }

  // 3. Verify unregistered external image
  const verifyUnregisteredReq = {
    body: {
      uploadedMediaHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      metadata: { deviceId: 'external_uploader' }
    }
  };
  const verifyUnregisteredRes = createMockRes();
  await verifyMedia(verifyUnregisteredReq, verifyUnregisteredRes);

  console.log('[3] Verify Unregistered Image Response:');
  console.log('    status:', verifyUnregisteredRes.jsonData.verification.status);
  console.log('    auraFlag:', verifyUnregisteredRes.jsonData.verification.auraFlag);
  console.log('    statusMessage:', verifyUnregisteredRes.jsonData.verification.statusMessage);

  if (verifyUnregisteredRes.jsonData.verification.status === 'unverified' && verifyUnregisteredRes.jsonData.verification.auraFlag === 'YELLOW') {
    console.log('    ? Unverified External Image Decoupling: PASS');
  } else {
    console.error('    ? Unverified External Image Decoupling: FAIL');
  }
}

testEndpoints().catch(err => {
  console.error('Endpoint test error:', err);
  process.exit(1);
});
