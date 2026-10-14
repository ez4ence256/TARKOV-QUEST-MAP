// Onglet "Sélection" : quêtes choisies, progression, objectifs à cocher.
import type { GameMap, Objective, Task, Trader } from "../types";
import type { Action, ModeState } from "../state/store";
import { ICON_LABELS, QUEST_COLORS, categoryOf } from "../lib/objectiveTypes";
import { currentObjective, hasApiPosition, manualPointKey, objectiveMapCounts, objectivePointKey, taskProgress } from "../lib/points";
import { getLang, tr } from "../lib/i18n";
import { Icon } from "./Icon";
import { StoryCard, useStoryChapters } from "./StoryView";

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
  /** Ouvre la fiche d'un chapitre de la Main story. */
  onStory: (chapter: string) => void;
}

export function SelectedQuests(props: Props) {
  const { mode, dispatch } = props;
  const tasksById = new Map(props.tasks.map((t) => [t.id, t]));
  const mapName = (id: string) => props.maps.find((m) => m.id === id)?.name ?? tr("Map inconnue", "Unknown map");
  const traderName = (id: string) => props.traders.find((t) => t.id === id)?.name ?? "";
  const storySelected = mode.story?.selected ?? [];
  // noms des chapitres : la liste (en cache) n'est demandée que s'il y a des chapitres choisis
  const chapters = useStoryChapters(storySelected.length > 0);

  // quêtes et chapitres mélangés, triés par nom affiché comme dans l'onglet Quêtes
  const lang = getLang();
  const items = [
    ...mode.selected.map((sel) => ({ sel, chapter: null as string | null, name: tasksById.get(sel.taskId)?.name ?? "" })),
    ...storySelected.map((chapter) => {
      const c = chapters.chapters?.find((x) => x.id === chapter);
      return { sel: null, chapter, name: (lang === "en" ? c?.nameEn : c?.name) ?? chapter };
    }),
  ].sort((a, b) => a.name.localeCompare(b.name, lang));

  if (items.length === 0) {
    return (
      <div className="tab-body empty">
        <p>{tr("Aucune quête sélectionnée.", "No quest selected.")}</p>
        <button className="btn btn-primary" onClick={props.onBrowse}>
          {tr("Choisir des quêtes", "Choose quests")}
        </button>
      </div>
    );
  }

  return (
    <div className="tab-body">
      {items.length > 0 && (
        <div className="selection-head">
          <span className="muted small">
            {tr(`${mode.selected.length} quête(s) sur la carte`, `${mode.selected.length} quest(s) on the map`)}
            {storySelected.length > 0 && ` · ${storySelected.length} Main story`}
          </span>
          <button className="btn btn-ghost btn-small" onClick={() => dispatch({ type: "clearSelection" })}>
            {tr("Tout désélectionner", "Deselect all")}
          </button>
        </div>
      )}

      {items.map((item) => {
        if (item.chapter !== null) {
          const chapter = item.chapter;
          return (
            <StoryCard
              key={`story:${chapter}`}
              chapterId={chapter}
              chapters={chapters}
              done={mode.story?.done ?? {}}
              onOpen={() => props.onStory(chapter)}
              onRemove={() => dispatch({ type: "toggleStory", chapter })}
            />
          );
        }
        const { taskId, color } = item.sel!;
        const task = tasksById.get(taskId);
        if (!task) {
          // Quête disparue de l'API (retirée du jeu, ou autre mode de jeu)
          return (
            <section key={taskId} className="task-card">
              <div className="task-head">
                <span className="muted">{tr("Quête introuvable dans les données actuelles.", "Quest not found in the current data.")}</span>
                <button className="icon-btn" onClick={() => dispatch({ type: "toggleTask", taskId })} aria-label={tr("Retirer", "Remove")}>
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

        const current = currentObjective(task, mode.done);
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
                  aria-label={done ? tr("Marquer comme non fait", "Mark as not done") : tr("Marquer comme fait", "Mark as done")}
                />
              </label>
              <div className="objective-body">
                <div className="objective-desc">
                  <span className="objective-icon" style={{ color: qColor }} title={ICON_LABELS[cat]}>
                    <Icon id={cat} size={14} />
                  </span>
                  {o.description || <em className="muted">{tr("(sans description)", "(no description)")}</em>}
                  {o.optional && <span className="tag">{tr("optionnel", "optional")}</span>}
                  {o === current && <span className="tag">▶ {tr("en cours", "current")}</span>}
                </div>
                {!hasApiPosition(o) && LOOT_TYPES.has(o.type) && (
                  <div className="objective-note">{tr("L'API ne donne pas d'emplacement pour cet objet.", "The API gives no location for this item.")}</div>
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
                      {isSpawnList
                        ? tr(`emplacement${n > 1 ? "s" : ""} possible${n > 1 ? "s" : ""}`, `possible location${n > 1 ? "s" : ""}`)
                        : `point${n > 1 ? "s" : ""}`}
                    </button>
                  ))}
                  {!hasApiPosition(o) &&
                    (manual ? (
                      <>
                        <button className="chip" onClick={() => props.onFocus(manualPointKey(o.id), manual.mapId)}>
                          📍 {mapName(manual.mapId)}
                        </button>
                        <button className="chip" onClick={() => props.onStartPlacing(o)}>
                          {tr("Déplacer", "Move")}
                        </button>
                        <button
                          className="chip chip-danger"
                          onClick={() => dispatch({ type: "setManual", objectiveId: o.id, position: null })}
                        >
                          {tr("Retirer", "Remove")}
                        </button>
                      </>
                    ) : (
                      <button className="chip chip-accent" onClick={() => props.onStartPlacing(o)}>
                        📍 {tr("Placer sur la carte", "Place on the map")}
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
                    📜 {tr("quête", "quest")}
                  </button>
                  {task.wikiLink && (
                    <>
                      {" · "}
                      <button className="link" onClick={() => props.onPhotos(task.id)}>
                        {tr("photos", "photos")}
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
                title={tr("Objectifs faits / objectifs obligatoires", "Objectives done / required objectives")}
              >
                {progress.done}/{progress.total}
              </span>
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: "toggleTask", taskId })}
                aria-label={tr(`Retirer ${task.name}`, `Remove ${task.name}`)}
                title={tr("Retirer de la carte", "Remove from the map")}
              >
                ×
              </button>
            </div>
            <div className="progress-bar">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>

            {positioned.length === 0 && (
              <div className="objective-note">
                {tr("Aucune position connue pour cette quête : rien à afficher sur la carte (placez les objectifs à la main).", "No known position for this quest: nothing to show on the map (place objectives by hand).")}
              </div>
            )}
            {positioned.length > 0 && <ul className="objectives">{positioned.map(renderObjective)}</ul>}

            {unpositioned.length > 0 && (
              <>
                <div className="subhead">{tr(`Objectifs sans position (${unpositioned.length})`, `Objectives without position (${unpositioned.length})`)}</div>
                <ul className="objectives">{unpositioned.map(renderObjective)}</ul>
              </>
            )}
          </section>
        );
      })}

    </div>
  );
}
