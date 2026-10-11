// Service de rooms (partage de sélection et de progression entre joueurs).
// JavaScript simple (pas de TypeScript) : le Node de production ne sait pas importer src/*.ts.
// Protocole : POST pour créer / envoyer des opérations, Server-Sent Events pour recevoir.
// Tout est en mémoire : un redémarrage vide les rooms (le créateur les recrée avec PUT).
// AUCUNE authentification : qui connaît l'identifiant peut modifier la room.

import { randomBytes } from "node:crypto";

export const LIMITS = {
  maxBody: 256 * 1024,
  maxRooms: 500,
  maxMembers: 20,
  maxIds: 20_000,
  maxOps: 1000,
  emptyTtlMs: 30 * 60 * 1000,
  heartbeatMs: 25_000,
};

export const MODES = ["regular", "pve", "pvp-season"];
// sans 0 O 1 I L (lisibles à l'oral)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ROOM_ID = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const TASK_ID = /^[A-Za-z0-9_\-:.]{1,100}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
// eslint-disable-next-line no-control-regex
const STORY_ID = /^[^\u0000-\u001f\u007f]{1,200}$/;

/** op.kind -> champ de l'état de la room */
const FIELD = { task: "selected", done: "done", story: "storySelected", step: "storyDone" };
const FIELDS = Object.values(FIELD);

/** @type {Map<string, Room>} */
const rooms = new Map();

/** Vide toutes les rooms (tests). */
export function resetRooms() {
  for (const room of rooms.values()) for (const c of room.clients) c.res.end();
  rooms.clear();
}
export const roomCount = () => rooms.size;

const validId = (kind, id) =>
  typeof id === "string" && (kind === "task" || kind === "done" ? TASK_ID.test(id) : STORY_ID.test(id));

/** Valide une liste d'opérations ; renvoie la liste nettoyée ou null. */
export function validateOps(ops) {
  if (!Array.isArray(ops) || ops.length > LIMITS.maxOps) return null;
  const out = [];
  for (const op of ops) {
    if (!op || typeof op !== "object" || !(op.kind in FIELD) || typeof op.on !== "boolean" || !validId(op.kind, op.id)) return null;
    out.push({ kind: op.kind, id: op.id, on: op.on });
  }
  return out;
}

/** Valide un état complet { selected, done, storySelected, storyDone } ; renvoie des Set par champ ou null. */
export function validateState(state) {
  if (state === undefined || state === null) state = {};
  if (typeof state !== "object") return null;
  const kinds = { selected: "task", done: "done", storySelected: "story", storyDone: "step" };
  const out = {};
  let total = 0;
  for (const field of FIELDS) {
    const list = state[field] ?? [];
    if (!Array.isArray(list)) return null;
    total += list.length;
    if (total > LIMITS.maxIds) return null;
    for (const id of list) if (!validId(kinds[field], id)) return null;
    out[field] = new Set(list);
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

function createRoom(id, mode, sets) {
  const room = { id, mode, ...sets, clients: new Set(), emptySince: Date.now() };
  rooms.set(id, room);
  return room;
}

const stateOf = (room) => Object.fromEntries(FIELDS.map((f) => [f, [...room[f]]]));
const idCount = (room) => FIELDS.reduce((n, f) => n + room[f].size, 0);

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function send(client, message) {
  if (client.res.writableEnded || client.res.destroyed) return; // connexion déjà fermée : jamais d'exception
  client.res.write(`data: ${JSON.stringify(message)}\n\n`);
}

function broadcast(room, message, exceptClient) {
  for (const c of room.clients) if (c.client !== exceptClient) send(c, message);
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
  const client = clientParam && CLIENT_ID.test(clientParam) ? clientParam : "";
  if (room.clients.size >= LIMITS.maxMembers) return sendJson(res, 429, { error: "room-full" });
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const entry = { res, client };
  res.on("error", () => {}); // coupure brutale du client : géré par « close »
  room.clients.add(entry);
  res.write("retry: 3000\n\n");
  send(entry, { type: "snapshot", mode: room.mode, state: stateOf(room), members: room.clients.size });
  broadcast(room, { type: "members", members: room.clients.size }, client || undefined);
  const beat = setInterval(() => res.write(": ping\n\n"), LIMITS.heartbeatMs);
  req.on("close", () => {
    clearInterval(beat);
    room.clients.delete(entry);
    if (room.clients.size === 0) room.emptySince = Date.now();
    else broadcast(room, { type: "members", members: room.clients.size });
  });
}

async function applyOps(req, res, room) {
  const body = await readJson(req);
  const ops = validateOps(body?.ops);
  if (!ops || typeof body.client !== "string" || !CLIENT_ID.test(body.client)) return sendJson(res, 400, { error: "invalid-ops" });
  // on travaille sur des copies : tout ou rien si une limite est dépassée
  const next = Object.fromEntries(FIELDS.map((f) => [f, new Set(room[f])]));
  let total = idCount(room);
  for (const { kind, id, on } of ops) {
    const set = next[FIELD[kind]];
    if (on && !set.has(id)) total++;
    if (!on && set.has(id)) total--;
    if (on) set.add(id);
    else set.delete(id);
  }
  if (total > LIMITS.maxIds) return sendJson(res, 413, { error: "room-limit" });
  Object.assign(room, next);
  broadcast(room, { type: "op", ops, from: body.client }, body.client);
  sendJson(res, 200, { ok: true });
}

async function createOrRestore(req, res, id) {
  const body = await readJson(req);
  const sets = validateState(body?.state);
  if (!body || !MODES.includes(body.mode) || !sets) return sendJson(res, 400, { error: "invalid-room" });
  if (id && rooms.has(id)) return sendJson(res, 200, { id, existed: true });
  if (rooms.size >= LIMITS.maxRooms) return sendJson(res, 503, { error: "too-many-rooms" });
  const roomId = id ?? newRoomId();
  createRoom(roomId, body.mode, sets);
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
  if (!room) {
    sendJson(res, 404, { error: "unknown-room" });
    return true;
  }
  if (req.method === "GET" && !action) sendJson(res, 200, { id, mode: room.mode, members: room.clients.size });
  else if (req.method === "GET" && action === "events") openEvents(req, res, room, url.searchParams.get("client"));
  else if (req.method === "POST" && action === "ops") applyOps(req, res, room).catch(fail);
  else sendJson(res, 404, { error: "not-found" });
  return true;
}

// Nettoyage des rooms restées vides trop longtemps.
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) if (room.clients.size === 0 && now - room.emptySince > LIMITS.emptyTtlMs) rooms.delete(id);
}, 60_000).unref();
