const express = require("express");
const router = express.Router();

const Device = require("../models/devices");
const DeviceHistory = require("../models/deviceHistory");

router.get("/", async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    res.json(devices);
  } catch (err) {
    console.error("GET DEVICES ERROR:", err);
    res.status(500).json({ message: "Error ambil data device" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { type, guid, name, lat, lng } = req.body;

    if (!type || !guid || !name || !lat || !lng) {
      return res.status(400).json({ message: "Semua data wajib diisi" });
    }

    const existingDevice = await Device.findOne({ guid, type });

    if (existingDevice) {
      return res.status(400).json({ message: "GUID device sudah terdaftar" });
    }

    const device = new Device({
      type,
      guid,
      name,
      lat,
      lng,
      lastUpdate: new Date(),
    });

    await device.save();

    await DeviceHistory.create({
      deviceId: device._id,
      guid: device.guid,
      name: device.name,
      type: device.type,
      status: "registered",
    });

    res.json({
      message: "Device berhasil didaftarkan",
      device,
    });
  } catch (err) {
    console.error("REGISTER DEVICE ERROR:", err);
    res.status(500).json({ message: "Gagal register device" });
  }
});

router.post("/update", async (req, res) => {
  try {
    const { guid } = req.body;

    if (!guid) {
      return res.status(400).json({ message: "GUID wajib dikirim" });
    }

    const device = await Device.findOne({ guid });

    if (!device) {
      return res.status(404).json({ message: "Device tidak ditemukan" });
    }

    device.lastUpdate = new Date();
    await device.save();

    await DeviceHistory.create({
      deviceId: device._id,
      guid: device.guid,
      name: device.name,
      type: device.type,
      status: "online",
    });

    res.json({
      message: "Device updated",
      device,
    });
  } catch (err) {
    console.error("UPDATE DEVICE ERROR:", err);
    res.status(500).json({ message: "Error update device" });
  }
});

// Endpoint simulasi panic button dari Postman / dashboard
router.post("/panic", async (req, res) => {
  try {
    const { guid } = req.body;

    if (!guid) {
      return res.status(400).json({ message: "GUID panic button wajib dikirim" });
    }

    const panicDevice = await Device.findOne({ guid });

    if (!panicDevice) {
      return res.status(404).json({ message: "Panic button tidak ditemukan" });
    }

    if (panicDevice.type !== "panic_button") {
      return res.status(400).json({
        message: "Device ini bukan panic button",
        typeYangTerbaca: panicDevice.type,
      });
    }

    panicDevice.lastUpdate = new Date();
    await panicDevice.save();

    const speakers = await Device.find({ type: "speaker" });

    await DeviceHistory.create({
      deviceId: panicDevice._id,
      guid: panicDevice.guid,
      name: panicDevice.name,
      type: panicDevice.type,
      status: "panic_triggered",
    });

    for (const speaker of speakers) {
      speaker.lastUpdate = new Date();
      await speaker.save();

      await DeviceHistory.create({
        deviceId: speaker._id,
        guid: speaker.guid,
        name: speaker.name,
        type: speaker.type,
        status: "speaker_triggered",
      });
    }

    res.json({
      message: "Panic button triggered speaker",
      panicButton: panicDevice.name,
      triggeredSpeakers: speakers.length,
    });
  } catch (err) {
    console.error("PANIC ERROR:", err);
    res.status(500).json({ message: "Error panic trigger" });
  }
});

module.exports = router;