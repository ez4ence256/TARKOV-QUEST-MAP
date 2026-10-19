// Item finder, onglet « Où le trouver » : sections d'emplacement de la page de l'objet sur le wiki
// anglais. Objet : « Location » (contenants où il apparaît, puis emplacements connus map par map).
// Clé : « Key Location », « Lock Location », « Behind the Lock ». Photos rangées sous leur sous-titre.
// 1 page + 1 requête d'images par objet ouvert, gardées en mémoire seulement (le localStorage est
// presque plein, et une page d'objet est vite relue).
import { stepGalleries } from "../lib/story";
import { cleanInline, parseBlocks, parseInfobox, splitSections, wikiLinkTargets, type WikiBlock } from "../lib/wikiText";
import { fetchImageInfo, fileTitle, pageUrlFor, wikiRequest, type WikiPhoto } from "./wiki";

/** Sections lues, dans cet ordre (titres anglais du wiki). */
export const LOCATION_SECTIONS = ["Location", "Key Location", "Lock Location", "Behind the Lock"] as const;
export type LocationSectionTitle = (typeof LOCATION_SECTIONS)[number];

export interface LocationSection {
  title: LocationSectionTitle;
  /** Texte (sous-titres = maps). */
  blocks: WikiBlock[];
  /** Photos, chacune avec sa sous-partie (`section` : nombre de sous-titres avant elle). */
  photos: WikiPhoto[];
}

export interface ItemLocation {
  pageUrl: string;
  /** false : pas de page de ce nom sur le wiki. */
  exists: boolean;
  sections: LocationSection[];
  /** Pages liées depuis ces sections (ex. « Relaxation room key ») : confirme une porte. */
  links: string[];
  /** Clé : ce qu'elle ouvre (champ « usage » de l'infobox), en texte brut. */
  usage?: string;
}

/** Sections d'emplacement d'une page d'objet : texte et galeries rangées par map. */
export function parseItemLocation(wikitext: string, title: string) {
  const sections = splitSections(wikitext).sections;
  return LOCATION_SECTIONS.flatMap((name) => {
    const body = sections.find((s) => s.title.toLowerCase() === name.toLowerCase())?.body;
    return body === undefined ? [] : [{ title: name, blocks: parseBlocks(body, title), files: stepGalleries(body, title), links: wikiLinkTargets(body) }];
  });
}

const loaded = new Map<string, Promise<ItemLocation>>();

export function loadItemLocation(title: string): Promise<ItemLocation> {
  let p = loaded.get(title);
  if (!p) {
    p = fetchItemLocation(title);
    p.catch(() => loaded.delete(title)); // échec réseau : on réessaiera
    loaded.set(title, p);
  }
  return p;
}

async function fetchItemLocation(title: string): Promise<ItemLocation> {
  let json: Record<string, unknown>;
  try {
    json = await wikiRequest({ action: "parse", page: title, prop: "wikitext", redirects: "1" });
  } catch (error) {
    if ((error as { code?: string }).code === "missingtitle") return { pageUrl: pageUrlFor(title), exists: false, sections: [], links: [] };
    throw error;
  }
  const parsed = (json.parse ?? {}) as { title?: string; wikitext?: string };
  const finalTitle = parsed.title ?? title;
  const wikitext = String(parsed.wikitext ?? "");
  const read = parseItemLocation(wikitext, finalTitle);
  const usage = cleanInline(parseInfobox(wikitext, "key").usage ?? "", finalTitle) || undefined;
  const files = read.flatMap((s) => s.files.map((f) => f.file));
  const info = files.length > 0 ? await fetchImageInfo(files) : new Map();
  const sections = read.map((s) => ({
    title: s.title,
    blocks: s.blocks,
    photos: s.files.flatMap((f) => {
      const image = info.get(fileTitle(f.file))?.imageinfo?.[0];
      // fichier absent du wiki ou sans adresse : pas affiché
      if (!image?.url || !image.descriptionurl) return [];
      return [{ file: f.file, caption: f.caption, thumbUrl: image.thumburl ?? image.url, fullUrl: image.url, pageUrl: image.descriptionurl, section: f.section }];
    }),
  }));
  return { pageUrl: pageUrlFor(finalTitle), exists: true, sections, links: read.flatMap((s) => s.links), usage };
}
