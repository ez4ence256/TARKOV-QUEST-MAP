// Séparation des colonnes d'une ligne lue par l'OCR (l'OCR elle-même n'est pas lancée).
import { describe, expect, it } from "vitest";
import { splitByGaps } from "./ocr";

const word = (text: string, x0: number, x1: number) => ({ text, confidence: 90, bbox: { x0, x1, y0: 0, y1: 20 } });

describe("colonnes d'une ligne", () => {
  it("coupe aux grands espaces (nom | marchand | lieu), garde les mots d'un même nom ensemble", () => {
    const line = [
      word("Signal", 0, 60),
      word("-", 68, 74),
      word("Partie", 82, 140),
      word("3", 148, 158),
      word("Mécano", 400, 470), // grand espace : autre colonne
      word("Littoral", 560, 640),
    ];
    expect(splitByGaps(line, 1.6).map((g) => g.map((w) => w.text).join(" "))).toEqual(["Signal - Partie 3", "Mécano", "Littoral"]);
  });

  it("ligne vide", () => {
    expect(splitByGaps([], 1.6)).toEqual([]);
  });
});
