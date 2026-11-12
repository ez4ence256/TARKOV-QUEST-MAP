// Guide pas à pas pour débloquer Lightkeeper (fenêtre Marchands) : les quêtes à faire avant, puis les siennes,
// dans l'ordre. Cocher = « Quête terminée » (même action que partout : carte, Mes quêtes et compteur suivent).
import { useMemo } from "react";
import type { Task, Trader } from "../types";
import { plural, tr } from "../lib/i18n";
import { LIGHTKEEPER_SERVICES, lightkeeperSteps } from "../lib/lightkeeper";
import { computeNeeds } from "../lib/itemNeeds";
import { isGreyed } from "../lib/questChain";
import { iconSrc } from "../lib/itemIcons";
import { ItemThumb } from "./ItemThumb";
import { ObjectiveItems } from "./ObjectiveItems";

interface Props {
  tasks: Task[];
  traders: Trader[];
  done: Record<string, number>;
  failed: Record<string, true>;
  selectedIds: string[];
  itemIcons: Record<string, string>;
  itemNames: Record<string, string>;
  lang: string;
  onComplete: (task: Task) => void;
  onReset: (task: Task) => void;
  onOpenQuest: (taskId: string) => void;
  onAddQuest: (taskId: string) => void;
}

export function LightkeeperGuide(p: Props) {
  const { before, own } = useMemo(() => lightkeeperSteps(p.tasks), [p.tasks]);
  const all = useMemo(() => [...before, ...own], [before, own]);
  const finishedIds = new Set(all.filter((t) => isGreyed(t, p.done, p.failed)).map((t) => t.id));
  const inGuide = new Set(all.map((t) => t.id));
  const available = (t: Task) => !finishedIds.has(t.id) && (t.details?.taskRequirements ?? []).every((r) => !inGuide.has(r.taskId) || finishedIds.has(r.taskId));
  const needs = useMemo(() => [...computeNeeds({ tasks: all, done: p.done, failed: p.failed })].filter(([, n]) => n.count > 0), [all, p.done, p.failed]);
  const traderName = (id: string) => p.traders.find((t) => t.id === id)?.name ?? "";
  let n = 0;

  const group = (title: string, list: Task[]) => (
    <section aria-label={title}>
      <h3 className="lk-group">{title}</h3>
      <ol className="lk-steps">
        {list.map((t) => {
          const isDone = finishedIds.has(t.id);
          const now = available(t);
          const service = LIGHTKEEPER_SERVICES[t.nameEn];
          const step = ++n;
          return (
            <li key={t.id} className={`lk-step${isDone ? " is-done" : now ? " is-now" : ""}`}>
              <details>
                <summary className="lk-summary">
                  <input
                    type="checkbox"
                    className="lk-check"
                    checked={isDone}
                    aria-label={tr(`Terminée : ${t.name}`, `Done: ${t.name}`)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => (isDone ? p.onReset(t) : p.onComplete(t))}
                  />
                  <span className="lk-num">{step}.</span>
                  <span className="lk-main">
                    <strong>{t.name}</strong>
                    <span className="muted">{[traderName(t.traderId), t.minPlayerLevel ? tr(`niv. ${t.minPlayerLevel}`, `level ${t.minPlayerLevel}`) : ""].filter(Boolean).join(" · ")}</span>
                    {service && (
                      <span className="lk-unlock">
                        {tr("Débloque : ", "Unlocks: ")}
                        {tr(service.fr, service.en)}
                      </span>
                    )}
                  </span>
                  {now && <span className="chip lk-now">{tr("À faire maintenant", "Do this now")}</span>}
                </summary>
                <div className="lk-detail">
                  {t.objectives.length === 0 ? (
                    <p className="muted">{tr("Pas d'objectif détaillé : voir la fiche.", "No detailed objective: see the quest sheet.")}</p>
                  ) : (
                    <ul className="lk-objectives">
                      {t.objectives.map((o) => (
                        <li key={o.id}>
                          {o.description}
                          {o.optional ? ` (${tr("facultatif", "optional")})` : ""}
                          <ObjectiveItems objective={o} itemIcons={p.itemIcons} itemNames={p.itemNames} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="lk-actions">
                    <button className="btn btn-small" onClick={() => p.onOpenQuest(t.id)}>
                      {tr("Ouvrir la fiche", "Open quest sheet")}
                    </button>
                    {!p.selectedIds.includes(t.id) && !isDone && (
                      <button className="btn btn-small" onClick={() => p.onAddQuest(t.id)}>
                        {tr("Ajouter à mes quêtes", "Add to my quests")}
                      </button>
                    )}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className="lk-guide">
      <p className="lk-intro">
        {tr(
          "Lightkeeper est sur Lighthouse, dans une zone fermée. Pour l'atteindre il faut l'émetteur radio DSP encodé, obtenu par l'histoire.",
          "Lightkeeper is on Lighthouse, in a locked area. Reaching him needs the encoded DSP radio transmitter, obtained through the story.",
        )}{" "}
        {tr(
          "D'après le wiki, cette chaîne commence par « To the Light - Trust but Verify ».",
          'According to the wiki, that questline starts with "To the Light - Trust but Verify".',
        )}
      </p>
      {all.length === 0 ? (
        <p className="muted finder-empty">{tr("Aucune quête de Lightkeeper dans ce mode de jeu.", "No Lightkeeper quest in this game mode.")}</p>
      ) : (
        <>
          <p className="lk-progress" role="status">
            <strong>{tr(`${finishedIds.size} / ${all.length} terminée${plural(finishedIds.size)}`, `${finishedIds.size} / ${all.length} done`)}</strong>
          </p>
          {needs.length > 0 && (
            <div className="lk-needs">
              <strong>{tr("À prévoir", "To bring")}</strong>
              <ul>
                {needs.map(([id, need]) => (
                  <li key={id}>
                    <ItemThumb src={iconSrc(id, p.itemIcons)} name="" size={24} />
                    <span>
                      {p.itemNames[id] ?? id} ×{need.count.toLocaleString(p.lang)}
                    </span>
                    {need.firCount > 0 && <span className="finder-pill fir">{need.firCount < need.count ? `FIR ${need.firCount}` : "FIR"}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {before.length > 0 && group(tr("Avant Lightkeeper", "Before Lightkeeper"), before)}
          {own.length > 0 && group(tr("Quêtes de Lightkeeper", "Lightkeeper's quests"), own)}
        </>
      )}
    </div>
  );
}
