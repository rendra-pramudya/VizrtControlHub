import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../services/api";

export const useHubStore = defineStore("hub", () => {
  const folders = ref([]);       // subfolders in current folder
  const files = ref([]);         // files in current folder
  const currentFolder = ref(null); // { uuid, name, parentUuid, type }
  const breadcrumbs = ref([]);   // [{uuid, name}]
  const loadingContent = ref(false);

  // Navigate into a folder (null = root)
  async function navigateTo(uuid) {
    loadingContent.value = true;
    try {
      const [foldersData, folderInfo, filesData] = await Promise.all([
        api.get(uuid ? `/hub/folders/${uuid}` : "/hub/folders"),
        uuid ? api.get(`/hub/folder/${uuid}`) : Promise.resolve({ uuid: null, name: "Graphics Hub", parentUuid: null }),
        uuid ? api.get(`/hub/files/${uuid}`) : Promise.resolve([]),
      ]);
      folders.value = foldersData.slice().sort((a, b) => a.name.localeCompare(b.name));
      files.value = filesData.slice().sort((a, b) => a.name.localeCompare(b.name));
      currentFolder.value = folderInfo;
      _updateBreadcrumbs(folderInfo);
    } finally {
      loadingContent.value = false;
    }
  }

  function _updateBreadcrumbs(info) {
    if (!info.uuid) {
      breadcrumbs.value = [];
      return;
    }
    const existing = breadcrumbs.value.findIndex((b) => b.uuid === info.uuid);
    if (existing !== -1) {
      // navigated back — trim everything after this point
      breadcrumbs.value = breadcrumbs.value.slice(0, existing + 1);
    } else {
      breadcrumbs.value = [...breadcrumbs.value, { uuid: info.uuid, name: info.name }];
    }
  }

  function navigateUp() {
    const parent = currentFolder.value?.parentUuid ?? null;
    if (breadcrumbs.value.length > 1) {
      breadcrumbs.value = breadcrumbs.value.slice(0, -1);
      navigateTo(parent);
    } else {
      breadcrumbs.value = [];
      navigateTo(null);
    }
  }

  return { folders, files, currentFolder, breadcrumbs, loadingContent, navigateTo, navigateUp };
});
