const mongoose = require('mongoose');

const VerificationResultSchema = new mongoose.Schema(
  {
    verificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    proofId: {
      type: String,
      required: true,
      index: true,
    },
    fileHash: {
      type: String,
      required: true,
    },
    hashValidation: {
      isValid: Boolean,
      matchPercentage: Number,
      uploadedHash: String,
      storedHash: String,
    },
    status: {
      type: String,
      enum: ['authentic', 'tampered', 'inconclusive', 'unverified'],
      default: 'unverified',
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      required: true,
    },
    metadata: {
      fileName: String,
      fileSize: Number,
      fileMimeType: String,
      verifiedAt: String,
      verifiedFrom: String,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('VerificationResult', VerificationResultSchema);
