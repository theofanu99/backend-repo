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

function getDeviceGuid(device) {
  return (
    device.guid ||
    device.deviceId ||
    device.device_id ||
    device.code ||
    device._id?.toString()
  );
}

function getDeviceName(device) {
  return (
    device.name ||
    device.deviceName ||
    device.label ||
    getDeviceGuid(device) ||
    "Speaker"
  );
}

function getDeviceLat(device) {
  return Number(device.lat ?? device.latitude ?? device.location?.lat);
}

function getDeviceLng(device) {
  return Number(device.lng ?? device.longitude ?? device.location?.lng);
}

async function findNearestSpeaker(latitude, longitude) {
  const userLat = Number(latitude);
  const userLng = Number(longitude);

  if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
    console.log("INVALID USER COORDINATE:", { latitude, longitude });
    return null;
  }

  const speakers = await Device.find({
    type: "speaker",
  });

  console.log("TOTAL SPEAKERS FOUND:", speakers.length);

  if (!speakers || speakers.length === 0) {
    return null;
  }

  let nearestSpeaker = null;
  let nearestDistance = Infinity;

  for (const speaker of speakers) {
    const speakerGuid = getDeviceGuid(speaker);
    const speakerName = getDeviceName(speaker);
    const speakerLat = getDeviceLat(speaker);
    const speakerLng = getDeviceLng(speaker);

    console.log("CHECK SPEAKER:", {
      guid: speakerGuid,
      name: speakerName,
      type: speaker.type,
      status: speaker.status,
      lat: speakerLat,
      lng: speakerLng,
    });

    if (Number.isNaN(speakerLat) || Number.isNaN(speakerLng)) {
      console.log("SKIP SPEAKER - invalid coordinate:", speakerGuid);
      continue;
    }

    const distance = calculateDistanceKm(
      userLat,
      userLng,
      speakerLat,
      speakerLng
    );

    console.log("DISTANCE:", speakerGuid, distance, "km");

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

    const selectedSpeaker = nearestResult?.speaker || null;

    const selectedSpeakerGuid = selectedSpeaker
      ? getDeviceGuid(selectedSpeaker)
      : "SPK-001";

    const selectedSpeakerName = selectedSpeaker
      ? getDeviceName(selectedSpeaker)
      : "Speaker Default";

    const distanceKm = nearestResult?.distanceKm || 0;

    console.log("SELECTED SPEAKER:", {
      guid: selectedSpeakerGuid,
      name: selectedSpeakerName,
      distanceKm: Number(distanceKm.toFixed(3)),
    });

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
      error: err.message,
    });
  }
});

module.exports = router;