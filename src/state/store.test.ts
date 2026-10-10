import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { emptyModeState, reducer, type Action, type AppState, type ModeState } from "./store";
import { orphanDoneCount, tasksWithProgress } from "../lib/points";

// « Signal - Partie 3 » (« Signal - Part 3 ») : identifiants réels de l'API tarkov.dev,
// trois brouilleurs à placer sur Littoral.
const SHORELINE = "5704e554d2720bac5b8b456e";
const JAMMER_1 = "5ac7a7bf86f774132252a524";
const JAMMER_2 = "5ac7a83b86f774665012340b";
const JAMMER_3 = "5ac7a8d386f7741321499e3c";
const signal3: Task = {
  id: "5ac346cf86f7741d63233a02",
  name: "Signal - Partie 3",
  nameEn: "Signal - Part 3",
  normalizedName: "signal-part-3",
  traderId: "mechanic",
  mapId: SHORELINE,
  minPlayerLevel: null,
  kappaRequired: true,
  wikiLink: "https://escapefromtarkov.fandom.com/wiki/Signal_-_Part_3",
  objectives: [JAMMER_1, JAMMER_2, JAMMER_3].map((id, i) => ({
    id,
    type: "mark",
    description: `Placez le brouilleur ${i + 1} sur le littoral`,
    optional: false,
    mapIds: [SHORELINE],
    locations: [{ mapId: SHORELINE, position: { x: i, y: 0, z: i } }],
  })),
};
const otherTask: Task = { ...signal3, id: "autre", name: "Autre", nameEn: "Other", objectives: [{ ...signal3.objectives[0], id: "o-autre" }] };

function stateWith(regular: Partial<ModeState>, pve: Partial<ModeState>): AppState {
  return {
    version: 1,
    gameMode: "regular",
    showDone: false,
    modes: {
      regular: { ...emptyModeState(), ...regular },
      pve: { ...emptyModeState(), ...pve },
    },
  };
}

const customPoint = { id: "c1", mapId: SHORELINE, x: 1, z: 1, icon: "star" as const, label: "Planque", note: "", createdAt: 1 };

describe("réinitialisation de la progression", () => {
  const initial = stateWith(
    {
      // brouilleur 2 coché par erreur, brouilleur 1 vraiment fait, autre quête faite
      done: { [JAMMER_1]: 10, [JAMMER_2]: 20, "o-autre": 30 },
      notes: { [`${JAMMER_2}@1.0,1.0`]: "pas encore fait" },
      manual: { "sans-position": { mapId: SHORELINE, x: 5, z: 5 } },
      customPoints: [customPoint],
    },
    { done: { [JAMMER_1]: 99, [JAMMER_2]: 99 } },
  );

  it("annule un seul objectif coché par erreur (Signal - Partie 3, brouilleur 2)", () => {
    const next = reducer(initial, { type: "setDone", objectiveId: JAMMER_2, done: false });
    expect(next.modes.regular!.done).toEqual({ [JAMMER_1]: 10, "o-autre": 30 });
  });

  it("réinitialise une quête : tous ses objectifs redeviennent « pas faits »", () => {
    const next = reducer(initial, { type: "resetProgress", objectiveIds: signal3.objectives.map((o) => o.id) });
    expect(next.modes.regular!.done).toEqual({ "o-autre": 30 }); // l'autre quête n'est pas touchée
  });

  it("réinitialise tout le mode courant", () => {
    const next = reducer(initial, { type: "resetAllProgress" });
    expect(next.modes.regular!.done).toEqual({});
  });

  it("ne touche jamais aux autres modes", () => {
    const actions: Action[] = [
      { type: "resetProgress", objectiveIds: [JAMMER_1, JAMMER_2, JAMMER_3] },
      { type: "resetAllProgress" },
    ];
    for (const action of actions) {
      const next = reducer(initial, action);
      expect(next.modes.pve).toBe(initial.modes.pve);
      expect(next.modes.pve!.done).toEqual({ [JAMMER_1]: 99, [JAMMER_2]: 99 });
    }
  });

  it("garde les notes, les positions placées à la main et les points perso", () => {
    const next = reducer(initial, { type: "resetAllProgress" });
    const regular = next.modes.regular!;
    expect(regular.notes).toBe(initial.modes.regular!.notes);
    expect(regular.manual).toBe(initial.modes.regular!.manual);
    expect(regular.customPoints).toEqual([customPoint]);
  });

  it("ne fait rien sans mode de jeu choisi", () => {
    const noMode = { ...initial, gameMode: null };
    expect(reducer(noMode, { type: "resetAllProgress" })).toBe(noMode);
  });

  it("liste les quêtes qui ont de la progression, et les objectifs orphelins", () => {
    const done = initial.modes.regular!.done;
    expect(tasksWithProgress([otherTask, signal3], done).map((t) => t.name)).toEqual(["Autre", "Signal - Partie 3"]);
    expect(tasksWithProgress([signal3], {})).toEqual([]);
    expect(orphanDoneCount([signal3], done)).toBe(1); // "o-autre" n'est pas dans la liste fournie
  });
});
