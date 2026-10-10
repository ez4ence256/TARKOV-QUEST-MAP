import { describe, expect, it } from "vitest";
import { QUEST_SECTIONS } from "./questSections";

describe("sections de l'onglet Quête sélectionnée", () => {
  it("dans l'ordre voulu, le Résumé tout en bas", () => {
    expect(QUEST_SECTIONS.map((s) => s.title)).toEqual([
      "Objectifs",
      "À emporter",
      "Guide",
      "Récompenses",
      "Prérequis",
      "Équipement initial",
      "Résumé",
    ]);
  });

  it("seules Objectifs, À emporter et Guide sont ouvertes par défaut", () => {
    expect(QUEST_SECTIONS.filter((s) => s.open).map((s) => s.id)).toEqual(["objectives", "pack", "guide"]);
  });
});
