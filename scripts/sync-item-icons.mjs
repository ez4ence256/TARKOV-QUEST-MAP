// Images d'objets manquantes : src/data/item-icons.json = { id: image } pour les objets dont l'image
// standard de tarkov.dev (<id>-icon.webp) n'existe pas, et pour les objets de quête (fichier des quêtes)
// que tarkov.dev montre avec son image « inconnue ». Dans l'ordre :
//  1. l'image indiquée par tarkov.dev (iconLink), si ce n'est pas « unknown-item-icon » ;
//  2. préréglage « … Default » : l'image de l'objet de base (même nom sans « Default ») ;
//  3. l'icône de l'objet sur le wiki (« File:<nom anglais> icon.png », puis « <titre de la page> icon.png ») ;
//  4. l'image de la page wiki, sauf un plan d'emplacement ou une porte (pages de clés) et « Missing_image » ;
//  sinon rien (l'image reste masquée, jamais cassée).
// Usage : npm run sync:icons
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICON_BASE = "https://assets.tarkov.dev/";
const get = async (path) => (await (await fetch(`https://json.tarkov.dev/regular/${path}`)).json()).data;
const [itemsData, en, tasksData, tasksEn] = await Promise.all([get("items"), get("items_en"), get("tasks"), get("tasks_en")]);
const items = itemsData.items;
// objets de quête : nom et image dans le fichier des quêtes (pas dans celui des objets)
const questItems = Object.values(tasksData.questItems ?? {});
for (const q of questItems) en[`${q.id} Name`] ??= tasksEn[q.name] ?? q.name;

// objets du finder : une clé « <id> ShortName » dans les traductions
const ids = Object.keys(en).map((k) => /^([0-9a-f]{24}) ShortName$/.exec(k)?.[1]).filter((id) => id && en[`${id} Name`]);
const ok = new Map();
const exists = async (url) => {
  if (!ok.has(url)) ok.set(url, (await fetch(url, { method: "HEAD" }).catch(() => null))?.status === 200);
  return ok.get(url);
};
const queue = [...ids];
await Promise.all(Array.from({ length: 16 }, async () => { for (let id = queue.shift(); id; id = queue.shift()) await exists(`${ICON_BASE}${id}-icon.webp`); }));
const missing = [
  ...ids.filter((id) => !ok.get(`${ICON_BASE}${id}-icon.webp`)),
  ...questItems.filter((q) => /unknown-item-icon/.test(q.iconLink ?? "") && !ids.includes(q.id)).map((q) => q.id),
];
console.log(`${ids.length} objets, ${missing.length} sans image standard`);

const byName = new Map(ids.map((id) => [en[`${id} Name`], id]));
const out = {};
const wikiWanted = new Map(); // titre -> ids
for (const id of missing) {
  const item = items[id];
  const name = en[`${id} Name`];
  const link = item?.iconLink;
  if (link && !/unknown-item-icon/.test(link) && (await exists(link))) {
    out[id] = link.startsWith(ICON_BASE) ? link.slice(ICON_BASE.length) : link;
    continue;
  }
  const base = / Default$/.test(name) ? byName.get(name.replace(/ Default$/, "")) : undefined;
  if (base && ok.get(`${ICON_BASE}${base}-icon.webp`)) {
    out[id] = `${base}-icon.webp`;
    continue;
  }
  const title = item?.wikiLink ? decodeURIComponent(item.wikiLink.split("/wiki/")[1] ?? "").replace(/_/g, " ") : name;
  if (title) wikiWanted.set(title, [...(wikiWanted.get(title) ?? []), id]);
}

const wiki = async (params) => {
  const q = new URLSearchParams({ ...params, format: "json", formatversion: "2" });
  const json = await (await fetch(`https://escapefromtarkov.fandom.com/api.php?${q}`)).json();
  await new Promise((r) => setTimeout(r, 1000)); // une requête par seconde
  return json.query ?? {};
};
/** Titre demandé -> titre final (normalisation, redirection). */
const resolve = (q, t) => {
  const next = new Map([...(q.normalized ?? []), ...(q.redirects ?? [])].map((r) => [r.from, r.to]));
  for (let k = 0; k < 2 && next.has(t); k++) t = next.get(t);
  return t;
};
const batches = (list) => Array.from({ length: Math.ceil(list.length / 50) }, (_, i) => list.slice(i * 50, i * 50 + 50));

// 3. icônes du wiki : d'abord au nom anglais, puis au titre de la page
// (puis sans « # », que les titres du wiki n'ont pas : « … smugglers #1 » -> « … smugglers 1 »)
const wanted = [...wikiWanted.entries()].flatMap(([title, list]) => list.map((id) => ({ id, names: [...new Set([en[`${id} Name`], title, en[`${id} Name`].replace(/#/g, "")])] })));
for (const round of [0, 1, 2]) {
  const todo = wanted.filter((w) => !out[w.id] && w.names[round]);
  const files = [...new Set(todo.map((w) => `File:${w.names[round]} icon.png`))];
  for (const batch of batches(files)) {
    const q = await wiki({ action: "query", prop: "imageinfo", iiprop: "url", iiurlwidth: "128", titles: batch.join("|") });
    const url = new Map((q.pages ?? []).map((pg) => [pg.title, pg.imageinfo?.[0]?.thumburl ?? pg.imageinfo?.[0]?.url]));
    for (const w of todo) {
      const u = url.get(resolve(q, `File:${w.names[round]} icon.png`));
      if (u && !out[w.id]) out[w.id] = u;
    }
  }
}

// 4. image de la page, si c'est bien une image de l'objet
const rest = [...wikiWanted.keys()].filter((t) => wikiWanted.get(t).some((id) => !out[id]));
for (const batch of batches(rest)) {
  const q = await wiki({ action: "query", prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "128", redirects: "1", titles: batch.join("|") });
  const page = new Map((q.pages ?? []).map((pg) => [pg.title, pg]));
  for (const t of batch) {
    const pg = page.get(resolve(q, t));
    if (!pg?.thumbnail?.source || /missing|map|location|door/i.test(pg.pageimage ?? "")) continue;
    for (const id of wikiWanted.get(t)) out[id] ??= pg.thumbnail.source;
  }
}

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "item-icons.json");
writeFileSync(file, JSON.stringify(out));
const left = missing.filter((id) => !out[id]).map((id) => en[`${id} Name`]);
console.log(`${Object.keys(out).length} images trouvées -> ${file} ; sans image nulle part : ${left.length}${left.length ? " (" + left.join(" | ") + ")" : ""}`);
