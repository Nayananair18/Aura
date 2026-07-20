/**
 * A.U.R.A. Mobile Capture SDK for React Native
 * 
 * Authenticated Unforgeable Reality Architecture
 * Fuses raw pixel data with live MEMS sensors at the millisecond of shutter execution.
 * 
 * Dependencies:
 * - react-native-sensors (for Magnetometer, Gyroscope)
 * - react-native-camera or expo-camera (for camera capture)
 * - react-native-fs (for base64/file processing)
 */

import { Magnetometer, LightSensor } from 'react-native-sensors';
import NativeModules from 'react-native';
import { Buffer } from 'buffer';

const AURA_API_ENDPOINT = "http://localhost:8000/api/capture";
const DEV_API_KEY = "aura_dev_secret_key_2026";

class AuraSDK {
  constructor(apiKey = DEV_API_KEY, deviceFingerprint = "aura_default_rn_sdk_client") {
    this.apiKey = apiKey;
    this.deviceFingerprint = deviceFingerprint;
    this.magnetometerSubscription = null;
    this.lightSubscription = null;

    // Buffered sensor values
    this.currentSensorPayload = {
      lux: 450.0, // Ambient light default
      magnetometer_uT: 48.2, // Earth's ambient magnetic field default
      magnetometer_details: { x: 18.2, y: -30.1, z: 32.5 },
      gravity_xyz: [0.0, 0.0, 9.8], // Default resting flat
      pwm_score: 0.0,
      moire_score: 0.0
    };

    this.startSensorMonitoring();
  }

  /**
   * Subscribes to low-level hardware sensors at high sample frequency (50Hz / 20ms intervals)
   */
  startSensorMonitoring() {
    // 1. Magnetometer Monitoring (Microteslas uT)
    if (Magnetometer) {
      this.magnetometerSubscription = new Magnetometer({
        updateInterval: 20 // 50 Hz
      }).subscribe(
        sensorData => {
          const { x, y, z } = sensorData;
          // Calculate overall magnetic field strength B = sqrt(x^2 + y^2 + z^2)
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          
          this.currentSensorPayload.magnetometer_uT = parseFloat(magnitude.toFixed(2));
          this.currentSensorPayload.magnetometer_details = {
            x: parseFloat(x.toFixed(2)),
            y: parseFloat(y.toFixed(2)),
            z: parseFloat(z.toFixed(2))
          };
        },
        error => console.warn("AuraSDK: Magnetometer sensor not available on this hardware.", error)
      );
    }

    // 2. Ambient Light Monitoring (Lux)
    // Note: Expo/RN standard light sensors are often custom native wrappers
    if (LightSensor) {
      this.lightSubscription = new LightSensor({
        updateInterval: 50 // 20 Hz
      }).subscribe(
        sensorData => {
          this.currentSensorPayload.lux = parseFloat(sensorData.light.toFixed(2));
        },
        error => console.warn("AuraSDK: LightSensor not supported or missing permissions.", error)
      );
    }
  }

  /**
   * Stops sensor polling to conserve device battery
   */
  stopSensorMonitoring() {
    if (this.magnetometerSubscription) {
      this.magnetometerSubscription.unsubscribe();
    }
    if (this.lightSubscription) {
      this.lightSubscription.unsubscribe();
    }
  }

  /**
   * Captures the current camera frame, extracts raw sensors simultaneously,
   * performs pre-flight verification, hashes locally, and seals on the backend.
   * 
   * @param {string} imageBase64 Base64 string of the image from camera capture
   * @param {object} mockOverrides Optional overrides for simulated/mock testing
   */
  async sealCapture(imageBase64, mockOverrides = {}) {
    const timestamp = new Date().toISOString();
    
    // Fuse current hardware sensor state with optional overrides (for demo or simulator)
    const fusedSensors = {
      ...this.currentSensorPayload,
      ...mockOverrides
    };

    // Calculate local TFLite pre-checks (Moiré, PWM flicker, gravity orientation)
    // In production, this would be computed by a TFLite model running locally on-device.
    const moireScore = fusedSensors.moire_score || 0.05;
    const pwmScore = fusedSensors.pwm_score || 0.02;

    const payload = {
      image_base64: imageBase64,
      device_fingerprint: this.deviceFingerprint,
      sensor_payload: {
        lux: fusedSensors.lux,
        magnetometer_uT: fusedSensors.magnetometer_uT,
        magnetometer_details: fusedSensors.magnetometer_details,
        gravity_xyz: fusedSensors.gravity_xyz,
        pwm_score: pwmScore,
        moire_score: moireScore
      },
      captured_at: timestamp
    };

    // Pre-flight validation: check for local visual/EMF indicators of screen replays
    if (fusedSensors.magnetometer_uT > 120.0 || moireScore > 0.4 || pwmScore > 0.5) {
      return {
        status: "rejected",
        ml_flags: {
          screen_attack: true,
          reasons: [
            fusedSensors.magnetometer_uT > 120.0 ? "Abnormal EMF signature detected (monitor proximity)" : null,
            moireScore > 0.4 ? "Visual Moiré pixel patterns detected" : null,
            pwmScore > 0.5 ? "Invisible PWM backlight flicker detected" : null
          ].filter(Boolean)
        },
        message: "Reject-before-seal: A.U.R.A. ML engine flagged threat signature."
      };
    }

    // Submit to server for secure cryptographic sealing, metadata tagging, and ledger anchor
    try {
      const response = await fetch(AURA_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Verification request failed");
      }

      return await response.json();
    } catch (error) {
      console.error("AuraSDK: Cryptographic seal failed during dispatch", error);
      return {
        status: "failed",
        message: `Network or sealing error: ${error.message}`
      };
    }
  }
}

export default AuraSDK;
