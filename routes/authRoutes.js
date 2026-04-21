const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // VALIDASI
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password wajib" });
    }

    // CEK USER SUDAH ADA
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User sudah terdaftar" });
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // SIMPAN USER
    const user = new User({
      email,
      password: hashedPassword,
    });

    await user.save();

    res.json({ message: "User berhasil dibuat" });

  } catch (err) {
    console.error("REGISTER ERROR:", err); // 🔥 DEBUG
    res.status(500).json({ message: "Error register" });
  }
});


// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("LOGIN REQUEST:", req.body); // 🔥 DEBUG

    // VALIDASI INPUT
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password wajib" });
    }

    // CEK USER
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // CEK PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Password salah" });
    }

    // BUAT TOKEN
    const token = jwt.sign(
      { id: user._id, email: user.email },
      "SECRET_KEY",
      { expiresIn: "1d" }
    );

    // RESPONSE
    res.json({
      token,
      user: {
        email: user.email,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err); // 🔥 INI YANG PENTING
    res.status(500).json({ message: "Error login" });
  }
});

module.exports = router;