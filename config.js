// Loaded config object (config.json + secrets from .env).
// Edit hosts/ports in config.json or from the Settings page; put the Hub
// password in .env as VIZ_HUB_PASSWORD. See config-loader.js.
module.exports = require("./config-loader").loadConfig();
