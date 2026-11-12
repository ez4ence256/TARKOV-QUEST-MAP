// Serveur de production (`npm start`) : sert dist/ et le service de rooms sur le MÊME port.
// Un fichier absent reçoit un vrai 404 sans cache (jamais index.html) : l'appli n'a pas de routes côté client.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { handleApi } from "./api.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
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

/** Extensions compressées à la volée (rarement demandées, puis gardées un an par le navigateur). */
const GZIPPED = new Set([".bin"]);

/**
 * Durée de cache côté navigateur.
 * assets/ est nommé par empreinte : cache définitif ; index.html est revalidé à chaque fois ;
 * les polices ne changent jamais sous le même nom : 30 jours ; le reste (fonds de carte…) : 5 minutes,
 * puis une simple revalidation par ETag (304), sans retéléchargement.
 */
function cacheControl(dist, file) {
  if (path.basename(file) === "index.html") return "no-cache";
  const [top] = path.relative(dist, file).split(path.sep);
  if (top === "assets") return "public, max-age=31536000, immutable";
  if (top === "fonts") return "public, max-age=2592000";
  return "public, max-age=300";
}

/** ETag faible : taille + date de modification (change à chaque déploiement, jamais entre deux). */
const etagOf = (info) => `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;

/** Requête conditionnelle satisfaite ? If-None-Match passe avant If-Modified-Since (RFC 9110). */
function isFresh(req, etag, info) {
  const noneMatch = req.headers["if-none-match"];
  if (noneMatch) {
    const bare = (t) => t.trim().replace(/^W\//, "");
    return noneMatch.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
  }
  const since = Date.parse(String(req.headers["if-modified-since"] ?? ""));
  // les dates HTTP sont à la seconde près
  return Number.isFinite(since) && Math.floor(info.mtimeMs / 1000) * 1000 <= since;
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
  const ext = path.extname(file).toLowerCase();
  const etag = etagOf(info);
  const headers = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl(dist, file),
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
  };
  // Le navigateur a déjà cette version : 304 sans corps (polices, fonds de carte et index.html ne sont plus retéléchargés)
  if (isFresh(req, etag, info)) {
    res.writeHead(304, headers);
    return res.end();
  }
  // Fichiers binaires de l'app (index d'images de l'item finder, 5 Mo) : `application/octet-stream` n'est pas dans la
  // liste des types que Cloudflare compresse par défaut ; compressé ici, il le transmet tel quel (~1,6 Mo)
  const gzip = GZIPPED.has(ext) && /\bgzip\b/i.test(String(req.headers["accept-encoding"] ?? ""));
  if (gzip) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  } else {
    headers["Content-Length"] = info.size;
  }
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  const stream = createReadStream(file).on("error", () => res.destroy());
  if (gzip) stream.pipe(createGzip({ level: 6 })).on("error", () => res.destroy()).pipe(res);
  else stream.pipe(res);
}

/** Crée le serveur HTTP (sans l'écouter). */
export function createAppServer(dist = DEFAULT_DIST) {
  const root = path.resolve(dist);
  return createServer((req, res) => {
    if (handleApi(req, res)) return;
    serveStatic(req, res, root).catch(() => {
      if (!res.headersSent) plain(res, 500, "Server error");
      else res.destroy();
    });
  });
}

// Lancé directement (`node server/index.mjs`) et non importé par les tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createAppServer().listen(port, () => console.log(`Quest Planner : http://localhost:${port} (dist/ + rooms + monitor + wiki)`));
}
