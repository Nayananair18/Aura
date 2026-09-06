import * as Location from 'expo-location';
import * as SensorExpo from 'expo-sensors';

/**
 * Manages all 6 sensor data sources:
 * 1. Light Sensor (ambient brightness in lux)
 * 2. Accelerometer (device motion x/y/z)
 * 3. Gyroscope (device rotation)
 * 4. Magnetometer (magnetic field - detects screen replay)
 * 5. GPS / Location (capture coordinates)
 * 6. Timestamp (exact capture timing)
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
   * Start collecting all sensor data
   */
  async startCollecting() {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.resetData();
    this.captureTimestamp = {
      start: Date.now(),
      startISO: new Date().toISOString(),
    };

    // Set update intervals (100ms = 10 readings/sec)
    SensorExpo.Accelerometer.setUpdateInterval(100);
    SensorExpo.Gyroscope.setUpdateInterval(100);
    SensorExpo.Magnetometer.setUpdateInterval(100);

    // 1. Accelerometer
    const accelSub = SensorExpo.Accelerometer.addListener((data) => {
      this.accelerometerData.push({
        x: data.x,
        y: data.y,
        z: data.z,
        timestamp: Date.now(),
      });
    });
    this.subscriptions.push(accelSub);

    // 2. Gyroscope
    const gyroSub = SensorExpo.Gyroscope.addListener((data) => {
      this.gyroscopeData.push({
        x: data.x,
        y: data.y,
        z: data.z,
        timestamp: Date.now(),
      });
    });
    this.subscriptions.push(gyroSub);

    // 3. Magnetometer
    const magnetSub = SensorExpo.Magnetometer.addListener((data) => {
      this.magnetometerData.push({
        x: data.x,
        y: data.y,
        z: data.z,
        magneticField: Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2),
        timestamp: Date.now(),
      });
    });
    this.subscriptions.push(magnetSub);

    // 4. Light Sensor (Android only)
    try {
      const lightAvailable = await SensorExpo.LightSensor.isAvailableAsync();
      if (lightAvailable) {
        SensorExpo.LightSensor.setUpdateInterval(200);
        const lightSub = SensorExpo.LightSensor.addListener((data) => {
          this.lightData.push({
            lux: data.illuminance,
            timestamp: Date.now(),
          });
        });
        this.subscriptions.push(lightSub);
      }
    } catch (err) {
      console.warn('Light sensor not available:', err.message);
    }

    // 5. GPS / Location
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        this.locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        };
      } else {
        console.warn('Location permission not granted');
        this.locationData = { error: 'Permission denied' };
      }
    } catch (err) {
      console.warn('Could not get location:', err.message);
      this.locationData = { error: err.message };
    }

    return true;
  }

  /**
   * Stop collecting sensor data
   */
  stopCollecting() {
    if (!this.isCollecting) return;

    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
    this.isCollecting = false;

    // Record end timestamp
    if (this.captureTimestamp) {
      this.captureTimestamp.end = Date.now();
      this.captureTimestamp.endISO = new Date().toISOString();
      this.captureTimestamp.durationMs = this.captureTimestamp.end - this.captureTimestamp.start;
    }
  }

  /**
   * Get all collected sensor data
   */
  getSensorData() {
    return {
      accelerometer: this.accelerometerData,
      gyroscope: this.gyroscopeData,
      magnetometer: this.magnetometerData,
      light: this.lightData,
      location: this.locationData,
      timestamp: this.captureTimestamp,
    };
  }

  /**
   * Get all collected sensor telemetry payload (alias for getSensorData)
   */
  async getTelemetryPayload() {
    return this.getSensorData();
  }

  /**
   * Get live sensor statistics (for UI display during capture)
   */
  getSensorStats() {
    const MAX_GRAPH_POINTS = 60;

    const calcMagnitude = (data) => {
      if (data.length === 0) return null;
      const values = data.map((d) => Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2));
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

    // Synthetic history for Location (accuracy) and Timestamp (elapsed)
    const getLocationHistory = () => {
      if (!this.locationData) return [];
      // Mock history for visual consistency: a few points around current accuracy
      const acc = this.locationData.accuracy || 10;
      return [acc * 1.1, acc * 0.9, acc, acc * 1.05, acc];
    };

    const getTimestampHistory = () => {
      if (!this.captureTimestamp || !this.captureTimestamp.start) return [];
      // Elapsed points
      const elapsed = (Date.now() - this.captureTimestamp.start) / 1000;
      return [0, elapsed * 0.25, elapsed * 0.5, elapsed * 0.75, elapsed];
    };

    return {
      accelerometer: calcMagnitude(this.accelerometerData),
      gyroscope: calcMagnitude(this.gyroscopeData),
      magnetometer: calcMagnitude(this.magnetometerData),
      light: calcLight(this.lightData),
      location: { ...this.locationData, history: getLocationHistory() },
      timestamp: { ...this.captureTimestamp, history: getTimestampHistory() },
    };
  }

  /**
   * Reset all sensor data
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
   * Check which sensors are available on this device
   */
  static async checkAvailability() {
    try {
      const [accel, gyro, magnet, light] = await Promise.all([
        SensorExpo.Accelerometer.isAvailableAsync(),
        SensorExpo.Gyroscope.isAvailableAsync(),
        SensorExpo.Magnetometer.isAvailableAsync(),
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
        accelerometer: accel,
        gyroscope: gyro,
        magnetometer: magnet,
        light,
        location,
        timestamp: true, // always available
      };
    } catch (error) {
      console.error('Error checking sensor availability:', error);
      return {
        accelerometer: false,
        gyroscope: false,
        magnetometer: false,
        light: false,
        location: false,
        timestamp: true,
      };
    }
  }
}

export default new SensorManager();
