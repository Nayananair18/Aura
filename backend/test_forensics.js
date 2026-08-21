const { analyzeSensorIntegrity } = require("./utils/crypto");
const sharp = require("sharp");

async function runAllTests() {
  console.log("=== RUNNING LIVE TERMINAL & IDLE SENSOR SCREEN DEFENSE TESTS ===\\n");

  // User Exact State: lightAvg: 3.77, magSpread: 0.80 over VS Code / Terminal Screen
  console.log("Test 1: Terminal/IDE Laptop Screen with idle sensors (lightAvg: 3.77, magSpread: 0.80)...");
  const darkScreenBuf = Buffer.alloc(200 * 200 * 3);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const idx = (y * 200 + x) * 3;
      // Dark background ~ #1e1e1e (intensity ~ 25)
      darkScreenBuf[idx] = 25;
      darkScreenBuf[idx+1] = 25;
      darkScreenBuf[idx+2] = 25;
      // Bright terminal text
      if (y % 14 > 4 && y % 14 < 9 && x > 15 && x < 180 && (x % 3 === 0)) {
        darkScreenBuf[idx] = 240;
        darkScreenBuf[idx+1] = 240;
        darkScreenBuf[idx+2] = 240;
      }
    }
  }
  const darkJpg = await sharp(darkScreenBuf, { raw: { width: 200, height: 200, channels: 3 } }).jpeg().toBuffer();
  const darkBase64 = darkJpg.toString("base64");

  const idleSensorTelemetry = {
    accelerometer: [{ x: 0.02, y: 9.81, z: 0.05 }, { x: 0.03, y: 9.80, z: 0.06 }],
    magnetometer: [{ magneticField: 39.54 }, { magneticField: 40.34 }],
    light: [{ lux: 3.77 }, { lux: 3.77 }],
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: { start: Date.now() - 500, end: Date.now() },
  };

  const result1 = await analyzeSensorIntegrity(idleSensorTelemetry, {}, darkBase64);
  console.log("Result 1 AuraFlag:", result1.auraFlag, "| isRecaptured:", result1.isRecaptured, "| Details:", result1.screenDefense.details);
  if (result1.auraFlag !== "RED" || result1.isRecaptured !== true || result1.classification !== "SCREEN_REPLAY") {
    console.error("FAIL: Terminal laptop screen was not flagged as RED!");
    process.exit(1);
  } else {
    console.log("PASS: Terminal laptop screen correctly triggered RED SCREEN_REPLAY.\\n");
  }

  // Test 2: Real Physical Book Scan with same idle sensor readings
  console.log("Test 2: Real Physical Book Scan ('Diary of a Wimpy Kid') with idle sensors...");
  const bookBuf = Buffer.alloc(200 * 200 * 3);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const idx = (y * 200 + x) * 3;
      const paperBase = 205 + Math.round((Math.random() - 0.5) * 10);
      bookBuf[idx] = paperBase;
      bookBuf[idx+1] = paperBase;
      bookBuf[idx+2] = paperBase - 4;
      if (y > 30 && y < 150 && x > 40 && x < 140 && (Math.abs(x - y) < 2 || Math.abs(x + y - 180) < 2)) {
        bookBuf[idx] = 60 + Math.round((Math.random() - 0.5) * 10);
        bookBuf[idx+1] = 60 + Math.round((Math.random() - 0.5) * 10);
        bookBuf[idx+2] = 60 + Math.round((Math.random() - 0.5) * 10);
      }
    }
  }
  const bookJpg = await sharp(bookBuf, { raw: { width: 200, height: 200, channels: 3 } }).jpeg().toBuffer();
  const bookBase64 = bookJpg.toString("base64");

  const result2 = await analyzeSensorIntegrity(idleSensorTelemetry, {}, bookBase64);
  console.log("Result 2 AuraFlag:", result2.auraFlag, "| isRecaptured:", result2.isRecaptured, "| Score:", result2.overallScore);
  if (result2.auraFlag !== "GREEN" || result2.isRecaptured !== false) {
    console.error("FAIL: Real physical book was falsely flagged!");
    process.exit(1);
  } else {
    console.log("PASS: Real physical book verified as GREEN authentic.\\n");
  }

  console.log("ALL DIRECT IMAGE & SENSOR REPLAY TESTS PASSED WITH 100% ACCURACY!");
}

runAllTests().catch(err => {
  console.error(err);
  process.exit(1);
});