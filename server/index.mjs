// Serveur de production (`npm start`) : sert dist/ et le service de rooms sur le MÊME port.
// Un fichier absent reçoit un vrai 404 sans cache (jamais index.html) : l'appli n'a pas de routes côté client.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { brotliCompress, constants as zc, gzip } from "node:zlib";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { handleRooms } from "./rooms.mjs";
import { handleMonitor } from "./monitor.mjs";
import { handlePhone } from "./phone.mjs";
import { handleWiki } from "./wiki.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
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

// types compressibles (les .bin des images d'objets pèsent 5 Mo -> 1,4 Mo) ; png, webp, woff2… le sont déjà
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".map", ".webmanifest", ".txt", ".md", ".svg", ".xml", ".wasm", ".bin"]);
const MIN_COMPRESS = 1024;
const ENCODERS = {
  br: (buf) => promisify(brotliCompress)(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } }),
  gzip: (buf) => promisify(gzip)(buf, { level: 6 }),
};
// fichier de dist/ + empreinte + encodage -> copie compressée (dist/ est petit : pas de purge)
const compressed = new Map();

function pickEncoding(header) {
  const accepted = String(header ?? "").split(",").map((e) => e.split(";")[0].trim().toLowerCase());
  return accepted.includes("br") ? "br" : accepted.includes("gzip") ? "gzip" : null;
}

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
  const ext = path.extname(file).toLowerCase();
  const inFonts = file.startsWith(path.join(dist, "fonts") + path.sep);
  // faible : la même validation sert la copie brute et les copies compressées
  const etag = `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    // assets/ est nommé par empreinte : cache définitif ; index.html est revalidé à chaque fois ;
    // les polices (fonts/, sans empreinte dans le nom) : un an
    "Cache-Control": isHtml ? "no-cache" : inAssets ? "public, max-age=31536000, immutable" : inFonts ? "public, max-age=31536000" : "public, max-age=300",
    ETag: etag,
    Vary: "Accept-Encoding",
  };
  const noneMatch = req.headers["if-none-match"];
  if (noneMatch && (noneMatch === "*" || noneMatch.split(",").some((t) => t.trim() === etag))) {
    res.writeHead(304, headers);
    return res.end();
  }
  const encoding = COMPRESSIBLE.has(ext) && info.size >= MIN_COMPRESS ? pickEncoding(req.headers["accept-encoding"]) : null;
  if (encoding) {
    const key = `${file}|${etag}|${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      body = await ENCODERS[encoding](await readFile(file));
      compressed.set(key, body);
    }
    res.writeHead(200, { ...headers, "Content-Encoding": encoding, "Content-Length": body.length });
    return res.end(req.method === "HEAD" ? undefined : body);
  }
  res.writeHead(200, { ...headers, "Content-Length": info.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

/** Crée le serveur HTTP (sans l'écouter). */
export function createAppServer(dist = DEFAULT_DIST) {
  const root = path.resolve(dist);
  return createServer((req, res) => {
    if (handleRooms(req, res) || handleMonitor(req, res) || handlePhone(req, res) || handleWiki(req, res)) return;
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
