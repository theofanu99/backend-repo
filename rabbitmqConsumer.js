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
  const parts = rawMessage.trim().split("#");

  if (parts.length !== 2) return null;

  const guid = parts[0];
  const state = parts[1];

  if (!guid || (state !== "0" && state !== "1")) return null;

  return {
    guid,
    state,
    event: state === "0" ? "panic_triggered" : "panic_released",
  };
}

async function publishSpeakerCommand(speakerGuid, state) {
  if (!channel) {
    console.log("RabbitMQ channel belum siap");
    return;
  }

  const routingKey = `${COMMAND_ROUTING_PREFIX}.${speakerGuid}`;

  const payload = `${speakerGuid}#${state}`;

  channel.publish(
    COMMAND_EXCHANGE,
    routingKey,
    Buffer.from(payload),
    { persistent: true }
  );

  console.log("SPEAKER COMMAND SENT:", {
    routingKey,
    payload,
  });
}

async function handlePanicEvent(payload) {
  const { guid, state, event } = payload;

  const panicDevice = await Device.findOne({
    guid,
    type: "panic_button",
  });

  if (!panicDevice) {
    console.log(`Panic button tidak terdaftar: ${guid}`);
    return;
  }

  panicDevice.lastUpdate = new Date();
  await panicDevice.save();

  await DeviceHistory.create({
    deviceId: panicDevice._id,
    guid: panicDevice.guid,
    name: panicDevice.name,
    type: panicDevice.type,
    status: event,
  });

  console.log(`History saved: ${panicDevice.guid} - ${event}`);

  // state 0 = tombol ditekan
  if (state === "0") {
    const speaker = await Device.findOne({
      guid: panicDevice.guid,
      type: "speaker",
    });

    if (!speaker) {
      console.log(`Speaker pasangan tidak ditemukan untuk GUID ${panicDevice.guid}`);
      return;
    }

    speaker.lastUpdate = new Date();
    await speaker.save();

    await DeviceHistory.create({
      deviceId: speaker._id,
      guid: speaker.guid,
      name: speaker.name,
      type: speaker.type,
      status: "speaker_triggered",
    });

    // kirim ON ke speaker pasangan
    await publishSpeakerCommand(speaker.guid, "1");

    console.log(`Panic button ${panicDevice.guid} trigger speaker ${speaker.guid}`);
  }

  // state 1 = tombol dilepas
  if (state === "1") {
    const speaker = await Device.findOne({
      guid: panicDevice.guid,
      type: "speaker",
    });

    if (speaker) {
      await DeviceHistory.create({
        deviceId: speaker._id,
        guid: speaker.guid,
        name: speaker.name,
        type: speaker.type,
        status: "speaker_stopped",
      });

      // kirim OFF ke speaker pasangan
      await publishSpeakerCommand(speaker.guid, "0");

      console.log(`Speaker ${speaker.guid} dimatikan`);
    }
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

        await handlePanicEvent(payload);

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