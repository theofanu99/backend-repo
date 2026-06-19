const express = require("express");
const router = express.Router();

const Report = require("../models/report");
const { protect, allowRoles } = require("../middleware/auth");

// GET laporan
router.get("/", protect, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "warga") {
      filter = { userId: req.user.id };
    }

    const reports = await Report.find(filter).sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    res.status(500).json({
      message: "Gagal mengambil data laporan",
      error: err.message,
    });
  }
});

// CREATE laporan manual dari form warga
router.post("/", protect, async (req, res) => {
  try {
    const {
      id,
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

    if (!id || !type || !description || !locationName) {
      return res.status(400).json({
        message: "id, type, description, dan locationName wajib diisi",
      });
    }

    const report = await Report.create({
      id,
      userId: req.user.id,
      reporterName: reporterName || req.user.name || "Warga",
      reporterEmail: reporterEmail || req.user.email || "",
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
    res.status(500).json({
      message: "Gagal membuat laporan",
      error: err.message,
    });
  }
});

// UPDATE status laporan - petugas/admin only
router.patch(
  "/:id/status",
  protect,
  allowRoles("petugas", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!["pending", "process", "done"].includes(status)) {
        return res.status(400).json({
          message: "Status tidak valid",
        });
      }

      const updateData = {
        status,
      };

      // Kalau laporan sudah selesai, jangan tampil Darurat lagi
      if (status === "done") {
        updateData.priority = "normal";
      }

      // Kalau dikembalikan ke pending/process, priority tetap mengikuti data sebelumnya
      // Jadi panic button masih bisa terlihat darurat selama belum selesai

      const report = await Report.findOneAndUpdate(
        { id: req.params.id },
        updateData,
        { returnDocument: "after" }
      );

      if (!report) {
        return res.status(404).json({
          message: "Laporan tidak ditemukan",
        });
      }

      res.json({
        message: "Status laporan berhasil diperbarui",
        report,
      });
    } catch (err) {
      console.error("UPDATE REPORT ERROR:", err);
      res.status(500).json({
        message: "Gagal update status laporan",
        error: err.message,
      });
    }
  }
);

// DELETE laporan - admin only
router.delete(
  "/:id",
  protect,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const report = await Report.findOneAndDelete({ id: req.params.id });

      if (!report) {
        return res.status(404).json({
          message: "Laporan tidak ditemukan",
        });
      }

      res.json({
        message: "Laporan berhasil dihapus",
      });
    } catch (err) {
      console.error("DELETE REPORT ERROR:", err);
      res.status(500).json({
        message: "Gagal hapus laporan",
        error: err.message,
      });
    }
  }
);

module.exports = router;