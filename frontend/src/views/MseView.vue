<template>
  <div class="mse-root">

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <select class="playlist-select" v-model="selectedPlaylistId" @change="onPlaylistChange">
          <option value="">— Select Playlist —</option>
          <option v-for="pl in store.playlists" :key="pl.storageId" :value="pl.storageId">{{ pl.name }}</option>
        </select>
      </div>

      <div class="toolbar-actions">
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('stop')" title="Stop">
          <span class="tb-icon">■</span> Stop
        </button>
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('cleanup')" title="Pause">
          <span class="tb-icon">⏸</span> Pause
        </button>
        <div class="tb-divider"></div>
        <button class="tb-btn tb-cue" :disabled="!hasSelected || triggering" @click="onTrigger('cue')" title="Cue">
          <span class="tb-icon">⬛</span> Cue
        </button>
        <button class="tb-btn tb-take" :disabled="!hasSelected || triggering" @click="onTrigger('take')" title="Take">
          <span class="tb-icon">▶</span> Take
        </button>
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('continue')" title="Continue">
          <span class="tb-icon">⏩</span> Continue
        </button>
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('out')" title="Take out">
          <span class="tb-icon">⏹</span> Take out
        </button>
        <div class="tb-divider"></div>
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('initialize')" title="Init playlist">
          <span class="tb-icon">⚙</span> Init playlist
        </button>
        <button class="tb-btn" :disabled="!hasSelected || triggering" @click="onTrigger('prepare')" title="Init selected">
          <span class="tb-icon">⚙</span> Init selected
        </button>
        <button class="tb-btn" :disabled="triggering" @click="onTrigger('cleanup')" title="CleanUp">
          <span class="tb-icon">🗑</span> CleanUp
        </button>
      </div>

      <div class="toolbar-right">
        <select class="profile-select" v-model="store.selectedProfile">
          <option v-for="p in store.profiles" :key="p.id" :value="p.id">&lt;{{ p.id }}&gt;</option>
        </select>
      </div>
    </div>

    <!-- Body: table + detail panel -->
    <div class="mse-body" ref="bodyRef">

    <!-- Table -->
    <div class="table-wrap">
      <table class="playlist-table">
        <thead>
          <tr>
            <th class="col-ind"></th>
            <th class="col-elid">Elem ID</th>
            <th class="col-desc">Description</th>
            <th class="col-tpl">Template Id</th>
            <th class="col-layer">Layer</th>
            <th class="col-ch">Channel</th>
            <th class="col-concept">Concept</th>
            <th class="col-variant">Variant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loadingElements">
            <td colspan="8" class="td-msg">Loading...</td>
          </tr>
          <tr v-else-if="!selectedPlaylistId">
            <td colspan="8" class="td-msg">Select a playlist above.</td>
          </tr>
          <tr v-else-if="!store.elements.length">
            <td colspan="8" class="td-msg">No elements in this playlist.</td>
          </tr>
          <tr
            v-for="(el, idx) in store.elements"
            :key="el.id"
            draggable="true"
            :class="{
              'row-selected': selectedElement?.id === el.id,
              'row-active': activatedElement?.id === el.id,
              'row-dragging': dragIndex === idx,
              'row-dragover': dragOverIndex === idx,
            }"
            @click="selectedElement = el"
            @dblclick="onTrigger('take')"
            @dragstart="onDragStart(idx, $event)"
            @dragover.prevent="dragOverIndex = idx"
            @dragleave="dragOverIndex = null"
            @drop.prevent="onDrop(idx)"
            @dragend="onDragEnd"
          >
            <td class="col-ind">
              <span v-if="activatedElement?.id === el.id" class="arrow-on">▶</span>
            </td>
            <td class="col-elid">{{ el.pilotElementId ? el.pilotElementId.slice(0, 8) : '—' }}</td>
            <td class="col-desc">
              <span class="el-icon">{{ el.elementType === 'viz_scene' || el.elementType === 'viz_commands' ? '🎬' : '🖼' }}</span> {{ el.name }}
            </td>
            <td class="col-tpl">{{ el.templateId ?? '—' }}</td>
            <td class="col-layer">—</td>
            <td class="col-ch">{{ el.channel ? `[${el.channel}]` : '[PROGRAM]' }}</td>
            <td class="col-concept">{{ el.concept ? `[${el.concept}]` : '—' }}</td>
            <td class="col-variant">{{ el.variant ? `[${el.variant}]` : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div><!-- /table-wrap -->

    <!-- Resize handle -->
    <div class="panel-resizer" @mousedown.prevent="onResizerMousedown"></div>

    <!-- Detail panel -->
    <div class="detail-panel" :style="{ width: panelWidth + 'px', flex: 'none' }">
      <div class="dp-title">
        Element Details
        <span v-if="selectedElement" class="dp-elname"> — {{ selectedElement.name }}</span>
      </div>

      <template v-if="!selectedElement">
        <div class="dp-empty">Select an element to view details.</div>
      </template>
      <template v-else>
        <!-- Meta -->
        <div class="dp-section-label">Info</div>
        <div class="dp-meta">
          <div class="dp-meta-row"><span class="dp-key">UUID</span><span class="dp-val mono">{{ selectedElement.id }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Pilot ID</span><span class="dp-val mono">{{ selectedElement.pilotElementId ?? '—' }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Template</span><span class="dp-val mono">{{ selectedElement.templateId ?? '—' }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Concept</span><span class="dp-val">{{ selectedElement.concept ?? '—' }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Variant</span><span class="dp-val">{{ selectedElement.variant ?? '—' }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Channel</span><span class="dp-val">{{ selectedElement.channel ?? 'PROGRAM' }}</span></div>
          <div class="dp-meta-row"><span class="dp-key">Valid</span><span class="dp-val" :class="selectedElement.valid ? 'val-ok' : 'val-no'">{{ selectedElement.valid ? 'yes' : 'no' }}</span></div>
        </div>

        <!-- Pilot fields -->
        <template v-if="selectedElement.pilotElementId">
          <div class="dp-section-label">
            Pilot Fields
            <span v-if="loadingDetail" class="dp-loading">loading…</span>
          </div>
          <div class="dp-fields">
            <div v-for="field in detailFields" :key="field.name" class="field-row">
              <label class="field-label">{{ field.name }}</label>
              <input class="field-input" v-model="field.value" />
            </div>
            <div v-if="!loadingDetail && !detailFields.length" class="dp-empty-fields">No editable fields.</div>
          </div>
          <div class="dp-actions">
            <button class="btn-save" @click="saveDetail" :disabled="savingDetail || loadingDetail">
              {{ savingDetail ? 'Saving…' : 'Save' }}
            </button>
            <span v-if="savedDetail" class="saved-msg">Saved!</span>
            <span v-if="saveDetailError" class="error-msg">{{ saveDetailError }}</span>
          </div>
        </template>

        <!-- Scene element -->
        <template v-else-if="selectedElement.elementType === 'viz_commands' || selectedElement.elementType === 'viz_scene'">
          <div class="dp-section-label">
            Scene
            <span v-if="loadingScene" class="dp-loading">loading…</span>
          </div>
          <div class="dp-meta">
            <div class="dp-meta-row">
              <span class="dp-key">Type</span>
              <span class="dp-val">{{ selectedElement.elementType === 'viz_scene' ? 'Viz Scene (VCP)' : 'Viz Commands' }}</span>
            </div>
            <div class="dp-meta-row dp-scene-path-row" v-if="sceneInfo.scenePath">
              <span class="dp-key">Path</span>
              <span class="dp-scene-path">{{ sceneInfo.scenePath }}</span>
              <button class="dp-copy-btn" :class="{ copied: copiedScene }" @click="copyScenePath" title="Copy scene path">
                {{ copiedScene ? '✓' : '⎘' }}
              </button>
            </div>
            <div class="dp-meta-row" v-else-if="!loadingScene">
              <span class="dp-key">Path</span>
              <span class="dp-val" style="color:#555; font-style:italic">
                {{ selectedElement.elementType === 'viz_scene' ? 'Not accessible via REST' : '—' }}
              </span>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="dp-empty">No Pilot data element linked.</div>
        </template>

        <!-- Preview -->
        <div class="dp-section-label">
          Preview
          <button class="dp-refresh-btn" @click="doRefreshPreview" :disabled="previewImgLoading" title="Refresh preview">↻</button>
          <span v-if="previewImgLoading" class="dp-loading">loading…</span>
        </div>
        <div class="dp-preview-wrap">
          <img
            v-if="previewSrc"
            :src="previewSrc"
            class="dp-preview-img"
            :class="{ 'dp-preview-hidden': previewImgLoading }"
            alt="Preview"
            @load="previewImgLoading = false; previewImgError = false"
            @error="previewImgLoading = false; previewImgError = true"
          />
          <div v-if="previewImgError" class="dp-preview-msg dp-preview-err">Preview unavailable</div>
          <div v-else-if="!previewSrc" class="dp-preview-msg">No preview available</div>
        </div>
      </template>
    </div><!-- /detail-panel -->

    </div><!-- /mse-body -->

    <!-- Feedback bar -->
    <div v-if="triggerMsg" class="feedback-bar" :class="triggerMsgOk ? 'ok' : 'err'">
      {{ triggerMsg }}
    </div>

    <!-- Status bar -->
    <div class="status-bar">
      <span class="status-section">
        <span class="dot live"></span>
        <span v-if="!channelLayers.length" class="no-state">No channel state</span>
        <span v-for="(state, layer) in channelLayers" :key="layer" class="layer-chip" :class="stateClass(state)">
          {{ layer }}: {{ state }}
        </span>
      </span>
      <span class="status-divider" v-if="channelLayers.length && store.liveEvents.length">|</span>
      <span class="events-section">
        <span v-for="(ev, i) in store.liveEvents.slice(0, 5)" :key="i" class="ev-chip">
          {{ ev.timestamp?.slice(11,19) }} <b>{{ ev.action }}</b>
        </span>
      </span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onActivated, onDeactivated } from "vue";
import { storeToRefs } from "pinia";
import { useMseStore } from "../stores/useMseStore";
import { api } from "../services/api";

const store = useMseStore();
const { selectedProfile } = storeToRefs(store);

const bodyRef = ref(null);
const panelWidth = ref(400); // will be updated to 50% on mount

function onResizerMousedown(e) {
  const startX = e.clientX;
  const startWidth = panelWidth.value;

  function onMousemove(ev) {
    const dx = startX - ev.clientX;
    const bodyW = bodyRef.value?.offsetWidth ?? 800;
    panelWidth.value = Math.max(200, Math.min(bodyW - 200, startWidth + dx));
  }

  function onMouseup() {
    document.removeEventListener("mousemove", onMousemove);
    document.removeEventListener("mouseup", onMouseup);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  document.addEventListener("mousemove", onMousemove);
  document.addEventListener("mouseup", onMouseup);
}

const selectedPlaylistId = ref("");
const selectedElement = ref(null);
const activatedElement = ref(null);
const loadingElements = ref(false);
const triggering = ref(false);
const moving = ref(false);
const dragIndex = ref(null);
const dragOverIndex = ref(null);
const triggerMsg = ref("");
const triggerMsgOk = ref(true);

// Detail panel
const detailFields = ref([]);
const loadingDetail = ref(false);
const savingDetail = ref(false);
const savedDetail = ref(false);
const saveDetailError = ref("");

const sceneInfo = ref({ elementType: null, scenePath: null });
const loadingScene = ref(false);
const copiedScene = ref(false);
let copiedSceneTimer = null;

const previewSrc = ref(null);
const previewImgLoading = ref(false);
const previewImgError = ref(false);

function buildPreviewSrc(el, resolvedScenePath = null) {
  const t = Date.now();
  if (el.contentSrc) {
    return `/api/mse/preview?payloadUrl=${encodeURIComponent(el.contentSrc)}&width=320&height=180&_t=${t}`;
  }
  if (resolvedScenePath) {
    return `/api/mse/preview?scenePath=${encodeURIComponent(resolvedScenePath)}&width=320&height=180&_t=${t}`;
  }
  return null;
}

function doRefreshPreview() {
  const el = selectedElement.value;
  if (!el) return;
  const src = buildPreviewSrc(el, sceneInfo.value.scenePath);
  if (!src) return;
  previewImgLoading.value = true;
  previewImgError.value = false;
  previewSrc.value = src;
}

function copyScenePath() {
  if (!sceneInfo.value.scenePath) return;
  navigator.clipboard.writeText(sceneInfo.value.scenePath).catch(() => {});
  copiedScene.value = true;
  if (copiedSceneTimer) clearTimeout(copiedSceneTimer);
  copiedSceneTimer = setTimeout(() => { copiedScene.value = false; }, 1500);
}

watch(selectedElement, async (el) => {
  detailFields.value = [];
  sceneInfo.value = { elementType: null, scenePath: null };
  savedDetail.value = false;
  saveDetailError.value = "";
  previewSrc.value = null;
  previewImgLoading.value = false;
  previewImgError.value = false;
  if (!el) return;

  if (el.pilotElementId) {
    loadingDetail.value = true;
    try {
      const data = await api.get(`/pilot/data-elements/${el.pilotElementId}`);
      detailFields.value = data.fields.map((f) => ({ ...f }));
    } catch {
      detailFields.value = [];
    } finally {
      loadingDetail.value = false;
    }
    // Pilot: preview via contentSrc payload URL
    const src = buildPreviewSrc(el);
    if (src) { previewImgLoading.value = true; previewSrc.value = src; }
  } else if (el.editUrl && (el.elementType === "viz_commands" || el.elementType === "viz_scene")) {
    loadingScene.value = true;
    try {
      const data = await api.get(`/mse/element/content?editUrl=${encodeURIComponent(el.editUrl)}`);
      sceneInfo.value = data;
      // Scene: preview via scenePath if resolved
      const src = buildPreviewSrc(el, data.scenePath);
      if (src) { previewImgLoading.value = true; previewSrc.value = src; }
    } catch {
      sceneInfo.value = { elementType: el.elementType, scenePath: null };
    } finally {
      loadingScene.value = false;
    }
  }
});

const hasSelected = computed(() => !!selectedElement.value);

const channelLayers = computed(() => {
  const ch = store.channelState[0];
  return ch?.layers ?? {};
});

function stateClass(state) {
  if (state === "IN") return "s-in";
  if (state === "O" || state === "OUT") return "s-out";
  if (state === "LOWER") return "s-lower";
  return "s-other";
}

onMounted(async () => {
  if (bodyRef.value) panelWidth.value = Math.round(bodyRef.value.offsetWidth * 0.5);

  await Promise.all([
    store.fetchPlaylists().catch(() => {}),
    store.fetchProfiles().catch(() => {}),
  ]);
  // Restore selection if store already has one (e.g. returning to tab)
  if (store.selectedPlaylist && !selectedPlaylistId.value) {
    selectedPlaylistId.value = store.selectedPlaylist.storageId;
  }
  store.connectLive();
  store.startStatePolling(3000);
});

onActivated(() => {
  store.connectLive();
  store.startStatePolling(3000);
});

onDeactivated(() => store.disconnectLive());

async function onPlaylistChange() {
  selectedElement.value = null;
  activatedElement.value = null;
  if (!selectedPlaylistId.value) { return; }
  loadingElements.value = true;
  await store.selectPlaylist(selectedPlaylistId.value).catch(() => {});
  loadingElements.value = false;
}

function onDragStart(idx, evt) {
  dragIndex.value = idx;
  evt.dataTransfer.effectAllowed = "move";
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

async function onDrop(toIdx) {
  const fromIdx = dragIndex.value;
  onDragEnd();
  if (fromIdx === null || fromIdx === toIdx) return;
  const el = store.elements[fromIdx];
  if (!el?.editUrl) return;
  moving.value = true;
  try {
    await store.moveElement(el.editUrl, toIdx);
  } catch (e) {
    triggerMsg.value = `Move failed: ${e.message}`;
    triggerMsgOk.value = false;
    setTimeout(() => (triggerMsg.value = ""), 4000);
  } finally {
    moving.value = false;
  }
}

async function saveDetail() {
  if (!selectedElement.value?.pilotElementId) return;
  savingDetail.value = true;
  savedDetail.value = false;
  saveDetailError.value = "";
  const prevId = selectedElement.value.id;
  try {
    await api.put(`/pilot/data-elements/${selectedElement.value.pilotElementId}`, { fields: detailFields.value });
    await store.selectPlaylist(selectedPlaylistId.value);
    selectedElement.value = store.elements.find((e) => e.id === prevId) ?? null;
    savedDetail.value = true;
    setTimeout(() => (savedDetail.value = false), 2500);
  } catch (e) {
    saveDetailError.value = e.message;
  } finally {
    savingDetail.value = false;
  }
}

async function onTrigger(action) {
  triggering.value = true;
  triggerMsg.value = "";
  try {
    const elementEditUrl = selectedElement.value?.editUrl ?? null;
    const result = await store.triggerAction(action, elementEditUrl);
    triggerMsg.value = result.message || `${action} OK`;
    triggerMsgOk.value = result.success !== false;
    if (action === "take" && selectedElement.value) {
      activatedElement.value = selectedElement.value;
    }
    await store.fetchProfileState();
  } catch (e) {
    triggerMsg.value = e.message;
    triggerMsgOk.value = false;
  } finally {
    triggering.value = false;
    setTimeout(() => (triggerMsg.value = ""), 3000);
  }
}
</script>

<style scoped>
.mse-root { display: flex; flex-direction: column; height: calc(100vh - 60px); background: #0d0d1a; overflow: hidden; }

/* Toolbar */
.toolbar {
  display: flex; align-items: center; gap: 0.5rem;
  background: #1a1a2e; border-bottom: 1px solid #2a2a3e;
  padding: 0.35rem 0.75rem; flex-shrink: 0;
}
.toolbar-left { flex-shrink: 0; }
.toolbar-actions { display: flex; align-items: center; gap: 2px; flex: 1; flex-wrap: nowrap; overflow-x: auto; }
.toolbar-right { flex-shrink: 0; margin-left: auto; }

.playlist-select, .profile-select {
  background: #111122; color: #ccc; border: 1px solid #333;
  padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.82rem;
}
.playlist-select { min-width: 180px; }
.profile-select { min-width: 100px; }

.tb-btn {
  display: flex; align-items: center; gap: 0.25rem;
  background: #222235; color: #ccc; border: 1px solid #333;
  padding: 0.25rem 0.55rem; border-radius: 3px;
  font-size: 0.75rem; cursor: pointer; white-space: nowrap;
  transition: background 0.1s;
}
.tb-btn:hover:not(:disabled) { background: #2c2c45; border-color: #555; }
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-btn.tb-take { background: #1e3a1e; border-color: #2e6a2e; color: #7eca7e; font-weight: bold; }
.tb-btn.tb-take:hover:not(:disabled) { background: #245924; }
.tb-btn.tb-cue { background: #1e2e4a; border-color: #2a4a8a; }
.tb-icon { font-size: 0.7rem; }
.tb-divider { width: 1px; height: 22px; background: #333; margin: 0 3px; flex-shrink: 0; }

/* Feedback */
.feedback-bar { padding: 0.2rem 0.75rem; font-size: 0.8rem; flex-shrink: 0; }
.feedback-bar.ok { background: #0e2b0e; color: #4caf50; border-bottom: 1px solid #1a4a1a; }
.feedback-bar.err { background: #2b0e0e; color: #f44336; border-bottom: 1px solid #4a1a1a; }

/* Body */
.mse-body { display: flex; flex: 1; overflow: hidden; }

/* Resize handle */
.panel-resizer {
  width: 4px; flex-shrink: 0; cursor: col-resize;
  background: #1e1e30;
  transition: background 0.15s;
}
.panel-resizer:hover { background: #2a5caa; }

/* Table */
.table-wrap { flex: 1; min-width: 0; overflow-y: auto; }
.playlist-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.playlist-table thead { position: sticky; top: 0; z-index: 1; }
.playlist-table th {
  background: #1a1a2e; color: #888; font-weight: normal;
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 0.35rem 0.6rem; text-align: left;
  border-bottom: 1px solid #2a2a3e; border-right: 1px solid #1e1e30;
  white-space: nowrap;
}
.playlist-table td {
  padding: 0.3rem 0.6rem; border-bottom: 1px solid #161626;
  border-right: 1px solid #161626; color: #ccc; vertical-align: middle;
}
.playlist-table tr:hover td { background: #181828; }
.playlist-table tr.row-selected td { background: #1e3055; }
.playlist-table tr.row-active td { background: #1a2e1a; }
.playlist-table tr.row-selected.row-active td { background: #1e3055; }

.col-ind { width: 24px; text-align: center; padding: 0 0.25rem; }
.col-elid { width: 68px; font-family: monospace; font-size: 0.78rem; color: #7ec8e3; }

.playlist-table tbody tr { cursor: grab; }
.playlist-table tbody tr:active { cursor: grabbing; }
.playlist-table tr.row-dragging td { opacity: 0.35; background: #0d0d1a !important; }
.playlist-table tr.row-dragover td { border-top: 2px solid #7ec8e3; }
.col-tpl { width: 110px; color: #7ec8e3; }
.col-layer { width: 110px; }
.col-ch { width: 100px; }
.col-concept { width: 120px; }
.col-variant { width: 100px; }

.arrow-on { color: #4caf50; font-size: 0.7rem; }
.el-icon { font-size: 0.7rem; margin-right: 0.25rem; opacity: 0.5; }
.td-msg { text-align: center; color: #555; font-style: italic; padding: 1rem; }

/* Detail panel */
.detail-panel {
  min-width: 200px;
  display: flex; flex-direction: column;
  background: #161625; border-left: 1px solid #2a2a3e;
  overflow-y: auto;
}
.dp-title {
  padding: 0.6rem 0.9rem; background: #1a1a2e;
  font-size: 0.8rem; font-weight: bold; text-transform: uppercase;
  letter-spacing: 0.05em; color: #aaa; border-bottom: 1px solid #2a2a3e;
  flex-shrink: 0; position: sticky; top: 0; z-index: 1;
}
.dp-elname { text-transform: none; font-weight: normal; color: #7ec8e3; }
.dp-section-label {
  padding: 0.35rem 0.9rem; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: #555; background: #111120;
  border-bottom: 1px solid #1e1e30; border-top: 1px solid #1e1e30;
  display: flex; align-items: center; gap: 0.5rem;
}
.dp-loading { font-size: 0.7rem; color: #444; font-style: italic; text-transform: none; }
.dp-empty { padding: 0.75rem 0.9rem; color: #555; font-style: italic; font-size: 0.82rem; }
.dp-empty-fields { padding: 0.5rem 0.9rem; color: #444; font-style: italic; font-size: 0.8rem; }

.dp-meta { flex-shrink: 0; }
.dp-meta-row { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.3rem 0.9rem; border-bottom: 1px solid #1a1a28; }
.dp-key { width: 68px; min-width: 68px; font-size: 0.72rem; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
.dp-val { font-size: 0.82rem; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-val.mono { font-family: monospace; font-size: 0.78rem; color: #7ec8e3; }
.val-ok { color: #4caf50 !important; }
.val-no { color: #f44336 !important; }

.dp-fields { flex: 1; overflow-y: auto; }
.field-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.9rem; border-bottom: 1px solid #1a1a28; }
.field-label { width: 120px; min-width: 120px; font-size: 0.78rem; color: #888; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-input { flex: 1; background: #1e1e2e; color: #eee; border: 1px solid #333; padding: 0.28rem 0.45rem; border-radius: 4px; font-size: 0.83rem; min-width: 0; }
.field-input:focus { outline: none; border-color: #2a5caa; }

.dp-scene-path-row { align-items: flex-start; gap: 0.4rem; }
.dp-scene-path {
  font-family: monospace; font-size: 0.78rem; color: #c8e6ff;
  word-break: break-all; flex: 1; line-height: 1.45;
}
.dp-copy-btn {
  flex-shrink: 0; background: #1a1a2e; border: 1px solid #2a2a40;
  color: #666; width: 20px; height: 20px; border-radius: 3px;
  cursor: pointer; font-size: 0.72rem; display: flex; align-items: center; justify-content: center;
  margin-top: 0.05rem;
}
.dp-copy-btn:hover { color: #aaa; border-color: #444; }
.dp-copy-btn.copied { color: #4caf50; border-color: #2e7d32; }

.dp-actions { padding: 0.65rem 0.9rem; display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; border-top: 1px solid #2a2a3e; background: #13131f; }
.btn-save { background: #2a5caa; color: #fff; border: none; padding: 0.35rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.83rem; }
.btn-save:hover:not(:disabled) { background: #3468c0; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.saved-msg { color: #4caf50; font-size: 0.8rem; }
.error-msg { color: #f44336; font-size: 0.78rem; word-break: break-word; }

/* Preview */
.dp-refresh-btn {
  background: none; border: 1px solid #2a2a3e; color: #555;
  cursor: pointer; font-size: 0.85rem; line-height: 1;
  padding: 0 0.3rem; border-radius: 3px; margin-left: auto;
  transition: color 0.15s, border-color 0.15s;
}
.dp-refresh-btn:hover:not(:disabled) { color: #aaa; border-color: #444; }
.dp-refresh-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.dp-preview-wrap {
  padding: 0.6rem 0.9rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
}
.dp-preview-img {
  width: 100%; max-width: 320px; height: auto;
  border-radius: 4px; border: 1px solid #2a2a3e;
  display: block; background: #0d0d1a;
}
.dp-preview-hidden { opacity: 0; }
.dp-preview-msg { font-size: 0.78rem; color: #555; font-style: italic; }
.dp-preview-err { color: #c62828; }

/* Status bar */
.status-bar {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  background: #0e0e1a; border-top: 1px solid #1e1e30;
  padding: 0.25rem 0.75rem; flex-shrink: 0; min-height: 28px;
}
.dot.live {
  width: 6px; height: 6px; border-radius: 50%; background: #4caf50;
  display: inline-block; flex-shrink: 0;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
.status-section { display: flex; align-items: center; gap: 0.4rem; }
.layer-chip { font-size: 0.72rem; font-family: monospace; padding: 0.1rem 0.35rem; border-radius: 3px; background: #1a1a2e; }
.s-in    { color: #4caf50; background: #0d2a0d; }
.s-out   { color: #555; }
.s-lower { color: #ff9800; background: #2a1a00; }
.s-other { color: #7ec8e3; }
.no-state { font-size: 0.72rem; color: #444; }
.status-divider { color: #333; font-size: 0.8rem; }
.events-section { display: flex; gap: 0.75rem; overflow: hidden; }
.ev-chip { font-size: 0.72rem; font-family: monospace; color: #555; white-space: nowrap; }
.ev-chip b { color: #7ec8e3; }
</style>
