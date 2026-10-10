// Recherche de quêtes : nom français ET nom anglais, sans tenir compte de la
// casse, des accents ni de la ponctuation, avec tolérance aux petites fautes.

import type { Task } from "../types";
import { normalizeSearch } from "./points";

/** Mots d'un texte, normalisés ("Ill-Wisher" -> ["ill", "wisher"]). */
export const searchWords = (s: string) =>
  normalizeSearch(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * Nombre de fautes tolérées selon la longueur du mot tapé. Pas de faute sur les
 * mots de 4 lettres ou moins : "bait" remonterait sinon "Battery" et "sait".
 */
const allowedTypos = (length: number) => (length >= 9 ? 2 : length >= 5 ? 1 : 0);

/**
 * Distance d'édition (insertion, suppression, substitution, inversion de deux
 * lettres voisines). Renvoie max + 1 dès que la distance dépasse max.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return Math.min(prev[b.length], max + 1);
}

/**
 * Score d'un nom pour une requête : 0 = ne correspond pas, plus c'est haut mieux c'est.
 * Ordre : nom identique > début du nom > texte contenu > mots retrouvés (avec fautes).
 */
export function scoreName(query: string, name: string): number {
  const qWords = searchWords(query);
  if (qWords.length === 0) return 1;
  const nWords = searchWords(name);
  const q = qWords.join(" ");
  const n = nWords.join(" ");
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 80;
  // "illwisher" pour "Ill-Wisher"
  if (n.replace(/ /g, "").includes(q.replace(/ /g, ""))) return 75;

  let typos = 0;
  for (const w of qWords) {
    if (nWords.some((nw) => nw.startsWith(w))) continue;
    const max = allowedTypos(w.length);
    if (max === 0) return 0;
    // mot entier, ou début de mot de même longueur (nom encore en cours de frappe)
    let best = max + 1;
    for (const nw of nWords) {
      best = Math.min(best, editDistance(w, nw, max), editDistance(w, nw.slice(0, w.length), max));
    }
    if (best > max) return 0;
    typos += best;
  }
  return Math.max(1, 60 - typos * 10);
}

/** Meilleur score entre le nom affiché et le nom anglais de la quête. */
export function questScore(query: string, task: Pick<Task, "name" | "nameEn">): { score: number; viaEnglish: boolean } {
  const local = scoreName(query, task.name);
  const english = task.nameEn && task.nameEn !== task.name ? scoreName(query, task.nameEn) : 0;
  return english > local ? { score: english, viaEnglish: true } : { score: local, viaEnglish: false };
}
