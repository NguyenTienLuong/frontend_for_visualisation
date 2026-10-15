import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    // The minified Plotly runtime is intentionally bundled so the
    // textbook works offline after install; keep warnings meaningful above it.
    chunkSizeWarningLimit: 5000,
  },
});
