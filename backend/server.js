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

app.use(cors());
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VizrtControlHub backend running on http://127.0.0.1:${PORT}`);
});
