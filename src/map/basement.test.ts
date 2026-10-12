import { describe, expect, it } from "vitest";
import { withBasement, BASEMENT_FOOTPRINT, BASEMENT_LAYER_NAME, CONTROL_POINTS, parkingToGame, svgMatrixFor, PARKING_IMAGE } from "./basement";
import { BUNDLED_CALIBRATION } from "./calibration";
import { levelName, levelOf, selectableLevels, isShownOnLevel } from "./levels";

const interchange = BUNDLED_CALIBRATION["interchange"];
const basement = interchange.layers.findIndex((l) => l.name === BASEMENT_LAYER_NAME);

describe("plan du parking d'Interchange", () => {
  it("le plan Minibus -> jeu respecte les résidus annoncés (RMS 4,3 m, max 7,7 m sur 17 points)", () => {
    const [a, b, c, d, e, f] = PARKING_IMAGE.minibusToGame;
    const res = CONTROL_POINTS.map(([, x, z, px, py]) => Math.hypot(a * px + b * py + c - x, d * px + e * py + f - z));
    const rms = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
    expect(CONTROL_POINTS.length).toBeGreaterThanOrEqual(4);
    expect(rms).toBeLessThan(4.4);
    expect(Math.max(...res)).toBeLessThan(7.7);
  });

  it("l'image tombe sur l'emprise du bâtiment", () => {
    const [a, b, c, d, e, f] = parkingToGame();
    const { width, height } = PARKING_IMAGE;
    const xs = [c, a * width + c, b * height + c];
    const zs = [f, d * width + f, e * height + f];
    const all = BASEMENT_FOOTPRINT.flat();
    expect(Math.max(...xs)).toBeLessThan(Math.max(...all.map((p) => p[0])) + 30);
    expect(Math.min(...xs)).toBeGreaterThan(Math.min(...all.map((p) => p[0])) - 10);
    expect(Math.max(...zs)).toBeLessThan(Math.max(...all.map((p) => p[1])) + 30);
    expect(Math.min(...zs)).toBeGreaterThan(Math.min(...all.map((p) => p[1])) - 30);
    // matrice SVG : rotation de 180° (x et z s'inversent côté u)
    expect(svgMatrixFor({ x: 598, z: -442 })[0]).toBeGreaterThan(0);
  });

  it("ajoute « Sous-sol » en dernier au sélecteur d'Interchange, et seulement là", () => {
    expect(basement).toBeGreaterThan(-1);
    const levels = selectableLevels(interchange);
    expect(levels).toHaveLength(3);
    expect(levels[2]).toBe(basement);
    expect(levelName(interchange, basement)).toBe("Sous-sol (parking)");
    expect(BUNDLED_CALIBRATION["customs"].layers.some((l) => l.name === BASEMENT_LAYER_NAME)).toBe(false);
  });

  it("remplace un calque Sous-sol resté dans le cache au lieu de le dupliquer", () => {
    const stale = { ...interchange, layers: interchange.layers.map((l) => (l.name === BASEMENT_LAYER_NAME ? { ...l, image: { url: "old.webp", width: 1, height: 1 } } : l)) };
    const fresh = withBasement(stale);
    expect(fresh.layers.filter((l) => l.name === BASEMENT_LAYER_NAME)).toHaveLength(1);
    expect(fresh.layers.find((l) => l.name === BASEMENT_LAYER_NAME)?.image?.url).toMatch(/interchange-parking\.webp$/);
  });

  it("classe les points : sous le sol du mall et dans l'emprise = Sous-sol", () => {
    expect(levelOf({ x: 17.56, z: -25.5, y: 22.83 }, interchange)).toBe(basement); // Minibus 2
    expect(levelOf({ x: -49.77, z: 59.04, y: 22.85 }, interchange)).toBe(basement); // Minibus 3
    expect(levelOf({ x: 109.87, z: 288.77, y: 22.33 }, interchange)).toBeNull(); // Minibus 1, dehors
    expect(levelOf({ x: 110, z: 0, y: 22 }, interchange)).toBeNull(); // bande de parking extérieur à l'ouest du mall
    expect(levelOf({ x: -183, z: -52, y: 15 }, interchange)).toBe(basement); // rampe est / garage Goshan
    expect(levelOf({ x: -183, z: 150, y: 22 }, interchange)).toBeNull(); // route à l'est, hors du plan
    expect(levelOf({ x: -219.92, z: -37.02, y: 13.8 }, interchange)).toBe(basement); // « Hole Exfill » : sous terre, hors du plan dessiné
    expect(levelOf({ x: 0, z: 0, y: 28.5 }, interchange)).not.toBe(basement); // rez-de-chaussée du mall
    expect(isShownOnLevel({ x: 17.56, z: -25.5, y: 22.83 }, interchange, basement)).toBe(true);
    expect(isShownOnLevel({ x: 17.56, z: -25.5, y: 22.83 }, interchange, null)).toBe(false);
  });
});
