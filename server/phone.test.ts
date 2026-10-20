// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "./index.mjs";
import { LIMITS, ageSession, looksLikeImage, resetPhone } from "./phone.mjs";

let server: http.Server;
let base: string;

beforeAll(async () => {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), "tqp-phone-")), "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, "index.html"), "<!doctype html>");
  server = createAppServer(dist);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
afterEach(() => resetPhone());

const jpeg = (n = 100, fill = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, fill)]);
const newCode = async () => ((await (await fetch(`${base}/api/phone`, { method: "POST" })).json()) as { code: string }).code;
const upload = (code: string, body: Buffer, type = "image/jpeg") =>
  fetch(`${base}/api/phone/${code}/photo`, { method: "POST", headers: { "Content-Type": type }, body });
const done = (code: string) => fetch(`${base}/api/phone/${code}/done`, { method: "POST" });

/** Client SSE minimal : accumule les messages { event, data }. */
function sse(code: string) {
  const events: { event: string; data: Record<string, unknown> }[] = [];
  const req = http.get(`${base}/api/phone/${code}/events`);
  const ready = new Promise<http.IncomingMessage>((resolve) =>
    req.on("response", (r) => {
      r.setEncoding("utf8");
      if (r.statusCode === 200) {
        let buf = "";
        r.on("data", (c: string) => {
          buf += c;
          for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const m = /^event: (\w+)\ndata: (.*)$/s.exec(block);
            if (m) events.push({ event: m[1], data: JSON.parse(m[2]) });
          }
        });
      }
      resolve(r);
    }),
  );
  const waitFor = async (n: number) => {
    for (let i = 0; i < 100 && events.length < n; i++) await new Promise((r) => setTimeout(r, 20));
    if (events.length < n) throw new Error(`événements reçus : ${JSON.stringify(events)}`);
  };
  return { events, ready, waitFor, close: () => req.destroy() };
}

describe("session", () => {
  it("crée un code de 24 caractères alphanumériques, tous différents", async () => {
    const codes = await Promise.all([newCode(), newCode(), newCode()]);
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(new Set(codes).size).toBe(3);
  });

  it("400 code invalide, 404 session inconnue ou expirée", async () => {
    expect((await fetch(`${base}/api/phone/court/events`)).status).toBe(400);
    expect((await upload("A".repeat(24), jpeg())).status).toBe(404);
    const code = await newCode();
    ageSession(code, LIMITS.ttlMs + 1000);
    expect((await upload(code, jpeg())).status).toBe(404);
  });

  it("429 au-delà de 10 créations par minute et par IP", async () => {
    for (let i = 0; i < LIMITS.createPerIpPerMin; i++) expect((await fetch(`${base}/api/phone`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${base}/api/phone`, { method: "POST" })).status).toBe(429);
  });
});

describe("photos", () => {
  it("looksLikeImage reconnaît JPEG, PNG, WebP", () => {
    expect(looksLikeImage(jpeg())).toBe(true);
    expect(looksLikeImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(20)]))).toBe(true);
    expect(looksLikeImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))).toBe(true);
    expect(looksLikeImage(Buffer.from("<html>pas une image</html>"))).toBe(false);
  });

  it("envoi, suppression, fin, puis lecture unique", async () => {
    const code = await newCode();
    const pc = sse(code);
    expect((await pc.ready).statusCode).toBe(200);
    await pc.waitFor(1); // compte initial
    const a = (await (await upload(code, jpeg(50, 7))).json()) as { id: string };
    const b = (await (await upload(code, jpeg(60, 8))).json()) as { id: string };
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
    await pc.waitFor(3);
    expect(pc.events[2]).toEqual({ event: "photos", data: { count: 2 } });
    expect((await fetch(`${base}/api/phone/${code}/photo/${a.id}`, { method: "DELETE" })).status).toBe(200);
    await pc.waitFor(4);
    expect(pc.events[3].data).toEqual({ count: 1 });
    expect((await done(code)).status).toBe(200);
    await pc.waitFor(5);
    expect(pc.events[4]).toEqual({ event: "done", data: { ids: [b.id] } });
    // plus d'envoi ni de suppression après la fin
    expect((await upload(code, jpeg())).status).toBe(409);
    const r = await fetch(`${base}/api/phone/${code}/photo/${b.id}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await r.arrayBuffer()).equals(jpeg(60, 8))).toBe(true);
    expect((await fetch(`${base}/api/phone/${code}/photo/${b.id}`)).status).toBe(404); // lue une fois
    expect((await fetch(`${base}/api/phone/${code}/photo/${b.id}`)).status).toBe(404); // session effacée
    pc.close();
  });

  it("refuse : type, contenu, taille, nombre, fin sans photo, id invalide", async () => {
    const code = await newCode();
    expect((await upload(code, jpeg(), "text/plain")).status).toBe(415);
    expect((await upload(code, Buffer.from("<html>pas une image</html>"))).status).toBe(400);
    expect((await upload(code, jpeg(LIMITS.maxPhotoBytes))).status).toBe(413);
    expect((await done(code)).status).toBe(400);
    expect((await fetch(`${base}/api/phone/${code}/photo/zz`, { method: "DELETE" })).status).toBe(400);
    for (let i = 0; i < LIMITS.maxPhotos; i++) expect((await upload(code, jpeg(10))).status).toBe(200);
    expect((await upload(code, jpeg(10))).status).toBe(409);
  });

  it("2 écouteurs au plus", async () => {
    const code = await newCode();
    const all = [sse(code), sse(code)];
    for (const s of all) expect((await s.ready).statusCode).toBe(200);
    const extra = sse(code);
    expect((await extra.ready).statusCode).toBe(429);
    for (const s of [...all, extra]) s.close();
  });

  it("503 quand la mémoire totale est pleine", async () => {
    const big = jpeg(LIMITS.maxPhotoBytes - 10);
    const per = Math.floor(LIMITS.maxTotalBytes / big.length);
    let status = 200;
    for (let i = 0; i < per + 1 && status === 200; i++) {
      const code = await newCode();
      for (let j = 0; j < LIMITS.maxPhotos && status === 200; j++) {
        status = (await upload(code, big)).status;
        if (status === 409) break;
      }
    }
    expect(status).toBe(503);
  });
});

describe("adresse réseau du PC (QR code en local)", () => {
  const lan = (host: string) =>
    new Promise<{ origins: string[] }>((resolve, reject) => {
      const url = new URL(`${base}/api/phone/lan`);
      http
        .get({ hostname: url.hostname, port: url.port, path: url.pathname, headers: { Host: host } }, (r) => {
          let body = "";
          r.setEncoding("utf8");
          r.on("data", (c) => (body += c));
          r.on("end", () => resolve(JSON.parse(body)));
        })
        .on("error", reject);
    });

  it("donnée à une page ouverte en localhost sur le PC, jamais derrière un nom de domaine", async () => {
    const local = await lan(`localhost:${new URL(base).port}`);
    expect(Array.isArray(local.origins)).toBe(true);
    for (const o of local.origins) expect(o).toMatch(new RegExp(String.raw`^http://\d+\.\d+\.\d+\.\d+:` + new URL(base).port + "$"));
    expect((await lan("tarkov.aprilox.fr")).origins).toEqual([]);
  });
});
