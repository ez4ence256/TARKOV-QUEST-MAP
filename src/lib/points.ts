// Construction des points affichés sur la carte à partir des quêtes sélectionnées.

import type { GamePosition, MapPoint, Objective, Task } from "../types";
import type { ModeState } from "../state/store";

/**
 * Clé stable d'un point d'objectif, utilisée pour rattacher les notes.
 * Basée sur les coordonnées (arrondies) plutôt que sur l'ordre des positions,
 * pour survivre à une mise à jour des données de l'API.
 */
export const objectivePointKey = (objectiveId: string, p: { x: number; z: number }) =>
  `${objectiveId}@${p.x.toFixed(1)},${p.z.toFixed(1)}`;
export const manualPointKey = (objectiveId: string) => `${objectiveId}@manual`;

/** Un objectif a-t-il au moins une position fournie par l'API ? */
export const hasApiPosition = (o: Objective) => o.locations.length > 0;

/** Maps (ids) où un objectif a des positions connues, avec le nombre de points. */
export function objectiveMapCounts(o: Objective): Map<string, number> {
  const counts = new Map<string, number>();
  for (const loc of o.locations) counts.set(loc.mapId, (counts.get(loc.mapId) ?? 0) + 1);
  return counts;
}

/** Maps concernées par une quête (map principale, maps des objectifs, positions). */
export function taskMapIds(task: Task): Set<string> {
  const ids = new Set<string>();
  if (task.mapId) ids.add(task.mapId);
  for (const o of task.objectives) {
    o.mapIds.forEach((id) => ids.add(id));
    o.locations.forEach((l) => ids.add(l.mapId));
  }
  return ids;
}

/** Points des quêtes sélectionnées + points placés à la main, pour une map. */
export function buildObjectivePoints(
  tasks: Task[],
  mode: ModeState,
  mapId: string,
  showDone: boolean,
): MapPoint[] {
  const points: MapPoint[] = [];
  for (const task of tasks) {
    for (const o of task.objectives) {
      if (!showDone && mode.done[o.id]) continue;
      for (const loc of o.locations) {
        if (loc.mapId !== mapId) continue;
        points.push({
          key: objectivePointKey(o.id, loc.position),
          kind: "objective",
          mapId,
          x: loc.position.x,
          z: loc.position.z,
          taskId: task.id,
          objectiveId: o.id,
          outline: loc.outline as GamePosition[] | undefined,
        });
      }
      const manual = mode.manual[o.id];
      if (!hasApiPosition(o) && manual && manual.mapId === mapId) {
        points.push({
          key: manualPointKey(o.id),
          kind: "manual",
          mapId,
          x: manual.x,
          z: manual.z,
          taskId: task.id,
          objectiveId: o.id,
        });
      }
    }
  }
  return points;
}

/** Progression d'une quête : objectifs cochés / total (objectifs optionnels exclus du total). */
export function taskProgress(task: Task, done: Record<string, number>) {
  const required = task.objectives.filter((o) => !o.optional);
  const list = required.length > 0 ? required : task.objectives;
  return { done: list.filter((o) => done[o.id]).length, total: list.length };
}

/** Recherche insensible à la casse et aux accents. */
export const normalizeSearch = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
