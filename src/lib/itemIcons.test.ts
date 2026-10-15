import { describe, expect, it } from "vitest";
import { batchTitles } from "../api/wiki";
import { cellDisplay, itemColumn, itemIdOf, nameIndex, normItemName, rowOffset } from "./itemIcons";

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
