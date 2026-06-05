const express = require("express");
const router = express.Router();

const Report = require("../models/report");

// GET semua laporan atau filter by userId
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    const filter = userId ? { userId } : {};

    const reports = await Report.find(filter).sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    res.status(500).json({ message: "Error ambil data laporan" });
  }
});

// CREATE laporan
router.post("/", async (req, res) => {
  try {
    const {
      id,
      userId,
      reporterName,
      reporterEmail,
      type,
      description,
      locationName,
      latitude,
      longitude,
      status,
      priority,
    } = req.body;

    if (!id || !reporterName || !type || !description || !locationName) {
      return res.status(400).json({
        message:
          "id, reporterName, type, description, dan locationName wajib diisi",
      });
    }

    const report = await Report.create({
      id,
      userId: userId || "",
      reporterName,
      reporterEmail: reporterEmail || "",
      type,
      description,
      locationName,
      latitude: latitude || 0,
      longitude: longitude || 0,
      status: status || "pending",
      priority: priority || "normal",
    });

    res.status(201).json({
      message: "Laporan berhasil dibuat",
      report,
    });
  } catch (err) {
    console.error("CREATE REPORT ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({ message: "ID laporan sudah ada" });
    }

    res.status(500).json({ message: "Gagal membuat laporan" });
  }
});

// UPDATE status laporan
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "process", "done"].includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid",
      });
    }

    const report = await Report.findOneAndUpdate(
      { id: req.params.id },
      { status },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: "Laporan tidak ditemukan" });
    }

    res.json({
      message: "Status laporan berhasil diperbarui",
      report,
    });
  } catch (err) {
    console.error("UPDATE REPORT STATUS ERROR:", err);
    res.status(500).json({ message: "Gagal update status laporan" });
  }
});

// DELETE laporan
router.delete("/:id", async (req, res) => {
  try {
    const report = await Report.findOneAndDelete({ id: req.params.id });

    if (!report) {
      return res.status(404).json({ message: "Laporan tidak ditemukan" });
    }

    res.json({ message: "Laporan berhasil dihapus" });
  } catch (err) {
    console.error("DELETE REPORT ERROR:", err);
    res.status(500).json({ message: "Gagal hapus laporan" });
  }
});

module.exports = router;