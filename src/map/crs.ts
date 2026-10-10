// Conversion coordonnées du jeu <-> carte Leaflet.
//
// Portage fidèle des fonctions getCRS / applyRotation / pos / getBounds du site
// tarkov.dev (src/pages/map/index.jsx, dépôt the-hideout/tarkov-dev) :
//  - un point du jeu (x, z) devient le LatLng [z, x] ;
//  - la projection le fait tourner de `coordinateRotation` degrés ;
//  - puis L.Transformation(scaleX, marginX, -scaleY, marginY) le place en pixels.
// Conséquence pratique : dans toute l'app, lat = z et lng = x du jeu.

import L from "leaflet";
import type { MapCalibration, RawBounds } from "./calibration";

export function applyRotation(latLng: L.LatLng, rotation: number): L.LatLng {
  if (!latLng.lng && !latLng.lat) return L.latLng(0, 0);
  if (!rotation) return latLng;
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { lng: x, lat: y } = latLng;
  return L.latLng(x * sin + y * cos, x * cos - y * sin);
}

/** Système de coordonnées Leaflet d'une carte calibrée (ou neutre si pas de calibrage). */
export function getCRS(calibration: MapCalibration | undefined): L.CRS {
  let scaleX = 1;
  let scaleY = 1;
  let marginX = 0;
  let marginY = 0;
  const rotation = calibration?.coordinateRotation ?? 0;
  if (calibration) {
    scaleX = calibration.transform[0];
    scaleY = calibration.transform[2] * -1;
    marginX = calibration.transform[1];
    marginY = calibration.transform[3];
  }
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, scaleY, marginY),
    projection: L.extend({}, L.Projection.LonLat, {
      project: (latLng: L.LatLng) => L.Projection.LonLat.project(applyRotation(latLng, rotation)),
      unproject: (point: L.Point) =>
        applyRotation(L.Projection.LonLat.unproject(point), rotation * -1),
    }),
  }) as L.CRS;
}

/** Coordonnées du jeu -> LatLng Leaflet. */
export const gameToLatLng = (p: { x: number; z: number }): L.LatLngTuple => [p.z, p.x];

/** LatLng Leaflet -> coordonnées du jeu (x, z). */
export const latLngToGame = (ll: L.LatLng) => ({ x: ll.lng, z: ll.lat });

/** Emprise maps.json [[x1, z1], [x2, z2]] -> LatLngBounds. */
export function toLatLngBounds(bounds: RawBounds): L.LatLngBounds {
  return L.latLngBounds([bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]);
}

/** Vrai si le point (x, z) est dans l'emprise de la carte. */
export function isInBounds(bounds: RawBounds, p: { x: number; z: number }): boolean {
  return toLatLngBounds(bounds).contains(gameToLatLng(p));
}
