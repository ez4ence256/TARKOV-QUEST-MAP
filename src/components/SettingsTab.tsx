// Onglet "Réglages" : mode de jeu, données, affichage, sauvegarde.
import { useRef, useState, type ReactNode } from "react";
import { GAME_MODES, type GameMode, type TarkovData } from "../types";
import { ICON_LABELS, type IconId } from "../lib/objectiveTypes";
import { readImportFile, type AppState } from "../state/store";
import { getLang, tr } from "../lib/i18n";
import { exitPinHtml } from "../map/exitIcons";
import { EXIT_KIND_LABELS, type ExitIconKind } from "../lib/exits";
import { Icon } from "./Icon";
import { version } from "../../package.json";

interface Props {
  gameMode: GameMode;
  data: TarkovData | null;
  dataSource: string;
  showDone: boolean;
  onShowDone: (v: boolean) => void;
  oneAtATime: boolean;
  onOneAtATime: (v: boolean) => void;
  onChangeMode: () => void;
  onShowHelp: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onImport: (state: AppState) => void;
  /** Section « Réinitialiser la progression » (voir ResetProgressSection). */
  resetSection: ReactNode;
}

const LEGEND: IconId[] = ["mark", "visit", "search", "item", "plant", "other"];

// getter : la langue est lue au rendu
const exitLegend = (): [ExitIconKind, string][] => [
  ["pmc", tr("Sortie PMC", "PMC exit")],
  ["scav", tr("Sortie Scav", "Scav exit")],
  ["shared", tr("Sortie PMC + Scav", "PMC + Scav exit")],
  ["extract", tr("Sortie sans faction précisée", "Exit, faction not specified")],
  ["coop", EXIT_KIND_LABELS.coop],
  ["transit", EXIT_KIND_LABELS.transit],
];

export function SettingsTab(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const state = await readImportFile(file);
      if (!window.confirm(tr("Remplacer toute votre progression actuelle par celle du fichier ?", "Replace all your current progress with the file's content?"))) return;
      p.onImport(state);
      setMessage(tr("Sauvegarde importée.", "Backup imported."));
    } catch (error) {
      setMessage(tr(`Import impossible : ${(error as Error).message}`, `Import failed: ${(error as Error).message}`));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="tab-body settings">
      <section>
        <div className="subhead">{tr("Mode de jeu", "Game mode")}</div>
        <div className="row-between">
          <span>{GAME_MODES.find((m) => m.id === p.gameMode)?.label}</span>
          <button className="btn btn-small" onClick={p.onChangeMode}>
            {tr("Changer", "Change")}
          </button>
        </div>
        <p className="muted small">{tr("Chaque mode a sa propre progression, ses notes et ses points.", "Each mode has its own progress, notes and points.")}</p>
        <p className="muted small">Version {version}</p>
        <button className="btn btn-small" onClick={p.onShowHelp}>
          {tr("Revoir l'aide", "Show the help again")}
        </button>
      </section>

      <section>
        <div className="subhead">{tr("Données tarkov.dev", "tarkov.dev data")}</div>
        {p.data && (
          <p className="small">
            {p.data.tasks.length} {tr("quêtes", "quests")} · {p.data.maps.length} maps
            <br />
            {tr("Mises à jour le", "Updated")} {new Date(p.data.fetchedAt).toLocaleString(getLang() === "en" ? "en-US" : "fr-FR")}
            <br />
            <span className="muted">{p.dataSource}</span>
          </p>
        )}
        <button className="btn btn-small" onClick={p.onRefresh}>
          {tr("Recharger depuis l'API", "Reload from the API")}
        </button>
      </section>

      <section>
        <div className="subhead">{tr("Affichage", "Display")}</div>
        <label className="check">
          <input type="checkbox" checked={p.showDone} onChange={(e) => p.onShowDone(e.target.checked)} />
          {tr("Afficher les objectifs faits (grisés) sur la carte", "Show completed objectives (greyed out) on the map")}
        </label>
        <label className="check">
          <input type="checkbox" checked={p.oneAtATime} onChange={(e) => p.onOneAtATime(e.target.checked)} />
          {tr(
            "Un raid à la fois : tous les objectifs de la map en cours, les autres maps ensuite",
            "One raid at a time: every objective on the current map, other maps afterwards",
          )}
        </label>
        <ul className="legend">
          {LEGEND.map((id) => (
            <li key={id}>
              <Icon id={id} /> {ICON_LABELS[id]}
            </li>
          ))}
        </ul>
        <ul className="legend">
          {exitLegend().map(([kind, label]) => (
            <li key={kind}>
              <span dangerouslySetInnerHTML={{ __html: exitPinHtml(kind) }} /> {label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="subhead">{tr("Sauvegarde", "Backup")}</div>
        <p className="muted small">
          {tr(
            "Tout est enregistré automatiquement dans ce navigateur. Exportez un fichier pour garder une copie ou changer d'appareil.",
            "Everything is saved automatically in this browser. Export a file to keep a copy or switch devices.",
          )}
        </p>
        <div className="btn-row">
          <button className="btn btn-small" onClick={p.onExport}>
            {tr("Exporter (JSON)", "Export (JSON)")}
          </button>
          <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
            {tr("Importer…", "Import…")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        {message && <p className="small">{message}</p>}
      </section>

      {p.resetSection}

      <section>
        <div className="subhead">{tr("Crédits", "Credits")}</div>
        <p className="muted small">
          {tr("Données", "Data")}: <a href="https://tarkov.dev" target="_blank" rel="noreferrer">tarkov.dev</a>. {tr("Cartes", "Maps")}:{" "}
          <a href="https://github.com/the-hideout/tarkov-dev-svg-maps" target="_blank" rel="noreferrer">
            tarkov-dev-svg-maps
          </a>{" "}
          (CC BY-NC-SA 4.0).{" "}
          {tr("Icônes", "Icons")}: <a href="https://lucide.dev" target="_blank" rel="noreferrer">Lucide</a> ({tr("licence ISC", "ISC license")}). {tr("Polices", "Fonts")}: <a href="https://fonts.google.com/specimen/Barlow" target="_blank" rel="noreferrer">Barlow</a> {tr("et", "and")} Barlow Condensed ({tr("licence OFL", "OFL license")}).{" "}
          {tr(
            "Escape from Tarkov est une marque de Battlestate Games ; ce projet n'y est pas affilié.",
            "Escape from Tarkov is a trademark of Battlestate Games; this project is not affiliated with it.",
          )}
        </p>
      </section>
    </div>
  );
}
