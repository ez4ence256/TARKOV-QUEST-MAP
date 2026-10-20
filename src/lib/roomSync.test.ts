import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  cleanNickname,
  parseMembers,
  parseSnapshot,
  publicSnapshotOf,
  publishablePosition,
  restoreFromBackup,
  SNAPSHOT_LIMITS,
} from "./roomSync";
import { emptyModeState, reducer, type Action, type AppState } from "../state/store";

const task = (id: string, objectives: string[]) => ({ id, name: id, objectives: objectives.map((o) => ({ id: o })) }) as unknown as Task;
const tasksById = new Map([task("t1", ["o1", "o2"]), task("t2", ["o3"]), task("t3", ["o4"])].map((t) => [t.id, t]));
const mode = (over = {}) => ({ ...emptyModeState(), ...over });

describe("publicSnapshotOf", () => {
  const m = mode({
    selected: [
      { taskId: "t1", color: 2 },
      { taskId: "mauvais id", color: 1 },
      { taskId: "inconnue", color: 3 },
    ],
    // o3 appartient à une quête NON sélectionnée, o9 à aucune quête connue
    done: { o1: 1, o2: 2, o3: 3, o9: 4 },
    manual: { o1: { mapId: "customs", x: 1, z: 2 }, o4: { mapId: "customs", x: 5, z: 6 } },
    notes: { "o1@manual": "secret" },
    failed: { t1: true as const },
    hideout: { s1: 2 },
    faction: "BEAR" as const,
    customPoints: [{ id: "c", mapId: "customs", x: 0, z: 0, icon: "key", label: "perso", note: "", createdAt: 1 }],
    story: { selected: ["Tour"], done: { "Tour::a#1": true as const, "Tour 2::b#1": true as const, "Autre::c#1": true as const } },
  });
  const snap = publicSnapshotOf(m as never, tasksById);

  it("quêtes choisies, cases cochées et positions de CES quêtes seulement", () => {
    expect(snap.selected).toEqual([
      { taskId: "t1", color: 2 },
      { taskId: "inconnue", color: 3 },
    ]);
    expect(snap.done.sort()).toEqual(["o1", "o2"]);
    expect(snap.manual).toEqual([{ objectiveId: "o1", mapId: "customs", x: 1, z: 2 }]);
  });
  it("étapes de la Main story des chapitres choisis seulement (« Tour 2 » n'est pas « Tour »)", () => {
    expect(snap.storySelected).toEqual(["Tour"]);
    expect(snap.storyDone).toEqual(["Tour::a#1"]);
  });
  it("rien de personnel ne sort : notes, points perso, échecs, planque, faction", () => {
    expect(JSON.stringify(snap)).not.toMatch(/secret|perso|hideout|BEAR|failed/);
    expect(Object.keys(snap).sort()).toEqual(["done", "manual", "selected", "storyDone", "storySelected"]);
  });
  it("mode vide ou inconnu : instantané vide, plafonds respectés", () => {
    expect(publicSnapshotOf(undefined, tasksById)).toEqual({ selected: [], done: [], manual: [], storySelected: [], storyDone: [] });
    const many = Array.from({ length: SNAPSHOT_LIMITS.selected + 50 }, (_, i) => ({ taskId: `q${i}`, color: 0 }));
    expect(publicSnapshotOf(mode({ selected: many }) as never, tasksById).selected).toHaveLength(SNAPSHOT_LIMITS.selected);
  });
  it("accepté par la validation reçue (même forme que le serveur)", () => {
    expect(parseSnapshot(snap)).toEqual(snap);
  });
});

describe("publishablePosition", () => {
  const pos = { mapId: "abc123", x: 1, y: 2, z: 3, rotation: 90, at: 1_000_000, gameMode: "pve" as const };
  it("seulement dans le mode de la room et si elle a moins de 5 minutes", () => {
    expect(publishablePosition(pos, "pve", 1_000_000 + 60_000)).toEqual({ map: "abc123", x: 1, y: 2, z: 3, rotation: 90, gameMode: "pve", at: 1_000_000 });
    expect(publishablePosition(pos, "regular", 1_000_000 + 60_000)).toBeUndefined();
    expect(publishablePosition(pos, "pve", 1_000_000 + 5 * 60_000 + 1)).toBeUndefined();
    expect(publishablePosition(null, "pve")).toBeUndefined();
  });
});

describe("parseSnapshot / parseMembers (données du serveur non fiables)", () => {
  const ok = { selected: [{ taskId: "t1", color: 1 }], done: ["o1"], manual: [], storySelected: [], storyDone: [] };
  it("refuse les formes et identifiants invalides", () => {
    expect(parseSnapshot(ok)).toEqual(ok);
    expect(parseSnapshot({ ...ok, done: ["<x>"] })).toBeNull();
    expect(parseSnapshot({ ...ok, selected: [{ taskId: "t1", color: -1 }] })).toBeNull();
    expect(parseSnapshot({ ...ok, manual: [{ objectiveId: "o", mapId: "A B", x: 0, z: 0 }] })).toBeNull();
    expect(parseSnapshot({ ...ok, position: { map: "m", x: 1, y: 2, z: 3, rotation: 0, gameMode: "nope", at: 1 } })).toBeNull();
    expect(parseSnapshot({ ...ok, done: undefined })).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });
  it("membres : pseudo nettoyé, identifiant vérifié", () => {
    expect(parseMembers([{ id: "a1", name: "  Bob\u0007  ", connected: true }])).toEqual([{ id: "a1", name: "Bob", connected: true }]);
    expect(parseMembers([{ id: "a b", name: "x", connected: true }])).toBeNull();
    expect(parseMembers("x")).toBeNull();
  });
});

describe("cleanNickname", () => {
  it("20 caractères, sans caractères de contrôle, « Joueur » si vide", () => {
    expect(cleanNickname("  Alice ")).toBe("Alice");
    expect(cleanNickname("a".repeat(40))).toBe("a".repeat(20));
    expect(cleanNickname("Al\u0000i\nce")).toBe("Alice");
    expect(cleanNickname("   ")).toBe("Joueur");
    expect(cleanNickname(undefined)).toBe("Joueur");
  });
});

describe("isolation : une room ne modifie jamais l'état local", () => {
  it("le reducer n'a aucune action venant de la room", () => {
    const state: AppState = { version: 1, gameMode: "pve", showDone: false, modes: { pve: mode({ selected: [{ taskId: "t1", color: 0 }], done: { o1: 1 } }) } };
    const before = JSON.stringify(state);
    for (const type of ["roomSnapshot", "roomOps", "restoreMode"]) {
      const next = reducer(state, { type, mode: "pve", state: { selected: ["x"] }, ops: [] } as unknown as Action);
      expect(next === undefined || next === state).toBe(true); // action inconnue : rien d'appliqué
    }
    // recevoir (analyser) l'instantané d'un autre ne touche pas à l'état
    parseSnapshot({ selected: [{ taskId: "zzz", color: 0 }], done: ["oX"], manual: [], storySelected: [], storyDone: [] });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("restoreFromBackup (ancienne room v1)", () => {
  const base: AppState = {
    version: 1,
    gameMode: "pve",
    showDone: true,
    modes: {
      pve: mode({ selected: [{ taskId: "ami", color: 0 }], done: { oAmi: 9 }, notes: { n: "garde" }, hideout: { s1: 3 } }),
      regular: mode({ selected: [{ taskId: "r", color: 0 }] }),
    },
  };
  const saved = { selected: [{ taskId: "moi", color: 4 }], done: { oMoi: 5 }, story: { selected: ["Tour"], done: { "Tour::a#1": true } } };
  it("remet sélection, cases cochées et story du mode ; garde le reste et les autres modes", () => {
    const out = restoreFromBackup(base, "pve", saved);
    expect(out.modes.pve).toMatchObject({ selected: [{ taskId: "moi", color: 4 }], done: { oMoi: 5 }, story: { selected: ["Tour"], done: { "Tour::a#1": true } }, notes: { n: "garde" }, hideout: { s1: 3 } });
    expect(out.modes.regular).toBe(base.modes.regular);
    expect(out.showDone).toBe(true);
    expect(out.gameMode).toBe("pve");
  });
  it("sauvegarde illisible : état inchangé", () => {
    expect(restoreFromBackup(base, "pve", "n'importe quoi")).toBe(base);
    expect(restoreFromBackup(base, "pve", null)).toBe(base);
  });
  it("mode absent de l'état : créé depuis la sauvegarde", () => {
    expect(restoreFromBackup({ ...base, modes: {} }, "pvp-season", saved).modes["pvp-season"]?.selected).toEqual([{ taskId: "moi", color: 4 }]);
  });
});
