const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
  },
  name: String,
  status: String, // online / offline
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DeviceHistory", historySchema);