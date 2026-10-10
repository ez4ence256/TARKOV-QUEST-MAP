// État personnel de l'utilisateur (sélection, progression, notes, points perso).
// Tout est sauvegardé automatiquement dans le localStorage, séparément pour
// chaque mode de jeu (la progression PvE n'est pas celle du PvP).

import { useEffect, useReducer } from "react";
import type { GameMode } from "../types";
import { QUEST_COLORS, type IconId } from "../lib/objectiveTypes";

export const STATE_KEY = "tqp:state:v1";
export const STATE_VERSION = 1;

export interface SelectedTask {
  taskId: string;
  /** Index dans QUEST_COLORS, stable tant que la quête reste sélectionnée. */
  color: number;
}

export interface ManualPosition {
  mapId: string;
  x: number;
  z: number;
}

export interface CustomPoint {
  id: string;
  mapId: string;
  x: number;
  z: number;
  icon: IconId;
  label: string;
  note: string;
  createdAt: number;
}

export interface ModeState {
  selected: SelectedTask[];
  mapId: string | null;
  /** objectiveId -> date à laquelle il a été coché */
  done: Record<string, number>;
  /** clé de point (voir lib/points.ts) -> note */
  notes: Record<string, string>;
  /** Positions placées à la main pour les objectifs sans position. */
  manual: Record<string, ManualPosition>;
  customPoints: CustomPoint[];
}

export interface AppState {
  version: number;
  gameMode: GameMode | null;
  showDone: boolean;
  modes: Partial<Record<GameMode, ModeState>>;
}

export const emptyModeState = (): ModeState => ({
  selected: [],
  mapId: null,
  done: {},
  notes: {},
  manual: {},
  customPoints: [],
});

const initialState = (): AppState => ({
  version: STATE_VERSION,
  gameMode: null,
  showDone: false,
  modes: {},
});

/** Valide grossièrement un état lu (localStorage ou import) et complète les champs manquants. */
export function sanitizeState(raw: unknown): AppState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppState>;
  const modes: AppState["modes"] = {};
  for (const [mode, value] of Object.entries(r.modes ?? {})) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<ModeState>;
    modes[mode as GameMode] = {
      selected: Array.isArray(v.selected) ? v.selected.filter((s) => s && typeof s.taskId === "string") : [],
      mapId: typeof v.mapId === "string" ? v.mapId : null,
      done: v.done && typeof v.done === "object" ? v.done : {},
      notes: v.notes && typeof v.notes === "object" ? v.notes : {},
      manual: v.manual && typeof v.manual === "object" ? v.manual : {},
      customPoints: Array.isArray(v.customPoints) ? v.customPoints.filter((p) => p && typeof p.id === "string") : [],
    };
  }
  return {
    version: STATE_VERSION,
    // le mode est redemandé à chaque ouverture : on ne garde que le dernier choisi comme suggestion
    gameMode: null,
    showDone: r.showDone === true,
    modes,
  };
}

export type Action =
  | { type: "setGameMode"; mode: GameMode | null }
  | { type: "toggleTask"; taskId: string }
  | { type: "clearSelection" }
  | { type: "setMap"; mapId: string }
  | { type: "setDone"; objectiveId: string; done: boolean }
  | { type: "setNote"; key: string; note: string }
  | { type: "setManual"; objectiveId: string; position: ManualPosition | null }
  | { type: "addCustom"; point: CustomPoint }
  | { type: "updateCustom"; id: string; patch: Partial<Omit<CustomPoint, "id">> }
  | { type: "removeCustom"; id: string }
  | { type: "setShowDone"; value: boolean }
  | { type: "import"; state: AppState };

/** Applique une modification au ModeState du mode courant. */
function updateMode(state: AppState, fn: (m: ModeState) => ModeState): AppState {
  if (!state.gameMode) return state;
  const current = state.modes[state.gameMode] ?? emptyModeState();
  return { ...state, modes: { ...state.modes, [state.gameMode]: fn(current) } };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setGameMode":
      return { ...state, gameMode: action.mode };
    case "toggleTask":
      return updateMode(state, (m) => {
        if (m.selected.some((s) => s.taskId === action.taskId)) {
          return { ...m, selected: m.selected.filter((s) => s.taskId !== action.taskId) };
        }
        // première couleur libre, sinon on recommence la palette
        const used = new Set(m.selected.map((s) => s.color));
        let color = QUEST_COLORS.findIndex((_, i) => !used.has(i));
        if (color === -1) color = m.selected.length % QUEST_COLORS.length;
        return { ...m, selected: [...m.selected, { taskId: action.taskId, color }] };
      });
    case "clearSelection":
      return updateMode(state, (m) => ({ ...m, selected: [] }));
    case "setMap":
      return updateMode(state, (m) => ({ ...m, mapId: action.mapId }));
    case "setDone":
      return updateMode(state, (m) => {
        const done = { ...m.done };
        if (action.done) done[action.objectiveId] = Date.now();
        else delete done[action.objectiveId];
        return { ...m, done };
      });
    case "setNote":
      return updateMode(state, (m) => {
        const notes = { ...m.notes };
        if (action.note.trim()) notes[action.key] = action.note;
        else delete notes[action.key];
        return { ...m, notes };
      });
    case "setManual":
      return updateMode(state, (m) => {
        const manual = { ...m.manual };
        if (action.position) manual[action.objectiveId] = action.position;
        else delete manual[action.objectiveId];
        return { ...m, manual };
      });
    case "addCustom":
      return updateMode(state, (m) => ({ ...m, customPoints: [...m.customPoints, action.point] }));
    case "updateCustom":
      return updateMode(state, (m) => ({
        ...m,
        customPoints: m.customPoints.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }));
    case "removeCustom":
      return updateMode(state, (m) => ({
        ...m,
        customPoints: m.customPoints.filter((p) => p.id !== action.id),
      }));
    case "setShowDone":
      return { ...state, showDone: action.value };
    case "import":
      return { ...action.state, gameMode: state.gameMode };
  }
}

function loadState(): AppState {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(STATE_KEY) ?? "null"));
  } catch {
    return initialState();
  }
}

const LAST_MODE_KEY = "tqp:lastMode";
export function getLastMode(): GameMode | null {
  try {
    return localStorage.getItem(LAST_MODE_KEY) as GameMode | null;
  } catch {
    return null;
  }
}

/** Hook principal : état + dispatch, avec sauvegarde automatique (légèrement différée). */
export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
        if (state.gameMode) localStorage.setItem(LAST_MODE_KEY, state.gameMode);
      } catch (error) {
        console.warn("Sauvegarde locale impossible", error);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const modeState = (state.gameMode && state.modes[state.gameMode]) || emptyModeState();
  return { state, modeState, dispatch };
}

// --- Export / import JSON ---

export function exportState(state: AppState) {
  const payload = {
    app: "tarkov-quest-planner",
    exportedAt: new Date().toISOString(),
    ...state,
    gameMode: undefined,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tarkov-quest-planner-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readImportFile(file: File): Promise<AppState> {
  const json = JSON.parse(await file.text());
  if (!json || typeof json !== "object" || !("modes" in json)) {
    throw new Error("Ce fichier n'est pas une sauvegarde du planificateur.");
  }
  return sanitizeState(json);
}
