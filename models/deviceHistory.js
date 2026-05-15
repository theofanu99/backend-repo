const mongoose = require("mongoose");

const deviceHistorySchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
    },
    guid: String,
    name: String,
    type: String,
    status: String,

    // untuk snapshot camera
    imageUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeviceHistory", deviceHistorySchema);