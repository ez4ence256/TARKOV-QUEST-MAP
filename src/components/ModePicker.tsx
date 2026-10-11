// Écran d'accueil : choix du mode de jeu à chaque ouverture de l'app.
import { GAME_MODES, type GameMode } from "../types";
import { tr, type Lang } from "../lib/i18n";
// version affichée en bas à droite : à augmenter à chaque livraison (voir JOURNAL.md)
import { version } from "../../package.json";

export function ModePicker({
  last,
  onPick,
  lang,
  onLang,
}: {
  last: GameMode | null;
  onPick: (m: GameMode) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  return (
    <div className="mode-picker">
      <div className="mode-card">
        <select
          className="input lang-select"
          value={lang}
          onChange={(e) => onLang(e.target.value === "en" ? "en" : "fr")}
          aria-label={tr("Langue", "Language")}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
        <h1>Tarkov Quest Planner</h1>
        <p className="muted">{tr("Choisissez votre mode de jeu", "Choose your game mode")}</p>
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
              {m.id === last && <span className="tag">{tr("dernier utilisé", "last used")}</span>}
            </button>
          ))}
        </div>
      </div>
      <span className="app-version muted small">v{version}</span>
    </div>
  );
}
