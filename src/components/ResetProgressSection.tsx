// Réglages > « Réinitialiser la progression » : par quête ou tout le mode courant.
// Seuls les objectifs cochés sont remis à zéro : notes, points perso et autres modes restent.
import { useState } from "react";
import type { Task } from "../types";
import { orphanDoneCount, taskProgress, tasksWithProgress } from "../lib/points";
import { ConfirmButton } from "./ConfirmButton";

interface Props {
  tasks: Task[];
  done: Record<string, number>;
  /** Nom du mode courant (PvP, PvE, PvP Saison). */
  modeLabel: string;
  onResetTask: (task: Task) => void;
  onResetAll: () => void;
  onExport: () => void;
}

export function ResetProgressSection({ tasks, done, modeLabel, onResetTask, onResetAll, onExport }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const withProgress = tasksWithProgress(tasks, done);
  const orphans = orphanDoneCount(tasks, done);
  const total = Object.keys(done).length;

  return (
    <section>
      <div className="subhead">Réinitialiser la progression ({modeLabel})</div>
      <p className="muted small">
        Remet les objectifs à « pas fait » : leurs points réapparaissent sur la carte. Vos notes et vos points
        personnels sont conservés. Les autres modes de jeu ne sont pas touchés.
      </p>

      {total === 0 ? (
        <p className="muted small">Aucun objectif coché dans ce mode.</p>
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
                    label="Réinitialiser"
                    question={`Décocher ${checked} objectif${checked > 1 ? "s" : ""} ?`}
                    confirmLabel="Oui"
                    onConfirm={() => onResetTask(task)}
                  />
                </li>
              );
            })}
          </ul>
          {orphans > 0 && (
            <p className="muted small">
              + {orphans} objectif{orphans > 1 ? "s" : ""} coché{orphans > 1 ? "s" : ""} de quêtes absentes des
              données actuelles (compris dans « Tout réinitialiser »).
            </p>
          )}

          {!confirmAll ? (
            <button className="btn btn-small btn-danger-outline" onClick={() => setConfirmAll(true)}>
              Tout réinitialiser ({modeLabel})
            </button>
          ) : (
            <div className="danger-box" role="alertdialog" aria-label="Confirmer la réinitialisation complète">
              <p>
                <strong>
                  Décocher les {total} objectifs faits en {modeLabel} ?
                </strong>{" "}
                Cette action ne peut pas être annulée.
              </p>
              <p className="small">
                Conseil : faites d'abord une sauvegarde avec l'export JSON. Vous pourrez la réimporter si besoin.
              </p>
              <div className="btn-row">
                <button className="btn btn-small" onClick={onExport}>
                  Exporter d'abord (JSON)
                </button>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    onResetAll();
                    setConfirmAll(false);
                  }}
                >
                  Oui, tout réinitialiser
                </button>
                <button className="btn btn-small" onClick={() => setConfirmAll(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
