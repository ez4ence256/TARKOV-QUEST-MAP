// Lecture du format de json.tarkov.dev, avec des réponses simulées.
// Le format imité ici est celui produit par tarkov-data-manager
// (jobs/update-quests.mjs, update-maps.mjs, update-traders.mjs).
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, fetchTarkovData } from "./tarkovJson";

const FACTORY = "55f2d3fd4bdc2d5f408b4567";
const NIGHT_FACTORY = "59fc81d786f774390775787e";

const responses: Record<string, unknown> = {
  "regular/tasks": {
    data: {
      tasks: {
        t1: {
          id: "t1",
          name: "t1 name",
          normalizedName: "t1",
          trader: "tr1",
          map: "m1",
          minPlayerLevel: 5,
          kappaRequired: true,
          experience: 8500,
          restartable: true,
          taskRequirements: [{ task: "t0", status: ["complete"] }],
          traderRequirements: [{ trader: "tr1", requirementType: "level", compareMethod: ">=", value: 2 }],
          neededKeys: [{ map: "m1", keys: ["key1"] }],
          finishRewards: {
            traderStanding: [{ trader: "tr1", standing: 0.02 }],
            items: [{ item: "rub", count: 30000 }],
            offerUnlock: [{ item: "gun", trader: "tr1", level: 1 }],
            skillLevelReward: [{ skill: "Search", level: 1 }],
          },
          failConditions: [{ id: "f1", type: "taskStatus", description: "f1 desc", task: "t9", status: ["complete"] }],
          objectives: [
            {
              id: "o1",
              type: "mark",
              description: "o1 desc",
              optional: false,
              maps: ["m1"],
              zones: [
                {
                  id: "z1",
                  map: "m1",
                  position: { x: 10, y: 2, z: -20 },
                  outline: [
                    { x: 0, y: 0, z: 0 },
                    { x: 1, y: 0, z: 0 },
                    { x: 1, y: 0, z: 1 },
                  ],
                  top: 3,
                  bottom: 1,
                },
              ],
            },
            {
              id: "o2",
              type: "findQuestItem",
              description: "o2 desc",
              optional: true,
              maps: ["m1"],
              possibleLocations: [{ map: "m1", positions: [{ x: 1, y: 0, z: 2 }, { x: 3, y: 0, z: 4 }] }],
            },
            // objectif sans position (giveItem : l'API retire zones et maps)
            {
              id: "o3",
              type: "giveItem",
              description: "o3 desc",
              optional: false,
              count: 3,
              items: ["med1", { id: "med2" }],
              foundInRaid: true,
            },
            // position invalide : ignorée
            {
              id: "o4",
              type: "visit",
              description: "o4 desc",
              optional: false,
              zones: [{ id: "z4", map: "m1" }],
              requiredKeys: [["key1", "key2"]],
            },
            // Usine + Usine de nuit : mêmes points, à quelques centimètres près
            {
              id: "o5",
              type: "visit",
              description: "o5 desc",
              optional: false,
              maps: [FACTORY, NIGHT_FACTORY],
              zones: [
                { id: "z5", map: FACTORY, position: { x: 5, y: 0, z: 5 } },
                { id: "z5n", map: NIGHT_FACTORY, position: { x: 5.2, y: 0, z: 4.9 } },
                { id: "z6n", map: NIGHT_FACTORY, position: { x: 50, y: 0, z: 50 } },
              ],
            },
          ],
        },
      },
      questItems: { qi1: { id: "qi1", name: "qi1 Name" } },
    },
    translations: ["$.data.tasks.*.name"],
  },
  "regular/tasks_fr": { data: { "t1 name": "Quête un", "o1 desc": "Marquer", "qi1 Name": "Dossier secret" } },
  // noms d'objets : seuls ceux cités par les quêtes sont gardés
  "regular/items_fr": { data: { "key1 Name": "Clé 306", "med1 Name": "Salewa", "rub Name": "Roubles", "autre Name": "Inutile" } },
  "regular/tasks_en": { data: { "t1 name": "Quest one", "o2 desc": "Find it" } },
  // sorties réelles de Douanes (positions de l'API), réduites aux champs utiles
  "regular/maps": {
    data: {
      maps: {
        m1: {
          id: "m1",
          name: "m1 name",
          normalizedName: "customs",
          extracts: [
            { id: "e1", name: "Crossroads", faction: "pmc", position: { x: -336.33, y: 2.19, z: -86.39 }, top: 5.06, bottom: -0.68 },
            { id: "e2", name: "Crossroads", faction: "scav", position: { x: -336.18, y: 2.19, z: -86.27 }, top: 5.06, bottom: -0.68 },
            { id: "e3", name: "Boiler", faction: "shared", position: { x: 106.97, y: -4.71, z: -43.62 }, top: -3.36, bottom: -6.06 },
            { id: "e4", name: "NightGate", position: { x: 1, y: 0, z: 1 } },
            { id: "e5", name: "NoPos", faction: "pmc" },
          ],
          transits: [{ id: "12", description: "FAC_TRANSIT", map: "m2", position: { x: 20.94, y: -0.33, z: 139.61 }, top: 1.82, bottom: -2.48 }],
        },
        [NIGHT_FACTORY]: { id: NIGHT_FACTORY, name: "Night Factory", normalizedName: "night-factory" },
      },
    },
  },
  "regular/maps_fr": {
    data: { "m1 name": "Douanes", Crossroads: "Carrefour", Boiler: "Sous-sol de la chaufferie (Co-Op)", FAC_TRANSIT: "Transit vers le littoral" },
  },
  "regular/maps_en": {
    data: { Boiler: "Boiler Room Basement (Co-op)", FAC_TRANSIT: "Transit to Shoreline", NightGate: "Gate 3" },
  },
  "regular/traders": { data: { tr1: { id: "tr1", name: "tr1 name", normalizedName: "prapor" } } },
  // pas de traduction FR pour les marchands : repli anglais
  "regular/traders_en": { data: { "tr1 name": "Prapor" } },
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    const key = url.replace(API_BASE, "");
    if (!(key in responses)) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(responses[key]), { status: 200 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchTarkovData", () => {
  it("normalise quêtes, maps et marchands avec traductions FR puis EN", async () => {
    vi.stubGlobal("fetch", mockFetch());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = await fetchTarkovData("regular", "fr");

    expect(data.maps.map((m) => m.id)).toEqual(["m1"]); // variante (Usine de nuit) retirée
    const [customs] = data.maps;
    expect(customs).toMatchObject({ id: "m1", name: "Douanes", normalizedName: "customs" });
    expect(customs.exits).toEqual([
      // doublon PMC + Scav au même endroit : une seule sortie
      {
        id: "e1",
        kind: "extract",
        name: "Carrefour",
        nameEn: "Crossroads",
        factions: ["pmc", "scav"],
        position: { x: -336.33, y: 2.19, z: -86.39 },
        top: 5.06,
        bottom: -0.68,
      },
      // coop : repérée par le nom anglais ; faction « shared » = PMC et Scav
      {
        id: "e3",
        kind: "coop",
        name: "Sous-sol de la chaufferie (Co-Op)",
        nameEn: "Boiler Room Basement (Co-op)",
        factions: ["pmc", "scav"],
        position: { x: 106.97, y: -4.71, z: -43.62 },
        top: -3.36,
        bottom: -6.06,
      },
      // faction absente : non précisée (nom FR absent : repli anglais)
      { id: "e4", kind: "extract", name: "Gate 3", nameEn: "Gate 3", factions: [], position: { x: 1, y: 0, z: 1 } },
      {
        id: "transit:12",
        kind: "transit",
        name: "Transit vers le littoral",
        nameEn: "Transit to Shoreline",
        factions: [],
        position: { x: 20.94, y: -0.33, z: 139.61 },
        top: 1.82,
        bottom: -2.48,
        destinationMapId: "m2",
      },
    ]);
    expect(data.traders[0].name).toBe("Prapor");

    const task = data.tasks[0];
    expect(task.name).toBe("Quête un");
    expect(task.nameEn).toBe("Quest one"); // gardé pour la recherche bilingue
    expect(task.traderId).toBe("tr1");
    expect(task.mapId).toBe("m1");
    expect(task.kappaRequired).toBe(true);

    const [o1, o2, o3, o4, o5] = task.objectives;
    // points de la variante rattachés à la map de base, doublons retirés
    expect(o5.mapIds).toEqual([FACTORY]);
    expect(o5.locations.map((l) => [l.mapId, l.position.x])).toEqual([[FACTORY, 5], [FACTORY, 50]]);
    expect(o1.description).toBe("Marquer");
    expect(o1.locations).toHaveLength(1);
    expect(o1.locations[0]).toMatchObject({ mapId: "m1", position: { x: 10, y: 2, z: -20 } });
    expect(o1.locations[0].outline).toHaveLength(3);

    expect(o2.description).toBe("Find it"); // repli anglais
    expect(o2.optional).toBe(true);
    expect(o2.locations.map((l) => l.position.x)).toEqual([1, 3]);
    expect(o2.locations.every((l) => l.possible)).toBe(true); // emplacements possibles d'objet
    expect(o1.locations[0].possible).toBeUndefined(); // zone à marquer

    expect(o3.locations).toEqual([]);
    expect(o3.mapIds).toEqual([]);
    expect(o3.description).toBe("o3 desc"); // ni FR ni EN : la clé est affichée

    expect(o4.locations).toEqual([]); // zone sans position : jamais inventée
    expect(o4.requiredKeyIds).toEqual([["key1", "key2"]]);
    expect(o3).toMatchObject({ count: 3, itemIds: ["med1", "med2"], foundInRaid: true });
    expect(o1.foundInRaid).toBeUndefined(); // pas dit par l'API : pas de valeur

    expect(task.details).toMatchObject({
      taskRequirements: [{ taskId: "t0", status: ["complete"] }],
      traderRequirements: [{ traderId: "tr1", type: "level", compare: ">=", value: 2 }],
      neededKeys: [{ mapId: "m1", keyIds: ["key1"] }],
      restartable: true,
      lightkeeperRequired: false,
      rewards: {
        experience: 8500,
        items: [{ itemId: "rub", count: 30000 }],
        standing: [{ traderId: "tr1", value: 0.02 }],
        offerUnlocks: [{ itemId: "gun", traderId: "tr1", level: 1 }],
        skills: [{ skill: "Search", level: 1 }],
      },
      // texte absent : la clé de traduction n'est pas affichée
      failConditions: [{ type: "taskStatus", description: "", taskId: "t9", status: ["complete"] }],
    });
    expect(data.itemNames).toEqual({ qi1: "Dossier secret", key1: "Clé 306", med1: "Salewa", rub: "Roubles" });
  });

  it("échoue clairement si l'API ne répond pas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchTarkovData("pve", "fr")).rejects.toThrow(/HTTP 503/);
  });
});
