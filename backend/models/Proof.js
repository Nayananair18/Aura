const mongoose = require('mongoose');

const SensorReadingSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  z: Number,
  magneticField: Number,
  timestamp: Number,
}, { _id: false });

const LightReadingSchema = new mongoose.Schema({
  lux: Number,
  timestamp: Number,
}, { _id: false });

const LocationSchema = new mongoose.Schema({
  latitude: Number,
  longitude: Number,
  altitude: Number,
  accuracy: Number,
  timestamp: Number,
  error: String,
}, { _id: false });

const TimestampSchema = new mongoose.Schema({
  start: Number,
  end: Number,
  startISO: String,
  endISO: String,
  durationMs: Number,
}, { _id: false });

const ProofSchema = new mongoose.Schema(
  {
    proofId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hash: {
      type: String,
      required: true,
      index: true,
    },
    imageHash: {
      type: String,
      index: true,
    },
    sensorData: {
      accelerometer: [SensorReadingSchema],
      gyroscope: [SensorReadingSchema],
      magnetometer: [SensorReadingSchema],
      light: [LightReadingSchema],
      location: LocationSchema,
      timestamp: TimestampSchema,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    integrityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ['authentic', 'tampered', 'unverified'],
      default: 'unverified',
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    imageData: {
      type: String, // Base64 string of the watermarked image
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Proof', ProofSchema);
