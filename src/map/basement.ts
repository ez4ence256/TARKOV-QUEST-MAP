// Sous-sol (parking) d'Interchange : plan du wiki posé sur l'emprise du centre commercial.
//
// tarkov.dev n'a aucun calque souterrain pour Interchange. On utilise le panneau « PARKING » entier de
// l'affiche « Interchange Interactive Map Base.webp » (re3mr.com avec le wiki Escape from Tarkov,
// CC BY-NC-SA 4.0) : sections A à D **et** garages Idea, Goshan et Oli, dessinés à leur place dans la
// même image. Recadré (origine 5380,1400 de l'affiche), icônes et lettres surimposées effacées (patch
// voisin recopié), fond noir transparent, pleine résolution : public/maps/interchange-parking.webp, 1645x2700.
// Un SVG redessiné a été essayé puis abandonné (rendu jugé mauvais). La carte de Lorathor (v0.8.2, 2020)
// montre un parking plus plein (tout le mall) : en cas d'écart on suit l'affiche re3mr, plus récente.
// Contrôles de position hors recalage : la rampe de surface de (-191, -61 .. -48) tombe sur la flèche
// « montée » du bord est du garage Goshan (-183, -52) ; la sortie coop « basement » (-97, -73)
// tombe sur le couloir qui relie les deux parkings. Les rampes est (x -191 .. -159) vers les
// garages Idea (z -294, -230) et Oli (z 122, 183) et le tunnel vers la sortie « Hole Exfill »
// (-220, -37, y 14), à l'est du bord du plan, ne sont pas dessinées.
// C'est un plan schématique : position juste à quelques mètres près (voir plus bas).
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
  width: 1645,
  height: 2700,
  /** Pixel de l'image -> pixel du panneau recadré (facteur 1 : pleine résolution ; 2 quand elle était réduite de moitié), puis plan Minibus (x*sx+tx, y*sy+ty). */
  panelToMinibus: { sx: 0.249375, sy: 0.28275, tx: 310, ty: 125, scale: 1 },
  /** Pixel du plan Minibus -> jeu : x = a*px + b*py + c ; z = d*px + e*py + f. */
  minibusToGame: [-0.768909, 0.000259, 357.1283, -0.003799, 0.713884, -411.3841] as Affine,
};

/**
 * Plans de l'intérieur du mall : panneaux FIRST FLOOR et SECOND FLOOR de la même affiche, recalés
 * directement sur les groupes First_Floor / Second_Floor du SVG tarkov.dev (même échelle que le parking,
 * 0,194 m par pixel). Recalage : affine par moindres carrés sur des « patchs » du contour du mall
 * (écart de forme mesuré en cases de 1 m le long des murs) ; coordonnées du jeu = SVG + bornes maps.json.
 *  - rez-de-chaussée (calque « 2nd Floor » de maps.json) : 76 patchs, 6 écartés (> 2,5 x RMS) ;
 *    RMS 1,24 m, max 6,71 m (avec les 76 : RMS 2,81 m, max 9,67 m) ;
 *  - 2e étage (calque « 3rd Floor ») : 22 patchs, RMS 0,76 m, max 1,49 m.
 * `affine` : pixel de l'image -> jeu, x = a*u + b*v + c ; z = d*u + e*v + f.
 */
export const MALL_PLANS = {
  first: { file: "maps/interchange-mall-first.webp", width: 1540, height: 2654, affine: [-0.193915, 0.000037, 100.389877, 0.000083, 0.194768, -310.827794] as Affine },
  second: { file: "maps/interchange-mall-second.webp", width: 860, height: 1284, affine: [-0.193793, 0.000329, 104.601146, -0.000014, 0.19541, -180.274797] as Affine },
};
/** Calques de maps.json d'Interchange qui reçoivent un plan : rez-de-chaussée du mall (niveau principal) et 2e étage. */
const MALL_FLOOR_LAYERS: Record<string, keyof typeof MALL_PLANS> = { "2nd Floor": "first", "3rd Floor": "second" };

/** Crédit des plans, dans la langue affichée (calculé au rendu, pas à l'import). */
export const mallPlansAttribution = () =>
  tr("Plans du mall et du parking : ", "Mall and parking plans: ") +
  '<a href="https://escapefromtarkov.fandom.com/wiki/File:Interchange_Interactive_Map_Base.webp" target="_blank" rel="noreferrer">' +
  tr("wiki Escape from Tarkov, re3mr.com", "Escape from Tarkov wiki, re3mr.com") +
  "</a>" +
  tr(" (CC BY-NC-SA 4.0, recadrés, icônes retirées)", " (CC BY-NC-SA 4.0, cropped, icons removed)");

export type Affine = [number, number, number, number, number, number];

/** Emprise mesurée du bâtiment (coins du mall, SVG tarkov.dev), en coordonnées du jeu. */
export const MALL_FOOTPRINT: RawBounds = [[94.2, -314.6], [-157.2, 204.2]];
/** Emprise du sous-sol : le mall + les parties du plan qui en dépassent (garage Goshan à l'est, pointes nord et sud). */
export const BASEMENT_FOOTPRINT: RawBounds[] = [
  MALL_FOOTPRINT,
  [[-157.2, -185], [-200, 80]],
  [[-40, -335], [-110, -314.6]],
  [[-40, 204.2], [-95, 230]],
  [[-200, -60], [-230, -15]], // sortie « Hole Exfill » (-220, -37, y 12-15) : sous terre, hors du plan dessiné
];
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
export function svgMatrixFor(origin: { x: number; z: number }, affine: Affine = parkingToGame()): Affine {
  const [a, b, c, d, e, f] = affine;
  return [-a, d, -b, e, origin.x - c, f - origin.z];
}

export interface LayerImage {
  url: string;
  width: number;
  height: number;
  /** Pixel de l'image -> jeu. */
  affine: Affine;
}

/** Plan posé sur le rez-de-chaussée du mall (niveau principal d'Interchange), s'il y en a un. */
export const mainFloorLayer = (calibration: { layers: MapLayer[] } | undefined) =>
  calibration?.layers.find((l) => l.image && MALL_FLOOR_LAYERS[l.name] === "first");

/** Ajoute le calque « Sous-sol » à Interchange (sans effet ailleurs ; remplace une version en cache). */
export function withBasement<T extends { key: string; layers: MapLayer[] }>(calibration: T): T {
  if (calibration.key !== "interchange") return calibration;
  const layer: MapLayer = {
    name: BASEMENT_LAYER_NAME,
    extents: [{ height: [-1000, BASEMENT_TOP], bounds: BASEMENT_FOOTPRINT }],
    image: {
      url: `${import.meta.env.BASE_URL}${PARKING_IMAGE.file}`,
      width: PARKING_IMAGE.width,
      height: PARKING_IMAGE.height,
      affine: parkingToGame(),
    },
  };
  // plans du mall sur les calques « 2nd Floor » / « 3rd Floor » ; une version en cache est remplacée
  const layers = calibration.layers
    .filter((l) => l.name !== BASEMENT_LAYER_NAME)
    .map((l) => {
      const plan = MALL_FLOOR_LAYERS[l.name];
      if (!plan) return l;
      const p = MALL_PLANS[plan];
      return { ...l, image: { url: `${import.meta.env.BASE_URL}${p.file}`, width: p.width, height: p.height, affine: p.affine } };
    });
  return { ...calibration, layers: [...layers, layer] };
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
