const express = require("express");
const router = express.Router();

const DeviceHistory = require("../models/deviceHistory");
const auth = require("../middleware/auth");

// GET HISTORY
router.get("/", auth, async (req, res) => {
  try {
    const history = await DeviceHistory
      .find()
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Error ambil history" });
  }
});

module.exports = router;