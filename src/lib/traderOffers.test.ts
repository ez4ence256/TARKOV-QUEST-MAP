// Marchands : offres par niveau de loyauté et par type (format de src/data/trader-offers-<mode>.json).
import { describe, expect, it } from "vitest";
import shipped from "../data/trader-offers-regular.json";
import { formatPrice, traderOffers, tradersWithOffers, type TraderOffersFile } from "./traderOffers";

const file: TraderOffersFile = {
  levels: { prapor: [[1, 0, 0, 0], [2, 15, 0.2, 1000000]] },
  currency: { prapor: "RUB" },
  cash: [
    ["prapor", "ak", 2, 30000, "RUB", null, 0],
    ["prapor", "ammo", 1, 50, "RUB", null, 0],
    ["skier", "knife", 1, 99, "USD", "quest1", 3],
  ],
  barters: [["prapor", "grenade", 1, 2, [["bolts", 3]], "quest2", 1]],
};

describe("offres d'un marchand", () => {
  it("niveau 1 : seulement les offres du niveau 1 (achats et barters)", () => {
    expect(traderOffers(file, "prapor", 1).map((o) => o.item)).toEqual(["ammo", "grenade"]);
  });
  it("niveau 2 : celles du niveau 1 en plus, triées par niveau", () => {
    expect(traderOffers(file, "prapor", 2).map((o) => [o.item, o.level])).toEqual([
      ["ammo", 1],
      ["grenade", 1],
      ["ak", 2],
    ]);
  });
  it("niveau exact : seulement les nouveautés de ce niveau", () => {
    expect(traderOffers(file, "prapor", 2, "all", true).map((o) => o.item)).toEqual(["ak"]);
    expect(traderOffers(file, "prapor", 1, "all", true).map((o) => o.item)).toEqual(["ammo", "grenade"]);
  });
  it("filtre achat / barter ; détails de l'offre", () => {
    expect(traderOffers(file, "prapor", 4, "cash").map((o) => o.item)).toEqual(["ammo", "ak"]);
    const [barter] = traderOffers(file, "prapor", 4, "barter");
    expect(barter).toEqual({ item: "grenade", level: 1, task: "quest2", limit: 1, barter: { count: 2, required: [{ item: "bolts", count: 3 }] } });
  });
  it("marchands qui vendent quelque chose ; prix lisible", () => {
    expect([...tradersWithOffers(file)].sort()).toEqual(["prapor", "skier"]);
    expect(formatPrice(12345, "RUB", "fr").replace(/\s/g, " ")).toBe("12 345 ₽");
    expect(formatPrice(99, "USD", "en")).toBe("99 $");
  });
  it("fichier livré : Prapor vend au niveau 1 et a 4 niveaux", () => {
    const f = shipped as unknown as TraderOffersFile;
    expect(f.levels["54cb50c76803fa8b248b4571"]).toHaveLength(4);
    expect(traderOffers(f, "54cb50c76803fa8b248b4571", 1).length).toBeGreaterThan(10);
  });
});
