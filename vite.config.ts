import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Both headers are required for SharedArrayBuffer, which the multi-threaded
// FFmpeg core depends on. They are duplicated in vercel.json, netlify.toml and
// public/_headers so every deployment target sends them.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    host: true,
    port: 3000,
    headers: crossOriginIsolationHeaders,
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  build: {
    target: "es2022",
    // Vendors are intentionally left in one bundle: splitting React away from
    // Radix produced a circular chunk that broke at runtime.
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
