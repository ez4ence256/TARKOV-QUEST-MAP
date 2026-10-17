// Main story : chapitres de l'histoire du wiki Escape from Tarkov, lus étape par étape.
//
// Structure relevée sur les 10 pages anglaises et 8 pages françaises (session 7) :
//  - page « Story chapters » (FR : « Chapitres de l'histoire ») : un tableau, une ligne par
//    chapitre, avec l'icône (même nom de fichier dans les deux langues) et le lien de la page ;
//  - page d'un chapitre : == Objectives == (puces, parfois des sous-titres de branche), puis
//    == Guide == dont chaque étape est un titre === … === suivi de texte, de tableaux et de
//    <gallery> ; les titres plus profonds (==== Rewards ====) restent dans le texte de l'étape ;
//  - The Ticket : le Guide contient un onglet qui inclut quatre modèles (un par fin) ; leurs
//    étapes ne sont pas dans le wikitext de la page, il faut aller chercher les modèles.
// Tout est converti en texte brut (aucun HTML du wiki n'est inséré). Voir src/api/story.ts.

import { parseGalleries, type WikiPhoto } from "../api/wiki";
import { tr } from "./i18n";
import { cleanInline, findSection, parseBlocks, parseInfobox, splitSections, wikiLinkTargets, type WikiBlock } from "./wikiText";

// --- Liste des chapitres ---

export interface ChapterRow {
  /** Titre de la page du chapitre (tel que lié par la liste). */
  title: string;
  /** Nom affiché dans la liste. */
  name: string;
  /** Fichier d'icône, identique dans le wiki anglais et le wiki français : sert à les associer. */
  icon: string;
}

const iconKey = (file: string) => file.replace(/_/g, " ").trim().toLowerCase();

/** Tableau de la page « Story chapters » : une ligne par chapitre, dans l'ordre du wiki. */
export function parseChapterList(wikitext: string): ChapterRow[] {
  const rows: ChapterRow[] = [];
  for (const row of wikitext.split(/^\|-.*$/m)) {
    const icon = row.match(/\[\[(?:File|Image|Fichier):([^|\]\n]+)/i)?.[1];
    const link = row.match(/^\|[ \t]*\[\[(?!(?:File|Image|Fichier):)([^|\]\n]+)(?:\|([^\]\n]*))?\]\][ \t]*$/im);
    if (!icon || !link) continue;
    const title = link[1].trim().replace(/_/g, " ");
    rows.push({ title, name: (link[2] ?? title).trim() || title, icon: iconKey(icon) });
  }
  return rows;
}

export interface StoryChapter {
  /** Titre de la page anglaise : sert d'identifiant (sélection, progression). */
  id: string;
  nameEn: string;
  /** Nom français du wiki FR (= nameEn si la liste FR n'est pas chargée). */
  name: string;
  /** Titre de la page française, seulement si elle existe. */
  frTitle: string | null;
}

/**
 * Chapitres dans l'ordre du wiki anglais ; les lignes françaises sont associées par le nom
 * de l'icône. `frExisting` : titres des pages FR qui existent (les autres sont des liens rouges).
 */
export function buildChapters(en: ChapterRow[], fr: ChapterRow[] | null, frExisting?: Set<string>): StoryChapter[] {
  const frByIcon = new Map((fr ?? []).map((r) => [r.icon, r]));
  return en.map((row) => {
    const match = frByIcon.get(row.icon);
    return {
      id: row.title,
      nameEn: row.name,
      name: match?.name ?? row.name,
      frTitle: match && (!frExisting || frExisting.has(match.title)) ? match.title : null,
    };
  });
}

// --- Page d'un chapitre ---

export interface StoryStep {
  /** Titre de l'étape, en texte brut. */
  title: string;
  /** Fin concernée (The Ticket : « Savior », « Debtor »…), absente pour les étapes communes. */
  branch?: string;
  blocks: WikiBlock[];
  /** Photos des galeries de l'étape, telles qu'écrites dans le wikitext ; `section` : nombre de sous-titres avant la galerie. */
  files: { file: string; caption: string; section?: number }[];
  /** Photos résolues par le wiki (adresses), remplies par le chargement. */
  photos?: WikiPhoto[];
}

export interface StoryPage {
  /** Conditions pour débloquer le chapitre (section Requirements / Prérequis), une case chacune. */
  requirements: StoryStep[];
  /** Chapitre précédent d'après l'infobox (« previous »), seulement sans section Requirements ; null sinon. */
  previous: string | null;
  objectives: WikiBlock[];
  steps: StoryStep[];
}

/** Icônes de fins ([[File:Savior icon.png|Savior ending|…]]) -> « (Savior ending, Debtor ending) ». */
function labelEndings(line: string): string {
  return line.replace(/(?:\[\[(?:File|Image):[^\]]*?\|[^|\]]*ending[^\]]*\]\])+/gi, (run) => {
    const names = [...run.matchAll(/\[\[(?:File|Image):[^|\]]*\|([^|\]]*ending)/gi)].map((m) => m[1].trim());
    return ` (${names.join(", ")})`;
  });
}

/**
 * Le wiki FR écrit les noms d'objets en {{<identifiant tarkov.dev>}} (26 occurrences dans « Le
 * labyrinthe », 82 dans « Batya ») : retirés par le nettoyage du texte, ils laisseraient des
 * trous (« nécessite la . »). On les garde sous forme de repère sans accolades, remplacé à
 * l'affichage par le nom de l'objet de tarkov.dev (voir fillItems).
 */
export const ITEM_MARK = /⟦item:([0-9a-f]{24})⟧/g;
const markItems = (text: string) => text.replace(/\{\{([0-9a-f]{24})\}\}/g, "⟦item:$1⟧");

/** Remplace les repères d'objets par leur nom ; « […] » (jamais un trou silencieux) si l'objet est inconnu. */
export function fillItems(text: string, itemNames: Record<string, string>): string {
  return text.replace(ITEM_MARK, (_, id: string) => itemNames[id] ?? "[…]");
}

/** Titres =, ==, === : on y ajoute les fins repérées par leurs icônes. */
const labelHeadings = (text: string) =>
  markItems(text)
    .split("\n")
    .map((line) => (/^=+/.test(line) ? labelEndings(line) : line))
    .join("\n");

const SECTION_OBJECTIVES = ["Objectives", "Objectifs"];
// FR : « Prérequis » (5 pages), « Conditions » (Boreas)
const SECTION_REQUIREMENTS = ["Requirements", "Prérequis", "Conditions", "Exigences"];

/**
 * Section Requirements -> une condition par case : une puce seule, ou une phrase suivie de puces
 * (« Visitez l'un des lieux suivants : » + les lieux, qui restent dans le texte de la case).
 * Les galeries sont rattachées au texte qui les précède. Le Labyrinthe : « Localisez le transit… ».
 */
export function parseRequirements(body: string, pageTitle: string): StoryStep[] {
  const galleries: string[] = [];
  const lines = markItems(body)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<gallery[\s\S]*?<\/gallery>/gi, (g) => `\n@@gallery${galleries.push(g) - 1}\n`)
    .replace(/<\/?li[^>]*>/gi, "")
    .split("\n");
  type Token = { bullet: boolean; text: string; sub: string[]; gallery: string[] };
  const tokens: Token[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const gallery = line.match(/^@@gallery(\d+)$/);
    const bullet = line.match(/^\*(?![*#])\s*(.*)$/);
    const last = tokens[tokens.length - 1];
    if (gallery) last?.gallery.push(galleries[Number(gallery[1])]);
    else if (bullet) tokens.push({ bullet: true, text: bullet[1], sub: [], gallery: [] });
    else if (/^[*#]/.test(line) && last) last.sub.push(line);
    else tokens.push({ bullet: false, text: line, sub: [], gallery: [] });
  }
  const steps: StoryStep[] = [];
  const add = (head: Token, list: Token[]) => {
    // « the [[The Labyrinth]] transit » s'écrit « the The Labyrinth » : l'article en double est retiré
    const title = cleanInline(head.text, pageTitle).replace(/\bthe The\b/g, "the");
    if (!title) return;
    const listText = list.flatMap((t) => [`* ${t.text}`, ...t.sub]).join("\n");
    steps.push({
      title,
      blocks: parseBlocks([head.sub.join("\n"), listText].filter(Boolean).join("\n"), pageTitle),
      files: parseGalleries([...head.gallery, ...list.flatMap((t) => t.gallery)].join("\n")),
    });
  };
  for (let i = 0; i < tokens.length; i++) {
    const head = tokens[i];
    const list: Token[] = [];
    // une phrase suivie de puces = une seule case ; une puce seule = une case
    while (!head.bullet && tokens[i + 1]?.bullet) list.push(tokens[++i]);
    add(head, list);
  }
  return steps;
}

/**
 * Galeries d'une étape, chaque photo avec sa sous-partie : nombre de sous-titres (==== Customs ====,
 * ===== FSB report =====…) avant elle, comptés comme les blocs du texte (même lecture).
 */
export function stepGalleries(body: string, pageTitle: string): StoryStep["files"] {
  return [...body.matchAll(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi)].flatMap((g) => {
    const section = parseBlocks(body.slice(0, g.index), pageTitle).filter((b) => b.type === "heading").length;
    return parseGalleries(g[0]).map((f) => ({ ...f, section }));
  });
}

function splitSteps(guide: string, pageTitle: string): StoryStep[] {
  const steps: StoryStep[] = [];
  let current: { title: string; body: string[] } | null = null;
  const close = () => {
    if (!current) return;
    const body = current.body.join("\n");
    steps.push({
      title: current.title || tr(`Étape ${steps.length + 1}`, `Step ${steps.length + 1}`),
      blocks: parseBlocks(body, pageTitle),
      files: stepGalleries(body, pageTitle),
    });
  };
  for (const line of guide.split("\n")) {
    // exactement trois « = » : les titres plus profonds restent dans le texte de l'étape
    const heading = line.match(/^===(?!=)\s*(.*?)\s*===\s*$/);
    if (heading) {
      close();
      current = { title: cleanInline(heading[1], pageTitle), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  close();
  return steps;
}

/** Modèles « … Section … Guide » appelés seuls sur une ligne du Guide (The Ticket : un par fin). */
export function storyTemplateNames(wikitext: string): string[] {
  const guide = findSection(splitSections(wikitext).sections, "Guide")?.body ?? "";
  return [...guide.matchAll(/^\{\{\s*([^{}|\n]*\bSection\b[^{}|\n]*?)\s*\}\}\s*$/gim)].map((m) => m[1]);
}

/** Nom de la fin d'après le modèle (« The Ticket Section Savior Guide » -> « Savior »). */
const endingOf = (template: string) => template.match(/Section\s+(.+?)\s+Guide$/i)?.[1] ?? template;

/** Signature d'une étape, pour repérer celles qui sont identiques dans tous les modèles. */
const signature = (s: StoryStep) => JSON.stringify([normTitle(s.title), s.blocks, s.files.map((f) => f.file)]);

/**
 * Étapes des modèles de fins : le début commun à tous (même titre, même contenu) une seule fois,
 * puis le reste de chaque fin, étiqueté. Ce n'est pas une logique de branches : juste des étapes.
 */
function composeTemplates(parts: { ending: string; steps: StoryStep[] }[]): StoryStep[] {
  if (parts.length === 0) return [];
  let common = 0;
  while (
    parts.every((p) => p.steps[common]) &&
    parts.every((p) => signature(p.steps[common]) === signature(parts[0].steps[common]))
  ) {
    common++;
  }
  return [
    ...parts[0].steps.slice(0, common),
    ...parts.flatMap((p) => p.steps.slice(common).map((s) => ({ ...s, branch: p.ending }))),
  ];
}

/**
 * Objectifs du chapitre et étapes du Guide dans l'ordre du wiki. `templates` : contenu des
 * modèles de fins (clé = nom du modèle), si la page en appelle ; ils passent avant les étapes
 * propres à la page, qui sont communes à toutes les fins.
 */
export function parseStoryPage(wikitext: string, pageTitle: string, templates: Record<string, string> = {}): StoryPage {
  const { sections } = splitSections(wikitext);
  const objectivesBody = SECTION_OBJECTIVES.map((n) => findSection(sections, n)).find(Boolean)?.body ?? "";
  const guide = findSection(sections, "Guide")?.body ?? "";
  const own = splitSteps(labelHeadings(guide), pageTitle);
  const fromTemplates = composeTemplates(
    storyTemplateNames(wikitext)
      .filter((name) => templates[name] !== undefined)
      .map((name) => ({ ending: endingOf(name), steps: splitSteps(labelHeadings(templates[name]), pageTitle) })),
  );
  const requirementsBody = SECTION_REQUIREMENTS.map((n) => findSection(sections, n)).find(Boolean)?.body ?? "";
  const requirements = parseRequirements(requirementsBody, pageTitle);
  const previousRaw = requirements.length === 0 ? parseInfobox(wikitext).previous : undefined;
  const previous = previousRaw ? (wikiLinkTargets(previousRaw)[0] ?? cleanInline(previousRaw, pageTitle)) || null : null;
  return {
    requirements,
    previous,
    objectives: parseBlocks(labelHeadings(objectivesBody), pageTitle),
    steps: [...fromTemplates, ...own],
  };
}

// --- Clés de progression ---

/** Titre normalisé (sans casse, accents ni ponctuation). */
export function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Clé de chaque étape : titre anglais normalisé + numéro d'occurrence (Boreas répète des titres).
 * Stable tant que le wiki ne renomme pas l'étape.
 */
export function stepKeys(steps: Pick<StoryStep, "title" | "branch">[]): string[] {
  const seen = new Map<string, number>();
  return steps.map((s) => {
    const base = normTitle(`${s.branch ?? ""} ${s.title}`);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/** Clés des conditions : rang dans la page anglaise (`req#0`…), sans lien avec les clés des étapes. */
export const requirementKeys = (n: number) => Array.from({ length: n }, (_, i) => `req#${i}`);

/** Identifiant enregistré d'une étape cochée : chapitre (titre anglais) + clé. */
export const storyStepId = (chapter: string, key: string) => `${chapter}::${key}`;

/** Préfixe « story: » : distingue un chapitre d'une quête dans les listes de l'onglet Fiche quête. */
export const STORY_PREFIX = "story:";
export const isStoryId = (id: string | null | undefined): id is string => Boolean(id?.startsWith(STORY_PREFIX));
export const storyIdOf = (chapter: string) => STORY_PREFIX + chapter;
export const chapterOf = (id: string) => id.slice(STORY_PREFIX.length);

/** Étapes cochées d'un chapitre (clés existantes seulement). */
export function stepsDone(chapter: string, keys: string[], done: Record<string, true>): number {
  return keys.filter((k) => done[storyStepId(chapter, k)]).length;
}

/** Indice de la première étape non cochée (-1 si tout est fait). */
export function currentStepIndex(chapter: string, keys: string[], done: Record<string, true>): number {
  return keys.findIndex((k) => !done[storyStepId(chapter, k)]);
}

// --- Choix de la langue ---

export type StoryLangChoice =
  | { lang: "en"; reason: "none" | "missing" | "count" | "order" | "english" }
  | { lang: "fr"; reason: "ok" };

export interface ResolvedStory {
  choice: StoryLangChoice;
  /** Conditions affichées (français seulement si la page française en a autant que l'anglaise). */
  requirements: (StoryStep & { key: string })[];
  objectives: WikiBlock[];
  /** Étapes affichées, dans l'ordre anglais : `key` sert à la progression. */
  steps: (StoryStep & { key: string })[];
}

const fileKey = (f: string) => f.replace(/_/g, " ").trim().toLowerCase();

const blockText = (b: WikiBlock): string =>
  b.type === "list" ? b.items.map((i) => i.text).join(" ") : b.type === "table" ? [b.title ?? "", ...b.headers, ...b.rows.flat()].join(" ") : b.text;

/** Titre et texte d'une étape en une chaîne (étage cité, recherche). */
export const stepText = (step: StoryStep) => [step.title, ...step.blocks.map(blockText)].join(" ");

/** Nombres du titre et du texte d'une étape (les séparateurs de milliers retirés) : identiques d'une langue à l'autre. */
function numbersOf(step: StoryStep): string[] {
  const text = [step.title, ...step.blocks.map(blockText)].join(" ").replace(ITEM_MARK, " ").replace(/(\d)[,.   ](?=\d{3}(?!\d))/g, "$1");
  return text.match(/\d+/g) ?? [];
}

/** Nombres distinctifs (10 et plus) : « 1 » ou « 2 » se retrouvent partout et ne prouvent rien. */
const distinctive = (step: StoryStep) => numbersOf(step).filter((n) => n.length >= 2);

const shares = (a: string[], b: string[]) => b.some((n) => a.includes(n));

/** Les photos de l'étape française ne sont pas celles de l'étape anglaise (quand les deux en ont). */
function otherPhotos(en: StoryStep, fr: StoryStep): boolean {
  const files = new Set(en.files.map((f) => fileKey(f.file)));
  return files.size > 0 && fr.files.length > 0 && !fr.files.some((f) => files.has(fileKey(f.file)));
}

/**
 * L'ordre est suspect si une étape française a des nombres distinctifs (quantités, sommes) qu'on
 * ne retrouve pas dans l'étape anglaise de la même position mais dans une autre. Une traduction
 * un peu différente ne suffit pas.
 */
function orderLooksWrong(en: StoryStep[], fr: StoryStep[]): boolean {
  const enNumbers = en.map(distinctive);
  return fr.some((step, i) => {
    if (otherPhotos(en[i], step)) return true;
    const mine = distinctive(step);
    return mine.length > 0 && !shares(enNumbers[i], mine) && enNumbers.some((n, j) => j !== i && shares(n, mine));
  });
}

/**
 * Texte français seulement si la page française a les mêmes étapes que l'anglaise : même nombre,
 * et aucune étape dont les nombres distinctifs (quantités, sommes) viennent d'une autre position
 * ni dont les galeries diffèrent. Un contrôle sur les titres seuls est impossible
 * (traduits), et le wiki FR a plusieurs fois deux étapes dans un autre ordre (Tour / Excursion).
 * Si une inversion ne change ni nombres ni photos, elle n'est pas vue. Sinon la progression, enregistrée sous les titres
 * anglais, serait cochée sur la mauvaise étape : on garde l'anglais.
 */
export function resolveStory(en: StoryPage, fr: StoryPage | null | undefined, wantFr: boolean, nameOf: (chapterId: string) => string = (id) => id): ResolvedStory {
  const keys = stepKeys(en.steps);
  // sans section Requirements, le chapitre précédent de l'infobox est la condition (nom dans la langue courante)
  const base: StoryStep[] =
    en.requirements.length === 0 && en.previous
      ? [{ title: tr(`Terminer le chapitre ${nameOf(en.previous)}`, `Complete the ${nameOf(en.previous)} chapter`), blocks: [], files: [] }]
      : en.requirements;
  const reqKeys = requirementKeys(base.length);
  const enReqs = base.map((s, i) => ({ ...s, key: reqKeys[i] }));
  const english = (reason: Extract<StoryLangChoice, { lang: "en" }>["reason"]): ResolvedStory => ({
    choice: { lang: "en", reason },
    requirements: enReqs,
    objectives: en.objectives,
    steps: en.steps.map((s, i) => ({ ...s, key: keys[i] })),
  });
  if (!wantFr) return english("none");
  if (!fr) return english("missing");
  if (fr.steps.length !== en.steps.length) return english("count");
  if (orderLooksWrong(en.steps, fr.steps)) return english("order");
  // photos françaises si toutes sont résolues, sinon celles de l'anglais (jamais d'image cassée)
  const photosOf = (s: StoryStep, e: StoryStep) => (s.files.length > 0 && (s.photos ?? []).length === s.files.length ? s.photos! : (e.photos ?? []));
  const frReqs = en.requirements.length > 0 && fr.requirements.length === en.requirements.length;
  return {
    choice: { lang: "fr", reason: "ok" },
    requirements: frReqs ? fr.requirements.map((s, i) => ({ ...s, photos: photosOf(s, en.requirements[i]), key: reqKeys[i] })) : enReqs,
    objectives: fr.objectives.length > 0 ? fr.objectives : en.objectives,
    steps: fr.steps.map((s, i) => ({ ...s, branch: en.steps[i].branch, photos: photosOf(s, en.steps[i]), key: keys[i] })),
  };
}
