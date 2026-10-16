// Item finder : reconnaître un objet sur une image collée (capture recadrée sur l'objet, même partielle),
// sans lire son nom. Les images « grille » de tarkov.dev (icône sur son fond de case, 64 px par case) sont
// gardées en tout petit (P px par case) ; la capture, réduite à la même échelle, glisse sur chacune et
// garde la position où les couleurs collent le mieux. La taille d'une case à l'écran dépend de la
// résolution du jeu : plusieurs échelles sont essayées. Même code pour scripts/sync-item-images.mjs
// (Node) et le navigateur. Logique pure : aucun import, pour être lue telle quelle par Node.

/** Pixels par case dans les références. */
export const P = 12;
/** Tailles d'une case à l'écran essayées (px) : 1080p ≈ 63, 1440p ≈ 84, 4K ≈ 126. */
export const CELL_SIZES = [54, 64, 74, 86, 100, 116];
/** Capture réduite plus petite que ça (px) : elle collerait n'importe où, échelle ignorée. */
const MIN_SIDE = 5;
/** La capture peut déborder de la case de 15 % par côté (cadre ou voisin pris avec), si 85 % d'elle reste dessus. */
const HANG = 0.15;
const MIN_OVERLAP = 0.85;
/** Résultats gardés : écart moyen ≤ MAX_SCORE (sur 255) et ≤ 1,2 x le meilleur, 5 au plus. */
export const MAX_SCORE = 20;
const RATIO = 1.2;
const LIMIT = 5;

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 4 octets par pixel (ImageData.data ou fichier décodé). */
  data: Uint8ClampedArray | Uint8Array;
}
/** Image réduite : RGB, 3 valeurs par pixel. */
export interface Thumb {
  w: number;
  h: number;
  d: Float32Array | Uint8Array;
}

/** Réduction par moyenne de blocs à tw x th. */
export function shrink(img: Rgba, tw: number, th: number): Thumb {
  const d = new Float32Array(tw * th * 3);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * img.height) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * img.height) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * img.width) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * img.width) / tw));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * img.width + x) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
        }
      }
      const n = (x1 - x0) * (y1 - y0);
      d.set([r / n, g / n, b / n], (ty * tw + tx) * 3);
    }
  }
  return { w: tw, h: th, d };
}

/** Référence tarkov.dev (64 px par case) -> P px par case. */
export const referenceThumb = (img: Rgba) => shrink(img, Math.max(1, Math.round((img.width * P) / 64)), Math.max(1, Math.round((img.height * P) / 64)));

/** La capture à chaque échelle essayée (assez grande pour être utile). */
export function captureThumbs(img: Rgba): Thumb[] {
  return CELL_SIZES.map((c) => [Math.round((img.width * P) / c), Math.round((img.height * P) / c)])
    .filter(([w, h]) => Math.min(w, h) >= MIN_SIDE)
    .map(([w, h]) => shrink(img, w, h));
}

/** Plus petit écart moyen (0 à 255) entre une capture réduite et une position sur la référence. */
function bestOffset(cap: Thumb, ref: Thumb, best: number): number {
  const hx = Math.floor(cap.w * HANG);
  const hy = Math.floor(cap.h * HANG);
  for (let oy = -hy; oy + cap.h <= ref.h + hy; oy++) {
    for (let ox = -hx; ox + cap.w <= ref.w + hx; ox++) {
      const x0 = Math.max(0, -ox);
      const x1 = Math.min(cap.w, ref.w - ox);
      const y0 = Math.max(0, -oy);
      const y1 = Math.min(cap.h, ref.h - oy);
      const area = (x1 - x0) * (y1 - y0);
      if (x1 <= x0 || y1 <= y0 || area < MIN_OVERLAP * cap.w * cap.h) continue;
      const limit = best * area * 3;
      let s = 0;
      for (let y = y0; y < y1 && s < limit; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * cap.w + x) * 3;
          const j = ((y + oy) * ref.w + x + ox) * 3;
          s += Math.abs(cap.d[i] - ref.d[j]) + Math.abs(cap.d[i + 1] - ref.d[j + 1]) + Math.abs(cap.d[i + 2] - ref.d[j + 2]);
        }
      }
      best = Math.min(best, s / (area * 3));
    }
  }
  return best;
}

/** Écart de la capture (toutes échelles) à une référence : plus c'est bas, plus ça ressemble. */
export function matchScore(caps: Thumb[], ref: Thumb): number {
  let best = Infinity;
  for (const cap of caps) best = bestOffset(cap, ref, best);
  return best;
}

/**
 * Fichier src/data/item-images.bin : nombre d'objets (uint32 LE), puis par objet 12 octets d'id,
 * largeur et hauteur réduites (1 octet chacune) et les pixels en RGB565 (2 octets LE).
 */
export function packIndex(rows: { id: string; thumb: Thumb }[]): Uint8Array {
  const size = rows.reduce((n, r) => n + 14 + r.thumb.w * r.thumb.h * 2, 4);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, rows.length, true);
  let o = 4;
  for (const { id, thumb } of rows) {
    for (let k = 0; k < 12; k++) out[o + k] = parseInt(id.slice(k * 2, k * 2 + 2), 16);
    out[o + 12] = thumb.w;
    out[o + 13] = thumb.h;
    o += 14;
    for (let p = 0; p < thumb.w * thumb.h; p++, o += 2) {
      const [r, g, b] = [0, 1, 2].map((c) => Math.round(thumb.d[p * 3 + c]));
      view.setUint16(o, ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3), true);
    }
  }
  return out;
}

export interface ImageIndex {
  ids: string[];
  thumbs: Thumb[];
}
export function parseImageIndex(buf: ArrayBuffer): ImageIndex {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const n = view.getUint32(0, true);
  const ids: string[] = [];
  const thumbs: Thumb[] = [];
  let o = 4;
  for (let k = 0; k < n; k++) {
    ids.push(Array.from(bytes.subarray(o, o + 12), (b) => b.toString(16).padStart(2, "0")).join(""));
    const w = bytes[o + 12];
    const h = bytes[o + 13];
    o += 14;
    const d = new Uint8Array(w * h * 3);
    for (let p = 0; p < w * h; p++, o += 2) {
      const v = view.getUint16(o, true);
      d[p * 3] = ((v >> 11) * 255) / 31;
      d[p * 3 + 1] = (((v >> 5) & 63) * 255) / 63;
      d[p * 3 + 2] = ((v & 31) * 255) / 31;
    }
    thumbs.push({ w, h, d });
  }
  return { ids, thumbs };
}

/**
 * Objets dont l'image ressemble à la capture, du plus proche au moins proche. Rend la main au
 * navigateur tous les 300 objets (quelques secondes en tout) ; `stop()` vrai = abandon (nouveau collage).
 */
export async function matchImage(img: Rgba, index: ImageIndex, stop: () => boolean = () => false): Promise<{ id: string; score: number }[]> {
  const caps = captureThumbs(img);
  if (!caps.length) return [];
  const scores: { id: string; score: number }[] = [];
  for (let k = 0; k < index.ids.length; k++) {
    if (k % 300 === 299) {
      await new Promise((r) => setTimeout(r));
      if (stop()) return [];
    }
    scores.push({ id: index.ids[k], score: matchScore(caps, index.thumbs[k]) });
  }
  scores.sort((a, b) => a.score - b.score);
  const best = scores[0]?.score ?? Infinity;
  return scores.filter((m) => m.score <= MAX_SCORE && m.score <= best * RATIO).slice(0, LIMIT);
}
