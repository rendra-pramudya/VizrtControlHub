const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const axios = require("axios");
const xml2js = require("xml2js");
const net = require("net");
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

server.tool(
  "mse_trigger",
  "Trigger an automation action (take, cue, out, continue, cut, etc.) on an MSE profile. Optionally target a specific element by its editUrl.",
  {
    profile:       z.string().default("default").describe("Profile name"),
    action:        z.enum(["take", "cue", "out", "continue", "continue_reverse", "cut", "read", "update", "cleanup", "initialize", "prepare", "stop"]),
    elementEditUrl: z.string().optional().describe("Element editUrl from mse_list_elements to target a specific element"),
  },
  async ({ profile, action, elementEditUrl }) => {
    const res = await axios.post(
      `${MSE}/profiles/${encodeURIComponent(profile)}/${action}`,
      elementEditUrl || "",
      { headers: { "Content-Type": "text/plain", Accept: "application/atom+xml" }, validateStatus: s => s < 500 }
    );
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ action, profile, status: res.status, message: typeof res.data === "string" ? res.data.trim() : "" }),
      }],
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
  "List graphic templates in Viz Content Pilot, optionally filtered by conceptId.",
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

server.tool(
  "pilot_update_element",
  "Update one or more fields in a Pilot data element. Use pilot_get_element first to see available field names.",
  {
    id:     z.string().describe("Data element ID"),
    fields: z.array(z.object({ name: z.string(), value: z.string() })).describe("Fields to update"),
  },
  async ({ id, fields }) => {
    const res = await axios.get(`${PILOT}/dataelements/${id}/payload`);
    const p = await parseAtom(res.data);
    const fieldMap = Object.fromEntries(fields.map(f => [f.name, f.value]));

    function hasFoWrapper(f) {
      return !!(f.value && f.value[0] && f.value[0]["fo:wrapper"]);
    }

    p.payload.field = toArray(p.payload.field).map(f => {
      if (!(f.$.name in fieldMap)) return f;
      const newVal = fieldMap[f.$.name];
      if (hasFoWrapper(f)) {
        f.value = [{ "fo:wrapper": [{ _: newVal, $: { "xmlns:fo": "http://www.w3.org/1999/XSL/Format" } }] }];
      } else {
        f.value = [newVal];
      }
      return f;
    });

    const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "utf-8" } });
    await axios.put(`${PILOT}/dataelements/${id}/payload`, builder.buildObject(p), {
      headers: { "Content-Type": "application/vnd.vizrt.payload+xml" },
    });
    return { content: [{ type: "text", text: `Updated ${fields.length} field(s) on element ${id}.` }] };
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
