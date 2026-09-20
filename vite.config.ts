import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const localApi = "http://127.0.0.1:3001";
const target = process.env.DEV_API === "local" ? localApi : process.env.DEV_API || "https://branner.hoyoonsong.com";
const usingRemote = target !== localApi;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target,
        changeOrigin: true,
        headers: usingRemote ? { "x-branner-origin": "http://localhost:5174" } : {},
      },
      "/uploads": {
        target,
        changeOrigin: true,
      },
    },
  },
});
