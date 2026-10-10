// Types partagés de l'application.

/** Modes de jeu proposés par l'API JSON de tarkov.dev (json.tarkov.dev/endpoints). */
export type GameMode = "regular" | "pve" | "pvp-season";

export const GAME_MODES: { id: GameMode; label: string; hint: string }[] = [
  { id: "regular", label: "PvP", hint: "Mode classique en ligne" },
  { id: "pve", label: "PvE", hint: "Mode coopératif contre l'IA" },
  { id: "pvp-season", label: "PvP Saison", hint: "Saison PvP (progression séparée)" },
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
  objectives: Objective[];
}

export interface GameMap {
  id: string;
  name: string;
  normalizedName: string;
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
}
