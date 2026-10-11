// Réglages > « Réinitialiser la progression » : par quête ou tout le mode courant.
// Seuls les objectifs cochés sont remis à zéro : notes, points perso et autres modes restent.
import { useState } from "react";
import type { Task } from "../types";
import { orphanDoneCount, taskProgress, tasksWithProgress } from "../lib/points";
import { tr } from "../lib/i18n";
import { ConfirmButton } from "./ConfirmButton";

interface Props {
  tasks: Task[];
  done: Record<string, number>;
  /** Nombre d'étapes cochées de la Main story (comprises dans « Tout réinitialiser »). */
  storyDone: number;
  /** Nom du mode courant (PvP, PvE, PvP Saison). */
  modeLabel: string;
  onResetTask: (task: Task) => void;
  onResetAll: () => void;
  onExport: () => void;
}

export function ResetProgressSection({ tasks, done, storyDone, modeLabel, onResetTask, onResetAll, onExport }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const withProgress = tasksWithProgress(tasks, done);
  const orphans = orphanDoneCount(tasks, done);
  const total = Object.keys(done).length + storyDone;

  return (
    <section>
      <div className="subhead">{tr(`Réinitialiser la progression (${modeLabel})`, `Reset progress (${modeLabel})`)}</div>
      <p className="muted small">
        {tr(
          "Remet les objectifs (et les étapes de la Main story) à « pas fait » : les points des objectifs réapparaissent sur la carte. Vos notes, vos points personnels et vos chapitres choisis sont conservés. Les autres modes de jeu ne sont pas touchés.",
          "Sets objectives (and Main story steps) back to \"not done\": the objective points reappear on the map. Your notes, custom points and chosen chapters are kept. Other game modes are not affected.",
        )}
      </p>

      {total === 0 ? (
        <p className="muted small">{tr("Aucun objectif ni étape de la Main story coché dans ce mode.", "No checked objective or Main story step in this mode.")}</p>
      ) : (
        <>
          <ul className="reset-list">
            {withProgress.map((task) => {
              const p = taskProgress(task, done);
              const checked = task.objectives.filter((o) => done[o.id]).length;
              return (
                <li key={task.id} className="reset-row">
                  <span className="reset-name">
                    {task.name}
                    <span className="muted small"> · {p.done}/{p.total}</span>
                  </span>
                  <ConfirmButton
                    label={tr("Réinitialiser", "Reset")}
                    question={tr(`Décocher ${checked} objectif${checked > 1 ? "s" : ""} ?`, `Uncheck ${checked} objective${checked > 1 ? "s" : ""}?`)}
                    confirmLabel={tr("Oui", "Yes")}
                    onConfirm={() => onResetTask(task)}
                  />
                </li>
              );
            })}
          </ul>
          {storyDone > 0 && (
            <p className="muted small">
              {tr(
                `+ ${storyDone} étape${storyDone > 1 ? "s" : ""} cochée${storyDone > 1 ? "s" : ""} de la Main story (se réinitialise par chapitre dans l'onglet Fiche quête, ou ici avec « Tout réinitialiser »).`,
                `+ ${storyDone} checked Main story step${storyDone > 1 ? "s" : ""} (reset per chapter in the Quest tab, or here with "Reset all").`,
              )}
            </p>
          )}
          {orphans > 0 && (
            <p className="muted small">
              {tr(
                `+ ${orphans} objectif${orphans > 1 ? "s" : ""} coché${orphans > 1 ? "s" : ""} de quêtes absentes des données actuelles (compris dans « Tout réinitialiser »).`,
                `+ ${orphans} checked objective${orphans > 1 ? "s" : ""} from quests missing in the current data (included in "Reset all").`,
              )}
            </p>
          )}

          {!confirmAll ? (
            <button className="btn btn-small btn-danger-outline" onClick={() => setConfirmAll(true)}>
              {tr(`Tout réinitialiser (${modeLabel})`, `Reset all (${modeLabel})`)}
            </button>
          ) : (
            <div className="danger-box" role="alertdialog" aria-label={tr("Confirmer la réinitialisation complète", "Confirm full reset")}>
              <p>
                <strong>
                  {tr(`Décocher les ${total} objectifs et étapes faits en ${modeLabel} ?`, `Uncheck the ${total} completed objectives and steps in ${modeLabel}?`)}
                </strong>{" "}
                {tr("Cette action ne peut pas être annulée.", "This action cannot be undone.")}
              </p>
              <p className="small">
                {tr(
                  "Conseil : faites d'abord une sauvegarde avec l'export JSON. Vous pourrez la réimporter si besoin.",
                  "Tip: make a backup with the JSON export first. You can re-import it if needed.",
                )}
              </p>
              <div className="btn-row">
                <button className="btn btn-small" onClick={onExport}>
                  {tr("Exporter d'abord (JSON)", "Export first (JSON)")}
                </button>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    onResetAll();
                    setConfirmAll(false);
                  }}
                >
                  {tr("Oui, tout réinitialiser", "Yes, reset all")}
                </button>
                <button className="btn btn-small" onClick={() => setConfirmAll(false)}>
                  {tr("Annuler", "Cancel")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
