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

function stripDataPrefix(path) {
  return path ? path.replace(/^data\//i, "") : path;
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

  const elements = toArray(parsed.feed.entry).map((e, i) => {
    const contentSrc = e.content?.[0]?.$?.src || null;
    const pilotMatch = contentSrc?.match(/\/dataelements\/(\d+)\/payload/);
    let elementType = "unknown";
    if (pilotMatch) elementType = "pilot";
    else if (contentSrc?.includes("/element/storage/")) elementType = "viz_scene";
    else if (!contentSrc) elementType = "viz_commands";
    return {
      id: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
      updated: e.updated[0],
      availableStatus: e["viz:available_status"] ? parseFloat(e["viz:available_status"][0]) : null,
      loadedStatus: e["viz:loaded_status"] ? parseFloat(e["viz:loaded_status"][0]) : null,
      valid: e["viz:valid_element"]?.[0] === "yes",
      channel: e["viz:channel"]?.[0] || null,
      editUrl: getLinkHref(e, "edit"),
      contentSrc,
      elementType,
      pilotElementId: pilotMatch ? pilotMatch[1] : null,
      position: i,
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

async function addElementToPlaylist(storageId, hubUuid, fileName, vizLayer = "MIDDLE", scenePath = null) {
  const encoded = `%7B${storageId}%7D`;
  const safeTitle = fileName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const collectionUrl = `${getBaseUrl()}/element_collection/storage/playlists/${encoded}/`;

  let atomEntry;

  if (scenePath) {
    // Hub scene file: create a viz_scene type element with scene path
    const cleanScene = stripDataPrefix(scenePath);
    const safeScene = cleanScene.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    atomEntry = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types">
      <field name="viz_scene">
        <value>${safeScene}</value>
      </field>
      <field name="viz_layer">
        <value>${vizLayer}</value>
      </field>
    </payload>
  </content>
</entry>`;

    const sceneRes = await axios.post(collectionUrl, atomEntry, {
      headers: { "Content-Type": "application/atom+xml;type=entry" },
      validateStatus: (s) => s < 500,
    });
    console.log("[addElement] viz_scene POST", sceneRes.status, typeof sceneRes.data === "string" ? sceneRes.data.slice(0, 300) : "");

    if (sceneRes.status < 400) return { success: true };

    // MSE rejected viz_scene payload — fall back to viz-commands with scene path
    console.log("[addElement] viz_scene rejected, falling back to viz-commands with scene path");
  }

  // viz-commands model: use scene path if available, UUID fallback for non-scene assets
  const rendererMap = { MIDDLE: "RENDERER", FRONT: "RENDERER*FRONT_LAYER", BACK: "RENDERER*BACK_LAYER" };
  const renderer = rendererMap[vizLayer] || "RENDERER";
  const vizCommand = scenePath
    ? `0 ${renderer} SET_OBJECT SCENE*${stripDataPrefix(scenePath)}`
    : `0 ${renderer} SET_OBJECT SCENE*&lt;${hubUuid}&gt;`;

  const modelUrl = `${getBaseUrl()}/models/vdf/system/default-templates/mastertemplates/viz-commands`;
  atomEntry = `<?xml version="1.0" encoding="UTF-8"?>
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

async function moveElement(storageId, elementEditUrl, toIndex) {
  const elements = await getPlaylistElements(storageId);
  const fromIndex = elements.findIndex((el) => el.editUrl === elementEditUrl);
  if (fromIndex === -1) throw new Error("Element not found in playlist");
  if (toIndex < 0 || toIndex >= elements.length) throw new Error("Target index out of bounds");
  if (fromIndex === toIndex) return { moved: false, reason: "Same position" };

  // Use MSE native PATCH reorder — no delete, element UUID is preserved
  const elementAtomId = `urn:uuid:${elements[fromIndex].id}`;

  let destinationXml;
  if (toIndex === 0) {
    destinationXml = `<destination><top/></destination>`;
  } else if (toIndex < fromIndex) {
    destinationXml = `<destination><before><atomid>urn:uuid:${elements[toIndex].id}</atomid></before></destination>`;
  } else {
    destinationXml = `<destination><after><atomid>urn:uuid:${elements[toIndex].id}</atomid></after></destination>`;
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<reorder xmlns="http://schema.vizrt.com/2018/atom-patch">
  <entries>
    <atomid>${elementAtomId}</atomid>
  </entries>
  ${destinationXml}
</reorder>`;

  const hierarchyUrl = `${getBaseUrl()}/hierarchy_collection/storage/playlists/%7B${storageId}%7D/`;
  const patchRes = await axios.patch(hierarchyUrl, body, {
    headers: {
      "Content-Type": "application/vnd.vizrt.atom-reorder+xml",
      Accept: "application/atom+xml",
    },
    validateStatus: () => true,
  });

  if (patchRes.status >= 400) {
    throw new Error(`Reorder PATCH ${patchRes.status}\nURL: ${hierarchyUrl}\nBody:\n${body}\nResponse: ${String(patchRes.data).slice(0, 300)}`);
  }

  return { moved: true, from: fromIndex, to: toIndex };
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

async function getElementContent(editUrl) {
  const res = await axios.get(editUrl, {
    headers: { Accept: "application/atom+xml" },
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) return { elementType: "unknown", scenePath: null };

  try {
    const parsed = await xml2js.parseStringPromise(res.data, {
      explicitArray: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
    });
    const e = parsed.entry;
    const content = toArray(e.content || [])[0];
    if (!content) return { elementType: "unknown", scenePath: null };

    const src = content.$?.src || null;
    if (src?.includes("/element/storage/")) return { elementType: "viz_scene", scenePath: null };
    if (src?.includes("/dataelements/")) return { elementType: "pilot", scenePath: null };

    const payload = toArray(content.payload || [])[0];
    if (!payload) return { elementType: "unknown", scenePath: null };

    const model = payload.$?.model || "";
    const fields = toArray(payload.field || []);

    if (model.includes("viz-commands")) {
      const cmdField = fields.find((f) => f.$?.name === "viz-custom-commands");
      const cmd = toArray(cmdField?.value || [])[0] || "";
      const match = cmd.match(/SCENE\*(.+)/);
      return { elementType: "viz_commands", scenePath: match ? stripDataPrefix(match[1].trim()) : null };
    }

    const sceneField = fields.find((f) => f.$?.name === "viz_scene");
    if (sceneField) {
      const scenePath = stripDataPrefix(toArray(sceneField.value || [])[0] || null);
      return { elementType: "viz_scene", scenePath };
    }

    return { elementType: "unknown", scenePath: null };
  } catch {
    return { elementType: "unknown", scenePath: null };
  }
}

module.exports = { getPlaylists, getPlaylistElements, getProfiles, getProfileState, triggerProfileAction, addElementToPlaylist, inspectPlaylistElements, moveElement, getElementContent };
