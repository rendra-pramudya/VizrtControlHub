import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    // Bind IPv4 explicitly: without this Vite listens on [::1] only and
    // http://127.0.0.1:5173 (printed by start.bat) does not open.
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:3000",
        ws: true,
      },
    },
  },
});
