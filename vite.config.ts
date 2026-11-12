import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { version } from "./package.json" with { type: "json" };
import { handleRooms } from "./server/rooms.mjs";
import { handleMonitor } from "./server/monitor.mjs";
import { handlePhone } from "./server/phone.mjs";
import { handleWiki } from "./server/wiki.mjs";

// Rooms (partage de sélection) : le même gestionnaire que `npm start`, monté dans Vite
// (dev et preview) pour que `npm run dev` serve aussi /api/rooms, /api/monitor et /api/phone et /api/wiki sur le même port.
const roomsPlugin: Plugin = {
  name: "tqp-rooms",
  configureServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || handleMonitor(req, res) || handlePhone(req, res) || handleWiki(req, res) || next()));
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => void (handleRooms(req, res) || handleMonitor(req, res) || handlePhone(req, res) || handleWiki(req, res) || next()));
  },
};

// Domaine du site (SITE_URL, avec ou sans « / » final) : lien canonique, balises de partage, données structurées,
// robots.txt et sitemap.xml. index.html contient __SITE_URL__ et __APP_VERSION__, remplacés ici.
const sitePlugin = (siteUrl: string): Plugin => ({
  name: "tqp-site",
  transformIndexHtml(html, ctx) {
    // le chunk de l'appli est chargé en différé (main.tsx) : on le précharge sans écrire son nom haché
    const app = Object.values(ctx.bundle ?? {}).find((c) => c.type === "chunk" && c.name === "App");
    return {
      html: html.replaceAll("__SITE_URL__", siteUrl).replaceAll("__APP_VERSION__", version),
      tags: app ? [{ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `./${app.fileName}` }, injectTo: "head" as const }] : [],
    };
  },
  generateBundle() {
    const source = (name: string, text: string) => this.emitFile({ type: "asset", fileName: name, source: text });
    source("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}sitemap.xml\n`);
    source(
      "sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n</urlset>\n`,
    );
  },
});

// base: "./" permet de servir le build depuis n'importe quel sous-dossier
// (ex. GitHub Pages) sans configuration supplémentaire.
export default defineConfig(({ mode }) => ({
  base: "./",
  // images réduites des objets (item finder) et captures de test : fichiers binaires servis tels quels
  assetsInclude: ["**/*.bin"],
  plugins: [react(), roomsPlugin, sitePlugin((loadEnv(mode, ".", "").SITE_URL || "https://tarkov.aprilox.fr/").replace(/\/*$/, "/"))],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testSetup.ts"],
  },
}));
