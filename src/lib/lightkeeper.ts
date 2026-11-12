import type { Task } from "../types";

export const LIGHTKEEPER_TRADER_ID = "638f541a29ffd1183d187f57";

/** Quêtes de Lightkeeper et toutes leurs quêtes préalables (transitives) : le flag lightkeeperRequired de tarkov.dev est faux partout. */
export function lightkeeperTaskIds(tasks: Pick<Task, "id" | "traderId" | "details">[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = new Set<string>();
  const stack = tasks.filter((t) => t.traderId === LIGHTKEEPER_TRADER_ID).map((t) => t.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const r of byId.get(id)?.details?.taskRequirements ?? []) stack.push(r.taskId);
  }
  return ids;
}

/** Services débloqués chez Lightkeeper, par nom anglais de la quête. */
export const LIGHTKEEPER_SERVICES: Record<string, { fr: string; en: string }> = {
  Snatch: { fr: "Amulette sacrée (3 Intelligence folder + 1 000 $)", en: "Sacred Amulet (3 Intelligence folder + $1,000)" },
  Provocation: { fr: "Soutien des Rogues (2 Secure magnetic tape cassette + 2 500 €)", en: "Rogue support (2 Secure magnetic tape cassette + €2,500)" },
  "Make an Impression": { fr: "Soutien de Zryachiy (3 Military flash drive + 2 000 $)", en: "Zryachiy support (3 Military flash drive + $2,000)" },
};

/**
 * Guide : quêtes à faire avant Lightkeeper (`before`) puis les siennes (`own`), chacune après ses préalables
 * (ordre topologique ; à égalité : tarkov.dev avant wiki, niveau requis, nom). Préalable inconnu ignoré ;
 * cycle : le reste est ajouté dans l'ordre de tri. shortcut: split par marchand après le tri global, un préalable
 * de Lightkeeper qui dépendrait d'une de ses quêtes resterait dans `before`.
 */
export function lightkeeperSteps<T extends Pick<Task, "id" | "name" | "traderId" | "minPlayerLevel" | "lightkeeperRequired" | "source" | "details">>(tasks: T[]): { before: T[]; own: T[] } {
  const inSet = tasks.filter((t) => t.lightkeeperRequired);
  const ids = new Set(inSet.map((t) => t.id));
  const cmp = (a: T, b: T) => Number(a.source === "wiki") - Number(b.source === "wiki") || (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0) || a.name.localeCompare(b.name);
  const waiting = new Map(inSet.map((t) => [t.id, new Set((t.details?.taskRequirements ?? []).map((r) => r.taskId).filter((id) => ids.has(id) && id !== t.id))]));
  const sorted: T[] = [];
  const left = [...inSet].sort(cmp);
  while (left.length) {
    const i = left.findIndex((t) => waiting.get(t.id)!.size === 0);
    const [t] = left.splice(i < 0 ? 0 : i, 1); // i < 0 : cycle
    sorted.push(t);
    for (const w of waiting.values()) w.delete(t.id);
  }
  return { before: sorted.filter((t) => t.traderId !== LIGHTKEEPER_TRADER_ID), own: sorted.filter((t) => t.traderId === LIGHTKEEPER_TRADER_ID) };
}
