// Une seule fois : l'ancien code des rooms (v1) avait fusionné les quêtes du groupe avec les tiennes et gardé
// une sauvegarde de ton état d'avant (`tqp:beforeRoom:<mode>`). On propose de la restaurer, puis on la supprime.
import { useState, type Dispatch } from "react";
import type { GameMode } from "../types";
import { GAME_MODES } from "../types";
import { tr } from "../lib/i18n";
import { LEGACY_BACKUP_PREFIX, restoreFromBackup } from "../lib/roomSync";
import type { Action, AppState } from "../state/store";

/** Modes pour lesquels une ancienne sauvegarde existe. */
function legacyModes(): GameMode[] {
  try {
    return GAME_MODES.map((m) => m.id).filter((id) => localStorage.getItem(LEGACY_BACKUP_PREFIX + id) !== null);
  } catch {
    return [];
  }
}

export function LegacyRoomPrompt({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [modes, setModes] = useState(legacyModes);
  const mode = modes[0];
  if (!mode) return null;

  // la clé n'est supprimée qu'après la réponse
  const answer = (restore: boolean) => {
    try {
      if (restore) {
        const next = restoreFromBackup(state, mode, JSON.parse(localStorage.getItem(LEGACY_BACKUP_PREFIX + mode) ?? "null"));
        if (next !== state) dispatch({ type: "import", state: next });
      }
    } catch {
      /* sauvegarde illisible : on garde l'état actuel */
    }
    try {
      localStorage.removeItem(LEGACY_BACKUP_PREFIX + mode);
    } catch {
      /* rien */
    }
    setModes((m) => m.slice(1));
  };

  const label = GAME_MODES.find((m) => m.id === mode)?.label;
  return (
    <div className="alert" role="status">
      {tr("Une ancienne room avait mélangé tes quêtes. Restaurer ton état d'avant la room ?", "An old room had mixed up your quests. Restore your state from before the room?")}
      {label ? ` (${label})` : ""}{" "}
      <button className="link" onClick={() => answer(true)}>
        {tr("Oui", "Yes")}
      </button>{" "}
      <button className="link" onClick={() => answer(false)}>
        {tr("Non", "No")}
      </button>
    </div>
  );
}
