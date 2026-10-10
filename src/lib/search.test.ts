import { describe, expect, it } from "vitest";
import { editDistance, questScore, scoreName } from "./search";

// noms réels de l'API tarkov.dev
const chumming = { name: "Appâtage", nameEn: "Chumming" };
const punisher = { name: "Le Punisher - Partie 6", nameEn: "The Punisher - Part 6" };
const illWisher = { name: "Ill-Wisher", nameEn: "Ill-Wisher" };

describe("distance d'édition", () => {
  it("compte substitutions, insertions, suppressions et inversions", () => {
    expect(editDistance("bait", "bait", 2)).toBe(0);
    expect(editDistance("bait", "bat", 2)).toBe(1);
    expect(editDistance("punsiher", "punisher", 2)).toBe(1); // inversion de deux lettres
    expect(editDistance("abcdef", "uvwxyz", 2)).toBe(3); // s'arrête au-delà du maximum
  });
});

describe("recherche de quêtes", () => {
  it("ignore la casse, les accents et la ponctuation", () => {
    expect(questScore("APPATAGE", chumming).score).toBeGreaterThan(0);
    expect(questScore("illwisher", illWisher).score).toBeGreaterThan(0);
    expect(questScore("ill wisher", illWisher).score).toBeGreaterThan(0);
  });

  it("trouve la quête par son nom anglais", () => {
    expect(questScore("chumming", chumming)).toEqual({ score: 100, viaEnglish: true });
    expect(questScore("appâtage", chumming).viaEnglish).toBe(false);
  });

  it("tolère les petites fautes", () => {
    expect(questScore("apatage", chumming).score).toBeGreaterThan(0); // lettre oubliée
    expect(questScore("chuming", chumming).viaEnglish).toBe(true);
    expect(questScore("punsiher", punisher).score).toBeGreaterThan(0); // lettres inversées
    expect(questScore("punisehr 6", punisher).score).toBeGreaterThan(0);
  });

  it("ne tolère pas de faute sur les mots de 4 lettres ou moins", () => {
    expect(scoreName("bait", "Battery Change")).toBe(0);
    expect(scoreName("bait", "Tout chasseur sait ça")).toBe(0);
  });

  it("ne renvoie pas de faux positifs", () => {
    expect(questScore("douanes", chumming).score).toBe(0);
    expect(questScore("punisher 7x", punisher).score).toBe(0);
  });

  it("classe les correspondances exactes avant les approximatives", () => {
    const exact = scoreName("punisher", "Punisher");
    const prefix = scoreName("punisher", "Punisher - Part 6");
    const inside = scoreName("punisher", "The Punisher - Part 6");
    const typo = scoreName("punsiher", "The Punisher - Part 6");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
  });

  it("une recherche vide garde toutes les quêtes", () => {
    expect(questScore("   ", chumming).score).toBeGreaterThan(0);
  });
});
