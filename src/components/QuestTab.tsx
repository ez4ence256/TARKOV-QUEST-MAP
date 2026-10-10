// Onglet "Quête" : tout ce qu'il faut faire pour une quête, avec les objectifs à cocher.
// Reste atteignable même quand tous les points sont faits (donc absents de la carte) :
// depuis la popup d'un autre point de la quête, ou depuis la quête dans le panneau.
import type { Task, Trader } from "../types";
import { ICON_LABELS, categoryOf } from "../lib/objectiveTypes";
import { taskProgress } from "../lib/points";
import { Icon } from "./Icon";
import { ConfirmButton } from "./ConfirmButton";

interface Props {
  tasks: Task[];
  traders: Trader[];
  /** Quêtes sélectionnées (proposées dans la liste). */
  selectedIds: string[];
  /** Quête affichée. */
  taskId: string | null;
  onTaskChange: (taskId: string) => void;
  done: Record<string, number>;
  onSetDone: (objectiveId: string, done: boolean) => void;
  onReset: (task: Task) => void;
  onPhotos: (taskId: string) => void;
}

/** Quêtes proposées dans un onglet (Quête, Photos) : la quête demandée, puis la sélection. */
export function tabTaskOptions(taskId: string | null, selectedIds: string[]) {
  return [...new Set([...(taskId ? [taskId] : []), ...selectedIds])];
}

export function QuestTab(p: Props) {
  const tasksById = new Map(p.tasks.map((t) => [t.id, t]));
  const optionIds = tabTaskOptions(p.taskId, p.selectedIds).filter((id) => tasksById.has(id));
  const task = optionIds.length > 0 ? tasksById.get(optionIds[0]) : undefined;

  if (!task) {
    return (
      <div className="tab-body empty">
        <p>Sélectionnez une quête, ou ouvrez-la depuis un point de la carte (bouton 📜 Quête).</p>
      </div>
    );
  }

  const progress = taskProgress(task, p.done);
  const checked = task.objectives.filter((o) => p.done[o.id]).length;
  const trader = p.traders.find((t) => t.id === task.traderId)?.name;

  return (
    <div className="tab-body quest-tab">
      {optionIds.length > 1 && (
        <select
          className="input"
          value={task.id}
          onChange={(e) => p.onTaskChange(e.target.value)}
          aria-label="Quête affichée"
        >
          {optionIds.map((id) => (
            <option key={id} value={id}>
              {tasksById.get(id)!.name}
            </option>
          ))}
        </select>
      )}

      <div className="quest-tab-head">
        <h2 className="quest-tab-title">{task.name}</h2>
        <span
          className={`progress-badge ${progress.done === progress.total && progress.total > 0 ? "is-complete" : ""}`}
          title="Objectifs faits / objectifs obligatoires"
        >
          {progress.done}/{progress.total}
        </span>
      </div>
      <div className="muted small">
        {trader}
        {task.minPlayerLevel ? ` · niveau ${task.minPlayerLevel}` : ""}
        {task.kappaRequired ? " · Kappa" : ""}
        {task.nameEn !== task.name ? ` · EN : ${task.nameEn}` : ""}
      </div>

      <div className="subhead">Objectifs</div>
      <ul className="objectives">
        {task.objectives.map((o) => {
          const isDone = Boolean(p.done[o.id]);
          const cat = categoryOf(o.type);
          const spawns = o.locations.filter((l) => l.possible).length;
          return (
            <li key={o.id} className={`objective ${isDone ? "is-done" : ""}`}>
              <label className="objective-check">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => p.onSetDone(o.id, e.target.checked)}
                  aria-label={isDone ? "Marquer comme non fait" : "Marquer comme fait"}
                />
              </label>
              <div className="objective-body">
                <div className="objective-desc">
                  <span className="objective-icon" title={ICON_LABELS[cat]}>
                    <Icon id={cat} size={14} />
                  </span>
                  {o.description || <em className="muted">(sans description)</em>}
                  {o.optional && <span className="tag">optionnel</span>}
                </div>
                {spawns > 1 && <div className="objective-note">{spawns} emplacements possibles sur la carte</div>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Objectifs : données tarkov.dev. Décocher un objectif fait réapparaître ses points.</p>

      <div className="btn-row">
        {checked > 0 && (
          <ConfirmButton
            label="Réinitialiser cette quête"
            question={`Décocher ${checked} objectif${checked > 1 ? "s" : ""} ?`}
            confirmLabel="Oui"
            onConfirm={() => p.onReset(task)}
          />
        )}
        {task.wikiLink && (
          <button className="btn btn-small" onClick={() => p.onPhotos(task.id)}>
            📷 Photos
          </button>
        )}
      </div>
    </div>
  );
}
