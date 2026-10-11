import { describe, expect, it } from "vitest";
import { applyOpsToRoom, diffRoom, emptyRoomState, parseRoomOps, parseRoomState, roomStateOf, validRoomId } from "./roomSync";
import { applyRoomOps, emptyModeState, mergeRoomState, reducer, type AppState } from "../state/store";

const mode = (over = {}) => ({ ...emptyModeState(), ...over });

describe("roomStateOf", () => {
  it("extrait quêtes, objectifs cochés et Main story, en écartant les identifiants invalides", () => {
    const m = mode({
      selected: [
        { taskId: "t1", color: 0 },
        { taskId: "mauvais id", color: 1 },
      ],
      done: { o1: 123, o2: 456 },
      story: { selected: ["Tour"], done: { "Tour::x#1": true } },
    });
    expect(roomStateOf(m)).toEqual({ selected: ["t1"], done: ["o1", "o2"], storySelected: ["Tour"], storyDone: ["Tour::x#1"] });
  });
});

describe("diffRoom / applyOpsToRoom", () => {
  it("ne produit que les différences, en états absolus", () => {
    const prev = { ...emptyRoomState(), selected: ["a", "b"], done: ["o1"] };
    const next = { ...emptyRoomState(), selected: ["b", "c"], done: [], storyDone: ["s1"] };
    const ops = diffRoom(prev, next);
    expect(ops).toEqual(
      expect.arrayContaining([
        { kind: "task", id: "c", on: true },
        { kind: "task", id: "a", on: false },
        { kind: "done", id: "o1", on: false },
        { kind: "step", id: "s1", on: true },
      ]),
    );
    expect(ops).toHaveLength(4);
    expect(diffRoom(next, next)).toEqual([]);
  });

  it("appliquer le diff redonne l'état cible (remise à zéro comprise)", () => {
    const prev = { selected: ["a", "b", "c"], done: ["o1", "o2"], storySelected: ["Tour"], storyDone: ["s"] };
    const next = emptyRoomState();
    expect(applyOpsToRoom(prev, diffRoom(prev, next))).toEqual(next);
  });
});

describe("validation", () => {
  it("identifiants de quêtes et d'objectifs", () => {
    expect(validRoomId("task", "5a0bc3:x.y-z_1")).toBe(true);
    expect(validRoomId("task", "a b")).toBe(false);
    expect(validRoomId("task", "<img>")).toBe(false);
    expect(validRoomId("task", "a".repeat(101))).toBe(false);
    expect(validRoomId("story", "Tour::étape un#1")).toBe(true);
    expect(validRoomId("story", "x".repeat(201))).toBe(false);
    expect(validRoomId("step", "a\nb")).toBe(false);
  });
  it("messages du serveur mal formés refusés", () => {
    expect(parseRoomOps([{ kind: "task", id: "a", on: true }])).toHaveLength(1);
    expect(parseRoomOps([{ kind: "nope", id: "a", on: true }])).toBeNull();
    expect(parseRoomOps([{ kind: "task", id: "a", on: "oui" }])).toBeNull();
    expect(parseRoomOps("x")).toBeNull();
    expect(parseRoomState({ selected: ["a"], done: [], storySelected: [], storyDone: [] })).not.toBeNull();
    expect(parseRoomState({ selected: ["a"] })).toBeNull();
    expect(parseRoomState({ selected: [1], done: [], storySelected: [], storyDone: [] })).toBeNull();
  });
});

describe("état local et room", () => {
  const room = { selected: ["a"], done: ["o1"], storySelected: ["Tour"], storyDone: ["Tour::x#1"] };

  it("jointure : union, couleurs et notes locales gardées", () => {
    const m = mode({ selected: [{ taskId: "z", color: 3 }], done: { o9: 5 }, notes: { k: "n" } });
    const out = mergeRoomState(m, room, false);
    expect(out.selected.map((s) => s.taskId).sort()).toEqual(["a", "z"]);
    expect(out.selected.find((s) => s.taskId === "z")?.color).toBe(3);
    expect(Object.keys(out.done).sort()).toEqual(["o1", "o9"]);
    expect(out.notes).toEqual({ k: "n" });
    expect(out.story).toEqual({ selected: ["Tour"], done: { "Tour::x#1": true } });
  });

  it("reconnexion : remplacement exact par la room", () => {
    const m = mode({ selected: [{ taskId: "z", color: 3 }], done: { o9: 5 } });
    const out = mergeRoomState(m, room, true);
    expect(out.selected.map((s) => s.taskId)).toEqual(["a"]);
    expect(Object.keys(out.done)).toEqual(["o1"]);
  });

  it("opérations distantes appliquées au mode de la room, pas au mode courant", () => {
    const state: AppState = { version: 1, gameMode: "regular", showDone: false, modes: {} };
    const next = reducer(state, {
      type: "roomOps",
      mode: "pve",
      ops: [
        { kind: "task", id: "a", on: true },
        { kind: "done", id: "o1", on: true },
      ],
    });
    expect(next.modes.pve?.selected.map((s) => s.taskId)).toEqual(["a"]);
    expect(next.modes.regular).toBeUndefined();
    expect(next.modes.pve?.done.o1).toBeGreaterThan(0);
    const off = applyRoomOps(next.modes.pve!, [
      { kind: "task", id: "a", on: false },
      { kind: "done", id: "o1", on: false },
    ]);
    expect(off.selected).toEqual([]);
    expect(off.done).toEqual({});
  });

  it("un état appliqué ne produit aucune opération en retour", () => {
    const m = mergeRoomState(emptyModeState(), room, true);
    expect(diffRoom(room, roomStateOf(m))).toEqual([]);
  });
});
