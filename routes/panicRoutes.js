const express = require("express");
const { randomUUID } = require("crypto");

const Report = require("../models/report");
const User = require("../models/user");
const Device = require("../models/devices");
const DeviceHistory = require("../models/deviceHistory");
const SpeakerCommand = require("../models/speakerCommand");
const { protect } = require("../middleware/auth");
const { publishSpeakerCommand } = require("../rabbitmqConsumer");

const router = express.Router();

// 0 = ON
// 1 = OFF
const SPEAKER_ON_COMMAND = "0";
const SPEAKER_OFF_COMMAND = "1";

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

    if (!selectedSpeaker) {
      return res.status(404).json({
        message: "Speaker terdekat tidak ditemukan",
      });
    }

    const selectedSpeakerGuid = getDeviceGuid(selectedSpeaker);
    const selectedSpeakerName = getDeviceName(selectedSpeaker);
    const distanceKm = nearestResult?.distanceKm || 0;
    const commandDuration = Number(duration) || 30;

    console.log("SELECTED SPEAKER:", {
      guid: selectedSpeakerGuid,
      name: selectedSpeakerName,
      distanceKm: Number(distanceKm.toFixed(3)),
      duration: commandDuration,
    });

    // 1. Simpan laporan warga
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

    // 2. Simpan history panic dari aplikasi warga
    await DeviceHistory.create({
      guid: "APP-PANIC",
      name: `Panic dari ${user.name}`,
      type: "panic_button",
      status: "panic_triggered",
      lat: latitude,
      lng: longitude,
      locationName,
      source: "citizen_app",
      reporterName: user.name,
      description: `Panic digital dari aplikasi warga. Lokasi: ${locationName}`,
    });

    // 3. Simpan command speaker ke database
    const speakerCommand = await SpeakerCommand.create({
      deviceId: selectedSpeakerGuid,
      command: "ON",
      status: "pending",
      duration: commandDuration,
      triggeredBy: user.email,
      triggeredByName: user.name,
      source: "panic_button",
    });

    // 4. Simpan history speaker triggered
    await DeviceHistory.create({
      deviceId: selectedSpeaker._id,
      guid: selectedSpeakerGuid,
      name: selectedSpeakerName,
      type: "speaker",
      status: "speaker_triggered",
      lat: getDeviceLat(selectedSpeaker),
      lng: getDeviceLng(selectedSpeaker),
      locationName: selectedSpeaker.locationName || selectedSpeakerName,
      source: "citizen_app",
      reporterName: user.name,
      description: `Speaker aktif karena panic digital dari aplikasi warga. Jarak: ${Number(
        distanceKm.toFixed(3)
      )} km`,
    });

    // 5. Kirim command ON ke RabbitMQ
    await publishSpeakerCommand(selectedSpeakerGuid, SPEAKER_ON_COMMAND);

    console.log(
      `SPEAKER ON SENT: ${selectedSpeakerGuid}#${SPEAKER_ON_COMMAND}`
    );

    // 6. Setelah durasi selesai, kirim command OFF otomatis
    setTimeout(async () => {
      try {
        await publishSpeakerCommand(selectedSpeakerGuid, SPEAKER_OFF_COMMAND);

        await SpeakerCommand.findByIdAndUpdate(
          speakerCommand._id,
          {
            status: "executed",
          },
          {
            returnDocument: "after",
          }
        );

        await DeviceHistory.create({
          deviceId: selectedSpeaker._id,
          guid: selectedSpeakerGuid,
          name: selectedSpeakerName,
          type: "speaker",
          status: "speaker_off",
          lat: getDeviceLat(selectedSpeaker),
          lng: getDeviceLng(selectedSpeaker),
          locationName: selectedSpeaker.locationName || selectedSpeakerName,
          source: "system_auto",
          reporterName: user.name,
          description: `Speaker otomatis dimatikan setelah ${commandDuration} detik.`,
        });

        console.log(
          `SPEAKER OFF SENT: ${selectedSpeakerGuid}#${SPEAKER_OFF_COMMAND}`
        );
      } catch (error) {
        console.error("AUTO SPEAKER OFF ERROR:", error.message);

        await SpeakerCommand.findByIdAndUpdate(
          speakerCommand._id,
          {
            status: "failed",
          },
          {
            returnDocument: "after",
          }
        );
      }
    }, commandDuration * 1000);

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