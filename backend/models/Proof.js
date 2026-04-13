const mongoose = require('mongoose');

// Schema for individual sensor readings ({x, y, z, timestamp})
const SensorReadingSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  z: Number,
  timestamp: Number,
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
    sensorData: {
      accelerometer: [SensorReadingSchema],
      gyroscope: [SensorReadingSchema],
      magnetometer: [SensorReadingSchema],
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
    status: {
      type: String,
      enum: ['authentic', 'tampered', 'unverified'],
      default: 'unverified',
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Proof', ProofSchema);
