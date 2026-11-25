<template>
  <div>
    <h2>Settings</h2>

    <div v-if="loading" class="empty">Loading config...</div>
    <div v-else-if="config">

      <section>
        <h3>Viz Engines</h3>
        <div v-for="(eng, i) in config.engine" :key="i" class="row">
          <input v-model="eng.name" placeholder="Name" />
          <input v-model="eng.host" placeholder="Host" />
          <input v-model.number="eng.port" placeholder="Port" type="number" />
          <label><input type="checkbox" v-model="eng.enabled" /> Enabled</label>
        </div>
      </section>

      <section>
        <h3>Pilot Data Server</h3>
        <div class="row">
          <input v-model="config.pilot.host" placeholder="Host" />
          <input v-model.number="config.pilot.port" placeholder="Port" type="number" />
        </div>
      </section>

      <section>
        <h3>MSE</h3>
        <div class="row">
          <input v-model="config.mse.host" placeholder="Host" />
          <input v-model.number="config.mse.port" placeholder="Port" type="number" />
        </div>
      </section>

      <section>
        <h3>Graphics Hub</h3>
        <div class="row">
          <label class="field-label">Host</label>
          <input v-model="config.hub.host" placeholder="Host" />
          <label class="field-label">Port</label>
          <input v-model.number="config.hub.port" placeholder="Port" type="number" />
        </div>
        <div class="row">
          <label class="field-label">Username</label>
          <input v-model="config.hub.username" placeholder="Username" />
          <label class="field-label">Password</label>
          <input
            v-model="config.hub.password"
            :placeholder="config.hub.passwordSet ? 'Tersimpan — kosongkan agar tidak berubah' : 'Password'"
            type="password"
          />
        </div>
      </section>

      <button @click="save">Save Configuration</button>
      <span v-if="saved" class="saved-msg">Configuration saved!</span>
      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useConfigStore } from "../stores/useConfigStore";

const store = useConfigStore();
const loading = ref(false);
const saved = ref(false);
const config = ref(null);

onMounted(async () => {
  loading.value = true;
  await store.fetchConfig();
  config.value = JSON.parse(JSON.stringify(store.config));
  loading.value = false;
});

const error = ref("");

async function save() {
  error.value = "";
  try {
    const { passwordSet, ...hub } = config.value.hub;
    await store.saveConfig({ ...config.value, hub });
    if (hub.password) config.value.hub.passwordSet = true;
    config.value.hub.password = "";
    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<style scoped>
h2 { margin-bottom: 1rem; }
h3 { margin: 0 0 0.5rem; }
section { background: #1a1a2e; border: 1px solid #333; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; max-width: 650px; }
.row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
input[type="text"], input:not([type]) { background: #1e1e1e; color: #eee; border: 1px solid #444; padding: 0.3rem 0.5rem; border-radius: 4px; min-width: 140px; }
input[type="number"] { background: #1e1e1e; color: #eee; border: 1px solid #444; padding: 0.3rem 0.5rem; border-radius: 4px; width: 90px; }
label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #aaa; }
.field-label { min-width: 70px; color: #888; font-size: 0.8rem; flex-shrink: 0; }
button { background: #2a5caa; color: #fff; border: none; padding: 0.4rem 1.2rem; border-radius: 4px; cursor: pointer; }
.saved-msg { margin-left: 0.75rem; color: #4caf50; font-size: 0.85rem; }
.empty { color: #555; font-style: italic; }
.error-msg { margin-top: 0.75rem; color: #ef5350; font-size: 0.85rem; max-width: 650px; }
</style>
