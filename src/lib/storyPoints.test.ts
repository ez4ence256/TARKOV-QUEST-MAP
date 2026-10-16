import wikitext from "./__fixtures__/accidental-witness.wikitext?raw";
import labWikitext from "./__fixtures__/labyrinth-en.wikitext?raw";
import { describe, expect, it } from "vitest";
import L from "leaflet";
import { BUNDLED_CALIBRATION } from "../map/calibration";
import { getCRS } from "../map/crs";
import { requirementKeys, stepKeys, stepText, parseStoryPage, storyStepId } from "./story";
import { chaptersWithPositions, currentStoryItem, currentStoryPoints, pointsOnMap, STORY_POSITIONS, type StoryItem } from "./storyPoints";

// Accidental Witness : wikitext réel de la page anglaise (octobre 2026)
const CHAPTER = "Accidental Witness";
const page = parseStoryPage(wikitext.replace(/\r\n/g, "\n"), CHAPTER);
const keys = [...requirementKeys(page.requirements.length), ...stepKeys(page.steps)];
const items: StoryItem[] = [...page.requirements, ...page.steps].map((s, i) => ({ key: keys[i], title: s.title, text: stepText(s) }));
const done = (...ks: string[]) => Object.fromEntries(ks.map((k) => [storyStepId(CHAPTER, k), true as const]));
// The Labyrinth : wikitext réel de la page anglaise (octobre 2026)
const LAB = "The Labyrinth (story chapter)";
const labPage = parseStoryPage(labWikitext.replace(/\r\n/g, "\n"), LAB);
const labKeys = [...requirementKeys(labPage.requirements.length), ...stepKeys(labPage.steps)];
const labItems: StoryItem[] = [...labPage.requirements, ...labPage.steps].map((s, i) => ({ key: labKeys[i], title: s.title, text: stepText(s) }));
const labDone = (...ks: string[]) => Object.fromEntries(ks.map((k) => [storyStepId(LAB, k), true as const]));

// Extraits réels des pages anglaises (octobre 2026), un par chapitre placé ; The Ticket : + les 4 modèles de fins
const RAW = import.meta.glob("./__fixtures__/*.wikitext", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const raw = (slug: string) => (RAW[`./__fixtures__/${slug}.wikitext`] ?? "").replace(/\r\n/g, "\n");
const FIXTURE_CHAPTERS: Record<string, string> = {
  "accidental-witness": CHAPTER,
  "labyrinth-en": LAB,
  tour: "Tour",
  "falling-skies": "Falling Skies",
  batya: "Batya",
  "the-unheard": "The Unheard",
  "blue-fire": "Blue Fire",
  boreas: "Boreas",
  "they-are-already-here": "They Are Already Here",
  "the-ticket": "The Ticket",
};
const parsed = (chapter: string) => {
  const slug = Object.keys(FIXTURE_CHAPTERS).find((k) => FIXTURE_CHAPTERS[k] === chapter)!;
  const templates = Object.fromEntries(["Savior", "Debtor", "Fallen", "Survivor"].map((e) => [`The Ticket Section ${e} Guide`, raw(`the-ticket-${e.toLowerCase()}`)]).filter(([, t]) => t));
  const pg = parseStoryPage(raw(slug), chapter, templates);
  const all = [...pg.requirements, ...pg.steps];
  const ks = [...requirementKeys(pg.requirements.length), ...stepKeys(pg.steps)];
  return new Map(all.map((s, i) => [storyStepId(chapter, ks[i]), s.files.map((f) => f.file)]));
};
const KNOWN_MAPS = ["customs", "streets-of-tarkov", "shoreline", "the-labyrinth", "factory", "ground-zero", "interchange", "lighthouse", "reserve", "terminal", "woods", "the-lab", "icebreaker"];

describe("story-positions.json", () => {
  it("a la bonne forme", () => {
    expect(Object.keys(STORY_POSITIONS).length).toBeGreaterThan(0);
    for (const [key, entry] of Object.entries(STORY_POSITIONS)) {
      expect(key).toMatch(/^.+::(req#\d+|.+#\d+)$/);
      for (const e of [entry].flat()) {
        expect(KNOWN_MAPS).toContain(e.map);
        expect(e.positions.length).toBeGreaterThan(0);
        for (const p of e.positions) expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
        expect(e.source).toMatch(/\.(png|jpg)$/);
        expect(e.method.length).toBeGreaterThan(10);
        expect(e.errorM).toBeGreaterThan(0);
      }
    }
  });

  it("ses clés sont celles que lit la page de chaque chapitre, et la photo source est dans la case", () => {
    const chapters = chaptersWithPositions();
    for (const c of chapters) expect(Object.values(FIXTURE_CHAPTERS)).toContain(c);
    for (const c of chapters) {
      const known = parsed(c);
      for (const [key, entry] of Object.entries(STORY_POSITIONS).filter(([k]) => k.startsWith(c + "::"))) {
        expect(known.has(key), key).toBe(true);
        for (const e of [entry].flat()) expect(known.get(key), key).toContain(e.source);
      }
    }
  });

  it("nombre de cases placées par chapitre", () => {
    const n = (c: string) => Object.keys(STORY_POSITIONS).filter((k) => k.startsWith(c + "::")).length;
    expect(n(CHAPTER)).toBe(7);
    expect(n(LAB)).toBe(8);
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

describe("étage connu d'après le plan", () => {
  it("un point de Labs au 2e niveau porte son étage", () => {
    const key = Object.keys(STORY_POSITIONS).find((k) => k.startsWith("The Unheard::search for any mention"))!;
    const entries = [STORY_POSITIONS[key]].flat();
    expect(entries.some((e) => e.floor?.en === "Second level (Labs)")).toBe(true);
    expect(entries.every((e) => e.map === "the-lab")).toBe(true);
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

describe("Boreas : ponts de l'Icebreaker", () => {
  const ice = Object.entries(STORY_POSITIONS)
    .filter(([k]) => k.startsWith("Boreas::"))
    .flatMap(([k, v]) => [v].flat().filter((e) => e.map === "icebreaker").map((e) => ({ k, e })));

  it("11 cases (interphone, salle des machines, porte endommagée, C-1), avec leur pont", () => {
    expect(new Set(ice.map((i) => i.k)).size).toBe(11);
    for (const { e } of ice) expect(e.floor?.fr).toMatch(/^Pont \d/);
  });

  it("chaque point est sur le bateau dans la grille de tuiles, avec le calibrage corrigé", () => {
    const cal = BUNDLED_CALIBRATION["icebreaker"];
    const crs = getCRS(cal);
    for (const { k, e } of ice) {
      for (const p of e.positions) {
        const px = crs.latLngToPoint(L.latLng(p.z, p.x), 0);
        expect(px.x, k).toBeGreaterThan(80);
        expect(px.x, k).toBeLessThan(176);
        expect(px.y, k).toBeGreaterThan(10);
        expect(px.y, k).toBeLessThan(250);
      }
    }
  });

  it("contrôle indépendant : serrures de tarkov.dev (pont 0, pont 7) à moins de 4 m des cadres rouges", () => {
    const at = (file: string) => ice.find((i) => i.e.source === file)!.e.positions[0];
    const near = (p: { x: number; z: number }, x: number, z: number) => Math.hypot(p.x - x, p.z - z);
    expect(near(at("BoreasEngineRoomKeycardDoorMap.jpg"), 10.5, 25.6)).toBeLessThan(4);
    expect(near(at("Compartment C-1 keycard map.jpg"), -5.3, 28.4)).toBeLessThan(4);
    expect(near(at("BoreasScientistIntercomMap.jpg"), 11.4, 41.6)).toBeLessThan(2.5); // serrure C-3, pont 1
  });
});
