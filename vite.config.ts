import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleRooms } from "./server/rooms.mjs";

// Rooms (partage de sélection) : le même gestionnaire que `npm start`, monté dans Vite
// (dev et preview) pour que `npm run dev` serve aussi /api/rooms sur le même port.
const roomsPlugin: Plugin = {
  name: "tqp-rooms",
  configureServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || next()));
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || next()));
  },
};

// base: "./" permet de servir le build depuis n'importe quel sous-dossier
// (ex. GitHub Pages) sans configuration supplémentaire.
export default defineConfig({
  base: "./",
  plugins: [react(), roomsPlugin],
  // "::" = IPv6 + IPv4 : sans cela Vite n'écoute que sur ::1 (localhost) et 127.0.0.1 ne répond pas
  // (test des rooms avec deux origines). Attention : visible aussi depuis le réseau local en dev.
  server: { host: "::" },
  test: {
    environment: "jsdom",
  },
});
