const express = require("express");
const router = express.Router();
const engineService = require("../../services/engineService");

// GET /api/engine — list semua engine dari config
router.get("/", (req, res) => {
  const config = require("../../../config");
  res.json(config.engine);
});

// POST /api/engine/:id/command — kirim command ke engine tertentu
router.post("/:id/command", async (req, res) => {
  const { id } = req.params;
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: "command is required" });
  }

  try {
    const response = await engineService.sendCommand(id, command);
    res.json({ engineId: id, command, response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/engine/:id/status — cek koneksi engine
router.get("/:id/status", async (req, res) => {
  const { id } = req.params;
  try {
    const status = await engineService.getStatus(id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
