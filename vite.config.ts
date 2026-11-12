import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi } from "./server/api.mjs";

/** Adresse publique du site : balises canoniques et de partage, robots.txt, sitemap.xml. */
const SITE_URL = "https://tarkov.aprilox.fr/";

// Rooms, monitor, téléphone, wiki : les mêmes gestionnaires que `npm start`, montés dans Vite
// (dev et preview) pour que `npm run dev` serve aussi /api/… sur le même port.
const apiPlugin: Plugin = {
  name: "tqp-api",
  configureServer(server) {
    server.middlewares.use((req, res, next) => void (handleApi(req, res) || next()));
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => void (handleApi(req, res) || next()));
  },
};

// Référencement, 1/2 : l'adresse du site dans index.html, avant que Vite ne lise ses liens
// (une adresse absolue n'est pas prise pour un fichier du projet).
const siteUrlPlugin: Plugin = {
  name: "tqp-site-url",
  transformIndexHtml: {
    order: "pre",
    handler: (html) => html.replaceAll("%SITE_URL%", SITE_URL),
  },
};

// Référencement, 2/2 : robots.txt et sitemap.xml écrits à la construction (date du jour = date de mise en ligne),
// et préchargement du fichier de l'appli. main.tsx l'importe à la demande (la page du téléphone s'en passe) :
// sans cela le navigateur ne le découvre qu'après avoir exécuté le premier script.
const seoPlugin: Plugin = {
  name: "tqp-seo",
  apply: "build",
  generateBundle() {
    const today = new Date().toISOString().slice(0, 10);
    this.emitFile({
      type: "asset",
      fileName: "robots.txt",
      source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}sitemap.xml\n`,
    });
    this.emitFile({
      type: "asset",
      fileName: "sitemap.xml",
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n</urlset>\n`,
    });
  },
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const app = Object.values(ctx.bundle ?? {}).find((c) => c.type === "chunk" && c.isDynamicEntry && c.name === "App");
      if (!app || app.type !== "chunk") return html;
      // le fichier de l'appli et ce qu'il importe, sauf ce que la page charge déjà
      const files = [app.fileName, ...app.imports].filter((f) => !html.includes(f));
      const code = `if (!/[?&]phone=/.test(location.search)) ${JSON.stringify(files)}.forEach(function (f) { var l = document.createElement("link"); l.rel = "modulepreload"; l.crossOrigin = ""; l.href = "./" + f; document.head.appendChild(l); });`;
      return [{ tag: "script", children: code, injectTo: "head" }];
    },
  },
};

// base: "./" permet de servir le build depuis n'importe quel sous-dossier
// (ex. GitHub Pages) sans configuration supplémentaire.
export default defineConfig({
  base: "./",
  // images réduites des objets (item finder) et captures de test : fichiers binaires servis tels quels
  assetsInclude: ["**/*.bin"],
  plugins: [react(), apiPlugin, siteUrlPlugin, seoPlugin],
  test: {
    environment: "jsdom",
  },
});
