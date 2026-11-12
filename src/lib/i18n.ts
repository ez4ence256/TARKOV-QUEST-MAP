// Langue de l'interface (et des données) : choix enregistré, français par défaut.
export type Lang = "fr" | "en";
const LANG_KEY = "tqp:lang";
const readLang = (): Lang => {
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
};
const saveLang = (lang: Lang) => {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* stockage indisponible : la langue ne sera pas retenue */
  }
};

let current: Lang = readLang();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = () => current;

export function setLang(lang: Lang) {
  current = lang;
  saveLang(lang);
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

const NBSP = " ";
const FR_SPACED = / [:;?!»]|« /;
/**
 * Typographie française : l'espace devant « : ; ? ! » et à l'intérieur des guillemets devient insécable,
 * pour qu'un signe de ponctuation ne se retrouve jamais seul au début d'une ligne (panneau étroit, téléphone).
 */
export const frTypo = (text: string) => (FR_SPACED.test(text) ? text.replace(/ ([:;?!»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`) : text);

/** Texte dans la langue choisie : français (avec ses espaces insécables) ou anglais. */
export const tr = (fr: string, en: string) => (current === "en" ? en : frTypo(fr));

/**
 * Marque du pluriel d'un nombre, pour éviter les « quête(s) » : en français à partir de 2
 * (« 1 quête », « 2 quêtes »), en anglais sauf pour 1 (« 0 quests », « 1 quest »).
 */
export const plural = (n: number, mark = "s") => ((current === "en" ? n !== 1 : n > 1) ? mark : "");
