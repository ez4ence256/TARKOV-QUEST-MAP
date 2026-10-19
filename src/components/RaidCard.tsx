// Mode raid : carte flottante avec les objectifs des quêtes sélectionnées sur la map affichée.
import { useState } from "react";
import type { MapPoint, Objective, Task } from "../types";
import type { StoryMapPoint } from "../lib/storyPoints";
import { tr } from "../lib/i18n";
import { UiIcon } from "./UiIcon";

interface Props {
  mapName: string;
  /** Les mêmes points que ceux de la carte (objectifs « un à la fois » compris). */
  points: MapPoint[];
  tasksById: Map<string, Task>;
  objectivesById: Map<string, Objective>;
  colorOf: (taskId: string) => string;
  done: Record<string, number>;
  onSetDone: (objectiveId: string, done: boolean) => void;
  storyPoints: StoryMapPoint[];
  storyName: (chapter: string) => string;
  onStoryDone: (chapter: string, stepKey: string) => void;
  onQuit: () => void;
}

export function RaidCard(p: Props) {
  const [collapsed, setCollapsed] = useState(false);
  // objectifs cochés depuis la carte : ils restent affichés (décochables) jusqu'au changement de map
  const [kept, setKept] = useState<{ taskId: string; objectiveId: string }[]>([]);

  const pairs = new Map<string, string>(); // objectiveId -> taskId
  for (const pt of p.points) if (pt.objectiveId && pt.taskId) pairs.set(pt.objectiveId, pt.taskId);
  for (const k of kept) pairs.set(k.objectiveId, k.taskId);
  const byTask = new Map<string, Objective[]>();
  for (const [objectiveId, taskId] of pairs) {
    const o = p.objectivesById.get(objectiveId);
    if (o) byTask.set(taskId, [...(byTask.get(taskId) ?? []), o]);
  }
  const story = [...new Map(p.storyPoints.map((s) => [`${s.chapter}|${s.stepKey}`, s])).values()];
  const empty = byTask.size === 0 && story.length === 0;

  const toggle = (taskId: string, o: Objective, value: boolean) => {
    if (value) setKept((k) => (k.some((x) => x.objectiveId === o.id) ? k : [...k, { taskId, objectiveId: o.id }]));
    p.onSetDone(o.id, value);
  };

  return (
    <section className="raid-card" aria-label={tr("Mode raid", "Raid mode")}>
      <header className="raid-head">
        <h2 className="raid-title">
          {tr("Mode raid", "Raid mode")} · {p.mapName}
        </h2>
        <button className="btn btn-small" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? tr("Déplier", "Expand") : tr("Replier", "Collapse")} title={collapsed ? tr("Déplier", "Expand") : tr("Replier", "Collapse")}>
          <UiIcon id={collapsed ? "chevron-right" : "chevron-down"} />
        </button>
        <button className="btn btn-small" onClick={p.onQuit}>
          {tr("Quitter", "Quit")}
        </button>
      </header>
      {!collapsed && (
        <div className="raid-body">
          {empty && <p className="muted">{tr("Aucun objectif sur cette map pour tes quêtes.", "No objective on this map for your quests.")}</p>}
          {[...byTask].map(([taskId, objectives]) => (
            <div key={taskId} className="raid-group">
              <div className="raid-quest">
                <span className="raid-dot" style={{ background: p.colorOf(taskId) }} aria-hidden="true" />
                {p.tasksById.get(taskId)?.name}
              </div>
              {objectives.map((o) => (
                <label key={o.id} className={`raid-line${p.done[o.id] ? " is-done" : ""}`}>
                  <input type="checkbox" checked={Boolean(p.done[o.id])} onChange={(e) => toggle(taskId, o, e.target.checked)} />
                  <span>{o.description || tr("(sans description)", "(no description)")}</span>
                </label>
              ))}
            </div>
          ))}
          {story.length > 0 && (
            <div className="raid-group">
              <div className="raid-quest">Main story</div>
              {story.map((s) => (
                <label key={`${s.chapter}|${s.stepKey}`} className="raid-line">
                  <input type="checkbox" checked={false} onChange={() => p.onStoryDone(s.chapter, s.stepKey)} />
                  <span>
                    {p.storyName(s.chapter)} - {s.stepTitle}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
