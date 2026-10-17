// Ce que vendent les marchands, par niveau de loyauté, comme l'écran marchand du jeu, depuis
// json.tarkov.dev (un fichier par mode, les prix et barters du PvE diffèrent) :
// src/data/trader-offers-<mode>.json = {
//   levels:  { marchand: [[niveau, niveau PMC requis, réputation requise, somme dépensée requise]…] },
//   currency: { marchand: devise de ses prix et de la somme dépensée (RUB, USD…) },
//   cash:    [[marchand, objet, niveau, prix, devise, quête qui débloque | null, limite d'achat]…],
//   barters: [[marchand, objet, niveau, quantité reçue, [[objet demandé, quantité]…], quête | null, limite]…],
// }
// Usage : npm run sync:traders
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const mode of ["regular", "pve", "pvp-season"]) {
  const get = async (path) => (await (await fetch(`https://json.tarkov.dev/${mode}/${path}`)).json()).data;
  const [traders, items, barters] = await Promise.all([get("traders"), get("items"), get("barters")]);
  const levels = {};
  const currency = {};
  for (const t of Object.values(traders)) {
    levels[t.id] = t.levels.map((l) => [l.level, l.requiredPlayerLevel, l.requiredReputation, l.requiredCommerce]);
    currency[t.id] = t.currency;
  }
  const cash = [];
  for (const item of Object.values(items.items)) {
    for (const o of item.buyFromTrader ?? []) cash.push([o.trader, item.id, o.minTraderLevel ?? 1, o.price, o.currency, o.taskUnlock ?? null, o.buyLimit ?? 0]);
  }
  const bart = Object.values(barters)
    .filter((b) => b.trader && b.offeredItem?.item)
    .map((b) => [b.trader, b.offeredItem.item, b.minTraderLevel ?? 1, b.offeredItem.count ?? 1, (b.requiredItems ?? []).map((r) => [r.item, Math.round((r.count ?? 1) * 100) / 100]), b.taskUnlock ?? null, b.buyLimit ?? 0]);
  const out = join(root, "src", "data", `trader-offers-${mode}.json`);
  writeFileSync(out, JSON.stringify({ levels, currency, cash, barters: bart }));
  console.log(`${mode} : ${cash.length} achats, ${bart.length} barters -> ${out}`);
}
