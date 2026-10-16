// Item finder : reconnaître un objet sur une capture de la fenêtre d'inspection du jeu (objet entier sur
// le fond à rayures grises). Références : images d'inspection de tarkov.dev (même rendu, même pose, même
// fond, cadrage différent). Des deux côtés : lissage (le fond a une trame en damier de 2 px), fond
// détecté (gris neutre et constant le long des rayures à 45°), recadrage sur l'objet, puis signature :
// rapport largeur/hauteur et, par case d'une grille 8 x 8, part d'objet et couleur moyenne.
// Logique pure (import de type seulement), lue telle quelle par Node (scripts/sync-item-images.mjs).
import type { Rgba } from "./itemImage";

const G = 8;
export const INSPECT_BYTES = 1 + G * G * 4;
/** Hauteur visée après lissage (px) : efface la trame du fond, garde la forme. */
const TARGET = 110;
/** Résultats gardés : ≤ 1,15 x la meilleure distance, 5 au plus. */
const RATIO = 1.15;
const LIMIT = 5;

/**
 * Capture de la fenêtre d'inspection ? Grande (≥ 150 px de côté) et bord gris neutre sombre (le fond
 * rayé et son vignettage), alors qu'une case d'inventaire a un fond teinté.
 * shortcut: une grande capture d'inventaire sur fond de case gris/noir passe pour une inspection ; à
 * revoir si des captures réelles le montrent.
 */
export function looksLikeInspect(img: Rgba): boolean {
  const { width: w, height: h, data } = img;
  if (Math.min(w, h) < 150) return false;
  const band = Math.round(Math.min(w, h) * 0.05);
  let neutral = 0;
  let total = 0;
  const lums: number[] = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x >= band && y >= band && x < w - band && y < h - band) continue;
      const i = (y * w + x) * 4;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      total++;
      if (max - Math.min(data[i], data[i + 1], data[i + 2]) <= 6) neutral++;
      lums.push(max);
    }
  }
  lums.sort((a, b) => a - b);
  return neutral / total >= 0.9 && lums[lums.length >> 1] < 40;
}

/** Moyenne de blocs k x k (dimensions arrondies vers le bas). */
function boxDown(img: Rgba, k: number): Rgba {
  const w = Math.floor(img.width / k);
  const h = Math.floor(img.height / k);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += img.data[((y * k + j) * img.width + x * k + i) * 4 + c];
        data[o + c] = s / (k * k);
      }
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/** Facteur de lissage d'une image w x h (le script de synchronisation réduit les références avec le même). */
export const smoothFactor = (w: number, h: number) => Math.max(2, Math.round(Math.min(w, h) / TARGET));

/** Signature d'une vue d'inspection (capture ou référence) ; null si aucun objet ne se détache du fond. */
export const inspectSignature = (img: Rgba) => smoothedSignature(boxDown(img, smoothFactor(img.width, img.height)));

/** Signature d'une image déjà lissée. */
export function smoothedSignature(img: Rgba): Uint8Array | null {
  const { width: w, height: h, data: d } = img;
  if (w < 16 || h < 16) return null;
  const lum = (x: number, y: number) => (d[(y * w + x) * 4] + d[(y * w + x) * 4 + 1] + d[(y * w + x) * 4 + 2]) / 3;
  const sat = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  };
  const st = 2;
  // sens des rayures (\ ou /) : celui où la luminosité varie le moins, sur les pixels gris moyens
  let down = 0;
  let up = 0;
  for (let y = st; y < h - st; y += 2) {
    for (let x = st; x < w - st; x += 2) {
      const v = lum(x, y);
      if (sat(x, y) > 6 || v < 15 || v > 70) continue;
      down += Math.abs(v - lum(x + st, y + st));
      up += Math.abs(v - lum(x + st, y - st));
    }
  }
  const dy = down <= up ? 1 : -1;
  // fond : gris neutre, pas trop clair, et constant le long des rayures
  const bg = new Uint8Array(w * h).fill(1);
  for (let y = st; y < h - st; y++) {
    for (let x = st; x < w - st; x++) {
      const v = lum(x, y);
      const tol = Math.max(6, v * 0.2);
      bg[y * w + x] = sat(x, y) <= 6 && v < 90 && Math.abs(v - lum(x + st, y + dy * st)) <= tol && Math.abs(v - lum(x - st, y - dy * st)) <= tol ? 1 : 0;
    }
  }
  // cadre de l'objet : centiles 0,5-99,5 des pixels d'objet entourés d'objet (le bruit isolé ne compte pas)
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (bg[y * w + x]) continue;
      let n = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) n += 1 - bg[(y + j) * w + x + i];
      if (n >= 15) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 20) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const q = (a: number[], f: number) => a[Math.floor(a.length * f)];
  const [x0, x1, y0, y1] = [q(xs, 0.005), q(xs, 0.995), q(ys, 0.005), q(ys, 0.995)];
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const col = new Float64Array(G * G * 3);
  const cov = new Float64Array(G * G);
  const n = new Float64Array(G * G);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = Math.min(G - 1, Math.floor(((y - y0) * G) / bh)) * G + Math.min(G - 1, Math.floor(((x - x0) * G) / bw));
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) col[c * 3 + k] += d[i + k];
      cov[c] += 1 - bg[y * w + x];
      n[c]++;
    }
  }
  const sig = new Uint8Array(INSPECT_BYTES);
  sig[0] = Math.round(((Math.max(-3, Math.min(3, Math.log2(bw / bh))) + 3) / 6) * 255);
  for (let c = 0; c < G * G; c++) {
    const o = 1 + c * 4;
    const m = n[c] || 1;
    sig[o] = Math.round((cov[c] / m) * 255);
    for (let k = 0; k < 3; k++) sig[o + 1 + k] = Math.round(col[c * 3 + k] / m);
  }
  return sig;
}

/** Distance de deux signatures (plus c'est bas, plus ça ressemble) : couleurs + forme + proportions. */
export function inspectDistance(a: Uint8Array, b: Uint8Array, ao = 0, bo = 0): number {
  let color = 0;
  let shape = 0;
  for (let c = 0; c < G * G; c++) {
    const i = ao + 1 + c * 4;
    const j = bo + 1 + c * 4;
    color += Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]) + Math.abs(a[i + 3] - b[j + 3]);
    shape += Math.abs(a[i] - b[j]) / 255;
  }
  const aspect = (Math.abs(a[ao] - b[bo]) * 6) / 255;
  // poids choisis sur 9 vraies captures (8 en 1er parmi 5 479 objets ; 6 à 8 pour les réglages voisins)
  return color / (G * G * 3) + (100 * shape) / (G * G) + 10 * aspect;
}

/** Fichier src/data/item-inspect.bin : nombre d'objets (uint32 LE), puis par objet 12 octets d'id et la signature. */
export function packInspect(rows: { id: string; sig: Uint8Array }[]): Uint8Array {
  const out = new Uint8Array(4 + rows.length * (12 + INSPECT_BYTES));
  new DataView(out.buffer).setUint32(0, rows.length, true);
  rows.forEach(({ id, sig }, n) => {
    const o = 4 + n * (12 + INSPECT_BYTES);
    for (let k = 0; k < 12; k++) out[o + k] = parseInt(id.slice(k * 2, k * 2 + 2), 16);
    out.set(sig, o + 12);
  });
  return out;
}

export interface InspectIndex {
  ids: string[];
  sigs: Uint8Array;
}
export function parseInspect(buf: ArrayBuffer): InspectIndex {
  const bytes = new Uint8Array(buf);
  const n = new DataView(buf).getUint32(0, true);
  const ids: string[] = [];
  const sigs = new Uint8Array(n * INSPECT_BYTES);
  for (let k = 0; k < n; k++) {
    const o = 4 + k * (12 + INSPECT_BYTES);
    ids.push(Array.from(bytes.subarray(o, o + 12), (b) => b.toString(16).padStart(2, "0")).join(""));
    sigs.set(bytes.subarray(o + 12, o + 12 + INSPECT_BYTES), k * INSPECT_BYTES);
  }
  return { ids, sigs };
}

/** Objets dont la vue d'inspection ressemble à la capture, du plus proche au moins proche. */
export function matchInspect(img: Rgba, index: InspectIndex): { id: string; score: number }[] {
  const sig = inspectSignature(img);
  if (!sig) return [];
  const all = index.ids.map((id, k) => ({ id, score: inspectDistance(sig, index.sigs, 0, k * INSPECT_BYTES) })).sort((a, b) => a.score - b.score);
  const best = all[0]?.score ?? Infinity;
  return all.filter((m) => m.score <= best * RATIO).slice(0, LIMIT);
}
