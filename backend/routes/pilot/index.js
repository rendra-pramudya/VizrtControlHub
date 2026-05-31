const express = require("express");
const router = express.Router();
const axios = require("axios");
const pilotService = require("../../services/pilotService");

function pilotBase() {
  const config = require("../../../config");
  return `http://${config.pilot.host}:${config.pilot.port}`;
}

function stripBom(xml) {
  return String(xml).replace(/^﻿/, "");
}

// GET /api/pilot/concepts
router.get("/concepts", async (req, res) => {
  try {
    res.json(await pilotService.getConcepts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilot/templates?concept={id}
router.get("/templates", async (req, res) => {
  try {
    res.json(await pilotService.getTemplates(req.query.concept));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilot/templates/:id/elements?concept={id}
router.get("/templates/:id/elements", async (req, res) => {
  try {
    res.json(await pilotService.getDataElements(req.params.id, req.query.concept));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilot/data-elements?concept={id}
router.get("/data-elements", async (req, res) => {
  try {
    res.json(await pilotService.getAllDataElements(req.query.concept));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilot/data-elements/:id
router.get("/data-elements/:id", async (req, res) => {
  try {
    res.json(await pilotService.getDataElement(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pilot/data-elements/:id
router.put("/data-elements/:id", async (req, res) => {
  try {
    res.json(await pilotService.updateDataElement(req.params.id, req.body.fields));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilot/data-elements/:id/payload-proxy
// Strips Pilot's UTF-8 BOM so MSE can fetch the payload via src= without XML parse errors.
// Also rewrites the model= attribute to point to /templates/:id/model-proxy (also BOM-stripped).
router.get("/data-elements/:id/payload-proxy", async (req, res) => {
  try {
    const proxyBase = `http://127.0.0.1:3000/api/pilot`;
    const upstream = await axios.get(`${pilotBase()}/dataelements/${req.params.id}/payload`, {
      responseType: "text",
      validateStatus: () => true,
    });
    if (upstream.status >= 400) return res.status(upstream.status).send(upstream.data);

    const clean = stripBom(upstream.data)
      .replace(/<\?xml[^?]*\?>\s*/i, "")            // strip XML declaration
      .replace(
        /model="http:\/\/[^"]+\/templates\/(\d+)\/model"/,
        (_, tid) => `model="${proxyBase}/templates/${tid}/model-proxy"`
      );

    res.set("Content-Type", "application/vnd.vizrt.payload+xml");
    res.send(clean);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// GET /api/pilot/templates/:id/model-proxy
// Strips Pilot's UTF-8 BOM so MSE can resolve the model URI without XML parse errors.
router.get("/templates/:id/model-proxy", async (req, res) => {
  try {
    const upstream = await axios.get(`${pilotBase()}/templates/${req.params.id}/model`, {
      responseType: "text",
      validateStatus: () => true,
    });
    if (upstream.status >= 400) return res.status(upstream.status).send(upstream.data);

    res.set("Content-Type", "application/vnd.vizrt.model+xml; charset=utf-8");
    res.send(stripBom(upstream.data));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
