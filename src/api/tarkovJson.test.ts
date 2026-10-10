// Lecture du format de json.tarkov.dev, avec des réponses simulées.
// Le format imité ici est celui produit par tarkov-data-manager
// (jobs/update-quests.mjs, update-maps.mjs, update-traders.mjs).
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, fetchTarkovData } from "./tarkovJson";

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
            { id: "o3", type: "giveItem", description: "o3 desc", optional: false },
            // position invalide : ignorée
            { id: "o4", type: "visit", description: "o4 desc", optional: false, zones: [{ id: "z4", map: "m1" }] },
          ],
        },
      },
      questItems: {},
    },
    translations: ["$.data.tasks.*.name"],
  },
  "regular/tasks_fr": { data: { "t1 name": "Quête un", "o1 desc": "Marquer" } },
  "regular/tasks_en": { data: { "t1 name": "Quest one", "o2 desc": "Find it" } },
  "regular/maps": { data: { maps: { m1: { id: "m1", name: "m1 name", normalizedName: "customs" } } } },
  "regular/maps_fr": { data: { "m1 name": "Douanes" } },
  "regular/maps_en": { data: {} },
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

    expect(data.maps).toEqual([{ id: "m1", name: "Douanes", normalizedName: "customs" }]);
    expect(data.traders[0].name).toBe("Prapor");

    const task = data.tasks[0];
    expect(task.name).toBe("Quête un");
    expect(task.nameEn).toBe("Quest one"); // gardé pour la recherche bilingue
    expect(task.traderId).toBe("tr1");
    expect(task.mapId).toBe("m1");
    expect(task.kappaRequired).toBe(true);

    const [o1, o2, o3, o4] = task.objectives;
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
  });

  it("échoue clairement si l'API ne répond pas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchTarkovData("pve", "fr")).rejects.toThrow(/HTTP 503/);
  });
});
