// Affiche des blocs de texte du wiki (voir lib/wikiText.ts) avec des éléments React :
// tout est du texte échappé, aucun HTML du wiki n'est inséré dans la page.
import type { WikiBlock } from "../lib/wikiText";
import { tr } from "../lib/i18n";

/** Ligne de tableau -> "En-tête : valeur · …" (cellules vides, comme l'icône, ignorées). */
function rowText(headers: string[], row: string[]) {
  return row
    .map((cell, i) => (cell ? (headers[i] ? `${headers[i]}${tr(" : ", ": ")}${cell}` : cell) : ""))
    .filter(Boolean)
    .join(" · ");
}

export function WikiBlocks({ blocks }: { blocks: WikiBlock[] }) {
  return (
    <div className="wiki-blocks">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <div key={i} className={`wiki-heading wiki-heading-${Math.min(b.level, 4)}`}>
                {b.text}
              </div>
            );
          case "paragraph":
            return (
              <p key={i} className="wiki-paragraph">
                {b.text}
              </p>
            );
          case "quote":
            return (
              <blockquote key={i} className="wiki-quote">
                {b.text}
              </blockquote>
            );
          case "list":
            return (
              <ul key={i} className="wiki-list">
                {b.items.map((item, j) => (
                  <li key={j} style={{ marginLeft: `${(item.depth - 1) * 1.1}em` }}>
                    {item.text}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="wiki-table">
                {b.title && <div className="wiki-table-title">{b.title}</div>}
                <ul className="wiki-list">
                  {b.rows.map((row, j) => {
                    const text = rowText(b.headers, row);
                    return text ? <li key={j}>{text}</li> : null;
                  })}
                </ul>
              </div>
            );
        }
      })}
    </div>
  );
}
