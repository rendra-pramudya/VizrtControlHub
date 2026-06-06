import { createRouter, createWebHistory } from "vue-router";
import EngineView from "../views/EngineView.vue";
import PilotView from "../views/PilotView.vue";
import MseView from "../views/MseView.vue";
import HubView from "../views/HubView.vue";
import SettingsView from "../views/SettingsView.vue";
import UdpView from "../views/UdpView.vue";

const routes = [
  { path: "/", redirect: "/engine" },
  { path: "/engine", component: EngineView },
  { path: "/pilot", component: PilotView },
  { path: "/mse", component: MseView },
  { path: "/hub", component: HubView },
  { path: "/settings", component: SettingsView },
  { path: "/udp", component: UdpView },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
