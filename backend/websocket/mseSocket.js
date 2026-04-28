const { WebSocketServer } = require("ws");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws/mse" });

  wss.on("connection", (ws) => {
    console.log("[WS] Client connected to MSE live feed");

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
    });
  });

  console.log("[WS] MSE WebSocket ready on /ws/mse");
}

function broadcastMseStatus(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

module.exports = { initWebSocket, broadcastMseStatus };
