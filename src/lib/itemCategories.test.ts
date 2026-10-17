// Item finder : arbre des catégories du flea, sur un extrait du format de src/data/item-categories.json.
import { describe, expect, it } from "vitest";
import shipped from "../data/item-categories.json";
import { buildCategoryTree, OTHER, type CategoryFile } from "./itemCategories";

const file: CategoryFile = {
  cats: [
    ["barter", null],
    ["tools", "barter"],
    ["electronics", "barter"],
    ["weapons", null],
    ["rifles", "weapons"],
    ["empty", null],
  ],
  items: { tools: ["t1", "t2"], electronics: ["e1"], rifles: ["r1", "absent"] },
};
const names = { barter: "Objets d'échange", tools: "Outils", electronics: "Électronique", weapons: "Armes", rifles: "Fusils" };

describe("arbre des catégories", () => {
  const tree = buildCategoryTree(file, names, ["t1", "t2", "e1", "r1", "q1"], "Autres");
  it("catégories principales dans l'ordre du fichier, vides retirées, « Autres » à la fin", () => {
    expect(tree.map((n) => n.name)).toEqual(["Objets d'échange", "Armes", "Autres"]);
  });
  it("sous-catégories par nom ; une catégorie compte les objets de toute sa branche", () => {
    expect(tree[0].children.map((n) => n.name)).toEqual(["Électronique", "Outils"]);
    expect([...tree[0].items].sort()).toEqual(["e1", "t1", "t2"]);
    expect([...tree[1].items]).toEqual(["r1"]); // « absent » n'est pas dans le finder
  });
  it("objets sans catégorie dans « Autres »", () => {
    expect(tree[2]).toMatchObject({ id: OTHER, children: [] });
    expect([...tree[2].items]).toEqual(["q1"]);
  });
  it("fichier livré : 12 catégories du flea en tête, dans l'ordre du jeu", () => {
    const roots = (shipped as unknown as CategoryFile).cats.filter(([, p]) => p === null).map(([id]) => id);
    // Objets d'échange, Équipement… Argent (ids du handbook du jeu)
    expect(roots.slice(0, 2)).toEqual(["5b47574386f77428ca22b33e", "5b47574386f77428ca22b33f"]);
    expect(roots[11]).toBe("5b5f78b786f77447ed5636af");
  });
});
