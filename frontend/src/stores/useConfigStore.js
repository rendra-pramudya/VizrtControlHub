import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../services/api";

export const useConfigStore = defineStore("config", () => {
  const config = ref(null);

  async function fetchConfig() {
    config.value = await api.get("/config");
  }

  async function saveConfig(newConfig) {
    await api.put("/config", newConfig);
    config.value = newConfig;
  }

  return { config, fetchConfig, saveConfig };
});
