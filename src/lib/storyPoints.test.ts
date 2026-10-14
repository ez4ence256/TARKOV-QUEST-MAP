import wikitext from "./__fixtures__/accidental-witness.wikitext?raw";
import { describe, expect, it } from "vitest";
import { requirementKeys, stepKeys, stepText, parseStoryPage, storyStepId } from "./story";
import { chaptersWithPositions, currentStoryItem, currentStoryPoints, pointsOnMap, STORY_POSITIONS, type StoryItem } from "./storyPoints";

// Accidental Witness : wikitext réel de la page anglaise (octobre 2026)
const CHAPTER = "Accidental Witness";
const page = parseStoryPage(wikitext, CHAPTER);
const keys = [...requirementKeys(page.requirements.length), ...stepKeys(page.steps)];
const items: StoryItem[] = [...page.requirements, ...page.steps].map((s, i) => ({ key: keys[i], title: s.title, text: stepText(s) }));
const done = (...ks: string[]) => Object.fromEntries(ks.map((k) => [storyStepId(CHAPTER, k), true as const]));
const KNOWN_MAPS = ["customs", "streets-of-tarkov", "shoreline"];

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
    expect(chaptersWithPositions()).toEqual([CHAPTER]);
    for (const key of Object.keys(STORY_POSITIONS)) expect(keys.map((k) => storyStepId(CHAPTER, k))).toContain(key);
  });

  it("ne place que des cases dont le texte parle d'une carte du wiki (7 cartes)", () => {
    expect(Object.keys(STORY_POSITIONS)).toHaveLength(7);
    // chaque case placée a bien la photo source dans ses galeries
    const all = [...page.requirements, ...page.steps];
    for (const [key, e] of Object.entries(STORY_POSITIONS)) {
      const i = keys.findIndex((k) => storyStepId(CHAPTER, k) === key);
      expect(all[i].files.map((f) => f.file)).toContain(e.source);
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

describe("filtrage par map", () => {
  it("garde les points de la map affichée", () => {
    const customs = currentStoryPoints(CHAPTER, items, {});
    expect(pointsOnMap(customs, "customs")).toHaveLength(1);
    expect(pointsOnMap(customs, "shoreline")).toHaveLength(0);
    expect(pointsOnMap(customs, undefined)).toHaveLength(0);
  });
});
