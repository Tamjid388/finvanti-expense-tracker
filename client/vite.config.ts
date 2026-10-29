import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Dev-only same-origin API proxy: page and API share one origin, so the
    // SameSite=Lax refresh cookie is sent no matter which local hostname
    // (localhost or 127.0.0.1) the browser tab was opened with. Production
    // uses VITE_API_BASE_URL directly (see src/config/env.ts); no proxy there.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
