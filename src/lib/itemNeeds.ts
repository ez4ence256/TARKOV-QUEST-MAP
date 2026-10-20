// Objets à garder : ce que les quêtes pas encore faites (et, au choix, les prochains niveaux de la planque) demandent.
// Fonction pure ; le reste (badges, détail, filtre) est dans ItemFinder.

import type { Task } from "../types";
import type { HideoutStation } from "../api/itemList";
import type { Faction } from "../state/store";
import { isGreyed } from "./questChain";

export type NeedSource =
  | { kind: "quest"; taskId: string; count: number; fir: boolean; anyOf: boolean }
  | { kind: "station"; stationId: string; level: number; count: number; fir: boolean };

export interface ItemNeed {
  /** Total des sources fermes (hors « au choix »). */
  count: number;
  /** Part de ce total qui doit être trouvée en raid. */
  firCount: number;
  /** Au moins une quête accepte cet objet parmi plusieurs. */
  anyOf: boolean;
  sources: NeedSource[];
}

/**
 * Besoins par objet. Quêtes : non grisées, de ma faction (ou toutes si aucune choisie), objectifs
 * « giveItem » non cochés. « findItem » est exclu (il va avec la remise), comme les objets de quête ;
 * « plantItem » aussi, volontairement : l'objet posé est souvent un objet de quête ou un consommable à part.
 * Planque (seulement avec stations) : tous les objets des niveaux au-dessus du niveau construit.
 */
export function computeNeeds(p: {
  tasks: Task[];
  done: Record<string, number>;
  failed?: Record<string, true>;
  faction?: Faction;
  stations?: HideoutStation[];
  hideoutLevels?: Record<string, number>;
}): Map<string, ItemNeed> {
  const needs = new Map<string, ItemNeed>();
  const add = (itemId: string, source: NeedSource) => {
    const n = needs.get(itemId) ?? { count: 0, firCount: 0, anyOf: false, sources: [] };
    if (source.kind === "quest" && source.anyOf) n.anyOf = true;
    else {
      n.count += source.count;
      if (source.fir) n.firCount += source.count;
    }
    n.sources.push(source);
    needs.set(itemId, n);
  };
  for (const t of p.tasks) {
    if ((p.faction && t.faction && t.faction !== p.faction) || isGreyed(t, p.done, p.failed)) continue;
    for (const o of t.objectives) {
      if (o.type !== "giveItem" || p.done[o.id]) continue;
      const ids = o.itemIds ?? [];
      for (const id of ids) add(id, { kind: "quest", taskId: t.id, count: o.count ?? 1, fir: o.foundInRaid === true, anyOf: ids.length > 1 });
    }
  }
  for (const s of p.stations ?? []) {
    const built = p.hideoutLevels?.[s.id] ?? 0;
    if (built < 0) continue; // station ignorée (ex. ferme à bitcoins qu'on ne monte pas)
    for (const l of s.levels)
      if (l.level > built) for (const i of l.items) add(i.itemId, { kind: "station", stationId: s.id, level: l.level, count: i.count, fir: i.fir });
  }
  return needs;
}
