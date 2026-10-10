// Cache local (localStorage) des données de l'API.
// Durée de vie : quelques heures. Si l'API ne répond pas, on garde la dernière
// version connue, même périmée, plutôt que de laisser l'app vide.

import type { GameMode, TarkovData } from "../types";
import { fetchTarkovData } from "./tarkovJson";

export const DATA_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures
const CACHE_VERSION = 1;
const cacheKey = (mode: GameMode, lang: string) => `tqp:data:v${CACHE_VERSION}:${mode}:${lang}`;

export function readCachedData(mode: GameMode, lang: string): TarkovData | null {
  try {
    const raw = localStorage.getItem(cacheKey(mode, lang));
    return raw ? (JSON.parse(raw) as TarkovData) : null;
  } catch {
    return null;
  }
}

function writeCachedData(data: TarkovData) {
  try {
    localStorage.setItem(cacheKey(data.gameMode, data.language), JSON.stringify(data));
  } catch (error) {
    // Quota dépassé ou stockage désactivé : l'app fonctionne quand même, sans cache.
    console.warn("Impossible de mettre les données en cache", error);
  }
}

export interface LoadResult {
  data: TarkovData;
  /** "cache" = données encore fraîches ; "network" = téléchargées ; "stale" = API en échec, cache périmé utilisé. */
  source: "cache" | "network" | "stale";
  error?: string;
}

/**
 * Renvoie les données d'un mode de jeu :
 *  1. depuis le cache s'il a moins de DATA_TTL_MS (sauf si force = true) ;
 *  2. sinon depuis l'API ;
 *  3. si l'API échoue, depuis le cache périmé (avec un message d'erreur).
 */
export async function loadTarkovData(
  mode: GameMode,
  lang: string,
  { force = false, signal }: { force?: boolean; signal?: AbortSignal } = {},
): Promise<LoadResult> {
  const cached = readCachedData(mode, lang);
  if (!force && cached && Date.now() - cached.fetchedAt < DATA_TTL_MS) {
    return { data: cached, source: "cache" };
  }
  try {
    const data = await fetchTarkovData(mode, lang, signal);
    writeCachedData(data);
    return { data, source: "network" };
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    if (cached) return { data: cached, source: "stale", error: (error as Error).message };
    throw error;
  }
}
