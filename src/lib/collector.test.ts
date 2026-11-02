import { describe, expect, it } from "vitest";
import type { Objective, Task } from "../types";
import { collectorItems, isCollector } from "./collector";
import { computeNeeds } from "./itemNeeds";

const obj = (id: string, itemIds: string[]): Objective => ({ id, type: "giveItem", description: "", optional: false, mapIds: [], locations: [], itemIds, count: 1, foundInRaid: true });
const task = (id: string, nameEn: string, objectives: Objective[]): Task => ({
  id, name: nameEn, nameEn, normalizedName: id, traderId: "t", mapId: null, minPlayerLevel: null, kappaRequired: false, wikiLink: null, objectives,
});
const tasks = [task("c", "Collector", [obj("o1", ["i1"]), obj("o2", ["i2"])]), task("q", "Other", [obj("o3", ["i1"])])];

describe("collector", () => {
  it("isCollector par nom anglais", () => {
    expect(tasks.map(isCollector)).toEqual([true, false]);
  });
  it("kept = objectif coché", () => {
    const m = collectorItems(tasks, { o1: 1 });
    expect(m.get("i1")).toEqual({ objectiveId: "o1", kept: true });
    expect(m.get("i2")).toEqual({ objectiveId: "o2", kept: false });
    expect(m.has("zz")).toBe(false);
  });
  it("objet de Collector et d'une autre quête : coché, il ne reste que l'autre quête", () => {
    expect(computeNeeds({ tasks, done: {} }).get("i1")!.count).toBe(2);
    const n = computeNeeds({ tasks, done: { o1: 1 } }).get("i1")!;
    expect(n.count).toBe(1);
    expect(n.sources).toMatchObject([{ taskId: "q" }]);
  });
});
