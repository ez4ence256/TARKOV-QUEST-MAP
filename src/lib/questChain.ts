// Quêtes prérequises et branches exclusives : ce que l'app grise (terminé ou échoué) à l'activation d'une quête.
// Fonctions pures : l'appelant applique le résultat en une seule action (applyQuestStatus).

import type { Task } from "../types";
import { isTaskFinished } from "./points";

/** Grisée : terminée (tous ses objectifs cochés) ou marquée échouée. */
export const isGreyed = (task: Task, done: Record<string, number>, failed?: Record<string, true>) =>
  isTaskFinished(task, done) || !!failed?.[task.id];

/**
 * Quêtes qui échouent quand `completedIds` sont terminées (branches exclusives, champ failedBy).
 * Les quêtes déjà grisées et celles de `skip` ne changent pas.
 */
export function branchFailures(
  completedIds: string[],
  tasks: Task[],
  done: Record<string, number>,
  failed?: Record<string, true>,
  skip: Set<string> = new Set(),
): string[] {
  const completed = new Set(completedIds);
  return tasks
    .filter((x) => !completed.has(x.id) && !skip.has(x.id) && !isGreyed(x, done, failed) && x.failedBy?.some((c) => completed.has(c)))
    .map((x) => x.id);
}

/**
 * Ce qu'il faut griser quand on active `taskId`, selon le statut demandé de chaque prérequis R :
 *  - ["complete"] : R terminée ; - ["failed"] : R échouée ;
 *  - contient "active" : R était disponible, on ne la grise pas ;
 *  - ["complete","failed"] : R fermée dans les deux cas, grisée « terminée » sans échouer ses branches.
 * Dans tous les cas on remonte les prérequis de R. Puis les quêtes des branches exclusives des
 * prérequis terminés sans ambiguïté échouent.
 * Limite : une quête sans objectif ne peut pas être cochée, elle reste non grisée.
 */
export function prerequisiteChanges(
  taskId: string,
  tasks: Task[],
  done: Record<string, number>,
  failed?: Record<string, true>,
): { complete: string[]; failed: string[] } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const complete = new Set<string>();
  const failedSet = new Set<string>();
  const sure: string[] = []; // terminées sans ambiguïté : seules à faire échouer leurs branches
  const visited = new Set([taskId]);
  const visit = (t: Task) => {
    for (const req of t.details?.taskRequirements ?? []) {
      const r = byId.get(req.taskId);
      if (!r || visited.has(r.id) || isGreyed(r, done, failed)) continue;
      visited.add(r.id);
      const s = req.status;
      if (!s.includes("active")) {
        if (s.includes("complete")) {
          if (r.objectives.length) complete.add(r.id);
          if (!s.includes("failed")) sure.push(r.id);
        } else if (s.includes("failed")) failedSet.add(r.id);
      }
      visit(r);
    }
  };
  const start = byId.get(taskId);
  if (start) visit(start);
  const branch = branchFailures(sure, tasks, done, failed, new Set([taskId, ...complete, ...failedSet]));
  return { complete: [...complete], failed: [...failedSet, ...branch] };
}
