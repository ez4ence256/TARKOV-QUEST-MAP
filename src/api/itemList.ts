// Item finder : tous les objets du jeu (noms) et le hideout, chargés à la première ouverture et gardés en
// mémoire seulement (jamais dans localStorage, déjà presque plein).
//  - noms : fichiers de traductions items_<langue> et items_en (~0,45 Mo chacun compressés) ; le fichier
//    principal des objets (17 Mo) n'est pas lu. Un objet = une clé « <id> ShortName » (les catégories n'en ont pas).
//  - hideout : fichier principal (~8 Ko compressé) + traductions.
//  - recherche par image, au premier collage d'une image : src/data/item-images.bin (cases d'inventaire, 4,9 Mo)
//    ou src/data/item-inspect.bin (vues d'inspection, 1,4 Mo), selon la capture.
//  - catégories du flea : src/data/item-categories.json (145 Ko, 60 Ko compressé), à l'ouverture du finder.
//  - meilleurs spots et titres wiki : src/data/item-where.json (115 Ko, 30 Ko compressé), à l'ouverture d'un objet.
import type { GameMode } from "../types";
import { fetchEndpoint, fetchJson, fetchTranslations } from "./tarkovJson";
import itemImagesUrl from "../data/item-images.bin?url";
import itemInspectUrl from "../data/item-inspect.bin?url";
import { parseImageIndex, type ImageIndex } from "../lib/itemImage";
import { parseInspect, type InspectIndex } from "../lib/itemInspect";
import type { CategoryFile } from "../lib/itemCategories";
import type { Spot } from "../lib/itemSpots";
import type { TraderOffersFile } from "../lib/traderOffers";
import { buildBarterIndex, buildCraftIndex, buildHideoutIndex, type Exchange, type HideoutUse } from "../lib/itemUsage";

export interface ListedItem {
  id: string;
  name: string;
  /** Textes comparés à la recherche : noms et noms courts, français et anglais. */
  alts: string[];
  /** Nom anglais : titre de la page de l'objet sur le wiki. */
  nameEn: string;
}

/** Traductions d'objets (langue puis anglais) -> liste triée par nom. */
export function parseItemList(primary: Record<string, string>, english: Record<string, string>, lang: string): ListedItem[] {
  const out: ListedItem[] = [];
  for (const key of Object.keys(english)) {
    const m = /^([0-9a-f]{24}) ShortName$/.exec(key);
    if (!m) continue;
    const id = m[1];
    const name = primary[`${id} Name`] ?? english[`${id} Name`];
    if (!name) continue;
    const alts = [name, primary[`${id} ShortName`], english[`${id} Name`], english[key]].filter((s): s is string => Boolean(s));
    out.push({ id, name, alts: [...new Set(alts)], nameEn: english[`${id} Name`] ?? name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, lang));
}

let images: Promise<ImageIndex> | null = null;
/** Signatures d'images des objets (npm run sync:items). */
export function loadItemImages(): Promise<ImageIndex> {
  if (!images) {
    images = fetch(itemImagesUrl).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer().then(parseImageIndex);
    });
    images.catch(() => (images = null));
  }
  return images;
}

let inspect: Promise<InspectIndex> | null = null;
/** Signatures des vues d'inspection (npm run sync:items). */
export function loadItemInspect(): Promise<InspectIndex> {
  if (!inspect) {
    inspect = fetch(itemInspectUrl).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer().then(parseInspect);
    });
    inspect.catch(() => (inspect = null));
  }
  return inspect;
}

type Translations = Record<string, string>;
const translations = new Map<string, Promise<[Translations, Translations]>>();
/** Traductions d'objets (langue, anglais), téléchargées une fois par mode et langue : noms des objets et des catégories. */
function itemTranslations(mode: GameMode, lang: string): Promise<[Translations, Translations]> {
  const key = `${mode}:${lang}`;
  let p = translations.get(key);
  if (!p) {
    p = Promise.all([fetchTranslations(`${mode}/items`, lang), lang === "en" ? null : fetchTranslations(`${mode}/items`, "en")]).then(([primary, en]) => [primary, en ?? primary]);
    translations.set(key, p);
  }
  return p;
}

const items = new Map<string, Promise<ListedItem[]>>();
export function loadItemList(mode: GameMode, lang: string): Promise<ListedItem[]> {
  const key = `${mode}:${lang}`;
  let p = items.get(key);
  if (!p) {
    p = itemTranslations(mode, lang).then(([primary, en]) => {
      const list = parseItemList(primary, en, lang);
      if (list.length === 0) throw new Error("items");
      return list;
    });
    // échec : on réessaiera à la prochaine ouverture (traductions comprises)
    p.catch(() => {
      items.delete(key);
      translations.delete(key);
    });
    items.set(key, p);
  }
  return p;
}

/** Offres des marchands par niveau (src/data/trader-offers-<mode>.json, chargé à l'ouverture de la fenêtre Marchands). */
export const loadTraderOffers = (mode: GameMode) =>
  import(`../data/trader-offers-${mode}.json`).then((m) => m.default as unknown as TraderOffersFile);

/** Meilleurs spots par objet et titres wiki qui diffèrent du nom anglais (src/data/item-where.json, chargé à part). */
export const loadItemWhere = () =>
  import("../data/item-where.json").then((m) => m.default as unknown as { spots: Record<string, Spot[]>; wiki: Record<string, string> });

/** Catégories du flea (src/data/item-categories.json, chargé à part) et leurs noms dans la langue. */
export async function loadItemCategories(mode: GameMode, lang: string): Promise<{ file: CategoryFile; names: Translations }> {
  const [file, [primary, en]] = await Promise.all([import("../data/item-categories.json").then((m) => m.default as unknown as CategoryFile), itemTranslations(mode, lang)]);
  const names: Translations = {};
  for (const [id] of file.cats) names[id] = primary[id] ?? en[id] ?? id;
  return { file, names };
}

/** Station de la planque : objets exigés pour chaque niveau (niveaux à partir de 1). */
export interface HideoutStation {
  id: string;
  name: string;
  levels: { level: number; items: { itemId: string; count: number; fir: boolean }[] }[];
}

export interface HideoutInfo {
  uses: Map<string, HideoutUse[]>;
  stationName: Record<string, string>;
  /** Toutes les stations, triées par nom. */
  stations: HideoutStation[];
}

// « foundInRaid » : objet (fichier JSON) ou liste [{ type, value }] (forme GraphQL)
const isFir = (a: any): boolean =>
  Array.isArray(a) ? a.some((x) => x?.type === "foundInRaid" && x.value === "true") : a?.foundInRaid === true;

function readStations(data: object, t: (k: unknown) => string, lang: string): HideoutStation[] {
  const raw = (Array.isArray(data) ? data : Object.values(data)) as any[];
  return raw
    .filter((s) => typeof s?.id === "string")
    .map((s) => ({
      id: s.id as string,
      name: t(s.name),
      levels: (Array.isArray(s.levels) ? s.levels : [])
        .map((l: any) => ({
          level: Number(l?.level) || 0,
          items: (Array.isArray(l?.itemRequirements) ? l.itemRequirements : [])
            .map((r: any) => ({ itemId: typeof r?.item === "string" ? r.item : r?.item?.id, count: Number(r?.count) || 1, fir: isFir(r?.attributes) }))
            .filter((i: { itemId?: string }) => i.itemId),
        }))
        .filter((l: { level: number }) => l.level > 0)
        .sort((a: { level: number }, b: { level: number }) => a.level - b.level),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}
const hideouts = new Map<string, Promise<HideoutInfo>>();
export function loadHideout(mode: GameMode, lang: string): Promise<HideoutInfo> {
  const key = `${mode}:${lang}`;
  let p = hideouts.get(key);
  if (!p) {
    p = fetchEndpoint(`${mode}/hideout`, lang).then(({ data, t }) => {
      const stationName: Record<string, string> = {};
      for (const s of Object.values(data) as { id?: string; name?: string }[]) if (s?.id) stationName[s.id] = t(s.name);
      return { uses: buildHideoutIndex(data), stationName, stations: readStations(data, t, lang) };
    });
    p.catch(() => hideouts.delete(key));
    hideouts.set(key, p);
  }
  return p;
}

/** Barters et crafts : seulement des identifiants (pas de traductions), ~29 Ko et ~13 Ko compressés. */
const exchanges = new Map<string, Promise<Map<string, Exchange[]>>>();
export function loadExchanges(mode: GameMode, kind: "barters" | "crafts"): Promise<Map<string, Exchange[]>> {
  const key = `${mode}/${kind}`;
  let p = exchanges.get(key);
  if (!p) {
    p = fetchJson(key).then((json) => (kind === "barters" ? buildBarterIndex(json.data) : buildCraftIndex(json.data)));
    p.catch(() => exchanges.delete(key));
    exchanges.set(key, p);
  }
  return p;
}
