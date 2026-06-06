const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["panic_button", "camera", "speaker"],
    },

    
    guid: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Kombinasi guid + type harus unik
// Jadi GUID sama boleh, tapi type-nya harus beda
deviceSchema.index({ guid: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Device", deviceSchema);