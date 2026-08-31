import * as Location from 'expo-location';
import * as SensorExpo from 'expo-sensors';

const BUFFER_SIZE = 30;

/**
 * Manages real-time hardware sensor subscriptions:
 * 1. Accelerometer (device motion x/y/z)
 * 2. Gyroscope (device angular rotation)
 * 3. Magnetometer (chassis magnetic field & EMI)
 * 4. Light Sensor (ambient lux & screen PWM)
 * 5. GPS / Location (geographical coordinates)
 * 6. Timestamp (high-resolution capture interval)
 */
export class SensorManager {
  constructor() {
    this.accelerometerData = [];
    this.gyroscopeData = [];
    this.magnetometerData = [];
    this.lightData = [];
    this.locationData = null;
    this.captureTimestamp = null;
    this.subscriptions = [];
    this.isCollecting = false;
  }

  /**
   * Start active sensor listeners with 50ms update interval immediately
   */
  async startCollecting() {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.resetData();
    this.captureTimestamp = {
      start: Date.now(),
      startISO: new Date().toISOString(),
    };

    try {
      // Set standard 50ms polling interval for responsive telemetry capture
      SensorExpo.Accelerometer.setUpdateInterval(50);
      SensorExpo.Gyroscope.setUpdateInterval(50);
      SensorExpo.Magnetometer.setUpdateInterval(50);

      // 1. Accelerometer Listener
      const accelSub = SensorExpo.Accelerometer.addListener((data) => {
        if (data && typeof data.x === 'number') {
          this.accelerometerData.push({
            x: Number(data.x),
            y: Number(data.y),
            z: Number(data.z),
            timestamp: Date.now(),
          });
          if (this.accelerometerData.length > BUFFER_SIZE) {
            this.accelerometerData.shift();
          }
        }
      });
      this.subscriptions.push(accelSub);

      // 2. Gyroscope Listener
      const gyroSub = SensorExpo.Gyroscope.addListener((data) => {
        if (data && typeof data.x === 'number') {
          this.gyroscopeData.push({
            x: Number(data.x),
            y: Number(data.y),
            z: Number(data.z),
            timestamp: Date.now(),
          });
          if (this.gyroscopeData.length > BUFFER_SIZE) {
            this.gyroscopeData.shift();
          }
        }
      });
      this.subscriptions.push(gyroSub);

      // 3. Magnetometer Listener
      const magnetSub = SensorExpo.Magnetometer.addListener((data) => {
        if (data && typeof data.x === 'number') {
          const mag = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
          this.magnetometerData.push({
            x: Number(data.x),
            y: Number(data.y),
            z: Number(data.z),
            magneticField: Number(mag),
            timestamp: Date.now(),
          });
          if (this.magnetometerData.length > BUFFER_SIZE) {
            this.magnetometerData.shift();
          }
        }
      });
      this.subscriptions.push(magnetSub);
    } catch (sensorErr) {
      console.warn('[AURA SensorManager] Core sensor subscription warning:', sensorErr.message);
    }

    // 4. Light Sensor Listener
    try {
      const lightAvailable = await SensorExpo.LightSensor.isAvailableAsync();
      if (lightAvailable) {
        SensorExpo.LightSensor.setUpdateInterval(50);
        const lightSub = SensorExpo.LightSensor.addListener((data) => {
          if (data && data.illuminance != null) {
            this.lightData.push({
              lux: Number(data.illuminance),
              timestamp: Date.now(),
            });
            if (this.lightData.length > BUFFER_SIZE) {
              this.lightData.shift();
            }
          }
        });
        this.subscriptions.push(lightSub);
      }
    } catch (err) {
      console.warn('[AURA SensorManager] Light sensor not available:', err.message);
    }

    // 5. Location / GPS
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        this.locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        };
      }
    } catch (err) {
      console.warn('[AURA SensorManager] Could not retrieve GPS location:', err.message);
    }

    return true;
  }

  /**
   * Stop collecting sensor data
   */
  stopCollecting() {
    if (!this.isCollecting) return;

    this.subscriptions.forEach((sub) => {
      try {
        sub.remove();
      } catch (e) {}
    });
    this.subscriptions = [];
    this.isCollecting = false;

    if (this.captureTimestamp) {
      this.captureTimestamp.end = Date.now();
      this.captureTimestamp.endISO = new Date().toISOString();
      this.captureTimestamp.durationMs = this.captureTimestamp.end - this.captureTimestamp.start;
    }
  }

  /**
   * Wait to guarantee sufficient samples before taking picture
   */
  async ensureAdequateTelemetry(minSamples = 3) {
    let attempts = 0;
    while (
      attempts < 6 &&
      (this.accelerometerData.length < minSamples || this.magnetometerData.length < minSamples)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      attempts++;
    }
  }

  /**
   * Package structured telemetry payload for backend sealing
   */
  async getTelemetryPayload() {
    if (!this.isCollecting) {
      await this.startCollecting();
    }
    await this.ensureAdequateTelemetry(3);

    if (this.lightData.length < 3 || this.magnetometerData.length < 3) {
      console.warn('[SENSOR ERROR] Telemetry is empty or has fewer than 3 samples!', {
        lightCount: this.lightData.length,
        magCount: this.magnetometerData.length,
        accelCount: this.accelerometerData.length,
      });
    }

    const calcStats = (readings, isLight = false) => {
      if (!readings || readings.length === 0) return null;
      const values = readings.map((r) => {
        if (isLight) return Number(r.lux || r);
        if (r.magneticField != null) return Number(r.magneticField);
        if (r.x != null && r.y != null && r.z != null) return Math.sqrt(r.x ** 2 + r.y ** 2 + r.z ** 2);
        return Number(r) || 0;
      }).filter(Number.isFinite);

      if (values.length === 0) return null;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return {
        count: values.length,
        min,
        max,
        avg,
        variance,
        stdDev,
        relativeVariance: stdDev / (avg || 1),
      };
    };

    return {
      accelerometer: this.accelerometerData.slice(-20),
      gyroscope: this.gyroscopeData.slice(-20),
      magnetometer: this.magnetometerData.slice(-20),
      light: this.lightData.slice(-20),
      location: this.locationData,
      timestamp: {
        start: this.captureTimestamp?.start || Date.now() - 500,
        end: Date.now(),
        startISO: this.captureTimestamp?.startISO || new Date().toISOString(),
        endISO: new Date().toISOString(),
        durationMs: Date.now() - (this.captureTimestamp?.start || Date.now() - 500),
      },
      stats: {
        accelerometer: calcStats(this.accelerometerData),
        gyroscope: calcStats(this.gyroscopeData),
        magnetometer: calcStats(this.magnetometerData),
        light: calcStats(this.lightData, true),
      },
    };
  }

  /**
   * Get raw sensor data for backward compatibility
   */
  getSensorData() {
    return {
      accelerometer: this.accelerometerData.slice(-20),
      gyroscope: this.gyroscopeData.slice(-20),
      magnetometer: this.magnetometerData.slice(-20),
      light: this.lightData.slice(-20),
      location: this.locationData,
      timestamp: this.captureTimestamp || { start: Date.now() - 500, end: Date.now() },
    };
  }

  /**
   * Get live sensor statistics for UI indicators
   */
  getSensorStats() {
    const MAX_GRAPH_POINTS = 60;

    const calcMagnitude = (data) => {
      if (data.length === 0) return null;
      const values = data.map((d) => (d.magneticField != null ? d.magneticField : Math.sqrt((d.x || 0) ** 2 + (d.y || 0) ** 2 + (d.z || 0) ** 2)));
      return {
        count: data.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: values[values.length - 1],
        history: values.slice(-MAX_GRAPH_POINTS),
      };
    };

    const calcLight = (data) => {
      if (data.length === 0) return null;
      const values = data.map((d) => d.lux);
      return {
        count: data.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: values[values.length - 1],
        history: values.slice(-MAX_GRAPH_POINTS),
      };
    };

    return {
      accelerometer: calcMagnitude(this.accelerometerData),
      gyroscope: calcMagnitude(this.gyroscopeData),
      magnetometer: calcMagnitude(this.magnetometerData),
      light: calcLight(this.lightData),
      location: this.locationData,
      timestamp: this.captureTimestamp,
      isScreenEmissionDetected: false,
    };
  }

  /**
   * Reset all sensor buffers
   */
  resetData() {
    this.accelerometerData = [];
    this.gyroscopeData = [];
    this.magnetometerData = [];
    this.lightData = [];
    this.locationData = null;
    this.captureTimestamp = null;
  }

  /**
   * Check sensor availability on device
   */
  static async checkAvailability() {
    try {
      const [accel, gyro, magnet, light] = await Promise.all([
        SensorExpo.Accelerometer.isAvailableAsync().catch(() => false),
        SensorExpo.Gyroscope.isAvailableAsync().catch(() => false),
        SensorExpo.Magnetometer.isAvailableAsync().catch(() => false),
        SensorExpo.LightSensor.isAvailableAsync().catch(() => false),
      ]);

      let location = false;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        location = status === 'granted';
      } catch {
        location = false;
      }

      return {
        accelerometer: Boolean(accel),
        gyroscope: Boolean(gyro),
        magnetometer: Boolean(magnet),
        light: Boolean(light),
        location: Boolean(location),
        timestamp: true,
      };
    } catch (error) {
      console.error('Error checking sensor availability:', error);
      return {
        accelerometer: true,
        gyroscope: true,
        magnetometer: true,
        light: false,
        location: false,
        timestamp: true,
      };
    }
  }
}

export default new SensorManager();