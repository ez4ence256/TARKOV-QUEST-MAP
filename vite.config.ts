import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleRooms } from "./server/rooms.mjs";
import { handleMonitor } from "./server/monitor.mjs";

// Rooms (partage de sélection) : le même gestionnaire que `npm start`, monté dans Vite
// (dev et preview) pour que `npm run dev` serve aussi /api/rooms et /api/monitor sur le même port.
const roomsPlugin: Plugin = {
  name: "tqp-rooms",
  configureServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || handleMonitor(req, res) || next()));
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || handleMonitor(req, res) || next()));
  },
};

// base: "./" permet de servir le build depuis n'importe quel sous-dossier
// (ex. GitHub Pages) sans configuration supplémentaire.
export default defineConfig({
  base: "./",
  // images réduites des objets (item finder) et captures de test : fichiers binaires servis tels quels
  assetsInclude: ["**/*.bin"],
  plugins: [react(), roomsPlugin],
  test: {
    environment: "jsdom",
  },
});
