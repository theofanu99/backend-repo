const mongoose = require("mongoose");
require("dotenv").config();

const SpeakerCommand = require("./models/speakerCommand");

const DEVICE_ID = "SPK-001";
const CHECK_INTERVAL_MS = 3000;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for speaker simulator");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}

async function executeCommand(command) {
  try {
    console.log("====================================");
    console.log("SPEAKER COMMAND DETECTED");
    console.log(`Device ID : ${command.deviceId}`);
    console.log(`Command   : ${command.command}`);
    console.log(`Duration  : ${command.duration} seconds`);
    console.log(`Source    : ${command.source}`);
    console.log(`Triggered : ${command.triggeredBy}`);
    console.log("Speaker ON...");
    console.log("====================================");

    await new Promise((resolve) => {
      setTimeout(resolve, command.duration * 1000);
    });

    await SpeakerCommand.findByIdAndUpdate(
      command._id,
      {
        status: "executed",
      },
      {
        new: true,
      }
    );

    console.log(`Speaker OFF. Command ${command._id} marked as executed.`);
  } catch (error) {
    console.error("Execute command error:", error.message);

    await SpeakerCommand.findByIdAndUpdate(command._id, {
      status: "failed",
    });
  }
}

async function checkPendingCommand() {
  try {
    const command = await SpeakerCommand.findOne({
      deviceId: DEVICE_ID,
      status: "pending",
    }).sort({ createdAt: 1 });

    if (!command) {
      console.log(`[${new Date().toLocaleTimeString()}] No pending command for ${DEVICE_ID}`);
      return;
    }

    if (command.command === "ON") {
      await executeCommand(command);
    }
  } catch (error) {
    console.error("Check pending command error:", error.message);
  }
}

async function startSimulator() {
  await connectDB();

  console.log(`Speaker simulator running for device: ${DEVICE_ID}`);
  console.log(`Checking pending command every ${CHECK_INTERVAL_MS / 1000} seconds`);

  setInterval(checkPendingCommand, CHECK_INTERVAL_MS);
}

startSimulator();