// Onglet "Réglages" : mode de jeu, données, affichage, sauvegarde.
import { useRef, useState } from "react";
import { GAME_MODES, type GameMode, type TarkovData } from "../types";
import { ICON_LABELS, type IconId } from "../lib/objectiveTypes";
import { readImportFile, type AppState } from "../state/store";
import { Icon } from "./Icon";

interface Props {
  gameMode: GameMode;
  data: TarkovData | null;
  dataSource: string;
  showDone: boolean;
  onShowDone: (v: boolean) => void;
  onChangeMode: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onImport: (state: AppState) => void;
}

const LEGEND: IconId[] = ["mark", "visit", "search", "item", "plant", "other"];

export function SettingsTab(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const state = await readImportFile(file);
      if (!window.confirm("Remplacer toute votre progression actuelle par celle du fichier ?")) return;
      p.onImport(state);
      setMessage("Sauvegarde importée.");
    } catch (error) {
      setMessage(`Import impossible : ${(error as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="tab-body settings">
      <section>
        <div className="subhead">Mode de jeu</div>
        <div className="row-between">
          <span>{GAME_MODES.find((m) => m.id === p.gameMode)?.label}</span>
          <button className="btn btn-small" onClick={p.onChangeMode}>
            Changer
          </button>
        </div>
        <p className="muted small">Chaque mode a sa propre progression, ses notes et ses points.</p>
      </section>

      <section>
        <div className="subhead">Données tarkov.dev</div>
        {p.data && (
          <p className="small">
            {p.data.tasks.length} quêtes · {p.data.maps.length} maps
            <br />
            Mises à jour le {new Date(p.data.fetchedAt).toLocaleString("fr-FR")}
            <br />
            <span className="muted">{p.dataSource}</span>
          </p>
        )}
        <button className="btn btn-small" onClick={p.onRefresh}>
          Recharger depuis l'API
        </button>
      </section>

      <section>
        <div className="subhead">Affichage</div>
        <label className="check">
          <input type="checkbox" checked={p.showDone} onChange={(e) => p.onShowDone(e.target.checked)} />
          Afficher les objectifs faits (grisés) sur la carte
        </label>
        <ul className="legend">
          {LEGEND.map((id) => (
            <li key={id}>
              <Icon id={id} /> {ICON_LABELS[id]}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="subhead">Sauvegarde</div>
        <p className="muted small">
          Tout est enregistré automatiquement dans ce navigateur. Exportez un fichier pour garder une copie ou
          changer d'appareil.
        </p>
        <div className="btn-row">
          <button className="btn btn-small" onClick={p.onExport}>
            Exporter (JSON)
          </button>
          <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
            Importer…
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

      <section>
        <div className="subhead">Crédits</div>
        <p className="muted small">
          Données : <a href="https://tarkov.dev" target="_blank" rel="noreferrer">tarkov.dev</a>. Cartes :{" "}
          <a href="https://github.com/the-hideout/tarkov-dev-svg-maps" target="_blank" rel="noreferrer">
            tarkov-dev-svg-maps
          </a>{" "}
          (CC BY-NC-SA 4.0). Escape from Tarkov est une marque de Battlestate Games ; ce projet n'y est pas
          affilié.
        </p>
      </section>
    </div>
  );
}
