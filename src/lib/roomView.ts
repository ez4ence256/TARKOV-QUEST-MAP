// Rooms v2 : l'instantané d'un coéquipier, mis en forme pour être AFFICHÉ avec les mêmes fonctions que mes propres quêtes
// (SelectedQuests, buildObjectivePoints). Lecture seule : rien ici n'écrit dans l'état local.

import type { Task } from "../types";
import { emptyModeState, type ModeState } from "../state/store";
import type { RoomSnapshot } from "./roomSync";

/** ModeState d'affichage d'un instantané : seules les quêtes connues localement sont gardées. */
export function viewModeOf(s: RoomSnapshot, tasksById: ReadonlyMap<string, Task>): ModeState {
  return {
    ...emptyModeState(),
    selected: s.selected.filter((t) => tasksById.has(t.taskId)),
    // la date n'est pas publiée : seule la présence compte pour l'affichage
    done: Object.fromEntries(s.done.map((id) => [id, 1])),
    manual: Object.fromEntries(s.manual.map((m) => [m.objectiveId, { mapId: m.mapId, x: m.x, z: m.z }])),
    story: { selected: s.storySelected, done: Object.fromEntries(s.storyDone.map((id) => [id, true as const])) },
  };
}

/** Quêtes sélectionnées d'un coéquipier, connues localement. */
export const teammateTasks = (view: ModeState, tasksById: ReadonlyMap<string, Task>): Task[] =>
  view.selected.map((t) => tasksById.get(t.taskId)).filter((t): t is Task => Boolean(t));
