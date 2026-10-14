import wikitext from "./__fixtures__/accidental-witness.wikitext?raw";
import labWikitext from "./__fixtures__/labyrinth-en.wikitext?raw";
import { describe, expect, it } from "vitest";
import { requirementKeys, stepKeys, stepText, parseStoryPage, storyStepId } from "./story";
import { chaptersWithPositions, currentStoryItem, currentStoryPoints, pointsOnMap, STORY_POSITIONS, type StoryItem } from "./storyPoints";

// Accidental Witness : wikitext réel de la page anglaise (octobre 2026)
const CHAPTER = "Accidental Witness";
const page = parseStoryPage(wikitext.replace(/\r\n/g, "\n"), CHAPTER);
const keys = [...requirementKeys(page.requirements.length), ...stepKeys(page.steps)];
const items: StoryItem[] = [...page.requirements, ...page.steps].map((s, i) => ({ key: keys[i], title: s.title, text: stepText(s) }));
const done = (...ks: string[]) => Object.fromEntries(ks.map((k) => [storyStepId(CHAPTER, k), true as const]));
const KNOWN_MAPS = ["customs", "streets-of-tarkov", "shoreline", "the-labyrinth"];

// The Labyrinth : wikitext réel de la page anglaise (octobre 2026)
const LAB = "The Labyrinth (story chapter)";
const labPage = parseStoryPage(labWikitext.replace(/\r\n/g, "\n"), LAB);
const labKeys = [...requirementKeys(labPage.requirements.length), ...stepKeys(labPage.steps)];
const labItems: StoryItem[] = [...labPage.requirements, ...labPage.steps].map((s, i) => ({ key: labKeys[i], title: s.title, text: stepText(s) }));
const labDone = (...ks: string[]) => Object.fromEntries(ks.map((k) => [storyStepId(LAB, k), true as const]));

describe("story-positions.json", () => {
  it("a la bonne forme", () => {
    expect(Object.keys(STORY_POSITIONS).length).toBeGreaterThan(0);
    for (const [key, e] of Object.entries(STORY_POSITIONS)) {
      expect(key).toMatch(/^.+::(req#\d+|.+#\d+)$/);
      expect(KNOWN_MAPS).toContain(e.map);
      expect(e.positions.length).toBeGreaterThan(0);
      for (const p of e.positions) expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
      expect(e.source).toMatch(/\.png$/);
      expect(e.method.length).toBeGreaterThan(10);
      expect(e.errorM).toBeGreaterThan(0);
    }
  });

  it("ses clés sont celles que lit la page Accidental Witness", () => {
    expect(chaptersWithPositions()).toEqual([CHAPTER, LAB]);
    const known = [...keys.map((k) => storyStepId(CHAPTER, k)), ...labKeys.map((k) => storyStepId(LAB, k))];
    for (const key of Object.keys(STORY_POSITIONS)) expect(known).toContain(key);
  });

  it("ne place que des cases dont le texte parle d'une carte du wiki (7 cartes)", () => {
    expect(Object.keys(STORY_POSITIONS).filter((k) => k.startsWith(CHAPTER + "::"))).toHaveLength(7);
    expect(Object.keys(STORY_POSITIONS).filter((k) => k.startsWith(LAB + "::"))).toHaveLength(8);
    // chaque case placée a bien la photo source dans ses galeries
    const all = [...page.requirements, ...page.steps];
    for (const [key, e] of Object.entries(STORY_POSITIONS).filter(([k]) => k.startsWith(CHAPTER + "::"))) {
      const i = keys.findIndex((k) => storyStepId(CHAPTER, k) === key);
      expect(all[i].files.map((f) => f.file)).toContain(e.source);
    }
    const labAll = [...labPage.requirements, ...labPage.steps];
    for (const [key, e] of Object.entries(STORY_POSITIONS).filter(([k]) => k.startsWith(LAB + "::"))) {
      const i = labKeys.findIndex((k) => storyStepId(LAB, k) === key);
      expect(labAll[i].files.map((f) => f.file)).toContain(e.source);
    }
  });
});

describe("case en cours", () => {
  it("conditions d'abord, puis étapes dans l'ordre", () => {
    expect(currentStoryItem(CHAPTER, items, {})?.key).toBe("req#0");
    expect(currentStoryItem(CHAPTER, items, done("req#0"))?.key).toBe(keys[1]);
    expect(currentStoryItem(CHAPTER, items, done(...keys))).toBeUndefined();
  });

  it("montre le point de la case en cours seulement", () => {
    const p0 = currentStoryPoints(CHAPTER, items, {});
    expect(p0).toHaveLength(1);
    expect(p0[0]).toMatchObject({ map: "customs", stepKey: "req#0", floor: null });
    // condition cochée : le point de la première étape (dortoirs, 1er étage d'après le texte)
    const p1 = currentStoryPoints(CHAPTER, items, done("req#0"));
    expect(p1.map((p) => p.stepKey)).toEqual([keys[1]]);
    expect(p1[0].floor).toMatch(/1er|1st/);
    // case en cours sans position (« Find out what Kozlov… ») : aucun point
    expect(currentStoryPoints(CHAPTER, items, done("req#0", keys[1]))).toEqual([]);
    // Anastasia : 2e étage écrit dans le texte
    const upTo = keys.slice(1, keys.indexOf("locate anastasia s apartment#0"));
    const ana = currentStoryPoints(CHAPTER, items, done("req#0", ...upTo));
    expect(ana[0]).toMatchObject({ map: "streets-of-tarkov", errorM: 8 });
    expect(ana[0].floor).toMatch(/2e|2nd/);
  });

  it("une clé inconnue ou un chapitre sans case ne fait rien", () => {
    expect(currentStoryPoints(CHAPTER, items, {}, { "Autre::x#0": { map: "customs", positions: [{ x: 1, z: 2 }], source: "a.png", method: "m", errorM: 1 } })).toEqual([]);
    expect(currentStoryPoints(CHAPTER, [], {})).toEqual([]);
  });
});

describe("The Labyrinth", () => {
  it("la condition est sur Littoral, au sous-sol d'après le texte", () => {
    const p = currentStoryPoints(LAB, labItems, {});
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ map: "shoreline", stepKey: "req#0" });
    expect(p[0].floor).toMatch(/Sous-sol|Basement/);
  });

  it("les étapes suivantes passent sur la map du Labyrinthe, 5 points pour les 5 corps", () => {
    expect(currentStoryPoints(LAB, labItems, labDone("req#0"))).toEqual([]); // « Speak to Jaeger » : pas de carte
    const upTo = (k: string) => labKeys.slice(0, labKeys.indexOf(k));
    const orders = currentStoryPoints(LAB, labItems, labDone(...upTo("locate the traces of the bear squad#0")));
    expect(orders[0]).toMatchObject({ map: "the-labyrinth", stepKey: "locate the traces of the bear squad#0" });
    const bodies = currentStoryPoints(LAB, labItems, labDone(...upTo("investigate the 5 lab staff bodies#0")));
    expect(bodies).toHaveLength(5);
    expect(bodies.every((b) => b.map === "the-labyrinth" && b.count === 5)).toBe(true);
    const report = currentStoryPoints(LAB, labItems, labDone(...upTo("obtain and read the labyrinth facility research report#0")));
    expect(report[0].map).toBe("shoreline");
  });
});

describe("filtrage par map", () => {
  it("garde les points de la map affichée", () => {
    const customs = currentStoryPoints(CHAPTER, items, {});
    expect(pointsOnMap(customs, "customs")).toHaveLength(1);
    expect(pointsOnMap(customs, "shoreline")).toHaveLength(0);
    expect(pointsOnMap(customs, undefined)).toHaveLength(0);
  });
});
