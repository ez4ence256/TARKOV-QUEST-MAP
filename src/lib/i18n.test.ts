import { afterEach, describe, expect, it } from "vitest";
import { plural, setLang, tr } from "./i18n";

afterEach(() => setLang("fr"));

describe("tr : espaces insécables (français seulement)", () => {
  it("devant : ; ? ! » et après «", () => {
    expect(tr("Note : « ok » ; vrai ? oui !", "x")).toBe("Note\u00A0: «\u00A0ok\u00A0»\u00A0; vrai\u00A0? oui\u00A0!");
  });
  it("laisse les adresses, les heures et l'anglais intacts", () => {
    expect(tr("https://exemple.fr à 12:30", "x")).toBe("https://exemple.fr à 12:30");
    setLang("en");
    expect(tr("a : b", "Note : « x »")).toBe("Note : « x »");
  });
});

describe("plural", () => {
  it("français : pluriel à partir de 2", () => {
    expect([0, 1, 2, 5].map((n) => `quête${plural(n)}`)).toEqual(["quête", "quête", "quêtes", "quêtes"]);
  });
  it("anglais : pluriel sauf pour 1", () => {
    setLang("en");
    expect([0, 1, 2].map((n) => `quest${plural(n)}`)).toEqual(["quests", "quest", "quests"]);
  });
});
