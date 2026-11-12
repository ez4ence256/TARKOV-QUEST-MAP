// L'accueil existe en trois exemplaires qui doivent dire la même chose : la copie statique d'index.html (avant le JS),
// le composant React, et la FAQ des données structurées (JSON-LD). Ce test les compare.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import indexHtml from "../../index.html?raw";
import { ModePicker } from "./ModePicker";
import { homeContent } from "../lib/homeContent";
import { version } from "../../package.json";

const html = indexHtml.replaceAll("__SITE_URL__", "https://example.test/").replaceAll("__APP_VERSION__", version);
const staticDoc = new DOMParser().parseFromString(html, "text/html");
const reactDoc = new DOMParser().parseFromString(
  renderToStaticMarkup(<ModePicker last={null} onPick={() => {}} lang="fr" onLang={() => {}} />),
  "text/html",
);

const TEXT_NODES = "h1,h2,h3,p,li,summary,.mode-option span";
// s couvre l'espace insécable que tr() met devant : ; ? ! » : la copie statique d'index.html n'en a pas, le texte reste le même.
const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
const texts = (root: ParentNode) => [...root.querySelectorAll(TEXT_NODES)].map((e) => norm(e.textContent));

type Faq = { name: string; acceptedAnswer: { text: string } };
const graph = JSON.parse(staticDoc.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"] as {
  "@type": string;
  mainEntity?: Faq[];
}[];

describe("accueil : copie statique, composant et données structurées", () => {
  it("la copie statique (#root d'index.html) a les mêmes textes que le composant", () => {
    const copy = staticDoc.querySelector("#root")!;
    expect(texts(copy).length).toBeGreaterThan(30);
    expect(texts(copy)).toEqual(texts(reactDoc.body));
  });

  it("la FAQ affichée, celle d'index.html et celle du JSON-LD sont identiques", () => {
    const shown = [...reactDoc.querySelectorAll(".home-faq details")].map((d) => [
      norm(d.querySelector("summary")!.textContent),
      norm(d.querySelector("p")!.textContent),
    ]);
    const fromStatic = [...staticDoc.querySelectorAll("#root .home-faq details")].map((d) => [
      norm(d.querySelector("summary")!.textContent),
      norm(d.querySelector("p")!.textContent),
    ]);
    const faq = graph.find((n) => n["@type"] === "FAQPage")!.mainEntity!;
    const fromLd = faq.map((q) => [norm(q.name), norm(q.acceptedAnswer.text)]);
    expect(shown).toHaveLength(6);
    expect(fromStatic).toEqual(shown);
    expect(fromLd).toEqual(shown);
    expect(shown).toEqual(homeContent().faq.map((f) => [norm(f.q), norm(f.a)])); // norm : les espaces insécables de tr() deviennent des espaces
  });

  it("un seul H1, titres dans l'ordre, 6 cartes", () => {
    const levels = [...reactDoc.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((l, i) => expect(l - levels[i]).toBeLessThanOrEqual(1));
    expect(reactDoc.querySelectorAll(".home-features h3")).toHaveLength(6);
  });

  it("les boutons de mode ne sont que dans le composant (pas de faux boutons dans la copie statique)", () => {
    expect(reactDoc.querySelectorAll("button.mode-option")).toHaveLength(3);
    expect(staticDoc.querySelectorAll("#root button, #root a[href='#']")).toHaveLength(0);
  });
});

describe("index.html : référencement", () => {
  const meta = (sel: string) => staticDoc.querySelector(sel)?.getAttribute("content") ?? "";
  it("titre, description, lien canonique et partage", () => {
    expect(staticDoc.title.length).toBeLessThanOrEqual(70);
    expect(staticDoc.title).toBe("Carte et suivi des quêtes Escape from Tarkov | Tarkov Quest Planner");
    const description = meta('meta[name="description"]');
    expect(description.length).toBeGreaterThanOrEqual(110);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(staticDoc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://example.test/");
    expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(meta('meta[property="og:image"]')).toBe("https://example.test/og-image.jpg");
    expect(meta('meta[property="og:title"]')).toBe(staticDoc.title);
  });

  it("données structurées : WebSite, WebApplication et FAQPage", () => {
    expect(graph.map((n) => n["@type"]).sort()).toEqual(["FAQPage", "WebApplication", "WebSite"]);
  });

  it("affiche la version du package", () => {
    expect(texts(staticDoc.querySelector("#root")!)).toContain(`Tarkov Quest Planner · v${version}`);
  });
});
