// Calibrage des cartes : correspondance coordonnées du jeu -> fond de carte SVG.
//
// L'API ne fournit pas ces valeurs. Elles viennent du fichier src/data/maps.json
// du site tarkov.dev (dépôt the-hideout/tarkov-dev). On embarque une copie
// (src/data/tarkov-dev-maps.json) et on tente au démarrage de récupérer la
// version en ligne, pour suivre automatiquement les nouvelles maps.

import bundledMaps from "../data/tarkov-dev-maps.json";

export const CALIBRATION_URL =
  "https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json";
const SVG_REMOTE_BASE = "https://raw.githubusercontent.com/the-hideout/tarkov-dev-svg-maps/main/";
/** SVG copiés dans public/maps/svg (voir scripts/sync-maps.mjs). */
const LOCAL_SVGS = new Set([
  "Customs.svg",
  "Factory.svg",
  "GroundZero.svg",
  "Interchange.svg",
  "Lighthouse.svg",
  "Reserve.svg",
  "Shoreline.svg",
  "StreetsOfTarkov.svg",
  "Terminal.svg",
  "Woods.svg",
]);

/** [[x1, z1], [x2, z2]] en coordonnées du jeu, comme dans maps.json. */
export type RawBounds = [[number, number], [number, number]];

export interface MapCalibration {
  /** Clé de la carte interactive dans maps.json (ex. "customs"). */
  key: string;
  /** [échelleX, margeX, échelleY, margeY] */
  transform: [number, number, number, number];
  /** Rotation en degrés appliquée aux coordonnées du jeu. */
  coordinateRotation: number;
  bounds: RawBounds;
  /** Emprise du SVG si elle diffère de bounds. */
  svgBounds?: RawBounds;
  /** URL du fond de carte SVG, s'il existe. */
  svgUrl?: string;
  /** Groupe <g id="…"> du SVG à afficher (niveau du sol). */
  svgLayer?: string;
  minZoom: number;
  maxZoom: number;
}

type CalibrationTable = Record<string, MapCalibration>;

const isNumberArray = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every((n) => typeof n === "number");
const isBounds = (v: unknown): v is RawBounds =>
  Array.isArray(v) && v.length === 2 && v.every((p) => isNumberArray(p, 2));

function svgUrlFor(svgPath: unknown): string | undefined {
  if (typeof svgPath !== "string") return undefined;
  const file = svgPath.split("/").pop() ?? "";
  if (LOCAL_SVGS.has(file)) return `${import.meta.env.BASE_URL}maps/svg/${file}`;
  // Nouvelle carte pas encore copiée localement : on la lit sur GitHub.
  return SVG_REMOTE_BASE + file;
}

/**
 * Transforme le contenu de maps.json en table normalizedName -> calibrage.
 * Seules les entrées "projection: interactive" possèdent un calibrage ; les
 * variantes (altMaps, ex. "night-factory") réutilisent celui de leur groupe,
 * comme le fait le site (src/features/maps/index.js).
 */
export function parseCalibration(groups: unknown): CalibrationTable {
  const table: CalibrationTable = {};
  if (!Array.isArray(groups)) return table;
  for (const group of groups as Record<string, unknown>[]) {
    const maps = Array.isArray(group?.maps) ? (group.maps as Record<string, unknown>[]) : [];
    const m = maps.find((x) => x.projection === "interactive");
    if (!m || typeof group.normalizedName !== "string") continue;
    if (!isNumberArray(m.transform, 4) || !isBounds(m.bounds)) continue;
    const calibration: MapCalibration = {
      key: String(m.key),
      transform: m.transform as MapCalibration["transform"],
      coordinateRotation: typeof m.coordinateRotation === "number" ? m.coordinateRotation : 0,
      bounds: m.bounds,
      svgBounds: isBounds(m.svgBounds) ? m.svgBounds : undefined,
      svgUrl: svgUrlFor(m.svgPath),
      svgLayer: typeof m.svgLayer === "string" ? m.svgLayer : undefined,
      minZoom: typeof m.minZoom === "number" ? m.minZoom : 1,
      maxZoom: typeof m.maxZoom === "number" ? m.maxZoom : 6,
    };
    table[group.normalizedName] = calibration;
    for (const alt of Array.isArray(m.altMaps) ? m.altMaps : []) {
      if (typeof alt === "string") table[alt] = calibration;
    }
  }
  return table;
}

export const BUNDLED_CALIBRATION = parseCalibration(bundledMaps);

const CACHE_KEY = "tqp:calibration:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Calibrage le plus récent possible : cache local (24 h) -> GitHub -> copie embarquée.
 * Les entrées en ligne complètent/remplacent celles embarquées, jamais l'inverse.
 */
export async function loadCalibration(): Promise<CalibrationTable> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { ...BUNDLED_CALIBRATION, ...cached.table };
    }
  } catch {
    /* cache illisible : on l'ignore */
  }
  try {
    const res = await fetch(CALIBRATION_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const table = parseCalibration(await res.json());
    if (Object.keys(table).length === 0) throw new Error("format inattendu");
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), table }));
    } catch {
      /* stockage plein : pas grave */
    }
    return { ...BUNDLED_CALIBRATION, ...table };
  } catch (error) {
    console.warn("Calibrage en ligne indisponible, copie embarquée utilisée", error);
    return BUNDLED_CALIBRATION;
  }
}
