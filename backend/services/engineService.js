const net = require("net");

function getEngineConfig(id) {
  const config = require("../../config");
  const engine = config.engine.find((e) => e.id === id);
  if (!engine) throw new Error(`Engine '${id}' not found in config`);
  if (!engine.enabled) throw new Error(`Engine '${id}' is disabled`);
  return engine;
}

function sendCommand(id, command) {
  const engine = getEngineConfig(id);

  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = "";
    let settled = false;

    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      client.destroy();
      if (err) reject(err);
      else resolve(data);
    };

    client.setTimeout(5000);

    client.connect(engine.port, engine.host, () => {
      // Viz Engine expects commands terminated with \0
      client.write(command + "\0");
    });

    client.on("data", (data) => {
      response += data.toString();
      // Viz Engine responses end with \0
      if (response.includes("\0")) {
        finish(null, response.replace(/\0/g, "").trim());
      }
    });

    client.on("timeout", () => finish(new Error("Connection timed out")));
    client.on("error", (err) => finish(err));
    client.on("close", () => finish(null, response.replace(/\0/g, "").trim()));
  });
}

function getStatus(id) {
  const engine = getEngineConfig(id);

  return new Promise((resolve) => {
    const client = new net.Socket();
    let settled = false;

    const finish = (connected) => {
      if (settled) return;
      settled = true;
      client.destroy();
      resolve({ engineId: id, host: engine.host, port: engine.port, connected });
    };

    client.setTimeout(3000);
    client.connect(engine.port, engine.host, () => finish(true));
    client.on("timeout", () => finish(false));
    client.on("error", () => finish(false));
  });
}

module.exports = { sendCommand, getStatus };
