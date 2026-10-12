// Étage écrit dans le texte d'un objectif ("3rd floor of the dorm", "au 2e étage"…).
// Renvoie un libellé dans la langue choisie, ou null si le texte ne dit rien.
import { tr } from "./i18n";

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  premier: 1, première: 1, premiere: 1, deuxième: 2, deuxieme: 2, troisième: 3, troisieme: 3, quatrième: 4, quatrieme: 4,
};

const floorName = (n: number) =>
  n <= 0 ? tr("Rez-de-chaussée", "Ground floor") : tr(n === 1 ? "1er étage" : `${n}e étage`, `${["", "1st", "2nd", "3rd"][n] ?? `${n}th`} floor`);

export function floorFromText(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(ground floor|rez[- ]de[- ]chauss[ée]e)/.test(t)) return floorName(0);
  // "3rd floor", "third floor", "3e étage", "3ème étage", "troisième étage"
  const m =
    t.match(/\b(\d+)\s*(?:st|nd|rd|th|er|ère|e|ème|eme)?\s*(?:floor|[ée]tage)\b/) ??
    t.match(/\b(first|second|third|fourth|fifth|premi[èe]re?|deuxi[èe]me|troisi[èe]me|quatri[èe]me)\s+(?:floor|[ée]tage)\b/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ORDINALS[m[1]];
    if (n) return floorName(n);
  }
  if (/\b(basement|sous-sol)/.test(t)) return tr("Sous-sol", "Basement");
  if (/\b(roof ?top|roof|toit)\b/.test(t)) return tr("Toit", "Roof");
  return null;
}
