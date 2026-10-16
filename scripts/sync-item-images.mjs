// Références de la recherche par image de l'item finder, depuis assets.tarkov.dev (téléchargées dans
// .cache, gardées : une relance ne retélécharge rien), décodées avec Python + Pillow (Node ne lit pas le
// WebP sans dépendance) :
//  - image « grille » (icône sur son fond de case, comme dans l'inventaire ; ~35 Mo) -> src/data/item-images.bin,
//    chaque image réduite à P px par case (packIndex de src/lib/itemImage.ts) ;
//  - image d'inspection (objet sur le fond rayé ; ~470 Mo) -> src/data/item-inspect.bin, une signature
//    par objet (packInspect de src/lib/itemInspect.ts).
// Usage : npm run sync:items (Python 3 avec Pillow requis, seulement sur la machine qui lance le script)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packIndex, referenceThumb } from "../src/lib/itemImage.ts";
import { packInspect, smoothedSignature, smoothFactor } from "../src/lib/itemInspect.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, ".cache", "item-images");
const inspectCache = join(root, ".cache", "item-inspect");
mkdirSync(cache, { recursive: true });
mkdirSync(inspectCache, { recursive: true });

const json = await (await fetch("https://json.tarkov.dev/regular/items")).json();
const items = Object.values(json.data.items).filter((i) => /^[0-9a-f]{24}$/.test(i.id) && i.gridImageLink);
console.log(`${items.length} objets`);

/** Télécharge `link(item)` dans dir/<id>.webp, 8 à la fois. */
async function download(dir, link) {
  let done = 0;
  const queue = items.filter((i) => link(i) && !existsSync(join(dir, `${i.id}.webp`)));
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const res = await fetch(link(item)).catch(() => null);
        if (res?.ok) writeFileSync(join(dir, `${item.id}.webp`), Buffer.from(await res.arrayBuffer()));
        else console.warn(`échec : ${item.id}`);
        if (++done % 250 === 0) console.log(`${dir} : ${done} images téléchargées`);
      }
    }),
  );
}
await download(cache, (i) => i.gridImageLink);
await download(inspectCache, (i) => i.inspectImageLink);

// WebP -> RGBA brut (largeur et hauteur en uint32 little-endian, puis les pixels). `smooth` : réduit
// d'abord par moyenne de blocs, du facteur de smoothFactor (même formule, ~110 px de haut).
function decode(dir, smooth) {
  execFileSync(
    "python",
    [
      "-c",
      `import sys, os, struct
from PIL import Image
d, smooth = sys.argv[1], sys.argv[2] == "1"
for f in os.listdir(d):
    if not f.endswith(".webp") or os.path.exists(os.path.join(d, f[:-5] + ".rgba")): continue
    im = Image.open(os.path.join(d, f)).convert("RGBA")
    if smooth:
        k = max(2, int(min(im.size) / ${110} + 0.5))
        im = im.crop((0, 0, im.width // k * k, im.height // k * k)).reduce(k)
    with open(os.path.join(d, f[:-5] + ".rgba"), "wb") as o:
        o.write(struct.pack("<II", *im.size)); o.write(im.tobytes())`,
      dir,
      smooth ? "1" : "0",
    ],
    { stdio: "inherit" },
  );
}
decode(cache, false);
decode(inspectCache, true);

const readRgba = (file) => {
  const buf = readFileSync(file);
  return { width: buf.readUInt32LE(0), height: buf.readUInt32LE(4), data: buf.subarray(8) };
};
const rows = items.filter((i) => existsSync(join(cache, `${i.id}.rgba`))).map((i) => ({ id: i.id, thumb: referenceThumb(readRgba(join(cache, `${i.id}.rgba`))) }));
const bin = packIndex(rows);
writeFileSync(join(root, "src", "data", "item-images.bin"), bin);
console.log(`${rows.length} images d'inventaire -> item-images.bin (${Math.round(bin.length / 1024)} Ko)`);

const sigs = items
  .filter((i) => existsSync(join(inspectCache, `${i.id}.rgba`)))
  .map((i) => ({ id: i.id, sig: smoothedSignature(readRgba(join(inspectCache, `${i.id}.rgba`))) }))
  .filter((r) => r.sig);
const inspect = packInspect(sigs);
writeFileSync(join(root, "src", "data", "item-inspect.bin"), inspect);
console.log(`${sigs.length} vues d'inspection -> item-inspect.bin (${Math.round(inspect.length / 1024)} Ko)`);
// le facteur de lissage de Python doit rester celui de smoothFactor (images de tarkov.dev : 512 x 350)
if (smoothFactor(512, 350) !== 3) throw new Error("smoothFactor a changé : mettre à jour la réduction Python");
