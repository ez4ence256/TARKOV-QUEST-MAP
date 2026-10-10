// Liste des quêtes (onglet « Quêtes ») : recherche, filtres, et quêtes sélectionnées
// épinglées en tête. Fonctions pures, testées dans questFilter.test.ts.

import type { Task } from "../types";
import { taskMapIds, taskProgress } from "./points";
import { questScore } from "./search";

export interface QuestFilters {
  query: string;
  traderId: string;
  mapId: string;
  hideCompleted: boolean;
}

export interface QuestResult {
  task: Task;
  score: number;
  /** Trouvée grâce au nom anglais (affiché en rappel). */
  viaEnglish: boolean;
}

/** Quêtes qui passent les filtres ; avec une recherche, les meilleurs résultats d'abord. */
export function filterQuests(tasks: Task[], f: QuestFilters, done: Record<string, number>): QuestResult[] {
  const q = f.query.trim();
  const results: QuestResult[] = [];
  for (const t of tasks) {
    if (f.traderId && t.traderId !== f.traderId) continue;
    if (f.mapId && !taskMapIds(t).has(f.mapId)) continue;
    if (f.hideCompleted) {
      const p = taskProgress(t, done);
      if (p.total > 0 && p.done === p.total) continue;
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
export function pinSelected(results: QuestResult[], selectedIds: Iterable<string>) {
  const selected = new Set(selectedIds);
  return {
    pinned: results.filter((r) => selected.has(r.task.id)),
    others: results.filter((r) => !selected.has(r.task.id)),
    /** Quêtes sélectionnées masquées par la recherche ou les filtres. */
    hiddenSelected: [...selected].filter((id) => !results.some((r) => r.task.id === id)).length,
  };
}
