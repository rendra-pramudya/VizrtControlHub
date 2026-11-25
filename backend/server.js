require("../config"); // loads .env (HOST, PORT, CORS_ORIGINS, VIZ_HUB_PASSWORD) into process.env
const express = require("express");
const cors = require("cors");
const http = require("http");
const { initWebSocket, broadcastMseStatus } = require("./websocket/mseSocket");
const { startUdpListener, getMessages } = require("./services/udpListener");

const engineRoutes = require("./routes/engine");
const pilotRoutes = require("./routes/pilot");
const mseRoutes = require("./routes/mse");
const hubRoutes = require("./routes/hub");
const configRoutes = require("./routes/config");

const app = express();
const server = http.createServer(app);

// Only the Vite dev UI may call the API from a browser. Requests without an
// Origin header (curl, MSE fetching payload-proxy) are not affected by CORS.
const allowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  ...(process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Auth middleware placeholder — bypass mode
app.use((req, res, next) => {
  // TODO: aktifkan JWT validation di sini
  next();
});

app.use("/api/engine", engineRoutes);
app.use("/api/pilot", pilotRoutes);
app.use("/api/mse", mseRoutes);
app.use("/api/hub", hubRoutes);
app.use("/api/config", configRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

initWebSocket(server);
startUdpListener((msg) => broadcastMseStatus(msg));

app.get("/api/udp/messages", (req, res) => res.json(getMessages()));

// Default: this PC only. The API has no authentication, so binding to the LAN
// (HOST=0.0.0.0 in .env) lets anyone on the network take/out graphics.
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`VizrtControlHub backend running on http://${HOST}:${PORT}`);
  if (!["127.0.0.1", "localhost", "::1"].includes(HOST)) {
    console.warn(`[WARN] Backend is reachable from the network on ${HOST} with NO authentication.`);
  }
});
