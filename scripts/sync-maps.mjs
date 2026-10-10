// Met à jour les fichiers de cartes embarqués dans le projet :
//  - src/data/tarkov-dev-maps.json : valeurs de calibrage du site tarkov.dev
//  - public/maps/svg/*.svg         : fonds de carte du dépôt tarkov-dev-svg-maps
//
// Usage : npm run sync:maps
// (l'app récupère aussi le calibrage en ligne au démarrage ; ce script ne sert
// qu'à rafraîchir la copie de secours embarquée.)
import { writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const MAPS_JSON =
  "https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json";
const SVG_BASE = "https://raw.githubusercontent.com/the-hideout/tarkov-dev-svg-maps/main/";

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} pour ${url}`);
  return res.text();
}

const mapsJson = await download(MAPS_JSON);
const groups = JSON.parse(mapsJson);
await writeFile(path.join(root, "src/data/tarkov-dev-maps.json"), mapsJson);
console.log("Calibrage mis à jour :", groups.length, "groupes");

// Noms de fichiers SVG utilisés par le site (svgPath = https://assets.tarkov.dev/maps/svg/<Nom>.svg)
const svgFiles = new Set();
for (const group of groups) {
  for (const map of group.maps ?? []) {
    if (map.svgPath) svgFiles.add(map.svgPath.split("/").pop());
  }
}
for (const file of svgFiles) {
  const svg = await download(SVG_BASE + file);
  await writeFile(path.join(root, "public/maps/svg", file), svg);
  console.log("SVG mis à jour :", file);
}
