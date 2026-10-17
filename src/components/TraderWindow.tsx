// Fenêtre « Marchands » (barre du haut, à côté d'Objets), comme l'écran marchand du jeu : portraits des
// marchands, niveau de loyauté (et ce qu'il faut pour l'atteindre), achat / barter, catégories du flea à
// gauche, et ce que le marchand débloque à ce niveau (ou « Tout » : tous niveaux) : prix ou objets demandés,
// niveau, quête qui débloque l'offre, limite d'achat. Données chargées à la première ouverture.
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameMode, Task, Trader } from "../types";
import { tr } from "../lib/i18n";
import { iconSrc } from "../lib/itemIcons";
import { buildCategoryTree, type CategoryNode } from "../lib/itemCategories";
import { formatPrice, traderOffers, tradersWithOffers, type Offer, type OfferKind, type TraderOffersFile } from "../lib/traderOffers";
import { loadItemCategories, loadItemList, loadTraderOffers, type ListedItem } from "../api/itemList";
import { CategoryTree } from "./ItemFinder";
import { ItemThumb } from "./ItemThumb";

interface Props {
  gameMode: GameMode;
  lang: string;
  traders: Trader[];
  tasks: Task[];
  itemIcons: Record<string, string>;
}

export function TraderWindow(props: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  return (
    <>
      <button ref={toggle} className="btn btn-small item-finder-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" title={tr("Ce que vendent les marchands, par niveau", "What traders sell, by level")}>
        <span aria-hidden="true">🛒</span>
        <span className="item-finder-label">{tr("Marchands", "Traders")}</span>
      </button>
      {open && <TraderDialog {...props} onClose={close} />}
    </>
  );
}

function TraderDialog({ gameMode, lang, traders, tasks, itemIcons, onClose }: Props & { onClose: () => void }) {
  const [file, setFile] = useState<TraderOffersFile | null>(null);
  const [items, setItems] = useState<Map<string, ListedItem> | null>(null);
  const [error, setError] = useState(false);
  const [trader, setTrader] = useState<string | null>(null);
  // niveau choisi : ses nouveautés seulement ; 0 = onglet « Tout » (tous les niveaux)
  const [level, setLevel] = useState(1);
  const [kind, setKind] = useState<OfferKind>("all");
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [cat, setCat] = useState<CategoryNode | null>(null);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTraderOffers(gameMode), loadItemList(gameMode, lang)]).then(
      ([f, list]) => {
        if (cancelled) return;
        setFile(f);
        setItems(new Map(list.map((i) => [i.id, i])));
      },
      () => !cancelled && setError(true),
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [gameMode, lang]);

  // marchands qui vendent quelque chose, dans l'ordre de l'app (celui du jeu)
  const shown = useMemo(() => {
    if (!file) return [];
    const selling = tradersWithOffers(file);
    return traders.filter((t) => selling.has(t.id));
  }, [file, traders]);
  const current = trader ?? shown[0]?.id ?? null;
  const levels = (current && file?.levels[current]) || [[1, 0, 0, 0] as [number, number, number, number]];
  const all = level === 0;
  const lvl = all ? levels.length : Math.min(level, levels.length);
  const offers = useMemo(() => (file && current ? traderOffers(file, current, lvl, kind, !all) : []), [file, current, lvl, kind, all]);
  // nombre d'offres par type, affiché sur les boutons
  const kindCount = (k: OfferKind) => (file && current ? traderOffers(file, current, lvl, k, !all).length : 0);

  // catégories du flea, avec seulement les objets proposés à ce niveau
  useEffect(() => {
    if (!offers.length) return setTree(null);
    let cancelled = false;
    loadItemCategories(gameMode, lang)
      .then(({ file: cats, names }) => !cancelled && setTree(buildCategoryTree(cats, names, [...new Set(offers.map((o) => o.item))], tr("Autres", "Other"))))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [offers, gameMode, lang]);
  const visible = cat ? offers.filter((o) => cat.items.has(o.item)) : offers;

  const pickTrader = (id: string) => {
    setTrader(id);
    setLevel(1);
    setCat(null);
  };
  const taskName = (id: string) => tasks.find((t) => t.id === id)?.name ?? id;
  const name = (id: string) => items?.get(id)?.name ?? id;
  const [, playerLevel, reputation, commerce] = levels[lvl - 1] ?? [lvl, 0, 0, 0];

  return (
    <div className="finder-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="finder trader-window" role="dialog" aria-modal="true" aria-label={tr("Marchands", "Traders")}>
        <div className="finder-head">
          <h2 className="finder-name">{tr("Marchands", "Traders")}</h2>
          <button className="btn btn-small trader-close" onClick={onClose} aria-label={tr("Fermer", "Close")}>
            ✕
          </button>
        </div>
        {error ? (
          <p className="muted finder-empty">{tr("Données des marchands indisponibles (réseau ?).", "Trader data unavailable (network?).")}</p>
        ) : !file || !items ? (
          <p className="muted finder-empty" role="status">
            {tr("Chargement des marchands…", "Loading traders…")}
          </p>
        ) : (
          <>
            <div className="trader-row" role="tablist" aria-label={tr("Marchand", "Trader")}>
              {shown.map((t) => (
                <button key={t.id} role="tab" aria-selected={t.id === current} className={`trader-pick${t.id === current ? " active" : ""}`} onClick={() => pickTrader(t.id)} title={t.name}>
                  {t.imageLink ? <img src={t.imageLink} alt="" width={56} height={56} loading="lazy" referrerPolicy="no-referrer" /> : <span className="trader-noimg" />}
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            <div className="trader-bar">
              <div className="finder-tabs trader-levels" role="tablist" aria-label={tr("Niveau de loyauté", "Loyalty level")}>
                {levels.map(([n]) => (
                  <button key={n} role="tab" aria-selected={!all && n === lvl} className={`finder-tab${!all && n === lvl ? " active" : ""}`} onClick={() => setLevel(n)}>
                    {tr(`Niv. ${n}`, `LL${n}`)}
                  </button>
                ))}
                <button role="tab" aria-selected={all} className={`finder-tab${all ? " active" : ""}`} onClick={() => setLevel(0)}>
                  {tr("Tout", "All")}
                </button>
              </div>
              {/* mode de paiement, à ne pas confondre avec la catégorie d'objets « Objets d'échange » (Barter items) de l'arbre */}
              <div className="trader-kinds" role="group" aria-label={tr("Paiement", "Payment")}>
                {(
                  [
                    ["all", tr("Toutes les offres", "All offers")],
                    ["cash", tr("Contre argent", "For money")],
                    ["barter", tr("Contre objets (troc)", "Barter trades")],
                  ] as [OfferKind, string][]
                ).map(([k, label]) => (
                  <button key={k} className={`btn btn-small${kind === k ? " btn-primary" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {label} <span className="finder-cat-count">({kindCount(k)})</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="muted small trader-req">
              {all
                ? tr(`Tous les niveaux (1 à ${levels.length}).`, `All levels (1 to ${levels.length}).`)
                : lvl === 1
                ? tr("Niveau 1 : disponible dès le départ.", "Level 1: available from the start.")
                : `${tr(`Niveau ${lvl} : `, `Level ${lvl}: `)}${[
                    tr(`PMC niveau ${playerLevel}`, `PMC level ${playerLevel}`),
                    tr(`réputation ${reputation.toLocaleString(lang)}`, `reputation ${reputation.toLocaleString(lang)}`),
                    // somme dépensée : 0 dans les données actuelles du jeu, alors pas affichée
                    ...(commerce > 0 ? [tr(`${formatPrice(commerce, file.currency[current!] ?? "RUB", lang)} dépensés chez ce marchand`, `${formatPrice(commerce, file.currency[current!] ?? "RUB", lang)} spent with this trader`)] : []),
                  ].join(", ")}.`}{" "}
              {all
                ? tr(`${visible.length} offre(s).`, `${visible.length} offer(s).`)
                : tr(`${visible.length} offre(s) débloquée(s) à ce niveau.`, `${visible.length} offer(s) unlocked at this level.`)}
            </p>
            <div className="finder-body finder-split trader-split">
              {tree && (
                <nav className="finder-cats" aria-label={tr("Catégories", "Categories")}>
                  <button className={`finder-cat finder-cat-all${cat ? "" : " is-selected"}`} aria-pressed={!cat} onClick={() => setCat(null)}>
                    {tr("Tout", "All")} <span className="finder-cat-count">({offers.length})</span>
                  </button>
                  <CategoryTree
                    nodes={tree}
                    depth={0}
                    selected={cat?.id ?? null}
                    open={openCats}
                    onPick={(n) => {
                      setCat((c) => (c?.id === n.id ? null : n));
                      setOpenCats((o) => new Set(o).add(n.id));
                    }}
                    onToggle={(id) =>
                      setOpenCats((o) => {
                        const next = new Set(o);
                        if (!next.delete(id)) next.add(id);
                        return next;
                      })
                    }
                  />
                </nav>
              )}
              <div className="finder-main">
                {visible.length === 0 ? (
                  <p className="muted finder-empty">{tr("Rien à ce niveau.", "Nothing at this level.")}</p>
                ) : (
                  <ul className="finder-grid trader-grid">
                    {visible.map((o, i) => (
                      <OfferTile key={`${o.item}-${i}`} offer={o} name={name} itemIcons={itemIcons} taskName={taskName} lang={lang} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Une offre : l'objet, son prix ou les objets à donner, son niveau, la quête qui la débloque, la limite. */
function OfferTile({ offer, name, itemIcons, taskName, lang }: { offer: Offer; name: (id: string) => string; itemIcons: Record<string, string>; taskName: (id: string) => string; lang: string }) {
  const title = [
    name(offer.item),
    offer.task ? tr(`Débloqué par la quête « ${taskName(offer.task)} »`, `Unlocked by the quest "${taskName(offer.task)}"`) : "",
    offer.limit ? tr(`Limite : ${offer.limit} par réapprovisionnement`, `Limit: ${offer.limit} per restock`) : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <li>
      <div className="finder-tile trader-tile" title={title}>
        <span className="trader-ll">{tr(`Niv. ${offer.level}`, `LL${offer.level}`)}</span>
        {offer.barter && (
          <span className="trader-troc" title={tr("Offre payée en objets (troc)", "Paid with items (barter trade)")}>
            {tr("⇄ Troc", "⇄ Barter")}
          </span>
        )}
        {offer.task && (
          <span className="trader-lock" aria-label={tr(`Débloqué par une quête : ${taskName(offer.task)}`, `Unlocked by a quest: ${taskName(offer.task)}`)}>
            🔒
          </span>
        )}
        <span className="finder-icon">
          <ItemThumb src={iconSrc(offer.item, itemIcons)} name="" size={56} />
        </span>
        <span className="finder-tile-name">
          {name(offer.item)}
          {offer.barter && offer.barter.count > 1 ? ` ×${offer.barter.count}` : ""}
        </span>
        {offer.price && <strong className="trader-price">{formatPrice(offer.price.amount, offer.price.currency, lang)}</strong>}
        {offer.barter && (
          <span className="trader-barter" aria-label={tr("Contre :", "For:")}>
            {offer.barter.required.map((r) => (
              <span key={r.item} className="trader-req-item" title={`${name(r.item)} ×${r.count}`}>
                <ItemThumb src={iconSrc(r.item, itemIcons)} name={name(r.item)} size={22} />
                <span>×{r.count.toLocaleString(lang)}</span>
              </span>
            ))}
          </span>
        )}
        {offer.limit > 0 && <span className="muted trader-limit">{tr(`Limite ${offer.limit}`, `Limit ${offer.limit}`)}</span>}
      </div>
    </li>
  );
}
