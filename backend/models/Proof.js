const mongoose = require('mongoose');

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
      accelerometer: [Number],
      gyroscope: [Number],
      magnetometer: [Number],
    },
    metadata: {
      deviceId: String,
      timestamp: String,
      capturedAt: Number,
      location: {
        latitude: Number,
        longitude: Number,
      },
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
