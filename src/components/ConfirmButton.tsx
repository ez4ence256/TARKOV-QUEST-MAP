// Bouton à confirmation en deux temps (pas de boîte de dialogue du navigateur) :
// un premier clic affiche la question, un second confirme.
import { useState, type ReactNode } from "react";
import { tr } from "../lib/i18n";
import { inRoom } from "../api/room";

interface Props {
  label: ReactNode;
  /** Question affichée avant de confirmer. */
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}

export function ConfirmButton({ label, question, confirmLabel, onConfirm, className = "btn btn-small" }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group">
      <span className="confirm-question">
        {question}
        {inRoom() && ` ${tr("Dans une room, cela s'applique à tout le monde.", "In a room, this applies to everyone.")}`}
      </span>
      <button
        className="btn btn-small btn-danger"
        onClick={() => {
          onConfirm();
          setAsking(false);
        }}
      >
        {confirmLabel}
      </button>
      <button className="btn btn-small" onClick={() => setAsking(false)}>
        {tr("Annuler", "Cancel")}
      </button>
    </span>
  );
}
