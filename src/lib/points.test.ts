import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { emptyModeState } from "../state/store";
import { buildObjectivePoints, manualPointKey, taskProgress } from "./points";

const task: Task = {
  id: "t",
  name: "T",
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

  it("calcule la progression sans compter les objectifs optionnels", () => {
    expect(taskProgress(task, { a: 1, d: 1 })).toEqual({ done: 1, total: 3 });
  });
});
