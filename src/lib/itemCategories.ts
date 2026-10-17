// Item finder : arbre des catégories du flea (handbook du jeu), comme dans Tarkov. Données :
// src/data/item-categories.json (npm run sync:categories). Logique pure.

export interface CategoryFile {
  /** [id, parent] dans l'ordre du flea (catégories principales, puis leurs sous-catégories). */
  cats: [string, string | null][];
  /** Catégorie la plus fine -> ids des objets. */
  items: Record<string, string[]>;
}

export interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
  /** Objets de la branche (catégorie et sous-catégories), parmi ceux du finder. */
  items: Set<string>;
}

/** Objets sans catégorie (objets de quête hors flea…) : dernière catégorie, pour que tout soit trouvable. */
export const OTHER = "other";

/**
 * Arbre des catégories avec les objets connus du finder (`known`) : catégories principales dans
 * l'ordre du flea, sous-catégories par nom, branches vides retirées, « Autres » à la fin.
 */
export function buildCategoryTree(file: CategoryFile, names: Record<string, string>, known: string[], otherName: string): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(file.cats.map(([id]) => [id, { id, name: names[id] ?? id, children: [], items: new Set<string>() }]));
  const parent = new Map(file.cats);
  const knownSet = new Set(known);
  const placed = new Set<string>();
  for (const [leaf, ids] of Object.entries(file.items)) {
    for (const id of ids) {
      if (!knownSet.has(id)) continue;
      placed.add(id);
      // l'objet compte dans sa catégorie et dans toutes celles au-dessus
      for (let c: string | null | undefined = leaf; c; c = parent.get(c)) nodes.get(c)?.items.add(id);
    }
  }
  const roots: CategoryNode[] = [];
  for (const [id, p] of file.cats) {
    const node = nodes.get(id)!;
    if (node.items.size === 0) continue;
    if (p) nodes.get(p)?.children.push(node);
    else roots.push(node);
  }
  for (const node of nodes.values()) node.children.sort((a, b) => a.name.localeCompare(b.name));
  const other = known.filter((id) => !placed.has(id));
  if (other.length) roots.push({ id: OTHER, name: otherName, children: [], items: new Set(other) });
  return roots;
}
