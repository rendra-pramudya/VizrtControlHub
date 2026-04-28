const axios = require("axios");
const xml2js = require("xml2js");
const { broadcastMseStatus } = require("../websocket/mseSocket");
const pilotService = require("./pilotService");

function getBaseUrl() {
  const config = require("../../config");
  return `http://${config.mse.host}:${config.mse.port}`;
}

const ATOM_HEADERS = { Accept: "application/atom+xml" };

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function getLinkHref(entry, rel) {
  return toArray(entry.link).find((l) => l.$ && l.$.rel === rel)?.$?.href || null;
}

function extractStorageId(url) {
  const decoded = decodeURIComponent(url || "");
  const match = decoded.match(/\{([^}]+)\}/);
  return match ? match[1] : null;
}

async function getPlaylists() {
  const res = await axios.get(`${getBaseUrl()}/directory/playlists/`, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => {
    const elementCollectionUrl = getLinkHref(e, "alternate");
    return {
      id: e.id[0].replace("urn:uuid:", ""),
      storageId: extractStorageId(elementCollectionUrl || ""),
      name: e.title[0]._ || e.title[0],
      updated: e.updated[0],
    };
  });
}

async function getPlaylistElements(storageId) {
  const url = `${getBaseUrl()}/element_collection/storage/playlists/%7B${storageId}%7D/`;
  const res = await axios.get(url, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });

  const elements = toArray(parsed.feed.entry).map((e) => {
    const contentSrc = e.content?.[0]?.$?.src || null;
    const pilotMatch = contentSrc?.match(/\/dataelements\/(\d+)\/payload/);
    return {
      id: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
      updated: e.updated[0],
      availableStatus: e["viz:available_status"] ? parseFloat(e["viz:available_status"][0]) : null,
      loadedStatus: e["viz:loaded_status"] ? parseFloat(e["viz:loaded_status"][0]) : null,
      valid: e["viz:valid_element"]?.[0] === "yes",
      editUrl: getLinkHref(e, "edit"),
      contentSrc,
      pilotElementId: pilotMatch ? pilotMatch[1] : null,
      templateId: null,
      concept: null,
      variant: null,
      model: null,
    };
  });

  elements.forEach((el) => {
    console.log(`[playlist-element] name="${el.name}" editUrl=${el.editUrl} contentSrc=${el.contentSrc} pilotId=${el.pilotElementId}`);
  });

  await Promise.all(elements.map(async (el) => {
    if (!el.pilotElementId) return;
    try {
      const [meta, model] = await Promise.all([
        pilotService.getDataElementMeta(el.pilotElementId),
        pilotService.getDataElementModel(el.pilotElementId),
      ]);
      el.templateId = meta.templateId;
      el.concept = meta.concept;
      el.variant = meta.variant;
      el.model = model;
      console.log(`[element-model] "${el.name}" pilotId=${el.pilotElementId} model=${model}`);
    } catch { /* enrichment optional */ }
  }));

  return elements;
}

async function getProfiles() {
  const res = await axios.get(`${getBaseUrl()}/profiles/`, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => ({
    id: e.title[0]._ || e.title[0],
  }));
}

async function getProfileState(profile) {
  const res = await axios.get(`${getBaseUrl()}/profiles/${encodeURIComponent(profile)}/state`, {
    headers: ATOM_HEADERS,
  });
  const parsed = await xml2js.parseStringPromise(res.data, {
    explicitArray: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  const channels = [];
  for (const entry of toArray(parsed.feed.entry)) {
    const content = entry.content?.[0];
    if (!content) continue;
    const channel = content.channel?.[0];
    if (!channel) continue;

    const channelName = channel.$.name;
    const layers = {};
    for (const layer of toArray(channel.layer || [])) {
      if (layer.$.type === "transition_logic") {
        for (const tl of toArray(layer.transition_logic_layer || [])) {
          if (tl.$) layers[tl.$.name] = tl.$.state;
        }
      }
    }
    channels.push({ channel: channelName, layers });
  }
  return channels;
}

async function inspectPlaylistElements(storageId) {
  const url = `${getBaseUrl()}/element_collection/storage/playlists/%7B${storageId}%7D/`;
  const res = await axios.get(url, { headers: ATOM_HEADERS });
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
  return toArray(parsed.feed.entry).map((e) => {
    const contentSrc = e.content?.[0]?.$?.src || null;
    const editUrl = getLinkHref(e, "edit");
    const title = e.title?.[0]?._ || e.title?.[0] || null;
    let elementStorageContent = null;
    if (contentSrc && !contentSrc.includes("/dataelements/")) {
      elementStorageContent = contentSrc;
    }
    return { title, editUrl, contentSrc, elementStorageContent };
  });
}

async function addElementToPlaylist(storageId, hubUuid, fileName, vizLayer = "MIDDLE") {
  const encoded = `%7B${storageId}%7D`;
  const safeTitle = fileName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rendererMap = { MIDDLE: "RENDERER", FRONT: "RENDERER*FRONT_LAYER", BACK: "RENDERER*BACK_LAYER" };
  const renderer = rendererMap[vizLayer] || "RENDERER";
  const vizCommand = `0 ${renderer} SET_OBJECT SCENE*&lt;${hubUuid}&gt;`;
  const modelUrl = `${getBaseUrl()}/models/vdf/system/default-templates/mastertemplates/viz-commands`;

  const atomEntry = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types" model="${modelUrl}">
      <field name="viz-custom-commands">
        <value>${vizCommand}</value>
      </field>
    </payload>
  </content>
</entry>`;

  const collectionUrl = `${getBaseUrl()}/element_collection/storage/playlists/${encoded}/`;
  const res = await axios.post(collectionUrl, atomEntry, {
    headers: { "Content-Type": "application/atom+xml;type=entry" },
    validateStatus: (s) => s < 500,
  });

  console.log("[addElement] viz-commands POST", res.status, typeof res.data === "string" ? res.data.slice(0, 200) : "");

  if (res.status >= 400) {
    const msg = typeof res.data === "string" ? res.data.trim() : JSON.stringify(res.data);
    throw new Error(`MSE viz-commands POST ${res.status}: ${msg}`);
  }

  return { success: true };
}

async function triggerProfileAction(profile, action, elementEditUrl) {
  const url = `${getBaseUrl()}/profiles/${encodeURIComponent(profile)}/${action}`;

  const res = await axios.post(url, elementEditUrl || "", {
    headers: { "Content-Type": "text/plain", Accept: "application/atom+xml" },
    validateStatus: (s) => s < 500,
  });
  broadcastMseStatus({ profile, action, elementEditUrl, timestamp: new Date().toISOString() });
  return {
    success: res.status < 400,
    status: res.status,
    message: typeof res.data === "string" ? res.data.trim() : "",
  };
}

module.exports = { getPlaylists, getPlaylistElements, getProfiles, getProfileState, triggerProfileAction, addElementToPlaylist, inspectPlaylistElements };
