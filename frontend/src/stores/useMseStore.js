import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../services/api";

export const useMseStore = defineStore("mse", () => {
  const playlists = ref([]);
  const selectedPlaylist = ref(null);
  const elements = ref([]);
  const profiles = ref([]);
  const selectedProfile = ref("default");
  const channelState = ref([]);
  const liveEvents = ref([]);

  let ws = null;
  let statePoller = null;

  async function fetchPlaylists() {
    playlists.value = await api.get("/mse/playlists");
  }

  async function selectPlaylist(storageId) {
    selectedPlaylist.value = playlists.value.find((p) => p.storageId === storageId) || null;
    elements.value = storageId ? await api.get(`/mse/playlists/${storageId}/elements`) : [];
  }

  async function fetchProfiles() {
    profiles.value = await api.get("/mse/profiles");
  }

  async function fetchProfileState() {
    try {
      channelState.value = await api.get(`/mse/profiles/${selectedProfile.value}/state`);
    } catch { /* ignore polling errors */ }
  }

  async function triggerAction(action, elementEditUrl) {
    return api.post(`/mse/profiles/${selectedProfile.value}/${action}`, { elementEditUrl });
  }

  async function moveElement(elementEditUrl, toIndex) {
    if (!selectedPlaylist.value) throw new Error("No active playlist selected");
    const { storageId } = selectedPlaylist.value;
    await api.post(`/mse/playlists/${storageId}/elements/move`, { elementEditUrl, toIndex });
    elements.value = await api.get(`/mse/playlists/${storageId}/elements`);
  }

  async function addElementToPlaylist(hubUuid, fileName, vizLayer = "MIDDLE") {
    if (!selectedPlaylist.value) throw new Error("No active playlist selected in MSE tab");
    const { storageId } = selectedPlaylist.value;
    await api.post(`/mse/playlists/${storageId}/elements`, { hubUuid, fileName, vizLayer });
    elements.value = await api.get(`/mse/playlists/${storageId}/elements`);
  }

  function startStatePolling(intervalMs = 3000) {
    stopStatePolling();
    fetchProfileState();
    statePoller = setInterval(fetchProfileState, intervalMs);
  }

  function stopStatePolling() {
    if (statePoller) { clearInterval(statePoller); statePoller = null; }
  }

  function connectLive() {
    if (ws) return;
    ws = new WebSocket(`ws://${location.host}/ws/mse`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      liveEvents.value.unshift(data);
      if (liveEvents.value.length > 50) liveEvents.value.pop();
      fetchProfileState();
    };
    ws.onclose = () => { ws = null; };
  }

  function disconnectLive() {
    if (ws) { ws.close(); ws = null; }
    stopStatePolling();
  }

  return {
    playlists, selectedPlaylist, elements, profiles, selectedProfile, channelState, liveEvents,
    fetchPlaylists, selectPlaylist, fetchProfiles, fetchProfileState,
    triggerAction, startStatePolling, stopStatePolling, connectLive, disconnectLive,
    addElementToPlaylist, moveElement,
  };
});
