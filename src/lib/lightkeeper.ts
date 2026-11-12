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
