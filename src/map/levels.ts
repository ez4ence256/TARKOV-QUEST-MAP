// Étages des cartes : quel point appartient à quel niveau.
//
// Portage de markerIsOnLayer / markerIsOnActiveLayer du site tarkov.dev
// (src/pages/map/index.jsx) : chaque étage a des "extents", c.-à-d. des
// tranches de hauteur (y du jeu), éventuellement limitées à certaines zones
// de la carte (bâtiments). Un point hors de l'étage affiché est grisé, pas caché.

import type { MapCalibration, MapLayer } from "./calibration";
import { isInBounds } from "./crs";

/** Hauteur d'un point : y, ou haut/bas de la zone quand l'API les donne. */
export interface PointHeight {
  x: number;
  z: number;
  y?: number;
  top?: number;
  bottom?: number;
}

/** Niveau affiché : null = niveau principal, sinon index dans calibration.layers. */
export type Level = number | null;

type OnLayer = false | "partial" | "full";

const hasHeight = (p: PointHeight) => p.y !== undefined || p.top !== undefined;

export function pointIsOnLayer(p: PointHeight, layer: Pick<MapLayer, "extents">): OnLayer {
  const top = p.top ?? p.y ?? 0;
  const bottom = p.bottom ?? p.y ?? 0;
  for (const extent of layer.extents) {
    if (!(top >= extent.height[0] && bottom < extent.height[1])) continue;
    const contained: OnLayer = bottom >= extent.height[0] && top <= extent.height[1] ? "full" : "partial";
    if (!extent.bounds) return contained;
    if (extent.bounds.some((b) => isInBounds(b, p))) return contained;
  }
  return false;
}

/** Étage principal : toute la hauteur de la map, sauf si maps.json la limite (heightRange). */
const mainLayer = (c: MapCalibration) => ({ extents: [{ height: c.heightRange ?? [-10000, 10000] }] });

/** Le point est-il sur le niveau affiché ? (vrai si on ne connaît pas sa hauteur) */
export function isOnLevel(p: PointHeight, calibration: MapCalibration | undefined, level: Level): boolean {
  if (!calibration || calibration.layers.length === 0 || !hasHeight(p)) return true;
  // entièrement dans un bâtiment d'un autre étage : pas sur ce niveau
  for (const [i, layer] of calibration.layers.entries()) {
    if (i === level) continue;
    if (layer.extents.some((e) => e.bounds) && pointIsOnLayer(p, layer) === "full") return false;
  }
  if (level !== null) return Boolean(pointIsOnLayer(p, calibration.layers[level]));
  return Boolean(pointIsOnLayer(p, mainLayer(calibration)));
}

/** Niveau "naturel" d'un point : le premier où il apparaît, principal en priorité. */
export function levelOf(p: PointHeight, calibration: MapCalibration | undefined): Level {
  if (!calibration || isOnLevel(p, calibration, null)) return null;
  const i = calibration.layers.findIndex((_, idx) => isOnLevel(p, calibration, idx));
  return i === -1 ? null : i;
}

const LEVEL_NAMES: Record<string, string> = {
  "2nd Floor": "2e étage",
  "3rd Floor": "3e étage",
  "4th Floor": "4e étage",
  "5th Floor": "5e étage",
  Underground: "Sous-sol",
  Garage: "Garage",
  Tunnels: "Tunnels",
  Technical: "Niveau technique",
  "Second Level": "2e niveau",
};

export function levelName(calibration: MapCalibration | undefined, level: Level): string {
  if (level === null || !calibration) return calibration?.mainLevelName ?? "Niveau principal";
  const name = calibration.layers[level]?.name ?? "";
  return LEVEL_NAMES[name] ?? name;
}
