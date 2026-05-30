const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const axios = require("axios");
const xml2js = require("xml2js");
const net = require("net");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const config = require("../config.js");

// ── Viz Engine TCP helper ────────────────────────────────────────────────────
function sendToEngine(host, port, commands, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const lines = Array.isArray(commands) ? commands : [commands];
    const responses = [];
    let pending = lines.length;
    let buf = "";

    client.setTimeout(timeoutMs);

    let cmdIndex = 0;
    const sendNext = () => {
      if (cmdIndex >= lines.length) return;
      client.write(lines[cmdIndex] + "\0");
    };

    client.connect(port, host, () => sendNext());

    client.on("data", (data) => {
      buf += data.toString();
      if (buf.includes("\0")) {
        responses.push(buf.replace(/\0/g, "").trim());
        buf = "";
        cmdIndex++;
        pending--;
        if (pending <= 0) { client.destroy(); resolve(responses); }
        else sendNext();
      }
    });

    client.on("timeout", () => {
      client.destroy();
      resolve(responses.length ? responses : ["(timeout — no response)"]);
    });

    client.on("error", (err) => { client.destroy(); reject(err); });
    client.on("close", () => { if (pending > 0) resolve(responses); });
  });
}

// ── base URLs ────────────────────────────────────────────────────────────────
const MSE   = `http://${config.mse.host}:${config.mse.port}`;
const PILOT = `http://${config.pilot.host}:${config.pilot.port}`;
const HUB   = `http://${config.hub.host}:${config.hub.port}`;
const HUB_AUTH = { username: config.hub.username, password: config.hub.password };

const ATOM  = { Accept: "application/atom+xml" };

// ── helpers ──────────────────────────────────────────────────────────────────
function toArray(v) { return !v ? [] : Array.isArray(v) ? v : [v]; }
function linkHref(entry, rel) {
  return toArray(entry.link).find(l => l.$ && l.$.rel === rel)?.$?.href ?? null;
}
function extractStorageId(url) {
  const m = decodeURIComponent(url || "").match(/\{([^}]+)\}/);
  return m ? m[1] : null;
}
async function parseAtom(data) {
  return xml2js.parseStringPromise(data, { explicitArray: true });
}
function stripDataPrefix(path) {
  return path ? path.replace(/^data\//i, "") : path;
}

// ── server ───────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "vizrt-control",
  version: "1.0.0",
});

// ════════════════════════════════════════════════════════════════════════════
// MSE — PLAYLISTS
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "mse_list_playlists",
  "List all playlists in MSE (Media Sequencer Engine). Returns id, storageId, and name for each playlist.",
  {},
  async () => {
    const res = await axios.get(`${MSE}/directory/playlists/`, { headers: ATOM });
    const p = await parseAtom(res.data);
    const playlists = toArray(p.feed.entry).map(e => {
      const altUrl = linkHref(e, "alternate");
      return {
        id: e.id[0].replace("urn:uuid:", ""),
        storageId: extractStorageId(altUrl || ""),
        name: e.title[0]._ || e.title[0],
        updated: e.updated[0],
      };
    });
    return { content: [{ type: "text", text: JSON.stringify(playlists, null, 2) }] };
  }
);

server.tool(
  "mse_list_elements",
  "List all elements (graphics items) in an MSE playlist. Provide the playlist storageId from mse_list_playlists.",
  { storageId: z.string().describe("Playlist storageId (UUID without curly braces)") },
  async ({ storageId }) => {
    const url = `${MSE}/element_collection/storage/playlists/%7B${storageId}%7D/`;
    const res = await axios.get(url, { headers: ATOM });
    const p = await parseAtom(res.data);
    const elements = toArray(p.feed.entry).map(e => ({
      id: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
      editUrl: linkHref(e, "edit"),
      valid: e["viz:valid_element"]?.[0] === "yes",
      availableStatus: e["viz:available_status"] ? parseFloat(e["viz:available_status"][0]) : null,
      loadedStatus: e["viz:loaded_status"] ? parseFloat(e["viz:loaded_status"][0]) : null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(elements, null, 2) }] };
  }
);

server.tool(
  "mse_add_hub_scene",
  "Add a scene from Viz Graphic Hub to an MSE playlist as a viz-commands element. When taken, it sends SET_OBJECT SCENE to the Viz Engine.",
  {
    storageId: z.string().describe("Playlist storageId from mse_list_playlists"),
    hubUuid:   z.string().describe("Scene UUID from hub_browse or hub_search"),
    name:      z.string().describe("Display name for the element in the playlist"),
    vizLayer:  z.enum(["MIDDLE", "FRONT", "BACK"]).default("MIDDLE").describe("Which renderer layer to target"),
  },
  async ({ storageId, hubUuid, name, vizLayer }) => {
    const rendererMap = { MIDDLE: "RENDERER", FRONT: "RENDERER*FRONT_LAYER", BACK: "RENDERER*BACK_LAYER" };
    const renderer = rendererMap[vizLayer];
    const safeTitle = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const vizCommand = `0 ${renderer} SET_OBJECT SCENE*&lt;${hubUuid}&gt;`;
    const modelUrl = `${MSE}/models/vdf/system/default-templates/mastertemplates/viz-commands`;

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types" model="${modelUrl}">
      <field name="viz-custom-commands"><value>${vizCommand}</value></field>
    </payload>
  </content>
</entry>`;

    const res = await axios.post(
      `${MSE}/element_collection/storage/playlists/%7B${storageId}%7D/`,
      body,
      { headers: { "Content-Type": "application/atom+xml;type=entry" }, validateStatus: s => s < 500 }
    );
    if (res.status >= 400) throw new Error(`MSE error ${res.status}: ${res.data}`);
    return { content: [{ type: "text", text: `Added "${name}" to playlist (${vizLayer} layer).` }] };
  }
);

server.tool(
  "mse_add_pilot_element",
  "Add a Pilot data element as a new entry in an MSE playlist. References the Pilot dataelement by its ID; the resulting playlist entry is takeable via mse_trigger using the returned editUrl. Use this when you have an existing Pilot dataelement and want to schedule it on-air via MSE.",
  {
    storageId:      z.string().describe("Playlist storageId (UUID without curly braces) from mse_list_playlists"),
    pilotElementId: z.string().describe("Pilot data element ID, e.g. '42', from pilot_list_elements"),
    name:           z.string().optional().describe("Display name override; defaults to the Pilot element's own title"),
  },
  async ({ storageId, pilotElementId, name }) => {
    const postUrl = `${MSE}/element_collection/storage/playlists/%7B${storageId}%7D/elements`;

    // 1. Resolve display name from Pilot if not provided
    let elementName = name;
    if (!elementName) {
      const er = await axios.get(`${PILOT}/dataelements/${pilotElementId}`, {
        headers: ATOM, validateStatus: () => true,
      });
      if (er.status >= 400) throw new Error(`GET Pilot element ${er.status}\nURL: ${PILOT}/dataelements/${pilotElementId}\nResponse: ${String(er.data).slice(0, 300)}`);
      const ep = await parseAtom(er.data);
      elementName = ep.entry?.title?.[0]?._ || ep.entry?.title?.[0] || `element-${pilotElementId}`;
    }

    // 2. Build minimal verified body — only <title> + <content src> with /payload suffix
    const pilotPayloadUrl = `${PILOT}/dataelements/${pilotElementId}/payload`;
    const safeTitle = elementName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml"
           src="${pilotPayloadUrl}"/>
</entry>`;

    // 3. POST
    const res = await axios.post(postUrl, body, {
      headers: { "Content-Type": "application/atom+xml", Accept: "application/atom+xml; type=entry" },
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      const detail = typeof res.data === "string" ? res.data.slice(0, 500) : JSON.stringify(res.data);
      throw new Error(`MSE ${res.status}\nURL: ${postUrl}\nBody:\n${body}\nResponse:\n${detail}`);
    }

    // 4. Parse 201 Created — MSE returns the new entry's Atom XML
    const created = await parseAtom(res.data);
    const ne = created.entry;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id:              ne?.id?.[0]?.replace("urn:uuid:", "") || null,
          name:            ne?.title?.[0]?._ || ne?.title?.[0] || elementName,
          editUrl:         linkHref(ne, "self"),
          valid:           ne?.["viz:valid_element"]?.[0] === "yes",
          availableStatus: ne?.["viz:available_status"] ? parseFloat(ne["viz:available_status"][0]) : null,
          loadedStatus:    ne?.["viz:loaded_status"]    ? parseFloat(ne["viz:loaded_status"][0])    : null,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "mse_add_scene_by_path",
  "Add a Viz Engine scene to an MSE playlist using its scene path (e.g. 'ShowName/Folder/Scene'). Tries viz_scene payload first, falls back to viz-commands with SET_OBJECT SCENE*. The 'data/' prefix is stripped automatically.",
  {
    storageId: z.string().describe("Playlist storageId from mse_list_playlists"),
    scenePath: z.string().describe("Viz Engine scene path, e.g. 'AJEnglish/40_RESOURCE/Scene1'. 'data/' prefix is stripped automatically."),
    name:      z.string().describe("Display name for the element in the playlist"),
    vizLayer:  z.enum(["MIDDLE", "FRONT", "BACK"]).default("MIDDLE").describe("Which renderer layer to target"),
  },
  async ({ storageId, scenePath, name, vizLayer }) => {
    const rendererMap = { MIDDLE: "RENDERER", FRONT: "RENDERER*FRONT_LAYER", BACK: "RENDERER*BACK_LAYER" };
    const renderer   = rendererMap[vizLayer];
    const cleanScene = stripDataPrefix(scenePath);
    const safeTitle  = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeScene  = cleanScene.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const collectionUrl = `${MSE}/element_collection/storage/playlists/%7B${storageId}%7D/`;

    // Attempt 1: viz_scene payload
    const vizSceneBody = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types">
      <field name="viz_scene"><value>${safeScene}</value></field>
      <field name="viz_layer"><value>${vizLayer}</value></field>
    </payload>
  </content>
</entry>`;

    const sceneRes = await axios.post(collectionUrl, vizSceneBody, {
      headers: { "Content-Type": "application/atom+xml;type=entry" },
      validateStatus: s => s < 500,
    });
    if (sceneRes.status < 400) {
      return { content: [{ type: "text", text: `Added "${name}" as viz_scene (layer: ${vizLayer}, path: ${cleanScene}).` }] };
    }

    // Fallback: viz-commands
    const vizCommand = `0 ${renderer} SET_OBJECT SCENE*${safeScene}`;
    const modelUrl   = `${MSE}/models/vdf/system/default-templates/mastertemplates/viz-commands`;
    const cmdBody = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${safeTitle}</title>
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types" model="${modelUrl}">
      <field name="viz-custom-commands"><value>${vizCommand}</value></field>
    </payload>
  </content>
</entry>`;

    const res = await axios.post(collectionUrl, cmdBody, {
      headers: { "Content-Type": "application/atom+xml;type=entry" },
      validateStatus: s => s < 500,
    });
    if (res.status >= 400) throw new Error(`MSE error ${res.status}: ${String(res.data).slice(0, 300)}`);
    return { content: [{ type: "text", text: `Added "${name}" as viz-commands (layer: ${vizLayer}, path: ${cleanScene}).` }] };
  }
);

server.tool(
  "mse_delete_element",
  "Delete an element from an MSE playlist by its editUrl. Get the editUrl from mse_list_elements.",
  {
    elementEditUrl: z.string().describe("Element editUrl from mse_list_elements"),
  },
  async ({ elementEditUrl }) => {
    const res = await axios.delete(elementEditUrl, {
      headers: ATOM,
      validateStatus: s => s < 500,
    });
    if (res.status >= 400) throw new Error(`MSE DELETE ${res.status}: ${String(res.data).slice(0, 300)}`);
    return { content: [{ type: "text", text: JSON.stringify({ deleted: true, status: res.status, elementEditUrl }) }] };
  }
);

server.tool(
  "mse_move_element",
  "Reorder an element within an MSE playlist to a specific index. Uses the native MSE PATCH hierarchy_collection reorder API — the element UUID is preserved.",
  {
    storageId:      z.string().describe("Playlist storageId from mse_list_playlists"),
    elementEditUrl: z.string().describe("Element editUrl from mse_list_elements"),
    toIndex:        z.number().int().min(0).describe("Target zero-based position in the playlist"),
  },
  async ({ storageId, elementEditUrl, toIndex }) => {
    const url = `${MSE}/element_collection/storage/playlists/%7B${storageId}%7D/`;
    const res = await axios.get(url, { headers: ATOM });
    const p   = await parseAtom(res.data);
    const elements = toArray(p.feed.entry).map((e, i) => ({
      id:      e.id[0].replace("urn:uuid:", ""),
      editUrl: linkHref(e, "edit"),
      position: i,
    }));

    const fromIndex = elements.findIndex(el => el.editUrl === elementEditUrl);
    if (fromIndex === -1) throw new Error("Element not found in playlist");
    if (toIndex < 0 || toIndex >= elements.length) throw new Error(`Target index ${toIndex} out of bounds (0–${elements.length - 1})`);
    if (fromIndex === toIndex) return { content: [{ type: "text", text: JSON.stringify({ moved: false, reason: "Already at target position" }) }] };

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

    const hierarchyUrl = `${MSE}/hierarchy_collection/storage/playlists/%7B${storageId}%7D/`;
    const patchRes = await axios.patch(hierarchyUrl, body, {
      headers: { "Content-Type": "application/vnd.vizrt.atom-reorder+xml", Accept: "application/atom+xml" },
      validateStatus: () => true,
    });
    if (patchRes.status >= 400) {
      throw new Error(`Reorder PATCH ${patchRes.status}: ${String(patchRes.data).slice(0, 300)}`);
    }
    return { content: [{ type: "text", text: JSON.stringify({ moved: true, from: fromIndex, to: toIndex }) }] };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// MSE — PROFILES / AUTOMATION
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "mse_list_profiles",
  "List all automation profiles in MSE.",
  {},
  async () => {
    const res = await axios.get(`${MSE}/profiles/`, { headers: ATOM });
    const p = await parseAtom(res.data);
    const profiles = toArray(p.feed.entry).map(e => ({ id: e.title[0]._ || e.title[0] }));
    return { content: [{ type: "text", text: JSON.stringify(profiles, null, 2) }] };
  }
);

server.tool(
  "mse_get_profile_state",
  "Get the current on-air state of an MSE profile — which layers are active and what state each channel is in.",
  { profile: z.string().default("default").describe("Profile name, e.g. 'default'") },
  async ({ profile }) => {
    const res = await axios.get(`${MSE}/profiles/${encodeURIComponent(profile)}/state`, { headers: ATOM });
    const p = await xml2js.parseStringPromise(res.data, { explicitArray: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
    const channels = [];
    for (const entry of toArray(p.feed?.entry || [])) {
      const channel = entry.content?.[0]?.channel?.[0];
      if (!channel) continue;
      const layers = {};
      for (const layer of toArray(channel.layer || [])) {
        if (layer.$.type === "transition_logic") {
          for (const tl of toArray(layer.transition_logic_layer || [])) {
            if (tl.$) layers[tl.$.name] = tl.$.state;
          }
        }
      }
      channels.push({ channel: channel.$.name, layers });
    }
    return { content: [{ type: "text", text: JSON.stringify(channels, null, 2) }] };
  }
);

async function fireMseTrigger(profile, action, elementEditUrl) {
  const res = await axios.post(
    `${MSE}/profiles/${encodeURIComponent(profile)}/${action}`,
    elementEditUrl || "",
    { headers: { "Content-Type": "text/plain", Accept: "application/atom+xml" }, validateStatus: s => s < 500 }
  );
  return { action, profile, status: res.status, message: typeof res.data === "string" ? res.data.trim() : "" };
}

server.tool(
  "mse_trigger",
  "Trigger an automation action (take, cue, out, continue, cut, etc.) on an MSE profile. Optionally target a specific element by its editUrl.",
  {
    profile:        z.string().default("default").describe("Profile name"),
    action:         z.enum(["take", "cue", "out", "continue", "continue_reverse", "cut", "read", "update", "cleanup", "initialize", "prepare", "stop"]),
    elementEditUrl: z.string().optional().describe("Element editUrl from mse_list_elements to target a specific element"),
  },
  async ({ profile, action, elementEditUrl }) => {
    const result = await fireMseTrigger(profile, action, elementEditUrl);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "mse_take_pilot_element",
  "Update a Pilot data element's fields and immediately fire an MSE trigger (take by default) on its playlist entry. Single-call convenience for the fill-and-take pattern. Equivalent to pilot_update_element followed by mse_trigger, with sequenced error handling — MSE trigger is skipped if the Pilot update fails.",
  {
    elementEditUrl: z.string().describe("MSE element editUrl from mse_list_elements"),
    pilotElementId: z.string().describe("Pilot data element ID, e.g. '42'"),
    fields:         z.array(z.object({ name: z.string(), value: z.string() })).describe("Field values to set on the Pilot element"),
    profile:        z.string().default("default").describe("MSE profile name"),
    action:         z.enum(["take", "cue", "continue", "cut", "out"]).default("take").describe("MSE trigger action"),
  },
  async ({ elementEditUrl, pilotElementId, fields, profile, action }) => {
    // Step 1: Pilot update — abort if it fails, do NOT fire MSE
    try {
      await updatePilotFields(pilotElementId, fields);
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          pilot: { error: err.message },
          mse:   { skipped: true, reason: "pilot update failed" },
        }, null, 2) }],
        isError: true,
      };
    }

    // Step 2: MSE trigger — surface partial state if it fails
    const mseResult = await fireMseTrigger(profile, action, elementEditUrl);
    const isError = mseResult.status >= 400;
    return {
      content: [{ type: "text", text: JSON.stringify({
        pilot: { id: pilotElementId, fieldsUpdated: fields.length },
        mse:   mseResult,
      }, null, 2) }],
      isError,
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PILOT — DATA ELEMENTS
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "pilot_list_concepts",
  "List all concepts (graphic packages / show styles) in Viz Content Pilot.",
  {},
  async () => {
    const res = await axios.get(`${PILOT}/concepts`, { headers: ATOM });
    const p = await parseAtom(res.data);
    const concepts = toArray(p.feed.entry).map(e => ({
      id: e.id[0].replace("urn:concept:dbid:", ""),
      name: e.title[0]._ || e.title[0],
    }));
    return { content: [{ type: "text", text: JSON.stringify(concepts, null, 2) }] };
  }
);

server.tool(
  "pilot_list_templates",
  "List graphic templates in Viz Content Pilot, optionally filtered by conceptId. Returns id and name only. Use pilot_search_templates to also search by the templatedescription field.",
  { conceptId: z.string().optional().describe("Filter by concept ID from pilot_list_concepts") },
  async ({ conceptId }) => {
    const url = conceptId ? `${PILOT}/templates?concept=${conceptId}` : `${PILOT}/templates`;
    const res = await axios.get(url, { headers: ATOM });
    const p = await parseAtom(res.data);
    const templates = toArray(p.feed.entry).map(e => {
      const raw = e["atomext:pilotdbid"]?.[0];
      const id = typeof raw === "string" ? raw.trim() : (raw?._ || "").trim();
      return { id, name: e.title[0]._ || e.title[0] };
    });
    return { content: [{ type: "text", text: JSON.stringify(templates, null, 2) }] };
  }
);

server.tool(
  "pilot_search_templates",
  "Search Pilot templates by name or description. Every template has a 'templatedescription' field containing a human-readable description of what the template does. Use this tool to find the right template before calling pilot_create_element_from_template. Leave query empty to list all templates with their descriptions.",
  {
    query:     z.string().optional().describe("Text to match against template name or templatedescription. Case-insensitive. Leave empty to return all templates with descriptions."),
    conceptId: z.string().optional().describe("Narrow results to a specific concept ID from pilot_list_concepts"),
  },
  async ({ query, conceptId }) => {
    const url = conceptId ? `${PILOT}/templates?concept=${conceptId}` : `${PILOT}/templates`;
    const res = await axios.get(url, { headers: ATOM });
    const p = await parseAtom(res.data);
    const templates = toArray(p.feed.entry).map(e => {
      const raw = e["atomext:pilotdbid"]?.[0];
      const id = typeof raw === "string" ? raw.trim() : (raw?._ || "").trim();
      return { id, name: e.title[0]._ || e.title[0] };
    });

    // Fetch templatedescription from each template's model in parallel
    const withDescriptions = await Promise.all(
      templates.map(async (t) => {
        try {
          const mr = await axios.get(`${PILOT}/templates/${t.id}/model`, { validateStatus: () => true });
          if (mr.status >= 400) return { ...t, description: "" };
          const mp = await xml2js.parseStringPromise(mr.data, { explicitArray: true });
          const descField = toArray(mp.payload?.field || []).find(f => f.$?.name === "templatedescription");
          if (!descField) return { ...t, description: "" };
          const val = descField.value?.[0];
          let description = "";
          if (typeof val === "string") description = val.trim();
          else if (val?.["fo:wrapper"]) {
            const w = val["fo:wrapper"][0];
            description = (typeof w === "string" ? w : w._ || "").trim();
          } else if (val?._) description = val._.trim();
          return { ...t, description };
        } catch {
          return { ...t, description: "" };
        }
      })
    );

    // Filter by query if provided
    if (query) {
      const q = query.toLowerCase();
      const filtered = withDescriptions.filter(t =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(withDescriptions, null, 2) }] };
  }
);

server.tool(
  "pilot_list_elements",
  "List data elements (graphic instances) in Viz Content Pilot, filtered by templateId and/or conceptId.",
  {
    templateId: z.string().optional().describe("Filter by template ID"),
    conceptId:  z.string().optional().describe("Filter by concept ID"),
  },
  async ({ templateId, conceptId }) => {
    const concept = conceptId || "-1";
    const url = templateId
      ? `${PILOT}/dataelements?template=${templateId}&concept=${concept}`
      : `${PILOT}/dataelements`;
    const res = await axios.get(url, { headers: ATOM });
    const p = await parseAtom(res.data);
    const elements = toArray(p.feed.entry).map(e => {
      const raw = e["atomext:pilotdbid"]?.[0];
      const id = typeof raw === "string" ? raw.trim() : (raw?._ || "").trim();
      return { id, name: e.title[0]._ || e.title[0], updated: e.updated[0] };
    });
    return { content: [{ type: "text", text: JSON.stringify(elements, null, 2) }] };
  }
);

server.tool(
  "pilot_get_element",
  "Get the editable fields and current values of a Pilot data element by its ID.",
  { id: z.string().describe("Data element ID from pilot_list_elements") },
  async ({ id }) => {
    const res = await axios.get(`${PILOT}/dataelements/${id}/payload`);
    const p = await parseAtom(res.data);
    const fields = toArray(p.payload.field)
      .filter(f => !f.field)
      .map(f => {
        const val = f.value?.[0];
        let value = "";
        if (typeof val === "string") value = val.trim();
        else if (val?.["fo:wrapper"]) {
          const w = val["fo:wrapper"][0];
          value = (typeof w === "string" ? w : w._ || "").trim();
        } else if (val?._) value = val._.trim();
        return { name: f.$.name, value };
      });
    return { content: [{ type: "text", text: JSON.stringify({ id, fields }, null, 2) }] };
  }
);

async function updatePilotFields(id, fields) {
  const res = await axios.get(`${PILOT}/dataelements/${id}/payload`);
  const p = await parseAtom(res.data);
  const fieldMap = Object.fromEntries(fields.map(f => [f.name, f.value]));
  const hasFoWrapper = f => !!(f.value && f.value[0] && f.value[0]["fo:wrapper"]);
  p.payload.field = toArray(p.payload.field).map(f => {
    if (!(f.$.name in fieldMap)) return f;
    const newVal = fieldMap[f.$.name];
    f.value = hasFoWrapper(f)
      ? [{ "fo:wrapper": [{ _: newVal, $: { "xmlns:fo": "http://www.w3.org/1999/XSL/Format" } }] }]
      : [newVal];
    return f;
  });
  const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "utf-8" } });
  await axios.put(`${PILOT}/dataelements/${id}/payload`, builder.buildObject(p), {
    headers: { "Content-Type": "application/vnd.vizrt.payload+xml" },
  });
}

server.tool(
  "pilot_update_element",
  "Update one or more fields in a Pilot data element. Use pilot_get_element first to see available field names.",
  {
    id:     z.string().describe("Data element ID"),
    fields: z.array(z.object({ name: z.string(), value: z.string() })).describe("Fields to update"),
  },
  async ({ id, fields }) => {
    await updatePilotFields(id, fields);
    return { content: [{ type: "text", text: `Updated ${fields.length} field(s) on element ${id}.` }] };
  }
);

server.tool(
  "pilot_create_element_from_template",
  "Create a new data element in Viz Content Pilot from a template. Fetches the template model to populate all required fields. Returns the new element ID.",
  {
    templateId: z.string().describe("Template ID from pilot_list_templates"),
    name:       z.string().describe("Name/title for the new data element"),
    conceptId:  z.string().optional().describe("Concept ID to associate the element with"),
    fields:     z.array(z.object({ name: z.string(), value: z.string() })).optional().describe("Field values to set — overrides template defaults"),
  },
  async ({ templateId, name, conceptId, fields }) => {
    function xe(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

    // 1. Resolve concept name from ID (needed for -concept-variant-choice field)
    let conceptName = "";
    if (conceptId) {
      const cr = await axios.get(`${PILOT}/concepts`, { headers: ATOM, validateStatus: () => true });
      if (cr.status === 200) {
        const cp = await parseAtom(cr.data);
        const match = toArray(cp.feed?.entry || []).find(e =>
          e.id[0].replace("urn:concept:dbid:", "") === String(conceptId)
        );
        if (match) conceptName = match.title[0]._ || match.title[0];
      }
    }

    // 2. GET template model — provides every required field and their types/defaults
    const modelUrl = `${PILOT}/templates/${templateId}/model`;
    const mr = await axios.get(modelUrl, { validateStatus: () => true });
    if (mr.status >= 400) throw new Error(`GET template model ${mr.status}: ${String(mr.data).slice(0, 200)}`);
    const modelParsed = await xml2js.parseStringPromise(mr.data, { explicitArray: true });
    const modelFields = toArray(modelParsed.payload?.field || []);

    // 3. Build field XML — every model field included, user values override defaults
    const userMap = Object.fromEntries((fields || []).map(f => [f.name, f.value]));
    const hasFoWrapper = f => !!(f.value?.[0]?.["fo:wrapper"]);

    function renderField(f, pad = "      ") {
      const fname = f.$?.name || "";
      const subFields = toArray(f.field || []);

      if (subFields.length > 0) {
        if (fname === "-concept-variant-choice") {
          return [
            `${pad}<field name="${fname}">`,
            `${pad}  <field name="concept"><value>${xe(conceptName)}</value></field>`,
            `${pad}  <field name="variant"><value></value></field>`,
            `${pad}</field>`,
          ].join("\n");
        }
        const inner = subFields.map(sf => renderField(sf, pad + "  ")).join("\n");
        return `${pad}<field name="${fname}">\n${inner}\n${pad}</field>`;
      }

      const defaultVal = hasFoWrapper(f)
        ? (typeof f.value[0]["fo:wrapper"][0] === "string" ? f.value[0]["fo:wrapper"][0] : f.value[0]["fo:wrapper"][0]?._ || "")
        : (typeof f.value?.[0] === "string" ? f.value[0] : f.value?.[0]?._ || "");
      const val = fname in userMap ? userMap[fname] : defaultVal;

      return hasFoWrapper(f)
        ? `${pad}<field name="${fname}"><value><fo:wrapper xmlns:fo="http://www.w3.org/1999/XSL/Format">${xe(val)}</fo:wrapper></value></field>`
        : `${pad}<field name="${fname}"><value>${xe(val)}</value></field>`;
    }

    const fieldsXml = modelFields.map(f => renderField(f)).join("\n");
    const conceptLink = conceptId ? `\n  <link rel="concept" href="${PILOT}/concepts/${conceptId}"/>` : "";

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${xe(name)}</title>
  <link rel="template" href="${PILOT}/templates/${templateId}"/>${conceptLink}
  <content type="application/vnd.vizrt.payload+xml">
    <payload xmlns="http://www.vizrt.com/types" model="${modelUrl}">
${fieldsXml}
    </payload>
  </content>
</entry>`;

    const createRes = await axios.post(`${PILOT}/dataelements`, body, {
      headers: { "Content-Type": "application/atom+xml", Accept: "application/atom+xml" },
      validateStatus: () => true,
    });
    if (createRes.status >= 400) {
      const detail = typeof createRes.data === "string" ? createRes.data.slice(0, 500) : JSON.stringify(createRes.data);
      throw new Error(`Pilot ${createRes.status}\nURL: ${PILOT}/dataelements\nBody:\n${body}\nResponse:\n${detail}`);
    }

    const created = await xml2js.parseStringPromise(createRes.data, { explicitArray: true });
    const raw = created.entry?.["atomext:pilotdbid"]?.[0];
    const newId = typeof raw === "string" ? raw.trim() : (raw?._ || "").trim();
    if (!newId) throw new Error("Element created but could not extract new ID from response");

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ id: newId, name, templateId, conceptId, fieldsSet: fields?.length || 0 }, null, 2),
      }],
    };
  }
);

server.tool(
  "pilot_render_to_engine",
  "Resolve a Pilot template model, push field values directly to Viz Engine over TCP, and start the stage. No MSE involved.",
  {
    templateId: z.string().describe("Template ID from pilot_list_templates"),
    fields:     z.array(z.object({ name: z.string(), value: z.string() })).describe("Field values to render"),
    engineId:   z.string().optional().describe("Engine ID from config; defaults to first enabled engine"),
  },
  async ({ templateId, fields, engineId }) => {
    // ── Phase 1: RESOLVE ─────────────────────────────────────────────────────
    const modelUrl = `${PILOT}/templates/${templateId}/model`;
    const mr = await axios.get(modelUrl, { validateStatus: () => true });
    if (mr.status >= 400) {
      throw new Error(`GET template model ${mr.status}\nURL: ${modelUrl}\n${String(mr.data).slice(0, 300)}`);
    }

    // Parse with prefix stripping so viz:xxx attributes become xxx
    const modelParsed = await xml2js.parseStringPromise(mr.data, {
      explicitArray: true,
      attrNameProcessors: [xml2js.processors.stripPrefix],
    });
    const payload = modelParsed.payload;

    // Extract scene reference — Pilot stores it as an attribute on <payload>
    // Common attribute names across Pilot versions: viz-scene, scene, scene-path, vizScene
    const payloadAttrs = payload?.$ || {};
    const sceneRef =
      payloadAttrs["viz-scene"] ||
      payloadAttrs["vizScene"]  ||
      payloadAttrs["scene"]     ||
      payloadAttrs["scene-path"] || null;

    // Extract field→container bindings from field attributes
    // Common: viz:container / viz:property  (stripped to container / property)
    const bindings = {}; // fieldName → { container, property }
    function extractBindings(f) {
      const fname = f.$?.name;
      if (!fname) return;
      const container = f.$?.container || f.$?.["viz-container"] || null;
      const property  = f.$?.property  || f.$?.["viz-property"]  || "TEXT";
      if (container) bindings[fname] = { container, property };
      toArray(f.field || []).forEach(extractBindings);
    }
    toArray(payload?.field || []).forEach(extractBindings);

    // If we found no scene ref and no bindings, dump the raw model so the user
    // can identify the correct attribute names
    if (!sceneRef && Object.keys(bindings).length === 0) {
      throw new Error(
        `Could not extract scene reference or field bindings from template model.\n` +
        `Payload attributes found: ${JSON.stringify(payloadAttrs)}\n` +
        `Raw model (first 800 chars):\n${mr.data.slice(0, 800)}`
      );
    }
    if (!sceneRef) {
      throw new Error(
        `Field bindings found (${Object.keys(bindings).length}) but no scene reference.\n` +
        `Payload attributes: ${JSON.stringify(payloadAttrs)}\n` +
        `Raw model (first 400 chars):\n${mr.data.slice(0, 400)}`
      );
    }

    // ── Phase 2: PUSH to engine ───────────────────────────────────────────────
    const engines = config.engine.filter(e => e.enabled);
    if (!engines.length) throw new Error("No enabled Viz Engines in config.");
    const engine = engineId
      ? (engines.find(e => e.id === engineId) || engines[0])
      : engines[0];

    const commands = [];
    const warnings = [];

    // Load the scene
    commands.push(`RENDERER SET_OBJECT SCENE*${sceneRef}`);

    // Set each field value via its container binding
    for (const f of fields) {
      const b = bindings[f.name];
      if (!b) {
        warnings.push(`Field "${f.name}" has no container binding in template model — skipped`);
        continue;
      }
      const path = b.container.replace(/[/.]/g, "*");
      commands.push(`RENDERER*TREE*${path}*${b.property} SET ${f.value}`);
    }

    // Take on air
    commands.push("RENDERER*STAGE START");

    const responses = await sendToEngine(engine.host, engine.port, commands);
    const fieldsApplied = fields.length - warnings.length;

    // ── Phase 3: RETURN ──────────────────────────────────────────────────────
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          engine: `${engine.name} (${engine.host}:${engine.port})`,
          sceneRef,
          fieldsApplied,
          warnings,
          engineResponses: responses,
        }, null, 2),
      }],
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// HUB — BROWSE & SEARCH
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "hub_browse",
  "Browse Viz Graphic Hub folders and files. Leave folderUuid empty to start at the root.",
  { folderUuid: z.string().optional().describe("Folder UUID to list; omit for root") },
  async ({ folderUuid }) => {
    const ROOT = "00000000-0000-0000-0000-000000000000";
    const uuid = folderUuid || ROOT;
    const [foldersRes, filesRes] = await Promise.all([
      axios.get(`${HUB}/folders/${uuid}`, { headers: ATOM, auth: HUB_AUTH }),
      axios.get(`${HUB}/files/${uuid}`,   { headers: ATOM, auth: HUB_AUTH }),
    ]);
    const pf = await parseAtom(foldersRes.data);
    const pp = await parseAtom(filesRes.data);

    const folders = toArray(pf.feed?.entry || []).map(e => ({
      type: "folder",
      uuid: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
    })).sort((a, b) => a.name.localeCompare(b.name));

    const files = toArray(pp.feed?.entry || []).map(e => ({
      type: "file",
      uuid: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
    })).sort((a, b) => a.name.localeCompare(b.name));

    return { content: [{ type: "text", text: JSON.stringify([...folders, ...files], null, 2) }] };
  }
);

server.tool(
  "hub_search",
  "Search Viz Graphic Hub for scenes/files by name. Returns matching files with their UUIDs.",
  { query: z.string().describe("Search term (file name or partial name)") },
  async ({ query }) => {
    const res = await axios.get(`${HUB}/files/search?q=${encodeURIComponent(query)}`, {
      headers: ATOM,
      auth: HUB_AUTH,
      validateStatus: s => s < 500,
    });
    if (res.status === 404) return { content: [{ type: "text", text: "[]" }] };
    const p = await parseAtom(res.data);
    const files = toArray(p.feed?.entry || []).map(e => ({
      uuid: e.id[0].replace("urn:uuid:", ""),
      name: e.title[0]._ || e.title[0],
    }));
    return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
  }
);

server.tool(
  "hub_get_file_info",
  "Find a file in Viz Graphic Hub by its UUID and return its name and full folder path. Walks the Hub folder tree via BFS starting from the given folder (or root). Provide startFolderUuid to narrow the search. Returns scenePath with 'data/' prefix stripped — ready for Viz Engine SET_OBJECT commands.",
  {
    uuid:            z.string().describe("File UUID to look up"),
    startFolderUuid: z.string().optional().describe("Folder UUID to start the search from; omit to search from root"),
    maxDepth:        z.number().int().min(1).max(10).default(5).describe("Maximum folder depth to search (default: 5)"),
  },
  async ({ uuid, startFolderUuid, maxDepth = 5 }) => {
    const ROOT      = "00000000-0000-0000-0000-000000000000";
    const startUuid = startFolderUuid || ROOT;
    const queue     = [{ folderUuid: startUuid, path: [], depth: 0 }];

    while (queue.length > 0) {
      const { folderUuid, path, depth } = queue.shift();

      const filesRes = await axios.get(`${HUB}/files/${folderUuid}`, {
        headers: ATOM, auth: HUB_AUTH, validateStatus: s => s < 500,
      });
      if (filesRes.status < 400) {
        const fp    = await parseAtom(filesRes.data);
        const files = toArray(fp.feed?.entry || []);
        for (const f of files) {
          const fileUuid = f.id[0].replace("urn:uuid:", "");
          if (fileUuid === uuid) {
            const name       = f.title[0]._ || f.title[0];
            const folderPath = path.join("/");
            const fullPath   = [...path, name].join("/");
            const scenePath  = stripDataPrefix(fullPath);
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ uuid, name, folderPath, fullPath, scenePath }, null, 2),
              }],
            };
          }
        }
      }

      if (depth < maxDepth) {
        const foldersRes = await axios.get(`${HUB}/folders/${folderUuid}`, {
          headers: ATOM, auth: HUB_AUTH, validateStatus: s => s < 500,
        });
        if (foldersRes.status < 400) {
          const foldP   = await parseAtom(foldersRes.data);
          const folders = toArray(foldP.feed?.entry || []);
          for (const folder of folders) {
            const folderName  = folder.title[0]._ || folder.title[0];
            const childUuid   = folder.id[0].replace("urn:uuid:", "");
            queue.push({ folderUuid: childUuid, path: [...path, folderName], depth: depth + 1 });
          }
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ uuid, found: false, message: `File not found within depth ${maxDepth} from folder ${startUuid}` }, null, 2),
      }],
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// VIZ ENGINE — DIRECT TCP CONTROL
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "engine_send",
  "Send one or more commands directly to a Viz Engine over TCP (port 6100) and return the response(s). Use for direct renderer control: SET_OBJECT, RENDERER, SCENE commands, etc. Commands are sent in order; each response line is returned.",
  {
    commands: z.union([z.string(), z.array(z.string())]).describe(
      "A single command string or an array of commands. Example: '0 RENDERER SET_OBJECT SCENE*<UUID>' or ['1 RENDERER SHOW', '1 RENDERER TAKE_OUT_ALL_OUT']"
    ),
    engineId: z.string().optional().describe(
      "Engine ID from config to target a specific engine. Omit to use the first enabled engine."
    ),
  },
  async ({ commands, engineId }) => {
    const engines = config.engine.filter(e => e.enabled);
    if (!engines.length) throw new Error("No enabled Viz Engines in config.");
    const engine = engineId
      ? engines.find(e => e.id === engineId) || engines[0]
      : engines[0];

    const responses = await sendToEngine(engine.host, engine.port, commands);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          engine: `${engine.name} (${engine.host}:${engine.port})`,
          sent: Array.isArray(commands) ? commands : [commands],
          responses,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "engine_list",
  "List all configured Viz Engines with their host, port, and enabled status.",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(config.engine.map(e => ({
          id: e.id, name: e.name, host: e.host, port: e.port, enabled: e.enabled,
        })), null, 2),
      }],
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// VIZ ENGINE — FRAME GRAB
// ════════════════════════════════════════════════════════════════════════════

server.tool(
  "viz_grab_frame",
  "Capture the current Viz Engine output as a PNG image and return it inline. Use this to see what is currently rendered after building or modifying a scene. Returns an image content block that the LLM can view directly. Optional inputs: engineId (which engine, defaults to first enabled), width and height (default to engine's native output resolution). Use after building/modifying scenes to verify the visual result, especially when iterating on layout, color, or text content.",
  {
    engineId: z.string().optional().describe("Engine ID from config; defaults to first enabled engine"),
    width:    z.number().optional().describe("Output width in pixels (e.g. 960 for thumbnails)"),
    height:   z.number().optional().describe("Output height in pixels"),
  },
  async ({ engineId, width, height }) => {
    const engines = config.engine.filter(e => e.enabled);
    if (!engines.length) throw new Error("No enabled Viz Engines in config.");
    const engine = engineId ? (engines.find(e => e.id === engineId) || engines[0]) : engines[0];

    // Phase 3: try the preview server first (no engine TCP round-trip)
    const ps = config.previewServer;
    if (ps?.host && ps?.port) {
      const previewPaths = ["/api/v1/snapshot", "/v1/snapshot", "/snapshot", "/api/snapshot"];
      for (const ppath of previewPaths) {
        try {
          const qs = (width && height) ? `?width=${width}&height=${height}` : "";
          const pr = await axios.get(`http://${ps.host}:${ps.port}${ppath}${qs}`, {
            responseType: "arraybuffer",
            validateStatus: s => s === 200,
            timeout: 2000,
          });
          const buf = Buffer.from(pr.data);
          if (buf.length > 100) {
            return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
          }
        } catch { /* try next endpoint */ }
      }
    }

    // Phase 2: IMAGE SNAPSHOT + IMAGE EXPORT → read PNG from disk
    const w         = width  ?? 1920;
    const h         = height ?? 1080;
    const imageSlot = "ZZ_CLEANUP/RenderPreview";
    const exportBase = "C:/Temp/RenderPreview";
    const pngFile   = "C:\\Temp\\RenderPreview.png";

    let responses;
    try {
      responses = await sendToEngine(engine.host, engine.port, [
        `IMAGE SNAPSHOT "${imageSlot}" RGBA ${w} ${h}`,
        `IMAGE EXPORT "${imageSlot}" "${exportBase}" png`,
      ], 10000);
    } catch (err) {
      throw new Error(`Engine TCP failed (${engine.host}:${engine.port}): ${err.message}`);
    }

    // Poll until Viz Engine finishes writing the file
    let buf = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        const stat = fs.statSync(pngFile);
        if (stat.size > 0) { buf = fs.readFileSync(pngFile); break; }
      } catch { /* not yet written */ }
    }

    try { fs.unlinkSync(pngFile); } catch { /* ignore */ }

    if (!buf) {
      throw new Error(
        `PNG not found after export.\n` +
        `Expected: ${pngFile}\n` +
        `Engine: ${engine.host}:${engine.port}\n` +
        `Engine responses: ${JSON.stringify(responses)}`
      );
    }

    return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
  }
);

// ── start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Vizrt MCP server running\n");
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
