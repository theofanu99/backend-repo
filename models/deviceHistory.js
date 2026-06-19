const mongoose = require("mongoose");

const deviceHistorySchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
    },

    guid: {
      type: String,
    },

    name: {
      type: String,
    },

    type: {
      type: String,
    },

    status: {
      type: String,
    },

    imageUrl: {
      type: String,
    },

    lat: {
      type: Number,
    },

    lng: {
      type: Number,
    },

    locationName: {
      type: String,
    },

    source: {
      type: String,
      default: "device",
    },

    reporterName: {
      type: String,
    },

    description: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DeviceHistory ||
  mongoose.model("DeviceHistory", deviceHistorySchema);