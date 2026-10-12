import { describe, expect, it } from "vitest";
import { floorFromText } from "./floorText";

describe("floorFromText", () => {
  it("anglais", () => {
    expect(floorFromText("Locate the room on the 3rd floor of the dorm")).toBe("3e étage");
    expect(floorFromText("on the second floor")).toBe("2e étage");
    expect(floorFromText("Ground floor of the mall")).toBe("Rez-de-chaussée");
    expect(floorFromText("in the basement")).toBe("Sous-sol");
    expect(floorFromText("on the roof")).toBe("Toit");
  });
  it("français", () => {
    expect(floorFromText("au 3ème étage du dortoir")).toBe("3e étage");
    expect(floorFromText("au 1er étage")).toBe("1er étage");
    expect(floorFromText("au rez-de-chaussée")).toBe("Rez-de-chaussée");
    expect(floorFromText("dans le sous-sol")).toBe("Sous-sol");
    expect(floorFromText("deuxième étage")).toBe("2e étage");
  });
  it("rien d'écrit", () => {
    expect(floorFromText("Éliminez 5 Scavs sur Interchange")).toBeNull();
    expect(floorFromText(undefined)).toBeNull();
  });
});

it("« underground » seul (nom de lieu, ex. bunker souterrain) n'est pas un étage", () => {
  expect(floorFromText("Locate the underground bunker on Reserve")).toBeNull();
});
