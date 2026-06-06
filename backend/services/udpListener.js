const dgram = require("dgram");

const UDP_PORT = 7476;
const MAX_HISTORY = 2000;

let socket = null;
let broadcastFn = null;
const messages = [];

function startUdpListener(broadcast) {
  broadcastFn = broadcast;
  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("message", (msg, rinfo) => {
    const text = msg.toString("utf8");
    const entry = {
      from: `${rinfo.address}:${rinfo.port}`,
      data: text,
      ts: new Date().toISOString(),
    };
    messages.push(entry);
    if (messages.length > MAX_HISTORY) messages.shift();
    console.log(`[UDP:${UDP_PORT}] from ${entry.from}: ${text.slice(0, 120)}`);
    if (broadcastFn) broadcastFn({ type: "udp", ...entry });
  });

  socket.on("error", (err) => {
    console.error(`[UDP:${UDP_PORT}] error: ${err.message}`);
    socket.close();
  });

  socket.bind(UDP_PORT, () => {
    console.log(`[UDP] Listening on port ${UDP_PORT}`);
  });
}

function getMessages() {
  return messages;
}

function stopUdpListener() {
  if (socket) { socket.close(); socket = null; }
}

module.exports = { startUdpListener, getMessages, stopUdpListener };
