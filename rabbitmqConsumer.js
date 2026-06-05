const amqp = require("amqplib");

const Device = require("./models/devices");
const DeviceHistory = require("./models/deviceHistory");

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EVENT_QUEUE = process.env.RABBITMQ_EVENT_QUEUE || "tnwk.iot.events";
const COMMAND_EXCHANGE = process.env.RABBITMQ_COMMAND_EXCHANGE || "amq.topic";
const COMMAND_ROUTING_PREFIX =
  process.env.RABBITMQ_COMMAND_ROUTING_PREFIX || "tnwk.commands.speaker";

let channel = null;

function parsePanicPayload(rawMessage) {
  // Format dari alat: guidDevice#state
  // Contoh: PB-001#0 atau PB-001#1

  const parts = rawMessage.trim().split("#");

  if (parts.length !== 2) {
    return null;
  }

  const guid = parts[0];
  const state = parts[1];

  if (!guid || state === undefined) {
    return null;
  }

  return {
    guid,
    state,
    event: state === "0" ? "panic_triggered" : "panic_released",
  };
}

async function publishSpeakerCommand(speaker, triggeredBy) {
  if (!channel) {
    console.log("RabbitMQ channel belum siap");
    return;
  }

  const routingKey = `${COMMAND_ROUTING_PREFIX}.${speaker.guid}`;

  const command = {
    guid: speaker.guid,
    action: "play_warning_sound",
    triggeredBy,
    timestamp: new Date().toISOString(),
  };

  channel.publish(
    COMMAND_EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(command)),
    { persistent: true }
  );

  console.log("COMMAND SENT:", routingKey, command);
}

async function handlePanicButtonEvent(payload) {
  const { guid, state, event } = payload;

  const device = await Device.findOne({ guid });

  if (!device) {
    console.log(`Device belum terdaftar: ${guid}`);
    return;
  }

  if (device.type !== "panic_button") {
    console.log(`Device ${guid} bukan panic button`);
    return;
  }

  device.lastUpdate = new Date();
  await device.save();

  await DeviceHistory.create({
    deviceId: device._id,
    guid: device.guid,
    name: device.name,
    type: device.type,
    status: event,
  });

  console.log(`History saved: ${device.guid} - ${event}`);

  // state 0 = ditekan, trigger speaker
  if (state === "0") {
    const speakers = await Device.find({ type: "speaker" });

    for (const speaker of speakers) {
      speaker.lastUpdate = new Date();
      await speaker.save();

      await DeviceHistory.create({
        deviceId: speaker._id,
        guid: speaker.guid,
        name: speaker.name,
        type: speaker.type,
        status: "speaker_triggered",
      });

      await publishSpeakerCommand(speaker, device.guid);
    }

    console.log(`Panic button ${device.guid} trigger ${speakers.length} speaker`);
  }

  // state 1 = dilepas, hanya dicatat
  if (state === "1") {
    console.log(`Panic button ${device.guid} released`);
  }
}

async function startRabbitMQConsumer() {
  try {
    if (!RABBITMQ_URL) {
      console.log("RABBITMQ_URL belum diatur. Consumer tidak dijalankan.");
      return;
    }

    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(EVENT_QUEUE, { durable: true });

    console.log("RabbitMQ Connected");
    console.log(`Listening queue: ${EVENT_QUEUE}`);

    channel.consume(EVENT_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const rawMessage = msg.content.toString();

        console.log("RMQ RAW MESSAGE:", rawMessage);

        const payload = parsePanicPayload(rawMessage);

        if (!payload) {
          console.log("Format payload tidak valid. Gunakan format GUID#STATE");
          channel.ack(msg);
          return;
        }

        console.log("RMQ PARSED PAYLOAD:", payload);

        await handlePanicButtonEvent(payload);

        channel.ack(msg);
      } catch (err) {
        console.error("RMQ MESSAGE ERROR:", err);
        channel.nack(msg, false, false);
      }
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed. Reconnecting...");
      setTimeout(startRabbitMQConsumer, 5000);
    });

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
    });
  } catch (err) {
    console.error("RabbitMQ connection failed:", err.message);
    setTimeout(startRabbitMQConsumer, 5000);
  }
}

module.exports = startRabbitMQConsumer;