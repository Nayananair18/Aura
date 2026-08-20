const sharp = require('sharp');
const { analyzeSensorIntegrity } = require('./utils/crypto');
const { analyzeImageMetadata } = require('./utils/metadataAnalyzer');

async function createNaturalPhotoBuffer(width = 800, height = 600) {
  // Generate a buffer with natural photographic texture, color gradients & realistic noise
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const noise = (Math.random() - 0.5) * 18;
      const gradient = (x / width) * 40 + (y / height) * 30;
      raw[idx]     = Math.min(255, Math.max(0, 110 + gradient + noise));      // R
      raw[idx + 1] = Math.min(255, Math.max(0, 130 + gradient * 0.8 + noise)); // G
      raw[idx + 2] = Math.min(255, Math.max(0, 160 + gradient * 0.5 + noise)); // B
    }
  }
  return await sharp(raw, { raw: { width, height, channels } })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function runTests() {
  console.log('====================================================');
  console.log('      AURA FORENSIC INTEGRATION TEST SUITE          ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName} - ${details}`);
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 1: SCREEN REPLAY / SECOND-COPY DETECTION
  // ----------------------------------------------------
  console.log('--- SUITE 1: Screen Replay & Second-Copy Telemetry Defense ---');

  // Test 1.1: Magnetometer EMI Spike > 55 �T near monitor display
  const screenReplayTelemetry = {
    magnetometer: [
      { x: 35, y: 45, z: 62, magneticField: 84.1 },
      { x: 32, y: 42, z: 60, magneticField: 79.9 },
      { x: 35, y: 45, z: 62, magneticField: 84.1 },
      { x: 28, y: 38, z: 58, magneticField: 74.8 },
      { x: 31, y: 41, z: 59, magneticField: 78.4 },
    ],
    light: [
      { lux: 150 }, { lux: 180 }, { lux: 140 }, { lux: 190 }, { lux: 155 }
    ],
    accelerometer: [
      { x: 0.1, y: 9.8, z: 0.2 }, { x: 0.12, y: 9.78, z: 0.22 },
      { x: 0.11, y: 9.81, z: 0.19 }, { x: 0.1, y: 9.79, z: 0.21 },
      { x: 0.13, y: 9.82, z: 0.2 }
    ],
    gyroscope: [
      { x: 0.001, y: 0.001, z: 0.001 }, { x: 0.002, y: 0.001, z: 0.001 },
      { x: 0.001, y: 0.002, z: 0.001 }, { x: 0.001, y: 0.001, z: 0.002 },
      { x: 0.002, y: 0.002, z: 0.001 }
    ],
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: { start: 1000, end: 3000 },
  };

  const replayResult = analyzeSensorIntegrity(screenReplayTelemetry);
  assert(
    replayResult.isRecaptured === true,
    'Flag capture as isRecaptured: true on EMI spike > 55�T',
    `Received isRecaptured: ${replayResult.isRecaptured}`
  );
  assert(
    replayResult.screenDefensePassed === false,
    'screenDefensePassed is false on screen replay detection',
    `Received screenDefensePassed: ${replayResult.screenDefensePassed}`
  );
  assert(
    replayResult.auraFlag === 'RED',
    'AURA flag is RED on second-copy photo capture',
    `Received auraFlag: ${replayResult.auraFlag}`
  );
  assert(
    replayResult.screenDefense.recaptureReason.includes('SECOND-COPY DETECTED'),
    'Dedicated recaptureReason explicitly contains SECOND-COPY DETECTED',
    `Received details: ${replayResult.screenDefense.details}`
  );

  // Test 1.2: Laptop Screen Capture with Natural Magnetometer (32.1 �T) BUT High Optical PWM Flicker (RelVar: 1.77 > 0.75)
  const pwmFlickerReplayTelemetry = {
    magnetometer: [
      { x: 15, y: 18, z: 22, magneticField: 32.1 },
      { x: 15, y: 18, z: 22, magneticField: 32.1 },
      { x: 15, y: 18, z: 22, magneticField: 32.2 },
      { x: 15, y: 18, z: 22, magneticField: 32.0 },
      { x: 15, y: 18, z: 22, magneticField: 32.1 },
    ],
    light: [
      { lux: 80 }, { lux: 420 }, { lux: 95 }, { lux: 510 }, { lux: 110 } // High PWM flux (RelVar ~1.77)
    ],
    accelerometer: [
      { x: 0.1, y: 9.8, z: 0.2 }, { x: 0.12, y: 9.78, z: 0.22 },
      { x: 0.11, y: 9.81, z: 0.19 }, { x: 0.1, y: 9.79, z: 0.21 },
      { x: 0.13, y: 9.82, z: 0.2 }
    ],
    gyroscope: [
      { x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 },
      { x: 0.01, y: 0.01, z: 0.01 }, { x: 0.01, y: 0.01, z: 0.01 },
      { x: 0.01, y: 0.01, z: 0.01 }
    ],
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: { start: 1000, end: 3000 },
  };

  const pwmResult = analyzeSensorIntegrity(pwmFlickerReplayTelemetry);
  assert(
    pwmResult.isRecaptured === true,
    'Laptop screen with 32.1�T mag & 1.77 RelVar PWM flicker triggers isRecaptured: true',
    `Received isRecaptured: ${pwmResult.isRecaptured}`
  );
  assert(
    pwmResult.auraFlag === 'RED',
    'PWM flicker replay triggers STRICT RED flag',
    `Received auraFlag: ${pwmResult.auraFlag}`
  );
  assert(
    pwmResult.screenDefense.details.includes('display PWM optical flicker'),
    'Details explicitly mention Optical PWM flicker',
    `Received details: ${pwmResult.screenDefense.details}`
  );

  // Test 1.3: Real Physical Paper Document with minor natural hand tremor/shadow (RelVar: 0.31)
  const paperDocTelemetry = {
    magnetometer: [
      { x: 15, y: 20, z: 24, magneticField: 34.6 },
      { x: 16, y: 20, z: 24, magneticField: 35.1 },
      { x: 15, y: 21, z: 23, magneticField: 34.6 },
      { x: 16, y: 20, z: 25, magneticField: 35.8 },
      { x: 15, y: 20, z: 24, magneticField: 34.6 },
    ],
    light: [
      { lux: 280 }, { lux: 330 }, { lux: 290 }, { lux: 350 }, { lux: 310 } // Minor natural hand shadow (RelVar ~0.31)
    ],
    accelerometer: [
      { x: 0.1, y: 9.8, z: 0.5 }, { x: 0.18, y: 9.72, z: 0.58 },
      { x: 0.08, y: 9.85, z: 0.44 }, { x: 0.15, y: 9.76, z: 0.52 },
      { x: 0.12, y: 9.81, z: 0.48 }
    ],
    gyroscope: [
      { x: 0.02, y: 0.03, z: 0.01 }, { x: 0.04, y: 0.02, z: 0.03 },
      { x: 0.03, y: 0.04, z: 0.02 }, { x: 0.02, y: 0.03, z: 0.01 },
      { x: 0.03, y: 0.02, z: 0.02 }
    ],
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: { start: 1000, end: 3000 },
  };

  const paperResult = analyzeSensorIntegrity(paperDocTelemetry);
  assert(
    paperResult.isRecaptured === false,
    'Physical paper document (RelVar: 0.31) is NOT falsely flagged as recaptured',
    `Received isRecaptured: ${paperResult.isRecaptured}`
  );
  assert(
    paperResult.screenDefensePassed === true,
    'Physical paper document screenDefensePassed is true',
    `Received screenDefensePassed: ${paperResult.screenDefensePassed}`
  );
  assert(
    paperResult.auraFlag === 'GREEN',
    'Physical paper document evaluates as GREEN',
    `Received auraFlag: ${paperResult.auraFlag}`
  );

  // Test 1.4: Clean ambient real-world capture
  const naturalTelemetry = {
    magnetometer: [
      { x: 15, y: 20, z: 24, magneticField: 34.6 },
      { x: 16, y: 20, z: 24, magneticField: 35.1 },
      { x: 15, y: 21, z: 23, magneticField: 34.6 },
      { x: 16, y: 20, z: 25, magneticField: 35.8 },
      { x: 15, y: 20, z: 24, magneticField: 34.6 },
    ],
    light: [
      { lux: 350 }, { lux: 352 }, { lux: 349 }, { lux: 351 }, { lux: 350 }
    ],
    accelerometer: [
      { x: 0.1, y: 9.8, z: 0.5 }, { x: 0.18, y: 9.72, z: 0.58 },
      { x: 0.08, y: 9.85, z: 0.44 }, { x: 0.15, y: 9.76, z: 0.52 },
      { x: 0.12, y: 9.81, z: 0.48 }
    ],
    gyroscope: [
      { x: 0.02, y: 0.03, z: 0.01 }, { x: 0.04, y: 0.02, z: 0.03 },
      { x: 0.03, y: 0.04, z: 0.02 }, { x: 0.02, y: 0.03, z: 0.01 },
      { x: 0.03, y: 0.02, z: 0.02 }
    ],
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: { start: 1000, end: 3000 },
  };

  const naturalResult = analyzeSensorIntegrity(naturalTelemetry);
  assert(
    naturalResult.isRecaptured === false,
    'Natural capture is NOT flagged as recaptured',
    `Received isRecaptured: ${naturalResult.isRecaptured}`
  );
  assert(
    naturalResult.screenDefensePassed === true,
    'screenDefensePassed is true on clean natural baseline',
    `Received screenDefensePassed: ${naturalResult.screenDefensePassed}`
  );
  assert(
    naturalResult.auraFlag === 'GREEN',
    'AURA flag is GREEN on authentic capture',
    `Received auraFlag: ${naturalResult.auraFlag}`
  );

  // ----------------------------------------------------
  console.log('\n--- SUITE 2: Real Camera Photo EXIF & AI Calibration ---');

  const photoBuffer = await createNaturalPhotoBuffer(1024, 768);

  // Test 2.1: iPhone 13 Pro Real Photo EXIF
  const iphoneExif = {
    Make: 'Apple',
    Model: 'iPhone 13 Pro',
    ExposureTime: 0.008,
    FNumber: 1.5,
    ISO: 64,
    FocalLength: 5.7,
    ExifVersion: '0232'
  };

  const iphoneAnalysis = await analyzeImageMetadata(photoBuffer, iphoneExif);
  assert(
    iphoneAnalysis.classification === 'AUTHENTIC_CAMERA',
    'iPhone 13 photo classified as AUTHENTIC_CAMERA',
    `Received: ${iphoneAnalysis.classification}`
  );
  assert(
    iphoneAnalysis.aiProbability < 25.0,
    'iPhone 13 AI probability is strictly capped < 25%',
    `Received: ${iphoneAnalysis.aiProbability}%`
  );
  assert(
    iphoneAnalysis.realProbability > 75.0,
    'iPhone 13 Real probability is > 75%',
    `Received: ${iphoneAnalysis.realProbability}%`
  );

  // Test 2.2: Canon DSLR Real Photo EXIF (Minimal tags)
  const canonExif = {
    Make: 'Canon',
    Model: 'Canon EOS 90D',
    ExposureTime: 0.002,
    ISO: 200,
    FocalLength: 50.0
  };

  const canonAnalysis = await analyzeImageMetadata(photoBuffer, canonExif);
  assert(
    canonAnalysis.classification === 'AUTHENTIC_CAMERA',
    'Canon DSLR photo classified as AUTHENTIC_CAMERA',
    `Received: ${canonAnalysis.classification}`
  );
  assert(
    canonAnalysis.aiProbability < 25.0,
    'Canon DSLR AI probability is strictly capped < 25%',
    `Received: ${canonAnalysis.aiProbability}%`
  );

  // Test 2.3: Unverified External Photo without EXIF (Decoupled from AI Synthesis)
  const unverifiedAnalysis = await analyzeImageMetadata(photoBuffer, {});
  assert(
    unverifiedAnalysis.classification !== 'AI_GENERATED',
    'Unverified external image without EXIF is NOT falsely flagged as AI_GENERATED',
    `Received: ${unverifiedAnalysis.classification} (AI: ${unverifiedAnalysis.aiProbability}%)`
  );
  assert(
    unverifiedAnalysis.aiProbability < 55.0,
    'Unverified external image without AI tags has moderate/neutral AI score (< 55%)',
    `Received: ${unverifiedAnalysis.aiProbability}%`
  );

  // Test 2.4: Explicit AI Synthesis Tag (e.g. Midjourney / Stable Diffusion)
  const aiExif = {
    Software: 'Midjourney v6.0',
    xmp: {
      prompt: 'A photorealistic portrait of a cybernetic astronaut, 8k octane render',
      parameters: '--v 6.0 --ar 1:1 --chaos 10'
    }
  };

  const aiAnalysis = await analyzeImageMetadata(photoBuffer, aiExif);
  assert(
    aiAnalysis.classification === 'AI_GENERATED',
    'Image with explicit AI software/prompt classified as AI_GENERATED',
    `Received: ${aiAnalysis.classification}`
  );
  assert(
    aiAnalysis.aiProbability >= 85.0,
    'Image with explicit AI software/prompt has AI probability >= 85%',
    `Received: ${aiAnalysis.aiProbability}%`
  );

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED `);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! ?');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED! ?');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
