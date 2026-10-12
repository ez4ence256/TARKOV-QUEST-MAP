// Images de choix de map (bannière de l'infobox de chaque page de map du wiki).
// Coût : 2 requêtes au total (wikitexte des maps en un lot, puis imageinfo en un lot), cache 7 jours.
import { fetchImageInfo, fileTitle, readCache, wikiRequest, writeCache } from "./wiki";

/** Fichier de l'infobox « Infobox location » (`|image = ...`), null si absent. */
export function infoboxImage(wikitext: string): string | null {
  const file = wikitext.match(/^\s*\|\s*image\s*=\s*([^\n|]+)/m)?.[1].replace(/^(?:File|Image):/i, "").trim();
  return file || null;
}

export interface MapImages {
  /** Titre wiki de la map (anglais) -> vignette ; absent = pas d'image. */
  byTitle: Record<string, string>;
  fetchedAt: number;
}

let inFlight: Promise<MapImages> | null = null;

export function loadMapImages(titles: string[]): Promise<MapImages> {
  const key = `mapimg:${[...titles].sort().join("|")}`;
  const cached = readCache<MapImages>(key);
  if (cached) return Promise.resolve(cached);
  inFlight ??= fetchMapImages(titles, key).finally(() => (inFlight = null));
  return inFlight;
}

async function fetchMapImages(titles: string[], key: string): Promise<MapImages> {
  const json = await wikiRequest({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: titles.slice(0, 50).join("|"),
  });
  const query = (json.query ?? {}) as {
    pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[];
    redirects?: { from: string; to: string }[];
  };
  const fileOf = new Map<string, string>(); // titre de page -> fichier
  for (const p of query.pages ?? []) {
    const file = infoboxImage(p.revisions?.[0]?.slots?.main?.content ?? "");
    if (file) fileOf.set(p.title, file);
  }
  const info = fileOf.size > 0 ? await fetchImageInfo([...fileOf.values()]) : new Map();
  const byTitle: Record<string, string> = {};
  for (const title of titles) {
    const page = query.redirects?.find((r) => r.from === title)?.to ?? title;
    const file = fileOf.get(page);
    const image = file ? info.get(fileTitle(file))?.imageinfo?.[0] : undefined;
    if (image?.thumburl ?? image?.url) byTitle[title] = (image.thumburl ?? image.url) as string;
  }
  const result: MapImages = { byTitle, fetchedAt: Date.now() };
  writeCache(key, result);
  return result;
}
