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
    <div class="panel field-panel">
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

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { usePilotStore } from "../stores/usePilotStore";

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

// --- Resizable panels ---
const layoutRef = ref(null);
const widths = ref([220, 220]);

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
  await store.fetchConcepts().catch(() => {});
  await store.changeConcept(null).catch(() => {});
  loadingConcept.value = false;
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

.field-panel {
  flex: 1;
  flex-shrink: 1;
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
</style>
