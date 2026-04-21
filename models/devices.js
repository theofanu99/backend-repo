const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  name: String,
  lat: Number,
  lng: Number,
  lastUpdate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Device", deviceSchema);