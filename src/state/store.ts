// État personnel de l'utilisateur (sélection, progression, notes, points perso).
// Tout est sauvegardé automatiquement dans le localStorage, séparément pour
// chaque mode de jeu (la progression PvE n'est pas celle du PvP).

import { useEffect, useReducer } from "react";
import type { GameMode } from "../types";
import { tr } from "../lib/i18n";
import { QUEST_COLORS, type IconId } from "../lib/objectiveTypes";
import { storyStepId } from "../lib/story";

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

/**
 * Main story (chapitres du wiki), à part des quêtes : rien ici ne touche aux points de la carte,
 * aux couleurs ni aux compteurs. Chapitre = titre de la page anglaise du wiki.
 */
export interface StoryState {
  selected: string[];
  /** storyStepId(chapitre, clé d'étape) -> true */
  done: Record<string, true>;
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
  /** Facultatif : absent tant qu'aucun chapitre n'a été choisi. */
  story?: StoryState;
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

function sanitizeStory(raw: unknown): StoryState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<StoryState>;
  const selected = Array.isArray(r.selected) ? [...new Set(r.selected.filter((t): t is string => typeof t === "string"))] : [];
  const done: Record<string, true> = {};
  if (r.done && typeof r.done === "object") {
    for (const [id, value] of Object.entries(r.done)) if (value === true) done[id] = true;
  }
  return { selected, done };
}

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
    const story = sanitizeStory(v.story);
    if (story) modes[mode as GameMode]!.story = story;
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
  /** Ajoute ou retire un chapitre de la Main story (titre de la page anglaise). */
  | { type: "toggleStory"; chapter: string }
  /** Coche ou décoche une étape d'un chapitre. */
  | { type: "setStoryStep"; chapter: string; stepKey: string; done: boolean }
  /** Décoche toutes les étapes d'un chapitre. */
  | { type: "resetStory"; chapter: string }
  | { type: "setMap"; mapId: string }
  | { type: "setDone"; objectiveId: string; done: boolean }
  | { type: "setNote"; key: string; note: string }
  | { type: "setManual"; objectiveId: string; position: ManualPosition | null }
  | { type: "addCustom"; point: CustomPoint }
  | { type: "updateCustom"; id: string; patch: Partial<Omit<CustomPoint, "id">> }
  | { type: "removeCustom"; id: string }
  | { type: "setShowDone"; value: boolean }
  | { type: "import"; state: AppState }
  /** Remet à "pas fait" les objectifs donnés (une quête), dans le mode courant seulement. */
  | { type: "resetProgress"; objectiveIds: string[] }
  /** Remet à "pas fait" tous les objectifs du mode courant (notes et points perso gardés). */
  | { type: "resetAllProgress" }
  /** Ajoute des quêtes à la sélection (import par capture) ; replace = vide d'abord la sélection. */
  | { type: "selectTasks"; taskIds: string[]; replace: boolean };

/** Première couleur libre, sinon on recommence la palette. */
function nextColor(selected: SelectedTask[]): number {
  const used = new Set(selected.map((s) => s.color));
  const color = QUEST_COLORS.findIndex((_, i) => !used.has(i));
  return color === -1 ? selected.length % QUEST_COLORS.length : color;
}

/** Applique une modification au ModeState du mode courant. */
function updateMode(state: AppState, fn: (m: ModeState) => ModeState): AppState {
  if (!state.gameMode) return state;
  const current = state.modes[state.gameMode] ?? emptyModeState();
  return { ...state, modes: { ...state.modes, [state.gameMode]: fn(current) } };
}

/**
 * Réducteur de l'état. Les réinitialisations ne touchent qu'aux cases cochées (objectifs `done`
 * et étapes de la Main story) du mode courant : notes, positions placées à la main, points perso,
 * chapitres choisis et autres modes sont conservés.
 */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setGameMode":
      return { ...state, gameMode: action.mode };
    case "toggleTask":
      return updateMode(state, (m) => {
        if (m.selected.some((s) => s.taskId === action.taskId)) {
          return { ...m, selected: m.selected.filter((s) => s.taskId !== action.taskId) };
        }
        return { ...m, selected: [...m.selected, { taskId: action.taskId, color: nextColor(m.selected) }] };
      });
    case "clearSelection":
      return updateMode(state, (m) => ({ ...m, selected: [] }));
    case "toggleStory":
      return updateMode(state, (m) => {
        const story = m.story ?? { selected: [], done: {} };
        const selected = story.selected.includes(action.chapter)
          ? story.selected.filter((c) => c !== action.chapter)
          : [...story.selected, action.chapter];
        return { ...m, story: { ...story, selected } };
      });
    case "setStoryStep":
      return updateMode(state, (m) => {
        const story = m.story ?? { selected: [], done: {} };
        const done = { ...story.done };
        const id = storyStepId(action.chapter, action.stepKey);
        if (action.done) done[id] = true;
        else delete done[id];
        return { ...m, story: { ...story, done } };
      });
    case "resetStory":
      return updateMode(state, (m) => {
        if (!m.story) return m;
        const prefix = storyStepId(action.chapter, "");
        const done = Object.fromEntries(Object.entries(m.story.done).filter(([id]) => !id.startsWith(prefix)));
        return { ...m, story: { ...m.story, done } };
      });
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
    case "resetProgress":
      return updateMode(state, (m) => {
        const done = { ...m.done };
        for (const id of action.objectiveIds) delete done[id];
        return { ...m, done };
      });
    case "resetAllProgress":
      return updateMode(state, (m) => ({ ...m, done: {}, ...(m.story ? { story: { ...m.story, done: {} } } : {}) }));
    case "selectTasks":
      return updateMode(state, (m) => {
        const selected = action.replace ? [] : [...m.selected];
        for (const taskId of action.taskIds) {
          if (selected.some((s) => s.taskId === taskId)) continue;
          selected.push({ taskId, color: nextColor(selected) });
        }
        return { ...m, selected };
      });
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
    throw new Error(tr("Ce fichier n'est pas une sauvegarde du planificateur.", "This file is not a planner backup."));
  }
  return sanitizeState(json);
}
