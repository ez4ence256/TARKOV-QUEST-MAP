// Quêtes exigées pour le Kappa selon le wiki (Infobox quest, champ reqkappa) : tarkov.dev n'en signale que 13.
// src/data/kappa-wiki.json = { generated, source, ids: [id de quête triés] }
// Usage : npm run sync:kappa   (≈ 1 requête wiki par seconde, 50 pages par requête)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanInline, parseInfobox } from "../src/lib/wikiText.ts";

const UA = "TarkovQuestPlanner-sync (+https://tarkov.aprilox.fr)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Union des quêtes PvP et PvE (id -> titre de page wiki)
const titles = new Map();
for (const mode of ["regular", "pve"]) {
  const res = await fetch(`https://json.tarkov.dev/${mode}/tasks`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`tarkov.dev ${mode}: HTTP ${res.status}`);
  for (const [id, t] of Object.entries((await res.json()).data.tasks)) {
    const raw = t.wikiLink?.split("/wiki/")[1];
    if (!raw) console.log(`sans wikiLink : ${id} ${t.normalizedName ?? ""}`);
    else titles.set(id, decodeURIComponent(raw).replace(/_/g, " "));
  }
}

// Pages wiki par lots de 50 ; on remonte normalized / redirects vers le titre demandé
const unique = [...new Set(titles.values())];
const content = new Map();
for (let i = 0; i < unique.length; i += 50) {
  if (i) await sleep(1000);
  const batch = unique.slice(i, i + 50);
  const url = "https://escapefromtarkov.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&formatversion=2&titles=" + encodeURIComponent(batch.join("|"));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`wiki: HTTP ${res.status}`);
  const q = (await res.json()).query;
  const alias = new Map(); // titre final -> titres demandés
  const back = (to) => [...(alias.get(to) ?? [to])];
  for (const n of q.normalized ?? []) alias.set(n.to, back(n.from));
  for (const r of q.redirects ?? []) alias.set(r.to, [...back(r.from), ...(alias.get(r.to) ?? [])]);
  for (const p of q.pages) {
    const text = p.revisions?.[0]?.slots?.main?.content;
    if (text) for (const t of alias.get(p.title) ?? [p.title]) content.set(t, text);
  }
}

const ids = [];
const missing = [];
for (const [id, title] of titles) {
  const text = content.get(title);
  if (text === undefined) missing.push(`${id} ${title}`);
  else if (cleanInline(parseInfobox(text).reqkappa ?? "").trim().toLowerCase() === "yes") ids.push(id);
}
ids.sort();
if (missing.length) console.log("pages manquantes :\n  " + missing.join("\n  "));

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "kappa-wiki.json");
const json = { generated: new Date().toISOString(), source: "Escape from Tarkov Wiki (Fandom), infobox reqkappa, CC BY-NC-SA", ids };
writeFileSync(out, JSON.stringify(json, null, 2) + "\n");
console.log(`${content.size}/${unique.length} pages lues, ${missing.length} manquantes, ${ids.length} quêtes Kappa -> ${out}`);
