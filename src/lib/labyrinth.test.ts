import { describe, expect, it } from "vitest";
import calibration from "../data/tarkov-dev-maps.json";
import { groupSize, labyrinthFor, LABYRINTH, LABYRINTH_MAP } from "./labyrinth";

const lab = calibration.find((m) => m.normalizedName === LABYRINTH_MAP)!.maps[0] as { bounds: number[][] };
const [[x1, z1], [x2, z2]] = lab.bounds;
const inside = (p: { x: number; z: number }) => p.x >= Math.min(x1, x2) && p.x <= Math.max(x1, x2) && p.z >= Math.min(z1, z2) && p.z <= Math.max(z1, z2);
const both = (b: { fr: string; en: string }) => b.fr.length > 2 && b.en.length > 2;

describe("labyrinth-annotations.json", () => {
  it("a 5 chambres numérotées, avec le puzzle en français et en anglais", () => {
    expect(LABYRINTH.chambers.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
    for (const c of LABYRINTH.chambers) expect(both(c.name) && both(c.steps)).toBe(true);
  });

  it("compte les marqueurs par type d'après la légende de la carte", () => {
    const count = (t: string) => LABYRINTH.markers.filter((m) => m.type === t).length;
    expect(count("corpse-key")).toBe(6);
    expect(count("scientist")).toBe(6);
    expect(count("key-spawn")).toBe(6 + 4 + 4 + 6); // clés 1 à 4
    expect(count("torch-spawn")).toBe(5 + 5); // chambres 3 et 5
    expect(LABYRINTH.markers.filter((m) => m.type === "corpse-key").map((m) => m.color)).toEqual(Array(6).fill("red"));
    expect(LABYRINTH.markers.filter((m) => m.type === "scientist").every((m) => m.color === "purple")).toBe(true);
  });

  it("tout est dans l'emprise de la map, avec des libellés bilingues", () => {
    for (const m of LABYRINTH.markers) {
      expect(inside(m)).toBe(true);
      expect(both(m.label)).toBe(true);
      expect(m.n).toBeGreaterThan(0);
    }
    for (const c of LABYRINTH.chambers) expect(inside(c)).toBe(true);
    for (const r of LABYRINTH.rooms) {
      expect(r.polygon).toHaveLength(4);
      expect(r.polygon.every(inside) && inside(r.lock)).toBe(true);
      expect(r.keyItemId).toMatch(/^[0-9a-f]{24}$/);
    }
    expect(LABYRINTH.rooms.map((r) => r.id)).toEqual(["corpse-room", "observation-room"]);
  });

  it("les numéros d'un groupe se suivent sans doublon", () => {
    expect(groupSize(LABYRINTH.markers.find((m) => m.type === "scientist")!)).toBe(6);
    const keys = LABYRINTH.markers.map((m) => `${m.type}/${m.chamber ?? 0}/${m.n}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("filtrage par map", () => {
  it("les infos ne sont données que pour la map du Labyrinthe", () => {
    expect(labyrinthFor("the-labyrinth")).toBe(LABYRINTH);
    expect(labyrinthFor("shoreline")).toBeNull();
    expect(labyrinthFor(undefined)).toBeNull();
  });
});
