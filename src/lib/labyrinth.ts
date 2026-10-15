// Infos de la map du Labyrinthe : chambres, apparitions de clés, cadavres, salles verrouillées.
// Positions relevées sur la carte de re3mr.com (voir src/data/labyrinth-annotations.json et CREDITS.md).

import data from "../data/labyrinth-annotations.json";
import { getLang, tr } from "./i18n";

export interface Bilingual {
  fr: string;
  en: string;
}

export type MarkerType = "corpse-key" | "scientist" | "key-spawn" | "torch-spawn" | "figurine";

export interface LabyrinthMarker {
  type: MarkerType;
  color: "red" | "purple" | "black" | "white" | "green";
  n: number;
  chamber?: number;
  x: number;
  z: number;
  label: Bilingual;
  figurine?: string;
  /** Lu sur une image basse résolution (± 3 m). */
  approx?: boolean;
}

export interface LabyrinthChamber {
  n: number;
  name: Bilingual;
  x: number;
  z: number;
  steps: Bilingual;
}

export interface LabyrinthRoom {
  id: string;
  name: Bilingual;
  polygon: { x: number; z: number }[];
  lock: { x: number; z: number };
  keyItemId: string;
  key: Bilingual;
  how: Bilingual;
}

export interface LabyrinthAnnotations {
  credit: string;
  precisionM: number;
  chambers: LabyrinthChamber[];
  markers: LabyrinthMarker[];
  rooms: LabyrinthRoom[];
}

export const LABYRINTH = data as unknown as LabyrinthAnnotations;

/** Map concernée (normalizedName de tarkov.dev). */
export const LABYRINTH_MAP = "the-labyrinth";

/** Les infos ne concernent que la map du Labyrinthe : ailleurs, rien. */
export const labyrinthFor = (mapName: string | undefined): LabyrinthAnnotations | null => (mapName === LABYRINTH_MAP ? LABYRINTH : null);

export const text = (b: Bilingual) => (getLang() === "en" ? b.en : b.fr);

/** Texte de la bulle d'un marqueur : type, numéro et emplacement. */
export function markerTitle(m: LabyrinthMarker, total: number): string {
  const rank = `${m.n}/${total}`;
  switch (m.type) {
    case "corpse-key":
      return tr(`Clé de la salle des cadavres, emplacement ${rank}`, `Corpse room key, spawn ${rank}`);
    case "scientist":
      return tr(`Cadavre de scientifique ${rank}`, `Scientist corpse ${rank}`);
    case "key-spawn":
      return tr(`Clé de la chambre ${m.chamber}, emplacement ${rank}`, `Chamber ${m.chamber} key, spawn ${rank}`);
    case "torch-spawn":
      return tr(`Chalumeau de la chambre ${m.chamber}, emplacement ${rank}`, `Chamber ${m.chamber} gas torch, spawn ${rank}`);
    case "figurine":
      return tr(`Figurine ${m.figurine} (chambre ${m.chamber}), n° ${m.n}`, `${m.figurine} figurine (chamber ${m.chamber}), no. ${m.n}`);
  }
}

/** Nombre de marqueurs de même type (et de même chambre) : le « n sur total » de la bulle. */
export const groupSize = (m: LabyrinthMarker, all: LabyrinthMarker[] = LABYRINTH.markers) =>
  all.filter((o) => o.type === m.type && o.chamber === m.chamber).length;

/** Explication de ce que sont les cadavres (légende de la carte). */
export const SCIENTIST_NOTE = () =>
  tr("Peut porter des notes de recherche et la clé de la salle d'observation : regardez leurs mains et les alentours.", "Can hold research notes and the observation room key: check their hands and surroundings.");

export const ITEM_ICON = (id: string) => `https://assets.tarkov.dev/${id}-icon.webp`;
