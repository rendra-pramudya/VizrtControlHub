const express = require("express");
const router = express.Router();
const mseService = require("../../services/mseService");

const ALLOWED_ACTIONS = [
  "take", "cue", "out", "continue", "continue_reverse",
  "cut", "read", "update", "cleanup", "initialize", "prepare", "stop",
];

// GET /api/mse/playlists
router.get("/playlists", async (req, res) => {
  try {
    res.json(await mseService.getPlaylists());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mse/playlists/:storageId/elements
router.get("/playlists/:storageId/elements", async (req, res) => {
  try {
    res.json(await mseService.getPlaylistElements(req.params.storageId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mse/playlists/:storageId/elements/inspect — returns raw editUrl/contentSrc for debugging
router.get("/playlists/:storageId/elements/inspect", async (req, res) => {
  try {
    res.json(await mseService.inspectPlaylistElements(req.params.storageId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mse/profiles
router.get("/profiles", async (req, res) => {
  try {
    res.json(await mseService.getProfiles());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mse/profiles/:profile/state
router.get("/profiles/:profile/state", async (req, res) => {
  try {
    res.json(await mseService.getProfileState(req.params.profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mse/preview?payloadUrl=...&width=320&height=180
// GET /api/mse/preview?scenePath=...&width=320&height=180
router.get("/preview", async (req, res) => {
  const { payloadUrl, scenePath, width, height } = req.query;
  if (!payloadUrl && !scenePath) {
    return res.status(400).json({ error: "payloadUrl or scenePath is required" });
  }
  try {
    const buf = await mseService.getPreviewImage(
      payloadUrl || null,
      scenePath || null,
      width ? parseInt(width, 10) : 320,
      height ? parseInt(height, 10) : 180,
    );
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache");
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/mse/element/content?editUrl=... — fetch scene path from element payload
router.get("/element/content", async (req, res) => {
  const { editUrl } = req.query;
  if (!editUrl) return res.status(400).json({ error: "editUrl is required" });
  try {
    res.json(await mseService.getElementContent(editUrl));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mse/playlists/:storageId/elements/move
// body: { elementEditUrl, direction: 'up'|'down' }
router.post("/playlists/:storageId/elements/move", async (req, res) => {
  const { storageId } = req.params;
  const { elementEditUrl, toIndex } = req.body;
  if (!elementEditUrl || toIndex === undefined) {
    return res.status(400).json({ error: "elementEditUrl and toIndex are required" });
  }
  try {
    res.json(await mseService.moveElement(storageId, elementEditUrl, toIndex));
  } catch (err) {
    console.error("[moveElement]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mse/playlists/:storageId/elements
// body: { title, contentSrc }
router.post("/playlists/:storageId/elements", async (req, res) => {
  const { storageId } = req.params;
  const { hubUuid, fileName, vizLayer, scenePath } = req.body;
  if (!hubUuid || !fileName) {
    return res.status(400).json({ error: "hubUuid and fileName are required" });
  }
  try {
    res.json(await mseService.addElementToPlaylist(storageId, hubUuid, fileName, vizLayer || "MIDDLE", scenePath || null));
  } catch (err) {
    console.error("[addElementToPlaylist]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mse/profiles/:profile/:action
// body (optional): { elementEditUrl: "http://..." }
router.post("/profiles/:profile/:action", async (req, res) => {
  const { profile, action } = req.params;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(", ")}` });
  }
  try {
    res.json(await mseService.triggerProfileAction(profile, action, req.body.elementEditUrl));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
