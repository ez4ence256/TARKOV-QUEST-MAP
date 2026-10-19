// Lecture du wikitext des pages de quêtes du wiki Escape from Tarkov.
//
// Le wiki n'a pas de données structurées (ni Cargo ni Semantic MediaWiki, et le
// module PortableInfobox renvoie un résultat vide pour les quêtes). On lit donc le
// wikitext. Formats relevés sur 9 pages (session 4, voir JOURNAL.md) :
//  - modèle {{Infobox quest}} avec des paramètres nommés, un par ligne ;
//  - sections == Dialogue / Requirements / Objectives / Rewards /
//    Initial Equipment / Failure Dialogue / Guide / Trivia == ;
//  - répliques dans {{quote|…}}, listes à puces (* et **), tableaux {| … |},
//    galeries <gallery>, <font color=…>, liens [[cible|texte]].
// Tout est converti en texte brut et en blocs simples : aucun HTML du wiki n'est
// jamais inséré tel quel dans la page.

/** Lien interne du wiki dans un texte : page visée et texte affiché (pour mettre l'image d'un objet devant). */
export interface LinkRef {
  target: string;
  text: string;
}

/** Bloc de texte affichable (rendu par React, donc échappé). */
export type WikiBlock =
  | { type: "heading"; level: number; text: string; links?: LinkRef[] }
  | { type: "paragraph"; text: string; links?: LinkRef[] }
  | { type: "list"; items: { depth: number; text: string; links?: LinkRef[] }[] }
  | { type: "quote"; text: string; links?: LinkRef[] }
  | { type: "table"; title: string | null; headers: string[]; rows: string[][] };

export interface WikiSection {
  title: string;
  /** Wikitext brut de la section (sous-sections comprises). */
  body: string;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", ndash: "–", mdash: "—" };

/** Sections de niveau 2 ("==Titre=="), dans l'ordre de la page. */
export function splitSections(wikitext: string): { intro: string; sections: WikiSection[] } {
  const parts = wikitext.split(/^==([^=].*?)==[ \t]*$/m);
  const sections: WikiSection[] = [];
  for (let i = 1; i < parts.length; i += 2) sections.push({ title: parts[i].trim(), body: parts[i + 1] ?? "" });
  return { intro: parts[0] ?? "", sections };
}

export const findSection = (sections: WikiSection[], title: string) =>
  sections.find((s) => s.title.toLowerCase() === title.toLowerCase());

/** Paramètres nommés du modèle {{Infobox quest}} ({{Infobox key}}… avec `kind`) (valeurs en wikitext brut, vides exclues). */
export function parseInfobox(wikitext: string, kind = "quest"): Record<string, string> {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*Infobox ${kind}`, "i"));
  if (start === -1) return {};
  // fin du modèle : accolades équilibrées
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith("{{", i)) {
      depth++;
      i++;
    } else if (wikitext.startsWith("}}", i)) {
      depth--;
      i++;
      if (depth === 0) {
        end = i - 1;
        break;
      }
    }
  }
  const body = wikitext.slice(start, end);
  const params: Record<string, string> = {};
  let current: string | null = null;
  for (const line of body.split("\n").slice(1)) {
    const match = line.match(/^\s*\|\s*([^=|]+?)\s*=(.*)$/);
    if (match) {
      current = match[1].trim();
      params[current] = match[2].trim();
    } else if (current) {
      params[current] += `\n${line}`;
    }
  }
  for (const key of Object.keys(params)) {
    params[key] = params[key].trim();
    if (!params[key]) delete params[key];
  }
  return params;
}

/** Cibles des liens internes [[cible|texte]] (sans ancre, sans fichiers ni catégories). */
export function wikiLinkTargets(text: string): string[] {
  const targets: string[] = [];
  for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const target = m[1].trim();
    if (/^(file|image|category|[a-z]{2}(-[a-z]{2})?):/i.test(target)) continue;
    targets.push(target.split("#")[0].replace(/_/g, " ").trim());
  }
  return targets.filter(Boolean);
}

/** Liens [[Cible|texte]] / [[Cible]] d'un wikitext, dans l'ordre (le champ `links` n'existe que s'il y en a). */
export function linkRefs(raw: string, pageTitle = ""): { links?: LinkRef[] } {
  const links: LinkRef[] = [];
  for (const m of raw.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    const target = m[1].trim();
    if (/^(file|image|fichier|category|catégorie|[a-z]{2}(-[a-z]{2})?):/i.test(target) || target.startsWith(":")) continue;
    const text = cleanInline(m[2] ?? target.split("#")[0], pageTitle);
    const page = target.split("#")[0].replace(/_/g, " ").trim();
    if (page && text) links.push({ target: page, text });
  }
  return links.length ? { links } : {};
}

/** Wikitext d'une ligne -> texte brut. */
export function cleanInline(text: string, pageTitle = ""): string {
  let s = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{\s*PAGENAME\s*\}\}/gi, pageTitle)
    .replace(/\{\{\s*quote\s*\|([\s\S]*?)\}\}/gi, "$1")
    // autres modèles : retirés (Navbox, Historical content…)
    .replace(/\{\{[^{}]*\}\}/g, "")
    // fichiers, catégories et liens vers les autres langues : retirés
    .replace(/\[\[(?:file|image|fichier|category|catégorie|[a-z]{2}(?:-[a-z]{2})?):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, (_, target: string) => target.split("#")[0])
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]\s]+\]/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s.replace(/&(#39|[a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Découpe une ligne de tableau "a || b" (ou "a !! b") sans couper dans [[…|…]] ni {{…|…}}. */
function splitCells(line: string, sep: "||" | "!!"): string[] {
  const cells: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2);
    if (two === "[[" || two === "{{") depth++;
    if ((two === "]]" || two === "}}") && depth > 0) depth--;
    if (depth === 0 && two === sep) {
      cells.push(current);
      current = "";
      i++;
      continue;
    }
    current += line[i];
  }
  cells.push(current);
  return cells;
}

/** Retire les attributs d'une cellule ("colspan="6" |Texte" -> "Texte"). */
function cellContent(cell: string): string {
  let depth = 0;
  for (let i = 0; i < cell.length; i++) {
    const two = cell.slice(i, i + 2);
    if (two === "[[" || two === "{{") depth++;
    if ((two === "]]" || two === "}}") && depth > 0) depth--;
    if (depth === 0 && cell[i] === "|" && cell[i + 1] !== "|") {
      const before = cell.slice(0, i);
      // "attributs |texte", ou séparateur sans attributs ("|texte", vu dans le wiki : "||Can be…")
      if (!before.trim() || (/=/.test(before) && !/\[\[|\{\{/.test(before))) return cell.slice(i + 1);
      return cell;
    }
  }
  return cell;
}

/** Tableau wiki {| … |} -> titre (ligne d'en-tête unique), en-têtes et lignes, en texte brut. */
function parseTable(lines: string[], pageTitle: string): WikiBlock {
  const rawRows: { header: boolean; cells: string[] }[][] = [[]];
  for (const line of lines) {
    const l = line.trim();
    if (l.startsWith("{|") || l.startsWith("|}") || l.startsWith("|+")) continue;
    if (l.startsWith("|-")) {
      rawRows.push([]);
      continue;
    }
    const row = rawRows[rawRows.length - 1];
    if (l.startsWith("!")) row.push({ header: true, cells: splitCells(l.slice(1), "!!").flatMap((c) => splitCells(c, "||")) });
    else if (l.startsWith("|")) row.push({ header: false, cells: splitCells(l.slice(1), "||") });
    else if (row.length > 0) {
      // suite de la cellule précédente sur une nouvelle ligne
      const last = row[row.length - 1];
      last.cells[last.cells.length - 1] += `\n${l}`;
    }
  }
  const rows = rawRows
    .map((r) => ({
      allHeader: r.length > 0 && r.every((c) => c.header),
      cells: r.flatMap((c) => c.cells).map((c) => cleanInline(cellContent(c), pageTitle)),
    }))
    .filter((r) => r.cells.length > 0);
  let title: string | null = null;
  if (rows[0]?.allHeader && rows[0].cells.length === 1) title = rows.shift()!.cells[0];
  const headers = rows[0]?.allHeader ? rows.shift()!.cells : [];
  return { type: "table", title, headers, rows: rows.map((r) => r.cells) };
}

/**
 * Wikitext d'une section -> blocs : sous-titres, paragraphes, listes, répliques, tableaux.
 * Galeries, images, catégories, liens de langues et Navbox sont retirés.
 */
export function parseBlocks(body: string, pageTitle = ""): WikiBlock[] {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<gallery[\s\S]*?<\/gallery>/gi, "")
    .replace(/<\/?li[^>]*>/gi, "");
  const lines = text.split("\n");
  const blocks: WikiBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const t = cleanInline(paragraph.join("\n"), pageTitle);
    if (t) blocks.push({ type: "paragraph", text: t, ...linkRefs(paragraph.join("\n"), pageTitle) });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("{|")) {
      flush();
      const tableLines = [trimmed];
      while (i + 1 < lines.length && !lines[i].trim().startsWith("|}")) tableLines.push(lines[++i]);
      blocks.push(parseTable(tableLines, pageTitle));
      continue;
    }
    const heading = trimmed.match(/^(={2,6})\s*(.+?)\s*\1$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length, text: cleanInline(heading[2], pageTitle), ...linkRefs(heading[2], pageTitle) });
      continue;
    }
    const quote = trimmed.match(/^\{\{\s*quote\s*\|([\s\S]*)\}\}$/i);
    if (quote) {
      flush();
      const t = cleanInline(quote[1], pageTitle);
      if (t) blocks.push({ type: "quote", text: t, ...linkRefs(quote[1], pageTitle) });
      continue;
    }
    const item = trimmed.match(/^([*#]+)\s*(.*)$/);
    if (item) {
      flush();
      const t = cleanInline(item[2], pageTitle);
      if (!t) continue;
      const last = blocks[blocks.length - 1];
      const entry = { depth: item[1].length, text: t, ...linkRefs(item[2], pageTitle) };
      if (last?.type === "list") last.items.push(entry);
      else blocks.push({ type: "list", items: [entry] });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Première réplique {{quote|…}} d'un texte (ex. section Dialogue). */
export function firstQuote(body: string, pageTitle = ""): string | null {
  const block = parseBlocks(body, pageTitle).find((b) => b.type === "quote");
  return block?.type === "quote" ? block.text : null;
}

/** Ligne du tableau « Related Quest Items » du Guide. */
export interface RelatedItem {
  name: string;
  amount: string;
  requirement: string;
  /** "Find in raid" d'après le wiki : true (Yes), false (No), null (N/A ou absent). */
  foundInRaid: boolean | null;
  notes: string;
}

/** Tableau « Related Quest Items » (objets, clés, outils), s'il existe dans le texte donné. */
export function relatedQuestItems(blocks: WikiBlock[]): RelatedItem[] {
  const table = blocks.find((b) => b.type === "table" && /related quest items/i.test(b.title ?? ""));
  if (!table || table.type !== "table") return [];
  const col = (re: RegExp) => table.headers.findIndex((h) => re.test(h));
  const name = col(/item name/i);
  if (name === -1) return [];
  const amount = col(/amount/i);
  const requirement = col(/requirement/i);
  const fir = col(/find in raid|found in raid/i);
  const notes = col(/notes/i);
  // la colonne Icon est vide une fois l'image retirée : on se cale sur le nombre d'en-têtes
  return table.rows
    .filter((r) => r.length >= table.headers.length - 1)
    .map((r) => {
      const offset = r.length < table.headers.length ? -1 : 0;
      const at = (i: number) => (i === -1 ? "" : (r[i + offset] ?? "").trim());
      const firText = at(fir).toLowerCase();
      return {
        name: at(name),
        amount: at(amount),
        requirement: at(requirement),
        foundInRaid: firText === "yes" ? true : firText === "no" ? false : null,
        notes: at(notes),
      };
    })
    .filter((r) => r.name);
}

/** Chiffres clés des récompenses du wiki, pour comparer avec tarkov.dev. */
export interface WikiRewardNumbers {
  experience: number | null;
  /** Montants de base (ligne de premier niveau), par devise. */
  money: Partial<Record<"Roubles" | "Dollars" | "Euros", number>>;
  /** Réputation par marchand (nom anglais du wiki). */
  reputation: Record<string, number>;
}

const toNumber = (s: string) => Number(s.replace(/,/g, ""));

export function rewardNumbers(rewardsBody: string): WikiRewardNumbers {
  const result: WikiRewardNumbers = { experience: null, money: {}, reputation: {} };
  for (const raw of rewardsBody.split("\n")) {
    const top = raw.match(/^\*(?!\*)\s*(.*)$/);
    if (!top) continue;
    const line = cleanInline(top[1]);
    const exp = line.match(/^\+?([\d,]+)\s*EXP\b/i);
    if (exp) result.experience = toNumber(exp[1]);
    const money = line.match(/^([\d,]+)\s+(Roubles|Dollars|Euros)\b/i);
    if (money) {
      const currency = (money[2][0].toUpperCase() + money[2].slice(1).toLowerCase()) as "Roubles" | "Dollars" | "Euros";
      result.money[currency] = toNumber(money[1]);
    }
    const rep = line.match(/^(.+?)\s+Rep\s*([+-]?[\d.]+)/i);
    if (rep) result.reputation[rep[1].trim()] = Number(rep[2]);
  }
  return result;
}
