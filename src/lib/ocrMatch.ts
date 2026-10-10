// Rapprochement entre les lignes lues par l'OCR (capture du menu Personnage > Tâches)
// et les noms de quêtes du mode actuel, en français ET en anglais.
// Plus strict que la recherche (lib/search.ts) :
//  - le nom doit couvrir presque toute la ligne (ou deux lignes consécutives si le nom
//    passe à la ligne) ;
//  - les numéros doivent être identiques (« Partie 2 » n'est jamais « Partie 3 ») ;
//  - le marqueur « [PVP ZONE] » (« [JcJ] » en français) doit être présent des deux côtés
//    ou absent des deux côtés.
// Tout le reste de la capture (objectifs, marchands, boutons…) finit dans « non reconnu ».

import type { Task } from "../types";
import { editDistance } from "./search";

/** Au-dessus : reconnue (cochée). Entre les deux : incertaine (décochée, à vérifier). */
export const RECOGNIZED_MIN = 0.88;
export const UNCERTAIN_MIN = 0.72;

const PVP_TAG = /\b(pvp\s*zone|jcj)\b/g;

/** Texte comparable : sans accents, minuscules, ponctuation remplacée par des espaces. */
export function normalizeOcr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Nombres isolés du texte normalisé, dans l'ordre (« partie 2 » -> ["2"]). Un chiffre collé
 * à des lettres (« signa1 », « pr1ves ») est une erreur d'OCR (l -> 1), pas un numéro.
 */
export const numbersOf = (s: string) => s.match(/\b\d+\b/g) ?? [];

function splitTag(normalized: string) {
  const hasTag = PVP_TAG.test(normalized);
  PVP_TAG.lastIndex = 0;
  const base = normalized.replace(PVP_TAG, " ").replace(/\s+/g, " ").trim();
  return { hasTag, base };
}

/** Similarité entre 0 et 1 : 1 - distance d'édition / longueur de la plus longue chaîne. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b, longest) / longest;
}

interface Candidate {
  taskId: string;
  base: string;
  pvp: boolean;
  numbers: string;
}

/** Noms comparables (français et anglais) des quêtes du mode actuel. */
export function buildCandidates(tasks: Pick<Task, "id" | "name" | "nameEn">[]): Candidate[] {
  const out: Candidate[] = [];
  for (const t of tasks) {
    const pvp = /\[pvp zone\]/i.test(t.nameEn);
    for (const name of new Set([t.name, t.nameEn])) {
      const { base } = splitTag(normalizeOcr(name));
      if (base) out.push({ taskId: t.id, base, pvp, numbers: numbersOf(base).join(" ") });
    }
  }
  return out;
}

export interface OcrMatch {
  taskId: string;
  score: number;
  /** Texte lu par l'OCR (une ou deux lignes). */
  text: string;
  lineIndexes: number[];
}

export interface OcrMatchResult {
  recognized: OcrMatch[];
  uncertain: OcrMatch[];
  /** Lignes non utilisées (objectifs, marchands, boutons, bruit…). */
  unmatched: string[];
}

function bestFor(text: string, candidates: Candidate[]): { taskId: string; score: number } | null {
  const { hasTag, base } = splitTag(normalizeOcr(text));
  if (base.length < 3) return null;
  const numbers = numbersOf(base).join(" ");
  let best: { taskId: string; score: number } | null = null;
  for (const c of candidates) {
    if (c.pvp !== hasTag) continue;
    if (c.numbers !== numbers) continue; // numéros identiques exigés
    if (Math.abs(c.base.length - base.length) > Math.max(c.base.length, base.length) * (1 - UNCERTAIN_MIN)) continue;
    const score = similarity(base, c.base);
    if (!best || score > best.score) best = { taskId: c.taskId, score };
  }
  return best;
}

/**
 * Associe les lignes de l'OCR aux quêtes. Chaque ligne sert au plus une fois et chaque
 * quête n'est proposée qu'une fois (meilleur score). Un nom sur deux lignes est essayé
 * en joignant deux lignes consécutives.
 */
export function matchOcrLines(lines: string[], tasks: Pick<Task, "id" | "name" | "nameEn">[]): OcrMatchResult {
  const candidates = buildCandidates(tasks);
  const clean = lines.map((l) => l.replace(/\s+/g, " ").trim());
  const proposals: OcrMatch[] = [];
  clean.forEach((line, i) => {
    const one = bestFor(line, candidates);
    if (one && one.score >= UNCERTAIN_MIN) proposals.push({ ...one, text: line, lineIndexes: [i] });
    if (i + 1 < clean.length && clean[i + 1]) {
      const text = `${line} ${clean[i + 1]}`;
      const two = bestFor(text, candidates);
      if (two && two.score >= UNCERTAIN_MIN) proposals.push({ ...two, text, lineIndexes: [i, i + 1] });
    }
  });
  // meilleurs d'abord ; à score égal, la version sur une seule ligne
  proposals.sort((a, b) => b.score - a.score || a.lineIndexes.length - b.lineIndexes.length);
  const usedLines = new Set<number>();
  const usedTasks = new Set<string>();
  const kept: OcrMatch[] = [];
  for (const p of proposals) {
    if (usedTasks.has(p.taskId) || p.lineIndexes.some((i) => usedLines.has(i))) continue;
    kept.push(p);
    usedTasks.add(p.taskId);
    p.lineIndexes.forEach((i) => usedLines.add(i));
  }
  kept.sort((a, b) => a.lineIndexes[0] - b.lineIndexes[0]);
  return {
    recognized: kept.filter((m) => m.score >= RECOGNIZED_MIN),
    uncertain: kept.filter((m) => m.score < RECOGNIZED_MIN),
    unmatched: clean.filter((l, i) => !usedLines.has(i) && l.length > 0),
  };
}

/**
 * Map où se trouve la majorité des points des quêtes données (au moins 60 %),
 * sinon null : on ne change pas de map.
 */
export function dominantMap(tasks: Pick<Task, "objectives">[], share = 0.6): string | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const t of tasks) {
    for (const o of t.objectives) {
      for (const l of o.locations) {
        counts.set(l.mapId, (counts.get(l.mapId) ?? 0) + 1);
        total++;
      }
    }
  }
  if (total === 0) return null;
  const [mapId, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return n / total >= share ? mapId : null;
}
