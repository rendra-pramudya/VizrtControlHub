const express = require("express");
const router = express.Router();
const hubService = require("../../services/hubService");

// GET /api/hub/folders          → root folders
router.get("/folders", async (req, res) => {
  try {
    res.json(await hubService.getFolders(null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/folders/:uuid    → subfolders of uuid
router.get("/folders/:uuid", async (req, res) => {
  try {
    res.json(await hubService.getFolders(req.params.uuid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/files/:uuid      → files inside folder uuid
router.get("/files/:uuid", async (req, res) => {
  try {
    res.json(await hubService.getFiles(req.params.uuid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/folder/:uuid     → single folder metadata (name, parent)
router.get("/folder/:uuid", async (req, res) => {
  try {
    res.json(await hubService.getFolderInfo(req.params.uuid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/viz-payload/:uuid → proxy Viz payload XML for MSE element_collection
router.get("/viz-payload/:uuid", async (req, res) => {
  try {
    const { data, contentType } = await hubService.getFileVizPayload(req.params.uuid);
    res.set("Content-Type", contentType);
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/thumbnail/:uuid  → proxy thumbnail image with auth
router.get("/thumbnail/:uuid", async (req, res) => {
  try {
    const { data, contentType, status } = await hubService.getThumbnail(req.params.uuid);
    if (status === 404) return res.status(404).end();
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
