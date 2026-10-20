// Capture par téléphone : aides pures (code, adresse du PC, taille des photos, fusion des lectures OCR).
// Le relais serveur est dans server/phone.mjs.
import { RECOGNIZED_MIN, type OcrMatch, type OcrMatchResult } from "./ocrMatch";

export const PHONE_CODE = /^[A-Za-z0-9]{24}$/;
export const PHONE_ORIGIN_KEY = "tqp:phoneOrigin";
/** Côté le plus long des photos envoyées (assez net pour l'OCR, bien sous les 3 Mo du serveur). */
export const PHOTO_MAX_SIDE = 1600;

/** Code de session lu dans `?phone=CODE`, ou null (absent ou mal formé). */
export function phoneCodeFromSearch(search: string): string | null {
  const code = new URLSearchParams(search).get("phone");
  return code && PHONE_CODE.test(code) ? code : null;
}

/** Taille d'une photo réduite pour que son plus grand côté ne dépasse pas `max` (jamais agrandie). */
export function downscaleSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Un téléphone ne peut pas joindre localhost : il faut l'adresse du PC sur le réseau. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return true;
  }
}

/** Adresse saisie → origine http(s) propre (sans chemin), ou null. « 192.168.1.20:5174 » est complété en http://. */
export function normalizeOrigin(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
    return url.origin;
  } catch {
    return null;
  }
}

export const phoneUrl = (origin: string, code: string) => `${origin}/?phone=${code}`;

/**
 * Fusionne les lectures de plusieurs photos : une quête vue sur plusieurs photos n'apparaît qu'une fois
 * (meilleur score), classée reconnue ou incertaine selon ce meilleur score. Les lignes non reconnues s'ajoutent.
 */
export function mergeOcrResults(results: OcrMatchResult[]): OcrMatchResult {
  if (results.length === 1) return results[0];
  const best = new Map<string, OcrMatch>();
  for (const m of results.flatMap((r) => [...r.recognized, ...r.uncertain])) {
    const old = best.get(m.taskId);
    if (!old || m.score > old.score) best.set(m.taskId, m);
  }
  const all = [...best.values()];
  return {
    recognized: all.filter((m) => m.score >= RECOGNIZED_MIN),
    uncertain: all.filter((m) => m.score < RECOGNIZED_MIN),
    unmatched: results.flatMap((r) => r.unmatched),
  };
}
