import { describe, expect, it } from "vitest";
import { initialOf, teamPinHtml, teamPlayerHtml } from "./teamIcons";

const EVIL = "<img src=x onerror=alert(1)>";

/** Le HTML est inséré tel quel par Leaflet (innerHTML) : on le charge comme lui et on cherche une balise injectée. */
function parse(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("pseudo d'un coéquipier : toujours échappé dans le HTML Leaflet", () => {
  it("pastille d'objectif : aucune balise injectée", () => {
    const html = teamPinHtml(EVIL, "#fff");
    expect(html).not.toContain("<img");
    expect(parse(html).querySelector("img")).toBeNull();
    expect(parse(html).querySelector(".team-pin-initial")?.textContent).toBe("<"); // l'initiale est un simple texte
  });
  it("flèche de position : étiquette échappée en entier", () => {
    const html = teamPlayerHtml(90, EVIL, "#4aa3ff");
    expect(html).not.toContain("<img");
    const root = parse(html);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".team-player-label")?.textContent).toBe(EVIL);
  });
  it("guillemets et attributs : le pseudo ne sort pas de son élément", () => {
    const root = parse(teamPlayerHtml(0, `"><svg onload=alert(1)>`, "#4aa3ff"));
    expect(root.querySelectorAll("svg")).toHaveLength(1); // seule la flèche
    expect(root.querySelector("[onload]")).toBeNull();
  });
  it("initiale : premier caractère en capitale, « ? » si vide", () => {
    expect(initialOf("  éloïse")).toBe("É");
    expect(initialOf("")).toBe("?");
  });
});
