// Catégories du flea (handbook du jeu) pour l'item finder, depuis json.tarkov.dev :
// src/data/item-categories.json = { cats: [[id, parent]…] dans l'ordre du flea, items: { feuille: [ids d'objets] } }.
// Les noms des catégories sont dans les fichiers de traductions déjà chargés par le finder (clé = id).
// Usage : npm run sync:categories
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ordre des catégories principales du flea ; les autres (objets de quête…) suivent
const ROOT_ORDER = ["barter-items", "gear", "weapon-parts-mods", "weapons", "ammo", "provisions", "medication", "keys", "info-items", "special-equipment", "maps", "money"];

const json = await (await fetch("https://json.tarkov.dev/regular/items")).json();
const all = Object.values(json.data.handbookCategories);
const rank = (c) => (ROOT_ORDER.includes(c.normalizedName) ? ROOT_ORDER.indexOf(c.normalizedName) : ROOT_ORDER.length);
const cats = [];
const visit = (c) => {
  cats.push([c.id, c.parent ?? null]);
  for (const id of c.children ?? []) visit(json.data.handbookCategories[id]);
};
all.filter((c) => !c.parent).sort((a, b) => rank(a) - rank(b)).forEach(visit);

const items = {};
for (const item of Object.values(json.data.items)) {
  const leaf = item.handbookCategories?.[0];
  if (leaf) (items[leaf] ??= []).push(item.id);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "item-categories.json");
writeFileSync(out, JSON.stringify({ cats, items }));
console.log(`${cats.length} catégories, ${Object.values(items).flat().length} objets -> ${out}`);
