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

      <!-- Right: content table -->
      <div class="content-panel">
        <div v-if="store.loadingContent" class="loading-row">Loading...</div>
        <template v-else>
          <table class="content-table">
            <thead>
              <tr>
                <th class="col-icon"></th>
                <th class="col-name">Name</th>
                <th class="col-uuid">UUID</th>
                <th class="col-date">Date Created</th>
                <th class="col-date">Date Modified</th>
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
                <td class="col-uuid" :title="f.uuid">{{ f.uuid }}</td>
                <td class="col-date">—</td>
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
                <td class="col-uuid" :title="file.uuid">{{ file.uuid }}</td>
                <td class="col-date">{{ fmtDate(file.published) }}</td>
                <td class="col-date">{{ fmtDate(file.updated) }}</td>
                <td class="col-owner">{{ file.owner || '—' }}</td>
              </tr>
              <!-- Empty state -->
              <tr v-if="!store.folders.length && !filteredFiles.length">
                <td colspan="6" class="empty-row">This folder is empty.</td>
              </tr>
            </tbody>
          </table>
        </template>
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

    <!-- Detail strip (bottom) -->
    <div v-if="selectedItem" class="detail-bar">
      <span class="det-icon">{{ selectedItem.type === 'Project' || selectedItem.childCount != null ? folderIcon(selectedItem.type) : fileIcon(selectedItem.type) }}</span>
      <span class="det-name">{{ selectedItem.name }}</span>
      <span class="det-type">{{ typeLabel(selectedItem.type) }}</span>
      <span class="det-date">{{ fmtDate(selectedItem.updated) }}</span>
      <button v-if="selectedItem.childCount != null" class="det-open" @click="store.navigateTo(selectedItem.uuid)">Open →</button>
    </div>

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

const ctxMenu = ref({ visible: false, x: 0, y: 0, file: null });
const toast = ref({ visible: false, message: "", type: "success" });
let toastTimer = null;

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
    await mseStore.addElementToPlaylist(file.uuid, file.name, vizLayer);
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
  padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;
  flex-shrink: 0;
}
.item-count { color: #555; font-size: 0.75rem; white-space: nowrap; }

/* Explorer layout */
.explorer { display: flex; flex: 1; overflow: hidden; }

/* Left tree */
.tree-panel {
  width: 220px; min-width: 160px; flex-shrink: 0;
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

/* Right content */
.content-panel { flex: 1; overflow-y: auto; }
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
.col-uuid  { width: 260px; color: #555; font-family: monospace; font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.col-date  { width: 96px; color: #666; font-family: monospace; font-size: 0.78rem; }
.col-owner { width: 100px; color: #888; font-size: 0.78rem; }

.thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 2px; display: block; margin: auto; }
.icon { font-size: 1rem; }

.row-folder td { color: #ddd; }
.empty-row { text-align: center; color: #444; font-style: italic; padding: 2rem !important; }
.loading-row { text-align: center; color: #555; padding: 2rem; font-style: italic; }

/* Detail bar */
.detail-bar {
  display: flex; align-items: center; gap: 0.75rem;
  background: #111120; border-top: 1px solid #1e1e30;
  padding: 0.3rem 0.75rem; flex-shrink: 0; min-height: 30px;
}
.det-icon { font-size: 0.9rem; }
.det-name { color: #eee; font-weight: 500; }
.det-type { color: #888; font-size: 0.78rem; background: #1a1a2e; padding: 0.1rem 0.4rem; border-radius: 3px; }
.det-date { color: #555; font-size: 0.78rem; font-family: monospace; }
.det-open {
  margin-left: auto; background: #1e3a5c; color: #7ec8e3;
  border: 1px solid #2a5caa; padding: 0.2rem 0.6rem; border-radius: 3px;
  cursor: pointer; font-size: 0.78rem;
}
.det-open:hover { background: #2a4e7c; }

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
