// Onglet « Planque » : niveau construit de chaque station et objets du niveau suivant.
// Les stations viennent de l'API (jamais écrites en dur) ; le niveau choisi décide aussi des objets à garder.
import { useEffect, useState } from "react";
import type { GameMode } from "../types";
import { loadItemList, type HideoutStation } from "../api/itemList";
import { iconSrc } from "../lib/itemIcons";
import { tr } from "../lib/i18n";
import { ItemThumb } from "./ItemThumb";

interface Props {
  gameMode: GameMode;
  lang: string;
  /** null tant que les stations chargent (ou en erreur). */
  stations: HideoutStation[] | null;
  error: boolean;
  onRetry: () => void;
  /** Niveau construit par station (absent = 0). */
  levels: Record<string, number>;
  onLevel: (stationId: string, level: number) => void;
  include: boolean;
  onInclude: (value: boolean) => void;
  itemIcons: Record<string, string>;
}

export function HideoutTab(p: Props) {
  // noms de tous les objets (les quêtes ne citent pas ceux de la planque) ; sans eux, l'identifiant s'affiche
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadItemList(p.gameMode, p.lang).then(
      (list) => !cancelled && setNames(new Map(list.map((i) => [i.id, i.name]))),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [p.gameMode, p.lang]);

  return (
    <div className="tab-body hideout">
      <label className="check">
        <input type="checkbox" checked={p.include} onChange={(e) => p.onInclude(e.target.checked)} />
        {tr("Inclure la planque dans les objets à garder", "Include the hideout in the items to keep")}
      </label>
      <p className="muted small">
        {tr(
          "Les objets des niveaux à construire s'ajoutent à ceux des quêtes dans l'Item finder.",
          "The items of the levels still to build are added to the quests' in the Item finder.",
        )}
      </p>
      {p.error ? (
        <p className="error">
          {tr("Planque indisponible (réseau ?).", "Hideout unavailable (network?).")}{" "}
          <button className="link" onClick={p.onRetry}>
            {tr("Réessayer", "Retry")}
          </button>
        </p>
      ) : !p.stations ? (
        <p className="muted" role="status">
          {tr("Chargement de la planque…", "Loading the hideout…")}
        </p>
      ) : (
        <ul className="hideout-list">
          {p.stations.map((s) => {
            const built = p.levels[s.id] ?? 0;
            const max = Math.max(0, ...s.levels.map((l) => l.level));
            const ignored = built < 0;
            const next = ignored ? undefined : s.levels.find((l) => l.level > built);
            return (
              <li key={s.id} className={`hideout-station${ignored ? " is-ignored" : ""}`}>
                <div className="row-between">
                  <strong>{s.name}</strong>
                  <select
                    className="input"
                    value={ignored ? -1 : Math.min(built, max)}
                    onChange={(e) => p.onLevel(s.id, Number(e.target.value))}
                    aria-label={tr(`Niveau actuel : ${s.name}`, `Current level: ${s.name}`)}
                  >
                    <option value={-1}>{tr("Ignorer", "Ignore")}</option>
                    <option value={0}>{tr("0 (pas construite)", "0 (not built)")}</option>
                    {s.levels.map((l) => (
                      <option key={l.level} value={l.level}>
                        {tr(`Niveau ${l.level}`, `Level ${l.level}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {next ? (
                  <>
                    <div className="subhead">{tr(`Pour le niveau ${next.level} :`, `For level ${next.level}:`)}</div>
                    <ul className="hideout-items">
                      {next.items.map((i, k) => (
                        <li key={`${i.itemId}${k}`}>
                          <ItemThumb src={iconSrc(i.itemId, p.itemIcons)} name="" size={28} />
                          <span>{names.get(i.itemId) ?? i.itemId}</span> ×{i.count}
                          {i.fir && <span className="tag">FIR</span>}
                        </li>
                      ))}
                      {next.items.length === 0 && <li className="muted">{tr("Aucun objet demandé.", "No item required.")}</li>}
                    </ul>
                  </>
                ) : (
                  <p className="muted small">
                    {ignored ? tr("Ignorée : ses objets ne comptent pas dans « À garder ».", "Ignored: its items don't count in “To keep”.") : tr("Niveau maximum", "Max level")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
