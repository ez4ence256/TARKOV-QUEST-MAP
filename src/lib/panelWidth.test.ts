import { afterEach, describe, expect, it } from "vitest";
import { PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, PANEL_WIDTH_KEY, clampPanelWidth, readPanelWidth, savePanelWidth } from "./panelWidth";

describe("largeur du panneau", () => {
  afterEach(() => localStorage.clear());

  it("reste entre le minimum et le maximum", () => {
    expect(clampPanelWidth(200, 1920)).toBe(PANEL_MIN);
    expect(clampPanelWidth(5000, 1920)).toBe(PANEL_MAX);
    expect(clampPanelWidth(512.4, 1920)).toBe(512);
  });

  it("ne prend jamais plus de 60 % d'une fenêtre étroite (mais jamais moins que le minimum)", () => {
    expect(clampPanelWidth(700, 1076)).toBe(600);
    expect(clampPanelWidth(700, 500)).toBe(PANEL_MIN);
  });

  it("largeur par défaut, puis largeur enregistrée", () => {
    expect(readPanelWidth(1920)).toBe(PANEL_DEFAULT);
    savePanelWidth(530);
    expect(localStorage.getItem(PANEL_WIDTH_KEY)).toBe("530");
    expect(readPanelWidth(1920)).toBe(530);
    // valeur enregistrée trop grande pour la fenêtre actuelle : bornée
    expect(readPanelWidth(800)).toBe(434);
  });

  it("valeur enregistrée illisible : largeur par défaut", () => {
    localStorage.setItem(PANEL_WIDTH_KEY, "n'importe quoi");
    expect(readPanelWidth(1920)).toBe(PANEL_DEFAULT);
  });
});
