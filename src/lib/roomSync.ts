// Rooms v2 : instantané public publié par chaque joueur (voir server/rooms.mjs).
// Les quêtes de chacun restent locales : rien de ce qui vient de la room n'est jamais écrit dans l'état local.

import type { GameMode, Task } from "../types";
import { storyStepId } from "./story";
import { sanitizeState, type AppState, type ModeState } from "../state/store";

export const DEFAULT_NICKNAME = "Joueur";
/** Clé de la sauvegarde laissée par l'ancien code des rooms (suivie du mode de jeu). */
export const LEGACY_BACKUP_PREFIX = "tqp:beforeRoom:";
export const MAX_NICKNAME = 20;
/** Âge maximal d'une position publiée (même durée que l'effacement du marqueur). */
export const POSITION_MAX_AGE_MS = 5 * 60 * 1000;

/** Mêmes plafonds que le serveur (qui reste seul juge). */
export const SNAPSHOT_LIMITS = { selected: 200, done: 5000, manual: 500, storySelected: 50, storyDone: 2000 };

export interface RoomPosition {
  /** Identifiant de la map du site. */
  map: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  gameMode: GameMode;
  /** Heure de capture (ms). */
  at: number;
}

export interface RoomSnapshot {
  selected: { taskId: string; color: number }[];
  /** Seulement les objectifs des quêtes sélectionnées. */
  done: string[];
  /** Seulement les positions des objectifs des quêtes sélectionnées. */
  manual: { objectiveId: string; mapId: string; x: number; z: number }[];
  storySelected: string[];
  /** Seulement les étapes des chapitres sélectionnés. */
  storyDone: string[];
  position?: RoomPosition;
}

const MODES: GameMode[] = ["regular", "pve", "pvp-season"];
const TASK_ID = /^[A-Za-z0-9_\-:.]{1,100}$/;
const MAP_ID = /^[a-z0-9-]{1,40}$/;
// eslint-disable-next-line no-control-regex
const STORY_ID = /^[^\u0000-\u001f\u007f]{1,200}$/;
const MAX_COORD = 100_000;

/** Pseudo propre (mêmes règles que le serveur) : sans caractères de contrôle, 20 caractères, « Joueur » si vide. */
export function cleanNickname(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NICKNAME;
  // eslint-disable-next-line no-control-regex
  const name = [...raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim()].slice(0, MAX_NICKNAME).join("").trim();
  return name || DEFAULT_NICKNAME;
}

/**
 * Ce qu'un joueur montre aux autres : quêtes choisies, cases cochées de CES quêtes seulement,
 * positions placées à la main de leurs objectifs, chapitres choisis et leurs étapes cochées.
 * Notes, points perso, échecs, planque et faction ne sortent jamais. La position (Monitor) est ajoutée par l'appelant.
 */
export function publicSnapshotOf(m: ModeState | undefined, tasksById: ReadonlyMap<string, Task>): RoomSnapshot {
  const selected = (m?.selected ?? []).filter((s) => TASK_ID.test(s.taskId)).slice(0, SNAPSHOT_LIMITS.selected);
  const objectiveIds = new Set<string>();
  for (const s of selected) for (const o of tasksById.get(s.taskId)?.objectives ?? []) objectiveIds.add(o.id);
  const done = Object.keys(m?.done ?? {}).filter((id) => m!.done[id] && objectiveIds.has(id) && TASK_ID.test(id));
  const manual = Object.entries(m?.manual ?? {})
    .filter(([id, p]) => objectiveIds.has(id) && TASK_ID.test(id) && MAP_ID.test(p.mapId) && Number.isFinite(p.x) && Number.isFinite(p.z))
    .map(([objectiveId, p]) => ({ objectiveId, mapId: p.mapId, x: p.x, z: p.z }));
  const storySelected = (m?.story?.selected ?? []).filter((c) => STORY_ID.test(c)).slice(0, SNAPSHOT_LIMITS.storySelected);
  const prefixes = storySelected.map((c) => storyStepId(c, ""));
  const storyDone = Object.keys(m?.story?.done ?? {}).filter((id) => STORY_ID.test(id) && prefixes.some((p) => id.startsWith(p)));
  return {
    selected: selected.map((s) => ({ taskId: s.taskId, color: Number.isInteger(s.color) && s.color >= 0 && s.color <= 63 ? s.color : 0 })),
    done: done.slice(0, SNAPSHOT_LIMITS.done),
    manual: manual.slice(0, SNAPSHOT_LIMITS.manual),
    storySelected,
    storyDone: storyDone.slice(0, SNAPSHOT_LIMITS.storyDone),
  };
}

/** Position à publier : seulement dans le mode de la room et si elle a moins de 5 minutes. */
export function publishablePosition(
  p: { mapId: string; x: number; y: number; z: number; rotation: number; at: number; gameMode: GameMode } | null,
  roomMode: GameMode,
  now = Date.now(),
): RoomPosition | undefined {
  if (!p || p.gameMode !== roomMode || now - p.at > POSITION_MAX_AGE_MS || !MAP_ID.test(p.mapId)) return undefined;
  return { map: p.mapId, x: p.x, y: p.y, z: p.z, rotation: p.rotation, gameMode: p.gameMode, at: p.at };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;
const strings = (v: unknown, max: number, re: RegExp): v is string[] => Array.isArray(v) && v.length <= max && v.every((s) => typeof s === "string" && re.test(s));

/** Vérifie un instantané reçu du serveur (jamais de confiance aveugle) ; null s'il est invalide. */
export function parseSnapshot(raw: unknown): RoomSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const L = SNAPSHOT_LIMITS;
  if (!Array.isArray(r.selected) || r.selected.length > L.selected || !Array.isArray(r.manual) || r.manual.length > L.manual) return null;
  if (!strings(r.done, L.done, TASK_ID) || !strings(r.storySelected, L.storySelected, STORY_ID) || !strings(r.storyDone, L.storyDone, STORY_ID)) return null;
  const selected: RoomSnapshot["selected"] = [];
  for (const t of r.selected as Record<string, unknown>[]) {
    if (!t || typeof t.taskId !== "string" || !TASK_ID.test(t.taskId) || !Number.isInteger(t.color) || (t.color as number) < 0 || (t.color as number) > 63) return null;
    selected.push({ taskId: t.taskId, color: t.color as number });
  }
  const manual: RoomSnapshot["manual"] = [];
  for (const m of r.manual as Record<string, unknown>[]) {
    if (!m || typeof m.objectiveId !== "string" || !TASK_ID.test(m.objectiveId) || typeof m.mapId !== "string" || !MAP_ID.test(m.mapId) || !num(m.x) || !num(m.z)) return null;
    manual.push({ objectiveId: m.objectiveId, mapId: m.mapId, x: m.x, z: m.z });
  }
  const out: RoomSnapshot = { selected, done: r.done, manual, storySelected: r.storySelected, storyDone: r.storyDone };
  const p = r.position as Record<string, unknown> | null | undefined;
  if (p) {
    if (typeof p.map !== "string" || !MAP_ID.test(p.map) || !MODES.includes(p.gameMode as GameMode)) return null;
    if (![p.x, p.y, p.z, p.rotation].every(num) || typeof p.at !== "number" || !Number.isFinite(p.at)) return null;
    // jamais dans le futur (horloge en avance chez l'autre) : sinon le marqueur ne s'effacerait jamais
    const at = Math.min(Math.max(p.at, 0), Date.now());
    out.position = { map: p.map, x: p.x as number, y: p.y as number, z: p.z as number, rotation: p.rotation as number, gameMode: p.gameMode as GameMode, at };
  }
  return out;
}

export interface RoomMemberInfo {
  id: string;
  name: string;
  connected: boolean;
}

/** Liste de membres reçue du serveur ; null si elle est invalide. Le pseudo est nettoyé une seconde fois (non fiable). */
export function parseMembers(raw: unknown): RoomMemberInfo[] | null {
  if (!Array.isArray(raw) || raw.length > 100) return null;
  const out: RoomMemberInfo[] = [];
  for (const m of raw as Record<string, unknown>[]) {
    if (!m || typeof m.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(m.id) || typeof m.name !== "string") return null;
    out.push({ id: m.id, name: cleanNickname(m.name), connected: m.connected === true });
  }
  return out;
}

/** Ancienne room (v1) : remet sélection, cases cochées et Main story sauvegardées avant la jointure ; le reste est gardé. */
export function restoreFromBackup(state: AppState, mode: GameMode, raw: unknown): AppState {
  const saved = sanitizeState({ modes: { [mode]: raw } }).modes[mode];
  if (!saved) return state;
  const current = state.modes[mode];
  const restored: ModeState = { ...(current ?? saved), selected: saved.selected, done: saved.done, story: saved.story };
  return { ...state, modes: { ...state.modes, [mode]: restored } };
}
