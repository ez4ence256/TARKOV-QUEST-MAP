// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { createAppServer } from "./index.mjs";

let server: http.Server;
let base: string;
const BIG = Buffer.alloc(20000, "abcdefgh");

beforeAll(async () => {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), "tqp-static-")), "dist");
  mkdirSync(path.join(dist, "assets"), { recursive: true });
  mkdirSync(path.join(dist, "fonts"), { recursive: true });
  writeFileSync(path.join(dist, "index.html"), "<!doctype html>");
  writeFileSync(path.join(dist, "assets", "app-abc.js"), BIG);
  writeFileSync(path.join(dist, "assets", "items-abc.bin"), BIG);
  writeFileSync(path.join(dist, "fonts", "f.woff2"), BIG);
  server = createAppServer(dist);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

// fetch ajoute et décompresse seul Accept-Encoding : on le fixe et on lit les octets bruts avec http
const get = (p: string, headers: Record<string, string> = {}, method = "GET") =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    http
      .request(base + p, { method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
      })
      .on("error", reject)
      .end();
  });

describe("serveur statique", () => {
  it("ETag puis 304 sur If-None-Match", async () => {
    const first = await get("/assets/app-abc.js");
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();
    const second = await get("/assets/app-abc.js", { "If-None-Match": etag });
    expect(second.status).toBe(304);
    expect(second.body.length).toBe(0);
    expect((await get("/assets/app-abc.js", { "If-None-Match": 'W/"autre"' })).status).toBe(200);
  });

  it("politiques de cache : index.html revalidé, assets immuables, polices un an", async () => {
    expect((await get("/")).headers["cache-control"]).toBe("no-cache");
    expect((await get("/assets/app-abc.js")).headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect((await get("/fonts/f.woff2")).headers["cache-control"]).toBe("public, max-age=31536000");
  });

  it("compresse le .bin et le js (gzip), pas les polices ni sans Accept-Encoding", async () => {
    const bin = await get("/assets/items-abc.bin", { "Accept-Encoding": "gzip" });
    expect(bin.headers["content-encoding"]).toBe("gzip");
    expect(bin.headers.vary).toBe("Accept-Encoding");
    expect(bin.body.length).toBeLessThan(BIG.length / 10);
    expect(gunzipSync(bin.body).equals(BIG)).toBe(true);
    expect((await get("/assets/app-abc.js", { "Accept-Encoding": "br, gzip" })).headers["content-encoding"]).toBe("br");
    expect((await get("/fonts/f.woff2", { "Accept-Encoding": "gzip" })).headers["content-encoding"]).toBeUndefined();
    const plain = await get("/assets/items-abc.bin");
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(plain.body.equals(BIG)).toBe(true);
  });

  it("garde 404, 403 et 405 (traversée, méthode)", async () => {
    expect((await get("/absent.js")).status).toBe(404);
    expect((await get("/..%2f..%2fpackage.json")).status).toBe(403);
    expect((await get("/", {}, "POST")).status).toBe(405);
    expect((await get("/assets/app-abc.js", { "Accept-Encoding": "gzip" }, "HEAD")).body.length).toBe(0);
  });
});
