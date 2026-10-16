// Item finder : reconnaissance d'un objet par son image, sur des images synthétiques (fond de case uni,
// objet de couleur), avec ou sans marge autour de la case.
import { describe, expect, it } from "vitest";
import { imageSignature, matchImage, parseImageIndex, SIG_BYTES, type Rgba } from "./itemImage";

type Color = [number, number, number];
/** Case w x h de couleur `bg`, avec un rectangle `obj` (fractions de la case), entourée de `margin` px de `around`. */
function cell(w: number, h: number, bg: Color, obj: { x: number; y: number; w: number; h: number; color: Color }, margin = 0, around: Color = [12, 12, 12]): Rgba {
  const W = w + 2 * margin;
  const H = h + 2 * margin;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = (x - margin) / w;
      const cy = (y - margin) / h;
      const inCell = cx >= 0 && cx < 1 && cy >= 0 && cy < 1;
      const inObj = cx >= obj.x && cx < obj.x + obj.w && cy >= obj.y && cy < obj.y + obj.h;
      const c = !inCell ? around : inObj ? obj.color : bg;
      data.set([...c, 255], (y * W + x) * 4);
    }
  }
  return { width: W, height: H, data };
}

const VIOLET: Color = [35, 25, 38];
const items: Record<string, Rgba> = {
  "5d1b376e86f774252519444e": cell(64, 128, VIOLET, { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [50, 90, 85] }), // bouteille verte
  "aaaaaaaaaaaaaaaaaaaaaaaa": cell(64, 128, VIOLET, { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [160, 40, 30] }), // même forme, rouge
  "bbbbbbbbbbbbbbbbbbbbbbbb": cell(128, 64, VIOLET, { x: 0.1, y: 0.3, w: 0.8, h: 0.4, color: [50, 90, 85] }), // couchée
  "cccccccccccccccccccccccc": cell(64, 64, [20, 30, 45], { x: 0.2, y: 0.2, w: 0.6, h: 0.6, color: [200, 190, 60] }),
};
function indexFile(): ArrayBuffer {
  const ids = Object.keys(items);
  const bytes = new Uint8Array(4 + ids.length * (12 + SIG_BYTES));
  new DataView(bytes.buffer).setUint32(0, ids.length, true);
  ids.forEach((id, k) => {
    const o = 4 + k * (12 + SIG_BYTES);
    bytes.set(id.match(/../g)!.map((h) => parseInt(h, 16)), o);
    bytes.set(imageSignature(items[id]), o + 12);
  });
  return bytes.buffer;
}

describe("recherche par image", () => {
  const index = parseImageIndex(indexFile());
  it("lit le fichier de signatures", () => {
    expect(index.ids).toEqual(Object.keys(items));
    expect(index.sigs.length).toBe(4 * SIG_BYTES);
  });
  it("retrouve l'objet sur sa propre image, puis avec une marge et à une autre taille", () => {
    expect(matchImage(items["5d1b376e86f774252519444e"], index)[0].id).toBe("5d1b376e86f774252519444e");
    const crop = cell(96, 192, VIOLET, { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [55, 95, 88] }, 7);
    const found = matchImage(crop, index);
    expect(found[0].id).toBe("5d1b376e86f774252519444e");
    expect(found[0].score).toBeGreaterThan(found[1].score);
  });
  it("l'objet seul sur un autre fond", () => {
    const other = cell(64, 128, [200, 200, 210], { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [50, 90, 85] });
    expect(matchImage(other, index)[0].id).toBe("5d1b376e86f774252519444e");
  });
  it("image unie : pas d'erreur, tous les objets classés", () => {
    expect(matchImage(cell(10, 10, VIOLET, { x: 0, y: 0, w: 0, h: 0, color: VIOLET }), index, 99)).toHaveLength(4);
  });
});
