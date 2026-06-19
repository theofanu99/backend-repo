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

    locationName: {
      type: String,
      default: "",
    },

    lastUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

deviceSchema.index({ guid: 1, type: 1 }, { unique: true });

module.exports =
  mongoose.models.Device || mongoose.model("Device", deviceSchema);