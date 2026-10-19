// Aide de première visite : petite carte non bloquante en bas à gauche de la carte, 3 étapes.
import { useState } from "react";
import { tr } from "../lib/i18n";

const HELP_KEY = "tqp:help:v1";

/** Faut-il montrer l'aide à l'ouverture ? (non si l'utilisateur a choisi « Ne plus afficher ») */
export function helpWanted(): boolean {
  try {
    return localStorage.getItem(HELP_KEY) !== "hidden";
  } catch {
    return true;
  }
}

/** « Revoir l'aide » : oublie le choix « Ne plus afficher ». */
export function resetHelp() {
  try {
    localStorage.removeItem(HELP_KEY);
  } catch {
    // stockage indisponible : l'aide se réaffiche quand même via l'état de l'App
  }
}

const steps = () => [
  {
    title: tr("Ajoute tes quêtes", "Add your quests"),
    text: tr(
      "Onglet « Ajouter » : cherche une quête et clique dessus. Ou colle une capture du menu Tâches du jeu avec Ctrl+V.",
      "“Add” tab: search for a quest and click it. Or paste a screenshot of the in-game Tasks menu with Ctrl+V.",
    ),
  },
  {
    title: tr("Choisis ta map", "Pick your map"),
    text: tr(
      "Dans « Mes quêtes », clique sur une map (ex. « Douanes (3) ») : la carte affiche tes objectifs.",
      "In “My quests”, click a map (e.g. “Customs (3)”): the map shows your objectives.",
    ),
  },
  {
    title: tr("En fin de raid", "After the raid"),
    text: tr(
      "Coche les objectifs faits, puis « Terminer » sur la quête : l'app te propose les quêtes suivantes.",
      "Tick the objectives you did, then “Complete” on the quest: the app suggests the next quests.",
    ),
  },
];

export function FirstVisitHelp({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const list = steps();
  const last = step === list.length - 1;
  const hideForever = () => {
    try {
      localStorage.setItem(HELP_KEY, "hidden");
    } catch {
      // stockage indisponible : on referme seulement pour cette visite
    }
    onClose();
  };
  return (
    <div className="first-help" role="dialog" aria-labelledby="first-help-title">
      <div className="muted small">
        {step + 1}/{list.length}
      </div>
      <h2 id="first-help-title" className="first-help-title">
        {list[step].title}
      </h2>
      <p>{list[step].text}</p>
      <div className="btn-row">
        <button className="btn btn-small btn-primary" onClick={last ? hideForever : () => setStep(step + 1)}>
          {last ? tr("Compris", "Got it") : tr("Suivant", "Next")}
        </button>
        <button className="btn btn-small btn-ghost" onClick={onClose}>
          {tr("Passer", "Skip")}
        </button>
        <button className="btn btn-small btn-ghost" onClick={hideForever}>
          {tr("Ne plus afficher", "Don't show again")}
        </button>
      </div>
    </div>
  );
}
