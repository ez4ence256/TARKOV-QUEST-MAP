// Item finder : tous les objets du jeu (noms) et le hideout, chargés à la première ouverture et gardés en
// mémoire seulement (jamais dans localStorage, déjà presque plein).
//  - noms : fichiers de traductions items_<langue> et items_en (~0,45 Mo chacun compressés) ; le fichier
//    principal des objets (17 Mo) n'est pas lu. Un objet = une clé « <id> ShortName » (les catégories n'en ont pas).
//  - hideout : fichier principal (~8 Ko compressé) + traductions.
//  - signatures d'images (recherche par image) : src/data/item-images.bin (4,9 Mo, 1,6 Mo compressé), au premier collage d'une image.
import type { GameMode } from "../types";
import { fetchEndpoint, fetchJson, fetchTranslations } from "./tarkovJson";
import itemImagesUrl from "../data/item-images.bin?url";
import { parseImageIndex, type ImageIndex } from "../lib/itemImage";
import { buildBarterIndex, buildCraftIndex, buildHideoutIndex, type Exchange, type HideoutUse } from "../lib/itemUsage";

export interface ListedItem {
  id: string;
  name: string;
  /** Textes comparés à la recherche : noms et noms courts, français et anglais. */
  alts: string[];
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
    out.push({ id, name, alts: [...new Set(alts)] });
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

const items = new Map<string, Promise<ListedItem[]>>();
export function loadItemList(mode: GameMode, lang: string): Promise<ListedItem[]> {
  const key = `${mode}:${lang}`;
  let p = items.get(key);
  if (!p) {
    p = Promise.all([fetchTranslations(`${mode}/items`, lang), lang === "en" ? null : fetchTranslations(`${mode}/items`, "en")]).then(([primary, en]) => {
      const list = parseItemList(primary, en ?? primary, lang);
      if (list.length === 0) throw new Error("items");
      return list;
    });
    p.catch(() => items.delete(key)); // échec : on réessaiera à la prochaine ouverture
    items.set(key, p);
  }
  return p;
}

export interface HideoutInfo {
  uses: Map<string, HideoutUse[]>;
  stationName: Record<string, string>;
}
const hideouts = new Map<string, Promise<HideoutInfo>>();
export function loadHideout(mode: GameMode, lang: string): Promise<HideoutInfo> {
  const key = `${mode}:${lang}`;
  let p = hideouts.get(key);
  if (!p) {
    p = fetchEndpoint(`${mode}/hideout`, lang).then(({ data, t }) => {
      const stationName: Record<string, string> = {};
      for (const s of Object.values(data) as { id?: string; name?: string }[]) if (s?.id) stationName[s.id] = t(s.name);
      return { uses: buildHideoutIndex(data), stationName };
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
