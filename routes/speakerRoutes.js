const express = require("express");
const router = express.Router();

const SpeakerCommand = require("../models/speakerCommand");

router.get("/pending/:deviceId", async (req, res) => {
  try {
    const command = await SpeakerCommand.findOne({
      deviceId: req.params.deviceId,
      status: "pending",
    }).sort({ createdAt: -1 });

    if (!command) {
      return res.json({
        hasCommand: false,
        command: null,
      });
    }

    res.json({
      hasCommand: true,
      command,
    });
  } catch (err) {
    console.error("GET PENDING SPEAKER ERROR:", err);
    res.status(500).json({
      message: "Gagal mengambil command pending",
    });
  }
});

module.exports = router;