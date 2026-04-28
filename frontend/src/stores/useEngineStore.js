import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../services/api";

export const useEngineStore = defineStore("engine", () => {
  const engines = ref([]);
  const history = ref([]);

  async function fetchEngines() {
    engines.value = await api.get("/engine");
  }

  async function sendCommand(engineId, command) {
    const result = await api.post(`/engine/${engineId}/command`, { command });
    history.value.unshift({ ...result, timestamp: new Date().toISOString() });
    return result;
  }

  async function getStatus(engineId) {
    return api.get(`/engine/${engineId}/status`);
  }

  return { engines, history, fetchEngines, sendCommand, getStatus };
});
