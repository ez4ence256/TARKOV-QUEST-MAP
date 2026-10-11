// Partage en room : état échangé, différences et validation des identifiants.
// Seuls la sélection de quêtes, les objectifs cochés et la Main story sont partagés
// (couleurs, notes, points perso et positions manuelles restent locaux).

import type { ModeState } from "../state/store";

export type RoomOpKind = "task" | "done" | "story" | "step";
export interface RoomOp {
  kind: RoomOpKind;
  id: string;
  on: boolean;
}

/** État partagé : identifiants des quêtes choisies, objectifs cochés, chapitres choisis, étapes cochées. */
export interface RoomState {
  selected: string[];
  done: string[];
  storySelected: string[];
  storyDone: string[];
}

export const emptyRoomState = (): RoomState => ({ selected: [], done: [], storySelected: [], storyDone: [] });

export const OP_FIELD: Record<RoomOpKind, keyof RoomState> = {
  task: "selected",
  done: "done",
  story: "storySelected",
  step: "storyDone",
};
const KINDS = Object.keys(OP_FIELD) as RoomOpKind[];

// mêmes règles que server/rooms.mjs (le serveur reste seul juge)
const TASK_ID = /^[A-Za-z0-9_\-:.]{1,100}$/;
// eslint-disable-next-line no-control-regex
const STORY_ID = /^[^\u0000-\u001f\u007f]{1,200}$/;
export const validRoomId = (kind: RoomOpKind, id: unknown): id is string =>
  typeof id === "string" && (kind === "task" || kind === "done" ? TASK_ID : STORY_ID).test(id);

/** Extrait l'état partageable d'un mode (identifiants invalides écartés). */
export function roomStateOf(m: ModeState | undefined): RoomState {
  const keep = (kind: RoomOpKind, ids: string[]) => ids.filter((id) => validRoomId(kind, id));
  const checked = (rec: Record<string, unknown> | undefined) => Object.keys(rec ?? {}).filter((id) => rec![id]);
  return {
    selected: keep("task", (m?.selected ?? []).map((s) => s.taskId)),
    done: keep("done", checked(m?.done)),
    storySelected: keep("story", m?.story?.selected ?? []),
    storyDone: keep("step", checked(m?.story?.done)),
  };
}

/** Opérations absolues qui font passer `prev` à `next`. */
export function diffRoom(prev: RoomState, next: RoomState): RoomOp[] {
  const ops: RoomOp[] = [];
  for (const kind of KINDS) {
    const field = OP_FIELD[kind];
    const before = new Set(prev[field]);
    const after = new Set(next[field]);
    for (const id of after) if (!before.has(id)) ops.push({ kind, id, on: true });
    for (const id of before) if (!after.has(id)) ops.push({ kind, id, on: false });
  }
  return ops;
}

/** Applique des opérations à un état (copie). */
export function applyOpsToRoom(state: RoomState, ops: RoomOp[]): RoomState {
  const sets = Object.fromEntries(Object.entries(state).map(([f, ids]) => [f, new Set(ids as string[])])) as Record<keyof RoomState, Set<string>>;
  for (const { kind, id, on } of ops) sets[OP_FIELD[kind]][on ? "add" : "delete"](id);
  return Object.fromEntries(Object.entries(sets).map(([f, s]) => [f, [...s]])) as unknown as RoomState;
}

/** Vérifie la forme d'un message du serveur (jamais de confiance aveugle). */
export function parseRoomState(raw: unknown): RoomState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = emptyRoomState();
  for (const kind of KINDS) {
    const field = OP_FIELD[kind];
    const list = r[field];
    if (!Array.isArray(list) || !list.every((id) => validRoomId(kind, id))) return null;
    out[field] = list;
  }
  return out;
}

export function parseRoomOps(raw: unknown): RoomOp[] | null {
  if (!Array.isArray(raw)) return null;
  const ops: RoomOp[] = [];
  for (const op of raw as Partial<RoomOp>[]) {
    if (!op || !KINDS.includes(op.kind as RoomOpKind) || typeof op.on !== "boolean" || !validRoomId(op.kind as RoomOpKind, op.id)) return null;
    ops.push({ kind: op.kind as RoomOpKind, id: op.id!, on: op.on });
  }
  return ops;
}
