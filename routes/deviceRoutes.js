const express = require("express");
const router = express.Router();

const Device = require("../models/devices");
const DeviceHistory = require("../models/deviceHistory");

router.get("/", async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });

    const result = devices.map((device) => {
      const obj = device.toObject();

      let connectionStatus = "offline";

      if (obj.lastUpdate) {
        const now = Date.now();
        const lastUpdateTime = new Date(obj.lastUpdate).getTime();
        const diff = now - lastUpdateTime;

        // kalau lastUpdate kurang dari 30 detik, dianggap online
        if (diff <= 30000) {
          connectionStatus = "online";
        }
      }

      return {
        ...obj,

        // status koneksi device
        connectionStatus,

        // status fungsi alat: standby / alert
        functionStatus: obj.status,

        // status yang dipakai website untuk badge
        displayStatus:
          connectionStatus === "offline"
            ? "offline"
            : obj.status === "alert"
            ? "alert"
            : "online",
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data device",
      error: error.message,
    });
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

// DELETE device by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const device = await Device.findById(id);

    if (!device) {
      return res.status(404).json({ message: "Device tidak ditemukan" });
    }

    await Device.findByIdAndDelete(id);

    res.json({
      message: "Device berhasil dihapus",
      deletedDevice: device,
    });
  } catch (err) {
    console.error("DELETE DEVICE ERROR:", err);
    res.status(500).json({ message: "Gagal menghapus device" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json(device);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch device detail" });
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    const histories = await DeviceHistory.find({
      deviceId: req.params.id,
    }).sort({ createdAt: -1 });

    res.json(histories);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch device history" });
  }
});

module.exports = router;