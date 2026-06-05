const express = require("express");
const { randomUUID } = require("crypto");

const Report = require("../models/report");
const User = require("../models/user");
const Device = require("../models/devices");
const SpeakerCommand = require("../models/speakerCommand");
const { protect } = require("../middleware/auth");

const router = express.Router();

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

async function findNearestSpeaker(latitude, longitude) {
  const speakers = await Device.find({
  type: "speaker",
  status: "online",
});

  if (!speakers || speakers.length === 0) {
    return null;
  }

  let nearestSpeaker = null;
  let nearestDistance = Infinity;

  for (const speaker of speakers) {
    const speakerLat = Number(speaker.lat);
    const speakerLng = Number(speaker.lng);

    if (!speakerLat || !speakerLng) continue;

    const distance = calculateDistanceKm(
      latitude,
      longitude,
      speakerLat,
      speakerLng
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSpeaker = speaker;
    }
  }

  if (!nearestSpeaker) {
    return null;
  }

  return {
    speaker: nearestSpeaker,
    distanceKm: nearestDistance,
  };
}

router.post("/app-trigger", protect, async (req, res) => {
  try {
    const {
      latitude = 0,
      longitude = 0,
      locationName = "Lokasi GPS pengguna",
      duration = 30,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const nearestResult = await findNearestSpeaker(latitude, longitude);

    const selectedSpeaker = nearestResult?.speaker;
    const selectedSpeakerGuid = selectedSpeaker?.guid || "SPK-001";
    const selectedSpeakerName = selectedSpeaker?.name || "Speaker Default";
    const distanceKm = nearestResult?.distanceKm || 0;

    const report = await Report.create({
      id: randomUUID(),
      userId: user._id.toString(),
      reporterName: user.name,
      reporterEmail: user.email,
      type: "Panic Button Darurat",
      description: `Laporan darurat dikirim melalui panic button digital. Speaker terdekat: ${selectedSpeakerName}.`,
      locationName,
      latitude,
      longitude,
      status: "pending",
      priority: "emergency",
    });

    const speakerCommand = await SpeakerCommand.create({
      deviceId: selectedSpeakerGuid,
      command: "ON",
      status: "pending",
      duration,
      triggeredBy: user.email,
      triggeredByName: user.name,
      source: "panic_button",
    });

    res.status(201).json({
      message: "Panic button berhasil dipicu",
      nearestSpeaker: {
        guid: selectedSpeakerGuid,
        name: selectedSpeakerName,
        distanceKm: Number(distanceKm.toFixed(3)),
      },
      report,
      speakerCommand,
    });
  } catch (err) {
    console.error("APP PANIC BUTTON ERROR:", err);
    res.status(500).json({
      message: "Gagal memicu panic button",
    });
  }
});

module.exports = router;