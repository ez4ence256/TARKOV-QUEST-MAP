// Liste des quêtes (onglet « Quêtes ») : recherche, filtres, et quêtes sélectionnées
// épinglées en tête. Fonctions pures, testées dans questFilter.test.ts.

import type { Task } from "../types";
import { taskMapIds } from "./points";
import { isGreyed } from "./questChain";
import { questScore } from "./search";
import { storyIdOf, type StoryChapter } from "./story";

/** Valeur du filtre marchand « Main story » : seuls les chapitres. */
export const STORY_TRADER = "__story__";

export interface QuestFilters {
  query: string;
  traderId: string;
  mapId: string;
  hideCompleted: boolean;
  /** Seulement les quêtes terminées (tous les objectifs cochés) ou échouées. */
  onlyCompleted?: boolean;
}

export interface QuestResult {
  task: Task;
  score: number;
  /** Trouvée grâce au nom anglais (affiché en rappel). */
  viaEnglish: boolean;
}

/** Chapitre de la Main story, présenté comme une ligne de quête. */
export interface StoryResult {
  chapter: { id: string; name: string; nameEn: string };
  score: number;
  viaEnglish: boolean;
}

export type Row = QuestResult | StoryResult;

/** Clé de sélection : id de la quête, ou `story:<chapitre>` (comme l'onglet Quête). */
export const rowKey = (r: Row) => ("task" in r ? r.task.id : storyIdOf(r.chapter.id));

/**
 * Chapitres qui passent la recherche (nom affiché ou anglais) et les filtres. Ils n'ont ni marchand
 * ni map : tout autre marchand ou une map les masque ; « Masquer les terminées » les laisse
 * (leur avancement n'est connu qu'une fois la page chargée).
 */
export function filterStory(chapters: StoryChapter[], f: QuestFilters, lang: string): StoryResult[] {
  if ((f.traderId && f.traderId !== STORY_TRADER) || f.mapId) return [];
  const q = f.query.trim();
  return chapters.flatMap((c) => {
    const name = lang === "en" ? c.nameEn : c.name;
    const m = q ? questScore(q, { name, nameEn: c.nameEn }) : { score: 1, viaEnglish: false };
    return m.score > 0 ? [{ chapter: { id: c.id, name, nameEn: c.nameEn }, ...m }] : [];
  });
}

const rowName = (r: Row) => ("task" in r ? r.task.name : r.chapter.name);

/** Quêtes et chapitres mélangés : par nom affiché ; avec une recherche, meilleurs résultats d'abord (puis par nom). */
export function mergeRows(quests: QuestResult[], stories: StoryResult[], lang: string, searching: boolean): Row[] {
  const byName = (a: Row, b: Row) => rowName(a).localeCompare(rowName(b), lang);
  return [...quests, ...stories].sort(searching ? (a, b) => b.score - a.score || byName(a, b) : byName);
}

/** Quêtes qui passent les filtres ; avec une recherche, les meilleurs résultats d'abord. */
export function filterQuests(tasks: Task[], f: QuestFilters, done: Record<string, number>, failed?: Record<string, true>): QuestResult[] {
  const q = f.query.trim();
  const results: QuestResult[] = [];
  for (const t of tasks) {
    if (f.traderId && t.traderId !== f.traderId) continue;
    if (f.mapId && !taskMapIds(t).has(f.mapId)) continue;
    if (f.hideCompleted || f.onlyCompleted) {
      const greyed = isGreyed(t, done, failed);
      if (f.hideCompleted ? greyed : !greyed) continue;
    }
    const match = q ? questScore(q, t) : { score: 1, viaEnglish: false };
    if (match.score > 0) results.push({ task: t, ...match });
  }
  // tri stable : à score égal, l'ordre alphabétique est conservé
  if (q) results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Sépare les résultats : quêtes sélectionnées (qui passent les filtres) en tête, puis
 * les autres. L'ordre des résultats est gardé dans chaque groupe.
 */
export function pinSelected(results: Row[], selectedKeys: Iterable<string>) {
  const selected = new Set(selectedKeys);
  const shown = new Set(results.map(rowKey));
  return {
    pinned: results.filter((r) => selected.has(rowKey(r))),
    others: results.filter((r) => !selected.has(rowKey(r))),
    /** Sélectionnés (quêtes ou chapitres) masqués par la recherche ou les filtres. */
    hiddenSelected: [...selected].filter((k) => !shown.has(k)).length,
  };
}
