// Seul accès de l'app au wiki Escape from Tarkov (Fandom), via son API MediaWiki
// (api.php, autorisée par le robots.txt du wiki). Sert aux onglets Quête et Photos.
//
// Règles suivies :
//  - uniquement à la demande (onglet ouvert sur une quête), une quête à la fois ;
//  - au plus une requête par seconde vers le wiki (file d'attente commune) ;
//  - cache local de 7 jours ;
//  - une seule requête "parse" par quête (wikitext + catégories), partagée par
//    les deux onglets ; les photos ajoutent une requête "imageinfo".
//  - seules les galeries de la section "Guide" sont gardées comme photos : les
//    légendes ne donnent pas de coordonnées, une photo est rattachée à la quête.
// Licences : texte CC BY-NC-SA ; images sans licence indiquée (voir CREDITS.md).

import { tr } from "../lib/i18n";

export const WIKI_HOST = "escapefromtarkov.fandom.com";
const WIKI_API = `https://${WIKI_HOST}/api.php`;
const CACHE_PREFIX = "tqp:wiki:v2:";
/** Préfixe de l'ancien cache (photos seules), nettoyé au premier accès. */
const OLD_CACHE_PREFIX = "tqp:wiki:v1:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Pause minimale entre deux requêtes au wiki. */
const REQUEST_GAP_MS = 1000;
/** Largeur des vignettes demandées au wiki. */
const THUMB_WIDTH = 480;

export interface WikiPhoto {
  /** Nom du fichier sur le wiki (sans "File:"). */
  file: string;
  /** Légende du wiki, en texte brut (anglais, non traduite). */
  caption: string;
  thumbUrl: string;
  fullUrl: string;
  /** Page du fichier sur le wiki (source). */
  pageUrl: string;
}

export interface WikiGallery {
  pageUrl: string;
  photos: WikiPhoto[];
  fetchedAt: number;
}

/** Titre de page wiki à partir du wikiLink fourni par tarkov.dev (null si ce n'est pas ce wiki). */
export function wikiTitleFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.hostname !== WIKI_HOST || !url.pathname.startsWith("/wiki/")) return null;
    return decodeURIComponent(url.pathname.slice("/wiki/".length)).replace(/_/g, " ");
  } catch {
    return null;
  }
}

/** Légende wiki -> texte brut (liens, gras, modèles et balises retirés ; <br> -> retour à la ligne). */
export function cleanCaption(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Texte de la section "Guide" (jusqu'au titre de même niveau suivant). */
function guideSection(wikitext: string): string {
  const start = wikitext.match(/^==\s*Guide\s*==\s*$/m);
  if (!start || start.index === undefined) return "";
  const rest = wikitext.slice(start.index + start[0].length);
  const next = rest.search(/^==[^=].*==\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** Options de ligne de galerie MediaWiki, à ne pas prendre pour une légende. */
const GALLERY_OPTION = /^\s*(alt|link|page|lang|class)\s*=/i;

/** Photos des galeries de la section Guide : nom de fichier + légende. */
export function parseGuideGalleries(wikitext: string): { file: string; caption: string }[] {
  const photos: { file: string; caption: string }[] = [];
  for (const gallery of guideSection(wikitext).matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi)) {
    for (const line of gallery[1].split("\n")) {
      const match = line.trim().match(/^(?:File|Image):([^|]+)(?:\|(.*))?$/i);
      if (!match) continue;
      const caption = (match[2] ?? "")
        .split("|")
        .filter((part) => !GALLERY_OPTION.test(part))
        .join("|");
      photos.push({ file: match[1].trim(), caption: cleanCaption(caption) });
    }
  }
  return photos;
}

// --- Requêtes au wiki, une par seconde au plus ---

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function wikiRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" })}`;
  const run = queue.then(async () => {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wiki: HTTP ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    const error = json.error as { code?: string; info?: string } | undefined;
    if (error) throw Object.assign(new Error(`wiki: ${error.info ?? tr("erreur", "error")}`), { code: error.code });
    return json;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Normalisation MediaWiki d'un titre de fichier ("SA house1.png" -> "File:SA house1.png"). */
const fileTitle = (file: string) => {
  const name = file.replace(/_/g, " ").trim();
  return `File:${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};

interface ImageInfoPage {
  title: string;
  missing?: boolean;
  imageinfo?: { url?: string; thumburl?: string; descriptionurl?: string }[];
}

/** Adresses des vignettes et des pages de fichiers, par lots de 50 (limite de l'API). */
async function fetchImageInfo(files: string[]): Promise<Map<string, ImageInfoPage>> {
  const byTitle = new Map<string, ImageInfoPage>();
  const titles = [...new Set(files.map(fileTitle))];
  for (let i = 0; i < titles.length; i += 50) {
    const json = await wikiRequest({
      action: "query",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: String(THUMB_WIDTH),
      titles: titles.slice(i, i + 50).join("|"),
    });
    const query = (json.query ?? {}) as { pages?: ImageInfoPage[]; normalized?: { from: string; to: string }[] };
    for (const page of query.pages ?? []) byTitle.set(page.title, page);
    // titre demandé -> titre normalisé par le wiki
    for (const n of query.normalized ?? []) {
      const page = byTitle.get(n.to);
      if (page) byTitle.set(n.from, page);
    }
  }
  return byTitle;
}

function readCache<T extends { fetchedAt: number }>(key: string): T | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) ?? "null") as T | null;
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    for (const old of Object.keys(localStorage)) {
      if (old.startsWith(OLD_CACHE_PREFIX)) localStorage.removeItem(old);
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* stockage plein : on s'en passe */
  }
}

/** Page wiki d'une quête, telle que renvoyée par action=parse. */
export interface WikiPage {
  /** Titre final, après redirection éventuelle. */
  title: string;
  pageUrl: string;
  /** false si la page n'existe pas : rien n'est alors affiché du wiki. */
  exists: boolean;
  wikitext: string;
  /** Catégories de la page, sans le préfixe "Category:" (ex. "Quests", "Historical content"). */
  categories: string[];
  fetchedAt: number;
}

const pageUrlFor = (title: string) => `https://${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Requêtes en cours, pour que les onglets Quête et Photos partagent la même. */
const inFlight = new Map<string, Promise<WikiPage>>();

/** Page wiki d'une quête (une requête parse, cache 7 jours, partagée entre les onglets). */
export function loadWikiPage(wikiLink: string): Promise<WikiPage> {
  const title = wikiTitleFromLink(wikiLink);
  if (!title) return Promise.reject(new Error(tr("Lien wiki non reconnu", "Unrecognized wiki link")));
  const cached = readCache<WikiPage>(`page:${title}`);
  if (cached) return Promise.resolve(cached);
  let pending = inFlight.get(title);
  if (!pending) {
    pending = fetchWikiPage(title).finally(() => inFlight.delete(title));
    inFlight.set(title, pending);
  }
  return pending;
}

async function fetchWikiPage(title: string): Promise<WikiPage> {
  let page: WikiPage;
  try {
    const json = await wikiRequest({ action: "parse", page: title, prop: "wikitext|categories", redirects: "1" });
    const parsed = (json.parse ?? {}) as { title?: string; wikitext?: string; categories?: { category?: string }[] };
    const finalTitle = parsed.title ?? title;
    page = {
      title: finalTitle,
      pageUrl: pageUrlFor(finalTitle),
      exists: true,
      wikitext: String(parsed.wikitext ?? ""),
      categories: (parsed.categories ?? []).map((c) => String(c.category ?? "").replace(/_/g, " ")).filter(Boolean),
      fetchedAt: Date.now(),
    };
  } catch (error) {
    if ((error as { code?: string }).code !== "missingtitle") throw error;
    page = { title, pageUrl: pageUrlFor(title), exists: false, wikitext: "", categories: [], fetchedAt: Date.now() };
  }
  writeCache(`page:${title}`, page);
  return page;
}

/**
 * Photos d'emplacements d'une quête (section Guide de sa page wiki).
 * Renvoie une galerie vide si la page n'en a pas : rien n'est inventé.
 */
export function loadQuestPhotos(wikiLink: string): Promise<WikiGallery> {
  const title = wikiTitleFromLink(wikiLink);
  if (!title) return Promise.reject(new Error(tr("Lien wiki non reconnu", "Unrecognized wiki link")));
  const cached = readCache<WikiGallery>(`photos:${title}`);
  if (cached) return Promise.resolve(cached);
  // une demande déjà en cours (autre onglet, double rendu) est réutilisée
  let pending = photosInFlight.get(title);
  if (!pending) {
    pending = fetchQuestPhotos(wikiLink, title).finally(() => photosInFlight.delete(title));
    photosInFlight.set(title, pending);
  }
  return pending;
}

const photosInFlight = new Map<string, Promise<WikiGallery>>();

async function fetchQuestPhotos(wikiLink: string, title: string): Promise<WikiGallery> {
  const page = await loadWikiPage(wikiLink);
  const entries = page.exists ? parseGuideGalleries(page.wikitext) : [];
  const info = entries.length > 0 ? await fetchImageInfo(entries.map((e) => e.file)) : new Map();

  const photos: WikiPhoto[] = [];
  for (const entry of entries) {
    const image = info.get(fileTitle(entry.file))?.imageinfo?.[0];
    // fichier absent ou sans adresse : on ne l'affiche pas
    if (!image?.url || !image.descriptionurl) continue;
    photos.push({
      file: entry.file,
      caption: entry.caption,
      thumbUrl: image.thumburl ?? image.url,
      fullUrl: image.url,
      pageUrl: image.descriptionurl,
    });
  }
  const gallery: WikiGallery = { pageUrl: page.pageUrl, photos, fetchedAt: Date.now() };
  writeCache(`photos:${title}`, gallery);
  return gallery;
}

// --- Photos des sorties (tableaux « Extractions » et « Transits » de la page d'une map) ---

export interface ExitPhotoEntry {
  /** Nom de la sortie sur le wiki (anglais). */
  name: string;
  photos: WikiPhoto[];
}

export interface ExitPhotosPage {
  pageUrl: string;
  /** Sections « Extractions » du wiki, pour le lien de repli. */
  entries: ExitPhotoEntry[];
  fetchedAt: number;
}

const IMAGE_FILE = /\.(png|jpe?g|webp|gif)$/i;

/** Texte d'une section de niveau 2 (jusqu'au titre suivant). */
function sectionText(wikitext: string, names: string[]): string {
  const start = wikitext.match(new RegExp(`^==\s*(?:${names.join("|")})\s*==\s*$`, "mi"));
  if (!start || start.index === undefined) return "";
  const rest = wikitext.slice(start.index + start[0].length);
  const next = rest.search(/^==[^=].*==\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * Sorties du wiki et leurs photos : une ligne de tableau par sortie, le nom dans la cellule
 * « ! ... |Nom », les photos dans les [[File:...]] de la ligne (liens-icônes et sons ignorés).
 * Légende = texte qui suit la photo sur sa ligne (vide pour la vignette de la 1re colonne).
 */
export function parseExitTables(wikitext: string): { name: string; photos: { file: string; caption: string }[] }[] {
  const entries: { name: string; photos: { file: string; caption: string }[] }[] = [];
  // le premier morceau de chaque section est l'en-tête du tableau
  const rows = [sectionText(wikitext, ["Extractions", "Extracts"]), sectionText(wikitext, ["Transits"])].flatMap((section) =>
    section.split(/^\|-.*$/m).slice(1),
  );
  for (const row of rows) {
    const name = row.match(/^!(?!\s*\[\[)[^|\n]*\|\s*(.+?)\s*$/m)?.[1] ?? row.match(/^!(?!\s*\[\[)\s*([^\n=|]+?)\s*$/m)?.[1];
    if (!name) continue;
    const photos: { file: string; caption: string }[] = [];
    for (const m of row.matchAll(/\[\[(?:File|Image):([^|\]]+)([^\]\n]*)\]\]([^\n]*)/gi)) {
      const file = m[1].trim();
      if (!IMAGE_FILE.test(file) || /\blink=/i.test(m[2]) || photos.some((p) => p.file === file)) continue;
      photos.push({ file, caption: cleanCaption(m[3].replace(/\[\[(?:File|Image):[\s\S]*$/i, "")) });
    }
    entries.push({ name: cleanCaption(name), photos });
  }
  return entries;
}

/** Clé de comparaison d'un nom de sortie : sans casse, ponctuation ni parenthèses ("(Co-op)", "(Flare)"). */
export function exitKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Photos du wiki pour une sortie (nom anglais), [] si le wiki n'en a pas. */
export function photosForExit(page: ExitPhotosPage, nameEn: string): WikiPhoto[] {
  const key = exitKey(nameEn);
  return key ? page.entries.filter((e) => exitKey(e.name) === key).flatMap((e) => e.photos) : [];
}

const exitPhotosInFlight = new Map<string, Promise<ExitPhotosPage>>();

/**
 * Photos des sorties d'une map : une page parse + une requête imageinfo, en cache 7 jours,
 * déclenchées à la première bulle de sortie ouverte sur cette map.
 */
export function loadExitPhotos(mapTitle: string): Promise<ExitPhotosPage> {
  const cached = readCache<ExitPhotosPage>(`exits:${mapTitle}`);
  if (cached) return Promise.resolve(cached);
  let pending = exitPhotosInFlight.get(mapTitle);
  if (!pending) {
    pending = fetchExitPhotos(mapTitle).finally(() => exitPhotosInFlight.delete(mapTitle));
    exitPhotosInFlight.set(mapTitle, pending);
  }
  return pending;
}

async function fetchExitPhotos(mapTitle: string): Promise<ExitPhotosPage> {
  const page = await loadWikiPage(pageUrlFor(mapTitle));
  const parsed = page.exists ? parseExitTables(page.wikitext) : [];
  const files = parsed.flatMap((e) => e.photos.map((p) => p.file));
  const info = files.length > 0 ? await fetchImageInfo(files) : new Map<string, ImageInfoPage>();
  const entries = parsed.map((entry) => ({
    name: entry.name,
    photos: entry.photos.flatMap((p): WikiPhoto[] => {
      const image = info.get(fileTitle(p.file))?.imageinfo?.[0];
      if (!image?.url || !image.descriptionurl) return [];
      return [{ file: p.file, caption: p.caption, thumbUrl: image.thumburl ?? image.url, fullUrl: image.url, pageUrl: image.descriptionurl }];
    }),
  }));
  const result: ExitPhotosPage = { pageUrl: page.pageUrl, entries, fetchedAt: Date.now() };
  writeCache(`exits:${mapTitle}`, result);
  return result;
}
