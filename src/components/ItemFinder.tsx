// Item finder (barre du haut) : tous les objets du jeu avec leur photo ; l'objet choisi est cherché dans
// toutes les quêtes, le hideout, les barters et les crafts. Données chargées à la première ouverture.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GameMap, GameMode, Task, Trader } from "../types";
import { tr } from "../lib/i18n";
import { scoreName } from "../lib/search";
import { RECOGNIZED_MIN, matchItemLines } from "../lib/ocrMatch";
import { iconSrc } from "../lib/itemIcons";
import { matchImage, type Rgba } from "../lib/itemImage";
import { buildUsageIndex, durationLabel, useLabel, type Exchange, type QuestUse } from "../lib/itemUsage";
import { loadExchanges, loadHideout, loadItemImages, loadItemList, type HideoutInfo, type ListedItem } from "../api/itemList";
import { ItemThumb } from "./ItemThumb";

const PAGE = 100;

/** Lecture d'une capture collée (Ctrl+V) : null = recherche normale. */
type OcrState = { step: "reading"; progress: number | null } | { step: "done"; text: ListedItem[]; image: ListedItem[] } | { step: "error" };

/** Image collée -> pixels, à sa taille d'origine (la réduction se fait dans lib/itemImage). */
async function blobPixels(blob: Blob): Promise<Rgba> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Données téléchargées à la demande quand un objet est choisi (gardées en mémoire par api/itemList). */
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
  const [ocr, setOcr] = useState<OcrState | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const run = useRef(0); // numéro de la dernière lecture : un résultat périmé est ignoré
  const pasteRef = useRef<(blob: Blob) => void>(() => {});
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    loadItemList(gameMode, lang).then((l) => !cancelled && setList(l), () => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [gameMode, lang]);

  // téléchargés en parallèle quand un objet est choisi (les crafts ont besoin des noms de stations du hideout)
  const picked = Boolean(selected);
  const hideout = useLazy(picked, () => loadHideout(gameMode, lang), [gameMode, lang]);
  const barters = useLazy(picked, () => loadExchanges(gameMode, "barters"), [gameMode]);
  const crafts = useLazy(picked, () => loadExchanges(gameMode, "crafts"), [gameMode]);

  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    // image collée : lue ici, et jamais envoyée à la capture de quêtes de App (écouteur window, plus haut dans la propagation)
    const onPaste = (e: ClipboardEvent) => {
      const blob = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
      if (!blob) return; // collage de texte normal dans la recherche
      e.preventDefault();
      e.stopPropagation();
      pasteRef.current(blob);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    return () => {
      run.current++; // fermeture : le résultat en cours est ignoré
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("paste", onPaste);
    };
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

  pasteRef.current = async (blob) => {
    const id = ++run.current;
    if (!all) return setOcr({ step: "error" });
    setOcr({ step: "reading", progress: null });
    // texte (OCR) et image en même temps ; l'un peut échouer sans l'autre
    const [text, image] = await Promise.allSettled([
      import("../lib/ocr").then(({ readImageLines }) => readImageLines(blob, (p) => id === run.current && setOcr({ step: "reading", progress: p.progress }))),
      Promise.all([loadItemImages(), blobPixels(blob)]).then(([index, pixels]) => matchImage(pixels, index, () => id !== run.current)),
    ]);
    if (id !== run.current) return;
    if (text.status === "rejected" && image.status === "rejected") return setOcr({ step: "error" });
    const byText = text.status === "fulfilled" ? matchItemLines(text.value.map((l) => l.text), all) : [];
    const byImage = image.status === "fulfilled" ? image.value.map((m) => byId.get(m.id)).filter((i): i is ListedItem => Boolean(i)) : [];
    const sure = byText.filter((m) => m.score >= RECOGNIZED_MIN);
    // lecture sûre : elle seule ; sinon 3 lectures incertaines au plus, et les ressemblances d'image (sans doublon)
    const textItems = (sure.length ? sure : byText.slice(0, 3)).map((m) => m.item);
    setQuery("");
    setSelected(sure.length === 1 ? sure[0].item : null);
    setOcr({ step: "done", text: textItems, image: sure.length ? [] : byImage.filter((i) => !textItems.includes(i)) });
  };

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
  const tiles = (items: ListedItem[]) => (
    <ul className="finder-grid">
      {items.map((item) => (
        <li key={item.id}>
          <button className="finder-tile" title={item.name} onClick={() => setSelected(item)}>
            <span className="finder-icon">
              <ItemThumb src={iconSrc(item.id, itemIcons)} name="" size={56} />
            </span>
            <span className="finder-tile-name">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const usage = useMemo(() => buildUsageIndex(tasks), [tasks]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const byId = useMemo(() => new Map((all ?? []).map((i) => [i.id, i])), [all]);

  return (
    <div className="finder-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="finder" role="dialog" aria-modal="true" aria-label="Item finder">
        <div className="finder-head">
          <div className="finder-search-wrap">
            <span className="finder-search-icon" aria-hidden="true">🔍</span>
            <input
              ref={search}
              className="input finder-search"
              type="search"
              value={query}
              placeholder={tr("Nom d'un objet (FR ou EN) ou Ctrl+V d'une capture…", "Item name (FR or EN) or Ctrl+V a screenshot…")}
              aria-label={tr("Chercher un objet", "Search an item")}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                run.current++;
                setOcr(null);
              }}
            />
          </div>
          <button className="btn btn-small" onClick={onClose} aria-label={tr("Fermer", "Close")}>
            ✕
          </button>
        </div>

        <div className="finder-body">
          {ocr && (
            <div className="finder-ocr" role="status">
              <span>
                {ocr.step === "reading"
                  ? ocr.progress === null
                    ? tr("Lecture de la capture…", "Reading the screenshot…")
                    : tr(`Lecture de la capture… ${Math.round(ocr.progress * 100)} %`, `Reading the screenshot… ${Math.round(ocr.progress * 100)}%`)
                  : ocr.step === "error"
                    ? !all
                      ? tr("Liste des objets pas encore chargée.", "Item list not loaded yet.")
                      : tr("Lecture impossible. La première utilisation demande une connexion (données de langue).", "Could not read the image. The first use needs a connection (language data).")
                    : ocr.text.length + ocr.image.length
                      ? tr("Capture lue : choisis l'objet ci-dessous.", "Screenshot read: pick the item below.")
                      : tr("Aucun objet reconnu dans la capture.", "No item recognized in the screenshot.")}
              </span>
              {ocr.step !== "reading" && (
                <button className="btn btn-small" onClick={() => setOcr(null)}>
                  {tr("Effacer", "Clear")}
                </button>
              )}
            </div>
          )}
          {error ? (
            <p className="muted">{tr("Liste des objets indisponible (réseau ?).", "Item list unavailable (network?).")}</p>
          ) : !all ? (
            <p className="muted" role="status">{tr("Chargement des objets…", "Loading items…")}</p>
          ) : selected ? (
            <Usage
              key={selected.id}
              item={selected}
              src={iconSrc(selected.id, itemIcons)}
              quests={usage.get(selected.id) ?? []}
              tasksById={tasksById}
              traders={traders}
              maps={maps}
              hideout={hideout}
              barters={barters}
              crafts={crafts}
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
              {!ocr && (
                <p className="muted finder-count" role="status">
                  {tr(`${results.length} objet(s)`, `${results.length} item(s)`)}
                </p>
              )}
              {ocr?.step === "done" ? (
                <>
                  {ocr.text.length > 0 && <h3 className="finder-sub">{tr("Lu dans le texte", "Read from the text")}</h3>}
                  {ocr.text.length > 0 && tiles(ocr.text)}
                  {ocr.image.length > 0 && <h3 className="finder-sub">{tr("Ressemble à l'image", "Looks like the image")}</h3>}
                  {ocr.image.length > 0 && tiles(ocr.image)}
                </>
              ) : ocr?.step === "reading" ? null : (
                tiles(results.slice(0, shown))
              )}
              {!ocr && results.length > shown && (
                <div className="finder-more">
                  <button className="btn btn-small" onClick={() => setShown((n) => n + PAGE)}>
                    {tr("Afficher plus", "Show more")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Tab = "quests" | "hideout" | "barters" | "crafts";
type Lazy<T> = { data: T | null; error: boolean };

function Usage(p: {
  item: ListedItem;
  src: string;
  quests: QuestUse[];
  tasksById: Map<string, Task>;
  traders: Trader[];
  maps: GameMap[];
  hideout: Lazy<HideoutInfo>;
  barters: Lazy<Map<string, Exchange[]>>;
  crafts: Lazy<Map<string, Exchange[]>>;
  byId: Map<string, ListedItem>;
  itemIcons: Record<string, string>;
  onBack: () => void;
  onShowQuest: (taskId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("quests");
  const rows = p.quests
    .map((u) => ({ ...u, task: p.tasksById.get(u.taskId) }))
    .filter((r): r is typeof r & { task: Task } => Boolean(r.task))
    .sort((a, b) => a.task.name.localeCompare(b.task.name));
  const hideoutRows = (p.hideout.data?.uses.get(p.item.id) ?? [])
    .map((h) => ({ ...h, name: p.hideout.data?.stationName[h.stationId] ?? h.stationId }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level);
  const barterRows = p.barters.data?.get(p.item.id) ?? [];
  const craftRows = p.crafts.data?.get(p.item.id) ?? [];

  // nombre par onglet : null = en chargement, "!" = indisponible (les crafts ont aussi besoin du hideout)
  const counts: Record<Tab, number | "!" | null> = {
    quests: rows.length,
    hideout: p.hideout.error ? "!" : p.hideout.data ? hideoutRows.length : null,
    barters: p.barters.error ? "!" : p.barters.data ? barterRows.length : null,
    crafts: p.crafts.error || p.hideout.error ? "!" : p.crafts.data && p.hideout.data ? craftRows.length : null,
  };
  const tabs: [Tab, string][] = [
    ["quests", tr("Quêtes", "Quests")],
    ["hideout", "Hideout"],
    ["barters", "Barters"],
    ["crafts", "Crafts"],
  ];

  /** Contenu d'un onglet dont les données sont chargées à la demande. */
  const gate = (t: Tab, body: () => ReactNode) => {
    const c = counts[t];
    if (c === null) return <p className="muted finder-empty" role="status">{tr("Chargement…", "Loading…")}</p>;
    if (c === "!") return <p className="muted finder-empty">{tr("Données indisponibles (réseau ?).", "Data unavailable (network?).")}</p>;
    return body();
  };
  const exchanges = (list: Exchange[], source: (e: Exchange) => string) =>
    list.length === 0 ? (
      <p className="muted finder-empty">{tr("Aucun résultat.", "None.")}</p>
    ) : (
      <>
        {(["in", "out"] as const).map((side) => {
          const part = list.filter((e) => e.side === side);
          if (part.length === 0) return null;
          return (
            <section key={side}>
              {part.length < list.length && <h3 className="finder-sub">{side === "in" ? tr("Utilisé dans", "Used in") : tr("Obtenu via", "Obtained from")}</h3>}
              <ul className="finder-cards">
                {part.map((e, i) => (
                  <Recipe key={i} e={e} source={source(e)} item={p.item} byId={p.byId} itemIcons={p.itemIcons} />
                ))}
              </ul>
            </section>
          );
        })}
      </>
    );

  return (
    <div className="finder-usage">
      <div className="finder-hero">
        <button className="btn btn-small" onClick={p.onBack} aria-label={tr("Retour à la liste", "Back to the list")} title={tr("Retour à la liste", "Back to the list")}>
          ←
        </button>
        <span className="finder-icon big">
          <ItemThumb src={p.src} name="" size={72} />
        </span>
        <h2 className="finder-name">{p.item.name}</h2>
      </div>
      <div role="tablist" className="finder-tabs" aria-label={tr("Utilisations", "Uses")}>
        {tabs.map(([t, label]) => (
          <button key={t} role="tab" id={`finder-tab-${t}`} aria-selected={tab === t} aria-controls={`finder-panel-${t}`} className={`finder-tab${tab === t ? " active" : ""}${counts[t] === 0 ? " dim" : ""}`} onClick={() => setTab(t)}>
            {label}
            <span className="finder-badge">{counts[t] ?? "…"}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`finder-panel-${tab}`} aria-labelledby={`finder-tab-${tab}`}>
        {tab === "quests" &&
          (rows.length === 0 ? (
            <p className="muted finder-empty">{tr("Aucune quête ne l'utilise.", "No quest uses it.")}</p>
          ) : (
            <ul className="finder-cards">
              {rows.map((r) => {
                const trader = p.traders.find((t) => t.id === r.task.traderId);
                const map = p.maps.find((m) => m.id === r.task.mapId)?.name;
                return (
                  <li key={r.taskId}>
                    <button className="finder-card finder-quest" onClick={() => p.onShowQuest(r.taskId)}>
                      <span className="finder-avatar">{trader?.imageLink && <img src={trader.imageLink} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" />}</span>
                      <span className="finder-quest-main">
                        <strong>{r.task.name}</strong>
                        <span className="muted finder-quest-meta">{[trader?.name, map].filter(Boolean).join(" · ")}</span>
                        <span className="finder-pills">
                          {r.uses.map((u, i) => (
                            <span key={i} className={`finder-pill${u.fir ? " fir" : ""}`}>
                              {useLabel(u)}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="muted finder-chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        {tab === "hideout" &&
          gate("hideout", () =>
            hideoutRows.length === 0 ? (
              <p className="muted finder-empty">{tr("Aucune amélioration du hideout ne l'exige.", "No hideout upgrade needs it.")}</p>
            ) : (
              <ul className="finder-cards">
                {hideoutRows.map((h) => (
                  <li key={`${h.stationId}-${h.level}`} className="finder-card finder-row">
                    <strong>{h.name}</strong>
                    <span className="finder-pill">{`${tr("niv.", "lvl")} ${h.level}`}</span>
                    <span className="finder-right">
                      <strong>×{h.count}</strong>
                      {h.fir && <span className="finder-pill fir">FIR</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ),
          )}
        {tab === "barters" && gate("barters", () => exchanges(barterRows, (e) => p.traders.find((t) => t.id === e.sourceId)?.name ?? "?"))}
        {tab === "crafts" && gate("crafts", () => exchanges(craftRows, (e) => p.hideout.data?.stationName[e.sourceId] ?? "?"))}
      </div>
    </div>
  );
}

/** Un barter ou un craft : ingrédients → produits, l'objet cherché en surbrillance. */
function Recipe(p: { e: Exchange; source: string; item: ListedItem; byId: Map<string, ListedItem>; itemIcons: Record<string, string> }) {
  const { e } = p;
  const self = { id: p.item.id, count: e.count, fir: e.fir, self: true };
  const plain = (l: { id: string; count: number }[]) => l.map((x) => ({ ...x, fir: false, self: false }));
  const inputs = e.side === "in" ? [self, ...plain(e.with ?? [])] : plain(e.others);
  const outputs = e.side === "in" ? plain(e.others) : [self];
  const chip = (c: typeof self, i: number) => (
    <span key={`${c.id}-${i}`} className={`finder-chip${c.self ? " self" : ""}`}>
      <ItemThumb src={iconSrc(c.id, p.itemIcons)} name="" size={24} />
      <span>
        {p.byId.get(c.id)?.name ?? c.id}
        {c.count > 1 ? ` ×${c.count}` : ""}
      </span>
      {c.fir && <small className="finder-fir">FIR</small>}
    </span>
  );
  return (
    <li className="finder-card">
      <div className="finder-recipe-head">
        <strong>{p.source}</strong>
        <span className="finder-pill">{`${tr("niv.", "lvl")} ${e.level}`}</span>
        {e.duration ? <span className="muted finder-right">⏱ {durationLabel(e.duration)}</span> : null}
      </div>
      <div className="finder-recipe">
        {inputs.map(chip)}
        <span className="finder-arrow" aria-hidden="true">→</span>
        {outputs.map(chip)}
      </div>
    </li>
  );
}
