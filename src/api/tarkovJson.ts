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
  TaskDetails,
  TaskRewards,
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

/** Identifiant d'une référence, donnée soit comme chaîne, soit comme objet { id }. */
const refId = (v: unknown): string | null => asString(v) ?? asString(asDict(v).id);
const refIds = (v: unknown): string[] => asArray(v).map(refId).filter((id): id is string => id !== null);
const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Champs complémentaires d'un objectif (quantité, objets, Find in raid, clés…), seulement s'ils existent. */
function readObjectiveExtras(obj: Dict): Partial<Objective> {
  const extras: Partial<Objective> = {};
  const count = asNumber(obj.count);
  if (count !== null) extras.count = count;
  const items = refIds(obj.items);
  if (items.length > 0) extras.itemIds = items;
  if (typeof obj.foundInRaid === "boolean") extras.foundInRaid = obj.foundInRaid;
  const questItem = refId(obj.questItem);
  if (questItem) extras.questItemId = questItem;
  const keys = asArray(obj.requiredKeys).map(refIds).filter((group) => group.length > 0);
  if (keys.length > 0) extras.requiredKeyIds = keys;
  const marker = refId(obj.markerItem);
  if (marker) extras.markerItemId = marker;
  return extras;
}

function readRewards(raw: Dict, experience: unknown): TaskRewards | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  return {
    experience: asNumber(experience) ?? 0,
    items: asArray(raw.items)
      .map(asDict)
      .map((r) => ({ itemId: refId(r.item) ?? "", count: asNumber(r.count) ?? 1 }))
      .filter((r) => r.itemId),
    standing: asArray(raw.traderStanding)
      .map(asDict)
      .map((r) => ({ traderId: refId(r.trader) ?? "", value: asNumber(r.standing) ?? 0 }))
      .filter((r) => r.traderId),
    offerUnlocks: asArray(raw.offerUnlock)
      .map(asDict)
      .map((r) => ({ itemId: refId(r.item) ?? "", traderId: refId(r.trader) ?? "", level: asNumber(r.level) ?? 0 }))
      .filter((r) => r.itemId),
    skills: asArray(raw.skillLevelReward)
      .map(asDict)
      .map((r) => ({ skill: asString(r.skill) ?? "", level: asNumber(r.level) ?? 0 }))
      .filter((r) => r.skill),
  };
}

function readDetails(raw: Dict, t: (k: unknown) => string): TaskDetails {
  return {
    taskRequirements: asArray(raw.taskRequirements)
      .map(asDict)
      .map((r) => ({ taskId: refId(r.task) ?? "", status: asArray(r.status).filter((s): s is string => typeof s === "string") }))
      .filter((r) => r.taskId),
    traderRequirements: asArray(raw.traderRequirements)
      .map(asDict)
      .map((r) => ({
        traderId: refId(r.trader) ?? "",
        type: asString(r.requirementType) ?? "",
        compare: asString(r.compareMethod) ?? "",
        value: asNumber(r.value) ?? 0,
      }))
      .filter((r) => r.traderId),
    neededKeys: asArray(raw.neededKeys)
      .map(asDict)
      .map((r) => ({ mapId: refId(r.map) ?? "", keyIds: refIds(r.keys) }))
      .filter((r) => r.keyIds.length > 0),
    rewards: readRewards(asDict(raw.finishRewards), raw.experience),
    failConditions: values(raw.failConditions).map((f) => ({
      type: asString(f.type) ?? "",
      // la clé de traduction est renvoyée telle quelle quand le texte manque : on la retire
      description: t(f.description) === asString(f.description) ? "" : t(f.description),
      ...(refId(f.task) ? { taskId: refId(f.task)!, status: asArray(f.status).filter((s): s is string => typeof s === "string") } : {}),
    })),
    restartable: raw.restartable === true,
    lightkeeperRequired: raw.lightkeeperRequired === true,
  };
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
      ...readObjectiveExtras(obj),
    }));
  return {
    details: readDetails(raw, t),
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

  const itemNames = await readItemNames(gameMode, lang, tasks, tasksRes, signal);

  return { gameMode, language: lang, fetchedAt: Date.now(), tasks, maps, traders, itemNames };
}

/** Objets cités par les quêtes : clés, objets à rendre ou à poser, marqueurs, récompenses. */
export function referencedItemIds(tasks: Task[]): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    for (const o of task.objectives) {
      o.itemIds?.forEach((id) => ids.add(id));
      o.requiredKeyIds?.flat().forEach((id) => ids.add(id));
      if (o.markerItemId) ids.add(o.markerItemId);
    }
    task.details?.neededKeys.forEach((k) => k.keyIds.forEach((id) => ids.add(id)));
    task.details?.rewards?.items.forEach((r) => ids.add(r.itemId));
    task.details?.rewards?.offerUnlocks.forEach((r) => ids.add(r.itemId));
  }
  return ids;
}

/**
 * Noms des objets utiles, dans la langue demandée. On lit seulement le fichier de
 * traductions des objets (~1,7 Mo, clés "<id> Name") et on ne garde que les objets
 * cités par les quêtes ; les objets de quête ont leurs noms dans le fichier des quêtes.
 * En cas d'échec, l'app fonctionne sans les noms.
 */
async function readItemNames(
  gameMode: GameMode,
  lang: string,
  tasks: Task[],
  tasksRes: { data: Dict; t: (k: unknown) => string },
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const q of values(tasksRes.data.questItems)) {
    const id = asString(q.id);
    const name = tasksRes.t(q.name);
    if (id && name && name !== q.name) names[id] = name;
  }
  const translations = await fetchTranslations(`${gameMode}/items`, lang, signal);
  for (const id of referencedItemIds(tasks)) {
    const name = translations[`${id} Name`];
    if (name) names[id] = name;
  }
  return names;
}
