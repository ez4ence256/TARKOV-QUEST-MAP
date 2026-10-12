// Contenu des popups de la carte.
import { useState } from "react";
import type { Objective, Task } from "../types";
import type { CustomPoint } from "../state/store";
import { CUSTOM_ICONS, ICON_LABELS, categoryOf } from "../lib/objectiveTypes";
import { Icon } from "./Icon";
import { tr } from "../lib/i18n";

interface ObjectivePopupProps {
  task: Task;
  objective: Objective;
  color: string;
  mapName: string;
  note: string;
  done: boolean;
  manual: boolean;
  /** Emplacement possible d'un objet de quête (numéro / total). */
  spawn?: { index: number; count: number };
  /** Ouvre la galerie de photos du wiki pour cette quête. */
  onPhotos?: () => void;
  /** Ouvre l'onglet Quête (tous les objectifs, à cocher). */
  onQuest?: () => void;
  /** Étage du point, sur les maps qui en ont. */
  levelLabel?: string;
  /** D'où vient l'étage quand il est écrit dans le texte. */
  levelSource?: string;
  /** Présent quand le point est sur un autre étage que celui affiché. */
  onShowLevel?: () => void;
  onNote: (note: string) => void;
  onDone: (done: boolean) => void;
  onRemoveManual?: () => void;
}

export function ObjectivePopup(p: ObjectivePopupProps) {
  const category = categoryOf(p.objective.type);
  return (
    <div className="popup">
      <div className="popup-task" style={{ color: p.color }}>
        {p.task.name}
      </div>
      <div className="popup-type">
        <Icon id={category} /> {ICON_LABELS[category]}
        {p.objective.optional && <span className="tag">{tr("optionnel", "optional")}</span>}
        {p.manual && <span className="tag">{tr("placé à la main", "placed by hand")}</span>}
      </div>
      <p className="popup-desc">{p.objective.description}</p>
      {p.spawn && (
        <div className="popup-spawn">
          {tr("Emplacement possible", "Possible location")} <strong>{p.spawn.index}</strong> {tr("sur", "of")} {p.spawn.count}
        </div>
      )}
      {p.levelLabel && (
        <div className="popup-level">
          {tr("Étage : ", "Floor: ")}<strong>{p.levelLabel}</strong>
          {p.levelSource && <span className="muted"> ({p.levelSource})</span>}
          {p.onShowLevel && (
            <button className="btn btn-ghost btn-small" onClick={p.onShowLevel}>
              {tr("Afficher cet étage", "Show this floor")}
            </button>
          )}
        </div>
      )}
      <label className="field">
        <span>{tr("Mes notes", "My notes")}</span>
        <textarea
          rows={3}
          value={p.note}
          placeholder={tr("Ex. : clé nécessaire, passer par l'arrière…", "E.g. key needed, go around the back…")}
          onChange={(e) => p.onNote(e.target.value)}
        />
      </label>
      <div className="popup-actions">
        {p.done ? (
          <button className="btn" onClick={() => p.onDone(false)}>
            {tr("↩ Annuler « Fait »", "↩ Undo “Done”")}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => p.onDone(true)}>
            {tr("✓ Fait", "✓ Done")}
          </button>
        )}
        {p.onQuest && (
          <button className="btn btn-ghost" onClick={p.onQuest}>
            {tr("📜 Quête", "📜 Quest")}
          </button>
        )}
        {p.onPhotos && (
          <button className="btn btn-ghost" onClick={p.onPhotos}>
            {tr("📷 Photos", "📷 Photos")}
          </button>
        )}
        {p.manual && p.onRemoveManual && (
          <button className="btn btn-ghost" onClick={p.onRemoveManual}>
            {tr("Retirer le point", "Remove point")}
          </button>
        )}
      </div>
      <div className="popup-foot">{p.mapName}</div>
    </div>
  );
}

interface CustomPopupProps {
  point: CustomPoint;
  onChange: (patch: Partial<CustomPoint>) => void;
  onRemove: () => void;
}

export function CustomPopup({ point, onChange, onRemove }: CustomPopupProps) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="popup">
      <label className="field">
        <span>{tr("Nom du point", "Point name")}</span>
        <input
          value={point.label}
          placeholder={tr("Point perso", "Custom point")}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="field">
        <span>{tr("Icône", "Icon")}</span>
        <div className="icon-grid">
          {CUSTOM_ICONS.map((id) => (
            <button
              key={id}
              className={`icon-choice ${point.icon === id ? "is-active" : ""}`}
              title={ICON_LABELS[id]}
              aria-label={ICON_LABELS[id]}
              onClick={() => onChange({ icon: id })}
            >
              <Icon id={id} />
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{tr("Note", "Note")}</span>
        <textarea rows={3} value={point.note} onChange={(e) => onChange({ note: e.target.value })} />
      </label>
      <div className="popup-actions">
        {confirm ? (
          <>
            <button className="btn btn-danger" onClick={onRemove}>
              {tr("Confirmer la suppression", "Confirm deletion")}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              {tr("Non", "No")}
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
            {tr("Supprimer", "Delete")}
          </button>
        )}
      </div>
      <div className="popup-foot">{tr("Astuce : faites glisser le point pour le déplacer.", "Tip: drag the point to move it.")}</div>
    </div>
  );
}
