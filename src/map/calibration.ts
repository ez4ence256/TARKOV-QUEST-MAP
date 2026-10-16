// Calibrage des cartes : correspondance coordonnées du jeu -> fond de carte SVG.
//
// L'API ne fournit pas ces valeurs. Elles viennent du fichier src/data/maps.json
// du site tarkov.dev (dépôt the-hideout/tarkov-dev). On embarque une copie
// (src/data/tarkov-dev-maps.json) et on tente au démarrage de récupérer la
// version en ligne, pour suivre automatiquement les nouvelles maps.

import bundledMaps from "../data/tarkov-dev-maps.json";
import { tr } from "../lib/i18n";
import { withBasement, type LayerImage } from "./basement";

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

/** Étage d'une map (maps.json : layers[]). */
export interface MapLayer {
  name: string;
  /** Groupe <g id="…"> du SVG qui dessine cet étage. */
  svgLayer?: string;
  /** Tuiles d'image de cet étage (https://assets.tarkov.dev/…/{z}/{x}/{y}.png). */
  tilePath?: string;
  /** Tranches de hauteur (y du jeu) de l'étage, éventuellement limitées à des zones. */
  extents: { height: [number, number]; bounds?: RawBounds[] }[];
  /** Plan image posé sur l'étage (Interchange : parking), à la place d'un groupe SVG ou de tuiles. */
  image?: LayerImage;
}

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
  /** Tuiles d'image du niveau principal (maps sans SVG : Labs, Labyrinth, Icebreaker…). */
  tilePath?: string;
  tileSize: number;
  /** Hauteurs couvertes par le niveau principal. */
  heightRange?: [number, number];
  /** Nom du niveau principal quand maps.json le nomme (ex. Icebreaker). */
  mainLevelName?: string;
  layers: MapLayer[];
  /** Auteur du fond de carte, pour les crédits. */
  author?: string;
  authorLink?: string;
  minZoom: number;
  maxZoom: number;
}

type CalibrationTable = Record<string, MapCalibration>;

const isNumberArray = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every((n) => typeof n === "number");
const isBounds = (v: unknown): v is RawBounds =>
  Array.isArray(v) && v.length === 2 && v.every((p) => isNumberArray(p, 2));

function parseLayers(raw: unknown): MapLayer[] {
  if (!Array.isArray(raw)) return [];
  const layers: MapLayer[] = [];
  for (const l of raw as Record<string, unknown>[]) {
    if (typeof l?.name !== "string" || !Array.isArray(l.extents)) continue;
    const extents: MapLayer["extents"] = [];
    for (const e of l.extents as Record<string, unknown>[]) {
      if (!isNumberArray(e?.height, 2)) continue;
      // bounds : [[x1, z1], [x2, z2], "nom de la zone"]
      const bounds = Array.isArray(e.bounds)
        ? (e.bounds as unknown[]).map((b) => (Array.isArray(b) ? b.slice(0, 2) : null)).filter(isBounds)
        : undefined;
      extents.push({ height: e.height as [number, number], bounds: bounds?.length ? bounds : undefined });
    }
    if (extents.length === 0) continue;
    layers.push({
      name: l.name,
      svgLayer: typeof l.svgLayer === "string" ? l.svgLayer : undefined,
      tilePath: typeof l.tilePath === "string" ? l.tilePath : undefined,
      extents,
    });
  }
  return layers;
}

function svgUrlFor(svgPath: unknown): string | undefined {
  if (typeof svgPath !== "string") return undefined;
  const file = svgPath.split("/").pop() ?? "";
  if (LOCAL_SVGS.has(file)) return `${import.meta.env.BASE_URL}maps/svg/${file}`;
  // Nouvelle carte pas encore copiée localement : on la lit sur GitHub.
  return SVG_REMOTE_BASE + file;
}

/** Bornes de l'Usine, recopiées telles quelles par maps.json sur Icebreaker (valeur de remplissage, pas une mesure). */
const FACTORY_BOUNDS: RawBounds = [[77, -64.5], [-65.5, 67.4]];

/**
 * Correction d'Icebreaker. maps.json lui donne les bornes de l'Usine et transform [2, 125, 3.5, 91] :
 * avec ces valeurs 60 % du bateau tombe hors de la grille de tuiles (la sortie « Heli » à z = -66 aussi).
 * Les spawns, objets et serrures de tarkov.dev se calent sur les ponts des tuiles avec 1,5 pixel par mètre
 * (zoom 0, tuile de 256 px) centré sur (128, 128), rotation 180° inchangée : 134 points sur 145 tombent sur
 * le plancher de leur pont (0,17 m d'écart moyen), contre 3,2 m avec les valeurs de maps.json.
 * shortcut: échelle à 1,5 ± 0,1 (± 5 m en bout de bateau : les icônes de l'affiche re3mr donneraient 1,38, les points
 * de tarkov.dev 1,40 à 1,54) ; la correction s'efface d'elle-même quand
 * maps.json a d'autres bornes que celles de l'Usine.
 */
export function withKnownFixes(c: MapCalibration): MapCalibration {
  if (c.key !== "icebreaker" || JSON.stringify(c.bounds) !== JSON.stringify(FACTORY_BOUNDS)) return c;
  return { ...c, transform: [1.5, 128, 1.5, 128], bounds: [[42.7, -85.3], [-42.7, 85.3]] };
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
      tilePath: typeof m.tilePath === "string" ? m.tilePath : undefined,
      tileSize: typeof m.tileSize === "number" ? m.tileSize : 256,
      // "_heightRange" (Interchange) est volontairement désactivé dans maps.json : on l'ignore aussi
      heightRange: isNumberArray(m.heightRange, 2) ? (m.heightRange as [number, number]) : undefined,
      layers: parseLayers(m.layers),
      author: typeof m.author === "string" ? m.author : undefined,
      authorLink: typeof m.authorLink === "string" ? m.authorLink : undefined,
      minZoom: typeof m.minZoom === "number" ? m.minZoom : 1,
      maxZoom: typeof m.maxZoom === "number" ? m.maxZoom : 6,
    };
    // Icebreaker : le niveau principal est aussi listé comme étage ; on ne le garde qu'une fois.
    const dup = calibration.layers.find((l) => !l.svgLayer && l.tilePath && l.tilePath === calibration.tilePath);
    if (dup) {
      calibration.mainLevelName = dup.name;
      calibration.layers = calibration.layers.filter((l) => l !== dup);
    }
    const withLevels = withKnownFixes(withBasement(calibration));
    table[group.normalizedName] = withLevels;
    for (const alt of Array.isArray(m.altMaps) ? m.altMaps : []) {
      if (typeof alt === "string") table[alt] = withLevels;
    }
  }
  return table;
}

/** Le cache local peut dater d'avant le calque Sous-sol : on le (re)met. */
const withBasements = (table: CalibrationTable): CalibrationTable =>
  Object.fromEntries(Object.entries(table).map(([k, c]) => [k, withKnownFixes(withBasement(c))]));

export const BUNDLED_CALIBRATION = parseCalibration(bundledMaps);

const CACHE_KEY = "tqp:calibration:v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Calibrage le plus récent possible : cache local (24 h) -> GitHub -> copie embarquée.
 * Les entrées en ligne complètent/remplacent celles embarquées, jamais l'inverse.
 */
export async function loadCalibration(): Promise<CalibrationTable> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return withBasements({ ...BUNDLED_CALIBRATION, ...cached.table });
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
    return withBasements({ ...BUNDLED_CALIBRATION, ...table });
  } catch (error) {
    console.warn(tr("Calibrage en ligne indisponible, copie embarquée utilisée", "Online calibration unavailable, using bundled copy"), error);
    return BUNDLED_CALIBRATION;
  }
}
