import { describe, expect, it } from "vitest";
import { arrowAngle, playerOpacity } from "./playerMarker";

describe("playerOpacity", () => {
  it("pleine puis linéaire jusqu'à 0 en 5 minutes", () => {
    expect(playerOpacity(0)).toBe(1);
    expect(playerOpacity(150_000)).toBe(0.5);
    expect(playerOpacity(300_000)).toBe(0);
    expect(playerOpacity(900_000)).toBe(0);
    expect(playerOpacity(-5)).toBe(1);
  });
});
describe("arrowAngle", () => {
  it("sans rotation de carte, l'angle est le cap", () => {
    expect(arrowAngle(0, 0)).toBe(0);
    expect(arrowAngle(90, 0)).toBe(90);
    expect(arrowAngle(-90, 0)).toBe(270);
  });
  it("suit la rotation de la projection", () => {
    // cap +z avec coordinateRotation 90 : (lng,lat)=(0,1) -> (lat,lng)=(0*1+1*0, 0-1) soit lng=-1 : vers la gauche
    expect(arrowAngle(0, 90)).toBe(270);
  });
});
