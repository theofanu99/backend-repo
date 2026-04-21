const Sensor = require("../models/sensor");

// CREATE
exports.createSensor = async (req, res) => {
  try {
    console.log("BODY:", req.body); // debug

    const data = await Sensor.create(req.body);
    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

// READ
exports.getSensors = async (req, res) => {
  const data = await Sensor.find().sort({ createdAt: -1 });
  res.json(data);
};

// DELETE
exports.deleteSensor = async (req, res) => {
  await Sensor.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};