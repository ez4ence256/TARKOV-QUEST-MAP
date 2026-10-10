// Contenu des popups de la carte.
import { useState } from "react";
import type { Objective, Task } from "../types";
import type { CustomPoint } from "../state/store";
import { CUSTOM_ICONS, ICON_LABELS, categoryOf } from "../lib/objectiveTypes";
import { Icon } from "./Icon";

interface ObjectivePopupProps {
  task: Task;
  objective: Objective;
  color: string;
  mapName: string;
  note: string;
  done: boolean;
  manual: boolean;
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
        {p.objective.optional && <span className="tag">optionnel</span>}
        {p.manual && <span className="tag">placé à la main</span>}
      </div>
      <p className="popup-desc">{p.objective.description}</p>
      <label className="field">
        <span>Mes notes</span>
        <textarea
          rows={3}
          value={p.note}
          placeholder="Ex. : clé nécessaire, passer par l'arrière…"
          onChange={(e) => p.onNote(e.target.value)}
        />
      </label>
      <div className="popup-actions">
        {p.done ? (
          <button className="btn" onClick={() => p.onDone(false)}>
            ↩ Annuler « Fait »
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => p.onDone(true)}>
            ✓ Fait
          </button>
        )}
        {p.manual && p.onRemoveManual && (
          <button className="btn btn-ghost" onClick={p.onRemoveManual}>
            Retirer le point
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
        <span>Nom du point</span>
        <input
          value={point.label}
          placeholder="Point perso"
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="field">
        <span>Icône</span>
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
        <span>Note</span>
        <textarea rows={3} value={point.note} onChange={(e) => onChange({ note: e.target.value })} />
      </label>
      <div className="popup-actions">
        {confirm ? (
          <>
            <button className="btn btn-danger" onClick={onRemove}>
              Confirmer la suppression
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Non
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
            Supprimer
          </button>
        )}
      </div>
      <div className="popup-foot">Astuce : faites glisser le point pour le déplacer.</div>
    </div>
  );
}
