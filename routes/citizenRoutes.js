const express = require("express");
const router = express.Router();

const Device = require("../models/devices");
const DeviceHistory = require("../models/deviceHistory");
const { publishSpeakerCommand } = require("../rabbitmqConsumer");

// PANIC DARI APLIKASI WARGA
router.post("/panic", async (req, res) => {
  try {
    const { guid, reporterName, lat, lng, description } = req.body;

    if (!guid) {
      return res.status(400).json({
        message: "GUID wajib dikirim",
      });
    }

    // Cari panic button berdasarkan GUID
    const panicDevice = await Device.findOne({
      guid,
      type: "panic_button",
    });

    if (!panicDevice) {
      return res.status(404).json({
        message: "Panic button tidak ditemukan",
      });
    }

    panicDevice.lastUpdate = new Date();

    if (lat && lng) {
      panicDevice.lat = lat;
      panicDevice.lng = lng;
    }

    await panicDevice.save();

    // Simpan history panic dari aplikasi warga
    await DeviceHistory.create({
      deviceId: panicDevice._id,
      guid: panicDevice.guid,
      name: panicDevice.name,
      type: panicDevice.type,
      status: "panic_triggered",
      source: "citizen_app",
      reporterName: reporterName || "",
      description: description || "",
    });

    // Cari speaker pasangan dengan GUID yang sama
    const speaker = await Device.findOne({
      guid: panicDevice.guid,
      type: "speaker",
    });

    if (!speaker) {
      return res.status(404).json({
        message: "Speaker pasangan tidak ditemukan",
        panicButton: panicDevice.name,
        guid: panicDevice.guid,
      });
    }

    speaker.lastUpdate = new Date();
    await speaker.save();

    // Simpan history speaker
    await DeviceHistory.create({
      deviceId: speaker._id,
      guid: speaker.guid,
      name: speaker.name,
      type: speaker.type,
      status: "speaker_triggered",
      source: "citizen_app",
      reporterName: reporterName || "",
      description: description || "",
    });

    // Kirim command ON ke speaker pasangan
    await publishSpeakerCommand(speaker.guid, "1");

    res.json({
      message: "Panic dari aplikasi warga berhasil diproses",
      source: "citizen_app",
      reporterName: reporterName || "-",
      description: description || "-",
      panicButton: panicDevice.name,
      speaker: speaker.name,
      guid: panicDevice.guid,
    });
  } catch (err) {
    console.error("CITIZEN PANIC ERROR:", err);
    res.status(500).json({
      message: "Gagal memproses panic dari aplikasi warga",
    });
  }
});

module.exports = router;