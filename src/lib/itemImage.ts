// Item finder : reconnaître un objet sur une image collée (capture recadrée autour de l'objet), sans lire
// son nom. Signature compacte : forme (part de l'objet dans chaque case d'une grille) et couleur moyenne
// de l'objet par case, après avoir retiré le fond (couleur dominante du bord) et recadré sur l'objet.
// Même code pour les images de référence de tarkov.dev (scripts/sync-item-images.mjs) et pour la
// capture (navigateur). Logique pure : aucun import, pour être lue telle quelle par Node.

export const GRID = 8;
/** Octets par signature : rapport largeur/hauteur, puis par case : couverture, R, G, B. */
export const SIG_BYTES = 1 + GRID * GRID * 4;

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 4 octets par pixel (ImageData.data ou fichier décodé). */
  data: Uint8ClampedArray | Uint8Array;
}

/** Écart de couleur au-delà duquel un pixel n'est plus du fond (somme des écarts R + G + B). */
const BG_DISTANCE = 30;

const median = (values: number[]) => {
  values.sort((a, b) => a - b);
  return values[values.length >> 1] ?? 0;
};

type Color = [number, number, number];
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const near = (data: Rgba["data"], i: number, c: Color) => Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2]) < BG_DISTANCE;

/**
 * Fond le long du bord du cadre : médiane des pixels encore gardés d'une bande au bord, et part de
 * la bande qui lui ressemble (un vrai fond couvre presque toute la bande, le bord d'un objet non).
 */
function borderColor(img: Rgba, fg: Uint8Array, box: Box): { color: Color; share: number } | null {
  const band = Math.max(2, Math.round(Math.min(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1) * 0.06));
  const pixels: number[] = [];
  let all = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (x >= box.x0 + band && x <= box.x1 - band && y >= box.y0 + band && y <= box.y1 - band) continue;
      all++;
      if (fg[y * img.width + x]) pixels.push((y * img.width + x) * 4);
    }
  }
  if (!pixels.length) return null;
  const color: Color = [0, 1, 2].map((c) => median(pixels.map((i) => img.data[i + c]))) as Color;
  return { color, share: pixels.filter((i) => near(img.data, i, color)).length / all };
}

/** Cadre des pixels gardés (null si aucun). */
function boxOf(fg: Uint8Array, w: number, h: number): Box | null {
  let box: Box | null = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!fg[y * w + x]) continue;
      box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
    }
  }
  return box;
}

/** Retire les pixels proches de `color` et renvoie le cadre de ce qui reste (null si vide). */
function peel(img: Rgba, fg: Uint8Array, color: Color): Box | null {
  for (let p = 0; p < img.width * img.height; p++) if (fg[p] && near(img.data, p * 4, color)) fg[p] = 0;
  return boxOf(fg, img.width, img.height);
}

/**
 * Signatures après 1, 2… `peels` retraits successifs de la couleur du bord. Référence : 1 (le fond de
 * la case). Capture : jusqu'à 3, car on ignore si elle a de la marge autour de la case ; on garde le
 * meilleur score des trois (voir bestSimilarity).
 */
export function imageSignatures(img: Rgba, peels: number): Uint8Array[] {
  const { width: w, height: h } = img;
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) fg[p] = img.data[p * 4 + 3] >= 128 ? 1 : 0;
  const out: Uint8Array[] = [];
  let box: Box = { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  for (let pass = 0; pass < peels; pass++) {
    const border = borderColor(img, fg, box);
    if (!border) break;
    const kept = fg.slice();
    const next = peel(img, fg, border.color);
    if (!next) {
      fg.set(kept);
      break;
    }
    box = next;
    out.push(signatureOf(img, fg, box));
  }
  // rien ne se détache du fond : toute l'image compte
  if (!out.length) out.push(signatureOf(img, fg.fill(1), { x0: 0, y0: 0, x1: w - 1, y1: h - 1 }));
  return out;
}

/** Signature d'une image de référence (tarkov.dev). */
export const imageSignature = (img: Rgba) => imageSignatures(img, 1)[0];

/** Forme et couleur des pixels gardés dans le cadre. */
function signatureOf(img: Rgba, fg: Uint8Array, { x0, y0, x1, y1 }: Box): Uint8Array {
  const { width: w, data } = img;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const sig = new Uint8Array(SIG_BYTES);
  sig[0] = Math.round(((Math.max(-3, Math.min(3, Math.log2(bw / bh))) + 3) / 6) * 255);
  const count = new Float64Array(GRID * GRID);
  const total = new Float64Array(GRID * GRID);
  const sum = new Float64Array(GRID * GRID * 3);
  for (let y = y0; y <= y1; y++) {
    const cy = Math.min(GRID - 1, Math.floor(((y - y0) * GRID) / bh));
    for (let x = x0; x <= x1; x++) {
      const c = cy * GRID + Math.min(GRID - 1, Math.floor(((x - x0) * GRID) / bw));
      total[c]++;
      if (!fg[y * w + x]) continue;
      const i = (y * w + x) * 4;
      count[c]++;
      sum[c * 3] += data[i];
      sum[c * 3 + 1] += data[i + 1];
      sum[c * 3 + 2] += data[i + 2];
    }
  }
  for (let c = 0; c < GRID * GRID; c++) {
    const o = 1 + c * 4;
    sig[o] = total[c] ? Math.round((count[c] / total[c]) * 255) : 0;
    if (!count[c]) continue;
    sig[o + 1] = Math.round(sum[c * 3] / count[c]);
    sig[o + 2] = Math.round(sum[c * 3 + 1] / count[c]);
    sig[o + 3] = Math.round(sum[c * 3 + 2] / count[c]);
  }
  return sig;
}

/** Ressemblance de deux signatures, de 0 à 1 (a et b lues à partir des positions ao et bo). */
export function signatureSimilarity(a: Uint8Array, b: Uint8Array, ao = 0, bo = 0): number {
  let shape = 0;
  let color = 0;
  let weight = 0;
  for (let c = 0; c < GRID * GRID; c++) {
    const i = ao + 1 + c * 4;
    const j = bo + 1 + c * 4;
    const ca = a[i] / 255;
    const cb = b[j] / 255;
    shape += Math.abs(ca - cb);
    const both = Math.min(ca, cb);
    if (both > 0) {
      color += both * (Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]) + Math.abs(a[i + 3] - b[j + 3])) / 765;
      weight += both;
    }
  }
  const shapeScore = 1 - shape / (GRID * GRID);
  const colorScore = weight ? 1 - color / weight : 0;
  const aspect = 1 - Math.min(1, Math.abs(a[ao] - b[bo]) / 255);
  return 0.4 * shapeScore + 0.45 * colorScore + 0.15 * aspect;
}

/** Meilleure ressemblance entre les signatures d'une capture et une signature de référence. */
export const bestSimilarity = (queries: Uint8Array[], ref: Uint8Array, offset = 0) => Math.max(...queries.map((q) => signatureSimilarity(q, ref, 0, offset)));

/** Fichier src/data/item-images.bin lu : ids et signatures bout à bout. */
export interface ImageIndex {
  ids: string[];
  sigs: Uint8Array;
}
export function parseImageIndex(buf: ArrayBuffer): ImageIndex {
  const bytes = new Uint8Array(buf);
  const n = new DataView(buf).getUint32(0, true);
  const ids: string[] = [];
  const sigs = new Uint8Array(n * SIG_BYTES);
  for (let k = 0; k < n; k++) {
    const o = 4 + k * (12 + SIG_BYTES);
    ids.push(Array.from(bytes.subarray(o, o + 12), (b) => b.toString(16).padStart(2, "0")).join(""));
    sigs.set(bytes.subarray(o + 12, o + 12 + SIG_BYTES), k * SIG_BYTES);
  }
  return { ids, sigs };
}

/**
 * Objets dont l'image ressemble le plus à la capture, du plus proche au moins proche : seulement ceux à
 * moins de `gap` du meilleur score (les scores sont serrés : un objet sans rapport obtient déjà ~0,90).
 * Banc d'essai (300 objets déformés) : écart 0,01 -> bon objet gardé 94 %, ~5 résultats.
 */
export function matchImage(img: Rgba, index: ImageIndex, gap = 0.01, limit = 5): { id: string; score: number }[] {
  const queries = imageSignatures(img, 3);
  const all = index.ids.map((id, k) => ({ id, score: bestSimilarity(queries, index.sigs, k * SIG_BYTES) })).sort((a, b) => b.score - a.score);
  const best = all[0]?.score ?? 0;
  return all.filter((m) => m.score >= best - gap).slice(0, limit);
}
