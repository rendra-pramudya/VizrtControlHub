<template>
  <div>
    <h2>Viz Engine</h2>

    <div class="engine-select">
      <label>Engine:</label>
      <select v-model="selectedId">
        <option v-for="e in store.engines" :key="e.id" :value="e.id" :disabled="!e.enabled">
          {{ e.name }} ({{ e.host }}:{{ e.port }})
        </option>
      </select>
      <button @click="checkStatus">Check Status</button>
      <span :class="['status-dot', statusConnected ? 'on' : 'off']"></span>
    </div>

    <div class="command-box">
      <textarea v-model="command" rows="3" placeholder="Enter Vizrt command..." />
      <div class="quick-buttons">
        <button :disabled="!selectedId" @click="quickSend('0 RENDERER*STAGE SHOW 0')">Begin</button>
        <button :disabled="!selectedId" @click="quickSend('0 RENDERER*STAGE START')">Start</button>
        <button :disabled="!selectedId" @click="quickSend('0 RENDERER*STAGE CONTINUE')">Continue</button>
      </div>
      <button :disabled="!selectedId || !command" @click="send">Send Command</button>
    </div>

    <div class="history">
      <h3>Command History</h3>
      <div v-if="store.history.length === 0" class="empty">No commands sent yet.</div>
      <div v-for="(item, i) in store.history" :key="i" class="history-item">
        <div class="meta">{{ item.timestamp }} — <strong>{{ item.engineId }}</strong></div>
        <div class="cmd">▶ {{ item.command }}</div>
        <div class="resp">{{ item.response }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useEngineStore } from "../stores/useEngineStore";

const store = useEngineStore();
const selectedId = ref(null);
const command = ref("");
const statusConnected = ref(null);

onMounted(async () => {
  await store.fetchEngines();
  if (store.engines.length) selectedId.value = store.engines[0].id;
});

async function send() {
  if (!selectedId.value || !command.value) return;
  await store.sendCommand(selectedId.value, command.value);
  command.value = "";
}

async function quickSend(cmd) {
  if (!selectedId.value) return;
  await store.sendCommand(selectedId.value, cmd);
}

async function checkStatus() {
  if (!selectedId.value) return;
  const s = await store.getStatus(selectedId.value);
  statusConnected.value = s.connected;
}
</script>

<style scoped>
h2 { margin-bottom: 1rem; }
h3 { margin: 1rem 0 0.5rem; }
.engine-select { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
select { background: #222; color: #eee; border: 1px solid #444; padding: 0.3rem; border-radius: 4px; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; background: #555; }
.status-dot.on { background: #4caf50; }
.status-dot.off { background: #f44336; }
.command-box { display: flex; flex-direction: column; gap: 0.5rem; max-width: 600px; margin-bottom: 1rem; }
.quick-buttons { display: flex; gap: 0.5rem; }
.quick-buttons button { background: #1e3a5f; border: 1px solid #2a5caa; }
textarea { background: #1e1e1e; color: #eee; border: 1px solid #444; padding: 0.5rem; border-radius: 4px; resize: vertical; }
button { background: #2a5caa; color: #fff; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.history { max-width: 700px; }
.history-item { background: #1a1a2e; border: 1px solid #333; border-radius: 4px; padding: 0.6rem; margin-bottom: 0.5rem; }
.meta { font-size: 0.75rem; color: #888; }
.cmd { color: #7ec8e3; font-family: monospace; margin: 0.2rem 0; }
.resp { font-family: monospace; font-size: 0.85rem; color: #aed581; }
.empty { color: #555; font-style: italic; }
</style>
