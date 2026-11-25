// Config loader for VizrtControlHub.
//
// Non-secret settings (hosts, ports, Hub username) live in config.json and are
// editable from the Settings page. Secrets live only in .env (git-ignored):
//
//   VIZ_HUB_PASSWORD=...     Graphics Hub password (required for Hub access)
//   VIZ_HUB_USERNAME=...     optional, overrides hub.username from config.json

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CONFIG_JSON = path.join(ROOT, "config.json");
const ENV_FILE = path.join(ROOT, ".env");

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  // Re-read on every load so a password saved from Settings takes effect.
  const parsed = parseEnv(fs.readFileSync(ENV_FILE, "utf8"));
  for (const [k, v] of Object.entries(parsed)) process.env[k] = v;
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function loadConfig() {
  loadEnv();
  const cfg = JSON.parse(fs.readFileSync(CONFIG_JSON, "utf8"));
  cfg.hub = {
    ...cfg.hub,
    username: process.env.VIZ_HUB_USERNAME || cfg.hub?.username || "",
    password: process.env.VIZ_HUB_PASSWORD || "",
  };
  return cfg;
}

// ── validation ───────────────────────────────────────────────────────────────

const HOST_RE = /^[A-Za-z0-9.\-:\[\]]+$/; // hostname, IPv4, or [IPv6] — no slashes, spaces, '@'

function checkEndpoint(obj, name, errors, { optional = false } = {}) {
  if (obj === undefined && optional) return;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push(`${name} must be an object`);
    return;
  }
  if (typeof obj.host !== "string" || !obj.host || !HOST_RE.test(obj.host)) {
    errors.push(`${name}.host must be a hostname or IP address`);
  }
  if (!Number.isInteger(obj.port) || obj.port < 1 || obj.port > 65535) {
    errors.push(`${name}.port must be an integer 1-65535`);
  }
}

// Returns a list of error strings; empty list = valid.
function validateConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return ["config must be an object"];

  const allowed = new Set(["engine", "pilot", "mse", "hub", "previewServer"]);
  for (const key of Object.keys(cfg)) {
    if (!allowed.has(key)) errors.push(`unknown key: ${key}`);
  }

  if (!Array.isArray(cfg.engine) || cfg.engine.length === 0) {
    errors.push("engine must be a non-empty array");
  } else {
    const ids = new Set();
    cfg.engine.forEach((e, i) => {
      const n = `engine[${i}]`;
      if (!e || typeof e !== "object") { errors.push(`${n} must be an object`); return; }
      if (typeof e.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(e.id)) errors.push(`${n}.id must be letters, digits, '-' or '_'`);
      else if (ids.has(e.id)) errors.push(`${n}.id '${e.id}' is duplicated`);
      else ids.add(e.id);
      if (typeof e.name !== "string") errors.push(`${n}.name must be a string`);
      if (typeof e.enabled !== "boolean") errors.push(`${n}.enabled must be true or false`);
      checkEndpoint(e, n, errors);
    });
  }

  checkEndpoint(cfg.pilot, "pilot", errors);
  checkEndpoint(cfg.mse, "mse", errors);
  checkEndpoint(cfg.hub, "hub", errors);
  checkEndpoint(cfg.previewServer, "previewServer", errors, { optional: true });

  if (cfg.hub && typeof cfg.hub === "object") {
    if (cfg.hub.username !== undefined && typeof cfg.hub.username !== "string") errors.push("hub.username must be a string");
    if (cfg.hub.password !== undefined && typeof cfg.hub.password !== "string") errors.push("hub.password must be a string");
  }
  return errors;
}

// ── saving ───────────────────────────────────────────────────────────────────

function writeAtomic(file, content) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

function setEnvVar(key, value) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  const idx = lines.findIndex((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] === key);
  const line = `${key}=${value}`;
  if (idx >= 0) lines[idx] = line;
  else {
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(line);
  }
  writeAtomic(ENV_FILE, lines.join("\n") + "\n");
  process.env[key] = value;
}

// Saves a validated config. The Hub password is never written to config.json:
// a non-empty password goes to .env, an empty one keeps the current password.
function saveConfig(cfg) {
  const { password, passwordSet, ...hubRest } = cfg.hub;
  if (password) {
    if (/[\r\n]/.test(password)) throw new Error("hub.password must not contain line breaks");
    setEnvVar("VIZ_HUB_PASSWORD", password);
  }
  const toWrite = { ...cfg, hub: hubRest };
  writeAtomic(CONFIG_JSON, JSON.stringify(toWrite, null, 2) + "\n");
}

// Config as sent to the browser: password replaced by a "set or not" flag.
function redactConfig(cfg) {
  const { password, ...hubRest } = cfg.hub || {};
  return { ...cfg, hub: { ...hubRest, password: "", passwordSet: !!password } };
}

module.exports = { loadConfig, validateConfig, saveConfig, redactConfig, CONFIG_JSON };
