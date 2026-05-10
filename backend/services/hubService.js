const axios = require("axios");
const xml2js = require("xml2js");

function getHub() { return require("../../config").hub; }
function getBaseUrl() { const h = getHub(); return `http://${h.host}:${h.port}`; }
function getAuth() { const h = getHub(); return { username: h.username, password: h.password }; }

const ATOM_HEADERS = { Accept: "application/atom+xml" };
const ROOT_UUID = "00000000-0000-0000-0000-000000000000";

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function getLinkHref(entry, rel) {
  return toArray(entry.link).find((l) => l.$ && l.$.rel === rel)?.$?.href || null;
}

function getLinkCount(entry, rel) {
  const link = toArray(entry.link).find((l) => l.$ && l.$.rel === rel);
  return link ? parseInt(link.$["thr:count"] || "0", 10) : 0;
}

function getTerm(entry) {
  return toArray(entry.category)
    .find((c) => c.$ && c.$.scheme === "http://www.vizrt.com/types")
    ?.$.term || "Folder";
}

function parseFolder(e) {
  return {
    uuid: e.id[0].replace("urn:uuid:", ""),
    name: e.title[0]._ || e.title[0],
    updated: e.updated[0],
    type: getTerm(e),
    childCount: getLinkCount(e, "down"),
  };
}

function parseFile(e) {
  const terms = toArray(e.category)
    .filter((c) => c.$ && c.$.scheme === "http://www.vizrt.com/types" && c.$.term !== "asset")
    .map((c) => c.$.term);
  const thumb = toArray(e["media:thumbnail"] || [])[0];
  const authorEl = toArray(e.author || [])[0];
  return {
    uuid: e.id[0].replace("urn:uuid:", ""),
    name: e.title[0]._ || e.title[0],
    updated: e.updated?.[0] || null,
    published: e.published?.[0] || null,
    type: terms[0] || "UNKNOWN",
    owner: authorEl?.name?.[0] || null,
    thumbnailUrl: thumb?.$.url || null,
    thumbnailW: thumb ? parseInt(thumb.$.width || "64", 10) : 64,
    thumbnailH: thumb ? parseInt(thumb.$.height || "64", 10) : 64,
  };
}

async function getFolders(uuid) {
  const url = uuid
    ? `${getBaseUrl()}/folders/${uuid}/`
    : `${getBaseUrl()}/folders`;
  const res = await axios.get(url, { headers: ATOM_HEADERS, auth: getAuth() });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map(parseFolder);
}

async function getFiles(uuid) {
  const res = await axios.get(`${getBaseUrl()}/files/${uuid}/`, {
    headers: ATOM_HEADERS, auth: getAuth(),
  });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map(parseFile);
}

async function getFolderInfo(uuid) {
  if (!uuid || uuid === ROOT_UUID) {
    return { uuid: null, name: "Graphics Hub", parentUuid: null, type: "Root" };
  }
  const res = await axios.get(`${getBaseUrl()}/folder/${uuid}/`, {
    headers: ATOM_HEADERS, auth: getAuth(),
  });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  const e = parsed.entry;
  const upHref = getLinkHref(e, "up");
  const parentRaw = upHref?.match(/\/folder\/([^/]+)\//)?.[1] || null;
  const parentUuid = parentRaw === ROOT_UUID ? null : parentRaw;
  return {
    uuid,
    name: e.title[0]._ || e.title[0],
    updated: e.updated?.[0] || null,
    parentUuid,
    type: getTerm(e),
  };
}

async function getThumbnail(uuid) {
  const res = await axios.get(`${getBaseUrl()}/thumbnail/${uuid}/`, {
    auth: getAuth(),
    responseType: "arraybuffer",
    validateStatus: (s) => s < 500,
  });
  return {
    data: res.data,
    contentType: res.headers["content-type"] || "image/png",
    status: res.status,
  };
}

async function getFileVizPayload(uuid) {
  // Try Hub's native payload endpoint first
  try {
    const res = await axios.get(`${getBaseUrl()}/payload/file/${uuid}/`, {
      auth: getAuth(),
      validateStatus: (s) => s < 500,
    });
    if (res.status === 200 && typeof res.data === "string" && res.data.includes("<payload")) {
      return { data: res.data, contentType: "application/vnd.vizrt.payload+xml" };
    }
  } catch {}

  // Fallback: get file name from metadata and build a minimal payload
  let model = uuid;
  try {
    const metaRes = await axios.get(`${getBaseUrl()}/metadata/file/${uuid}/`, {
      headers: ATOM_HEADERS, auth: getAuth(),
      validateStatus: (s) => s < 500,
    });
    if (metaRes.status === 200 && typeof metaRes.data === "string") {
      const parsed = await xml2js.parseStringPromise(metaRes.data, { explicitArray: true });
      const e = parsed.entry;
      model = e.title?.[0]?._ || e.title?.[0] || uuid;
    }
  } catch {}

  return {
    data: `<?xml version="1.0" encoding="UTF-8"?>\n<payload xmlns="http://www.vizrt.com/types" model="${model}">\n</payload>`,
    contentType: "application/vnd.vizrt.payload+xml",
  };
}

module.exports = { getFolders, getFiles, getFolderInfo, getThumbnail, getFileVizPayload };
