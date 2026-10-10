// Catégories d'icônes, dérivées du champ "type" des objectifs de l'API.
// Valeurs de "type" relevées dans tarkov-api (resolvers/taskResolver.mjs) et
// tarkov-data-manager (jobs/update-quests.mjs).

import { tr } from "./i18n";

export type IconId =
  | "mark"
  | "visit"
  | "search"
  | "item"
  | "plant"
  | "other"
  // icônes supplémentaires réservées aux points personnels
  | "star"
  | "danger"
  | "key"
  | "loot"
  | "extract";

export const OBJECTIVE_CATEGORY: Record<string, IconId> = {
  mark: "mark",
  visit: "visit",
  findQuestItem: "search",
  findItem: "item",
  giveItem: "item",
  giveQuestItem: "item",
  haveItem: "item",
  sellItem: "item",
  plantItem: "plant",
  plantQuestItem: "plant",
};

export const categoryOf = (type: string): IconId => OBJECTIVE_CATEGORY[type] ?? "other";

// [français, anglais] ; ICON_LABELS lit la langue à chaque accès (pas à l'import)
const ICON_TEXTS: Record<IconId, [string, string]> = {
  mark: ["Marquer", "Mark"],
  visit: ["Visiter", "Visit"],
  search: ["Fouiller / chercher", "Search / find"],
  item: ["Trouver un objet", "Find an item"],
  plant: ["Placer un objet", "Plant an item"],
  other: ["Autre", "Other"],
  star: ["Favori", "Favorite"],
  danger: ["Danger", "Danger"],
  key: ["Clé / porte", "Key / door"],
  loot: ["Loot", "Loot"],
  extract: ["Extraction", "Extraction"],
};

export const ICON_LABELS = Object.defineProperties(
  {} as Record<IconId, string>,
  Object.fromEntries(
    (Object.keys(ICON_TEXTS) as IconId[]).map((id) => [
      id,
      { enumerable: true, get: () => tr(...ICON_TEXTS[id]) },
    ]),
  ),
);

/** Icônes proposées pour les points personnels. */
export const CUSTOM_ICONS: IconId[] = [
  "star",
  "danger",
  "key",
  "loot",
  "extract",
  "mark",
  "visit",
  "search",
  "item",
  "plant",
  "other",
];

/** Tracés SVG (viewBox 0 0 24 24, fill-rule evenodd). */
export const ICON_PATHS: Record<IconId, string> = {
  // drapeau
  mark: "M5 21V3h11l1 2h3v10h-7l-1-2H7v8z",
  // œil
  visit:
    "M12 5C6.5 5 2.5 9.5 1.5 12c1 2.5 5 7 10.5 7s9.5-4.5 10.5-7C21.5 9.5 17.5 5 12 5zm0 3a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z",
  // loupe
  search:
    "M10 3a7 7 0 015.6 11.2l5.6 5.6-1.4 1.4-5.6-5.6A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z",
  // caisse
  item: "M12 2l9 5v10l-9 5-9-5V7zm0 2.3L5.6 7.8 12 11.3l6.4-3.5zM5 9.5v6.3l6 3.3v-6.3zm14 0l-6 3.3v6.3l6-3.3z",
  // flèche vers le sol
  plant: "M11 2h2v10.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM3 19h18v3H3z",
  // cible
  other:
    "M12 2a10 10 0 110 20 10 10 0 010-20zm0 3a7 7 0 100 14 7 7 0 000-14zm0 3a4 4 0 110 8 4 4 0 010-8z",
  // étoile
  star: "M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8l-6.3 3.6 1.5-7.1-5.4-4.9L9 8.6z",
  // triangle d'avertissement
  danger: "M12 2L1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z",
  // clé
  key: "M7 8a4 4 0 013.9 3H22v3h-2v3h-3v-3h-6.1A4 4 0 117 8zm0 2a2 2 0 100 4 2 2 0 000-4z",
  // sac
  loot: "M9 3h6l-1.5 3H15a5 5 0 015 5v6a4 4 0 01-4 4H8a4 4 0 01-4-4v-6a5 5 0 015-5h1.5z",
  // porte de sortie
  extract: "M10 3h11v18H10v-2h9V5h-9zm1 4.5l1.4 1.4-2.1 2.1H17v2h-6.7l2.1 2.1-1.4 1.4L6.5 12z",
};

/** Palette (fond sombre) : une couleur par quête sélectionnée. */
export const QUEST_COLORS = [
  "#f2c94c",
  "#56ccf2",
  "#eb5757",
  "#6fcf97",
  "#bb6bd9",
  "#f2994a",
  "#2dd4bf",
  "#f472b6",
  "#a3e635",
  "#94a3b8",
];

export const CUSTOM_POINT_COLOR = "#ffffff";
