<template>
  <div class="hub-root">

    <!-- Address bar -->
    <div class="address-bar">
      <button class="up-btn" :disabled="!store.currentFolder?.uuid" @click="store.navigateUp()" title="Up">
        ↑
      </button>
      <div class="breadcrumbs">
        <span class="crumb root" @click="store.navigateTo(null)">Graphics Hub</span>
        <template v-for="(crumb, i) in store.breadcrumbs" :key="crumb.uuid">
          <span class="sep">›</span>
          <span
            class="crumb"
            :class="{ last: i === store.breadcrumbs.length - 1 }"
            @click="i < store.breadcrumbs.length - 1 && store.navigateTo(crumb.uuid)"
          >{{ crumb.name }}</span>
        </template>
      </div>
      <select class="filter-select" v-model="filterType">
        <option value="ALL">All types</option>
        <option value="Scene">Scene</option>
        <option value="Geometry">Geometry</option>
        <option value="Image">Image</option>
        <option value="Fonts">Fonts</option>
        <option value="Audio">Audio</option>
        <option value="Material">Material</option>
      </select>
      <div class="item-count" v-if="!store.loadingContent">
        {{ totalItems }} item{{ totalItems !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Main area -->
    <div class="explorer">

      <!-- Left: folder tree -->
      <div class="tree-panel">
        <div class="tree-header">Folders</div>
        <div class="tree-scroll">
          <FolderTreeNode
            v-for="f in rootFolders"
            :key="f.uuid"
            :folder="f"
            :selected-uuid="store.currentFolder?.uuid"
            @select="store.navigateTo($event)"
          />
        </div>
      </div>

      <!-- Center: content table -->
      <div class="content-panel">
        <div v-if="store.loadingContent" class="loading-row">Loading...</div>
        <template v-else>
          <table class="content-table">
            <thead>
              <tr>
                <th class="col-icon"></th>
                <th class="col-name">Name</th>
                <th class="col-type">Type</th>
                <th class="col-date">Modified</th>
                <th class="col-owner">Owner</th>
              </tr>
            </thead>
            <tbody>
              <!-- Subfolders -->
              <tr
                v-for="f in store.folders"
                :key="f.uuid"
                class="row-folder"
                :class="{ selected: selectedItem?.uuid === f.uuid }"
                @click="selectedItem = f"
                @dblclick="store.navigateTo(f.uuid)"
              >
                <td class="col-icon"><span class="icon">{{ folderIcon(f.type) }}</span></td>
                <td class="col-name">{{ f.name }}</td>
                <td class="col-type">{{ typeLabel(f.type) }}</td>
                <td class="col-date">{{ fmtDate(f.updated) }}</td>
                <td class="col-owner">—</td>
              </tr>
              <!-- Files -->
              <tr
                v-for="file in filteredFiles"
                :key="file.uuid"
                class="row-file"
                :class="{ selected: selectedItem?.uuid === file.uuid }"
                @click="selectedItem = file"
                @contextmenu.prevent="showContextMenu($event, file)"
              >
                <td class="col-icon">
                  <img
                    v-if="file.thumbnailUrl"
                    :src="`/api/hub/thumbnail/${file.uuid}`"
                    class="thumb"
                    loading="lazy"
                    :alt="file.name"
                  />
                  <span v-else class="icon">{{ fileIcon(file.type) }}</span>
                </td>
                <td class="col-name">{{ file.name }}</td>
                <td class="col-type">{{ typeLabel(file.type) }}</td>
                <td class="col-date">{{ fmtDate(file.updated) }}</td>
                <td class="col-owner">{{ file.owner || '—' }}</td>
              </tr>
              <!-- Empty state -->
              <tr v-if="!store.folders.length && !filteredFiles.length">
                <td colspan="5" class="empty-row">This folder is empty.</td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>

      <!-- Right: detail panel -->
      <div class="detail-panel" :class="{ 'detail-panel--visible': !!selectedItem }">
        <template v-if="selectedItem">
          <div class="dp-header">
            <span class="dp-type-badge">{{ typeLabel(selectedItem.type) }}</span>
            <span class="dp-name" :title="selectedItem.name">{{ selectedItem.name }}</span>
          </div>

          <!-- Thumbnail -->
          <div class="dp-thumb-wrap">
            <img
              v-if="selectedItem.thumbnailUrl"
              :src="`/api/hub/thumbnail/${selectedItem.uuid}`"
              class="dp-thumb"
              :alt="selectedItem.name"
            />
            <div v-else class="dp-thumb-placeholder">
              <span class="dp-big-icon">{{ selectedItem.childCount != null ? folderIcon(selectedItem.type) : fileIcon(selectedItem.type) }}</span>
            </div>
          </div>

          <div class="dp-props">
            <!-- Path (most important) -->
            <div class="dp-row dp-row--path">
              <div class="dp-label">Path</div>
              <div class="dp-path-wrap">
                <span class="dp-path">{{ selectedItemPath }}</span>
                <button class="dp-copy" :class="{ copied: copied === 'path' }" @click="copyToClipboard(selectedItemPath, 'path')" title="Copy path">
                  {{ copied === 'path' ? '✓' : '⎘' }}
                </button>
              </div>
            </div>

            <!-- UUID -->
            <div class="dp-row">
              <div class="dp-label">UUID</div>
              <div class="dp-val-wrap">
                <span class="dp-uuid">{{ selectedItem.uuid }}</span>
                <button class="dp-copy" :class="{ copied: copied === 'uuid' }" @click="copyToClipboard(selectedItem.uuid, 'uuid')" title="Copy UUID">
                  {{ copied === 'uuid' ? '✓' : '⎘' }}
                </button>
              </div>
            </div>

            <!-- Owner -->
            <div class="dp-row" v-if="selectedItem.owner">
              <div class="dp-label">Owner</div>
              <div class="dp-val">{{ selectedItem.owner }}</div>
            </div>

            <!-- Created -->
            <div class="dp-row" v-if="selectedItem.published">
              <div class="dp-label">Created</div>
              <div class="dp-val dp-date">{{ fmtDate(selectedItem.published) }}</div>
            </div>

            <!-- Modified -->
            <div class="dp-row" v-if="selectedItem.updated">
              <div class="dp-label">Modified</div>
              <div class="dp-val dp-date">{{ fmtDate(selectedItem.updated) }}</div>
            </div>

            <!-- Children (folders) -->
            <div class="dp-row" v-if="selectedItem.childCount != null">
              <div class="dp-label">Children</div>
              <div class="dp-val">{{ selectedItem.childCount }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="dp-actions">
            <button v-if="selectedItem.childCount != null" class="dp-btn dp-btn--primary" @click="store.navigateTo(selectedItem.uuid)">
              Open Folder →
            </button>
            <template v-else>
              <div v-if="mseStore.selectedPlaylist" class="dp-playlist-label">
                → {{ mseStore.selectedPlaylist.name }}
              </div>
              <div v-if="mseStore.selectedPlaylist" class="dp-layer-btns">
                <button class="dp-btn" @click="sendToPlaylistDirect('MIDDLE')">Middle</button>
                <button class="dp-btn" @click="sendToPlaylistDirect('FRONT')">Front</button>
                <button class="dp-btn" @click="sendToPlaylistDirect('BACK')">Back</button>
              </div>
              <div v-else class="dp-hint">Open MSE tab and select a playlist to add</div>
            </template>
          </div>
        </template>
        <div v-else class="dp-empty">Select an item to view details</div>
      </div>

    </div>

    <!-- Context menu -->
    <div
      v-if="ctxMenu.visible"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
    >
      <div class="ctx-label">
        {{ mseStore.selectedPlaylist ? `→ "${mseStore.selectedPlaylist.name}"` : 'Send to playlist' }}
      </div>
      <template v-if="mseStore.selectedPlaylist">
        <div class="ctx-item" @click="sendToPlaylist('MIDDLE')">Middle layer</div>
        <div class="ctx-item" @click="sendToPlaylist('FRONT')">Front layer</div>
        <div class="ctx-item" @click="sendToPlaylist('BACK')">Back layer</div>
      </template>
      <div v-else class="ctx-hint">Open MSE tab and select a playlist first</div>
    </div>

    <!-- Toast notification -->
    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineComponent, h } from "vue";
import { useHubStore } from "../stores/useHubStore";
import { useMseStore } from "../stores/useMseStore";

const store = useHubStore();
const mseStore = useMseStore();
const selectedItem = ref(null);
const rootFolders = ref([]);
const filterType = ref("ALL");
const copied = ref(null);
let copiedTimer = null;

const ctxMenu = ref({ visible: false, x: 0, y: 0, file: null });
const toast = ref({ visible: false, message: "", type: "success" });
let toastTimer = null;

const selectedItemPath = computed(() => {
  if (!selectedItem.value) return "";
  const parts = store.breadcrumbs.map((b) => b.name);
  parts.push(selectedItem.value.name);
  return parts.join("/");
});

function copyToClipboard(text, key) {
  navigator.clipboard.writeText(text).catch(() => {});
  copied.value = key;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => { copied.value = null; }, 1500);
}

async function sendToPlaylistDirect(vizLayer) {
  if (!mseStore.selectedPlaylist || !selectedItem.value) return;
  const file = selectedItem.value;
  const playlistName = mseStore.selectedPlaylist.name;
  try {
    const scenePath = file.type === "SCENE" ? selectedItemPath.value : null;
    await mseStore.addElementToPlaylist(file.uuid, file.name, vizLayer, scenePath);
    showToast(`"${file.name}" added to ${playlistName} (${vizLayer})`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

const TYPE_GROUPS = {
  Scene:    ["SCENE"],
  Geometry: ["GEOM", "GEOMETRY"],
  Image:    ["IMAGE", "TEXTURE"],
  Fonts:    ["BASE_FONT", "FONT"],
  Audio:    ["AUDIO"],
  Material: ["MATERIAL"],
};

const filteredFiles = computed(() => {
  const types = TYPE_GROUPS[filterType.value];
  if (!types) return store.files;
  return store.files.filter((f) => types.includes(f.type));
});

function showContextMenu(event, file) {
  selectedItem.value = file;
  const x = Math.min(event.clientX, window.innerWidth - 220);
  const y = Math.min(event.clientY, window.innerHeight - 80);
  ctxMenu.value = { visible: true, x, y, file };
}

function hideContextMenu() {
  ctxMenu.value.visible = false;
}

async function sendToPlaylist(vizLayer) {
  if (!mseStore.selectedPlaylist || !ctxMenu.value.file) return;
  hideContextMenu();
  const file = ctxMenu.value.file;
  const playlistName = mseStore.selectedPlaylist.name;
  try {
    const scenePath = file.type === "SCENE" ? selectedItemPath.value : null;
    await mseStore.addElementToPlaylist(file.uuid, file.name, vizLayer, scenePath);
    showToast(`"${file.name}" added to ${playlistName} (${vizLayer})`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showToast(message, type = "success") {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { visible: true, message, type };
  toastTimer = setTimeout(() => { toast.value.visible = false; }, 3500);
}

function onDocMousedown(e) {
  if (!ctxMenu.value.visible) return;
  const el = document.querySelector(".ctx-menu");
  if (el && !el.contains(e.target)) hideContextMenu();
}

onMounted(async () => {
  document.addEventListener("mousedown", onDocMousedown);
  await store.navigateTo(null);
  rootFolders.value = [...store.folders];
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocMousedown);
  if (toastTimer) clearTimeout(toastTimer);
  if (copiedTimer) clearTimeout(copiedTimer);
});

const totalItems = computed(() => store.folders.length + filteredFiles.value.length);

const TYPE_LABELS = {
  SCENE: "Scene", GEOM: "Geometry", GEOMETRY: "Geometry",
  BASE_FONT: "Font", FONT: "Font",
  IMAGE: "Image", TEXTURE: "Texture",
  AUDIO: "Audio", VIDEO: "Video",
  Project: "Project", Folder: "Folder",
};
const FILE_ICONS = {
  SCENE: "🎬", GEOM: "🔷", GEOMETRY: "🔷",
  BASE_FONT: "🔤", FONT: "🔤",
  IMAGE: "🖼", TEXTURE: "🖼",
  AUDIO: "🔊", VIDEO: "📹",
};

function typeLabel(t) { return TYPE_LABELS[t] || t || "—"; }
function fileIcon(t) { return FILE_ICONS[t] || "📄"; }
function folderIcon(t) { return t === "Project" ? "📂" : "📁"; }
function fmtDate(d) {
  if (!d) return "—";
  return d.slice(0, 10);
}

// Recursive folder tree node (inline component)
const FolderTreeNode = defineComponent({
  name: "FolderTreeNode",
  props: {
    folder: Object,
    selectedUuid: String,
    depth: { type: Number, default: 0 },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const expanded = ref(false);
    const children = ref([]);
    const loading = ref(false);

    async function toggle() {
      if (!expanded.value && props.folder.childCount > 0 && !children.value.length) {
        loading.value = true;
        try {
          const { api } = await import("../services/api");
          children.value = await api.get(`/hub/folders/${props.folder.uuid}`);
        } finally {
          loading.value = false;
        }
      }
      expanded.value = !expanded.value;
      emit("select", props.folder.uuid);
    }

    return () => {
      const isSelected = props.selectedUuid === props.folder.uuid;
      const hasChildren = props.folder.childCount > 0;
      const indent = props.depth * 14;

      return h("div", { class: "tree-node" }, [
        h("div", {
          class: ["tree-item", isSelected ? "tree-selected" : ""],
          style: { paddingLeft: `${8 + indent}px` },
          onClick: toggle,
        }, [
          h("span", { class: "tree-arrow" }, hasChildren ? (expanded.value ? "▾" : "▸") : " "),
          h("span", { class: "tree-folder-icon" }, folderIcon(props.folder.type)),
          h("span", { class: "tree-label" }, props.folder.name),
          props.folder.childCount > 0
            ? h("span", { class: "tree-count" }, `(${props.folder.childCount})`)
            : null,
        ]),
        expanded.value && children.value.length
          ? h("div", {}, children.value.map((child) =>
              h(FolderTreeNode, {
                key: child.uuid,
                folder: child,
                selectedUuid: props.selectedUuid,
                depth: props.depth + 1,
                onSelect: (uuid) => emit("select", uuid),
              })
            ))
          : null,
        loading.value ? h("div", { style: { paddingLeft: `${22 + indent}px`, color: "#555", fontSize: "0.75rem" } }, "Loading...") : null,
      ]);
    };
  },
});
</script>

<style scoped>
.hub-root { display: flex; flex-direction: column; height: calc(100vh - 60px); background: #0d0d1a; font-size: 0.83rem; }

/* Address bar */
.address-bar {
  display: flex; align-items: center; gap: 0.5rem;
  background: #1a1a2e; border-bottom: 1px solid #2a2a3e;
  padding: 0.3rem 0.6rem; flex-shrink: 0;
}
.up-btn {
  background: #222235; color: #aaa; border: 1px solid #333;
  width: 26px; height: 26px; border-radius: 3px; cursor: pointer;
  font-size: 0.9rem; display: flex; align-items: center; justify-content: center;
}
.up-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.up-btn:hover:not(:disabled) { background: #2c2c45; }
.breadcrumbs { flex: 1; display: flex; align-items: center; gap: 0.2rem; overflow: hidden; }
.crumb { color: #7ec8e3; cursor: pointer; white-space: nowrap; padding: 0.1rem 0.25rem; border-radius: 3px; }
.crumb:hover { background: #1e1e35; }
.crumb.last { color: #eee; cursor: default; }
.crumb.last:hover { background: transparent; }
.crumb.root { color: #aaa; }
.sep { color: #444; }
.filter-select {
  background: #111122; color: #aaa; border: 1px solid #333;
  padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem; flex-shrink: 0;
}
.item-count { color: #555; font-size: 0.75rem; white-space: nowrap; }

/* Explorer layout */
.explorer { display: flex; flex: 1; overflow: hidden; }

/* Left tree */
.tree-panel {
  width: 200px; min-width: 140px; flex-shrink: 0;
  background: #111120; border-right: 1px solid #1e1e30;
  display: flex; flex-direction: column;
}
.tree-header {
  padding: 0.35rem 0.7rem; background: #1a1a2e;
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: #666; border-bottom: 1px solid #1e1e30; flex-shrink: 0;
}
.tree-scroll { overflow-y: auto; flex: 1; padding: 0.25rem 0; }

:deep(.tree-node) { user-select: none; }
:deep(.tree-item) {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.22rem 0.5rem; cursor: pointer; color: #bbb;
}
:deep(.tree-item:hover) { background: #181828; }
:deep(.tree-selected) { background: #1e3055 !important; color: #fff; }
:deep(.tree-arrow) { width: 10px; font-size: 0.65rem; color: #555; flex-shrink: 0; }
:deep(.tree-folder-icon) { font-size: 0.8rem; flex-shrink: 0; }
:deep(.tree-label) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }
:deep(.tree-count) { font-size: 0.65rem; color: #555; flex-shrink: 0; }

/* Center content */
.content-panel { flex: 2; overflow-y: auto; min-width: 0; }
.content-table { width: 100%; border-collapse: collapse; }
.content-table thead { position: sticky; top: 0; z-index: 1; }
.content-table th {
  background: #1a1a2e; color: #777; font-weight: normal;
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 0.3rem 0.6rem; text-align: left; border-bottom: 1px solid #2a2a3e;
  white-space: nowrap;
}
.content-table td {
  padding: 0.25rem 0.6rem; border-bottom: 1px solid #13131f;
  color: #ccc; vertical-align: middle;
}
.content-table tr:hover td { background: #161625; }
.content-table tr.selected td { background: #1e3055; }

.col-icon  { width: 36px; text-align: center; padding: 0.2rem; }
.col-type  { width: 90px; color: #777; font-size: 0.75rem; }
.col-date  { width: 90px; color: #666; font-family: monospace; font-size: 0.78rem; }
.col-owner { width: 90px; color: #888; font-size: 0.78rem; }

.thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 2px; display: block; margin: auto; }
.icon { font-size: 1rem; }

.row-folder td { color: #ddd; }
.empty-row { text-align: center; color: #444; font-style: italic; padding: 2rem !important; }
.loading-row { text-align: center; color: #555; padding: 2rem; font-style: italic; }

/* ── Right detail panel ── */
.detail-panel {
  width: 0; flex-shrink: 0; overflow: hidden;
  background: #10101e; border-left: 1px solid #1e1e30;
  display: flex; flex-direction: column;
  transition: width 0.18s ease;
}
.detail-panel--visible { width: 280px; }

.dp-header {
  padding: 0.7rem 0.8rem 0.5rem;
  border-bottom: 1px solid #1e1e30; flex-shrink: 0;
}
.dp-type-badge {
  display: inline-block; background: #1a2a3a; color: #7ec8e3;
  font-size: 0.68rem; padding: 0.1rem 0.45rem; border-radius: 3px;
  letter-spacing: 0.04em; margin-bottom: 0.3rem;
}
.dp-name {
  display: block; color: #eee; font-weight: 600; font-size: 0.88rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.dp-thumb-wrap {
  flex-shrink: 0; background: #0a0a16; border-bottom: 1px solid #1a1a2e;
  display: flex; align-items: center; justify-content: center;
  height: 140px;
}
.dp-thumb { max-width: 100%; max-height: 140px; object-fit: contain; }
.dp-thumb-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.dp-big-icon { font-size: 3rem; opacity: 0.3; }

.dp-props { flex: 1; overflow-y: auto; padding: 0.5rem 0; }

.dp-row {
  display: flex; align-items: flex-start; gap: 0.4rem;
  padding: 0.3rem 0.8rem; border-bottom: 1px solid #13131f;
}
.dp-row--path { flex-direction: column; gap: 0.25rem; }
.dp-label {
  font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: #555; flex-shrink: 0; padding-top: 0.05rem;
}
.dp-row--path .dp-label { color: #7ec8e3; font-size: 0.7rem; }
.dp-val { color: #ccc; font-size: 0.8rem; word-break: break-all; }
.dp-uuid { font-family: monospace; font-size: 0.7rem; color: #777; word-break: break-all; }
.dp-date { font-family: monospace; font-size: 0.78rem; color: #888; }

.dp-path-wrap, .dp-val-wrap {
  display: flex; align-items: flex-start; gap: 0.3rem; width: 100%;
}
.dp-path {
  font-family: monospace; font-size: 0.78rem; color: #c8e6ff;
  word-break: break-all; flex: 1; line-height: 1.4;
}
.dp-copy {
  flex-shrink: 0; background: #1a1a2e; border: 1px solid #2a2a40;
  color: #666; width: 22px; height: 22px; border-radius: 3px;
  cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, border-color 0.2s;
}
.dp-copy:hover { color: #aaa; border-color: #444; }
.dp-copy.copied { color: #81c784; border-color: #2e7d32; }

.dp-actions {
  flex-shrink: 0; padding: 0.65rem 0.8rem;
  border-top: 1px solid #1e1e30; display: flex; flex-direction: column; gap: 0.4rem;
}
.dp-playlist-label {
  font-size: 0.72rem; color: #7ec8e3; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.dp-layer-btns { display: flex; gap: 0.3rem; }
.dp-btn {
  flex: 1; background: #1a2a3a; color: #9ec8e8; border: 1px solid #2a4a6a;
  padding: 0.3rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem;
}
.dp-btn:hover { background: #1e3a5a; }
.dp-btn--primary { background: #1e3a5c; color: #7ec8e3; border-color: #2a5caa; flex: none; }
.dp-btn--primary:hover { background: #2a4e7c; }
.dp-hint { font-size: 0.72rem; color: #444; font-style: italic; }
.dp-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #2a2a40; font-style: italic; font-size: 0.8rem; }

/* Context menu */
.ctx-menu {
  position: fixed; z-index: 1000;
  background: #1e1e30; border: 1px solid #333; border-radius: 5px;
  padding: 4px 0; min-width: 200px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.ctx-label {
  padding: 0.3rem 0.9rem 0.2rem; color: #7ec8e3; font-size: 0.75rem;
  font-weight: 600; border-bottom: 1px solid #2a2a3e; margin-bottom: 2px;
}
.ctx-item {
  padding: 0.35rem 0.9rem 0.35rem 1.2rem; color: #ddd; cursor: pointer; font-size: 0.82rem;
}
.ctx-item:hover { background: #2a3a5a; }
.ctx-hint { padding: 0.1rem 0.9rem 0.4rem; color: #555; font-size: 0.72rem; font-style: italic; }

/* Toast */
.toast {
  position: fixed; bottom: 2.5rem; left: 50%; transform: translateX(-50%);
  padding: 0.45rem 1.1rem; border-radius: 5px; font-size: 0.82rem;
  z-index: 1100; pointer-events: none; white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
.toast.success { background: #1a3a20; border: 1px solid #2e7d32; color: #81c784; }
.toast.error   { background: #3a1a1a; border: 1px solid #c62828; color: #ef9a9a; }
</style>
