<template>
  <div class="udp-layout">
    <div class="toolbar">
      <span class="title">UDP Monitor <span class="port">:7476</span></span>
      <span class="status" :class="wsStatus">{{ wsStatus }}</span>
      <span class="count">{{ messages.length }} messages</span>
      <label class="auto-scroll-toggle">
        <input type="checkbox" v-model="autoScroll" /> Auto-scroll
      </label>
      <button class="clear-btn" @click="clear">Clear</button>
    </div>

    <div class="log-wrap" ref="logRef">
      <div v-if="!messages.length" class="empty">No messages received yet.</div>
      <div v-for="(m, i) in messages" :key="i" class="log-row">
        <span class="ts">{{ m.ts.slice(11, 23) }}</span>
        <span class="from">{{ m.from }}</span>
        <span class="data">{{ m.data }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";

const messages = ref([]);
const autoScroll = ref(true);
const wsStatus = ref("disconnected");
const logRef = ref(null);
let ws = null;
let reconnectTimer = null;

function scrollBottom() {
  if (!autoScroll.value || !logRef.value) return;
  nextTick(() => { logRef.value.scrollTop = logRef.value.scrollHeight; });
}

function clear() { messages.value = []; }

async function loadHistory() {
  try {
    const res = await fetch("/api/udp/messages");
    const data = await res.json();
    messages.value = data;
    scrollBottom();
  } catch { /* backend not yet up */ }
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.hostname}:3000/ws/mse`);

  ws.onopen = () => { wsStatus.value = "connected"; };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== "udp") return;
      messages.value.push(msg);
      if (messages.value.length > 2000) messages.value.shift();
      scrollBottom();
    } catch { /* ignore non-JSON */ }
  };

  ws.onclose = () => {
    wsStatus.value = "disconnected";
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => ws.close();
}

onMounted(async () => {
  await loadHistory();
  connect();
});

onUnmounted(() => {
  clearTimeout(reconnectTimer);
  if (ws) ws.close();
});
</script>

<style scoped>
.udp-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  background: #0d0d1a;
  font-family: monospace;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.55rem 1rem;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a3e;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.title { font-size: 0.9rem; font-weight: bold; color: #eee; }
.port { color: #7ec8e3; }

.status {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.status.connected    { background: #1a3a1a; color: #4caf50; }
.status.disconnected { background: #3a1a1a; color: #f44336; }

.count { font-size: 0.78rem; color: #666; }

.auto-scroll-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: #aaa;
  cursor: pointer;
}

.clear-btn {
  margin-left: auto;
  background: #2a2a3e;
  color: #ccc;
  border: 1px solid #444;
  padding: 0.25rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}
.clear-btn:hover { background: #3a3a5e; }

.log-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}

.empty { padding: 1rem; color: #555; font-style: italic; font-size: 0.85rem; }

.log-row {
  display: flex;
  gap: 0.75rem;
  padding: 0.18rem 1rem;
  border-bottom: 1px solid #13131f;
  font-size: 0.82rem;
  line-height: 1.5;
}
.log-row:hover { background: #131320; }

.ts   { color: #555; flex-shrink: 0; width: 90px; }
.from { color: #7ec8e3; flex-shrink: 0; width: 160px; }
.data { color: #e0e0e0; word-break: break-all; flex: 1; }
</style>
