// Collector : quête d'objets FIR qu'on prépare à l'avance. Cocher un objectif = « j'en ai un FIR de côté » (l'objet n'est plus à garder).

import type { Task } from "../types";

export const isCollector = (t: Task) => t.nameEn === "Collector";

/** objet de Collector -> son objectif de remise ; kept = coché (un exemplaire FIR mis de côté). */
export function collectorItems(tasks: Task[], done: Record<string, number>): Map<string, { objectiveId: string; kept: boolean }> {
  const out = new Map<string, { objectiveId: string; kept: boolean }>();
  for (const o of tasks.find(isCollector)?.objectives ?? [])
    if (o.type === "giveItem") for (const id of o.itemIds ?? []) out.set(id, { objectiveId: o.id, kept: Boolean(done[o.id]) });
  return out;
}
