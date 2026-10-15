// Images d'objets dans les tableaux et textes du wiki : correspondance nom -> identifiant tarkov.dev,
// affichage des cellules « Find in raid ». Logique pure (voir ItemThumb.tsx pour l'affichage).
import { iconUrl } from "../api/tarkovJson";
import { tr } from "./i18n";

/** Nom comparable : sans accents, majuscules ni ponctuation. */
export const normItemName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Nom normalisé -> identifiant (le premier objet gagne en cas de doublon). */
export function nameIndex(itemNames: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, name] of Object.entries(itemNames)) {
    const n = normItemName(name);
    if (n && !index.has(n)) index.set(n, id);
  }
  return index;
}

/** Identifiant d'un objet : repère {{id}} du wiki français, sinon nom connu de tarkov.dev. */
export function itemIdOf(cell: string, index: Map<string, string>): string | undefined {
  return cell.match(/⟦item:([0-9a-f]{24})⟧/)?.[1] ?? index.get(normItemName(cell));
}

/** Image tarkov.dev : celle du fichier d'objets, sinon l'adresse standard de l'id (l'img se masque si elle échoue). */
export const iconSrc = (id: string, itemIcons?: Record<string, string>) => iconUrl(itemIcons?.[id] ?? `${id}-icon.webp`);

/** Colonne du nom de l'objet dans un tableau (-1 si aucune). */
export const itemColumn = (headers: string[]) => headers.findIndex((h) => /^(item name|item|name|nom de l.objet|objet|nom)$/i.test(h.trim()));

/** La colonne de l'icône est vide : une ligne plus courte que les en-têtes est décalée d'une colonne. */
export const rowOffset = (headers: string[], row: string[]) => (row.length < headers.length ? -1 : 0);

/** Cellule d'un tableau -> texte affiché ; « N/A » du wiki devient « — » (avec explication). */
export function cellDisplay(header: string | undefined, cell: string): { text: string; title?: string } {
  if (header && /find in raid|found in raid|trouvé en raid|trouver en raid/i.test(header)) {
    const v = cell.trim().toLowerCase();
    if (v === "yes" || v === "oui") return { text: tr("oui", "yes") };
    if (v === "no" || v === "non") return { text: tr("non", "no") };
    if (/^n\/?a$/.test(v)) return { text: "—", title: tr("Non précisé par le wiki", "Not specified by the wiki") };
  }
  return { text: cell };
}
