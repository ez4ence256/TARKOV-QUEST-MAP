// Signatures d'images des objets pour la recherche par image de l'item finder :
//  - télécharge l'image « grille » de chaque objet (icône sur son fond coloré, comme dans l'inventaire)
//    depuis assets.tarkov.dev, dans .cache/item-images (gardées : une relance ne retélécharge rien) ;
//  - les décode avec Python + Pillow (Node ne lit pas le WebP sans dépendance) ;
//  - écrit src/data/item-images.bin : chaque image réduite à P px par case (format : packIndex de
//    src/lib/itemImage.ts).
// Usage : npm run sync:items (Python 3 avec Pillow requis, seulement sur la machine qui lance le script)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packIndex, referenceThumb } from "../src/lib/itemImage.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, ".cache", "item-images");
const out = join(root, "src", "data", "item-images.bin");
mkdirSync(cache, { recursive: true });

const json = await (await fetch("https://json.tarkov.dev/regular/items")).json();
const items = Object.values(json.data.items).filter((i) => /^[0-9a-f]{24}$/.test(i.id) && i.gridImageLink);
console.log(`${items.length} objets`);

// téléchargement, 8 à la fois
let done = 0;
const queue = items.filter((i) => !existsSync(join(cache, `${i.id}.webp`)));
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const res = await fetch(item.gridImageLink).catch(() => null);
      if (res?.ok) writeFileSync(join(cache, `${item.id}.webp`), Buffer.from(await res.arrayBuffer()));
      else console.warn(`échec : ${item.id}`);
      if (++done % 250 === 0) console.log(`${done} images téléchargées`);
    }
  }),
);

// WebP -> RGBA brut (largeur et hauteur en uint32 little-endian, puis les pixels)
execFileSync(
  "python",
  [
    "-c",
    `import sys, os, struct
from PIL import Image
d = sys.argv[1]
for f in os.listdir(d):
    if not f.endswith(".webp") or os.path.exists(os.path.join(d, f[:-5] + ".rgba")): continue
    im = Image.open(os.path.join(d, f)).convert("RGBA")
    with open(os.path.join(d, f[:-5] + ".rgba"), "wb") as o:
        o.write(struct.pack("<II", *im.size)); o.write(im.tobytes())`,
    cache,
  ],
  { stdio: "inherit" },
);

const rows = [];
for (const item of items) {
  const file = join(cache, `${item.id}.rgba`);
  if (!existsSync(file)) continue;
  const buf = readFileSync(file);
  rows.push({ id: item.id, thumb: referenceThumb({ width: buf.readUInt32LE(0), height: buf.readUInt32LE(4), data: buf.subarray(8) }) });
}
const bin = packIndex(rows);
writeFileSync(out, bin);
console.log(`${rows.length} images -> ${out} (${Math.round(bin.length / 1024)} Ko)`);
