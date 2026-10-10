import { describe, expect, it } from "vitest";
import { BUNDLED_CALIBRATION } from "./calibration";
import { isOnLevel, levelName, levelOf } from "./levels";

const customs = BUNDLED_CALIBRATION["customs"];
const shoreline = BUNDLED_CALIBRATION["shoreline"];
const icebreaker = BUNDLED_CALIBRATION["icebreaker"];
const layerIndex = (c: typeof customs, name: string) => c.layers.findIndex((l) => l.name === name);

describe("étages", () => {
  it("lit les étages de maps.json", () => {
    expect(customs.layers.map((l) => l.name)).toContain("2nd Floor");
    expect(customs.layers[layerIndex(customs, "2nd Floor")].svgLayer).toBe("Second_Floor");
    expect(BUNDLED_CALIBRATION["the-labyrinth"].tilePath).toMatch(/assets\.tarkov\.dev/);
  });

  it("Icebreaker : le niveau principal n'est pas listé deux fois", () => {
    expect(icebreaker.mainLevelName).toBe("Infirmary");
    expect(icebreaker.layers.some((l) => l.name === "Infirmary")).toBe(false);
    expect(levelName(icebreaker, levelOf({ x: 0, z: 0, y: 30 }, icebreaker))).toBe("Accommodation (mid)");
    expect(levelOf({ x: 0, z: 0, y: 19 }, icebreaker)).toBeNull();
  });

  it("Douanes : un point au 2e étage des dortoirs n'est pas au niveau principal", () => {
    const dorms2 = { x: 200, z: 150, y: 4 };
    const second = layerIndex(customs, "2nd Floor");
    expect(isOnLevel(dorms2, customs, null)).toBe(false);
    expect(isOnLevel(dorms2, customs, second)).toBe(true);
    expect(levelOf(dorms2, customs)).toBe(second);
    expect(levelName(customs, second)).toBe("2e étage");
  });

  it("Douanes : à la même hauteur hors bâtiment, le point reste au niveau principal", () => {
    expect(levelOf({ x: 0, z: 0, y: 4 }, customs)).toBeNull();
  });

  it("Rivage : étages par hauteur, sous-sol limité à certains bâtiments", () => {
    expect(levelName(shoreline, levelOf({ x: 0, z: 0, y: 0.5 }, shoreline))).toBe("2e étage");
    expect(levelOf({ x: 0, z: 0, y: -3 }, shoreline)).toBeNull();
    expect(levelName(shoreline, levelOf({ x: -180, z: -80, y: -10 }, shoreline))).toBe("Sous-sol");
    expect(levelOf({ x: 300, z: 300, y: -10 }, shoreline)).toBeNull();
  });

  it("une zone (haut/bas) compte pour l'étage qu'elle traverse", () => {
    const zone = { x: 0, z: 0, top: 3, bottom: 1 };
    expect(isOnLevel(zone, shoreline, layerIndex(shoreline, "2nd Floor"))).toBe(true);
  });

  it("un point sans hauteur est visible à tous les niveaux", () => {
    expect(isOnLevel({ x: 200, z: 150 }, customs, null)).toBe(true);
    expect(isOnLevel({ x: 200, z: 150 }, customs, 0)).toBe(true);
  });
});
