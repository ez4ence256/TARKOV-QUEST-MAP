// Sorties des maps (extracts, coops, transits) : classement, fusion des doublons,
// libellés. Fonctions pures, testées dans exits.test.ts.

import type { MapExit } from "../types";
import type { RawBounds } from "../map/calibration";
import { tr } from "./i18n";

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

export type ExitIconKind = "extract" | "pmc" | "scav" | "shared" | "coop" | "transit";

/** Icône d'une sortie : coop et transit priment ; sinon d'après les factions (aucune : icône générique). */
export function exitIconKind(exit: Pick<MapExit, "kind" | "factions">): ExitIconKind {
  if (exit.kind !== "extract") return exit.kind;
  const pmc = exit.factions.includes("pmc");
  const scav = exit.factions.includes("scav");
  if (pmc && scav) return "shared";
  return pmc ? "pmc" : scav ? "scav" : "extract";
}

/** Sorties à afficher : sans les sorties Scav seules quand la case « Extracts Scav » est décochée. */
export function visibleExits<T extends Pick<MapExit, "kind" | "factions">>(exits: T[], showScav: boolean): T[] {
  return showScav ? exits : exits.filter((e) => exitIconKind(e) !== "scav");
}

/** Part de la taille de la map tolérée hors emprise (relevé : sorties réelles à 4 % au plus, aberrantes à 119 % et plus). */
const OFF_MAP_MARGIN = 0.5;

/**
 * Retire les sorties très loin hors de la map (Point zéro : « Barrage ONU » et « Bunker scav » sont
 * à plus d'une largeur de map, donnée de l'API telle quelle). Une sortie juste au bord reste.
 */
export function exitsNearMap<T extends Pick<MapExit, "position">>(exits: T[], bounds: RawBounds | undefined): T[] {
  if (!bounds) return exits;
  const [[x1, z1], [x2, z2]] = bounds;
  const mx = Math.abs(x2 - x1) * OFF_MAP_MARGIN;
  const mz = Math.abs(z2 - z1) * OFF_MAP_MARGIN;
  return exits.filter(
    ({ position: { x, z } }) =>
      x >= Math.min(x1, x2) - mx && x <= Math.max(x1, x2) + mx && z >= Math.min(z1, z2) - mz && z <= Math.max(z1, z2) + mz,
  );
}

export function factionLabel(factions: MapExit["factions"]): string {
  if (factions.length === 2) return tr("PMC et Scav", "PMC and Scav");
  if (factions[0] === "pmc") return "PMC";
  if (factions[0] === "scav") return "Scav";
  return tr("non précisée par les données", "not specified by the data");
}

// getters : la langue est lue à chaque accès, pas à l'import
export const EXIT_KIND_LABELS: Record<MapExit["kind"], string> = {
  get extract() {
    return tr("Sortie", "Exit");
  },
  get coop() {
    return tr("Sortie coop (PMC + Scav ensemble)", "Co-op exit (PMC + Scav together)");
  },
  get transit() {
    return tr("Transit", "Transit");
  },
};
