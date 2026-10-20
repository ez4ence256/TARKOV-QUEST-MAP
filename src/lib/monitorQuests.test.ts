import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { planMonitorBatch } from "./monitorQuests";

const ev = (taskId: string, status: "started" | "finished" | "failed", gameMode = "pve" as const) => ({ type: "task" as const, taskId, status, gameMode, at: 1 });
const task = (id: string, reqs: string[] = [], failedBy?: string[]) =>
  ({ id, name: id, objectives: [{ id: id + "o1" }, { id: id + "o2" }], failedBy, details: { taskRequirements: reqs.map((r) => ({ taskId: r, status: ["complete"] })) } }) as unknown as Task;
const tasks = [task("a"), task("b", ["a"]), task("c", [], ["b"]), task("d")];
const ctx = { gameMode: "pve" as const, tasks, done: {}, failed: {}, selected: [] as string[], inRoom: false };

describe("planMonitorBatch", () => {
  it("started : sélectionne et grise les prérequis", () => {
    const p = planMonitorBatch([ev("b", "started")], ctx);
    expect(p.action).toMatchObject({ select: ["b"], done: ["ao1", "ao2"] });
    expect(p.counts).toMatchObject({ started: 1, prereq: 1 });
    expect(p.undo?.undone).toEqual(["ao1", "ao2"]);
  });
  it("en room : pas de grisage automatique", () => {
    expect(planMonitorBatch([ev("b", "started")], { ...ctx, inRoom: true }).action).toMatchObject({ select: ["b"], done: [] });
  });
  it("finished : coche, désélectionne et échoue les branches ; le dernier statut gagne", () => {
    const p = planMonitorBatch([ev("b", "started"), ev("b", "finished")], { ...ctx, selected: ["b"] });
    expect(p.action).toEqual({ done: ["bo1", "bo2"], failed: ["c"], deselect: ["b"], select: [] });
  });
  it("failed : marque échouée et désélectionne", () => {
    expect(planMonitorBatch([ev("d", "failed")], { ...ctx, selected: ["d"] }).action).toMatchObject({ failed: ["d"], deselect: ["d"] });
  });
  it("ignore autre mode et quêtes inconnues", () => {
    const p = planMonitorBatch([ev("d", "started", "regular" as never), ev("zz", "started")], ctx);
    expect(p.action).toBeNull();
    expect(p.counts.ignored).toBe(1);
  });
});
