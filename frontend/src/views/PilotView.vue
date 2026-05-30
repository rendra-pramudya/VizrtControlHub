<template>
  <div class="pilot-layout" ref="layoutRef">

    <!-- Panel 1: Templates -->
    <div class="panel" :style="{ width: widths[0] + 'px' }">
      <div class="panel-title">Templates</div>
      <div class="concept-filter">
        <select v-model="selectedConceptId" @change="onConceptChange">
          <option value="">All Concepts</option>
          <option v-for="c in concepts" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="panel-scroll">
        <div v-if="loadingConcept" class="empty">Loading...</div>
        <div v-else-if="!templates.length" class="empty">No templates.</div>
        <div
          v-for="t in templates"
          :key="t.id"
          class="list-item"
          :class="{ active: selectedTemplate === t.id }"
          @click="onSelectTemplate(t.id)"
        >
          <div class="item-name">{{ t.name }}</div>
          <div class="item-sub">ID: {{ t.id }}</div>
        </div>
      </div>
    </div>

    <div class="resizer" @mousedown.prevent="startResize(0, $event)"></div>

    <!-- Panel 2: Data Elements -->
    <div class="panel" :style="{ width: widths[1] + 'px' }">
      <div class="panel-title">Data Elements</div>
      <div class="search-box">
        <input v-model="searchQuery" placeholder="Search by name..." />
      </div>
      <div class="panel-scroll">
        <div v-if="loadingElements" class="empty">Loading...</div>
        <div v-else-if="!filteredElements.length" class="empty">No elements found.</div>
        <div
          v-for="el in filteredElements"
          :key="el.id"
          class="list-item"
          :class="{ active: selectedElement?.id === el.id }"
          @click="onSelectElement(el.id)"
        >
          <div class="item-name">{{ el.name }}</div>
          <div class="item-sub">ID: {{ el.id }}</div>
        </div>
      </div>
    </div>

    <div class="resizer" @mousedown.prevent="startResize(1, $event)"></div>

    <!-- Panel 3: Field Editor -->
    <div class="panel" :style="{ width: widths[2] + 'px' }">
      <div class="panel-title">
        Fields<span v-if="selectedElement" class="el-name"> — {{ elementName }}</span>
      </div>
      <template v-if="!selectedElement">
        <div class="empty">Select a data element.</div>
      </template>
      <template v-else-if="loadingElement">
        <div class="empty">Loading...</div>
      </template>
      <template v-else>
        <div class="panel-scroll">
          <div v-for="field in editableFields" :key="field.name" class="field-row">
            <label class="field-label">{{ field.name }}</label>
            <input class="field-input" v-model="field.value" />
          </div>
        </div>
        <div class="actions">
          <button @click="save" :disabled="saving">{{ saving ? "Saving..." : "Save" }}</button>
          <span v-if="saved" class="saved-msg">Saved!</span>
          <span v-if="saveError" class="error-msg">{{ saveError }}</span>
        </div>
      </template>
    </div>

    <div class="resizer" @mousedown.prevent="startResize(2, $event)"></div>

    <!-- Panel 4: MSE Playlist -->
    <div class="panel mse-panel">
      <div class="panel-title">MSE Playlist</div>

      <!-- Selectors -->
      <div class="mse-selectors">
        <select class="mse-select" v-model="msePlaylistId" @change="onMsePlaylistChange">
          <option value="">— Select Playlist —</option>
          <option v-for="pl in mseStore.playlists" :key="pl.storageId" :value="pl.storageId">
            {{ pl.name }}
          </option>
        </select>
        <select class="mse-profile" v-model="mseStore.selectedProfile">
          <option v-for="p in mseStore.profiles" :key="p.id" :value="p.id">&lt;{{ p.id }}&gt;</option>
        </select>
      </div>

      <!-- Action buttons -->
      <div class="mse-actions">
        <button class="mse-btn" :disabled="mseTriggering" @click="mseTrigger('stop')" title="Stop">■ Stop</button>
        <button class="mse-btn" :disabled="mseTriggering" @click="mseTrigger('cleanup')" title="Cleanup">⏸ Cleanup</button>
        <button class="mse-btn mse-btn-cue" :disabled="!mseSelectedEl || mseTriggering" @click="mseTrigger('cue')" title="Cue">⬛ Cue</button>
        <button class="mse-btn mse-btn-take" :disabled="!mseSelectedEl || mseTriggering" @click="mseTrigger('take')" title="Take">▶ Take</button>
        <button class="mse-btn" :disabled="mseTriggering" @click="mseTrigger('continue')" title="Continue">⏩ Cont</button>
        <button class="mse-btn" :disabled="mseTriggering" @click="mseTrigger('out')" title="Take out">⏹ Out</button>
      </div>

      <!-- Feedback -->
      <div v-if="mseTriggerMsg" class="mse-feedback" :class="mseTriggerOk ? 'ok' : 'err'">
        {{ mseTriggerMsg }}
      </div>

      <!-- Elements list -->
      <div class="panel-scroll">
        <div v-if="mseLoadingEl" class="empty">Loading...</div>
        <div v-else-if="!msePlaylistId" class="empty">Select a playlist.</div>
        <div v-else-if="!mseStore.elements.length" class="empty">No elements.</div>
        <div
          v-for="el in mseStore.elements"
          :key="el.id"
          class="list-item mse-el-item"
          :class="{
            active: mseSelectedEl?.id === el.id,
            activated: mseActivatedEl?.id === el.id,
          }"
          @click="mseSelectedEl = el"
          @dblclick="mseTrigger('take')"
        >
          <span class="mse-arrow" v-if="mseActivatedEl?.id === el.id">▶</span>
          <span class="mse-el-icon">{{ el.elementType === 'viz_scene' || el.elementType === 'viz_commands' ? '🎬' : '🖼' }}</span>
          <span class="mse-el-name">{{ el.name }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePilotStore } from "../stores/usePilotStore";
import { useMseStore } from "../stores/useMseStore";

// --- Pilot store ---
const store = usePilotStore();
const { concepts, templates, dataElements, selectedTemplate, selectedElement } = storeToRefs(store);

const selectedConceptId = ref("");
const searchQuery = ref("");
const loadingConcept = ref(false);
const loadingElements = ref(false);
const loadingElement = ref(false);
const saving = ref(false);
const saved = ref(false);
const saveError = ref("");
const editableFields = ref([]);

const elementName = computed(() => {
  if (!selectedElement.value) return "";
  return dataElements.value.find((e) => e.id === selectedElement.value.id)?.name
    || selectedElement.value.id;
});

const filteredElements = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return dataElements.value;
  return dataElements.value.filter((e) => e.name.toLowerCase().includes(q));
});

// --- MSE panel ---
const mseStore = useMseStore();
const msePlaylistId = ref("");
const mseSelectedEl = ref(null);
const mseActivatedEl = ref(null);
const mseTriggering = ref(false);
const mseLoadingEl = ref(false);
const mseTriggerMsg = ref("");
const mseTriggerOk = ref(true);

async function onMsePlaylistChange() {
  mseSelectedEl.value = null;
  mseActivatedEl.value = null;
  if (!msePlaylistId.value) return;
  mseLoadingEl.value = true;
  await mseStore.selectPlaylist(msePlaylistId.value).catch(() => {});
  mseLoadingEl.value = false;
}

async function mseTrigger(action) {
  mseTriggering.value = true;
  mseTriggerMsg.value = "";
  try {
    const elementEditUrl = mseSelectedEl.value?.editUrl ?? null;
    const result = await mseStore.triggerAction(action, elementEditUrl);
    mseTriggerMsg.value = result.message || `${action} OK`;
    mseTriggerOk.value = result.success !== false;
    if (action === "take" && mseSelectedEl.value) {
      mseActivatedEl.value = mseSelectedEl.value;
    }
    await mseStore.fetchProfileState();
  } catch (e) {
    mseTriggerMsg.value = e.message;
    mseTriggerOk.value = false;
  } finally {
    mseTriggering.value = false;
    setTimeout(() => (mseTriggerMsg.value = ""), 3000);
  }
}

// --- Resizable panels ---
const layoutRef = ref(null);
const widths = ref([220, 220, 280]);

function startResize(index, e) {
  const startX = e.clientX;
  const startWidth = widths.value[index];

  function onMousemove(ev) {
    widths.value[index] = Math.max(150, startWidth + (ev.clientX - startX));
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

// --- Lifecycle ---
onMounted(async () => {
  loadingConcept.value = true;
  await Promise.all([
    store.fetchConcepts().catch(() => {}),
    mseStore.fetchPlaylists().catch(() => {}),
    mseStore.fetchProfiles().catch(() => {}),
  ]);
  await store.changeConcept(null).catch(() => {});
  loadingConcept.value = false;

  // Restore MSE playlist if store already has one
  if (mseStore.selectedPlaylist && !msePlaylistId.value) {
    msePlaylistId.value = mseStore.selectedPlaylist.storageId;
  }
});

async function onConceptChange() {
  searchQuery.value = "";
  editableFields.value = [];
  loadingConcept.value = true;
  loadingElements.value = true;
  await store.changeConcept(selectedConceptId.value || null).catch(() => {});
  loadingConcept.value = false;
  loadingElements.value = false;
}

async function onSelectTemplate(id) {
  searchQuery.value = "";
  editableFields.value = [];
  loadingElements.value = true;
  await store.selectTemplate(id).catch(() => {});
  loadingElements.value = false;
}

async function onSelectElement(id) {
  loadingElement.value = true;
  saved.value = false;
  saveError.value = "";
  await store.fetchDataElement(id).catch(() => {});
  editableFields.value = selectedElement.value?.fields.map((f) => ({ ...f })) || [];
  loadingElement.value = false;
}

async function save() {
  if (!selectedElement.value) return;
  saving.value = true;
  saved.value = false;
  saveError.value = "";
  try {
    await store.updateDataElement(selectedElement.value.id, editableFields.value);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.pilot-layout {
  display: flex;
  height: calc(100vh - 80px);
  background: #0d0d1a;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 150px;
  flex-shrink: 0;
  background: #161625;
  border-right: 1px solid #2a2a3e;
  overflow: hidden;
}

.mse-panel {
  flex: 1;
  flex-shrink: 1;
  min-width: 200px;
  border-right: none;
}

.resizer {
  width: 4px;
  flex-shrink: 0;
  cursor: col-resize;
  background: #1a1a2e;
  transition: background 0.15s;
  z-index: 1;
}
.resizer:hover { background: #2a5caa; }

.panel-title {
  padding: 0.6rem 0.9rem;
  background: #1a1a2e;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #aaa;
  border-bottom: 1px solid #2a2a3e;
  flex-shrink: 0;
}
.el-name { text-transform: none; font-weight: normal; color: #7ec8e3; }

.concept-filter {
  padding: 0.5rem 0.9rem;
  border-bottom: 1px solid #2a2a3e;
  background: #13131f;
  flex-shrink: 0;
}
.concept-filter select {
  width: 100%;
  background: #1e1e1e;
  color: #eee;
  border: 1px solid #444;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.82rem;
}

.search-box {
  padding: 0.5rem 0.9rem;
  border-bottom: 1px solid #2a2a3e;
  background: #13131f;
  flex-shrink: 0;
}
.search-box input {
  width: 100%;
  background: #1e1e1e;
  color: #eee;
  border: 1px solid #444;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.82rem;
}
.search-box input:focus { outline: none; border-color: #2a5caa; }

.panel-scroll { overflow-y: auto; flex: 1; }

.list-item { padding: 0.55rem 0.9rem; cursor: pointer; border-bottom: 1px solid #1e1e30; }
.list-item:hover { background: #1e1e35; }
.list-item.active { background: #1e3055; border-left: 2px solid #2a5caa; }

.item-name { font-size: 0.88rem; }
.item-sub { font-size: 0.7rem; color: #666; margin-top: 0.1rem; }

.field-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.9rem; border-bottom: 1px solid #1e1e30; }
.field-label { width: 140px; min-width: 140px; font-size: 0.8rem; color: #888; font-family: monospace; }
.field-input { flex: 1; background: #1e1e1e; color: #eee; border: 1px solid #333; padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.85rem; min-width: 0; }
.field-input:focus { outline: none; border-color: #2a5caa; }

.actions { padding: 0.75rem 0.9rem; display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; border-top: 1px solid #2a2a3e; }
button { background: #2a5caa; color: #fff; border: none; padding: 0.4rem 1.1rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.saved-msg { color: #4caf50; font-size: 0.82rem; }
.error-msg { color: #f44336; font-size: 0.82rem; }
.empty { padding: 0.75rem 0.9rem; color: #555; font-style: italic; font-size: 0.85rem; }

/* MSE panel */
.mse-selectors {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-bottom: 1px solid #2a2a3e;
  background: #13131f;
  flex-shrink: 0;
}
.mse-select {
  flex: 1;
  background: #1e1e1e;
  color: #eee;
  border: 1px solid #444;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.82rem;
  min-width: 0;
}
.mse-profile {
  background: #1e1e1e;
  color: #eee;
  border: 1px solid #444;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  font-size: 0.82rem;
  flex-shrink: 0;
}

.mse-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0.4rem 0.9rem;
  border-bottom: 1px solid #2a2a3e;
  background: #111120;
  flex-shrink: 0;
}
.mse-btn {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: #222235;
  color: #ccc;
  border: 1px solid #333;
  padding: 0.22rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s;
}
.mse-btn:hover:not(:disabled) { background: #2c2c45; border-color: #555; }
.mse-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.mse-btn-take { background: #1e3a1e; border-color: #2e6a2e; color: #7eca7e; font-weight: bold; }
.mse-btn-take:hover:not(:disabled) { background: #245924; }
.mse-btn-cue { background: #1e2e4a; border-color: #2a4a8a; }

.mse-feedback {
  padding: 0.2rem 0.9rem;
  font-size: 0.78rem;
  flex-shrink: 0;
}
.mse-feedback.ok { background: #0e2b0e; color: #4caf50; border-bottom: 1px solid #1a4a1a; }
.mse-feedback.err { background: #2b0e0e; color: #f44336; border-bottom: 1px solid #4a1a1a; }

.mse-el-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.mse-el-item.activated { background: #1a2e1a; }
.mse-el-item.active { background: #1e3055; border-left: 2px solid #2a5caa; }
.mse-el-item.activated.active { background: #1e3055; }
.mse-arrow { color: #4caf50; font-size: 0.7rem; width: 10px; flex-shrink: 0; }
.mse-el-icon { font-size: 0.7rem; opacity: 0.5; flex-shrink: 0; }
.mse-el-name { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
