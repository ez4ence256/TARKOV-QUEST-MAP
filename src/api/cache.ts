// Cache local (localStorage) des données de l'API.
// Durée de vie : quelques heures. Si l'API ne répond pas, on garde la dernière
// version connue, même périmée, plutôt que de laisser l'app vide.

import type { GameMode, TarkovData } from "../types";
import { fetchTarkovData } from "./tarkovJson";

export const DATA_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures
const CACHE_VERSION = 13;
const cacheKey = (mode: GameMode, lang: string) => `tqp:data:v${CACHE_VERSION}:${mode}:${lang}`;

export function readCachedData(mode: GameMode, lang: string): TarkovData | null {
  try {
    const raw = localStorage.getItem(cacheKey(mode, lang));
    return raw ? (JSON.parse(raw) as TarkovData) : null;
  } catch {
    return null;
  }
}

/** Les copies d'un ancien format prennent de la place pour rien. */
function purgeOldCaches() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("tqp:data:") && !key.startsWith(`tqp:data:v${CACHE_VERSION}:`)) localStorage.removeItem(key);
    }
  } catch {
    // stockage indisponible : rien à nettoyer
  }
}

export function writeCachedData(data: TarkovData) {
  const key = cacheKey(data.gameMode, data.language);
  const json = JSON.stringify(data);
  try {
    purgeOldCaches();
    try {
      localStorage.setItem(key, json);
    } catch {
      // Chaque entrée pèse ~1,8 M caractères : si le quota est atteint, on libère les autres modes/langues puis on réessaie.
      for (const k of Object.keys(localStorage)) if (k.startsWith("tqp:data:") && k !== key) localStorage.removeItem(k);
      localStorage.setItem(key, json);
    }
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
 *  2. cache périmé et onRefresh fourni : le cache tout de suite, puis onRefresh avec les données
 *     de l'API (ou le cache en "stale" avec l'erreur si elle échoue) ;
 *  3. sinon depuis l'API ;
 *  4. si l'API échoue, depuis le cache périmé (avec un message d'erreur).
 */
export async function loadTarkovData(
  mode: GameMode,
  lang: string,
  { force = false, signal, onRefresh }: { force?: boolean; signal?: AbortSignal; onRefresh?: (res: LoadResult) => void } = {},
): Promise<LoadResult> {
  purgeOldCaches();
  const cached = readCachedData(mode, lang);
  if (!force && cached && Date.now() - cached.fetchedAt < DATA_TTL_MS) {
    return { data: cached, source: "cache" };
  }
  if (!force && cached && onRefresh) {
    fetchTarkovData(mode, lang, signal)
      .then((data) => {
        writeCachedData(data);
        if (!signal?.aborted) onRefresh({ data, source: "network" });
      })
      .catch((error: Error) => {
        if (!signal?.aborted && error.name !== "AbortError") onRefresh({ data: cached, source: "stale", error: error.message });
      });
    return { data: cached, source: "cache" };
  }
  try {
    const data = await fetchTarkovData(mode, lang, signal);
    writeCachedData(data);
    return { data: data, source: "network" };
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    if (cached) return { data: cached, source: "stale", error: (error as Error).message };
    throw error;
  }
}
