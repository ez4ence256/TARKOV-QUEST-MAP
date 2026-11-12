import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("langue par défaut", () => {
  const initial = async (stored: Record<string, string>) => {
    localStorage.clear();
    Object.entries(stored).forEach(([k, v]) => localStorage.setItem(k, v));
    vi.resetModules();
    return (await import("./i18n")).getLang();
  };
  afterEach(() => localStorage.clear());
  it("anglais sans rien d'enregistré, et le choix est fixé", async () => {
    expect(await initial({})).toBe("en");
    expect(localStorage.getItem("tqp:lang")).toBe("en");
  });
  it("le choix enregistré est respecté", async () => {
    expect(await initial({ "tqp:lang": "fr" })).toBe("fr");
    expect(await initial({ "tqp:lang": "en", "tqp:lastMode": "pve" })).toBe("en");
  });
  it("visiteur d'avant (données mais pas de langue) : reste en français", async () => {
    expect(await initial({ "tqp:lastMode": "regular" })).toBe("fr");
    expect(await initial({ "tqp:state:v1": "{}" })).toBe("fr");
  });
});
