const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const historyRoutes = require("./routes/historyRoutes");
const panicRoutes = require("./routes/panicRoutes");
const reportRoutes = require("./routes/reportRoutes");
const speakerRoutes = require("./routes/speakerRoutes");
const startRabbitMQConsumer = require("./rabbitmqConsumer");


const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("API RUNNING");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API OK" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    startRabbitMQConsumer();
  })
  .catch((err) => console.error("Mongo ERROR:", err));

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/panic", panicRoutes);
app.use("/api/speaker", speakerRoutes);
app.use("/api/reports", reportRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});