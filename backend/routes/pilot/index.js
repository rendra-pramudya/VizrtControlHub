const express = require("express");
const router = express.Router();
const pilotService = require("../../services/pilotService");

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

module.exports = router;
