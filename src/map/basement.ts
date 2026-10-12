// Sous-sol (parking) d'Interchange : plan du wiki posé sur l'emprise du centre commercial.
//
// tarkov.dev n'a aucun calque souterrain pour Interchange. On utilise le panneau « PARKING »
// (sections A à D) de l'affiche « Interchange Interactive Map Base.webp » (re3mr.com avec le wiki
// Escape from Tarkov, CC BY-NC-SA 4.0), recadré, rendu transparent hors du plan et réduit
// (public/maps/interchange-parking.webp). Les garages est de l'affiche sont détachés : non repris.
// C'est un plan schématique : position juste à quelques mètres près (voir RESIDUALS).
//
// Recalage en deux étages (pixels -> coordonnées du jeu) :
//  1. plan Minibus du wiki (File:InterchangeMinibusLocations.jpg, 987x971) -> jeu : affine ajustée par
//     moindres carrés sur 17 points mesurés à la main, dont les coordonnées du jeu viennent du SVG
//     tarkov.dev (calage maps.json) : voir CONTROL_POINTS ;
//  2. panneau re3mr -> plan Minibus : affine trouvée en maximisant le recouvrement de la forme du
//     parking (sections A à D colorées) ; contrôle visuel superposé, pas de points mesurés.
// Résidus de l'étage 1 : RMS 4,30 m, max 7,65 m (coins du mall : 2,3 à 3,7 m).

import type { MapLayer, RawBounds } from "./calibration";
import { tr } from "../lib/i18n";

export const PARKING_IMAGE = {
  file: "maps/interchange-parking.webp",
  width: 430,
  height: 1350,
  /** Pixel de l'image réduite -> pixel du panneau recadré (facteur 2), puis plan Minibus (x*sx+tx, y*sy+ty). */
  panelToMinibus: { sx: 0.249375, sy: 0.28275, tx: 310, ty: 125, scale: 2 },
  /** Pixel du plan Minibus -> jeu : x = a*px + b*py + c ; z = d*px + e*py + f. */
  minibusToGame: [-0.768909, 0.000259, 357.1283, -0.003799, 0.713884, -411.3841] as Affine,
};

/** Crédit du plan, dans la langue affichée (calculé au rendu, pas à l'import). */
export const parkingAttribution = () =>
  tr("Plan du parking : ", "Parking plan: ") +
  '<a href="https://escapefromtarkov.fandom.com/wiki/File:Interchange_Interactive_Map_Base.webp" target="_blank" rel="noreferrer">wiki Escape from Tarkov, re3mr.com</a>' +
  tr(" (CC BY-NC-SA 4.0, recadré)", " (CC BY-NC-SA 4.0, cropped)");

export type Affine = [number, number, number, number, number, number];

/** Emprise mesurée du bâtiment (coins du mall, SVG tarkov.dev), en coordonnées du jeu. */
export const MALL_FOOTPRINT: RawBounds = [[94.2, -314.6], [-157.2, 204.2]];
/** Le niveau principal du mall est à ~28 m : en dessous de 25 m, dans l'emprise, on est au sous-sol. */
export const BASEMENT_TOP = 25;

export const BASEMENT_LAYER_NAME = "Parking basement";

/** Pixel de l'image du parking -> jeu. */
export function parkingToGame(): Affine {
  const { panelToMinibus: p, minibusToGame: m } = PARKING_IMAGE;
  const at = (u: number, v: number): [number, number] => {
    const mx = p.sx * u * p.scale + p.tx;
    const my = p.sy * v * p.scale + p.ty;
    return [m[0] * mx + m[1] * my + m[2], m[3] * mx + m[4] * my + m[5]];
  };
  const [x0, z0] = at(0, 0);
  const [x1, z1] = at(1, 0);
  const [x2, z2] = at(0, 1);
  return [x1 - x0, x2 - x0, x0, z1 - z0, z2 - z0, z0];
}

/** Matrice SVG (a b c d e f) de l'image dans un repère u = x1 - x, v = z - z1 (Interchange : rotation 180, bornes [[x1,z1],…]). */
export function svgMatrixFor(origin: { x: number; z: number }): [number, number, number, number, number, number] {
  const [a, b, c, d, e, f] = parkingToGame();
  return [-a, d, -b, e, origin.x - c, f - origin.z];
}

export interface LayerImage {
  url: string;
  width: number;
  height: number;
}

/** Ajoute le calque « Sous-sol » à Interchange (sans effet ailleurs, ni s'il y est déjà). */
export function withBasement<T extends { key: string; layers: MapLayer[] }>(calibration: T): T {
  if (calibration.key !== "interchange" || calibration.layers.some((l) => l.name === BASEMENT_LAYER_NAME)) return calibration;
  const layer: MapLayer = {
    name: BASEMENT_LAYER_NAME,
    extents: [{ height: [-1000, BASEMENT_TOP], bounds: [MALL_FOOTPRINT] }],
    image: {
      url: `${import.meta.env.BASE_URL}${PARKING_IMAGE.file}`,
      width: PARKING_IMAGE.width,
      height: PARKING_IMAGE.height,
    },
  };
  return { ...calibration, layers: [...calibration.layers, layer] };
}

/** Points de contrôle du plan Minibus : [nom, x jeu, z jeu, px, py]. Coordonnées du jeu : SVG tarkov.dev + bornes maps.json. */
export const CONTROL_POINTS: [string, number, number, number, number][] = [
  ["ring NW", 200.94, -332.16, 201.0, 122.5],
  ["ring NE", -204.08, -332.16, 729.0, 122.5],
  ["ring SW", 200.94, 222.59, 201.0, 886.8],
  ["ring SE", -204.08, 222.59, 729.0, 886.8],
  ["roundabout", 206.63, 214.36, 191.0, 880.0],
  ["padL TL", 165.77, 235.25, 250.7, 902.0],
  ["padL TR", 101.34, 235.25, 330.0, 903.0],
  ["padR TL", 73.05, 234.56, 369.0, 904.0],
  ["padR TR", -8.08, 234.56, 477.7, 905.0],
  ["lot6 BR", 126.75, 209.1, 302.5, 877.3],
  ["chamf end", 150.06, 209.1, 273.7, 877.3],
  ["pond TL", 188.46, -296.24, 219.2, 155.7],
  ["pond TR", 126.76, -296.24, 302.3, 155.7],
  ["mall NW", 92.41, -304.52, 347.0, 149.0],
  ["mall SW", 94.24, 194.09, 343.0, 855.0],
  ["mall SE", -157.18, 204.17, 670.0, 869.0],
  ["mall NE", -157.18, -314.6, 667.0, 136.0],
];
