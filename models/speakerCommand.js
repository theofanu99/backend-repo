const mongoose = require("mongoose");

const speakerCommandSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      default: "SPEAKER_001",
    },
    command: {
      type: String,
      enum: ["ON", "OFF"],
      required: true,
      default: "ON",
    },
    status: {
      type: String,
      enum: ["pending", "executed", "failed"],
      default: "pending",
    },
    duration: {
      type: Number,
      default: 30,
    },
    triggeredBy: {
      type: String,
      default: "",
    },
    triggeredByName: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["panic_button", "manual", "system"],
      default: "panic_button",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SpeakerCommand", speakerCommandSchema);