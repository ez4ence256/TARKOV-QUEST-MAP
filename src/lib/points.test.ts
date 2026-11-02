import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { emptyModeState } from "../state/store";
import { buildObjectivePoints, currentObjective, groupIdOf, isFreeOrder, isZoneRepeat, manualPointKey, objectiveMapCounts, questsUnlockedBy, questsByMap, shownObjectives, spawnGroups, taskMapIds, taskProgress } from "./points";

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

  it("montre d'un coup tous les objectifs non faits de la map de l'objectif en cours (Ill-Wisher, Soins privés)", () => {
    const at = (id: string, mapId: string) => ({ id, type: "mark", description: "", optional: false, mapIds: [mapId], locations: [{ mapId, position: { x: 0, y: 0, z: 0 } }] });
    const t: Task = { ...task, objectives: [at("s1", "m1"), at("s2", "m1"), at("l1", "m2"), at("s3", "m1"), task.objectives[2]] };
    const shown = (done: Record<string, number>) => shownObjectives(t, done, false, true).map((o) => o.id);
    expect(shown({})).toEqual(["s1", "s2", "s3"]);
    expect(shown({ s1: 1 })).toEqual(["s2", "s3"]);
    expect(shown({ s1: 1, s2: 1, s3: 1 })).toEqual(["l1"]);
    // objectif en cours sans map (remise d'objets) : lui seul
    expect(shown({ s1: 1, s2: 1, s3: 1, l1: 1 })).toEqual(["c"]);
  });

  it("objectif en cours sans map : le prochain raid est montré aussi (Le juste prix 2)", () => {
    const at = (id: string, mapId: string, optional = false) => ({ id, type: "visit", description: "", optional, mapIds: [mapId], locations: [{ mapId, position: { x: 0, y: 0, z: 0 } }] });
    const t: Task = { ...task, objectives: [{ ...task.objectives[2], type: "taskStatus" }, at("w1", "woods", true), at("w2", "woods", true), at("c1", "customs", true)] };
    expect(shownObjectives(t, {}, false, true).map((o) => o.id)).toEqual(["c", "w1", "w2"]);
  });

  it("quête sans ordre sur plusieurs maps : toutes ses maps sont montrées (Is This a Reference?)", () => {
    const at = (id: string, mapId: string, type = "plantItem") => ({ id, type, description: "", optional: false, mapIds: [mapId], locations: [{ mapId, position: { x: 0, y: 0, z: 0 } }] });
    const t: Task = { ...task, objectives: [at("s1", "streets"), at("c1", "customs"), at("w1", "woods", "visit")] };
    expect(isFreeOrder(t)).toBe(true);
    expect(shownObjectives(t, {}, false, true).map((o) => o.id)).toEqual(["s1", "c1", "w1"]);
    expect(shownObjectives(t, { s1: 1 }, false, true).map((o) => o.id)).toEqual(["c1", "w1"]);
    expect(buildObjectivePoints([t], emptyModeState(), "customs", false, true).map((p) => p.objectiveId)).toEqual(["c1"]);
  });

  it("une suite imposée reste un raid à la fois (ramasser puis déposer, transit, une seule map)", () => {
    const at = (id: string, mapId: string, type: string) => ({ id, type, description: "", optional: false, mapIds: [mapId], locations: [{ mapId, position: { x: 0, y: 0, z: 0 } }] });
    const suite: Task = { ...task, objectives: [at("f", "reserve", "findQuestItem"), at("p", "woods", "plantQuestItem")] };
    expect(isFreeOrder(suite)).toBe(false);
    expect(shownObjectives(suite, {}, false, true).map((o) => o.id)).toEqual(["f"]);
    expect(isFreeOrder({ ...task, objectives: [at("m", "woods", "mark"), at("e", "woods", "extract"), at("n", "lighthouse", "mark")] })).toBe(false);
    expect(isFreeOrder({ ...task, objectives: [at("a", "woods", "plantItem"), at("b", "woods", "visit")] })).toBe(false);
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

describe("quêtes débloquées par une quête terminée", () => {
  const q = (id: string, reqs: { taskId: string; status: string[] }[] = []): Task => ({
    ...task,
    id,
    name: id,
    nameEn: id,
    objectives: [{ id: `${id}-o`, type: "mark", description: "", optional: false, mapIds: [], locations: [] }],
    details: { taskRequirements: reqs, traderRequirements: [], neededKeys: [] } as unknown as Task["details"],
  });
  const gs2 = q("gs2");
  const gs3 = q("gs3", [{ taskId: "gs2", status: ["complete"] }]);
  const other = q("other");
  const signal = q("signal", [{ taskId: "gs3", status: ["complete"] }, { taskId: "other", status: ["complete"] }]);
  const whileActive = q("side", [{ taskId: "gs3", status: ["active"] }]);
  const tasks = [gs2, gs3, other, signal, whileActive];
  it("Gunsmith 2 terminée -> Gunsmith 3", () => {
    expect(questsUnlockedBy(gs2, tasks, { "gs2-o": 1 }).map((t) => t.id)).toEqual(["gs3"]);
  });
  it("une autre quête demandée pas encore terminée : pas proposée ; terminée : proposée", () => {
    expect(questsUnlockedBy(gs3, tasks, { "gs2-o": 1, "gs3-o": 1 }).map((t) => t.id)).toEqual([]);
    expect(questsUnlockedBy(gs3, tasks, { "gs2-o": 1, "gs3-o": 1, "other-o": 1 }).map((t) => t.id)).toEqual(["signal"]);
  });
  it("demandée seulement « active » ou déjà terminée : pas proposée", () => {
    expect(questsUnlockedBy(gs2, tasks, { "gs2-o": 1, "gs3-o": 1 })).toEqual([]);
  });
});

describe("emplacements possibles regroupés", () => {
  const sp = (key: string, x: number, z: number, objectiveId = "o", index = 1, count = 3) => ({ key, kind: "objective" as const, mapId: "m", x, z, objectiveId, spawn: { index, count } });
  it("un groupe par objectif, représenté par l'emplacement le plus proche du centre", () => {
    const g = spawnGroups([sp("a", 0, 0), sp("b", 10, 0), sp("c", 4, 1), { key: "x", kind: "objective" as const, mapId: "m", x: 1, z: 1, objectiveId: "p" }]);
    expect(g.get("o")).toEqual({ rep: "c", keys: ["a", "b", "c"] });
    expect(g.has("p")).toBe(false); // pas un emplacement possible
  });
  it("un seul emplacement sur la map : pas de groupe", () => {
    expect(spawnGroups([sp("a", 0, 0)]).size).toBe(0);
  });
});

describe("zone répétée par une variante de map", () => {
  const zone = (x: number, z: number, y = 0, mapId = "m1") => ({ mapId, position: { x, y, z } });
  // a et a' à 1 m (même zone), b ailleurs, c juste au-dessus d'un autre étage
  const o = { id: "o", type: "plantItem", description: "", optional: false, mapIds: ["m1"], locations: [zone(0, 0), zone(1, 0), zone(50, 50), zone(0, 1, 4), zone(0, 0, 0, "m2")] };
  const t: Task = { ...task, objectives: [o] };

  it("une seule position comptée par zone, par map et par étage", () => {
    expect(o.locations.map((l) => isZoneRepeat(o, l))).toEqual([false, true, false, false, false]);
    expect(objectiveMapCounts(o).get("m1")).toBe(3);
    expect(objectiveMapCounts(o).get("m2")).toBe(1);
  });

  it("regroupe seulement les positions de la même zone : les autres zones de l'objectif restent à part", () => {
    const pts = buildObjectivePoints([t], emptyModeState(), "m1", false);
    const g = spawnGroups(pts);
    expect(g.size).toBe(1);
    const [group] = [...g.values()];
    expect(group.keys).toEqual([pts[0].key, pts[1].key]);
    expect(groupIdOf(pts[1])).toBe(pts[0].key);
    expect(g.has(groupIdOf(pts[2]))).toBe(false);
  });

  it("les emplacements possibles restent regroupés par objectif", () => {
    const s = { ...o, locations: [{ ...zone(0, 0), possible: true as const }, { ...zone(1, 0), possible: true as const }] };
    const pts = buildObjectivePoints([{ ...t, objectives: [s] }], emptyModeState(), "m1", false);
    expect(s.locations.some((l) => isZoneRepeat(s, l))).toBe(false);
    expect([...spawnGroups(pts).keys()]).toEqual(["o"]);
  });
});

describe("quêtes par map (filtre « Mes maps » partagé en room)", () => {
  it("une quête compte sur les maps de ses objectifs affichés", () => {
    const m = { ...emptyModeState(), selected: [{ taskId: task.id, color: 0 }] };
    expect([...(questsByMap([task], m, false).get("m2") ?? [])]).toEqual([task.id]);
    // « un raid à la fois » : seulement la map de l'objectif en cours
    expect(questsByMap([task], m, true).has("m2")).toBe(false);
  });
});
