const express = require("express");
const router = express.Router();

const Device = require("../models/devices");
const DeviceHistory = require("../models/deviceHistory");

const auth = require("../middleware/auth");

// GET semua device
router.get("/", auth, async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: "Error ambil device" });
  }
});

// TAMBAH DEVICE
router.post("/", auth, async (req, res) => {
  try {
    const { name, lat, lng } = req.body;

    const device = new Device({
      name,
      lat,
      lng,
      lastUpdate: new Date(),
    });

    await device.save();

    // simpan history pertama
    await DeviceHistory.create({
      deviceId: device._id,
      name: device.name,
      status: "online",
    });

    res.json(device);
  } catch (err) {
    res.status(500).json({ message: "Gagal tambah device" });
  }
});

// UPDATE DEVICE (SIMULASI DEVICE KIRIM DATA)
router.post("/update", async (req, res) => {
  try {
    const { deviceId } = req.body;

    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({ message: "Device tidak ditemukan" });
    }

    device.lastUpdate = new Date();
    await device.save();

    // status selalu online saat update
    await DeviceHistory.create({
      deviceId: device._id,
      name: device.name,
      status: "online",
    });

    res.json({ message: "Device updated" });
  } catch (err) {
    res.status(500).json({ message: "Error update device" });
  }
});

module.exports = router;