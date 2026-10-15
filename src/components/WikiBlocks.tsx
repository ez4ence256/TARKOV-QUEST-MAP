// Affiche des blocs de texte du wiki (voir lib/wikiText.ts) avec des éléments React :
// tout est du texte échappé, aucun HTML du wiki n'est inséré dans la page.
import type { ReactNode } from "react";
import type { LinkRef, WikiBlock } from "../lib/wikiText";
import { tr } from "../lib/i18n";
import { fillItems, ITEM_MARK } from "../lib/story";
import { cellDisplay, itemColumn, rowOffset } from "../lib/itemIcons";
import { iconSrc } from "../lib/itemIcons";
import { ItemThumb, useItemIcons } from "./ItemThumb";

/** Ligne de tableau -> « En-tête : valeur » par cellule non vide ; « — » (N/A du wiki) garde son explication en infobulle. */
function RowText({ headers, row, t }: { headers: string[]; row: string[]; t: (s: string) => string }) {
  const off = rowOffset(headers, row);
  const parts = row
    .map((cell, i) => {
      const header = headers[i - off];
      const d = cellDisplay(header, t(cell));
      return d.text ? { ...d, header } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {p.header ? `${p.header}${tr(" : ", ": ")}` : ""}
          <span title={p.title}>{p.text}</span>
        </span>
      ))}
    </>
  );
}

/** itemNames : remplace les repères d'objets des chapitres de la Main story (voir lib/story.ts). */
export function WikiBlocks({ blocks, itemNames, itemIcons }: { blocks: WikiBlock[]; itemNames?: Record<string, string>; itemIcons?: Record<string, string> }) {
  const t = (s: string) => (itemNames ? fillItems(s, itemNames) : s);
  // noms d'objets des tableaux (colonne « Item name ») et repères {{id}} du texte : une image chacun
  const tableNames = blocks.flatMap((b) => (b.type === "table" ? b.rows.map((r) => r[itemColumn(b.headers) + rowOffset(b.headers, r)] ?? "") : []));
  const linkTargets = blocks.flatMap((b) => (b.type === "table" ? [] : b.type === "list" ? b.items.flatMap((i) => i.links ?? []) : (b.links ?? [])).map((l) => l.target));
  const iconOf = useItemIcons([...tableNames, ...linkTargets], itemNames, itemIcons);
  /** Texte avec, avant chaque nom d'objet repéré ({{id}} du wiki français), son image. */
  const rich = (s: string, links?: LinkRef[]): ReactNode => {
    if (links?.length) {
      // lien vers un objet (texte anglais) : petite image avant le texte du lien, retrouvé dans l'ordre
      const parts: ReactNode[] = [];
      let pos = 0;
      for (const l of links) {
        const at = s.indexOf(l.text, pos);
        const src = at < 0 ? undefined : iconOf(l.target);
        if (!src) continue;
        parts.push(richMarks(s.slice(pos, at)), <ItemThumb key={at} src={src} name={l.text} title={l.target} size={22} />);
        pos = at;
      }
      parts.push(richMarks(s.slice(pos)));
      return parts;
    }
    return richMarks(s);
  };
  const richMarks = (s: string): ReactNode => {
    if (!itemNames || !s.includes("⟦item:")) return t(s);
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of s.matchAll(ITEM_MARK)) {
      out.push(s.slice(last, m.index));
      const name = itemNames[m[1]];
      out.push(<ItemThumb key={m.index} src={iconSrc(m[1], itemIcons)} name={name ?? ""} />, name ?? "[…]");
      last = m.index + m[0].length;
    }
    out.push(s.slice(last));
    return out;
  };
  return (
    <div className="wiki-blocks">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <div key={i} className={`wiki-heading wiki-heading-${Math.min(b.level, 4)}`}>
                {rich(b.text, b.links)}
              </div>
            );
          case "paragraph":
            return (
              <p key={i} className="wiki-paragraph">
                {rich(b.text, b.links)}
              </p>
            );
          case "quote":
            return (
              <blockquote key={i} className="wiki-quote">
                {rich(b.text, b.links)}
              </blockquote>
            );
          case "list":
            return (
              <ul key={i} className="wiki-list">
                {b.items.map((item, j) => (
                  <li key={j} style={{ marginLeft: `${(item.depth - 1) * 1.1}em` }}>
                    {rich(item.text, item.links)}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="wiki-table">
                {b.title && <div className="wiki-table-title">{t(b.title)}</div>}
                <ul className="wiki-list">
                  {b.rows.map((row, j) => {
                    if (!row.some(Boolean)) return null;
                    const nameCell = row[itemColumn(b.headers) + rowOffset(b.headers, row)] ?? "";
                    return (
                      <li key={j}>
                        {nameCell && <ItemThumb src={iconOf(nameCell)} name={t(nameCell)} />}
                        <RowText headers={b.headers} row={row} t={t} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
        }
      })}
    </div>
  );
}
