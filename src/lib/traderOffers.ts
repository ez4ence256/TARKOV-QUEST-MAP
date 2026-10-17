// Marchands : ce qu'ils vendent par niveau de loyauté (achats contre argent et barters), comme l'écran
// marchand du jeu. Données : src/data/trader-offers-<mode>.json (npm run sync:traders). Logique pure.

export interface TraderOffersFile {
  /** marchand -> [niveau, niveau PMC requis, réputation requise, somme dépensée requise][] */
  levels: Record<string, [number, number, number, number][]>;
  /** marchand -> devise de la somme dépensée (RUB, USD…) */
  currency: Record<string, string>;
  /** [marchand, objet, niveau, prix, devise, quête qui débloque | null, limite d'achat (0 = aucune)] */
  cash: [string, string, number, number, string, string | null, number][];
  /** [marchand, objet, niveau, quantité reçue, [objet demandé, quantité][], quête | null, limite] */
  barters: [string, string, number, number, [string, number][], string | null, number][];
}

export interface Offer {
  item: string;
  level: number;
  /** Quête à terminer pour débloquer l'offre. */
  task: string | null;
  /** Achats par réapprovisionnement (0 = aucune limite). */
  limit: number;
  /** Achat contre argent : prix et devise ; barter : objets demandés et quantité reçue. */
  price?: { amount: number; currency: string };
  barter?: { count: number; required: { item: string; count: number }[] };
}

export type OfferKind = "all" | "cash" | "barter";

/**
 * Offres d'un marchand : débloquées exactement au niveau `level` (`exact`, les nouveautés du niveau), ou
 * disponibles à ce niveau (niveaux inférieurs compris) ; triées par niveau puis dans l'ordre du fichier.
 */
export function traderOffers(file: TraderOffersFile, trader: string, level: number, kind: OfferKind = "all", exact = false): Offer[] {
  const at = (lvl: number) => (exact ? lvl === level : lvl <= level);
  const out: Offer[] = [];
  if (kind !== "barter") {
    for (const [t, item, lvl, amount, currency, task, limit] of file.cash) {
      if (t === trader && at(lvl)) out.push({ item, level: lvl, task, limit, price: { amount, currency } });
    }
  }
  if (kind !== "cash") {
    for (const [t, item, lvl, count, req, task, limit] of file.barters) {
      if (t === trader && at(lvl)) out.push({ item, level: lvl, task, limit, barter: { count, required: req.map(([i, c]) => ({ item: i, count: c })) } });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

/** Marchands qui vendent quelque chose. */
export const tradersWithOffers = (file: TraderOffersFile) => new Set([...file.cash.map((o) => o[0]), ...file.barters.map((o) => o[0])]);

const SYMBOL: Record<string, string> = { RUB: "₽", USD: "$", EUR: "€" };
/** 12345 RUB -> « 12 345 ₽ » */
export const formatPrice = (amount: number, currency: string, locale: string) => `${Math.round(amount).toLocaleString(locale)} ${SYMBOL[currency] ?? currency}`;
