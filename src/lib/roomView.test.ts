import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { buildObjectivePoints } from "./points";
import { publicSnapshotOf } from "./roomSync";
import { teammateTasks, viewModeOf } from "./roomView";
import { emptyModeState } from "../state/store";

const obj = (id: string, x: number, mapId = "m1") => ({ id, type: "mark", description: id, optional: false, mapIds: [mapId], locations: [{ mapId, position: { x, y: 0, z: 0 } }] });
const task = { id: "t1", name: "T1", objectives: [obj("a", 1), obj("b", 2)] } as unknown as Task;
const manualTask = { id: "t2", name: "T2", objectives: [{ id: "c", type: "mark", description: "c", optional: false, mapIds: [], locations: [] }] } as unknown as Task;
const tasksById = new Map([task, manualTask].map((t) => [t.id, t]));

describe("viewModeOf : l'instantané d'un coéquipier, prêt à afficher", () => {
  const theirs = {
    ...emptyModeState(),
    selected: [
      { taskId: "t1", color: 2 },
      { taskId: "t2", color: 5 },
    ],
    done: { a: 123 },
    manual: { c: { mapId: "m1", x: 9, z: 9 } },
  };
  const snapshot = publicSnapshotOf(theirs, tasksById);

  it("garde seulement les quêtes connues localement, avec leurs cases cochées et positions manuelles", () => {
    const view = viewModeOf({ ...snapshot, selected: [...snapshot.selected, { taskId: "inconnue", color: 1 }] }, tasksById);
    expect(view.selected.map((s) => s.taskId)).toEqual(["t1", "t2"]);
    expect(view.done).toEqual({ a: 1 });
    expect(view.manual.c).toEqual({ mapId: "m1", x: 9, z: 9 });
    expect(teammateTasks(view, tasksById).map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("mêmes points que chez lui : « un raid à la fois » et position manuelle", () => {
    const view = viewModeOf(snapshot, tasksById);
    const mine = buildObjectivePoints(teammateTasks(theirs, tasksById), theirs, "m1", false, true);
    const shown = buildObjectivePoints(teammateTasks(view, tasksById), view, "m1", false, true);
    expect(shown.map((p) => p.key)).toEqual(mine.map((p) => p.key));
    expect(shown.some((p) => p.kind === "manual" && p.x === 9)).toBe(true);
    // a est fait chez lui : il n'y a que b (et la position manuelle de c)
    expect(shown.filter((p) => p.kind === "objective").map((p) => p.objectiveId)).toEqual(["b"]);
  });

  it("ne dépend d'aucune donnée locale : l'état de l'utilisateur n'est jamais lu ni modifié", () => {
    const local = { ...emptyModeState(), selected: [{ taskId: "t1", color: 0 }], done: { b: 5 } };
    const before = JSON.stringify(local);
    const view = viewModeOf(snapshot, tasksById);
    expect(view).not.toBe(local);
    expect(view.done).not.toHaveProperty("b");
    expect(JSON.stringify(local)).toBe(before);
  });
});
