// @vitest-environment node
// Fichiers statiques : validation par ETag (304), durées de cache, compression des .bin, types MIME du référencement.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createAppServer } from "./index.mjs";

let server: http.Server;
let port: number;
const bin = Buffer.alloc(64 * 1024, "tarkov-quest-planner ");

beforeAll(async () => {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), "tqp-static-")), "dist");
  for (const dir of ["assets", "fonts/barlow", "maps/svg"]) mkdirSync(path.join(dist, dir), { recursive: true });
  writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>x</title>");
  writeFileSync(path.join(dist, "assets", "item-images-abc.bin"), bin);
  writeFileSync(path.join(dist, "assets", "app-abc.js"), "console.log(1)");
  writeFileSync(path.join(dist, "fonts", "barlow", "barlow.woff2"), "wOF2");
  writeFileSync(path.join(dist, "maps", "svg", "Customs.svg"), "<svg/>");
  writeFileSync(path.join(dist, "sitemap.xml"), "<urlset/>");
  writeFileSync(path.join(dist, "robots.txt"), "User-agent: *");
  writeFileSync(path.join(dist, "site.webmanifest"), "{}");
  server = createAppServer(dist);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

/** Requête brute (node:http) : fetch décompresse tout seul et masque Content-Encoding. */
const get = (p: string, headers: Record<string, string> = {}, method = "GET") =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) =>
    http
      .request({ host: "127.0.0.1", port, path: p, method, headers }, (r) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) }));
      })
      .on("error", reject)
      .end(),
  );

describe("requêtes conditionnelles", () => {
  it("ETag et Last-Modified sur chaque fichier ; If-None-Match identique : 304 sans corps", async () => {
    for (const p of ["/", "/maps/svg/Customs.svg", "/fonts/barlow/barlow.woff2", "/assets/app-abc.js"]) {
      const first = await get(p);
      expect(first.status).toBe(200);
      expect(first.headers.etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
      expect(first.headers["last-modified"]).toBeTruthy();
      const again = await get(p, { "If-None-Match": first.headers.etag! });
      expect(again.status).toBe(304);
      expect(again.body.length).toBe(0);
      expect(again.headers.etag).toBe(first.headers.etag);
      expect(again.headers["cache-control"]).toBe(first.headers["cache-control"]);
    }
  });

  it("If-None-Match : liste, forme forte et * acceptées ; autre valeur : 200", async () => {
    const { headers } = await get("/maps/svg/Customs.svg");
    const strong = headers.etag!.replace(/^W\//, "");
    expect((await get("/maps/svg/Customs.svg", { "If-None-Match": `"autre", ${strong}` })).status).toBe(304);
    expect((await get("/maps/svg/Customs.svg", { "If-None-Match": "*" })).status).toBe(304);
    expect((await get("/maps/svg/Customs.svg", { "If-None-Match": '"autre"' })).status).toBe(200);
  });

  it("If-Modified-Since : 304 si le fichier n'a pas changé depuis, 200 sinon ; If-None-Match passe avant", async () => {
    const { headers } = await get("/maps/svg/Customs.svg");
    const modified = headers["last-modified"]!;
    expect((await get("/maps/svg/Customs.svg", { "If-Modified-Since": modified })).status).toBe(304);
    expect((await get("/maps/svg/Customs.svg", { "If-Modified-Since": new Date(Date.parse(modified) - 60_000).toUTCString() })).status).toBe(200);
    expect((await get("/maps/svg/Customs.svg", { "If-Modified-Since": "pas une date" })).status).toBe(200);
    expect((await get("/maps/svg/Customs.svg", { "If-None-Match": '"autre"', "If-Modified-Since": modified })).status).toBe(200);
  });

  it("un fichier absent reste un 404 sans cache, même avec If-None-Match: *", async () => {
    const r = await get("/assets/absent-123.js", { "If-None-Match": "*" });
    expect(r.status).toBe(404);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("durées de cache", () => {
  it("polices : 30 jours ; fonds de carte : 5 minutes ; assets : définitif ; index.html : revalidé", async () => {
    expect((await get("/fonts/barlow/barlow.woff2")).headers["cache-control"]).toBe("public, max-age=2592000");
    expect((await get("/maps/svg/Customs.svg")).headers["cache-control"]).toBe("public, max-age=300");
    expect((await get("/assets/app-abc.js")).headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect((await get("/")).headers["cache-control"]).toBe("no-cache");
  });
});

describe("compression des fichiers .bin", () => {
  it("gzip si le client l'accepte, contenu intact, sans Content-Length", async () => {
    const r = await get("/assets/item-images-abc.bin", { "Accept-Encoding": "br, gzip" });
    expect(r.status).toBe(200);
    expect(r.headers["content-encoding"]).toBe("gzip");
    expect(r.headers.vary).toBe("Accept-Encoding");
    expect(r.headers["content-length"]).toBeUndefined();
    expect(r.body.length).toBeLessThan(bin.length / 10);
    expect(gunzipSync(r.body).equals(bin)).toBe(true);
  });

  it("sans Accept-Encoding: gzip : fichier brut avec sa taille", async () => {
    const r = await get("/assets/item-images-abc.bin");
    expect(r.headers["content-encoding"]).toBeUndefined();
    expect(r.headers["content-length"]).toBe(String(bin.length));
    expect(r.body.equals(bin)).toBe(true);
  });

  it("HEAD : en-têtes seulement ; les autres types ne sont pas compressés ici", async () => {
    const head = await get("/assets/item-images-abc.bin", { "Accept-Encoding": "gzip" }, "HEAD");
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    const js = await get("/assets/app-abc.js", { "Accept-Encoding": "gzip" });
    expect(js.headers["content-encoding"]).toBeUndefined();
    expect(js.headers["content-length"]).toBe(String("console.log(1)".length));
  });
});

describe("fichiers du référencement", () => {
  it("types MIME de sitemap.xml, robots.txt et du manifeste", async () => {
    expect((await get("/sitemap.xml")).headers["content-type"]).toBe("application/xml; charset=utf-8");
    expect((await get("/robots.txt")).headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect((await get("/site.webmanifest")).headers["content-type"]).toBe("application/manifest+json; charset=utf-8");
  });
});
