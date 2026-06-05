const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String,
      default: "",
    },
    reporterName: {
      type: String,
      required: true,
    },
    reporterEmail: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    locationName: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
      default: 0,
    },
    longitude: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "process", "done"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["normal", "high", "emergency"],
      default: "normal",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);