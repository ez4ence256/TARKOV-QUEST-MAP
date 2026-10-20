// Service de rooms (v2) : chaque joueur publie un instantané de ce qu'il affiche, les autres le voient en lecture seule.
// Rien n'est fusionné : le serveur ne garde que, par membre, un pseudo et le dernier instantané reçu.
// JavaScript simple (pas de TypeScript) : le Node de production ne sait pas importer src/*.ts.
// Protocole : POST pour créer / publier, Server-Sent Events pour recevoir. Toute requête porte v = 2.
// Tout est en mémoire : un redémarrage vide les rooms (le créateur la recrée avec PUT, chacun republie son instantané).
// AUCUNE authentification : qui connaît l'identifiant peut lire les instantanés. Ni pseudos ni instantanés ne sont journalisés.

import { randomBytes } from "node:crypto";

export const PROTOCOL = 2;

export const LIMITS = {
  maxBody: 256 * 1024,
  maxRooms: 500,
  maxMembers: 20,
  emptyTtlMs: 30 * 60 * 1000,
  goneTtlMs: 5 * 60 * 1000, // un membre déconnecté disparaît de la liste après ce délai
  heartbeatMs: 25_000,
  maxSelected: 200,
  maxDone: 5000,
  maxManual: 500,
  maxStorySelected: 50,
  maxStoryDone: 2000,
  maxName: 20,
  publishPerSec: 10,
  maxCoord: 100_000,
};

export const MODES = ["regular", "pve", "pvp-season"];
export const DEFAULT_NAME = "Joueur";
// sans 0 O 1 I L (lisibles à l'oral)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ROOM_ID = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const TASK_ID = /^[A-Za-z0-9_\-:.]{1,100}$/;
const MAP_ID = /^[a-z0-9-]{1,40}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
// eslint-disable-next-line no-control-regex
const STORY_ID = /^[^\u0000-\u001f\u007f]{1,200}$/;

const PROTOCOL_ERROR = { error: "protocol", message: "Recharge la page : la room a été mise à jour." };

/** @type {Map<string, any>} */
const rooms = new Map();

/** Vide toutes les rooms (tests). */
export function resetRooms() {
  for (const room of rooms.values()) for (const m of room.members.values()) for (const c of m.conns) c.res.end();
  rooms.clear();
}
export const roomCount = () => rooms.size;

/** Pseudo propre : sans caractères de contrôle, espaces rognés, 20 caractères max ; "Joueur" si vide ; null si ce n'est pas du texte. */
export function cleanName(raw) {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const name = [...raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim()].slice(0, LIMITS.maxName).join("").trim();
  return name || DEFAULT_NAME;
}

const list = (v, max) => Array.isArray(v) && v.length <= max;
const num = (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= LIMITS.maxCoord;

/** Valide un instantané ; renvoie sa version nettoyée (champs inconnus écartés) ou null. */
export function validateSnapshot(s) {
  if (!s || typeof s !== "object") return null;
  const { selected, done, manual, storySelected, storyDone, position } = s;
  if (!list(selected, LIMITS.maxSelected) || !list(done, LIMITS.maxDone) || !list(manual, LIMITS.maxManual)) return null;
  if (!list(storySelected, LIMITS.maxStorySelected) || !list(storyDone, LIMITS.maxStoryDone)) return null;
  const out = { selected: [], done, manual: [], storySelected, storyDone };
  for (const t of selected) {
    if (!t || typeof t.taskId !== "string" || !TASK_ID.test(t.taskId) || !Number.isInteger(t.color) || t.color < 0 || t.color > 63) return null;
    out.selected.push({ taskId: t.taskId, color: t.color });
  }
  for (const id of done) if (typeof id !== "string" || !TASK_ID.test(id)) return null;
  for (const m of manual) {
    if (!m || typeof m.objectiveId !== "string" || !TASK_ID.test(m.objectiveId) || typeof m.mapId !== "string" || !MAP_ID.test(m.mapId) || !num(m.x) || !num(m.z)) return null;
    out.manual.push({ objectiveId: m.objectiveId, mapId: m.mapId, x: m.x, z: m.z });
  }
  for (const id of storySelected) if (typeof id !== "string" || !STORY_ID.test(id)) return null;
  for (const id of storyDone) if (typeof id !== "string" || !STORY_ID.test(id)) return null;
  if (position !== undefined && position !== null) {
    const p = position;
    if (typeof p !== "object" || typeof p.map !== "string" || !MAP_ID.test(p.map) || !MODES.includes(p.gameMode)) return null;
    if (![p.x, p.y, p.z, p.rotation].every(num) || typeof p.at !== "number" || !Number.isFinite(p.at)) return null;
    out.position = { map: p.map, x: p.x, y: p.y, z: p.z, rotation: p.rotation, gameMode: p.gameMode, at: p.at };
  }
  return out;
}

function newRoomId() {
  for (;;) {
    let id = "";
    // tirage sans biais : les octets >= 248 (= 31 * 8) sont écartés
    while (id.length < 6) for (const b of randomBytes(8)) if (b < 248 && id.length < 6) id += ALPHABET[b % ALPHABET.length];
    if (!rooms.has(id)) return id;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function send(conn, message) {
  if (conn.res.writableEnded || conn.res.destroyed) return; // connexion déjà fermée : jamais d'exception
  conn.res.write(`data: ${JSON.stringify(message)}\n\n`);
}

function broadcast(room, message, exceptClient) {
  for (const [client, m] of room.members) if (client !== exceptClient) for (const c of m.conns) send(c, message);
}

const membersOf = (room) => [...room.members].map(([id, m]) => ({ id, name: m.name, connected: m.conns.size > 0 }));
const connectedCount = (room) => [...room.members.values()].filter((m) => m.conns.size > 0).length;

/** Retire les membres déconnectés depuis trop longtemps (force : un seul, pour faire de la place) ; vrai si la liste a changé. */
function sweepMembers(room, now, force = false) {
  let changed = false;
  for (const [id, m] of room.members) {
    if (m.conns.size === 0 && (force || now - m.goneAt > LIMITS.goneTtlMs)) {
      room.members.delete(id);
      changed = true;
      if (force) break;
    }
  }
  return changed;
}

/** Renvoie le membre (le crée si besoin) ou null si la room est pleine. */
function memberOf(room, client) {
  let m = room.members.get(client);
  if (m) return m;
  if (room.members.size >= LIMITS.maxMembers && !sweepMembers(room, Date.now(), true)) return null;
  m = { name: DEFAULT_NAME, snapshot: null, at: 0, conns: new Set(), goneAt: Date.now(), hits: { start: 0, n: 0 } };
  room.members.set(client, m);
  return m;
}

/** Lit le corps JSON (taille limitée) ; rejette avec { status, error }. */
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

function openEvents(req, res, room, clientParam) {
  if (!clientParam || !CLIENT_ID.test(clientParam)) return sendJson(res, 400, { error: "bad-client" });
  const member = memberOf(room, clientParam);
  if (!member) return sendJson(res, 429, { error: "room-full" });
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const conn = { res };
  res.on("error", () => {}); // coupure brutale du client : géré par « close »
  member.conns.add(conn);
  res.write("retry: 3000\n\n");
  send(conn, { type: "hello", mode: room.mode, members: membersOf(room) });
  for (const [id, m] of room.members) if (id !== clientParam && m.snapshot) send(conn, { type: "member", id, name: m.name, snapshot: m.snapshot, at: m.at });
  broadcast(room, { type: "members", members: membersOf(room) }, clientParam);
  const beat = setInterval(() => res.write(": ping\n\n"), LIMITS.heartbeatMs);
  req.on("close", () => {
    clearInterval(beat);
    member.conns.delete(conn);
    if (member.conns.size === 0) member.goneAt = Date.now();
    if (connectedCount(room) === 0) room.emptySince = Date.now();
    broadcast(room, { type: "members", members: membersOf(room) });
  });
}

async function publish(req, res, room) {
  const body = await readJson(req);
  if (body?.v !== PROTOCOL) return sendJson(res, 400, PROTOCOL_ERROR);
  const name = cleanName(body.name ?? DEFAULT_NAME);
  const snapshot = validateSnapshot(body.snapshot);
  if (!name || !snapshot || typeof body.client !== "string" || !CLIENT_ID.test(body.client)) return sendJson(res, 400, { error: "invalid-snapshot" });
  const member = memberOf(room, body.client);
  if (!member) return sendJson(res, 429, { error: "room-full" });
  const now = Date.now();
  if (now - member.hits.start >= 1000) member.hits = { start: now, n: 0 };
  if (++member.hits.n > LIMITS.publishPerSec) return sendJson(res, 429, { error: "rate" });
  const renamed = member.name !== name;
  member.name = name;
  member.snapshot = snapshot;
  member.at = now;
  if (renamed) broadcast(room, { type: "members", members: membersOf(room) }, body.client);
  broadcast(room, { type: "member", id: body.client, name, snapshot, at: now }, body.client);
  sendJson(res, 200, { ok: true });
}

async function createOrRestore(req, res, id) {
  const body = await readJson(req);
  if (body?.v !== PROTOCOL) return sendJson(res, 400, PROTOCOL_ERROR);
  if (!MODES.includes(body.mode)) return sendJson(res, 400, { error: "invalid-room" });
  if (id && rooms.has(id)) return sendJson(res, 200, { id, existed: true });
  if (rooms.size >= LIMITS.maxRooms) return sendJson(res, 503, { error: "too-many-rooms" });
  const roomId = id ?? newRoomId();
  rooms.set(roomId, { id: roomId, mode: body.mode, members: new Map(), emptySince: Date.now() });
  sendJson(res, id ? 200 : 201, { id: roomId });
}

/** Gestionnaire HTTP pour /api/rooms/... ; renvoie false si l'URL n'est pas la sienne. */
export function handleRooms(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean); // ["api","rooms",id?,action?]
  if (parts[0] !== "api" || parts[1] !== "rooms") return false;
  const [, , id, action] = parts;
  const room = id ? rooms.get(id) : undefined;
  const fail = (e) => sendJson(res, e?.status ?? 500, { error: e?.error ?? "server-error" });

  if (!id) {
    if (req.method === "POST") createOrRestore(req, res, null).catch(fail);
    else sendJson(res, 405, { error: "method" });
    return true;
  }
  if (req.method === "PUT" && !action) {
    if (!ROOM_ID.test(id)) sendJson(res, 400, { error: "bad-id" });
    else createOrRestore(req, res, id).catch(fail);
    return true;
  }
  // GET (info, événements) : la version est dans l'URL ; un ancien client reçoit une erreur claire
  if (req.method === "GET" && url.searchParams.get("v") !== String(PROTOCOL)) {
    sendJson(res, 400, PROTOCOL_ERROR);
    return true;
  }
  if (!room) {
    sendJson(res, 404, { error: "unknown-room" });
    return true;
  }
  if (req.method === "GET" && !action) sendJson(res, 200, { id, mode: room.mode, members: connectedCount(room) });
  else if (req.method === "GET" && action === "events") openEvents(req, res, room, url.searchParams.get("client"));
  else if (req.method === "POST" && action === "publish") publish(req, res, room).catch(fail);
  else sendJson(res, 404, { error: "not-found" });
  return true;
}

// Nettoyage : rooms restées vides trop longtemps, membres partis depuis trop longtemps.
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (connectedCount(room) === 0 && now - room.emptySince > LIMITS.emptyTtlMs) rooms.delete(id);
    else if (sweepMembers(room, now)) broadcast(room, { type: "members", members: membersOf(room) });
  }
}, 60_000).unref();
