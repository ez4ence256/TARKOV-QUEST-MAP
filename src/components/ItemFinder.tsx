// Item finder (barre du haut) : tous les objets du jeu avec leur photo ; l'objet choisi est cherché dans
// toutes les quêtes (et, au choix, dans le hideout). Données chargées à la première ouverture.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { GameMap, GameMode, Task, Trader } from "../types";
import { tr } from "../lib/i18n";
import { scoreName } from "../lib/search";
import { iconSrc } from "../lib/itemIcons";
import { buildUsageIndex, durationLabel, useLabel, type Exchange, type QuestUse } from "../lib/itemUsage";
import { loadExchanges, loadHideout, loadItemList, type HideoutInfo, type ListedItem } from "../api/itemList";
import { ItemThumb } from "./ItemThumb";

const PAGE = 100;
/** Case à cocher retenue dans le navigateur (cochée par défaut). */
function usePref(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) !== "0";
    } catch {
      return true;
    }
  });
  return [
    on,
    (v) => {
      setOn(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* préférence non retenue */
      }
    },
  ];
}

/** Données téléchargées à la demande quand la case est cochée et un objet choisi (gardées en mémoire par api/itemList). */
function useLazy<T>(wanted: boolean, load: () => Promise<T>, deps: unknown[]): { data: T | null; error: boolean } {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  const has = state.data !== null;
  useEffect(() => {
    if (!wanted || has) return;
    let cancelled = false;
    setState({ data: null, error: false });
    load().then((data) => !cancelled && setState({ data, error: false }), () => !cancelled && setState({ data: null, error: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, has, ...deps]);
  return state;
}

interface Props {
  gameMode: GameMode;
  lang: string;
  tasks: Task[];
  traders: Trader[];
  maps: GameMap[];
  itemNames: Record<string, string>;
  itemIcons: Record<string, string>;
  onShowQuest: (taskId: string) => void;
}

export function ItemFinder(props: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  return (
    <>
      <button ref={toggle} className="btn btn-small item-finder-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={tr("Item finder : chercher un objet", "Item finder: search an item")} title={tr("Chercher où sert un objet", "Find where an item is used")}>
        <span aria-hidden="true">🔍</span>
        <span className="item-finder-label">{tr("Objets", "Items")}</span>
      </button>
      {open && <FinderDialog {...props} onClose={close} />}
    </>
  );
}

function FinderDialog({ gameMode, lang, tasks, traders, maps, itemNames, itemIcons, onShowQuest, onClose }: Props & { onClose: () => void }) {
  const [list, setList] = useState<ListedItem[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<ListedItem | null>(null);
  const [withHideout, setWithHideout] = usePref("tqp:finderHideout");
  const [withBarters, setWithBarters] = usePref("tqp:finderBarters");
  const [withCrafts, setWithCrafts] = usePref("tqp:finderCrafts");
  const search = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    loadItemList(gameMode, lang).then((l) => !cancelled && setList(l), () => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [gameMode, lang]);

  // téléchargés seulement quand un objet est choisi, case cochée (les crafts ont besoin des noms de stations du hideout)
  const picked = Boolean(selected);
  const hideout = useLazy(picked && (withHideout || withCrafts), () => loadHideout(gameMode, lang), [gameMode, lang]);
  const barters = useLazy(picked && withBarters, () => loadExchanges(gameMode, "barters"), [gameMode]);
  const crafts = useLazy(picked && withCrafts, () => loadExchanges(gameMode, "crafts"), [gameMode]);

  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // objets du jeu + objets de quête (absents des fichiers d'objets) connus de l'app
  const all = useMemo(() => {
    if (!list) return null;
    const known = new Set(list.map((i) => i.id));
    const extra = Object.entries(itemNames)
      .filter(([id]) => !known.has(id))
      .map(([id, name]): ListedItem => ({ id, name, alts: [name] }));
    return extra.length ? [...list, ...extra].sort((a, b) => a.name.localeCompare(b.name, lang)) : list;
  }, [list, itemNames, lang]);

  const q = useDeferredValue(query);
  const results = useMemo(() => {
    if (!all) return [];
    if (!q.trim()) return all;
    return all
      .map((item) => ({ item, score: Math.max(...item.alts.map((a) => scoreName(q, a))) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item);
  }, [all, q]);
  useEffect(() => setShown(PAGE), [q]);

  const usage = useMemo(() => buildUsageIndex(tasks), [tasks]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const byId = useMemo(() => new Map((all ?? []).map((i) => [i.id, i])), [all]);

  return (
    <div className="finder-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="finder" role="dialog" aria-modal="true" aria-label="Item finder">
        <div className="finder-head">
          <input
            ref={search}
            className="input finder-search"
            type="search"
            value={query}
            placeholder={tr("Nom d'un objet (FR ou EN)…", "Item name (FR or EN)…")}
            aria-label={tr("Chercher un objet", "Search an item")}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
          />
          <button className="btn btn-small" onClick={onClose} aria-label={tr("Fermer", "Close")}>
            ✕
          </button>
        </div>
        <div className="finder-checks">
          <label className="finder-check">
            <input type="checkbox" checked={withHideout} onChange={(e) => setWithHideout(e.target.checked)} />
            {tr("Inclure le hideout", "Include hideout")}
          </label>
          <label className="finder-check">
            <input type="checkbox" checked={withBarters} onChange={(e) => setWithBarters(e.target.checked)} />
            Barters
          </label>
          <label className="finder-check">
            <input type="checkbox" checked={withCrafts} onChange={(e) => setWithCrafts(e.target.checked)} />
            Crafts
          </label>
        </div>

        <div className="finder-body">
          {error ? (
            <p className="muted">{tr("Liste des objets indisponible (réseau ?).", "Item list unavailable (network?).")}</p>
          ) : !all ? (
            <p className="muted" role="status">{tr("Chargement des objets…", "Loading items…")}</p>
          ) : selected ? (
            <Usage
              item={selected}
              src={iconSrc(selected.id, itemIcons)}
              quests={usage.get(selected.id) ?? []}
              tasksById={tasksById}
              traders={traders}
              maps={maps}
              hideout={hideout.data}
              withHideout={withHideout}
              withBarters={withBarters}
              withCrafts={withCrafts}
              barters={barters.data}
              crafts={crafts.data}
              loading={((withHideout || withCrafts) && !hideout.data && !hideout.error) || (withBarters && !barters.data && !barters.error) || (withCrafts && !crafts.data && !crafts.error)}
              failed={((withHideout || withCrafts) && hideout.error) || (withBarters && barters.error) || (withCrafts && crafts.error)}
              byId={byId}
              itemIcons={itemIcons}
              onBack={() => setSelected(null)}
              onShowQuest={(id) => {
                onShowQuest(id);
                onClose();
              }}
            />
          ) : (
            <>
              <p className="muted finder-count" role="status">
                {tr(`${results.length} objet(s)`, `${results.length} item(s)`)}
              </p>
              <ul className="finder-list">
                {results.slice(0, shown).map((item) => (
                  <li key={item.id}>
                    <button className="finder-item" onClick={() => setSelected(item)}>
                      <span className="finder-thumb">
                        <ItemThumb src={iconSrc(item.id, itemIcons)} name="" />
                      </span>
                      <span>{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {results.length > shown && (
                <button className="btn btn-small" onClick={() => setShown((n) => n + PAGE)}>
                  {tr("Afficher plus", "Show more")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Usage(p: {
  item: ListedItem;
  src: string;
  quests: QuestUse[];
  tasksById: Map<string, Task>;
  traders: Trader[];
  maps: GameMap[];
  hideout: HideoutInfo | null;
  withHideout: boolean;
  withBarters: boolean;
  withCrafts: boolean;
  barters: Map<string, Exchange[]> | null;
  crafts: Map<string, Exchange[]> | null;
  loading: boolean;
  failed: boolean;
  byId: Map<string, ListedItem>;
  itemIcons: Record<string, string>;
  onBack: () => void;
  onShowQuest: (taskId: string) => void;
}) {
  const rows = p.quests
    .map((u) => ({ ...u, task: p.tasksById.get(u.taskId) }))
    .filter((r): r is typeof r & { task: Task } => Boolean(r.task))
    .sort((a, b) => a.task.name.localeCompare(b.task.name));
  const hideoutRows = (p.hideout?.uses.get(p.item.id) ?? [])
    .map((h) => ({ ...h, name: p.hideout?.stationName[h.stationId] ?? h.stationId }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level);
  return (
    <div className="finder-usage">
      <div className="finder-selected">
        <button className="btn btn-small" onClick={p.onBack}>
          {tr("← Liste", "← List")}
        </button>
        <span className="finder-thumb big">
          <ItemThumb src={p.src} name="" size={48} />
        </span>
        <strong>{p.item.name}</strong>
      </div>
      <h3>{tr(`Quêtes (${rows.length})`, `Quests (${rows.length})`)}</h3>
      {rows.length === 0 && <p className="muted">{tr("Aucune quête ne l'utilise.", "No quest uses it.")}</p>}
      <ul className="finder-list">
        {rows.map((r) => {
          const trader = p.traders.find((t) => t.id === r.task.traderId)?.name;
          const map = p.maps.find((m) => m.id === r.task.mapId)?.name;
          return (
            <li key={r.taskId}>
              <button className="finder-quest" onClick={() => p.onShowQuest(r.taskId)}>
                <span>{r.task.name}</span>
                <span className="muted">{[trader, map].filter(Boolean).join(" · ")}</span>
                <span className="finder-roles">{r.uses.map(useLabel).join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {p.loading && <p className="muted" role="status">{tr("Chargement…", "Loading…")}</p>}
      {p.failed && <p className="muted">{tr("Une partie des données est indisponible (réseau ?).", "Some data is unavailable (network?).")}</p>}
      {p.withHideout && p.hideout && (
        <>
          <h3>Hideout ({hideoutRows.length})</h3>
          {hideoutRows.length === 0 && <p className="muted">{tr("Aucune amélioration du hideout ne l'exige.", "No hideout upgrade needs it.")}</p>}
          <ul className="finder-list">
            {hideoutRows.map((h) => (
              <li key={`${h.stationId}-${h.level}`} className="finder-hideout">
                {`Hideout — ${h.name} ${tr("niv.", "lvl")} ${h.level} : ×${h.count}${h.fir ? " (FIR)" : ""}`}
              </li>
            ))}
          </ul>
        </>
      )}
      {p.withBarters && p.barters && (
        <ExchangeList title="Barters" rows={p.barters.get(p.item.id) ?? []} text={(e) => barterText(e, p.traders)} byId={p.byId} itemIcons={p.itemIcons} />
      )}
      {p.withCrafts && p.crafts && p.hideout && (
        <ExchangeList title="Crafts" rows={p.crafts.get(p.item.id) ?? []} text={(e) => craftText(e, p.hideout!.stationName)} byId={p.byId} itemIcons={p.itemIcons} />
      )}
    </div>
  );
}

const barterText = (e: Exchange, traders: Trader[]) => {
  const who = `${traders.find((t) => t.id === e.sourceId)?.name ?? "?"} ${tr("niv.", "lvl")} ${e.level}`;
  return e.side === "in"
    ? { head: `${tr("Échange chez", "Barter with")} ${who} : ×${e.count}${e.fir ? " (FIR)" : ""} →`, tail: "" }
    : { head: `${tr("Obtenu par échange chez", "Obtained by barter with")} ${who} ${tr("contre", "for")}`, tail: "" };
};
const craftText = (e: Exchange, stations: Record<string, string>) => {
  const where = `Craft — ${stations[e.sourceId] ?? "?"} ${tr("niv.", "lvl")} ${e.level}`;
  const time = e.duration ? ` (${durationLabel(e.duration)})` : "";
  return e.side === "in"
    ? { head: `${where} : ×${e.count}${e.fir ? " (FIR)" : ""} →`, tail: time }
    : { head: `${tr("Produit par", "Produced by")} ${where} ${tr("avec", "with")}`, tail: time };
};

function ExchangeList(p: { title: string; rows: Exchange[]; text: (e: Exchange) => { head: string; tail: string }; byId: Map<string, ListedItem>; itemIcons: Record<string, string> }) {
  return (
    <>
      <h3>
        {p.title} ({p.rows.length})
      </h3>
      {p.rows.length === 0 && <p className="muted">{tr("Aucun résultat.", "None.")}</p>}
      <ul className="finder-list">
        {p.rows.map((e, i) => {
          const t = p.text(e);
          return (
            <li key={i} className="finder-hideout">
              {t.head}{" "}
              {e.others.map((o) => (
                <span key={o.id} className="finder-chip">
                  <span className="finder-thumb small">
                    <ItemThumb src={iconSrc(o.id, p.itemIcons)} name="" size={20} />
                  </span>
                  {p.byId.get(o.id)?.name ?? o.id}
                  {o.count > 1 ? ` ×${o.count}` : ""}
                </span>
              ))}
              {t.tail}
            </li>
          );
        })}
      </ul>
    </>
  );
}
