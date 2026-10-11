// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "./index.mjs";
import { LIMITS, resetRooms, roomCount, validateOps, validateState } from "./rooms.mjs";

let server: http.Server;
let base: string;
let port: number;
const secret = "SECRET-HORS-DIST";

beforeAll(async () => {
  const root = mkdtempSync(path.join(tmpdir(), "tqp-"));
  const dist = path.join(root, "dist");
  mkdirSync(path.join(dist, "assets"), { recursive: true });
  writeFileSync(path.join(root, "secret.txt"), secret);
  writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>x</title>");
  writeFileSync(path.join(dist, "assets", "app-abc.js"), "console.log(1)");
  writeFileSync(path.join(dist, "style.css"), "a{}");
  writeFileSync(path.join(dist, "core.wasm"), "\0asm");
  server = createAppServer(dist);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
afterEach(() => resetRooms());

const post = (p: string, body: unknown, method = "POST") =>
  fetch(base + p, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Client SSE minimal (node:http) : accumule les messages `data:` JSON. */
function sse(id: string, client: string) {
  const events: Record<string, unknown>[] = [];
  const req = http.get(`${base}/api/rooms/${id}/events?client=${client}`);
  const ready = new Promise<http.IncomingMessage>((resolve) =>
    req.on("response", (r) => {
      let buf = "";
      r.setEncoding("utf8");
      r.on("data", (c: string) => {
        buf += c;
        for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (block.startsWith("data: ")) events.push(JSON.parse(block.slice(6)));
        }
      });
      resolve(r);
    }),
  );
  const waitFor = async (type: string, n = 1) => {
    for (let i = 0; i < 100; i++) {
      const found = events.filter((e) => e.type === type);
      if (found.length >= n) return found[n - 1];
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`pas de message ${type} : ${JSON.stringify(events)}`);
  };
  return { events, ready, waitFor, close: () => req.destroy() };
}

const create = async (state = {}) => ((await (await post("/api/rooms", { mode: "pve", state })).json()) as { id: string }).id;

describe("validation", () => {
  it("opérations : formes et identifiants", () => {
    expect(validateOps([{ kind: "task", id: "abc", on: true }])).toHaveLength(1);
    expect(validateOps([{ kind: "task", id: "a<b", on: true }])).toBeNull();
    expect(validateOps([{ kind: "task", id: "a".repeat(101), on: true }])).toBeNull();
    expect(validateOps([{ kind: "story", id: "a".repeat(201), on: true }])).toBeNull();
    expect(validateOps([{ kind: "story", id: "Chapitre un::étape#1", on: false }])).toHaveLength(1);
    expect(validateOps([{ kind: "x", id: "a", on: true }])).toBeNull();
    expect(validateOps([{ kind: "task", id: "a", on: 1 }])).toBeNull();
    expect(validateOps(Array.from({ length: LIMITS.maxOps + 1 }, () => ({ kind: "task", id: "a", on: true })))).toBeNull();
  });
  it("état : listes de chaînes valides", () => {
    expect(validateState({ selected: ["a"] })?.selected.has("a")).toBe(true);
    expect(validateState({ selected: [1] })).toBeNull();
    expect(validateState({ selected: "a" })).toBeNull();
  });
});

describe("rooms (serveur réel)", () => {
  it("crée une room (ID de 6 caractères sans 0/O/1/I/L) et refuse les corps invalides", async () => {
    const id = await create();
    expect(id).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect((await post("/api/rooms", { mode: "nope", state: {} })).status).toBe(400);
    expect((await post("/api/rooms", { mode: "pve", state: { selected: ["<script>"] } })).status).toBe(400);
    const bad = await fetch(`${base}/api/rooms`, { method: "POST", body: "{pas du json" });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("content-type")).toContain("application/json");
  });

  it("corps trop gros : 413", async () => {
    const r = await post("/api/rooms", { mode: "pve", state: { selected: ["x".repeat(LIMITS.maxBody)] } });
    expect(r.status).toBe(413);
  });

  it("room inconnue : 404 JSON, aussi pour les événements et les opérations", async () => {
    for (const [method, p] of [
      ["GET", "/api/rooms/ABCDEF/events"],
      ["GET", "/api/rooms/ABCDEF"],
      ["POST", "/api/rooms/ABCDEF/ops"],
    ]) {
      const r = await fetch(base + p, { method, body: method === "POST" ? "{}" : undefined });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: "unknown-room" });
    }
  });

  it("deux clients : snapshot à la connexion, opérations diffusées à l'autre seulement", async () => {
    const id = await create({ selected: ["q1"], done: ["o1"] });
    const a = sse(id, "clientA");
    const res = await a.ready;
    expect(res.headers["content-type"]).toBe("text/event-stream");
    expect(res.headers["cache-control"]).toContain("no-cache");
    expect(res.headers["x-accel-buffering"]).toBe("no");
    expect(await a.waitFor("snapshot")).toMatchObject({ mode: "pve", state: { selected: ["q1"], done: ["o1"] }, members: 1 });

    const b = sse(id, "clientB");
    await b.ready;
    await b.waitFor("snapshot");
    expect(await a.waitFor("members", 1)).toMatchObject({ members: 2 });

    const ops = [
      { kind: "task", id: "q2", on: true },
      { kind: "done", id: "o1", on: false },
      { kind: "story", id: "Tour", on: true },
    ];
    expect((await post(`/api/rooms/${id}/ops`, { client: "clientA", ops })).status).toBe(200);
    expect(await b.waitFor("op")).toMatchObject({ from: "clientA", ops });
    expect(a.events.some((e) => e.type === "op")).toBe(false);

    // un nouvel arrivant reçoit l'état cumulé
    const c = sse(id, "clientC");
    await c.ready;
    expect(await c.waitFor("snapshot")).toMatchObject({ state: { selected: ["q1", "q2"], done: [], storySelected: ["Tour"] }, members: 3 });
    [a, b, c].forEach((x) => x.close());
  });

  it("opérations invalides refusées sans rien appliquer", async () => {
    const id = await create();
    const r = await post(`/api/rooms/${id}/ops`, {
      client: "c1",
      ops: [
        { kind: "task", id: "ok", on: true },
        { kind: "task", id: "<x>", on: true },
      ],
    });
    expect(r.status).toBe(400);
    const a = sse(id, "c2");
    await a.ready;
    expect(await a.waitFor("snapshot")).toMatchObject({ state: { selected: [] } });
    a.close();
  });

  it("PUT recrée la room avec le même ID, sans écraser une room existante", async () => {
    const r = await post("/api/rooms/ABCDEF", { mode: "regular", state: { selected: ["q9"] } }, "PUT");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: "ABCDEF" });
    const again = await post("/api/rooms/ABCDEF", { mode: "regular", state: { selected: [] } }, "PUT");
    expect(await again.json()).toEqual({ id: "ABCDEF", existed: true });
    expect((await post("/api/rooms/abc0ef", { mode: "regular", state: {} }, "PUT")).status).toBe(400);
    const a = sse("ABCDEF", "c1");
    await a.ready;
    expect(await a.waitFor("snapshot")).toMatchObject({ mode: "regular", state: { selected: ["q9"] } });
    a.close();
  });

  it("plafond de rooms", async () => {
    const digit = (n: number) => "23456789"[n % 8];
    for (let i = 0; i < LIMITS.maxRooms; i++) {
      const id = `${digit(i)}${digit(i >> 3)}${digit(i >> 6)}${digit(i >> 9)}AA`;
      expect((await post(`/api/rooms/${id}`, { mode: "pve", state: {} }, "PUT")).status).toBe(200);
    }
    expect(roomCount()).toBe(LIMITS.maxRooms);
    expect((await post("/api/rooms", { mode: "pve", state: {} })).status).toBe(503);
  }, 30_000);
});

describe("fichiers statiques", () => {
  it("MIME et cache", async () => {
    const js = await fetch(`${base}/assets/app-abc.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("text/javascript");
    expect(js.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await fetch(`${base}/style.css`)).headers.get("content-type")).toContain("text/css");
    expect((await fetch(`${base}/core.wasm`)).headers.get("content-type")).toBe("application/wasm");
    for (const p of ["/", "/index.html"]) {
      const html = await fetch(base + p);
      expect(html.headers.get("content-type")).toContain("text/html");
      expect(html.headers.get("cache-control")).toBe("no-cache");
    }
  });

  it("fichier absent : 404 sans cache, jamais index.html", async () => {
    const r = await fetch(`${base}/assets/absent-123.js`);
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.text()).not.toContain("<!doctype");
  });

  it("traversée de chemin bloquée", async () => {
    for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/..%5csecret.txt", "/%00"]) {
      const res = await new Promise<{ status: number; text: string }>((resolve) =>
        http.get({ host: "127.0.0.1", port, path: p }, (r) => {
          let text = "";
          r.on("data", (c) => (text += c));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, text }));
        }),
      );
      expect(res.status).not.toBe(200);
      expect(res.text).not.toContain(secret);
    }
  });
});
