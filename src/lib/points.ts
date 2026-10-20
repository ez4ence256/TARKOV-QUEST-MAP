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
    // avec des zones, seules leurs maps comptent : tarkov.dev ajoute parfois une map en trop
    // (Work Smarter : « secret exfil on Customs » aussi sur The Labyrinth, sans zone là-bas)
    if (o.locations.length) o.locations.forEach((l) => ids.add(l.mapId));
    else o.mapIds.forEach((id) => ids.add(id));
  }
  return ids;
}

/** Objectif en cours : le premier non fait et obligatoire, sinon le premier optionnel non fait. */
export function currentObjective(task: Task, done: Record<string, number>): Objective | undefined {
  const todo = task.objectives.filter((o) => !done[o.id]);
  return todo.find((o) => !o.optional) ?? todo[0];
}

/** Maps d'un objectif : celles de ses zones s'il en a, sinon celles annoncées par tarkov.dev. */
const objectiveMaps = (o: Objective) => (o.locations.length ? o.locations.map((l) => l.mapId) : o.mapIds);

/**
 * Objectifs d'une quête à montrer sur la carte (les faits suivent `showDone`).
 * « Un raid à la fois » : l'objectif en cours et tous les autres non faits de la même map,
 * pour tout faire dans le même raid (Ill-Wisher, Soins privés…) ; les autres maps attendent.
 */
export function shownObjectives(
  task: Task,
  done: Record<string, number>,
  showDone: boolean,
  oneAtATime: boolean,
): Objective[] {
  const current = oneAtATime ? currentObjective(task, done) : undefined;
  const raidMaps = new Set(current ? objectiveMaps(current) : []);
  const sameRaid = (o: Objective) => o === current || objectiveMaps(o).some((m) => raidMaps.has(m));
  return task.objectives.filter((o) => (done[o.id] ? showDone : !oneAtATime || sameRaid(o)));
}

/** Points des quêtes sélectionnées + points placés à la main, pour une map. */
export function buildObjectivePoints(
  tasks: Task[],
  mode: ModeState,
  mapId: string,
  showDone: boolean,
  oneAtATime = false,
): MapPoint[] {
  const points: MapPoint[] = [];
  for (const task of tasks) {
    for (const o of shownObjectives(task, mode.done, showDone, oneAtATime)) {
      // emplacements possibles d'un objet de quête, numérotés sur toutes les maps
      const spawns = o.locations.filter((l) => l.possible);
      for (const loc of o.locations) {
        if (loc.mapId !== mapId) continue;
        const spawnIndex = loc.possible && spawns.length > 1 ? spawns.indexOf(loc) + 1 : 0;
        points.push({
          ...(spawnIndex ? { spawn: { index: spawnIndex, count: spawns.length } } : {}),
          key: objectivePointKey(o.id, loc.position),
          kind: "objective",
          mapId,
          x: loc.position.x,
          z: loc.position.z,
          y: loc.position.y,
          top: loc.top,
          bottom: loc.bottom,
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

/** Quête terminée : tous ses objectifs comptés (voir taskProgress) sont cochés. */
export const isTaskFinished = (task: Task, done: Record<string, number>) => {
  const p = taskProgress(task, done);
  return p.total > 0 && p.done === p.total;
};

/**
 * Quêtes que la fin de `task` débloque : elles la demandent terminée (« complete » chez tarkov.dev), ne
 * sont pas déjà terminées, et toutes leurs autres quêtes demandées terminées le sont aussi. Les
 * conditions de niveau ou de marchand ne sont pas suivies par l'app : elles ne bloquent pas.
 */
export function questsUnlockedBy(task: Task, tasks: Task[], done: Record<string, number>): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.filter((t) => {
    const reqs = t.details?.taskRequirements ?? [];
    if (!reqs.some((r) => r.taskId === task.id && r.status.includes("complete")) || isTaskFinished(t, done)) return false;
    return reqs.every((r) => {
      const other = byId.get(r.taskId);
      return !r.status.includes("complete") || !other || isTaskFinished(other, done);
    });
  });
}

/** Quêtes ayant au moins un objectif coché (optionnels compris), dans l'ordre de `tasks`. */
export function tasksWithProgress(tasks: Task[], done: Record<string, number>): Task[] {
  return tasks.filter((t) => t.objectives.some((o) => done[o.id]));
}

/** Objectifs cochés qui n'appartiennent à aucune quête connue (quête retirée de l'API…). */
export function orphanDoneCount(tasks: Task[], done: Record<string, number>): number {
  const known = new Set(tasks.flatMap((t) => t.objectives.map((o) => o.id)));
  return Object.keys(done).filter((id) => !known.has(id)).length;
}

/** Recherche insensible à la casse et aux accents. */
export const normalizeSearch = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Emplacements possibles d'un même objet (points `spawn`) regroupés : un seul point affiché tant que
 * le groupe n'est pas déplié — celui le plus proche du centre du groupe (un vrai emplacement).
 */
export function spawnGroups(points: MapPoint[]): Map<string, { rep: string; keys: string[] }> {
  const byObjective = new Map<string, MapPoint[]>();
  for (const p of points) if (p.spawn && p.objectiveId) byObjective.set(p.objectiveId, [...(byObjective.get(p.objectiveId) ?? []), p]);
  const out = new Map<string, { rep: string; keys: string[] }>();
  for (const [id, list] of byObjective) {
    if (list.length < 2) continue;
    const cx = list.reduce((s, p) => s + p.x, 0) / list.length;
    const cz = list.reduce((s, p) => s + p.z, 0) / list.length;
    const rep = list.reduce((best, p) => ((p.x - cx) ** 2 + (p.z - cz) ** 2 < (best.x - cx) ** 2 + (best.z - cz) ** 2 ? p : best));
    out.set(id, { rep: rep.key, keys: list.map((p) => p.key) });
  }
  return out;
}

/** Quêtes choisies qui ont des points sur chaque map (mêmes objectifs que la carte : « un raid à la fois », positions manuelles). */
export function questsByMap(tasks: Task[], mode: ModeState, oneAtATime: boolean): Map<string, Set<string>> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map<string, Set<string>>();
  const add = (mapId: string, taskId: string) => out.set(mapId, (out.get(mapId) ?? new Set()).add(taskId));
  for (const { taskId } of mode.selected) {
    const t = byId.get(taskId);
    if (!t) continue;
    for (const o of shownObjectives(t, mode.done, false, oneAtATime)) {
      for (const l of o.locations) add(l.mapId, t.id);
      const manual = mode.manual[o.id];
      if (o.locations.length === 0 && manual) add(manual.mapId, t.id);
    }
  }
  return out;
}
