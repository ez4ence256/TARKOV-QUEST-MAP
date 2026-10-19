import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { emptyModeState } from "../state/store";
import { buildObjectivePoints, currentObjective, manualPointKey, taskMapIds, taskProgress } from "./points";

const task: Task = {
  id: "t",
  name: "T",
  nameEn: "T",
  normalizedName: "t",
  traderId: "p",
  mapId: "m1",
  minPlayerLevel: null,
  kappaRequired: false,
  wikiLink: null,
  objectives: [
    { id: "a", type: "mark", description: "", optional: false, mapIds: ["m1"], locations: [{ mapId: "m1", position: { x: 1, y: 0, z: 2 } }] },
    { id: "b", type: "visit", description: "", optional: false, mapIds: ["m2"], locations: [{ mapId: "m2", position: { x: 5, y: 0, z: 5 } }] },
    { id: "c", type: "giveItem", description: "", optional: false, mapIds: [], locations: [] },
    { id: "d", type: "shoot", description: "", optional: true, mapIds: [], locations: [] },
  ],
};

describe("maps d'une quête (filtre par map)", () => {
  it("objectif avec zones : seulement les maps de ses zones (Work Smarter : Labyrinth en trop chez tarkov.dev)", () => {
    const t: Task = { ...task, mapId: null, objectives: [{ id: "x", type: "visit", description: "", optional: false, mapIds: ["customs", "labyrinth"], locations: [{ mapId: "customs", position: { x: 0, y: 0, z: 0 } }] }] };
    expect([...taskMapIds(t)]).toEqual(["customs"]);
  });
  it("objectif sans zone : ses maps déclarées", () => {
    const t: Task = { ...task, mapId: null, objectives: [{ id: "y", type: "findItem", description: "", optional: false, mapIds: ["woods", "shoreline"], locations: [] }] };
    expect([...taskMapIds(t)].sort()).toEqual(["shoreline", "woods"]);
  });
});

describe("points", () => {
  it("ne garde que les points de la map affichée, sans les objectifs faits", () => {
    const mode = { ...emptyModeState(), done: { b: 1 } };
    expect(buildObjectivePoints([task], mode, "m1", false).map((p) => p.objectiveId)).toEqual(["a"]);
    expect(buildObjectivePoints([task], mode, "m2", false)).toEqual([]);
    expect(buildObjectivePoints([task], mode, "m2", true)).toHaveLength(1); // "afficher les faits"
  });

  it("ajoute les positions placées à la main pour les objectifs sans position", () => {
    const mode = { ...emptyModeState(), manual: { c: { mapId: "m1", x: 9, z: 9 } } };
    const pts = buildObjectivePoints([task], mode, "m1", false);
    expect(pts.find((p) => p.kind === "manual")?.key).toBe(manualPointKey("c"));
  });

  it("numérote les emplacements possibles d'un objet de quête, sur toutes les maps", () => {
    const spawnTask: Task = {
      ...task,
      objectives: [
        {
          id: "q",
          type: "findQuestItem",
          description: "",
          optional: false,
          mapIds: ["m1", "m2"],
          locations: [
            { mapId: "m1", position: { x: 1, y: 0, z: 1 }, possible: true },
            { mapId: "m2", position: { x: 2, y: 0, z: 2 }, possible: true },
            { mapId: "m1", position: { x: 3, y: 0, z: 3 }, possible: true },
          ],
        },
      ],
    };
    const pts = buildObjectivePoints([spawnTask], emptyModeState(), "m1", false);
    expect(pts.map((p) => p.spawn)).toEqual([
      { index: 1, count: 3 },
      { index: 3, count: 3 },
    ]);
    // une zone à visiter n'est pas un "emplacement possible"
    expect(buildObjectivePoints([task], emptyModeState(), "m1", false)[0].spawn).toBeUndefined();
  });

  it("calcule la progression sans compter les objectifs optionnels", () => {
    expect(taskProgress(task, { a: 1, d: 1 })).toEqual({ done: 1, total: 3 });
  });
});

describe("un objectif à la fois", () => {
  const ids = (done: Record<string, number>, map: string, oneAtATime = true, showDone = false) =>
    buildObjectivePoints([task], { ...emptyModeState(), done }, map, showDone, oneAtATime).map((p) => p.objectiveId);

  it("montre seulement le premier objectif non fait, et le suivant dès qu'il est coché", () => {
    expect(ids({}, "m1")).toEqual(["a"]);
    expect(ids({}, "m2")).toEqual([]);
    expect(ids({ a: 1 }, "m1")).toEqual([]);
    expect(ids({ a: 1 }, "m2")).toEqual(["b"]);
  });

  it("préfère un objectif obligatoire restant à un optionnel", () => {
    const t: Task = { ...task, objectives: [task.objectives[3], task.objectives[0]] };
    expect(currentObjective(t, {})?.id).toBe("a");
    expect(currentObjective(t, { a: 1 })?.id).toBe("d");
    expect(currentObjective(t, { a: 1, d: 1 })).toBeUndefined();
  });

  it("les objectifs faits suivent « afficher les faits », réglage désactivé = tout", () => {
    expect(ids({ a: 1 }, "m1", true, true)).toEqual(["a"]);
    expect(ids({}, "m2", false)).toEqual(["b"]);
  });
});
