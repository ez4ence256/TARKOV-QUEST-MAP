// Chargement des chapitres de l'histoire (Main story) depuis le wiki Escape from Tarkov.
// Tout passe par src/api/wiki.ts : même file d'attente (une requête par seconde), même cache de
// 7 jours. Requêtes, et seulement quand on en a besoin :
//  - liste des chapitres : 1 requête (+ 1 pour la liste française en mode français) ;
//  - un chapitre, la première fois qu'il est ouvert ou affiché : 1 page + 1 requête d'images
//    (+ 1 pour les modèles de fins de The Ticket) ; sa version française, en mode français,
//    seulement si la liste française dit que la page existe.
// On garde en cache le résultat lu (texte brut, adresses des photos), pas le wikitext.

import { tr } from "../lib/i18n";
import {
  buildChapters,
  parseChapterList,
  parseStoryPage,
  storyTemplateNames,
  type ChapterRow,
  type StoryChapter,
  type StoryStep,
  type StoryPage,
} from "../lib/story";
import { fetchImageInfo, fileTitle, pageUrlFor, readCache, writeCache, wikiRequest, type WikiLang } from "./wiki";

const LIST_TITLE: Record<WikiLang, string> = { en: "Story chapters", fr: "Chapitres de l'histoire" };

interface ListCache {
  rows: ChapterRow[];
  /** Titres de la liste qui ont une page (les autres sont des liens rouges). */
  existing: string[];
  fetchedAt: number;
}

const listInFlight = new Map<WikiLang, Promise<ListCache>>();

function loadList(lang: WikiLang): Promise<ListCache> {
  const cached = readCache<ListCache>(`story:list:${lang}`);
  if (cached) return Promise.resolve(cached);
  let pending = listInFlight.get(lang);
  if (!pending) {
    pending = (async () => {
      const json = await wikiRequest({ action: "parse", page: LIST_TITLE[lang], prop: "wikitext|links", redirects: "1" }, lang);
      const parsed = (json.parse ?? {}) as { wikitext?: string; links?: { title?: string; exists?: boolean }[] };
      const rows = parseChapterList(String(parsed.wikitext ?? ""));
      if (rows.length === 0) throw new Error(tr("Liste des chapitres introuvable", "Chapter list not found"));
      // EN : les pages de la catégorie absentes du tableau (futurs chapitres) sont ajoutées à la suite
      let complete = true;
      if (lang === "en") {
        try {
          rows.push(...(await categoryExtras(new Set(rows.map((r) => r.title)))));
        } catch {
          complete = false; // le tableau suffit ; sans cache, la catégorie sera redemandée
        }
      }
      const existing = (parsed.links ?? []).filter((l) => l.exists && l.title).map((l) => String(l.title));
      const value: ListCache = { rows, existing, fetchedAt: Date.now() };
      if (complete) writeCache(`story:list:${lang}`, value);
      return value;
    })().finally(() => listInFlight.delete(lang));
    listInFlight.set(lang, pending);
  }
  return pending;
}

/** Pages de « Category:Story chapters » (articles, hors redirections et hors la liste) qui ne sont pas dans le tableau. */
async function categoryExtras(known: Set<string>): Promise<ChapterRow[]> {
  const json = await wikiRequest({
    action: "query",
    generator: "categorymembers",
    gcmtitle: "Category:Story_chapters",
    gcmnamespace: "0",
    gcmlimit: "100",
    prop: "info",
  });
  const pages = ((json.query ?? {}) as { pages?: { title?: string; redirect?: boolean }[] }).pages ?? [];
  return pages
    .filter((p) => p.title && !p.redirect && p.title !== LIST_TITLE.en && !known.has(p.title))
    .sort((a, b) => a.title!.localeCompare(b.title!))
    .map((p) => ({ title: p.title!, name: p.title!.replace(/ \((?:story )?chapter\)$/i, ""), icon: `category:${p.title}` }));
}

/**
 * Chapitres dans l'ordre du wiki anglais. En français, les noms viennent de la liste française
 * (si elle ne répond pas, les noms anglais sont gardés : seul l'anglais est indispensable).
 */
export async function loadStoryChapters(lang: WikiLang): Promise<StoryChapter[]> {
  const en = await loadList("en");
  let fr: ListCache | null = null;
  if (lang === "fr") {
    try {
      fr = await loadList("fr");
    } catch {
      fr = null;
    }
  }
  return buildChapters(en.rows, fr?.rows ?? null, fr ? new Set(fr.existing) : undefined);
}

/** Un chapitre lu : texte brut et photos résolues, dans une langue. */
export interface StoryPageData extends StoryPage {
  title: string;
  lang: WikiLang;
  pageUrl: string;
  /** false si la page n'existe pas. */
  exists: boolean;
  steps: StoryStep[];
  fetchedAt: number;
}

/** Contenu des modèles (ex. « Template:The Ticket Section Savior Guide ») du wiki de la langue, en une requête. */
async function fetchTemplates(names: string[], lang: WikiLang): Promise<Record<string, string>> {
  const json = await wikiRequest({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: names.map((n) => `Template:${n}`).join("|"),
  }, lang);
  const pages = ((json.query ?? {}) as { pages?: { title: string; revisions?: { slots?: { main?: { content?: string } } }[] }[] }).pages ?? [];
  const result: Record<string, string> = {};
  for (const p of pages) {
    const content = p.revisions?.[0]?.slots?.main?.content;
    // le préfixe dépend du wiki (« Template: », « Modèle: » en français)
    if (content !== undefined) result[p.title.replace(/^[^:]+:/, "")] = content;
  }
  return result;
}

// Cache compact : le localStorage est limité à 5 Mo et les chapitres ont jusqu'à 300 photos.
// Une photo = [fichier, vignette, image] (adresses sans le préfixe du CDN de Fandom) ; la légende
// vient de `files`, la page du fichier se déduit du nom.
const CDN = "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/";
type StoredStep = Omit<StoryStep, "photos"> & { photos?: [string, string, string][] };
type StoredPage = Omit<StoryPageData, "steps" | "requirements"> & { steps: StoredStep[]; requirements: StoredStep[] };

const compactUrl = (u: string) => (u.startsWith(CDN) ? u.slice(CDN.length) : u);
const expandUrl = (u: string) => (u.startsWith("http") ? u : CDN + u);

const compactStep = (s: StoryStep): StoredStep => ({ ...s, photos: s.photos?.map((p): [string, string, string] => [p.file, compactUrl(p.thumbUrl), compactUrl(p.fullUrl)]) });

const compactPage = (page: StoryPageData): StoredPage => ({ ...page, steps: page.steps.map(compactStep), requirements: page.requirements.map(compactStep) });

const expandPage = (page: StoredPage): StoryPageData => {
  const expand = (s: StoredStep): StoryStep => ({
    ...s,
    photos: s.photos?.map(([file, thumb, full]) => ({
      file,
      caption: s.files.find((f) => f.file === file)?.caption ?? "",
      thumbUrl: expandUrl(thumb),
      fullUrl: expandUrl(full),
      pageUrl: pageUrlFor(`File:${file}`, page.lang).replace("File%3A", "File:"),
    })),
  });
  return { ...page, steps: page.steps.map(expand), requirements: page.requirements.map(expand) };
};

const pageInFlight = new Map<string, Promise<StoryPageData>>();

/** Chapitre d'une langue : 1 page + 1 requête d'images (+ modèles de fins). Cache 7 jours. */
export function loadStoryPage(title: string, lang: WikiLang): Promise<StoryPageData> {
  const key = `${lang}:${title}`;
  const cached = readCache<StoredPage>(`story:${key}`);
  // sans `requirements` : chapitre mis en cache avant l'ajout des conditions, relu une fois sur le wiki
  if (cached && Array.isArray(cached.requirements) && cached.previous !== undefined) {
    try {
      return Promise.resolve(expandPage(cached));
    } catch {
      /* entrée d'un ancien format ou abîmée : on la relit sur le wiki */
    }
  }
  let pending = pageInFlight.get(key);
  if (!pending) {
    pending = fetchStoryPage(title, lang).finally(() => pageInFlight.delete(key));
    pageInFlight.set(key, pending);
  }
  return pending;
}

async function fetchStoryPage(title: string, lang: WikiLang): Promise<StoryPageData> {
  let data: StoryPageData;
  try {
    const json = await wikiRequest({ action: "parse", page: title, prop: "wikitext", redirects: "1" }, lang);
    const parsed = (json.parse ?? {}) as { title?: string; wikitext?: string };
    const finalTitle = parsed.title ?? title;
    const wikitext = String(parsed.wikitext ?? "");
    const templateNames = storyTemplateNames(wikitext);
    const templates = templateNames.length > 0 ? await fetchTemplates(templateNames, lang) : {};
    const page = parseStoryPage(wikitext, finalTitle, templates);
    const files = [...page.requirements, ...page.steps].flatMap((s) => s.files.map((f) => f.file));
    const info = files.length > 0 ? await fetchImageInfo(files, lang) : new Map();
    const withPhotos = (step: StoryStep): StoryStep => ({
      ...step,
      photos: step.files.flatMap((f) => {
        const image = info.get(fileTitle(f.file))?.imageinfo?.[0];
        // fichier absent du wiki ou sans adresse : pas affiché
        if (!image?.url || !image.descriptionurl) return [];
        return [{ file: f.file, caption: f.caption, thumbUrl: image.thumburl ?? image.url, fullUrl: image.url, pageUrl: image.descriptionurl }];
      }),
    });
    data = { ...page, steps: page.steps.map(withPhotos), requirements: page.requirements.map(withPhotos), title: finalTitle, lang, pageUrl: pageUrlFor(finalTitle, lang), exists: true, fetchedAt: Date.now() };
  } catch (error) {
    if ((error as { code?: string }).code !== "missingtitle") throw error;
    data = { requirements: [], previous: null, objectives: [], steps: [], title, lang, pageUrl: pageUrlFor(title, lang), exists: false, fetchedAt: Date.now() };
  }
  writeCache(`story:${lang}:${title}`, compactPage(data));
  return data;
}
