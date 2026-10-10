// Onglet "Sélection" : quêtes choisies, progression, objectifs à cocher.
import type { GameMap, Objective, Task, Trader } from "../types";
import type { Action, ModeState } from "../state/store";
import { ICON_LABELS, QUEST_COLORS, categoryOf } from "../lib/objectiveTypes";
import { hasApiPosition, manualPointKey, objectiveMapCounts, objectivePointKey, taskProgress } from "../lib/points";
import { Icon } from "./Icon";

/** Objectifs d'objets à trouver ou remettre : on signale quand l'API n'en donne aucun emplacement. */
const LOOT_TYPES = new Set(["findItem", "giveItem", "findQuestItem", "sellItem"]);

interface Props {
  tasks: Task[];
  traders: Trader[];
  maps: GameMap[];
  mode: ModeState;
  currentMapId: string | null;
  dispatch: (a: Action) => void;
  onShowMap: (mapId: string) => void;
  onFocus: (pointKey: string, mapId: string) => void;
  onStartPlacing: (objective: Objective) => void;
  onBrowse: () => void;
  /** Ouvre l'onglet Photos sur une quête. */
  onPhotos: (taskId: string) => void;
  /** Ouvre l'onglet Quête sur une quête (même quand tous ses points sont faits). */
  onQuest: (taskId: string) => void;
}

export function SelectedQuests(props: Props) {
  const { mode, dispatch } = props;
  const tasksById = new Map(props.tasks.map((t) => [t.id, t]));
  const mapName = (id: string) => props.maps.find((m) => m.id === id)?.name ?? "Map inconnue";
  const traderName = (id: string) => props.traders.find((t) => t.id === id)?.name ?? "";

  if (mode.selected.length === 0) {
    return (
      <div className="tab-body empty">
        <p>Aucune quête sélectionnée.</p>
        <button className="btn btn-primary" onClick={props.onBrowse}>
          Choisir des quêtes
        </button>
      </div>
    );
  }

  return (
    <div className="tab-body">
      <div className="selection-head">
        <span className="muted small">{mode.selected.length} quête(s) sur la carte</span>
        <button className="btn btn-ghost btn-small" onClick={() => dispatch({ type: "clearSelection" })}>
          Tout désélectionner
        </button>
      </div>

      {mode.selected.map(({ taskId, color }) => {
        const task = tasksById.get(taskId);
        if (!task) {
          // Quête disparue de l'API (retirée du jeu, ou autre mode de jeu)
          return (
            <section key={taskId} className="task-card">
              <div className="task-head">
                <span className="muted">Quête introuvable dans les données actuelles.</span>
                <button className="icon-btn" onClick={() => dispatch({ type: "toggleTask", taskId })} aria-label="Retirer">
                  ×
                </button>
              </div>
            </section>
          );
        }
        const progress = taskProgress(task, mode.done);
        const positioned = task.objectives.filter(hasApiPosition);
        const unpositioned = task.objectives.filter((o) => !hasApiPosition(o));
        const qColor = QUEST_COLORS[color];

        const renderObjective = (o: Objective) => {
          const done = Boolean(mode.done[o.id]);
          const cat = categoryOf(o.type);
          const counts = objectiveMapCounts(o);
          const manual = mode.manual[o.id];
          // premier point de l'objectif sur la map courante, pour le bouton "voir"
          const here = o.locations.find((l) => l.mapId === props.currentMapId);
          const isSpawnList = o.locations.some((l) => l.possible);
          return (
            <li key={o.id} className={`objective ${done ? "is-done" : ""}`}>
              <label className="objective-check">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => dispatch({ type: "setDone", objectiveId: o.id, done: e.target.checked })}
                  aria-label={done ? "Marquer comme non fait" : "Marquer comme fait"}
                />
              </label>
              <div className="objective-body">
                <div className="objective-desc">
                  <span className="objective-icon" style={{ color: qColor }} title={ICON_LABELS[cat]}>
                    <Icon id={cat} size={14} />
                  </span>
                  {o.description || <em className="muted">(sans description)</em>}
                  {o.optional && <span className="tag">optionnel</span>}
                </div>
                {!hasApiPosition(o) && LOOT_TYPES.has(o.type) && (
                  <div className="objective-note">L'API ne donne pas d'emplacement pour cet objet.</div>
                )}
                <div className="objective-links">
                  {[...counts.entries()].map(([mapId, n]) => (
                    <button
                      key={mapId}
                      className={`chip ${mapId === props.currentMapId ? "is-current" : ""}`}
                      onClick={() =>
                        here && mapId === props.currentMapId
                          ? props.onFocus(objectivePointKey(o.id, here.position), mapId)
                          : props.onShowMap(mapId)
                      }
                    >
                      {mapName(mapId)} · {n}{" "}
                      {isSpawnList ? `emplacement${n > 1 ? "s" : ""} possible${n > 1 ? "s" : ""}` : `point${n > 1 ? "s" : ""}`}
                    </button>
                  ))}
                  {!hasApiPosition(o) &&
                    (manual ? (
                      <>
                        <button className="chip" onClick={() => props.onFocus(manualPointKey(o.id), manual.mapId)}>
                          📍 {mapName(manual.mapId)}
                        </button>
                        <button className="chip" onClick={() => props.onStartPlacing(o)}>
                          Déplacer
                        </button>
                        <button
                          className="chip chip-danger"
                          onClick={() => dispatch({ type: "setManual", objectiveId: o.id, position: null })}
                        >
                          Retirer
                        </button>
                      </>
                    ) : (
                      <button className="chip chip-accent" onClick={() => props.onStartPlacing(o)}>
                        📍 Placer sur la carte
                      </button>
                    ))}
                </div>
              </div>
            </li>
          );
        };

        return (
          <section key={taskId} className="task-card" style={{ ["--q" as string]: qColor }}>
            <div className="task-head">
              <span className="task-dot" aria-hidden="true" />
              <div className="task-title">
                <div className="task-name">{task.name}</div>
                <div className="muted small">
                  {traderName(task.traderId)}
                  {task.mapId ? ` · ${mapName(task.mapId)}` : ""}
                  {" · "}
                  <button className="link" onClick={() => props.onQuest(task.id)}>
                    📜 quête
                  </button>
                  {task.wikiLink && (
                    <>
                      {" · "}
                      <button className="link" onClick={() => props.onPhotos(task.id)}>
                        photos
                      </button>
                      {" · "}
                      <a href={task.wikiLink} target="_blank" rel="noreferrer">
                        wiki
                      </a>
                    </>
                  )}
                </div>
              </div>
              <span
                className={`progress-badge ${progress.done === progress.total && progress.total > 0 ? "is-complete" : ""}`}
                title="Objectifs faits / objectifs obligatoires"
              >
                {progress.done}/{progress.total}
              </span>
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: "toggleTask", taskId })}
                aria-label={`Retirer ${task.name}`}
                title="Retirer de la carte"
              >
                ×
              </button>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>

            {positioned.length > 0 && <ul className="objectives">{positioned.map(renderObjective)}</ul>}

            {unpositioned.length > 0 && (
              <>
                <div className="subhead">Objectifs sans position ({unpositioned.length})</div>
                <ul className="objectives">{unpositioned.map(renderObjective)}</ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
