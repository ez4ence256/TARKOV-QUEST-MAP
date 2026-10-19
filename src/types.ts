// Types partagés de l'application.
import { tr } from "./lib/i18n";

/** Modes de jeu proposés par l'API JSON de tarkov.dev (json.tarkov.dev/endpoints). */
export type GameMode = "regular" | "pve" | "pvp-season";

// getters : la langue est lue à l'affichage, pas à l'import
export const GAME_MODES: { id: GameMode; label: string; hint: string }[] = [
  {
    id: "regular",
    label: "PvP",
    get hint() {
      return tr("Mode classique en ligne", "Classic online mode");
    },
  },
  {
    id: "pve",
    label: "PvE",
    get hint() {
      return tr("Mode coopératif contre l'IA", "Co-op mode against AI");
    },
  },
  {
    id: "pvp-season",
    get label() {
      return tr("PvP Saison", "PvP Season");
    },
    get hint() {
      return tr("Saison PvP (progression séparée)", "PvP season (separate progression)");
    },
  },
];

/** Position dans les coordonnées du jeu (Unity : y = hauteur). */
export interface GamePosition {
  x: number;
  y: number;
  z: number;
}

/** Une position sur une map donnée, telle que fournie par l'API. */
export interface ApiLocation {
  mapId: string;
  position: GamePosition;
  /** Contour de la zone, si l'API en fournit un. */
  outline?: GamePosition[];
  /** Haut et bas de la zone (y du jeu), pour savoir à quel étage elle est. */
  top?: number;
  bottom?: number;
  /** Emplacement possible d'un objet de quête (possibleLocations) : l'objet est à l'un d'eux. */
  possible?: true;
}

export interface Objective {
  id: string;
  /** Valeur brute du champ "type" de l'API (mark, visit, findQuestItem…). */
  type: string;
  description: string;
  optional: boolean;
  /** Maps auxquelles l'API rattache l'objectif (même sans position précise). */
  mapIds: string[];
  /** Positions connues (zones + emplacements possibles d'objets de quête). */
  locations: ApiLocation[];
  /** Quantité demandée (objets, éliminations…), si l'API la donne. */
  count?: number;
  /** Objets acceptés (au choix) pour les objectifs d'objets. */
  itemIds?: string[];
  /** Statut « trouvé en raid » exigé, quand l'API le précise (giveItem, findItem, plantItem, sellItem). */
  foundInRaid?: boolean;
  /** Objet de quête concerné (findQuestItem, giveQuestItem, plantQuestItem). */
  questItemId?: string;
  /** Clés requises : chaque groupe est une liste d'alternatives (une seule suffit). */
  requiredKeyIds?: string[][];
  /** Objets à utiliser, au choix (useItem : fusées, injecteurs…). */
  useItemIds?: string[];
  /** Arme à monter et pièces exigées (buildWeapon). */
  buildItemIds?: string[];
  /** Marqueur à poser (objectifs "mark"). */
  markerItemId?: string;
}

/** Récompenses de fin de quête selon tarkov.dev (finishRewards + experience). */
export interface TaskRewards {
  experience: number;
  items: { itemId: string; count: number }[];
  standing: { traderId: string; value: number }[];
  offerUnlocks: { itemId: string; traderId: string; level: number }[];
  skills: { skill: string; level: number }[];
}

/** Informations complémentaires de tarkov.dev (prérequis, clés, récompenses…). */
export interface TaskDetails {
  /** Quêtes préalables et statut attendu (complete, active, failed). */
  taskRequirements: { taskId: string; status: string[] }[];
  /** Conditions de niveau ou de réputation auprès d'un marchand. */
  traderRequirements: { traderId: string; type: string; compare: string; value: number }[];
  /** Clés nécessaires, par map. */
  neededKeys: { mapId: string; keyIds: string[] }[];
  rewards: TaskRewards | null;
  /**
   * Conditions d'échec : texte de l'API (souvent vide), et pour le type "taskStatus"
   * la quête concernée et son statut (ex. échoue si une autre quête est terminée).
   */
  failConditions: { type: string; description: string; taskId?: string; status?: string[] }[];
  restartable: boolean;
  lightkeeperRequired: boolean;
}

export interface Task {
  id: string;
  name: string;
  /** Nom anglais (sert à la recherche bilingue ; identique à name quand la langue est l'anglais). */
  nameEn: string;
  normalizedName: string;
  traderId: string;
  /** Map principale de la quête, si l'API en indique une. */
  mapId: string | null;
  minPlayerLevel: number | null;
  kappaRequired: boolean;
  wikiLink: string | null;
  /** "wiki" : quête d'événement absente de tarkov.dev, lue sur le wiki (objectifs sans position sur la carte). */
  source?: "wiki";
  objectives: Objective[];
  /** Faction réservée à la quête (absent : les deux peuvent la faire). */
  faction?: "BEAR" | "USEC";
  /** Quêtes dont la fin fait échouer celle-ci (branches exclusives) ; sans elle-même. */
  failedBy?: string[];
  /** Absent dans les anciennes données en cache et dans les tests minimaux. */
  details?: TaskDetails;
}

/**
 * Sortie d'une map : extraction normale, coop (repérée par « (Co-op) » dans le nom anglais,
 * l'API n'ayant pas de champ dédié) ou transit vers une autre map.
 */
export interface MapExit {
  id: string;
  kind: "extract" | "coop" | "transit";
  /** Nom dans la langue de l'app (repli anglais). */
  name: string;
  nameEn: string;
  /** Factions qui peuvent l'utiliser ; vide si l'API ne le précise pas. */
  factions: ("pmc" | "scav")[];
  position: GamePosition;
  top?: number;
  bottom?: number;
  /** Transit : map de destination. */
  destinationMapId?: string;
}

export interface GameMap {
  id: string;
  name: string;
  /** Nom anglais, pour retrouver la page du wiki (absent dans les anciennes données en cache). */
  nameEn?: string;
  normalizedName: string;
  /** Sorties et transits (absent dans les anciennes données en cache). */
  exits?: MapExit[];
}

export interface Trader {
  id: string;
  name: string;
  normalizedName: string;
  imageLink: string | null;
}

/** Données normalisées dont l'application a besoin (et qui sont mises en cache). */
export interface TarkovData {
  gameMode: GameMode;
  language: string;
  fetchedAt: number;
  tasks: Task[];
  maps: GameMap[];
  traders: Trader[];
  /** Noms des objets cités par les quêtes (clés, objets à rendre, récompenses), par id. */
  itemNames?: Record<string, string>;
  /** Image (iconLink, 64 px) des mêmes objets, par id (absent dans les anciennes données en cache). */
  itemIcons?: Record<string, string>;
}

/** Point affichable sur la carte (calculé, jamais sauvegardé tel quel). */
export interface MapPoint {
  /** Clé stable, utilisée pour les notes : "<objectiveId>#<index>" ou "custom:<id>". */
  key: string;
  kind: "objective" | "manual" | "custom";
  mapId: string;
  /** Coordonnées du jeu (x et z pour la position 2D, y/top/bottom pour l'étage). */
  x: number;
  z: number;
  y?: number;
  top?: number;
  bottom?: number;
  taskId?: string;
  objectiveId?: string;
  outline?: GamePosition[];
  /** Emplacement possible d'un objet de quête : numéro (à partir de 1) et nombre total. */
  spawn?: { index: number; count: number };
}
