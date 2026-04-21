const express = require("express");
const mongoose = require("mongoose");

const deviceRoutes = require("./routes/deviceRoutes");
const authRoutes = require("./routes/authRoutes");
const historyRoutes = require("./routes/historyRoutes");

const app = express();

// ================= CORS MANUAL FIX =================
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // 🔥 HANDLE PREFLIGHT (INI YANG PENTING)
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ================= MIDDLEWARE =================
app.use(express.json());

// ================= TEST ROOT =================
app.get("/", (req, res) => {
  res.send("API RUNNING 🚀");
});

// ================= MONGODB =================
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("Mongo ERROR:", err));

// ================= ROUTES =================
app.use("/api/devices", deviceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/history", historyRoutes);

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});