import { describe, expect, it } from "vitest";
import { maskCode, parseMonitorEvent } from "./monitor";

const task = { v: 1, type: "task", status: "finished", taskId: "5936d90786f7742b1420ba5b", gameMode: "pve", at: 123 };
const pos = { v: 1, type: "position", map: "customs", x: 1, y: 2, z: 3, rotation: 90, gameMode: "regular", at: 5 };

describe("parseMonitorEvent", () => {
  it("accepte les événements valides", () => {
    expect(parseMonitorEvent(task)).toEqual({ type: "task", status: "finished", taskId: task.taskId, gameMode: "pve", at: 123 });
    expect(parseMonitorEvent(pos)).toMatchObject({ type: "position", map: "customs", rotation: 90 });
    expect(parseMonitorEvent({ v: 1, type: "map", map: "woods", gameMode: "pve" })).toMatchObject({ type: "map", map: "woods" });
    expect(parseMonitorEvent({ v: 1, type: "hello" })?.type).toBe("hello");
  });
  it("accepte le mode PvP Saison", () => expect(parseMonitorEvent({ ...task, gameMode: "pvp-season" })?.type).toBe("task"));
  it("rejette le reste", () => {
    for (const bad of [null, "x", { ...task, v: 2 }, { ...task, taskId: "abc" }, { ...task, status: "modified" }, { ...task, gameMode: "season" }, { ...pos, x: NaN }, { ...pos, map: "Customs" }, { v: 1, type: "?" }]) {
      expect(parseMonitorEvent(bad)).toBeNull();
    }
  });
  it("masque le code", () => expect(maskCode("AbCdEfGh12345678")).toBe("AbCd…5678"));
});
