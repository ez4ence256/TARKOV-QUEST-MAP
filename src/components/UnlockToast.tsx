// Petite fenêtre en haut à droite quand une quête vient d'être terminée : propose d'activer les quêtes
// qu'elle débloque (Gunsmith - Partie 2 -> Partie 3…). Oui = elles rejoignent la sélection ; Non = fermée.
import type { Task } from "../types";
import { tr } from "../lib/i18n";

export function UnlockToast({ done, next, onYes, onNo }: { done: Task; next: Task[]; onYes: () => void; onNo: () => void }) {
  return (
    <div className="unlock-toast" role="alertdialog" aria-live="polite" aria-label={tr("Quête suivante", "Next quest")}>
      <p className="unlock-title">
        ✓ {tr(`« ${done.name} » terminée.`, `"${done.name}" completed.`)}
      </p>
      <p>
        {tr("Elle débloque :", "It unlocks:")}{" "}
        <strong>{next.map((t) => t.name).join(", ")}</strong>
      </p>
      <p className="muted small">{next.length === 1 ? tr("L'activer ?", "Activate it?") : tr("Les activer ?", "Activate them?")}</p>
      <div className="btn-row">
        <button className="btn btn-small btn-primary" onClick={onYes}>
          {tr("Oui", "Yes")}
        </button>
        <button className="btn btn-small" onClick={onNo}>
          {tr("Non", "No")}
        </button>
      </div>
    </div>
  );
}
