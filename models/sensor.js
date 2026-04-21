const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema({
  name: String,
  value: Number,
  status: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Sensor", sensorSchema);