// Onglet "Quêtes" : liste complète avec recherche et filtres (marchand, map).
import { useMemo, useState } from "react";
import type { GameMap, Task, Trader } from "../types";
import type { ModeState } from "../state/store";
import { QUEST_COLORS } from "../lib/objectiveTypes";
import { taskMapIds, taskProgress } from "../lib/points";
import { questScore } from "../lib/search";

interface Props {
  tasks: Task[];
  traders: Trader[];
  maps: GameMap[];
  mode: ModeState;
  onToggle: (taskId: string) => void;
  /** Ouvre l'onglet Photos sur une quête. */
  onPhotos: (taskId: string) => void;
}

export function QuestList({ tasks, traders, maps, mode, onToggle, onPhotos }: Props) {
  const [query, setQuery] = useState("");
  const [trader, setTrader] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const tradersById = useMemo(() => new Map(traders.map((t) => [t.id, t])), [traders]);
  const mapIdsByTask = useMemo(() => new Map(tasks.map((t) => [t.id, taskMapIds(t)])), [tasks]);
  const selected = useMemo(() => new Map(mode.selected.map((s) => [s.taskId, s.color])), [mode.selected]);

  // Marchands réellement présents dans les quêtes, triés par nom
  const traderOptions = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.traderId));
    return traders.filter((t) => ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, traders]);

  // Recherche sur le nom affiché ET le nom anglais ; meilleurs résultats en premier.
  const filtered = useMemo(() => {
    const q = query.trim();
    const results: { task: Task; score: number; viaEnglish: boolean }[] = [];
    for (const t of tasks) {
      if (trader && t.traderId !== trader) continue;
      if (mapFilter && !mapIdsByTask.get(t.id)?.has(mapFilter)) continue;
      if (hideCompleted) {
        const p = taskProgress(t, mode.done);
        if (p.total > 0 && p.done === p.total) continue;
      }
      const match = q ? questScore(q, t) : { score: 1, viaEnglish: false };
      if (match.score > 0) results.push({ task: t, ...match });
    }
    // tri stable : à score égal, l'ordre alphabétique est conservé
    if (q) results.sort((a, b) => b.score - a.score);
    return results;
  }, [tasks, query, trader, mapFilter, hideCompleted, mapIdsByTask, mode.done]);

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

      <ul className="quest-list">
        {filtered.map(({ task: t, viaEnglish }) => {
          const color = selected.get(t.id);
          const isSelected = color !== undefined;
          const p = taskProgress(t, mode.done);
          return (
            <li key={t.id} className="quest-item">
              <button
                className={`quest-row ${isSelected ? "is-selected" : ""}`}
                onClick={() => onToggle(t.id)}
                aria-pressed={isSelected}
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
        })}
      </ul>
    </div>
  );
}
