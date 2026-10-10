// Sorties des maps (extracts, coops, transits) : classement, fusion des doublons,
// libellés. Fonctions pures, testées dans exits.test.ts.

import type { MapExit } from "../types";

/** L'API n'a pas de champ « coop » : seul le nom anglais l'indique (« (Co-op) » ou « (Co-Op) »). */
export const isCoopName = (nameEn: string) => /\(\s*co-?op\s*\)/i.test(nameEn);

/** Factions d'après le champ de l'API (pmc, scav, shared ; absent = non précisé). */
export function factionsOf(raw: string | null | undefined): MapExit["factions"] {
  if (raw === "pmc") return ["pmc"];
  if (raw === "scav") return ["scav"];
  if (raw === "shared") return ["pmc", "scav"];
  return [];
}

/** Distance horizontale sous laquelle deux sorties de même nom sont la même sortie. */
const SAME_EXIT_DISTANCE = 5;

/**
 * L'API liste souvent la même sortie deux fois (une ligne PMC, une ligne Scav, au même
 * endroit). On les fusionne : une seule pastille, factions réunies.
 */
export function mergeExits(exits: MapExit[]): MapExit[] {
  const merged: MapExit[] = [];
  for (const exit of exits) {
    const twin = merged.find(
      (m) =>
        m.kind === exit.kind &&
        m.nameEn === exit.nameEn &&
        Math.hypot(m.position.x - exit.position.x, m.position.z - exit.position.z) < SAME_EXIT_DISTANCE,
    );
    if (!twin) {
      merged.push({ ...exit, factions: [...exit.factions] });
      continue;
    }
    for (const f of exit.factions) if (!twin.factions.includes(f)) twin.factions.push(f);
    twin.factions.sort();
    if (exit.top !== undefined) twin.top = Math.max(twin.top ?? exit.top, exit.top);
    if (exit.bottom !== undefined) twin.bottom = Math.min(twin.bottom ?? exit.bottom, exit.bottom);
  }
  return merged;
}

export function factionLabel(factions: MapExit["factions"]): string {
  if (factions.length === 2) return "PMC et Scav";
  if (factions[0] === "pmc") return "PMC";
  if (factions[0] === "scav") return "Scav";
  return "non précisée par les données";
}

export const EXIT_KIND_LABELS: Record<MapExit["kind"], string> = {
  extract: "Sortie",
  coop: "Sortie coop (PMC + Scav ensemble)",
  transit: "Transit",
};
