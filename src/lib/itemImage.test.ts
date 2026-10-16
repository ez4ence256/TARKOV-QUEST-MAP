// Item finder : reconnaissance d'un objet par son image. Images synthétiques (format, glissement,
// échelle, débord) et deux vraies captures du jeu (recadrées à la main, objet partiel) contre le
// fichier de références livré.
import deltapointFile from "./__fixtures__/capture-deltapoint.bin?inline";
import moonshineFile from "./__fixtures__/capture-moonshine.bin?inline";
import shippedFile from "../data/item-images.bin?inline";
import { describe, expect, it } from "vitest";
import { captureThumbs, matchImage, matchScore, packIndex, parseImageIndex, referenceThumb, type Rgba } from "./itemImage";

type Color = [number, number, number];
/** Image w x h de couleur `bg`, avec un rectangle `obj` (fractions de l'image). */
function picture(w: number, h: number, bg: Color, obj: { x: number; y: number; w: number; h: number; color: Color }): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inObj = x / w >= obj.x && x / w < obj.x + obj.w && y / h >= obj.y && y / h < obj.y + obj.h;
      data.set([...(inObj ? obj.color : bg), 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}
/** Morceau (x, y, w, h en pixels) d'une image, agrandi `scale` fois (plus proche voisin). */
function crop(img: Rgba, x0: number, y0: number, w: number, h: number, scale: number): Rgba {
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = ((y0 + Math.floor(y / scale)) * img.width + x0 + Math.floor(x / scale)) * 4;
      data.set(img.data.subarray(i, i + 4), (y * W + x) * 4);
    }
  }
  return { width: W, height: H, data };
}

const VIOLET: Color = [35, 25, 38];
const BLUE: Color = [20, 30, 45];
const refs: Record<string, Rgba> = {
  "5d1b376e86f774252519444e": picture(64, 128, VIOLET, { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [50, 90, 85] }), // bouteille verte
  aaaaaaaaaaaaaaaaaaaaaaaa: picture(64, 128, VIOLET, { x: 0.3, y: 0.1, w: 0.4, h: 0.85, color: [160, 40, 30] }), // même forme, rouge
  bbbbbbbbbbbbbbbbbbbbbbbb: picture(128, 64, BLUE, { x: 0.1, y: 0.3, w: 0.8, h: 0.4, color: [70, 70, 70] }), // pièce grise couchée
  cccccccccccccccccccccccc: picture(64, 64, BLUE, { x: 0.2, y: 0.2, w: 0.6, h: 0.6, color: [200, 190, 60] }),
};
const ids = Object.keys(refs);
const bin = packIndex(ids.map((id) => ({ id, thumb: referenceThumb(refs[id]) })));
const index = parseImageIndex(bin.buffer as ArrayBuffer);

describe("recherche par image (images synthétiques)", () => {
  it("fichier de références : ids et tailles relus", () => {
    expect(index.ids).toEqual(ids);
    expect(index.thumbs.map((t) => [t.w, t.h])).toEqual([
      [12, 24],
      [12, 24],
      [24, 12],
      [12, 12],
    ]);
  });
  it("morceau de la bouteille (milieu seul), à l'échelle d'un écran 1440p : un seul résultat, le bon", async () => {
    const part = crop(refs["5d1b376e86f774252519444e"], 12, 30, 40, 70, 84 / 64);
    expect((await matchImage(part, index)).map((m) => m.id)).toEqual(["5d1b376e86f774252519444e"]);
  });
  it("capture qui déborde un peu de la case (cadre gris pris avec)", async () => {
    const base = refs.cccccccccccccccccccccccc;
    const framed = picture(70, 70, [73, 81, 84], { x: 0, y: 0, w: 0, h: 0, color: [0, 0, 0] });
    for (let y = 0; y < 64; y++) framed.data.set(base.data.subarray(y * 64 * 4, (y + 1) * 64 * 4), ((y + 3) * 70 + 3) * 4);
    expect((await matchImage(framed, index))[0].id).toBe("cccccccccccccccccccccccc");
  });
  it("capture trop petite : aucune échelle utilisable, aucun résultat", async () => {
    expect(captureThumbs(picture(12, 12, VIOLET, { x: 0, y: 0, w: 1, h: 1, color: VIOLET }))).toHaveLength(0);
    expect(await matchImage(picture(12, 12, VIOLET, { x: 0, y: 0, w: 1, h: 1, color: VIOLET }), index)).toEqual([]);
  });
  it("rien ne ressemble : aucun résultat (seuil absolu)", async () => {
    expect(await matchImage(picture(60, 60, [250, 250, 250], { x: 0.2, y: 0.2, w: 0.6, h: 0.6, color: [255, 0, 255] }), index)).toEqual([]);
  });
  it("abandon demandé (nouveau collage) : rien", async () => {
    const big = { ids: Array(600).fill("5d1b376e86f774252519444e"), thumbs: Array(600).fill(index.thumbs[0]) };
    expect(await matchImage(refs["5d1b376e86f774252519444e"], big, () => true)).toEqual([]);
  });
  it("une référence contre elle-même : écart presque nul (arrondi RGB565 seulement)", () => {
    expect(matchScore(captureThumbs(refs.aaaaaaaaaaaaaaaaaaaaaaaa), index.thumbs[1])).toBeLessThan(5);
  });
});

describe("recherche par image (vraies captures du jeu, fichier livré)", () => {
  // fichiers importés par Vite en data: URL (base64)
  const bytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const read = (dataUrl: string): Rgba => {
    const b = bytes(dataUrl);
    const view = new DataView(b.buffer);
    return { width: view.getUint32(0, true), height: view.getUint32(4, true), data: b.subarray(8) };
  };
  const shipped = parseImageIndex(bytes(shippedFile).buffer as ArrayBuffer);
  it("viseur Leupold DeltaPoint (44 x 34 px, coupé en bas à droite, icône de slot) : 1er", async () => {
    expect((await matchImage(read(deltapointFile), shipped))[0]?.id).toBe("58d268fc86f774111273f8c2");
  }, 30000);
  it("Moonshine (39 x 70 px, haut et bas de la bouteille coupés, sans le nom) : 1re", async () => {
    expect((await matchImage(read(moonshineFile), shipped))[0]?.id).toBe("5d1b376e86f774252519444e");
  }, 30000);
});
