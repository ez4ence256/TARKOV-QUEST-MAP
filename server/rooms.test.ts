// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "./index.mjs";
import { LIMITS, cleanName, resetRooms, roomCount, validateSnapshot } from "./rooms.mjs";

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
function sse(id: string, client: string, query = "v=2") {
  const events: Record<string, unknown>[] = [];
  const req = http.get(`${base}/api/rooms/${id}/events?${query}&client=${client}`);
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

const create = async (mode = "pve") => ((await (await post("/api/rooms", { v: 2, mode })).json()) as { id: string }).id;
const snap = (extra: Record<string, unknown> = {}) => ({ selected: [], done: [], manual: [], storySelected: [], storyDone: [], ...extra });
const publish = (id: string, client: string, snapshot: unknown, name: unknown = "Alice") =>
  post(`/api/rooms/${id}/publish`, { v: 2, client, name, snapshot });

describe("validation", () => {
  it("instantané : formes et identifiants", () => {
    const ok = snap({
      selected: [{ taskId: "abc", color: 3 }],
      done: ["o1"],
      manual: [{ objectiveId: "o1", mapId: "customs", x: 1, z: -2 }],
      storySelected: ["Chapitre un"],
      storyDone: ["Chapitre un::étape#1"],
    });
    expect(validateSnapshot(ok)).toEqual(ok);
    expect(validateSnapshot(snap({ selected: [{ taskId: "a<b", color: 0 }] }))).toBeNull();
    expect(validateSnapshot(snap({ selected: [{ taskId: "a", color: 1.5 }] }))).toBeNull();
    expect(validateSnapshot(snap({ done: ["a".repeat(101)] }))).toBeNull();
    expect(validateSnapshot(snap({ done: [1] }))).toBeNull();
    expect(validateSnapshot(snap({ storySelected: ["a".repeat(201)] }))).toBeNull();
    expect(validateSnapshot(snap({ manual: [{ objectiveId: "o", mapId: "Bad Map", x: 0, z: 0 }] }))).toBeNull();
    expect(validateSnapshot(snap({ manual: [{ objectiveId: "o", mapId: "m", x: 1e9, z: 0 }] }))).toBeNull();
    expect(validateSnapshot(snap({ manual: [{ objectiveId: "o", mapId: "m", x: NaN, z: 0 }] }))).toBeNull();
    expect(validateSnapshot({ ...snap(), done: undefined })).toBeNull();
    expect(validateSnapshot(null)).toBeNull();
  });
  it("instantané : plafonds", () => {
    expect(validateSnapshot(snap({ selected: Array.from({ length: LIMITS.maxSelected + 1 }, () => ({ taskId: "a", color: 0 })) }))).toBeNull();
    expect(validateSnapshot(snap({ done: Array.from({ length: LIMITS.maxDone + 1 }, () => "a") }))).toBeNull();
    expect(validateSnapshot(snap({ manual: Array.from({ length: LIMITS.maxManual + 1 }, () => ({ objectiveId: "o", mapId: "m", x: 0, z: 0 })) }))).toBeNull();
    expect(validateSnapshot(snap({ storySelected: Array.from({ length: LIMITS.maxStorySelected + 1 }, () => "a") }))).toBeNull();
    expect(validateSnapshot(snap({ storyDone: Array.from({ length: LIMITS.maxStoryDone + 1 }, () => "a") }))).toBeNull();
  });
  it("instantané : position", () => {
    const position = { map: "customs", x: 1, y: 2, z: 3, rotation: 90, gameMode: "pve", at: Date.now() };
    expect(validateSnapshot(snap({ position }))?.position).toEqual(position);
    expect(validateSnapshot(snap({ position: { ...position, gameMode: "x" } }))).toBeNull();
    expect(validateSnapshot(snap({ position: { ...position, y: Infinity } }))).toBeNull();
    expect(validateSnapshot(snap({ position: { ...position, map: "A B" } }))).toBeNull();
    // heure de capture bornée : jamais dans le futur ni négative
    const future = validateSnapshot(snap({ position: { ...position, at: Date.now() + 3_600_000 } }))?.position as { at: number };
    expect(future.at).toBeLessThanOrEqual(Date.now());
    expect((validateSnapshot(snap({ position: { ...position, at: -5 } }))?.position as { at: number }).at).toBe(0);
  });
  it("pseudo : rogné, 20 caractères, sans caractères de contrôle, « Joueur » si vide", () => {
    expect(cleanName("  Alice  ")).toBe("Alice");
    expect(cleanName("a".repeat(50))).toBe("a".repeat(20));
    expect(cleanName("Al\u0000i\nce\u007f")).toBe("Alice");
    expect(cleanName(" \u0001 ")).toBe("Joueur");
    expect(cleanName("")).toBe("Joueur");
    expect(cleanName(42)).toBeNull();
  });
});

describe("rooms (serveur réel)", () => {
  it("crée une room (ID de 6 caractères sans 0/O/1/I/L) et refuse les corps invalides", async () => {
    const id = await create();
    expect(id).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect((await post("/api/rooms", { v: 2, mode: "nope" })).status).toBe(400);
    const bad = await fetch(`${base}/api/rooms`, { method: "POST", body: "{pas du json" });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("content-type")).toContain("application/json");
  });

  it("protocole v1 refusé avec une erreur claire, sans rien appliquer", async () => {
    const protocol = { error: "protocol", message: "Recharge la page : la room a été mise à jour." };
    const r1 = await post("/api/rooms", { mode: "pve", state: {} });
    expect(r1.status).toBe(400);
    expect(await r1.json()).toEqual(protocol);
    expect(roomCount()).toBe(0);
    expect(await (await post("/api/rooms/ABCDEF", { mode: "pve", state: {} }, "PUT")).json()).toEqual(protocol);
    const id = await create();
    expect(await (await fetch(`${base}/api/rooms/${id}`)).json()).toEqual(protocol); // GET sans v
    expect(await (await fetch(`${base}/api/rooms/${id}/events?client=c1`)).json()).toEqual(protocol);
    const ops = await post(`/api/rooms/${id}/ops`, { client: "c1", ops: [] }); // ancienne route
    expect(ops.status).toBe(400);
    expect(await ops.json()).toEqual(protocol);
    expect(await (await post("/api/rooms/ABCDEF/ops", { client: "c1", ops: [] })).json()).toEqual(protocol); // même pour une room inconnue
    const old = await post(`/api/rooms/${id}/publish`, { client: "c1", snapshot: snap() });
    expect(await old.json()).toEqual(protocol);
    const a = sse(id, "c2");
    await a.ready;
    await a.waitFor("hello");
    expect(a.events.some((e) => e.type === "member")).toBe(false);
    a.close();
  });

  it("corps trop gros : 413", async () => {
    const id = await create();
    const r = await post(`/api/rooms/${id}/publish`, { v: 2, client: "c1", name: "x", snapshot: snap({ done: ["x".repeat(LIMITS.maxBody)] }) });
    expect(r.status).toBe(413);
  });

  it("room inconnue : 404 JSON, aussi pour les événements et la publication", async () => {
    for (const [method, p] of [
      ["GET", "/api/rooms/ABCDEF/events?v=2&client=c1"],
      ["GET", "/api/rooms/ABCDEF?v=2"],
      ["POST", "/api/rooms/ABCDEF/publish"],
    ]) {
      const r = await fetch(base + p, { method, body: method === "POST" ? "{}" : undefined });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: "unknown-room" });
    }
  });

  it("deux clients : chacun reçoit l'instantané de l'autre, jamais le sien", async () => {
    const id = await create();
    const a = sse(id, "clientA");
    const res = await a.ready;
    expect(res.headers["content-type"]).toBe("text/event-stream");
    expect(res.headers["cache-control"]).toContain("no-cache");
    expect(res.headers["x-accel-buffering"]).toBe("no");
    expect(await a.waitFor("hello")).toMatchObject({ mode: "pve", members: [{ id: "clientA", name: "Joueur", connected: true }] });

    const sa = snap({ selected: [{ taskId: "q1", color: 0 }], done: ["o1"] });
    expect((await publish(id, "clientA", sa, "Alice")).status).toBe(200);

    // B arrive après : il reçoit tout de suite l'instantané déjà publié par A
    const b = sse(id, "clientB");
    await b.ready;
    expect(await b.waitFor("member")).toMatchObject({ id: "clientA", name: "Alice", snapshot: sa });
    expect(await a.waitFor("members", 1)).toMatchObject({ members: [{ id: "clientA" }, { id: "clientB" }] });

    const sb = snap({ storySelected: ["Tour"] });
    expect((await publish(id, "clientB", sb, "Bob")).status).toBe(200);
    const got = await a.waitFor("member");
    expect(got).toMatchObject({ id: "clientB", name: "Bob", snapshot: sb });
    expect(typeof got.at).toBe("number");
    expect(a.events.filter((e) => e.type === "member" && e.id === "clientA")).toHaveLength(0);
    expect(b.events.filter((e) => e.type === "member" && e.id === "clientB")).toHaveLength(0);
    [a, b].forEach((x) => x.close());
  });

  it("reconnexion : le membre republie, le dernier instantané remplace l'ancien", async () => {
    const id = await create();
    const a = sse(id, "clientA");
    await a.ready;
    await publish(id, "clientA", snap({ done: ["old"] }));
    a.close();
    await new Promise((r) => setTimeout(r, 100));
    const b = sse(id, "clientB");
    await b.ready;
    expect(await b.waitFor("hello")).toMatchObject({ members: [{ id: "clientA", connected: false }, { id: "clientB", connected: true }] });
    const a2 = sse(id, "clientA"); // même identifiant : même membre
    await a2.ready;
    await publish(id, "clientA", snap({ done: ["new"] }));
    const last = (await b.waitFor("member", 2)) as { snapshot: { done: string[] } };
    expect(last.snapshot.done).toEqual(["new"]);
    [a2, b].forEach((x) => x.close());
  });

  it("publications invalides refusées sans rien diffuser", async () => {
    const id = await create();
    const a = sse(id, "c2");
    await a.ready;
    await a.waitFor("hello");
    expect((await publish(id, "c1", snap({ done: ["<x>"] }))).status).toBe(400);
    expect((await publish(id, "c1", "pas un objet")).status).toBe(400);
    expect((await publish(id, "bad id!", snap())).status).toBe(400);
    expect((await publish(id, "c1", snap(), 42)).status).toBe(400);
    expect((await post(`/api/rooms/${id}/publish`, { v: 2, client: "c1", snapshot: snap() })).status).toBe(200); // pseudo absent : « Joueur »
    await new Promise((r) => setTimeout(r, 80));
    expect(a.events.filter((e) => e.type === "member")).toHaveLength(1);
    a.close();
  });

  it("pseudo long ou avec caractères de contrôle : nettoyé avant diffusion", async () => {
    const id = await create();
    const a = sse(id, "c2");
    await a.ready;
    await publish(id, "c1", snap(), `  ${"é".repeat(30)}\u0007\n `);
    expect(await a.waitFor("member")).toMatchObject({ name: "é".repeat(20) });
    await publish(id, "c1", snap(), "\u0001\u0002");
    expect(await a.waitFor("member", 2)).toMatchObject({ name: "Joueur" });
    a.close();
  });

  it("limite de publications par seconde", async () => {
    const id = await create();
    const codes: number[] = [];
    for (let i = 0; i < LIMITS.publishPerSec + 3; i++) codes.push((await publish(id, "c1", snap())).status);
    expect(codes.filter((c) => c === 200)).toHaveLength(LIMITS.publishPerSec);
    expect(codes.at(-1)).toBe(429);
    expect((await publish(id, "autre", snap())).status).toBe(200); // limite par client
  });

  it("room pleine : 20 membres maximum", async () => {
    const id = await create();
    const open = Array.from({ length: LIMITS.maxMembers }, (_, i) => sse(id, `c${i}`));
    await Promise.all(open.map((c) => c.ready));
    for (let i = 0; i < LIMITS.maxMembers; i++) expect((await publish(id, `c${i}`, snap())).status).toBe(200);
    const r = await fetch(`${base}/api/rooms/${id}/events?v=2&client=extra`);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "room-full" });
    expect((await publish(id, "extra", snap())).status).toBe(429);
    expect((await publish(id, "c0", snap())).status).toBe(200); // un membre existant reste accepté
    open.forEach((c) => c.close());
  });

  it("PUT recrée la room avec le même ID, sans écraser une room existante", async () => {
    const r = await post("/api/rooms/ABCDEF", { v: 2, mode: "regular" }, "PUT");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: "ABCDEF" });
    const again = await post("/api/rooms/ABCDEF", { v: 2, mode: "pve" }, "PUT");
    expect(await again.json()).toEqual({ id: "ABCDEF", existed: true });
    expect((await post("/api/rooms/abc0ef", { v: 2, mode: "regular" }, "PUT")).status).toBe(400);
    const a = sse("ABCDEF", "c1");
    await a.ready;
    expect(await a.waitFor("hello")).toMatchObject({ mode: "regular" });
    a.close();
  });

  it("plafond de rooms", async () => {
    const digit = (n: number) => "23456789"[n % 8];
    for (let i = 0; i < LIMITS.maxRooms; i++) {
      const id = `${digit(i)}${digit(i >> 3)}${digit(i >> 6)}${digit(i >> 9)}AA`;
      expect((await post(`/api/rooms/${id}`, { v: 2, mode: "pve" }, "PUT")).status).toBe(200);
    }
    expect(roomCount()).toBe(LIMITS.maxRooms);
    expect((await post("/api/rooms", { v: 2, mode: "pve" })).status).toBe(503);
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
