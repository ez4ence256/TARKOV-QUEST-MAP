// Points de la Main story : positions relevées sur les cartes du wiki (src/data/story-positions.json).
// Un chapitre sélectionné montre seulement la case en cours (première condition non cochée, puis
// première étape non cochée), comme « un objectif à la fois » pour les quêtes.

import positionsJson from "../data/story-positions.json";
import { floorFromText } from "./floorText";
import type { WikiPhoto } from "../api/wiki";
import { getLang, tr } from "./i18n";
import { storyStepId } from "./story";

export interface StoryPosition {
  /** normalizedName de la map (celui de tarkov.dev). */
  map: string;
  positions: { x: number; z: number }[];
  /** Fichier du wiki d'où vient la position. */
  source: string;
  method: string;
  /** Étage connu d'après le plan du wiki (Labs, tunnels d'Usine…), sinon celui du texte de la case. */
  floor?: { fr: string; en: string };
  /** Précision estimée, en mètres. */
  errorM: number;
}

/** Clé = `<titre anglais du chapitre>::<clé de la case>` (voir storyStepId). Une liste quand la case a des lieux sur plusieurs maps. */
export type StoryPositionEntry = StoryPosition | StoryPosition[];
export const STORY_POSITIONS = positionsJson as Record<string, StoryPositionEntry>;

/** Chapitres qui ont au moins une position (les seuls dont la page est lue pour la carte). */
export const chaptersWithPositions = (positions: Record<string, StoryPositionEntry> = STORY_POSITIONS): string[] => [
  ...new Set(Object.keys(positions).map((k) => k.split("::")[0])),
];

export interface StoryItem {
  key: string;
  title: string;
  /** Texte de la case (titre + paragraphes), pour l'étage. */
  text: string;
  /** Photos du wiki de la case (légendes déjà dans la langue affichée) et page dont elles viennent. */
  photos?: WikiPhoto[];
  /** Sous-titres du texte de la case, dans l'ordre (photo.section = n -> sous-titre n - 1). */
  sections?: string[];
  pageUrl?: string;
  pageTitle?: string;
}

export interface StoryMapPoint {
  /** Clé stable du marqueur. */
  id: string;
  chapter: string;
  stepKey: string;
  stepTitle: string;
  /** normalizedName de la map. */
  map: string;
  x: number;
  z: number;
  /** Plusieurs positions possibles : numéro (à partir de 1) et total. */
  index: number;
  count: number;
  errorM: number;
  source: string;
  /** Étage écrit dans le texte, sinon null (niveau principal). */
  floor: string | null;
}

/** Case en cours d'un chapitre : la première non cochée, conditions d'abord (items dans l'ordre). */
export const currentStoryItem = (chapter: string, items: StoryItem[], done: Record<string, true>): StoryItem | undefined =>
  items.find((i) => !done[storyStepId(chapter, i.key)]);

/** Points de la case en cours (aucun si elle n'a pas de position : jamais de point inventé). */
export function currentStoryPoints(
  chapter: string,
  items: StoryItem[],
  done: Record<string, true>,
  positions: Record<string, StoryPositionEntry> = STORY_POSITIONS,
): StoryMapPoint[] {
  const item = currentStoryItem(chapter, items, done);
  const found = item && positions[storyStepId(chapter, item.key)];
  if (!item || !found) return [];
  const textFloor = floorFromText(item.text);
  return [found].flat().flatMap((entry, e) => entry.positions.map((p, i) => ({
    id: `story:${chapter}:${item.key}#${e}.${i}`,
    chapter,
    stepKey: item.key,
    stepTitle: item.title,
    map: entry.map,
    x: p.x,
    z: p.z,
    index: i + 1,
    count: entry.positions.length,
    errorM: entry.errorM,
    source: entry.source,
    floor: entry.floor ? (getLang() === "en" ? entry.floor.en : entry.floor.fr) : textFloor,
  })));
}

/** Points d'une map (la map affichée), les autres sont sur leur propre map. */
export const pointsOnMap = (points: StoryMapPoint[], mapName: string | undefined) => points.filter((p) => p.map === mapName);

/** Étage affiché dans la popup. */
export const floorLabel = (p: StoryMapPoint) => p.floor ?? tr("Niveau principal", "Main level");
