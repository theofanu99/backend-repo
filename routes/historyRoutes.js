const express = require("express");
const router = express.Router();

const DeviceHistory = require("../models/deviceHistory");

router.get("/", async (req, res) => {
  try {
    const { type, search, startDate, endDate } = req.query;

    const filter = {};

    if (type && type !== "all") {
      filter.type = type;
    }

    if (search && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { guid: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const history = await DeviceHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(history);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ message: "Error ambil history" });
  }
});

router.get("/camera/:guid", async (req, res) => {
  try {
    const { guid } = req.params;

    const snapshots = await DeviceHistory.find({
      guid,
      type: "camera",
      imageUrl: { $exists: true, $ne: "" },
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(snapshots);
  } catch (err) {
    console.error("CAMERA DETAIL ERROR:", err);
    res.status(500).json({ message: "Error ambil detail camera" });
  }
});

module.exports = router;