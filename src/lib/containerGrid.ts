// Capture d'un conteneur (junk box, sac, scav case…) : trouver la grille de cases, découper la bande
// du nom court en haut de chaque rangée de cases, puis rapprocher les mots lus des noms courts des
// objets (« Vase », « OScope », « GoldChain »). Le nom est écrit en haut à droite de l'objet : le mot
// donne la rangée et la colonne de la case en haut à droite de l'objet.
// Logique pure (aucun appel au navigateur) : testée sous Node. L'OCR lui-même est dans lib/ocr.ts.

import type { Rgba } from "./itemImage";
import { normalizeOcr, similarity } from "./ocrMatch";

export interface Grid {
  /** Taille d'une case à l'écran (px, pas forcément entière : capture réduite) : 1080p ≈ 63, 1440p ≈ 84. */
  pitch: number;
  /** Position d'un bord de case (px), modulo pitch. */
  ox: number;
  oy: number;
}

/** Hauteur de la bande du nom et agrandissement, pour une case de 63 px (mis à l'échelle sinon). */
const STRIP_AT_63 = 15;
const UPSCALE_AT_63 = 4;
/** Marge blanche autour de la bande (Tesseract lit mal le texte collé au bord). */
export const BORDER = 20;
/** Noyau du « top-hat » (px, image agrandie) : garde les traits fins et clairs (lettres), efface les grandes zones claires (icônes). */
const TOPHAT = 21;
const TOPHAT_MIN = 40;

function grayOf(img: Rgba): Float32Array {
  const g = new Float32Array(img.width * img.height);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  return g;
}

/**
 * Période du profil (bords de cases) : la plus forte autocorrélation, ramenée à la plus petite période
 * qui corrèle encore (63 et pas 126 ; 45 et pas 136 = 3 cases, sur une capture réduite).
 */
export function profilePeriod(profile: Float32Array, lo = 32, hi = 140): number | null {
  const n = profile.length;
  const mean = profile.reduce((s, v) => s + v, 0) / n;
  const p = profile.map((v) => v - mean);
  const cor = (P: number) => {
    let s = 0;
    for (let i = 0; i + P < n; i++) s += p[i] * p[i + P];
    return s / (n - P);
  };
  let best = -Infinity;
  let period: number | null = null;
  for (let P = lo; P <= Math.min(hi, Math.floor(n / 2)); P++) {
    const c = cor(P);
    if (c > best) [best, period] = [c, P];
  }
  if (period === null || best <= 0) return null;
  let P: number = period;
  for (let changed = true; changed; ) {
    changed = false;
    for (const k of [4, 3, 2]) {
      const q = P / k;
      if (q < lo) continue;
      const h = [Math.floor(q) - 1, Math.floor(q), Math.ceil(q), Math.ceil(q) + 1].reduce((a, b) => (cor(b) > cor(a) ? b : a));
      if (cor(h) > 0.5 * cor(P)) {
        P = h;
        changed = true;
        break;
      }
    }
  }
  return P;
}

/** Écart de gris d'un trait de case avec ses voisins (0-255). */
const RIDGE = 6;

/** Profil lissé sur 3 pixels : un trait de bord donne deux pics voisins (entrée, sortie), réunis en un. */
const smooth3 = (p: Float32Array) => p.map((v, i) => (p[i - 1] ?? v) + 2 * v + (p[i + 1] ?? v));

/** Meilleur décalage d'un peigne de pas `p` sur le profil, et sa moyenne (dents arrondies au pixel). */
function comb(profile: Float32Array, p: number): { offset: number; score: number } {
  let best = { offset: 0, score: -Infinity };
  for (let o = 0; o < p; o += 0.25) {
    let s = 0;
    let n = 0;
    for (let x = o; x < profile.length; x += p, n++) s += profile[Math.round(x)] ?? 0;
    if (n && s / n > best.score) best = { offset: o, score: s / n };
  }
  return best;
}

/** Grille de cases d'après les bords (changements d'intensité alignés), null si l'image n'en a pas. */
export function detectGrid(img: Rgba): Grid | null {
  const { width: W, height: H } = img;
  const g = grayOf(img);
  const dx = new Float32Array(W - 1);
  const dy = new Float32Array(H - 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = g[y * W + x];
      if (x + 1 < W) dx[x] += Math.abs(g[y * W + x + 1] - v);
      if (y + 1 < H) dy[y] += Math.abs(g[(y + 1) * W + x] - v);
    }
  let px = profilePeriod(dx);
  let py = profilePeriod(dy);
  if (!px || !py) return null;
  // cases carrées. Objets de 2 cases partout dans un sens (casques, plaques) : pas de trait intérieur, la
  // période y est double ; sinon, un écart net entre les deux périodes veut dire qu'on n'a pas trouvé la grille
  const k = Math.round(Math.max(px, py) / Math.min(px, py));
  if (k >= 2 && Math.abs(Math.max(px, py) - k * Math.min(px, py)) <= 2 * k) px = py = Math.min(px, py);
  if (Math.abs(px - py) > 2) return null;
  // place des traits : pixels plus clairs que leurs voisins à 2 px des deux côtés (un trait fin), comptés
  // par colonne / rangée. Les contours des lettres, nombreux et contrastés, ne pèsent pas plus qu'un trait
  // (avec la somme des écarts, une junk box pleine de noms décalait la grille sous les noms)
  const rx = new Float32Array(W);
  const ry = new Float32Array(H);
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const v = g[y * W + x] - RIDGE;
      if (v > g[y * W + x - 2] && v > g[y * W + x + 2]) rx[x]++;
      if (v > g[(y - 2) * W + x] && v > g[(y + 2) * W + x]) ry[y]++;
    }
  // pas au centième de pixel (capture réduite : 45,3 px), sinon les colonnes dérivent au bout de la rangée
  const sx = smooth3(rx);
  const sy = smooth3(ry);
  const p0 = (px + py) / 2;
  let best = { pitch: p0, ox: 0, oy: 0, score: -Infinity };
  for (let p = p0 - 1.5; p <= p0 + 1.5; p += 0.02) {
    const x = comb(sx, p);
    const y = comb(sy, p);
    // à égalité, le pas le plus proche de l'estimation entière
    const score = x.score + y.score - 1e-6 * Math.abs(p - p0);
    if (score > best.score) best = { pitch: p, ox: x.offset, oy: y.offset, score };
  }
  // trait à la toute fin d'un tour du peigne : c'est le bord gauche / haut de la capture (case 0 à partir de 0)
  const first = (o: number) => (o > best.pitch - 4 ? o - best.pitch : o);
  return { pitch: best.pitch, ox: first(best.ox), oy: first(best.oy) };
}

/** Haut (px) de chaque rangée de cases dont la bande du nom tient dans l'image. */
export function rowTops(grid: Grid, height: number): number[] {
  const strip = Math.round((STRIP_AT_63 * grid.pitch) / 63);
  const out: number[] = [];
  for (let y = grid.oy; Math.round(y) + strip <= height; y += grid.pitch) out.push(Math.max(0, Math.round(y)));
  return out;
}

/** Agrandissement de la bande : texte toujours à la même taille, quelle que soit la résolution du jeu. */
export const stripScale = (grid: Grid) => (UPSCALE_AT_63 * 63) / grid.pitch;

/** Minimum (ou maximum) glissant sur `k` valeurs, en ligne puis en colonne. */
function slide(src: Float32Array, w: number, h: number, k: number, max: boolean): Float32Array {
  const r = Math.floor(k / 2);
  const pick = max ? Math.max : Math.min;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = src[y * w + x];
      for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) v = pick(v, src[y * w + i]);
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x];
      for (let i = Math.max(0, y - r); i <= Math.min(h - 1, y + r); i++) v = pick(v, tmp[i * w + x]);
      out[y * w + x] = v;
    }
  return out;
}

/**
 * Bande du nom d'une rangée, prête pour l'OCR : agrandie, « top-hat » (lettres claires gardées, même
 * grisées sur fond rayé), seuillée en noir sur blanc, avec une marge blanche de BORDER px.
 */
export function nameStrip(img: Rgba, grid: Grid, top: number, gray = false): Rgba {
  const scale = stripScale(grid);
  const sh = Math.round((STRIP_AT_63 * grid.pitch) / 63);
  const w = Math.round(img.width * scale);
  const h = Math.round(sh * scale);
  const g = new Float32Array(w * h);
  // agrandissement bilinéaire de la bande [top, top + sh) (top : milieu du trait, effacé plus bas)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) / scale - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) / scale - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const fx = sx - x0;
      const at = (xx: number, yy: number) => {
        const i = ((top + yy) * img.width + xx) * 4;
        return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      };
      g[y * w + x] = (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
    }
  }
  const opened = slide(slide(g, w, h, TOPHAT, false), w, h, TOPHAT, true);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = g[i] - opened[i] > TOPHAT_MIN ? 1 : 0;
  // bords de case (cases surlignées surtout) : un trait plus long qu'une demi-case, ou plus long qu'un
  // cinquième de case et fin (rien juste au-dessus ni en dessous : les bouts de bord en haut des cases), ou
  // haut comme la bande, n'est pas une lettre ; laissé, il relie les noms entre eux et fausse leur place.
  // Les lettres d'une capture floue se touchent en longues barres, mais épaisses.
  const ink2 = ink.slice();
  const longRun = (grid.pitch * scale) / 2;
  const shortRun = (grid.pitch * scale) / 5;
  const d = Math.round(2.5 * scale);
  const thin = (y: number, x0: number, x1: number) => {
    let n = 0;
    for (let x = x0; x < x1; x++) if ((y < d || !ink[(y - d) * w + x]) && (y + d >= h || !ink[(y + d) * w + x])) n++;
    return n > 0.7 * (x1 - x0);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0, run = 0; x <= w; x++) {
      if (x < w && ink[y * w + x]) run++;
      else {
        if (run > longRun || (run > shortRun && thin(y, x - run, x))) ink2.fill(0, y * w + x - run, y * w + x);
        run = 0;
      }
    }
  for (let x = 0; x < w; x++)
    for (let y = 0, run = 0; y <= h; y++) {
      if (y < h && ink[y * w + x]) run++;
      else {
        if (run > h * 0.8) for (let k = y - run; k < y; k++) ink2[k * w + x] = 0;
        run = 0;
      }
    }
  const W = w + 2 * BORDER;
  const H = h + 2 * BORDER;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const j = y * w + x;
      // gris : les bords des lettres gardent leur nuance (l'OCR sépare mieux des lettres serrées)
      const v = !ink2[j] && (ink[j] || !gray) ? 255 : gray ? 255 - Math.min(255, ((g[j] - opened[j]) * 255) / (2 * TOPHAT_MIN)) : 0;
      if (v === 255) continue;
      const i = ((y + BORDER) * W + x + BORDER) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  return { width: W, height: H, data };
}

/** Mot lu dans une bande (coordonnées de la bande agrandie, marge comprise). */
export interface StripWord {
  text: string;
  confidence: number;
  x0: number;
  x1: number;
}

/** Largeur d'une lettre des noms, en cases (« Intelligence » : 12 lettres, 1,4 case). */
const CHAR_W = 0.12;

/**
 * Mots resserrés sur leurs pixels noirs. La boîte rendue par l'OCR déborde parfois vers la droite (bout de
 * trait en pointillés d'une case surlignée, miettes d'icône), assez pour placer le nom dans la case voisine.
 * Un nom finit avant le bord droit de sa case : passé un bord, quelques pixels épars ne sont pas des
 * lettres (un nom long, lui, reste dense des deux côtés du bord qu'il traverse).
 */
export function tightWords(strip: Rgba, words: StripWord[], grid: Grid): StripWord[] {
  const scale = stripScale(grid);
  const inkAt = new Float32Array(strip.width);
  for (let y = BORDER; y < strip.height - BORDER; y++) for (let x = 0; x < strip.width; x++) if (strip.data[(y * strip.width + x) * 4] === 0) inkAt[x]++;
  const mean = (a: number, b: number) => {
    let s = 0;
    for (let x = Math.max(0, Math.round(a)); x <= Math.min(strip.width - 1, Math.round(b)); x++) s += inkAt[x];
    return s / Math.max(1, Math.round(b) - Math.round(a) + 1);
  };
  return words.map((w) => {
    let x0 = Math.max(0, Math.round(w.x0));
    let x1 = Math.min(strip.width - 1, Math.round(w.x1));
    const tighten = () => {
      while (x1 > x0 && !inkAt[x1]) x1--;
      while (x0 < x1 && !inkAt[x0]) x0++;
    };
    tighten();
    // boîte bien plus large que son texte, coupée par un grand blanc (« Intelligence » étendu jusqu'à « Badge ») :
    // seul le morceau de la largeur du texte reste ; un trait fin (pointillés du bord) compte pour du blanc
    const width = w.text.trim().length * CHAR_W * grid.pitch * scale;
    if (x1 - x0 > 1.5 * width) {
      const parts: [number, number][] = [];
      for (let x = x0, start = x0, blank = 0; x <= x1 + 1; x++) {
        if (x <= x1 && inkAt[x] > scale / 2) {
          if (blank > (grid.pitch / 4) * scale) parts.push([start, x - blank - 1]), (start = x);
          blank = 0;
        } else if (x > x1) parts.push([start, x1]);
        else blank++;
      }
      [x0, x1] = parts.reduce((a, b) => (Math.abs(b[1] - b[0] - width) < Math.abs(a[1] - a[0] - width) ? b : a));
    }
    for (let k = Math.floor(((x1 - BORDER) / scale - grid.ox) / grid.pitch); k >= 0; k--) {
      const b = BORDER + (grid.ox + k * grid.pitch) * scale;
      if (b <= x0 + 4 * scale || b >= x1) continue;
      if (mean(b + 2 * scale, x1) >= 0.35 * mean(b - 12 * scale, b - 2 * scale)) break;
      x1 = Math.round(b - 2 * scale);
      tighten();
    }
    return x1 > x0 ? { ...w, x0, x1 } : w;
  });
}

/** Objet reconnu : case en haut à droite de l'objet (là où son nom finit), texte lu, objets possibles. */
export interface Found {
  row: number;
  col: number;
  text: string;
  ids: string[];
  how: ShortMatch["how"];
}

/**
 * Noms reconnus dans une bande. Les mots proches (moins d'un huitième de case : une espace) forment un
 * nom (« Flash driv », « BEAR Buddy ») ; s'il ne correspond à rien, ses mots sont repris deux par deux
 * puis un par un (deux noms voisins peuvent sembler collés quand le bord de case est lu comme une lettre).
 * Les miettes (« - », « . », une lettre seule, souvent un bout d'icône) sont écartées avant.
 */
export function matchStrip(words: StripWord[], grid: Grid, row: number, index: Map<string, string[]>): Found[] {
  const scale = stripScale(grid);
  const toX = (x: number) => (x - BORDER) / scale;
  // les mots d'une lettre restent pour être collés à leur voisin (« F » de « F scdr. »), jamais seuls
  const sorted = words.filter((w) => shortKey(w.text).length >= 1).sort((a, b) => a.x0 - b.x0);
  const groups: StripWord[][] = [];
  // un mot qui finit juste avant un bord de case finit un nom (« Intelligence » puis « SMT » de la case voisine)
  const endsAtBorder = (x: number) => {
    const b = grid.ox + Math.round((x - grid.ox) / grid.pitch) * grid.pitch;
    return x > b - 8 && x < b + 1;
  };
  for (const w of sorted) {
    const last = groups[groups.length - 1];
    const end = toX(last?.[last.length - 1].x1 ?? 0);
    if (last && toX(w.x0) - end < grid.pitch / 8 && !endsAtBorder(end)) last.push(w);
    else groups.push([w]);
  }
  // le nom finit à 2-3 px du bord droit de l'objet ; le bord lu comme une lettre peut le prolonger un peu
  const colOf = (part: StripWord[]) => Math.max(0, Math.floor((toX(part[part.length - 1].x1) - grid.ox - grid.pitch / 4) / grid.pitch));
  const found = (part: StripWord[]): Found | null => {
    // « _ » au bord du mot : reste du trait de bord de case ; au milieu : nom de joueur sur une plaque
    // (SAVIOR_X), jamais un nom court d'objet
    const text = part.map((w) => w.text).join(" ").trim().replace(/^_+|_+$/g, "");
    if (text.includes("_")) return null;
    const m = matchShort(text, index);
    if (!m) return null;
    const col = colOf(part);
    // nom de 2-3 lettres : seulement s'il est calé contre le bord droit d'une case, comme les vrais noms
    // (les bouts d'icônes lus comme « MB » tombent n'importe où), avec les mêmes majuscules (« Or » n'est
    // pas « OR »), et bien lu s'il n'a que 2 lettres. Pas pour les noms longs : sur une capture de plusieurs
    // fenêtres (deux junk box côte à côte), les cases de la deuxième ne sont pas alignées sur la grille
    const key = shortKey(text);
    if (key.length <= 3) {
      const gap = grid.ox + (col + 1) * grid.pitch - toX(part[part.length - 1].x1);
      if (gap < -6 || gap > 8) return null;
      if (key.length === 2 && part.every((w) => w.confidence < 50)) return null;
      const raw = text.replace(/[^\p{L}\p{N}]/gu, "");
      if (![raw, raw.slice(0, -1), raw.slice(1)].some((r) => index.has(CASED + r)) && !index.has(SHAPED + shape(raw))) return null;
    }
    return { row, col, text, ids: m.ids, how: m.how };
  };
  const out: Found[] = [];
  for (const g of groups) {
    const whole = found(g);
    if (whole) {
      out.push(whole);
      continue;
    }
    for (let i = 0; i < g.length; ) {
      const pair = i + 1 < g.length ? found(g.slice(i, i + 2)) : null;
      const one = pair ? null : found([g[i]]);
      if (pair ?? one) out.push((pair ?? one)!);
      i += pair ? 2 : 1;
    }
  }
  return out;
}

/** Lettres dans la moitié droite d'une case de la bande (px noirs agrandis) : un nom y finit peut-être. */
const INK_MIN = 60;

/**
 * Cases d'une rangée sans nom reconnu mais avec des lettres dans leur moitié droite (un nom finit contre
 * le bord droit) : à relire seules. Lue d'un bloc, une rangée chargée (icônes, cases surlignées) perd
 * parfois un nom (« NaCl »).
 */
export function unreadCells(strip: Rgba, grid: Grid, found: { col: number }[]): number[] {
  const scale = stripScale(grid);
  const cols = Math.floor(((strip.width - 2 * BORDER) / scale - grid.ox) / grid.pitch);
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    if (found.some((f) => f.col === c)) continue;
    const x0 = Math.round(BORDER + (grid.ox + (c + 0.5) * grid.pitch) * scale);
    const x1 = Math.round(BORDER + (grid.ox + (c + 1) * grid.pitch) * scale);
    let ink = 0;
    for (let y = BORDER; y < strip.height - BORDER; y++) for (let x = x0; x < x1; x++) if (strip.data[(y * strip.width + x) * 4] === 0) ink++;
    if (ink >= INK_MIN) out.push(c);
  }
  return out;
}

/**
 * Relue seule, une case n'a plus de bord pris pour une lettre : seul un nom lu tel quel, ou à une lettre
 * près s'il est long (« Vesitas » : Veritas), est gardé ; pas « NDOOR » pour « Door » (nom amputé de sa
 * première lettre). Un nom de 3 lettres a déjà passé ses contrôles dans matchStrip. `exact` : dernière
 * relecture, nom lu tel quel seulement (« PEACE » lu dans le dessin d'une carte n'est pas Peacekeeper).
 */
export const retryRead = (f: Found, index: Map<string, string[]>, exact = false) =>
  index.has(shortKey(f.text)) || (f.how === "fuzzy" && !exact) || shortKey(f.text).length === 3;

/**
 * Une case de la bande, avec la même marge ; `shift` remet ses mots à leur place dans la bande.
 * `band` : seule la bande de lignes la plus encrée (le nom) reste ; un bout de bord collé au-dessus des
 * lettres fait lire « sso » pour SSD, « Ori » pour Drill.
 */
export function cellStrip(strip: Rgba, grid: Grid, col: number, band = false): { img: Rgba; shift: number } {
  const scale = stripScale(grid);
  const x0 = Math.round(BORDER + (grid.ox + col * grid.pitch) * scale);
  const x1 = Math.min(strip.width - BORDER, Math.round(BORDER + (grid.ox + (col + 1) * grid.pitch) * scale) + 8);
  const width = x1 - x0 + 2 * BORDER;
  const data = new Uint8ClampedArray(width * strip.height * 4).fill(255);
  for (let y = 0; y < strip.height; y++) data.set(strip.data.subarray((y * strip.width + x0) * 4, (y * strip.width + x1) * 4), (y * width + BORDER) * 4);
  if (band) {
    const ink = Array.from({ length: strip.height }, (_, y) => {
      let n = 0;
      for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] < 128) n++;
      return n;
    });
    const min = Math.max(...ink) / 4;
    let [from, to] = [0, 0];
    for (let y = 0, start = -1; y <= strip.height; y++) {
      if (y < strip.height && ink[y] > min) start = start < 0 ? y : start;
      else if (start >= 0) {
        if (y - start > to - from) [from, to] = [start, y];
        start = -1;
      }
    }
    const pad = Math.round(0.75 * scale);
    for (let y = 0; y < strip.height; y++) if (y < from - pad || y >= to + pad) data.fill(255, y * width * 4, (y + 1) * width * 4);
  }
  return { img: { width, height: strip.height, data }, shift: x0 - BORDER };
}

/** Taille d'un objet en cases (largeur, hauteur). */
export interface ItemSize {
  w: number;
  h: number;
}
const MAX_CELLS = 8;

/**
 * Taille de chaque objet reconnu. Un objet de plusieurs cases n'a pas de trait à l'intérieur : depuis sa
 * case en haut à droite, on s'étend vers la gauche puis vers le bas tant que la limite entre deux cases
 * n'a pas de trait clair, sans entrer dans le coin d'un autre objet reconnu. Le seuil suit l'image
 * (35 % du contraste typique d'un trait) : une capture floue a des traits plus pâles. `found` est trié par
 * rangée puis colonne ; null : nom dans une case déjà couverte, à oublier.
 */
export function itemSizes(img: Rgba, grid: Grid, found: { row: number; col: number; how?: ShortMatch["how"] }[], tops: number[]): (ItemSize | null)[] {
  const g = grayOf(img);
  const W = img.width;
  const cols = Math.floor((W - grid.ox) / grid.pitch);
  const rows = tops.length;
  const at = (x: number, y: number) => g[Math.min(img.height - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  // trait vertical à gauche de la case (r, c) : plus clair que ses deux côtés, sur le milieu de la case
  const vline = (r: number, c: number) => {
    const x = Math.round(grid.ox + c * grid.pitch);
    let s = 0;
    let n = 0;
    for (let y = Math.round(tops[r] + grid.pitch * 0.2); y < tops[r] + grid.pitch * 0.8; y++, n++) s += Math.max(at(x - 1, y), at(x, y), at(x + 1, y)) - (at(x - 4, y) + at(x + 4, y)) / 2;
    return n ? s / n : 0;
  };
  // trait horizontal au-dessus de la case (r, c)
  const hline = (r: number, c: number) => {
    const y = tops[r];
    let s = 0;
    let n = 0;
    for (let x = Math.round(grid.ox + (c + 0.2) * grid.pitch); x < grid.ox + (c + 0.8) * grid.pitch; x++, n++) s += Math.max(at(x, y - 1), at(x, y), at(x, y + 1)) - (at(x, y - 4) + at(x, y + 4)) / 2;
    return n ? s / n : 0;
  };
  const all: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (c > 0) all.push(vline(r, c));
    if (r > 0) all.push(hline(r, c));
  }
  all.sort((a, b) => a - b);
  const threshold = 0.35 * (all[Math.floor(all.length * 0.75)] ?? 0);

  // coin d'un objet reconnu -> lu à peu près
  const corners = new Map(found.map((f) => [`${f.row},${f.col}`, f.how === "fuzzy"]));
  const taken = new Set<string>();
  return found.map((f) => {
    // case déjà couverte par un objet plus haut ou à droite : nom lu à peu près dans son dessin (« FENTE » dans
    // une perceuse) ; un nom lu tel quel reste, la taille de l'autre est plus douteuse que lui
    if (taken.has(`${f.row},${f.col}`) && f.how === "fuzzy") return null;
    // un objet déjà large de 2 cases (ou haut de 2) qui s'étend sans trait sur toute sa largeur passe un nom lu
    // à peu près ; pas un objet d'une case, dont le trait pâle (capture floue) ne prouve rien
    const free = (r: number, c: number, wide: boolean) => !taken.has(`${r},${c}`) && (!corners.has(`${r},${c}`) || (wide && corners.get(`${r},${c}`)!));
    const span = (n: number, at: (i: number) => number) => Array.from({ length: n }, (_, i) => at(i));
    // une limite entre deux cases d'un même objet n'a de trait nulle part, alors qu'un bout clair du dessin
    // peut en imiter un : la limite est jugée sur toute la largeur (ou hauteur) déjà trouvée, au plus faible,
    // en deux passes (perceuse 2x3, horloge 2x2)
    let [w, h] = [1, 1];
    for (let pass = 0; pass < 2; pass++) {
      w = 1;
      while (w < MAX_CELLS && f.col - w >= 0 && span(h, (i) => i).every((i) => free(f.row + i, f.col - w, h > 1)) && Math.min(...span(h, (i) => vline(f.row + i, f.col - w + 1))) < threshold) w++;
      h = 1;
      while (h < MAX_CELLS && f.row + h < rows && span(w, (j) => j).every((j) => free(f.row + h, f.col - j, w > 1)) && Math.min(...span(w, (j) => hline(f.row + h, f.col - j))) < threshold) h++;
    }
    for (let r = f.row; r < f.row + h; r++) for (let c = f.col - w + 1; c <= f.col; c++) taken.add(`${r},${c}`);
    return { w, h };
  });
}

/** Nom court comparable : sans accents, sans ponctuation ni espaces (« #FireKlean » -> « fireklean »). */
export const shortKey = (s: string) => normalizeOcr(s).replace(/ /g, "");

/** Préfixe des noms de 3 caractères au plus gardés avec leurs majuscules (jamais confondu avec une clé : [a-z0-9]). */
const CASED = "=";
/**
 * Idem, D / Q / 0 lus comme O, 8 comme B, J comme I et g comme e (« HDO » : HDD, « MBO » : M80, « FMI » : FMJ,
 * « Ege » : Egg) ; 3 caractères seulement, casse gardée.
 */
const SHAPED = "~";
const shape = (raw: string) => raw.replace(/[DQ0]/g, "O").replace(/8/g, "B").replace(/J/g, "I").replace(/g/g, "e");

/** Nom court -> objets qui le portent (plusieurs objets peuvent avoir le même : Diary, Motor…). */
export function buildShortIndex(items: { id: string; shorts?: string[] }[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (k: string, id: string) => {
    const ids = index.get(k) ?? [];
    if (!ids.includes(id)) index.set(k, [...ids, id]);
  };
  for (const item of items)
    for (const s of item.shorts ?? []) {
      const k = shortKey(s);
      if (!k) continue;
      add(k, item.id);
      const raw = s.replace(/[^\p{L}\p{N}]/gu, "");
      if (raw.length <= 3) add(CASED + raw, item.id);
      if (raw.length === 3) add(SHAPED + shape(raw), item.id);
    }
  return index;
}

/** Lettres que l'OCR confond sur ces petits noms, ramenées à une seule (« Quctitape » ≈ « Duct tape »). */
const confusable = (k: string) => k.replace(/[dq0]/g, "o").replace(/[i1j]/g, "l").replace(/e/g, "c").replace(/5/g, "s").replace(/8/g, "b").replace(/6/g, "g");

const fuzzyCache = new WeakMap<Map<string, string[]>, [string, string[]][]>();
/** Noms de 5 caractères et plus, lettres confondues ramenées (calculé une fois par index). */
function fuzzyKeys(index: Map<string, string[]>): [string, string[]][] {
  let keys = fuzzyCache.get(index);
  if (!keys) {
    keys = [...index].filter(([k]) => k.length >= 5).map(([k, ids]) => [confusable(k), ids]);
    fuzzyCache.set(index, keys);
  }
  return keys;
}

export interface ShortMatch {
  ids: string[];
  /** exact, nom coupé par le jeu (début du nom), ou à une ou deux lettres près. */
  how: "exact" | "prefix" | "fuzzy";
}

/**
 * Objets dont le nom court correspond au texte lu. Prudent : un faux « vendable » coûte cher.
 *  - exact (2 caractères au moins ; matchStrip vérifie en plus la place des noms de 2-3 lettres), aussi
 *    sans la première ou la dernière lettre (le bord de la case lu comme un « l » : « VPXI », « Awll ») ;
 *  - 3 majuscules à D / O / 0 près (« HDO » : HDD), casse gardée ;
 *  - début d'un nom, 6 caractères au moins (le jeu coupe les noms trop longs : « Flash driv ») ;
 *  - à peu près (5 caractères au moins, 80 % de ressemblance une fois les lettres que l'OCR confond
 *    ramenées à une seule, meilleur sans ex æquo) : jamais pour les noms courts, VPX / GPX ou MB / MCB
 *    ne diffèrent que d'une lettre.
 */
export function matchShort(text: string, index: Map<string, string[]>): ShortMatch | null {
  const k = shortKey(text);
  if (k.length < 2) return null;
  const exact = index.get(k) ?? (k.length >= 4 ? (index.get(k.slice(0, -1)) ?? index.get(k.slice(1))) : undefined);
  if (exact) return { ids: exact, how: "exact" };
  const raw = text.replace(/[^\p{L}\p{N}]/gu, "");
  const shaped = raw.length === 3 ? index.get(SHAPED + shape(raw)) : undefined;
  if (shaped) return { ids: shaped, how: "fuzzy" };
  if (k.length >= 6) {
    const keys = [...index.keys()].filter((key) => key.startsWith(k));
    if (keys.length > 0 && keys.length <= 3) return { ids: [...new Set(keys.flatMap((key) => index.get(key)!))], how: "prefix" };
  }
  if (k.length < 5) return null;
  let best = 0;
  let second = 0;
  let ids: string[] = [];
  // bord de case lu comme une lettre au bout du mot : essayé aussi sans elle
  const c = confusable(k);
  const variants = [c, c.slice(0, -1), c.slice(1)];
  for (const [key, keyIds] of fuzzyKeys(index)) {
    // nom coupé et mal lu à la fois : comparer aussi au début du nom
    const s = Math.max(
      // sans sa lettre de bord, le mot doit coller davantage (« SAVIOR_X » d'une plaque n'est pas « Sailor »)
      ...variants.map((v, i) => similarity(v, key) - (i ? 0.05 : 0)),
      key.length > c.length ? similarity(c, key.slice(0, c.length)) - 0.05 : 0,
    ) +
      // le début du nom touche l'image de l'objet, sa fin est la mieux lue (« 9128TC » : 0.2BTC)
      (c.endsWith(key.slice(-4)) ? 0.1 : 0);
    if (s > best) [second, best, ids] = [best, s, keyIds];
    else if (s > second) second = s;
  }
  return best >= 0.8 && best > second ? { ids, how: "fuzzy" } : null;
}
