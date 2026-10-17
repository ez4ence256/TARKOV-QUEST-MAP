// Onglet « Où le trouver » de l'item finder, depuis json.tarkov.dev (données PvP, servies aussi en PvE) :
// src/data/item-where.json = {
//   spots: { id: [[map, x, y, z, points, score x 100, clé de la porte proche]…] }  (bestSpots de src/lib/itemSpots.ts)
//   wiki:  { id: titre de la page wiki }  seulement quand il diffère du nom anglais (variantes de couleur…)
// }
// Usage : npm run sync:spots
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bestSpots } from "../src/lib/itemSpots.ts";

const get = async (path) => (await (await fetch(`https://json.tarkov.dev/regular/${path}`)).json()).data;
const [mapsData, itemsData, en] = await Promise.all([get("maps"), get("items"), get("items_en")]);

const spawnsByItem = new Map();
const locks = [];
for (const m of Object.values(mapsData.maps)) {
  for (const l of m.lootLoose ?? []) {
    const spawn = { map: m.normalizedName, ...l.position, items: l.items };
    for (const id of l.items) (spawnsByItem.get(id) ?? spawnsByItem.set(id, []).get(id)).push(spawn);
  }
  for (const l of m.locks ?? []) if (l.lockType === "door" && l.key) locks.push({ map: m.normalizedName, ...l.position, key: l.key });
}
const spots = {};
for (const [id, spawns] of spawnsByItem) spots[id] = bestSpots(spawns, locks);

const wiki = {};
for (const item of Object.values(itemsData.items)) {
  const title = item.wikiLink?.split("/wiki/")[1];
  if (!title) continue;
  const t = decodeURIComponent(title).replace(/_/g, " ");
  if (t !== en[`${item.id} Name`]) wiki[item.id] = t;
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "item-where.json");
writeFileSync(out, JSON.stringify({ spots, wiki }));
console.log(`${Object.keys(spots).length} objets avec des spots, ${Object.keys(wiki).length} titres wiki -> ${out}`);
