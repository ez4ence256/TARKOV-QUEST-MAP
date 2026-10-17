// Onglet « Où le trouver » : sections d'emplacement d'une page d'objet du wiki (extraits réels).
import { describe, expect, it } from "vitest";
import { parseItemLocation } from "./itemLocation";

const FILTER = [
  "==Description==",
  "A filter.",
  "==Location==",
  "*[[Sport bag]]",
  "*[[Toolbox]]",
  "",
  "===[[Reserve]]===",
  "*In the [[RB-ST key|RB-ST warehouse]]",
  "<gallery>",
  "File:RBST.png|The warehouse",
  "</gallery>",
  "",
  "===[[Woods]]===",
  "* Multiple loose spawns behind crashed plane",
  "==Quest rewards==",
  "* None",
].join("\n");

const KEY = ["==Description==", "Key.", "==Key Location==", "* On a shelf", "==Lock Location==", "* Health Resort west wing", "==Behind the Lock==", "* A safe", "==Trading==", "x"].join("\n");

describe("emplacements d'un objet sur le wiki", () => {
  it("section Location : contenants, puis maps en sous-titres ; photos sous leur map ; liens", () => {
    const [loc] = parseItemLocation(FILTER, "Military power filter");
    expect(loc.title).toBe("Location");
    expect(loc.blocks.filter((b) => b.type === "heading").map((b) => (b.type === "heading" ? b.text : ""))).toEqual(["Reserve", "Woods"]);
    expect(loc.files).toEqual([{ file: "RBST.png", caption: "The warehouse", section: 1 }]);
    expect(loc.links).toContain("RB-ST key");
  });
  it("clé : où la trouver, où est la serrure, ce qu'il y a derrière ; rien d'autre", () => {
    expect(parseItemLocation(KEY, "Some key").map((s) => s.title)).toEqual(["Key Location", "Lock Location", "Behind the Lock"]);
  });
  it("page sans section d'emplacement : rien", () => {
    expect(parseItemLocation("==Description==\nA grip.\n==Mods==\nx", "Grip")).toEqual([]);
  });
});
