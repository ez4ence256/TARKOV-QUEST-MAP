// Relais pour l'application « Tarkov AprilOx Monitor » (quêtes et position envoyées depuis les logs du jeu).
// JavaScript simple (pas de TypeScript) : le Node de production ne sait pas importer src/*.ts.
// Protocole : le Monitor fait un POST par événement, le navigateur reçoit en Server-Sent Events.
// Tout est en mémoire. Le code de liaison est le seul secret : jamais journalisé (ni lui ni les corps).

export const LIMITS = {
  maxBody: 8 * 1024,
  maxCodes: 1000,
  maxListeners: 10,
  perCodePerMin: 60,
  perIpPerMin: 120,
  idleTtlMs: 30 * 60 * 1000,
  replayMs: 10 * 60 * 1000,
  heartbeatMs: 25_000,
};

const CODE = /^[A-Za-z0-9]{16}$/;
const TASK_ID = /^[0-9a-f]{24}$/;
const MAP_ID = /^[a-z0-9-]{1,40}$/;
const STATUSES = ["started", "finished", "failed"];
const GAME_MODES = ["regular", "pve"];

/** @type {Map<string, {listeners: Set<any>, map: any, position: any, lastAt: number, hits: {start: number, n: number}}>} */
const codes = new Map();
/** @type {Map<string, {start: number, n: number}>} */
const ips = new Map();

/** Vide tout (tests). */
export function resetMonitor() {
  for (const c of codes.values()) for (const l of c.listeners) l.res.end();
  codes.clear();
  ips.clear();
}

const num = (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100000;
const text = (v, max) => (typeof v === "string" && v.length <= max ? v : "");

/** Valide un événement ; renvoie l'événement nettoyé ou null (type inconnu, champ manquant ou hors limites). */
export function validateEvent(b) {
  if (!b || typeof b !== "object" || b.v !== 1) return null;
  if (b.type === "hello") return { v: 1, type: "hello", app: text(b.app, 64), version: text(b.version, 32) };
  if (!GAME_MODES.includes(b.gameMode)) return null;
  if (b.type === "task") {
    if (!STATUSES.includes(b.status) || typeof b.taskId !== "string" || !TASK_ID.test(b.taskId)) return null;
    return { v: 1, type: "task", status: b.status, taskId: b.taskId, gameMode: b.gameMode };
  }
  if (typeof b.map !== "string" || !MAP_ID.test(b.map)) return null;
  if (b.type === "map") return { v: 1, type: "map", map: b.map, gameMode: b.gameMode };
  if (b.type === "position") {
    if (![b.x, b.y, b.z, b.rotation].every(num)) return null;
    return { v: 1, type: "position", map: b.map, x: b.x, y: b.y, z: b.z, rotation: b.rotation, gameMode: b.gameMode };
  }
  return null;
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

/** Fenêtre fixe d'une minute ; renvoie false si la limite est dépassée. */
function hit(slot, limit, now) {
  if (now - slot.start >= 60_000) {
    slot.start = now;
    slot.n = 0;
  }
  return ++slot.n <= limit;
}

// derrière un proxy : la dernière entrée de X-Forwarded-For est celle ajoutée par le proxy de confiance
function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",").pop().trim();
  return fwd || req.socket.remoteAddress || "?";
}

/** Lit le corps JSON (8 Ko max) ; rejette avec { status, error }. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > LIMITS.maxBody) {
        failed = true;
        reject({ status: 413, error: "too-large" });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject({ status: 400, error: "bad-json" });
      }
    });
    req.on("error", () => {
      if (!failed) reject({ status: 400, error: "bad-request" });
    });
  });
}

const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;
function write(l, event) {
  if (l.res.writableEnded || l.res.destroyed) return; // connexion déjà fermée : jamais d'exception
  l.res.write(frame(event));
}

function entry(code) {
  let c = codes.get(code);
  if (!c) {
    c = { listeners: new Set(), map: null, position: null, lastAt: Date.now(), hits: { start: 0, n: 0 } };
    codes.set(code, c);
  }
  return c;
}

async function receive(req, res, code) {
  const now = Date.now();
  const ip = ips.get(clientIp(req)) ?? { start: 0, n: 0 };
  ips.set(clientIp(req), ip);
  const c = codes.get(code);
  if (!hit(ip, LIMITS.perIpPerMin, now) || (c && !hit(c.hits, LIMITS.perCodePerMin, now))) {
    return json(res, 429, { error: "rate-limited" }, { "Retry-After": "60" });
  }
  const event = validateEvent(await readJson(req));
  if (!event) return json(res, 400, { error: "invalid-event" });
  if (!c && codes.size >= LIMITS.maxCodes) return json(res, 429, { error: "too-many-codes" }, { "Retry-After": "60" });
  const target = c ?? entry(code);
  if (!c) hit(target.hits, LIMITS.perCodePerMin, now);
  target.lastAt = now;
  const out = { ...event, at: now };
  if (event.type === "map") target.map = out;
  else if (event.type === "position") target.position = out;
  for (const l of target.listeners) write(l, out);
  res.writeHead(204);
  res.end();
}

function listen(req, res, code) {
  if (!codes.has(code) && codes.size >= LIMITS.maxCodes) return json(res, 429, { error: "too-many-codes" });
  const c = entry(code);
  if (c.listeners.size >= LIMITS.maxListeners) return json(res, 429, { error: "too-many-listeners" });
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const l = { res };
  res.on("error", () => {}); // coupure brutale du client : gérée par « close »
  c.listeners.add(l);
  res.write("retry: 3000\n\n");
  const now = Date.now();
  for (const e of [c.map, c.position]) if (e && now - e.at < LIMITS.replayMs) write(l, e);
  const beat = setInterval(() => res.write(": ping\n\n"), LIMITS.heartbeatMs);
  req.on("close", () => {
    clearInterval(beat);
    c.listeners.delete(l);
    c.lastAt = Date.now();
  });
}

/** Gestionnaire HTTP pour /api/monitor/... ; renvoie false si l'URL n'est pas la sienne. */
export function handleMonitor(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean); // ["api","monitor",code,"events"?]
  if (parts[0] !== "api" || parts[1] !== "monitor") return false;
  const [, , code, action] = parts;
  const fail = (e) => json(res, e?.status ?? 500, { error: e?.error ?? "server-error" });
  if (!code || !CODE.test(code)) json(res, 400, { error: "bad-code" });
  else if (req.method === "POST" && !action) receive(req, res, code).catch(fail);
  else if (req.method === "GET" && action === "events" && parts.length === 4) listen(req, res, code);
  else json(res, 404, { error: "not-found" });
  return true;
}

// Nettoyage : codes sans écouteur ni événement depuis trop longtemps, compteurs d'IP expirés.
setInterval(() => {
  const now = Date.now();
  for (const [code, c] of codes) if (c.listeners.size === 0 && now - c.lastAt > LIMITS.idleTtlMs) codes.delete(code);
  for (const [ip, s] of ips) if (now - s.start >= 60_000) ips.delete(ip);
}, 60_000).unref();
