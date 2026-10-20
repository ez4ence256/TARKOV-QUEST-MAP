// Objets auxquels un objectif de quête fait référence (pour en montrer les images).
import type { Objective } from "../types";

/** Au-delà, la liste « au choix » (n'importe quelle nourriture…) est abrégée : 5 images + « +N ». */
export const MAX_SHOWN = 6;

/** Types d'objectifs où « ×N » est une quantité d'objets (et non des éliminations…). */
const COUNT_TYPES = new Set(["giveItem", "findItem", "plantItem", "giveQuestItem", "findQuestItem", "plantQuestItem", "sellItem"]);

export interface ObjectiveItemRefs {
  /** Objets montrés (sans doublon). */
  shown: string[];
  /** Objets au choix non montrés (liste trop longue). */
  hidden: string[];
  /** Clés requises (à plat, sans doublon). */
  keys: string[];
  /** Quantité à afficher (« ×N »), 0 si aucune. */
  count: number;
}

export function objectiveItemRefs(o: Objective): ObjectiveItemRefs {
  const shown: string[] = [];
  const hidden: string[] = [];
  const add = (ids: (string | undefined)[] | undefined) => {
    const list = [...new Set((ids ?? []).filter((x): x is string => Boolean(x)))].filter((id) => !shown.includes(id));
    const cut = list.length > MAX_SHOWN ? MAX_SHOWN - 1 : list.length;
    shown.push(...list.slice(0, cut));
    hidden.push(...list.slice(cut));
  };
  add(o.itemIds);
  add([o.questItemId]);
  add([o.markerItemId]);
  add(o.useItemIds);
  add(o.buildItemIds);
  const keys = [...new Set((o.requiredKeyIds ?? []).flat())];
  return { shown, hidden, keys, count: COUNT_TYPES.has(o.type) && (o.count ?? 0) > 1 ? (o.count as number) : 0 };
}
