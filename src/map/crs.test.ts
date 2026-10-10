// Vérifie que la conversion de coordonnées est identique à celle du site tarkov.dev.
import { describe, expect, it } from "vitest";
import L from "leaflet";
import { BUNDLED_CALIBRATION } from "./calibration";
import { gameToLatLng, getCRS, toLatLngBounds } from "./crs";

// --- Copie de référence du code de tarkov.dev (src/pages/map/index.jsx, commit 97ff6e7) ---
function refApplyRotation(latLng: L.LatLng, rotation: number) {
  if (!latLng.lng && !latLng.lat) return L.latLng(0, 0);
  if (!rotation) return latLng;
  const angleInRadians = (rotation * Math.PI) / 180;
  const cosAngle = Math.cos(angleInRadians);
  const sinAngle = Math.sin(angleInRadians);
  const { lng: x, lat: y } = latLng;
  const rotatedX = x * cosAngle - y * sinAngle;
  const rotatedY = x * sinAngle + y * cosAngle;
  return L.latLng(rotatedY, rotatedX);
}
function refGetCRS(mapData: { transform: number[]; coordinateRotation: number }) {
  const scaleX = mapData.transform[0];
  const scaleY = mapData.transform[2] * -1;
  const marginX = mapData.transform[1];
  const marginY = mapData.transform[3];
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, scaleY, marginY),
    projection: L.extend({}, L.Projection.LonLat, {
      project: (latLng: L.LatLng) =>
        L.Projection.LonLat.project(refApplyRotation(latLng, mapData.coordinateRotation)),
      unproject: (point: L.Point) =>
        refApplyRotation(L.Projection.LonLat.unproject(point), mapData.coordinateRotation * -1),
    }),
  }) as L.CRS;
}
// --- fin de la copie de référence ---

describe("calibrage", () => {
  it("contient Customs et Woods avec les valeurs de tarkov.dev", () => {
    expect(BUNDLED_CALIBRATION["customs"].transform).toEqual([0.239, 168.65, 0.239, 136.35]);
    expect(BUNDLED_CALIBRATION["customs"].coordinateRotation).toBe(180);
    expect(BUNDLED_CALIBRATION["woods"].transform).toEqual([0.1855, 112.95, 0.1855, 167.85]);
    expect(BUNDLED_CALIBRATION["woods"].coordinateRotation).toBe(180);
    // Les variantes réutilisent le calibrage de leur groupe
    expect(BUNDLED_CALIBRATION["night-factory"]).toBe(BUNDLED_CALIBRATION["factory"]);
  });

  for (const [name, cal] of Object.entries(BUNDLED_CALIBRATION)) {
    it(`${name} : projection identique à tarkov.dev`, () => {
      const mine = getCRS(cal);
      const ref = refGetCRS(cal);
      const b = toLatLngBounds(cal.bounds);
      for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
          const ll = L.latLng(
            b.getSouth() + ((b.getNorth() - b.getSouth()) * i) / 10,
            b.getWest() + ((b.getEast() - b.getWest()) * j) / 10,
          );
          for (const zoom of [cal.minZoom, cal.maxZoom]) {
            const p1 = mine.latLngToPoint(ll, zoom);
            const p2 = ref.latLngToPoint(ll, zoom);
            expect(p1.x).toBeCloseTo(p2.x, 9);
            expect(p1.y).toBeCloseTo(p2.y, 9);
            // aller-retour pixel -> jeu
            const back = mine.pointToLatLng(p1, zoom);
            expect(back.lat).toBeCloseTo(ll.lat, 6);
            expect(back.lng).toBeCloseTo(ll.lng, 6);
          }
        }
      }
    });
  }

  it("Customs : un point du jeu est converti en [z, x]", () => {
    expect(gameToLatLng({ x: 100, z: -50 })).toEqual([-50, 100]);
  });
});
