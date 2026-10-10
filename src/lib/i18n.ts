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

/** Texte dans la langue choisie : français ou anglais. */
export const tr = (fr: string, en: string) => (current === "en" ? en : fr);
