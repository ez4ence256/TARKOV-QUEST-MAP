// L'écran d'accueil existe en trois exemplaires : ModePicker.tsx (l'appli), sa copie statique dans index.html
// (affichée avant le chargement de l'appli et lue par les moteurs de recherche) et la FAQ en données structurées.
// Ces tests échouent dès qu'un texte est modifié dans l'un sans l'être dans les autres.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import indexHtml from "../../index.html?raw";
import { ModePicker } from "./ModePicker";

/** Texte comparable : espaces insécables et retours à la ligne ramenés à une espace simple. */
const clean = (text: string | null | undefined) => (text ?? "").replace(/[ \s]+/g, " ").trim();
const texts = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map((el) => clean(el.textContent));

const page = new DOMParser().parseFromString(indexHtml, "text/html");
const shell = page.querySelector("#root .landing")!;
const app = new DOMParser()
  .parseFromString(renderToStaticMarkup(<ModePicker last={null} onPick={() => {}} lang="fr" onLang={() => {}} />), "text/html")
  .querySelector(".landing")!;

describe("copie statique de l'écran d'accueil (index.html)", () => {
  it.each([
    ["accroche", ".landing-kicker"],
    ["titre principal", ".landing-hero h1"],
    ["sous-titre", ".landing-lead"],
    ["réassurance", ".landing-trust li"],
    ["titre du choix du mode", ".mode-title"],
    ["modes de jeu", ".mode-label"],
    ["descriptions des modes", ".mode-hint"],
    ["note sous les modes", ".mode-card > .mode-note"],
    ["titres de section", ".landing-h2"],
    ["titres des fonctionnalités", ".feature h3"],
    ["textes des fonctionnalités", ".feature p"],
    ["questions de la FAQ", ".faq-item > summary"],
    ["réponses de la FAQ", ".faq-item > p"],
    ["pied de page", ".landing-footer p"],
  ])("%s : mêmes textes que ModePicker.tsx", (_name, selector) => {
    const expected = texts(app, selector);
    expect(expected.length).toBeGreaterThan(0);
    expect(texts(shell, selector)).toEqual(expected);
  });

  it("un seul h1, et des h2 / h3 dans l'ordre", () => {
    expect(shell.querySelectorAll("h1")).toHaveLength(1);
    expect(app.querySelectorAll("h1")).toHaveLength(1);
    expect(shell.querySelectorAll("h2").length).toBe(app.querySelectorAll("h2").length);
    expect(shell.querySelectorAll("h3").length).toBe(app.querySelectorAll("h3").length);
  });

  it("la ponctuation française ne passe jamais seule à la ligne (espace insécable)", () => {
    for (const root of [shell, app]) expect(root.textContent).not.toMatch(/ [:;?!]/);
  });
});

describe("données structurées et balises de référencement", () => {
  const graph = JSON.parse(page.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"] as Record<string, unknown>[];

  it("la FAQ en données structurées reprend la FAQ affichée, mot pour mot", () => {
    const faq = graph.find((node) => node["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => clean(q.name))).toEqual(texts(shell, ".faq-item > summary"));
    expect(faq.mainEntity.map((q) => clean(q.acceptedAnswer.text))).toEqual(texts(shell, ".faq-item > p"));
  });

  it("site et application décrits (WebSite, WebApplication)", () => {
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "WebApplication", "FAQPage"]);
  });

  it("titre, description, adresse canonique et image de partage présents, aux longueurs affichées par les moteurs", () => {
    const meta = (selector: string) => page.querySelector(selector)?.getAttribute("content") ?? "";
    expect(page.title).toContain("Escape from Tarkov");
    expect(page.title.length).toBeLessThanOrEqual(70);
    const description = meta('meta[name="description"]');
    expect(description.length).toBeGreaterThanOrEqual(110);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("%SITE_URL%");
    expect(meta('meta[property="og:image"]')).toBe("%SITE_URL%og-image.jpg");
    expect(meta('meta[property="og:title"]')).toBeTruthy();
    expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  });
});
