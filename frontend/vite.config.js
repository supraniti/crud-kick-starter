import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serverOrigin = process.env.VITE_SERVER_ORIGIN ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/health": serverOrigin,
      "/ready": serverOrigin,
      "/api": serverOrigin
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.js",
    fileParallelism: false
  }
});
