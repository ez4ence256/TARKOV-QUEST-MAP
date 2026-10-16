// Item finder : reconnaissance d'un objet sur une capture de la fenêtre d'inspection (fond rayé).
// Détection du type de capture (images synthétiques) et deux vraies captures du jeu, déjà lissées
// comme le fait le script pour les références, contre le fichier livré.
import { describe, expect, it } from "vitest";
import rgnFile from "./__fixtures__/inspect-rgn.bin?inline";
import ulachFile from "./__fixtures__/inspect-ulach.bin?inline";
import shippedFile from "../data/item-inspect.bin?inline";
import { INSPECT_BYTES, inspectDistance, looksLikeInspect, parseInspect, smoothedSignature } from "./itemInspect";
import type { Rgba } from "./itemImage";

/** Image w x h : fond `bg` (fonction des coordonnées), carré central de couleur `obj`. */
function picture(w: number, h: number, bg: (x: number, y: number) => number[], obj: number[]): Rgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inObj = Math.abs(x - w / 2) < w / 6 && Math.abs(y - h / 2) < h / 6;
      data.set([...(inObj ? obj : bg(x, y)), 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}
const stripes = (x: number, y: number) => ((x + y) % 20 < 10 ? [12, 12, 12] : [30, 30, 30]);

describe("type de capture", () => {
  it("grande image sur fond rayé gris : inspection", () => {
    expect(looksLikeInspect(picture(400, 260, stripes, [120, 100, 60]))).toBe(true);
  });
  it("case d'inventaire (fond teinté) ou petite capture : pas une inspection", () => {
    expect(looksLikeInspect(picture(400, 260, () => [35, 25, 38], [120, 100, 60]))).toBe(false);
    expect(looksLikeInspect(picture(60, 120, stripes, [120, 100, 60]))).toBe(false);
  });
});

describe("vraies captures d'inspection, fichier livré", () => {
  // fichiers importés par Vite en data: URL (base64)
  const bytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const read = (dataUrl: string): Rgba => {
    const b = bytes(dataUrl);
    const view = new DataView(b.buffer);
    return { width: view.getUint32(0, true), height: view.getUint32(4, true), data: b.subarray(8) };
  };
  const index = parseInspect(bytes(shippedFile).buffer as ArrayBuffer);
  const first = (img: Rgba) => {
    const sig = smoothedSignature(img)!;
    let best = { id: "", score: Infinity };
    index.ids.forEach((id, k) => {
      const score = inspectDistance(sig, index.sigs, 0, k * INSPECT_BYTES);
      if (score < best.score) best = { id, score };
    });
    return best.id;
  };
  it("grenade RGN : 1re parmi tous les objets", () => {
    expect(first(read(rgnFile))).toBe("617fd91e5539a84ec44ce155");
  });
  it("casque Highcom Striker ULACH noir : 1er", () => {
    expect(first(read(ulachFile))).toBe("5b40e1525acfc4771e1c6611");
  });
});
