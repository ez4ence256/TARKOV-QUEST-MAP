// Onglet "Quêtes" : liste complète avec recherche et filtres (marchand, map).
// Les quêtes sélectionnées qui passent les filtres sont épinglées en tête.
import { useMemo, useState } from "react";
import type { GameMap, Task, Trader } from "../types";
import type { ModeState } from "../state/store";
import { QUEST_COLORS } from "../lib/objectiveTypes";
import { taskProgress } from "../lib/points";
import { filterQuests, pinSelected, type QuestResult } from "../lib/questFilter";

interface Props {
  tasks: Task[];
  traders: Trader[];
  maps: GameMap[];
  mode: ModeState;
  onToggle: (taskId: string) => void;
  /** Ouvre l'onglet Photos sur une quête. */
  onPhotos: (taskId: string) => void;
  /** Vide la sélection (progression, notes et points perso gardés). */
  onClearSelection: () => void;
}

export function QuestList({ tasks, traders, maps, mode, onToggle, onPhotos, onClearSelection }: Props) {
  const [query, setQuery] = useState("");
  const [trader, setTrader] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const tradersById = useMemo(() => new Map(traders.map((t) => [t.id, t])), [traders]);
  const selected = useMemo(() => new Map(mode.selected.map((s) => [s.taskId, s.color])), [mode.selected]);

  // Marchands réellement présents dans les quêtes, triés par nom
  const traderOptions = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.traderId));
    return traders.filter((t) => ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, traders]);

  // Recherche sur le nom affiché ET le nom anglais ; meilleurs résultats en premier.
  const filtered = useMemo(
    () => filterQuests(tasks, { query, traderId: trader, mapId: mapFilter, hideCompleted }, mode.done),
    [tasks, query, trader, mapFilter, hideCompleted, mode.done],
  );
  const { pinned, others, hiddenSelected } = useMemo(
    () => pinSelected(filtered, mode.selected.map((s) => s.taskId)),
    [filtered, mode.selected],
  );

  const renderRow = ({ task: t, viaEnglish }: QuestResult) => {
    const color = selected.get(t.id);
    const isSelected = color !== undefined;
    const p = taskProgress(t, mode.done);
    return (
      <li key={t.id} className="quest-item">
        <button
          className={`quest-row ${isSelected ? "is-selected" : ""}`}
          onClick={() => onToggle(t.id)}
          aria-pressed={isSelected}
          title={isSelected ? "Cliquer pour désélectionner" : "Cliquer pour sélectionner"}
          style={isSelected ? { ["--q" as string]: QUEST_COLORS[color] } : undefined}
        >
          <span className="quest-check" aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
          <span className="quest-main">
            <span className="quest-name">{t.name}</span>
            {viaEnglish && <span className="quest-alt">EN : {t.nameEn}</span>}
            <span className="quest-meta">
              {tradersById.get(t.traderId)?.name ?? "?"}
              {t.minPlayerLevel ? ` · niv. ${t.minPlayerLevel}` : ""}
              {t.kappaRequired ? " · Kappa" : ""}
            </span>
          </span>
          {p.done > 0 && (
            <span className="quest-progress">
              {p.done}/{p.total}
            </span>
          )}
        </button>
        {t.wikiLink && (
          <button
            className="quest-photos"
            onClick={() => onPhotos(t.id)}
            title="Photos des emplacements (wiki)"
            aria-label={`Photos des emplacements de ${t.name}`}
          >
            📷
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="tab-body">
      <div className="filters">
        <input
          type="search"
          className="input"
          placeholder="Rechercher une quête…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rechercher une quête"
        />
        <div className="filter-row">
          <select className="input" value={trader} onChange={(e) => setTrader(e.target.value)} aria-label="Filtrer par marchand">
            <option value="">Tous les marchands</option>
            {traderOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="input" value={mapFilter} onChange={(e) => setMapFilter(e.target.value)} aria-label="Filtrer par map">
            <option value="">Toutes les maps</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          Masquer les quêtes terminées
        </label>
        <div className="muted small">
          {filtered.length} quête{filtered.length > 1 ? "s" : ""} sur {tasks.length}
        </div>
      </div>

      {mode.selected.length > 0 && (
        <section className="pinned" aria-label="Quêtes sélectionnées">
          <div className="pinned-head">
            <span className="subhead">Quêtes sélectionnées ({pinned.length})</span>
            <button className="btn btn-small" onClick={onClearSelection}>
              Tout désélectionner
            </button>
          </div>
          {hiddenSelected > 0 && (
            <p className="muted small">
              {hiddenSelected} autre{hiddenSelected > 1 ? "s" : ""} quête{hiddenSelected > 1 ? "s" : ""} sélectionnée
              {hiddenSelected > 1 ? "s" : ""}, masquée{hiddenSelected > 1 ? "s" : ""} par la recherche ou les filtres.
            </p>
          )}
          <ul className="quest-list">{pinned.map(renderRow)}</ul>
        </section>
      )}

      {mode.selected.length > 0 && others.length > 0 && <div className="subhead">Autres quêtes ({others.length})</div>}
      <ul className="quest-list">{others.map(renderRow)}</ul>
    </div>
  );
}
