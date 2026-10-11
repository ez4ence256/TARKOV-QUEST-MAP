// Onglet "Quêtes" : liste complète avec recherche et filtres (marchand, map).
// Les quêtes sélectionnées qui passent les filtres sont épinglées en tête ; les chapitres de la Main story
// y sont mélangés comme des quêtes.
import { useMemo, useState } from "react";
import type { GameMap, Task, Trader } from "../types";
import type { ModeState } from "../state/store";
import { pageUrlFor } from "../api/wiki";
import { useStoryChapters } from "./StoryView";
import { QUEST_COLORS } from "../lib/objectiveTypes";
import { taskProgress } from "../lib/points";
import { getLang, tr } from "../lib/i18n";
import { filterQuests, filterStory, mergeRows, pinSelected, STORY_TRADER, type Row, type StoryResult } from "../lib/questFilter";
import { storyIdOf } from "../lib/story";

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

  // Main story : les chapitres du wiki (1 requête, en cache ensuite) sont des lignes comme les quêtes,
  // mélangées et triées avec elles ; « Main story » tient lieu de marchand.
  const [storyRetry, setStoryRetry] = useState(0);
  const storyChapters = useStoryChapters(true, storyRetry);
  const storySelected = mode.story?.selected ?? [];
  const filters = useMemo(() => ({ query, traderId: trader, mapId: mapFilter, hideCompleted }), [query, trader, mapFilter, hideCompleted]);

  // Recherche sur le nom affiché ET le nom anglais ; meilleurs résultats en premier.
  const quests = useMemo(() => filterQuests(tasks, filters, mode.done), [tasks, filters, mode.done]);
  const rows = useMemo(
    () => mergeRows(quests, storyChapters.chapters ? filterStory(storyChapters.chapters, filters, getLang()) : [], getLang(), Boolean(query.trim())),
    [quests, storyChapters.chapters, filters, query],
  );
  // chapitres sélectionnés comptés seulement une fois la liste chargée (sinon ils paraîtraient masqués)
  const selectedKeys = useMemo(
    () => [...mode.selected.map((s) => s.taskId), ...(storyChapters.chapters ? storySelected.map(storyIdOf) : [])],
    [mode.selected, storySelected, storyChapters.chapters],
  );
  const { pinned, others, hiddenSelected } = useMemo(() => pinSelected(rows, selectedKeys), [rows, selectedKeys]);
  const selectedCount = mode.selected.length + storySelected.length;

  const renderStoryRow = (r: StoryResult) => {
    const id = r.chapter.id;
    const isSelected = storySelected.includes(id);
    const prefix = `${id}::`;
    const ticked = Object.keys(mode.story?.done ?? {}).filter((k) => k.startsWith(prefix)).length;
    return (
      <li key={storyIdOf(id)} className="quest-item">
        <button
          className={`quest-row ${isSelected ? "is-selected" : ""}`}
          onClick={() => onToggleStory(id)}
          aria-pressed={isSelected}
          title={isSelected ? tr("Cliquer pour désélectionner", "Click to deselect") : tr("Cliquer pour sélectionner", "Click to select")}
          style={isSelected ? { ["--q" as string]: "var(--accent)" } : undefined}
        >
          <span className="quest-check" aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
          <span className="quest-main">
            <span className="quest-name">{r.chapter.name}</span>
            {r.viaEnglish && <span className="quest-alt">EN : {r.chapter.nameEn}</span>}
            <span className="quest-meta">Main story</span>
          </span>
          {ticked > 0 && <span className="quest-progress">{tr(`${ticked} faite${ticked > 1 ? "s" : ""}`, `${ticked} done`)}</span>}
        </button>
        <button
          className="quest-photos"
          onClick={() => onOpenStory(id)}
          title={tr("Ouvrir la fiche du chapitre", "Open the chapter")}
          aria-label={tr(`Ouvrir ${r.chapter.name}`, `Open ${r.chapter.name}`)}
        >
          📜
        </button>
      </li>
    );
  };

  const renderRow = (row: Row) => {
    if (!("task" in row)) return renderStoryRow(row);
    const { task: t, viaEnglish } = row;
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
            <option value={STORY_TRADER}>Main story</option>
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
            `${quests.length} quête${quests.length > 1 ? "s" : ""} sur ${tasks.length}`,
            `${quests.length} of ${tasks.length} quest${tasks.length > 1 ? "s" : ""}`,
          )}
        </div>
      </div>

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

      {selectedCount > 0 && (
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

      {selectedCount > 0 && others.length > 0 && <div className="subhead">{tr(`Autres quêtes (${others.length})`, `Other quests (${others.length})`)}</div>}
      <ul className="quest-list">{others.map(renderRow)}</ul>
    </div>
  );
}
