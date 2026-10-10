// Écran d'accueil : choix du mode de jeu à chaque ouverture de l'app.
import { GAME_MODES, type GameMode } from "../types";

export function ModePicker({ last, onPick }: { last: GameMode | null; onPick: (m: GameMode) => void }) {
  return (
    <div className="mode-picker">
      <div className="mode-card">
        <h1>Tarkov Quest Planner</h1>
        <p className="muted">Choisissez votre mode de jeu</p>
        <div className="mode-options">
          {GAME_MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-option ${m.id === last ? "is-last" : ""}`}
              onClick={() => onPick(m.id)}
              autoFocus={m.id === last}
            >
              <span className="mode-label">{m.label}</span>
              <span className="muted small">{m.hint}</span>
              {m.id === last && <span className="tag">dernier utilisé</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
