import { describe, expect, it } from "vitest";
import type { Objective, Task } from "../types";
import { computeNeeds } from "./itemNeeds";

const obj = (id: string, type: string, extra: Partial<Objective> = {}): Objective => ({ id, type, description: "", optional: false, mapIds: [], locations: [], ...extra });
const task = (id: string, objectives: Objective[], faction?: "BEAR" | "USEC"): Task => ({
  id, name: id, nameEn: id, normalizedName: id, traderId: "t", mapId: null, minPlayerLevel: null, kappaRequired: false, wikiLink: null, objectives, ...(faction ? { faction } : {}),
});

describe("computeNeeds", () => {
  const tasks = [
    task("q1", [obj("a", "giveItem", { itemIds: ["i1"], count: 3, foundInRaid: true }), obj("b", "findItem", { itemIds: ["i1"], count: 3 }), obj("c", "plantItem", { itemIds: ["i2"], count: 1 })]),
    task("q2", [obj("d", "giveItem", { itemIds: ["i1"], count: 2 }), obj("e", "giveItem", { itemIds: ["i3", "i4"], count: 1 })]),
    task("bear", [obj("f", "giveItem", { itemIds: ["i5"], count: 1 })], "BEAR"),
  ];
  it("compte seulement les remises non cochées (findItem et plantItem exclus), « au choix » à part", () => {
    const n = computeNeeds({ tasks, done: {} });
    expect(n.get("i1")).toMatchObject({ count: 5, firCount: 3, anyOf: false });
    expect(n.get("i1")!.sources).toHaveLength(2);
    expect(n.has("i2")).toBe(false);
    expect(n.get("i3")).toMatchObject({ count: 0, anyOf: true });
    expect(n.get("i3")!.sources[0]).toMatchObject({ kind: "quest", taskId: "q2", anyOf: true });
  });
  it("objectif coché, quête grisée ou échouée : plus rien à garder", () => {
    expect(computeNeeds({ tasks, done: { a: 1 } }).get("i1")!.count).toBe(2);
    expect(computeNeeds({ tasks, done: {}, failed: { q1: true } }).get("i1")!.count).toBe(2);
    expect(computeNeeds({ tasks, done: { d: 1, e: 1 } }).has("i3")).toBe(false);
  });
  it("faction : l'autre faction ne compte pas ; sans faction, tout compte", () => {
    expect(computeNeeds({ tasks, done: {}, faction: "USEC" }).has("i5")).toBe(false);
    expect(computeNeeds({ tasks, done: {}, faction: "BEAR" }).has("i5")).toBe(true);
    expect(computeNeeds({ tasks, done: {} }).has("i5")).toBe(true);
  });
  it("planque : seulement les niveaux au-dessus du niveau construit", () => {
    const stations = [{ id: "s", name: "S", levels: [{ level: 1, items: [{ itemId: "h", count: 2, fir: false }] }, { level: 2, items: [{ itemId: "h", count: 5, fir: true }] }] }];
    expect(computeNeeds({ tasks: [], done: {}, stations, hideoutLevels: { s: 1 } }).get("h")).toMatchObject({ count: 5, firCount: 5, sources: [{ kind: "station", stationId: "s", level: 2 }] });
    expect(computeNeeds({ tasks: [], done: {}, stations }).get("h")!.count).toBe(7);
    expect(computeNeeds({ tasks: [], done: {} }).size).toBe(0);
  });
});
