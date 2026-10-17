// Item finder : meilleurs spots d'un objet (regroupement des points d'apparition, score, porte proche).
import { describe, expect, it } from "vitest";
import { bestSpots, type DoorLock, type LooseSpawn } from "./itemSpots";

const p = (map: string, x: number, y: number, z: number, n: number): LooseSpawn => ({ map, x, y, z, items: Array.from({ length: n }, (_, i) => `i${i}`) });

describe("meilleurs spots", () => {
  const spawns = [
    // pièce fermée : 3 points qui ne proposent que 2 objets chacun -> 1,5
    p("streets", 100, 5, 100, 2),
    p("streets", 104, 5, 102, 2),
    p("streets", 101, 5, 106, 2),
    // juste au-dessus (autre étage) : groupe à part (1 seul objet possible -> 1)
    p("streets", 101, 12, 101, 1),
    // grand hangar : 4 points à 50 objets -> 0,08 (écarté : moins de 15 % du meilleur)
    p("streets", 300, 0, 300, 50),
    p("streets", 303, 0, 300, 50),
    p("streets", 306, 0, 300, 50),
    p("streets", 309, 0, 300, 50),
    // autre map
    p("customs", 100, 5, 100, 1),
  ];
  const locks: DoorLock[] = [
    { map: "streets", x: 108, y: 5, z: 103, key: "relaxation" },
    { map: "streets", x: 101, y: 12, z: 109, key: "upstairs" },
    { map: "customs", x: 160, y: 5, z: 100, key: "far" },
  ];
  const spots = bestSpots(spawns, locks);
  it("du meilleur au moins bon ; les groupes faibles écartés", () => {
    expect(spots.map((s) => [s[0], s[2], s[4], s[5]])).toEqual([
      ["streets", 5, 3, 150],
      ["streets", 12, 1, 100],
      ["customs", 5, 1, 100],
    ]);
  });
  it("porte la plus proche à la même hauteur seulement ; aucune au-delà de 10 m", () => {
    expect(spots[0][6]).toBe("relaxation");
    expect(spots[1][6]).toBe("upstairs");
    expect(spots[2][6]).toBe("");
  });
  it("le meilleur spot de chaque map reste, même loin derrière (au-dessus de 15 %)", () => {
    const s = bestSpots([...Array(6)].map((_, i) => p("lighthouse", i * 2, 0, 0, 1)).concat([p("streets", 0, 0, 0, 1), p("streets", 50, 0, 0, 1), p("woods", 0, 0, 0, 10)]), []);
    expect(s.map((x) => [x[0], x[5]])).toEqual([
      ["lighthouse", 600],
      ["streets", 100],
    ]);
  });
  it("rien : aucun spot", () => {
    expect(bestSpots([], locks)).toEqual([]);
  });
});
