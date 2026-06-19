const amqp = require("amqplib");

const Device = require("./models/devices");
const DeviceHistory = require("./models/deviceHistory");

const RABBITMQ_URL = process.env.RABBITMQ_URL;

const EVENT_QUEUE = process.env.RABBITMQ_EVENT_QUEUE || "tnwk.iot.events";

const COMMAND_EXCHANGE =
  process.env.RABBITMQ_COMMAND_EXCHANGE || "amq.topic";

const COMMAND_ROUTING_KEY =
  process.env.RABBITMQ_COMMAND_ROUTING_KEY || "tnwk.speaker.command";

let channel = null;

function parseDevicePayload(rawMessage) {
  const parts = rawMessage.trim().split("#");

  if (parts.length !== 2) {
    return null;
  }

  const guid = parts[0];
  const state = parts[1];

  if (!guid || !state) {
    return null;
  }

  if (state === "0") {
    return {
      guid,
      state,
      kind: "panic",
      event: "panic_triggered",
    };
  }

  if (state === "1") {
    return {
      guid,
      state,
      kind: "panic",
      event: "panic_released",
    };
  }

  if (state === "online") {
    return {
      guid,
      state,
      kind: "status",
      event: "device_online",
    };
  }

  if (state === "offline") {
    return {
      guid,
      state,
      kind: "status",
      event: "device_offline",
    };
  }

  return null;
}

async function publishSpeakerCommand(speakerGuid, state) {
  if (!channel) {
    console.log("RabbitMQ channel belum siap");
    return false;
  }

  const payload = `${speakerGuid}#${state}`;

  channel.publish(COMMAND_EXCHANGE, COMMAND_ROUTING_KEY, Buffer.from(payload), {
    persistent: true,
  });

  console.log("SPEAKER COMMAND SENT:", {
    exchange: COMMAND_EXCHANGE,
    routingKey: COMMAND_ROUTING_KEY,
    payload,
  });

  return true;
}

async function handleDeviceMessage(payload) {
  const { guid, state, kind, event } = payload;

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

  if (kind === "status") {
    console.log(`Device status updated only: ${guid} - ${state}`);
    return;
  }

  await DeviceHistory.create({
    deviceId: panicDevice._id,
    guid: panicDevice.guid,
    name: panicDevice.name,
    type: panicDevice.type,
    status: event,
    lat: panicDevice.lat,
    lng: panicDevice.lng,
    locationName: panicDevice.locationName || panicDevice.name,
    source: "device",
    description:
      state === "0"
        ? "Panic button fisik ditekan"
        : "Panic button fisik dilepas",
  });

  console.log(`History saved: ${panicDevice.guid} - ${event}`);

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

  if (state === "0") {
    await DeviceHistory.create({
      deviceId: speaker._id,
      guid: speaker.guid,
      name: speaker.name,
      type: speaker.type,
      status: "speaker_triggered",
      lat: speaker.lat,
      lng: speaker.lng,
      locationName: speaker.locationName || speaker.name,
      source: "device",
      description: `Speaker aktif karena panic button ${panicDevice.guid} ditekan`,
    });

    await publishSpeakerCommand(speaker.guid, "0");

    console.log(`Panic button ${panicDevice.guid} trigger speaker ${speaker.guid}`);
  }

  if (state === "1") {
    await DeviceHistory.create({
      deviceId: speaker._id,
      guid: speaker.guid,
      name: speaker.name,
      type: speaker.type,
      status: "speaker_stopped",
      lat: speaker.lat,
      lng: speaker.lng,
      locationName: speaker.locationName || speaker.name,
      source: "device",
      description: `Speaker berhenti karena panic button ${panicDevice.guid} dilepas`,
    });

    await publishSpeakerCommand(speaker.guid, "1");

    console.log(`Speaker ${speaker.guid} dimatikan`);
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
    console.log(`Speaker command exchange: ${COMMAND_EXCHANGE}`);
    console.log(`Speaker command routing key: ${COMMAND_ROUTING_KEY}`);

    channel.consume(EVENT_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const rawMessage = msg.content.toString().trim();

        console.log("RMQ RAW MESSAGE:", rawMessage);

        const payload = parseDevicePayload(rawMessage);

        if (!payload) {
          console.log(
            "Format payload tidak valid. Gunakan GUID#0, GUID#1, GUID#online, atau GUID#offline"
          );
          channel.ack(msg);
          return;
        }

        console.log("RMQ PARSED PAYLOAD:", payload);

        await handleDeviceMessage(payload);

        channel.ack(msg);
      } catch (err) {
        console.error("RMQ MESSAGE ERROR:", err);
        channel.nack(msg, false, false);
      }
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed. Reconnecting...");
      channel = null;
      setTimeout(startRabbitMQConsumer, 5000);
    });

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
    });
  } catch (err) {
    console.error("RabbitMQ connection failed:", err.message);
    channel = null;
    setTimeout(startRabbitMQConsumer, 5000);
  }
}

module.exports = {
  startRabbitMQConsumer,
  publishSpeakerCommand,
};