const express = require("express");
const router = express.Router();
const controller = require("../controllers/sensorControllers");

router.post("/", controller.createSensor);
router.get("/", controller.getSensors);
router.delete("/:id", controller.deleteSensor);

module.exports = router;