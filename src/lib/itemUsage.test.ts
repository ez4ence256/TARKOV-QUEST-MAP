// Item finder : index d'usage des objets, sur des extraits de données réelles de tarkov.dev (PvE).
import { describe, expect, it } from "vitest";
import type { Objective, Task } from "../types";
import { buildBarterIndex, buildCraftIndex, buildHideoutIndex, buildUsageIndex, durationLabel, useLabel } from "./itemUsage";

const CHAIN = "5734758f24597738025ee253"; // Golden neck chain
const KEY = "5780cf7f2459777de4559322"; // Dorm room 314 marked key
const BOLTS = "57347c5b245977448d35f6e1";

const obj = (o: Partial<Objective> & { type: string }): Objective => ({ id: "o", description: "", optional: false, mapIds: [], locations: [], ...o });
const task = (id: string, objectives: Objective[], details?: Task["details"]): Task => ({
  id, name: id, nameEn: id, normalizedName: id, traderId: "t", mapId: null, minPlayerLevel: null, kappaRequired: false, wikiLink: null, objectives, details,
});
const details = (p: Partial<NonNullable<Task["details"]>>): NonNullable<Task["details"]> => ({
  taskRequirements: [], traderRequirements: [], neededKeys: [], rewards: null, failConditions: [], restartable: false, lightkeeperRequired: false, ...p,
});

describe("buildUsageIndex", () => {
  const index = buildUsageIndex([
    // Chumming : deux objectifs identiques (une par zone) -> une seule ligne
    task("chumming", [obj({ type: "plantItem", count: 3, itemIds: [CHAIN], foundInRaid: false }), obj({ type: "plantItem", count: 3, itemIds: [CHAIN], foundInRaid: false })]),
    task("fir", [obj({ type: "findItem", count: 10, itemIds: [CHAIN], foundInRaid: true }), obj({ type: "giveItem", count: 10, itemIds: [CHAIN], foundInRaid: true })]),
    task("keyed", [obj({ type: "visit", requiredKeyIds: [[KEY]] })], details({ neededKeys: [{ mapId: "m", keyIds: [KEY] }], rewards: { experience: 0, items: [{ itemId: CHAIN, count: 2 }], standing: [], offerUnlocks: [{ itemId: BOLTS, traderId: "t", level: 1 }], skills: [] } })),
    task("flare", [obj({ type: "useItem", count: 1, useItemIds: [CHAIN], optional: true })]),
  ]);

  it("une exigence répétée ne compte qu'une fois", () => {
    const q = index.get(CHAIN)!.find((u) => u.taskId === "chumming")!;
    expect(q.uses).toEqual([{ role: "plant", count: 3, fir: undefined, optional: undefined }]);
    expect(useLabel(q.uses[0])).toBe("À poser ×3");
  });

  it("trouver + rendre en raid, avec le statut FIR", () => {
    const labels = index.get(CHAIN)!.find((u) => u.taskId === "fir")!.uses.map(useLabel);
    expect(labels).toEqual(["À trouver ×10 (FIR)", "À rendre ×10 (FIR)"]);
  });

  it("clé requise (objectif et fiche de quête fusionnés), récompense, offre, utilisation optionnelle", () => {
    expect(index.get(KEY)).toEqual([{ taskId: "keyed", uses: [{ role: "key", optional: undefined }] }]);
    expect(index.get(CHAIN)!.find((u) => u.taskId === "keyed")!.uses.map(useLabel)).toEqual(["Récompense ×2"]);
    expect(index.get(BOLTS)![0].uses.map(useLabel)).toEqual(["Débloque une offre de marchand"]);
    expect(index.get(CHAIN)!.find((u) => u.taskId === "flare")!.uses.map(useLabel)).toEqual(["À utiliser (optionnel)"]);
  });

  it("objet inconnu : rien", () => expect(index.get("0".repeat(24))).toBeUndefined());
});

describe("buildHideoutIndex", () => {
  // extrait réel : Bolts dans le Générateur (niv. 4) et la Cuisine... (id de station + niveaux)
  const raw = {
    s1: { id: "s1", levels: [{ level: 4, itemRequirements: [{ item: BOLTS, count: 10, attributes: { foundInRaid: false } }] }] },
    s2: { id: "s2", levels: [{ level: 1, itemRequirements: [{ item: BOLTS, count: 2, attributes: { foundInRaid: true } }, { item: CHAIN, count: 1 }] }, { level: 2, itemRequirements: [] }] },
  };
  it("objet -> niveaux de stations", () => {
    const idx = buildHideoutIndex(raw);
    expect(idx.get(BOLTS)).toEqual([
      { stationId: "s1", level: 4, count: 10, fir: false },
      { stationId: "s2", level: 1, count: 2, fir: true },
    ]);
    expect(idx.get(CHAIN)).toEqual([{ stationId: "s2", level: 1, count: 1, fir: false }]);
  });
  it("données absentes ou invalides : index vide", () => {
    expect(buildHideoutIndex(null).size).toBe(0);
    expect(buildHideoutIndex({ a: { id: "a", levels: "x" } }).size).toBe(0);
  });
});

// extraits réels (PvE) : barter Prapor niv. 2 (2 x objet -> 1 objet) et craft de la station 5d484fcd... niv. 2
const SRC = "5d1b309586f77425227d1676";
const OUT = "5d1b304286f774253763a528";
describe("barters et crafts", () => {
  const barters = buildBarterIndex([
    { id: "b", trader: "5a7c2eca46aef81a7ca2145d", minTraderLevel: 2, requiredItems: [{ item: SRC, count: 2, attributes: {} }], offeredItem: { item: OUT, count: 1, attributes: {} } },
  ]);
  it("barter : demandé (in) et obtenu (out)", () => {
    expect(barters.get(SRC)).toEqual([{ side: "in", sourceId: "5a7c2eca46aef81a7ca2145d", level: 2, count: 2, fir: false, others: [{ id: OUT, count: 1 }] }]);
    expect(barters.get(OUT)).toEqual([{ side: "out", sourceId: "5a7c2eca46aef81a7ca2145d", level: 2, count: 1, fir: false, others: [{ id: SRC, count: 2 }] }]);
  });
  const crafts = buildCraftIndex([
    { id: "c", station: "5d484fcd654e7668ec2ec322", level: 2, duration: 4350, requiredItems: [{ item: SRC, count: 1, attributes: { foundInRaid: true } }, { item: CHAIN, count: 3 }], productItem: { item: OUT, count: 2 } },
    { id: "bad", requiredItems: [], productItem: { item: OUT } }, // sans station : ignoré
  ]);
  it("craft : ingrédient (in, FIR, durée) et produit (out)", () => {
    expect(crafts.get(SRC)).toEqual([{ side: "in", sourceId: "5d484fcd654e7668ec2ec322", level: 2, duration: 4350, count: 1, fir: true, others: [{ id: OUT, count: 2 }] }]);
    expect(crafts.get(OUT)).toHaveLength(1);
    expect(crafts.get(OUT)![0]).toMatchObject({ side: "out", count: 2, others: [{ id: SRC, count: 1 }, { id: CHAIN, count: 3 }] });
  });
  it("données invalides : index vide ; durée lisible", () => {
    expect(buildBarterIndex(undefined).size).toBe(0);
    expect(durationLabel(4350)).toBe("1 h 13 min");
    expect(durationLabel(1800)).toBe("30 min");
    expect(durationLabel(7200)).toBe("2 h");
  });
});
