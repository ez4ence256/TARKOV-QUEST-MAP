import { describe, expect, it } from "vitest";
import { batchTitles, isItemPage } from "../api/wiki";
import { cellDisplay, iconSrc, itemColumn, itemIdOf, nameIndex, normItemName, rowOffset } from "./itemIcons";
import { linkRefs } from "./wikiText";

const ID = "5a0000000000000000000001";

describe("correspondance nom -> identifiant", () => {
  const index = nameIndex({ [ID]: "Dorm room 110 key", b: "Clé de la chambre" });
  it("ignore casse, accents et ponctuation", () => {
    expect(normItemName("  Clé  de-la CHAMBRE ")).toBe("cle de la chambre");
    expect(itemIdOf("dorm Room 110 key", index)).toBe(ID);
    expect(itemIdOf("Cle de la chambre", index)).toBe("b");
  });
  it("lit le repère {{id}} du wiki français et ignore les noms inconnus", () => {
    expect(itemIdOf(`⟦item:${ID}⟧`, new Map())).toBe(ID);
    expect(itemIdOf("Inconnu", index)).toBeUndefined();
  });
});

describe("cellules de tableau", () => {
  it("N/A devient « — » avec explication, oui/non restent lisibles", () => {
    expect(cellDisplay("Find in raid", "N/A")).toEqual({ text: "—", title: "Non précisé par le wiki" });
    expect(cellDisplay("Find in raid", "Yes").text).toBe("oui");
    expect(cellDisplay("Find in raid", "No").text).toBe("non");
    expect(cellDisplay("Notes", "N/A")).toEqual({ text: "N/A" });
  });
  it("repère la colonne du nom et le décalage de la colonne d'icône", () => {
    const headers = ["Icon", "Item name", "Amount"];
    expect(itemColumn(headers)).toBe(1);
    expect(rowOffset(headers, ["Key", "1"])).toBe(-1);
    expect(rowOffset(headers, ["", "Key", "1"])).toBe(0);
  });
});

describe("lots de titres du wiki", () => {
  it("50 titres au plus par requête", () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    expect(batchTitles(titles).map((b) => b.length)).toEqual([50, 50, 20]);
    expect(batchTitles([])).toEqual([]);
  });
});

describe("liens du wikitext et filtre objet / non-objet", () => {
  it("garde cible et texte, ignore fichiers, catégories et autres langues", () => {
    const raw = "Take [[Dorm room 110 key|the key]] to [[Customs]] [[File:A.png|x]] [[fr:Clé]] [[Hideout#Stash|stash]] [[Note_for_Kozlov]]";
    expect(linkRefs(raw).links).toEqual([
      { target: "Dorm room 110 key", text: "the key" },
      { target: "Customs", text: "Customs" },
      { target: "Hideout", text: "stash" },
      { target: "Note for Kozlov", text: "Note_for_Kozlov" },
    ]);
    expect(linkRefs("sans lien")).toEqual({});
  });
  it("écarte marchands, maps, boss et quêtes, garde clés, notes et valeurs", () => {
    expect(isItemPage(["Keys"])).toBe(true);
    expect(isItemPage(["Seasonal changes", "Valuables"])).toBe(true);
    expect(isItemPage(["Quest items"])).toBe(true);
    expect(isItemPage([])).toBe(true);
    for (const c of ["Locations", "Traders", "Bosses", "Quests", "Category:Factions"]) expect(isItemPage(["Notes", c])).toBe(false);
  });
});

describe("image d'un objet", () => {
  it("adresse standard de tarkov.dev, ou celle du fichier d'objets", () => {
    expect(iconSrc("5d1b376e86f774252519444e")).toBe("https://assets.tarkov.dev/5d1b376e86f774252519444e-icon.webp");
    expect(iconSrc("aaaaaaaaaaaaaaaaaaaaaaaa", { aaaaaaaaaaaaaaaaaaaaaaaa: "autre-icon.webp" })).toBe("https://assets.tarkov.dev/autre-icon.webp");
  });
  it("objet sans image chez tarkov.dev (préréglage « Default ») : image de l'objet de base, même si le fichier d'objets dit « inconnue »", () => {
    // Interceptor OTV body armor (Woodland) Default -> Interceptor OTV body armor (Woodland)
    const src = iconSrc("68d690020c7e3ce5a80b8bec", { "68d690020c7e3ce5a80b8bec": "unknown-item-icon.jpg" });
    expect(src).toMatch(/^https:\/\/assets\.tarkov\.dev\/[0-9a-f]{24}-icon\.webp$/);
    expect(src).not.toContain("unknown");
  });
});
