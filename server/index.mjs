// Serveur de production (`npm start`) : sert dist/ et le service de rooms sur le MÊME port.
// Un fichier absent reçoit un vrai 404 sans cache (jamais index.html) : l'appli n'a pas de routes côté client.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { handleRooms } from "./rooms.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".traineddata": "application/octet-stream",
};

const DEFAULT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

function plain(res, status, text, extra = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(text);
}

async function serveStatic(req, res, dist) {
  if (req.method !== "GET" && req.method !== "HEAD") return plain(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    return plain(res, 400, "Bad request");
  }
  if (pathname.includes("\0")) return plain(res, 400, "Bad request");
  let file = path.join(dist, pathname);
  // anti-traversée : le chemin résolu doit rester dans dist/
  if (file !== dist && !file.startsWith(dist + path.sep)) return plain(res, 403, "Forbidden");
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = path.join(file, "index.html");
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) return plain(res, 404, "Not found");
  const isHtml = path.basename(file) === "index.html";
  const inAssets = file.startsWith(path.join(dist, "assets") + path.sep);
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": info.size,
    "X-Content-Type-Options": "nosniff",
    // assets/ est nommé par empreinte : cache définitif ; index.html est revalidé à chaque fois
    "Cache-Control": isHtml ? "no-cache" : inAssets ? "public, max-age=31536000, immutable" : "public, max-age=300",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

/** Crée le serveur HTTP (sans l'écouter). */
export function createAppServer(dist = DEFAULT_DIST) {
  const root = path.resolve(dist);
  return createServer((req, res) => {
    if (handleRooms(req, res)) return;
    serveStatic(req, res, root).catch(() => {
      if (!res.headersSent) plain(res, 500, "Server error");
      else res.destroy();
    });
  });
}

// Lancé directement (`node server/index.mjs`) et non importé par les tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createAppServer().listen(port, () => console.log(`Quest Planner : http://localhost:${port} (dist/ + rooms)`));
}
