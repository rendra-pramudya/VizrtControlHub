const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(__dirname, "../../../config.js");

// GET /api/config
router.get("/", (req, res) => {
  try {
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config — tulis ulang config.js
router.put("/", (req, res) => {
  try {
    const newConfig = req.body;
    const content = `module.exports = ${JSON.stringify(newConfig, null, 2)};\n`;
    fs.writeFileSync(CONFIG_PATH, content, "utf8");
    delete require.cache[require.resolve(CONFIG_PATH)];
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
