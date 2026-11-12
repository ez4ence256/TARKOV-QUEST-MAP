import { afterEach, describe, expect, it } from "vitest";
import { frTypo, plural, setLang, tr } from "./i18n";

afterEach(() => setLang("fr"));

describe("frTypo : espaces insécables de la ponctuation française", () => {
  it("devant : ; ? ! et à l'intérieur des guillemets", () => {
    expect(frTypo("Faction : PMC")).toBe("Faction : PMC");
    expect(frTypo("Faut-il créer un compte ?")).toBe("Faut-il créer un compte ?");
    expect(frTypo("Fait ! Suite ; fin")).toBe("Fait ! Suite ; fin");
    expect(frTypo("Onglet « Ajouter » : cherche")).toBe("Onglet « Ajouter » : cherche");
  });

  it("ne touche ni aux heures, ni aux adresses, ni au texte sans ponctuation espacée", () => {
    for (const text of ["11/11/2026 19:15:34", "https://tarkov.dev", "Douanes · 1 point", "x — · z —", ""]) expect(frTypo(text)).toBe(text);
  });
});

describe("tr et plural", () => {
  it("français : texte typographié ; anglais : texte tel quel", () => {
    expect(tr("Données :", "Data:")).toBe("Données :");
    setLang("en");
    expect(tr("Données :", "Data:")).toBe("Data:");
  });

  it("pluriel : à partir de 2 en français, sauf pour 1 en anglais", () => {
    expect([0, 1, 2].map((n) => `${n} quête${plural(n)}`)).toEqual(["0 quête", "1 quête", "2 quêtes"]);
    setLang("en");
    expect([0, 1, 2].map((n) => `${n} quest${plural(n)}`)).toEqual(["0 quests", "1 quest", "2 quests"]);
  });
});
