// Étages des cartes : quel point appartient à quel niveau.
//
// Portage de markerIsOnLayer / markerIsOnActiveLayer du site tarkov.dev
// (src/pages/map/index.jsx) : chaque étage a des "extents", c.-à-d. des
// tranches de hauteur (y du jeu), éventuellement limitées à certaines zones
// de la carte (bâtiments). Un point hors de l'étage affiché est grisé, pas caché.
//
// Étages "supérieurs" et "souterrains" :
//  - souterrain : une tranche sans limite basse (-1000 / -10000 dans maps.json),
//    ou toutes les tranches sous le bas du niveau principal ;
//  - supérieur : tous les autres. Leurs points s'affichent directement sur la
//    carte de base (avec le numéro d'étage) ; seuls les souterrains se choisissent
//    dans le sélecteur.
// Exception : Icebreaker (un bateau, où "souterrain" n'a pas de sens) garde tous
// ses ponts dans le sélecteur.

import type { MapCalibration, MapLayer } from "./calibration";
import { isInBounds } from "./crs";
import { tr } from "../lib/i18n";

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

/** Maps dont tous les étages restent dans le sélecteur (clé de maps.json). */
const SELECTOR_ONLY_MAPS = new Set(["icebreaker"]);
/** Limite basse "ouverte" utilisée par maps.json (-1000 ou -10000). */
const OPEN_BOTTOM = -1000;
/** Tolérance sur les hauteurs (Icebreaker : 18,93 contre 18,92). */
const EPSILON = 0.05;

/** L'étage est-il sous le niveau principal ? */
export function isUnderground(calibration: MapCalibration, layer: MapLayer): boolean {
  if (layer.extents.some((e) => e.height[0] <= OPEN_BOTTOM)) return true;
  const mainBottom = calibration.heightRange?.[0];
  if (mainBottom === undefined || mainBottom <= OPEN_BOTTOM) return false;
  return layer.extents.every((e) => e.height[1] <= mainBottom + EPSILON);
}

/** L'étage se choisit-il dans le sélecteur ? (sinon ses points sont sur la carte de base) */
export function isSelectable(calibration: MapCalibration, index: number): boolean {
  const layer = calibration.layers[index];
  if (!layer) return false;
  return SELECTOR_ONLY_MAPS.has(calibration.key) || isUnderground(calibration, layer);
}

/** Niveaux proposés dans le sélecteur : principal + étages sélectionnables. */
export function selectableLevels(calibration: MapCalibration | undefined): Level[] {
  if (!calibration) return [null];
  return [null, ...calibration.layers.map((_, i) => i).filter((i) => isSelectable(calibration, i))];
}

/** Niveau "naturel" d'un point : le premier où il apparaît, principal en priorité. */
export function levelOf(p: PointHeight, calibration: MapCalibration | undefined): Level {
  if (!calibration || isOnLevel(p, calibration, null)) return null;
  const i = calibration.layers.findIndex((_, idx) => isOnLevel(p, calibration, idx));
  return i === -1 ? null : i;
}

/** Niveau du sélecteur où le point s'affiche : les étages supérieurs comptent comme le principal. */
export function displayLevelOf(p: PointHeight, calibration: MapCalibration | undefined): Level {
  const level = levelOf(p, calibration);
  return level !== null && calibration && isSelectable(calibration, level) ? level : null;
}

/** Étage supérieur d'un point affiché sur la carte de base, sinon null. */
export function upperLevelOf(p: PointHeight, calibration: MapCalibration | undefined): number | null {
  const level = levelOf(p, calibration);
  return level !== null && calibration && !isSelectable(calibration, level) ? level : null;
}

/** Tranche de hauteur de l'étage qui contient le point (pour l'afficher). */
export function extentOf(p: PointHeight, layer: MapLayer): [number, number] | null {
  for (const extent of layer.extents) {
    if (pointIsOnLayer(p, { extents: [extent] })) return extent.height;
  }
  return null;
}

/** Numéro court d'un étage pour l'icône ("2", "3"…), ou "↑" si le nom n'en contient pas. */
export function levelBadge(calibration: MapCalibration, level: number): string {
  const name = calibration.layers[level]?.name ?? "";
  if (/^second\b/i.test(name)) return "2";
  return name.match(/\d+/)?.[0] ?? "↑";
}

// [français, anglais] : résolu à l'appel (pas à l'import) pour suivre la langue choisie
const LEVEL_NAMES: Record<string, [string, string]> = {
  "2nd Floor": ["2e étage", "2nd floor"],
  "3rd Floor": ["3e étage", "3rd floor"],
  "4th Floor": ["4e étage", "4th floor"],
  "5th Floor": ["5e étage", "5th floor"],
  Underground: ["Sous-sol", "Basement"],
  Garage: ["Garage", "Garage"],
  Tunnels: ["Tunnels", "Tunnels"],
  Technical: ["Niveau technique", "Technical level"],
  "Second Level": ["2e niveau", "2nd level"],
};

export function levelName(calibration: MapCalibration | undefined, level: Level): string {
  if (level === null || !calibration) return calibration?.mainLevelName ?? tr("Niveau principal", "Main level");
  const name = calibration.layers[level]?.name ?? "";
  const names = LEVEL_NAMES[name];
  return names ? tr(names[0], names[1]) : name;
}
