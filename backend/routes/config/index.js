const express = require("express");
const router = express.Router();
const path = require("path");
const { validateConfig, saveConfig, redactConfig } = require("../../../config-loader");

const CONFIG_MODULE = path.resolve(__dirname, "../../../config.js");

function reloadConfig() {
  delete require.cache[require.resolve(CONFIG_MODULE)];
  return require(CONFIG_MODULE);
}

// GET /api/config — Hub password is never sent; hub.passwordSet says whether one exists.
router.get("/", (req, res) => {
  try {
    res.json(redactConfig(reloadConfig()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config — validate, then write config.json (+ password to .env if given).
router.put("/", (req, res) => {
  const errors = validateConfig(req.body);
  if (errors.length) {
    return res.status(400).json({ error: `Invalid config: ${errors.join("; ")}`, errors });
  }
  try {
    saveConfig(req.body);
    reloadConfig();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
