// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "./index.mjs";
import { LIMITS, resetMonitor, validateEvent } from "./monitor.mjs";

let server: http.Server;
let base: string;
const CODE = "AbCdEfGh12345678";
const TASK = "5936d90786f7742b1420ba5b";

beforeAll(async () => {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), "tqp-mon-")), "dist");
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
afterEach(() => resetMonitor());

const post = (code: string, body: unknown, raw?: string) =>
  fetch(`${base}/api/monitor/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body) });
const task = { v: 1, type: "task", status: "started", taskId: TASK, gameMode: "pve" };
const pos = { v: 1, type: "position", map: "customs", x: 1.5, y: 2, z: -3, rotation: 90, gameMode: "regular" };

/** Client SSE minimal : accumule les messages `data:` JSON. */
function sse(code: string) {
  const events: Record<string, unknown>[] = [];
  const req = http.get(`${base}/api/monitor/${code}/events`);
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
            if (block.startsWith("data: ")) events.push(JSON.parse(block.slice(6)));
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

describe("validation", () => {
  it("accepte les 4 types et rejette le reste", () => {
    expect(validateEvent({ v: 1, type: "hello", app: "X", version: "1" })).toBeTruthy();
    expect(validateEvent(task)).toEqual(task);
    expect(validateEvent({ v: 1, type: "map", map: "streets-of-tarkov", gameMode: "pve" })).toBeTruthy();
    expect(validateEvent(pos)).toEqual(pos);
    expect(validateEvent({ ...pos, v: 2 })).toBeNull();
    expect(validateEvent({ ...task, status: "modified" })).toBeNull();
    expect(validateEvent({ ...task, taskId: "ABC" })).toBeNull();
    expect(validateEvent({ ...task, gameMode: undefined })).toBeNull();
    expect(validateEvent({ ...task, gameMode: "pvp-season" })).toBeTruthy();
    expect(validateEvent({ ...task, gameMode: "season" })).toBeNull();
    expect(validateEvent({ ...pos, map: "Customs" })).toBeNull();
    expect(validateEvent({ ...pos, x: Infinity })).toBeNull();
    expect(validateEvent({ ...pos, y: 100000 })).toBeNull();
    expect(validateEvent({ ...pos, rotation: "1" })).toBeNull();
    expect(validateEvent({ v: 1, type: "other" })).toBeNull();
    expect(validateEvent(null)).toBeNull();
  });
});

describe("relais", () => {
  it("POST puis SSE : l'événement arrive avec « at »", async () => {
    const s = sse(CODE);
    expect((await s.ready).statusCode).toBe(200);
    expect((await s.ready).headers["x-accel-buffering"]).toBe("no");
    expect((await post(CODE, task)).status).toBe(204);
    await s.waitFor(1);
    expect(s.events[0]).toMatchObject(task);
    expect(typeof s.events[0].at).toBe("number");
    s.close();
  });

  it("n'envoie qu'aux écouteurs du même code", async () => {
    const other = sse("ZZZZZZZZ12345678");
    const mine = sse(CODE);
    await Promise.all([other.ready, mine.ready]);
    await post(CODE, task);
    await mine.waitFor(1);
    expect(other.events).toHaveLength(0);
    other.close();
    mine.close();
  });

  it("rejoue la dernière carte et la dernière position à la connexion", async () => {
    await post(CODE, { v: 1, type: "map", map: "woods", gameMode: "pve" });
    await post(CODE, { ...pos, x: 1 });
    await post(CODE, { ...pos, x: 2 });
    await post(CODE, task); // les tâches ne sont pas rejouées
    const s = sse(CODE);
    await s.waitFor(2);
    await new Promise((r) => setTimeout(r, 60));
    expect(s.events.map((e) => [e.type, e.x])).toEqual([["map", undefined], ["position", 2]]);
    s.close();
  });

  it("400 : code, corps, type ; 404 : route ; 413 : trop gros", async () => {
    expect((await post("court", task)).status).toBe(400);
    expect((await post(CODE, null, "{pas du json")).status).toBe(400);
    expect((await post(CODE, { v: 1, type: "inconnu" })).status).toBe(400);
    expect((await post(CODE, { ...task, taskId: "x" })).status).toBe(400);
    expect((await fetch(`${base}/api/monitor/${CODE}/autre`)).status).toBe(404);
    expect((await post(CODE, { ...task, pad: "x".repeat(LIMITS.maxBody) })).status).toBe(413);
  });

  it("429 au-delà de 60 événements par minute et par code", async () => {
    for (let i = 0; i < LIMITS.perCodePerMin; i++) expect((await post(CODE, pos)).status).toBe(204);
    const r = await post(CODE, pos);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
  });

  it("429 au-delà de 120 événements par minute et par IP (codes différents)", async () => {
    for (let i = 0; i < LIMITS.perIpPerMin; i++) expect((await post(`Code${String(i).padStart(12, "0")}`, pos)).status).toBe(204);
    expect((await post(CODE, pos)).status).toBe(429);
  });

  it("10 écouteurs au plus par code", async () => {
    const all = Array.from({ length: LIMITS.maxListeners }, () => sse(CODE));
    for (const s of all) expect((await s.ready).statusCode).toBe(200);
    const extra = sse(CODE);
    expect((await extra.ready).statusCode).toBe(429);
    for (const s of [...all, extra]) s.close();
  });
});
