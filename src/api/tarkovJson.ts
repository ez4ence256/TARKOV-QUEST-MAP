// Récupération des données depuis l'API JSON publique de tarkov.dev.
//
// Format (déduit du code source, voir CREDITS.md) :
//  - https://json.tarkov.dev/<mode>/<endpoint>        -> { data, translations }
//  - https://json.tarkov.dev/<mode>/<endpoint>_<lang> -> { data: { cléDeTraduction: texte } }
// Les champs textuels du fichier principal (noms, descriptions…) contiennent des
// clés de traduction : on les remplace par le texte de la langue demandée, puis
// par l'anglais, puis par la clé elle-même (même logique que le site tarkov.dev,
// src/modules/api-request.mjs).

import type {
  ApiLocation,
  GameMap,
  GameMode,
  GamePosition,
  Objective,
  TarkovData,
  Task,
  Trader,
} from "../types";

export const API_BASE = "https://json.tarkov.dev/";
const FALLBACK_LANG = "en";

type Dict = Record<string, unknown>;
type Translations = Record<string, string>;

async function fetchJson(path: string, signal?: AbortSignal): Promise<Dict> {
  const res = await fetch(API_BASE + path, {
    cache: "no-cache",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`${path} : HTTP ${res.status}`);
  return (await res.json()) as Dict;
}

/** Charge les traductions d'un endpoint ; renvoie {} si la langue n'existe pas. */
async function fetchTranslations(path: string, lang: string, signal?: AbortSignal) {
  try {
    const json = await fetchJson(`${path}_${lang}`, signal);
    return (json.data ?? {}) as Translations;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    console.warn(`Traductions ${lang} indisponibles pour ${path}`, error);
    return {};
  }
}

/**
 * Charge un endpoint et renvoie ses données + deux fonctions de traduction :
 * t (langue demandée, repli anglais) et tEn (anglais seul, pour la recherche bilingue).
 */
async function fetchEndpoint(path: string, lang: string, signal?: AbortSignal) {
  const [main, primary, fallback] = await Promise.all([
    fetchJson(path, signal),
    fetchTranslations(path, lang, signal),
    lang === FALLBACK_LANG ? Promise.resolve({}) : fetchTranslations(path, FALLBACK_LANG, signal),
  ]);
  const english = (lang === FALLBACK_LANG ? primary : fallback) as Translations;
  const t = (key: unknown): string => {
    if (typeof key !== "string") return "";
    return primary[key] ?? english[key] ?? key;
  };
  const tEn = (key: unknown): string => {
    if (typeof key !== "string") return "";
    return english[key] ?? key;
  };
  return { data: (main.data ?? {}) as Dict, t, tEn };
}

// --- Lecture prudente des champs (le format n'est pas garanti par un schéma) ---

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asDict = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
/** Les collections sont des objets indexés par id, ou parfois des tableaux. */
const values = (v: unknown): Dict[] =>
  (Array.isArray(v) ? v : Object.values(asDict(v))).map(asDict);

function asPosition(v: unknown): GamePosition | null {
  const p = asDict(v);
  const x = Number(p.x);
  const y = Number(p.y ?? 0);
  const z = Number(p.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, y: Number.isFinite(y) ? y : 0, z };
}

/** Extrait toutes les positions connues d'un objectif. */
function readLocations(obj: Dict): ApiLocation[] {
  const out: ApiLocation[] = [];
  // Zones (marquer, visiter, placer, tirer dans une zone…)
  for (const zone of values(obj.zones)) {
    const mapId = asString(zone.map);
    const position = asPosition(zone.position);
    if (!mapId || !position) continue;
    const outline = asArray(zone.outline)
      .map(asPosition)
      .filter((p): p is GamePosition => p !== null);
    const { top, bottom } = zone;
    out.push({
      mapId,
      position,
      outline: outline.length > 2 ? outline : undefined,
      ...(typeof top === "number" && typeof bottom === "number" ? { top, bottom } : {}),
    });
  }
  // Emplacements possibles d'un objet de quête à trouver
  for (const loc of values(obj.possibleLocations)) {
    const mapId = asString(loc.map);
    if (!mapId) continue;
    for (const raw of asArray(loc.positions)) {
      const position = asPosition(raw);
      if (position) out.push({ mapId, position, possible: true });
    }
  }
  return out;
}

function readTask(raw: Dict, t: (k: unknown) => string, tEn: (k: unknown) => string): Task | null {
  const id = asString(raw.id);
  if (!id) return null;
  const objectives: Objective[] = values(raw.objectives)
    .map((obj, index): Objective => ({
      id: asString(obj.id) ?? `${id}-obj-${index}`,
      type: asString(obj.type) ?? "unknown",
      description: t(obj.description),
      optional: obj.optional === true,
      mapIds: asArray(obj.maps).filter((m): m is string => typeof m === "string"),
      locations: readLocations(obj),
    }));
  return {
    id,
    name: t(raw.name) || id,
    nameEn: tEn(raw.name) || id,
    normalizedName: asString(raw.normalizedName) ?? id,
    traderId: asString(raw.trader) ?? asString(asDict(raw.trader).id) ?? "",
    mapId: asString(raw.map) ?? asString(asDict(raw.map).id),
    minPlayerLevel: typeof raw.minPlayerLevel === "number" ? raw.minPlayerLevel : null,
    kappaRequired: raw.kappaRequired === true,
    wikiLink: asString(raw.wikiLink),
    objectives,
  };
}

/**
 * Télécharge et normalise quêtes, maps et marchands pour un mode de jeu.
 * Seules les données utiles à l'app sont gardées (le fichier "maps" contient
 * aussi le loot, les conteneurs, etc., inutiles ici).
 */
export async function fetchTarkovData(
  gameMode: GameMode,
  lang: string,
  signal?: AbortSignal,
): Promise<TarkovData> {
  const [tasksRes, mapsRes, tradersRes] = await Promise.all([
    fetchEndpoint(`${gameMode}/tasks`, lang, signal),
    fetchEndpoint(`${gameMode}/maps`, lang, signal),
    fetchEndpoint(`${gameMode}/traders`, lang, signal),
  ]);

  const tasks = values(tasksRes.data.tasks)
    .map((raw) => readTask(raw, tasksRes.t, tasksRes.tEn))
    .filter((task): task is Task => task !== null)
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  const maps: GameMap[] = values(mapsRes.data.maps)
    .map((m) => ({
      id: asString(m.id) ?? "",
      name: mapsRes.t(m.name),
      normalizedName: asString(m.normalizedName) ?? "",
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  // traders : objet indexé par id directement sous "data"
  const traders: Trader[] = values(tradersRes.data)
    .map((tr) => ({
      id: asString(tr.id) ?? "",
      name: tradersRes.t(tr.name),
      normalizedName: asString(tr.normalizedName) ?? "",
      imageLink: asString(tr.imageLink),
    }))
    .filter((tr) => tr.id);

  if (tasks.length === 0) throw new Error("L'API n'a renvoyé aucune quête.");

  return { gameMode, language: lang, fetchedAt: Date.now(), tasks, maps, traders };
}
