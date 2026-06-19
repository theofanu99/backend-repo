const express = require("express");
const router = express.Router();

const DeviceHistory = require("../models/deviceHistory");

router.get("/", async (req, res) => {
  try {
    const { type, status, source, date, search } = req.query;

    const filter = {};

    if (type && type !== "all") {
      filter.type = type;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (source && source !== "all") {
      filter.source = source;
    }

    if (date) {
      const start = new Date(date);
      const end = new Date(date);

      end.setDate(end.getDate() + 1);

      filter.createdAt = {
        $gte: start,
        $lt: end,
      };
    }

    if (search) {
      filter.$or = [
        { guid: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { source: { $regex: search, $options: "i" } },
        { locationName: { $regex: search, $options: "i" } },
        { reporterName: { $regex: search, $options: "i" } },
      ];
    }

    const histories = await DeviceHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(histories);
  } catch (err) {
    console.error("GET HISTORY ERROR:", err);
    res.status(500).json({
      message: "Gagal mengambil data history",
      error: err.message,
    });
  }
});

router.get("/camera/:guid", async (req, res) => {
  try {
    const { guid } = req.params;

    const histories = await DeviceHistory.find({
      guid,
      type: "camera",
      imageUrl: { $exists: true, $ne: "" },
    }).sort({ createdAt: -1 });

    res.json(histories);
  } catch (err) {
    console.error("GET CAMERA HISTORY ERROR:", err);
    res.status(500).json({
      message: "Gagal mengambil history camera",
      error: err.message,
    });
  }
});

module.exports = router;