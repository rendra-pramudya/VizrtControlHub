const axios = require("axios");
const xml2js = require("xml2js");

function getBaseUrl() {
  const config = require("../../config");
  return `http://${config.pilot.host}:${config.pilot.port}`;
}

const ATOM_HEADERS = { Accept: "application/atom+xml" };

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// xml2js wraps text content as {_: "value", $: {...}} when the tag has XML attributes
function extractId(raw) {
  if (typeof raw === "string") return raw.trim();
  return (raw._ || "").trim();
}

function extractFieldValue(field) {
  if (!field.value || !field.value[0]) return "";
  const val = field.value[0];
  if (typeof val === "string") return val.trim();
  if (val["fo:wrapper"]) {
    const w = val["fo:wrapper"][0];
    return (typeof w === "string" ? w : w._ || "").trim();
  }
  if (val._) return val._.trim();
  return "";
}

function hasFoWrapper(field) {
  return !!(field.value && field.value[0] && field.value[0]["fo:wrapper"]);
}

async function getConcepts() {
  const res = await axios.get(`${getBaseUrl()}/concepts`, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => ({
    id: e.id[0].replace("urn:concept:dbid:", ""),
    name: e.title[0]._ || e.title[0],
  }));
}

async function getTemplates(conceptId) {
  const url = conceptId
    ? `${getBaseUrl()}/templates?concept=${conceptId}`
    : `${getBaseUrl()}/templates`;
  const res = await axios.get(url, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => ({
    id: extractId(e["atomext:pilotdbid"][0]),
    name: e.title[0]._ || e.title[0],
    updated: e.updated[0],
  }));
}

async function getDataElements(templateId, conceptId) {
  const concept = conceptId ? conceptId : "-1";
  const res = await axios.get(
    `${getBaseUrl()}/dataelements?template=${templateId}&concept=${concept}`,
    { headers: ATOM_HEADERS }
  );
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => ({
    id: extractId(e["atomext:pilotdbid"][0]),
    name: e.title[0]._ || e.title[0],
    updated: e.updated[0],
  }));
}

async function getAllDataElements(conceptId) {
  const url = conceptId
    ? `${getBaseUrl()}/dataelements?concept=${conceptId}`
    : `${getBaseUrl()}/dataelements`;
  const res = await axios.get(url, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => ({
    id: extractId(e["atomext:pilotdbid"][0]),
    name: e.title[0]._ || e.title[0],
    updated: e.updated[0],
  }));
}

async function getDataElement(id) {
  const res = await axios.get(`${getBaseUrl()}/dataelements/${id}/payload`);
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  const fields = toArray(parsed.payload.field)
    .filter((f) => !f.field) // skip nested (e.g. -concept-variant-choice)
    .map((f) => ({ name: f.$.name, value: extractFieldValue(f) }));
  return { id, fields };
}

async function updateDataElement(id, updatedFields) {
  const res = await axios.get(`${getBaseUrl()}/dataelements/${id}/payload`);
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });

  const fieldMap = Object.fromEntries(updatedFields.map((f) => [f.name, f.value]));

  parsed.payload.field = toArray(parsed.payload.field).map((f) => {
    const name = f.$.name;
    if (!(name in fieldMap)) return f;
    const newVal = fieldMap[name];
    if (hasFoWrapper(f)) {
      f.value = [{ "fo:wrapper": [{ _: newVal, $: { "xmlns:fo": "http://www.w3.org/1999/XSL/Format" } }] }];
    } else {
      f.value = [newVal];
    }
    return f;
  });

  const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "utf-8" } });
  const newXml = builder.buildObject(parsed);

  await axios.put(`${getBaseUrl()}/dataelements/${id}/payload`, newXml, {
    headers: { "Content-Type": "application/vnd.vizrt.payload+xml" },
  });

  return { success: true };
}

async function getDataElementModel(id) {
  const res = await axios.get(`${getBaseUrl()}/dataelements/${id}/payload`);
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return parsed.payload?.$?.model || null;
}

async function getDataElementMeta(id) {
  const res = await axios.get(`${getBaseUrl()}/dataelements/${id}`, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  const entry = parsed.entry;

  const templateLink = toArray(entry.link).find((l) => l.$.rel === "template");
  const templateId = templateLink?.$.href?.match(/\/templates\/(\d+)/)?.[1] || null;

  let concept = null, variant = null;
  const cvField = toArray(entry.content?.[0]?.payload?.[0]?.field || [])
    .find((f) => f.$.name === "-concept-variant-choice");
  if (cvField) {
    const sub = toArray(cvField.field || []);
    concept = sub.find((f) => f.$.name === "concept")?.value?.[0] || null;
    variant = sub.find((f) => f.$.name === "variant")?.value?.[0] || null;
  }

  return { id, templateId, concept, variant };
}

module.exports = { getConcepts, getTemplates, getDataElements, getAllDataElements, getDataElement, updateDataElement, getDataElementMeta, getDataElementModel };
