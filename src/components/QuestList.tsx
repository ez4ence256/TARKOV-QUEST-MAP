// Onglet "Quêtes" : liste complète avec recherche et filtres (marchand, map).
// Les quêtes sélectionnées qui passent les filtres sont épinglées en tête.
import { useMemo, useState } from "react";
import type { GameMap, Task, Trader } from "../types";
import type { ModeState } from "../state/store";
import { questScore } from "../lib/search";
import { pageUrlFor } from "../api/wiki";
import { useStoryChapters } from "./StoryView";
import { QUEST_COLORS } from "../lib/objectiveTypes";
import { taskProgress } from "../lib/points";
import { getLang, tr } from "../lib/i18n";
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
  /** Une map choisie dans le filtre devient aussi la map affichée. */
  onShowMap: (mapId: string) => void;
  /** Main story : ajoute ou retire un chapitre (titre de la page anglaise). */
  onToggleStory: (chapter: string) => void;
  /** Main story : ouvre la fiche d'un chapitre. */
  onOpenStory: (chapter: string) => void;
}

export function QuestList({ tasks, traders, maps, mode, onToggle, onPhotos, onClearSelection, onShowMap, onToggleStory, onOpenStory }: Props) {
  const [query, setQuery] = useState("");
  const [trader, setTrader] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);

  const tradersById = useMemo(() => new Map(traders.map((t) => [t.id, t])), [traders]);
  const selected = useMemo(() => new Map(mode.selected.map((s) => [s.taskId, s.color])), [mode.selected]);

  // Marchands réellement présents dans les quêtes, triés par nom
  const traderOptions = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.traderId));
    return traders.filter((t) => ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, getLang()));
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

  // Main story : les chapitres du wiki, chargés (1 requête, en cache ensuite) à l'ouverture de l'onglet.
  // Recherche bilingue comme pour les quêtes ; masqués si un filtre marchand ou map est actif.
  const [storyRetry, setStoryRetry] = useState(0);
  const storyChapters = useStoryChapters(true, storyRetry);
  const storySelected = mode.story?.selected ?? [];
  const storyRows = useMemo(() => {
    if (trader || mapFilter || !storyChapters.chapters) return [];
    const q = query.trim();
    const lang = getLang();
    const rows = storyChapters.chapters.flatMap((c) => {
      const name = lang === "en" ? c.nameEn : c.name;
      const m = q ? questScore(q, { name, nameEn: c.nameEn }) : { score: 1, viaEnglish: false };
      return m.score > 0 ? [{ id: c.id, name, nameEn: c.nameEn, ...m }] : [];
    });
    if (q) rows.sort((a, b) => b.score - a.score);
    // sélectionnés en tête, ordre du wiki (ou de la recherche) conservé dans chaque groupe
    return [...rows.filter((r) => storySelected.includes(r.id)), ...rows.filter((r) => !storySelected.includes(r.id))];
  }, [storyChapters.chapters, query, trader, mapFilter, storySelected]);

  const renderStoryRow = (r: (typeof storyRows)[number]) => {
    const isSelected = storySelected.includes(r.id);
    const prefix = `${r.id}::`;
    const ticked = Object.keys(mode.story?.done ?? {}).filter((k) => k.startsWith(prefix)).length;
    return (
      <li key={r.id} className="quest-item">
        <button
          className={`quest-row ${isSelected ? "is-selected" : ""}`}
          onClick={() => onToggleStory(r.id)}
          aria-pressed={isSelected}
          title={isSelected ? tr("Cliquer pour désélectionner", "Click to deselect") : tr("Cliquer pour sélectionner", "Click to select")}
          style={isSelected ? { ["--q" as string]: "var(--accent)" } : undefined}
        >
          <span className="quest-check" aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
          <span className="quest-main">
            <span className="quest-name">{r.name}</span>
            {r.viaEnglish && <span className="quest-alt">EN : {r.nameEn}</span>}
            <span className="quest-meta">Main story</span>
          </span>
          {ticked > 0 && <span className="quest-progress">{tr(`${ticked} faite${ticked > 1 ? "s" : ""}`, `${ticked} done`)}</span>}
        </button>
        <button
          className="quest-photos"
          onClick={() => onOpenStory(r.id)}
          title={tr("Ouvrir la fiche du chapitre", "Open the chapter")}
          aria-label={tr(`Ouvrir ${r.name}`, `Open ${r.name}`)}
        >
          📜
        </button>
      </li>
    );
  };

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
          title={isSelected ? tr("Cliquer pour désélectionner", "Click to deselect") : tr("Cliquer pour sélectionner", "Click to select")}
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
              {t.minPlayerLevel ? ` · ${tr("niv.", "lvl")} ${t.minPlayerLevel}` : ""}
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
            title={tr("Photos des emplacements (wiki)", "Location photos (wiki)")}
            aria-label={tr(`Photos des emplacements de ${t.name}`, `Location photos for ${t.name}`)}
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
          placeholder={tr("Rechercher une quête…", "Search quests…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={tr("Rechercher une quête", "Search quests")}
        />
        <div className="filter-row">
          <select className="input" value={trader} onChange={(e) => setTrader(e.target.value)} aria-label={tr("Filtrer par marchand", "Filter by trader")}>
            <option value="">{tr("Tous les marchands", "All traders")}</option>
            {traderOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="input" value={mapFilter} onChange={(e) => {
              setMapFilter(e.target.value);
              if (e.target.value) onShowMap(e.target.value);
            }} aria-label={tr("Filtrer par map", "Filter by map")}>
            <option value="">{tr("Toutes les maps", "All maps")}</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          {tr("Masquer les quêtes terminées", "Hide completed quests")}
        </label>
        <div className="muted small">
          {tr(
            `${filtered.length} quête${filtered.length > 1 ? "s" : ""} sur ${tasks.length}`,
            `${filtered.length} of ${tasks.length} quest${tasks.length > 1 ? "s" : ""}`,
          )}
        </div>
      </div>

      {(storyRows.length > 0 || (storyChapters.status !== "ready" && !trader && !mapFilter)) && (
        <section className="story-list" aria-label="Main story">
          <div className="subhead">Main story{storyRows.length > 0 ? ` (${storyRows.length})` : ""}</div>
          {storyChapters.status === "loading" && <p className="muted small">{tr("Chargement des chapitres du wiki…", "Loading the chapters from the wiki…")}</p>}
          {storyChapters.status === "error" && (
            <p className="muted small">
              {tr("Les chapitres n'ont pas pu être chargés (le wiki ne répond pas).", "The chapters could not be loaded (the wiki is not responding).")}{" "}
              <button className="link" onClick={() => setStoryRetry((n) => n + 1)}>
                {tr("Réessayer", "Retry")}
              </button>{" · "}
              <a href={pageUrlFor("Story chapters")} target="_blank" rel="noopener noreferrer">
                wiki
              </a>
            </p>
          )}
          <ul className="quest-list">{storyRows.map(renderStoryRow)}</ul>
        </section>
      )}

      {mode.selected.length > 0 && (
        <section className="pinned" aria-label={tr("Quêtes sélectionnées", "Selected quests")}>
          <div className="pinned-head">
            <span className="subhead">{tr(`Quêtes sélectionnées (${pinned.length})`, `Selected quests (${pinned.length})`)}</span>
            <button className="btn btn-small" onClick={onClearSelection}>
              {tr("Tout désélectionner", "Deselect all")}
            </button>
          </div>
          {hiddenSelected > 0 && (
            <p className="muted small">
              {tr(
                `${hiddenSelected} autre${hiddenSelected > 1 ? "s" : ""} quête${hiddenSelected > 1 ? "s" : ""} sélectionnée${hiddenSelected > 1 ? "s" : ""}, masquée${hiddenSelected > 1 ? "s" : ""} par la recherche ou les filtres.`,
                `${hiddenSelected} other selected quest${hiddenSelected > 1 ? "s" : ""} hidden by the search or filters.`,
              )}
            </p>
          )}
          <ul className="quest-list">{pinned.map(renderRow)}</ul>
        </section>
      )}

      {mode.selected.length > 0 && others.length > 0 && <div className="subhead">{tr(`Autres quêtes (${others.length})`, `Other quests (${others.length})`)}</div>}
      <ul className="quest-list">{others.map(renderRow)}</ul>
    </div>
  );
}
