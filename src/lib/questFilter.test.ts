import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { emptyModeState, reducer, type AppState } from "../state/store";
import { filterQuests, filterStory, mergeRows, pinSelected, STORY_TRADER, type QuestFilters, type Row } from "./questFilter";
import type { StoryChapter } from "./story";

const CUSTOMS = "customs";
const WOODS = "woods";
const task = (id: string, name: string, nameEn: string, traderId: string, mapId: string): Task => ({
  id,
  name,
  nameEn,
  normalizedName: id,
  traderId,
  mapId,
  minPlayerLevel: null,
  kappaRequired: false,
  wikiLink: null,
  objectives: [{ id: `${id}-o`, type: "mark", description: "", optional: false, mapIds: [mapId], locations: [] }],
});

// ordre alphabétique, comme les données de l'app
const tasks = [
  task("a", "Appâtage", "Chumming", "skier", CUSTOMS),
  task("d", "Debut", "Debut", "prapor", CUSTOMS),
  task("s2", "Signal - Partie 2", "Signal - Part 2", "mechanic", WOODS),
  task("s3", "Signal - Partie 3", "Signal - Part 3", "mechanic", WOODS),
];
const none: QuestFilters = { query: "", traderId: "", mapId: "", hideCompleted: false };
const names = (rs: Row[]) => rs.map((r) => ("task" in r ? r.task.name : r.chapter.name));

describe("liste des quêtes : sélection épinglée", () => {
  it("les quêtes sélectionnées passent en tête, les autres gardent leur ordre", () => {
    const { pinned, others, hiddenSelected } = pinSelected(filterQuests(tasks, none, {}), ["s3", "a"]);
    expect(names(pinned)).toEqual(["Appâtage", "Signal - Partie 3"]);
    expect(names(others)).toEqual(["Debut", "Signal - Partie 2"]);
    expect(hiddenSelected).toBe(0);
  });

  it("avec un filtre de map : une quête sélectionnée reste en tête si elle passe le filtre", () => {
    const { pinned, others, hiddenSelected } = pinSelected(filterQuests(tasks, { ...none, mapId: WOODS }, {}), ["s3", "a"]);
    expect(names(pinned)).toEqual(["Signal - Partie 3"]);
    expect(names(others)).toEqual(["Signal - Partie 2"]);
    expect(hiddenSelected).toBe(1); // Appâtage (Douanes) masquée par le filtre
  });

  it("avec une recherche (français ou anglais) et un filtre de marchand", () => {
    const r1 = pinSelected(filterQuests(tasks, { ...none, query: "signal" }, {}), ["s3"]);
    expect(names(r1.pinned)).toEqual(["Signal - Partie 3"]);
    expect(names(r1.others)).toEqual(["Signal - Partie 2"]);
    const r2 = pinSelected(filterQuests(tasks, { ...none, query: "chumming" }, {}), ["a"]);
    expect(names(r2.pinned)).toEqual(["Appâtage"]);
    const r3 = pinSelected(filterQuests(tasks, { ...none, traderId: "prapor" }, {}), ["a"]);
    expect(names(r3.pinned)).toEqual([]);
    expect(r3.hiddenSelected).toBe(1);
  });

  it("« Masquer les quêtes terminées » s'applique aussi aux quêtes sélectionnées", () => {
    const { pinned } = pinSelected(filterQuests(tasks, { ...none, hideCompleted: true }, { "a-o": 1 }), ["a", "d"]);
    expect(names(pinned)).toEqual(["Debut"]);
  });

  it("sans sélection : aucune zone épinglée", () => {
    expect(pinSelected(filterQuests(tasks, none, {}), []).pinned).toEqual([]);
  });
});

const chapter = (id: string, nameEn: string, name = nameEn): StoryChapter => ({ id, nameEn, name, frTitle: null });
const chapters = [chapter("Tour", "Tour", "Excursion"), chapter("Batya", "Batya"), chapter("Falling Skies", "Falling Skies", "Tombé du ciel")];

describe("Main story mélangée aux quêtes", () => {
  const merged = (f: QuestFilters, lang = "fr") => mergeRows(filterQuests(tasks, f, {}), filterStory(chapters, f, lang), lang, Boolean(f.query));

  it("sans recherche : tout est trié ensemble par nom affiché (français)", () => {
    expect(names(merged(none))).toEqual(["Appâtage", "Batya", "Debut", "Excursion", "Signal - Partie 2", "Signal - Partie 3", "Tombé du ciel"]);
  });

  it("en anglais : noms anglais", () => {
    expect(names(merged(none, "en"))).toContain("Falling Skies");
  });

  it("recherche française ou anglaise : trouve les chapitres, rappel du nom anglais", () => {
    expect(names(merged({ ...none, query: "excursion" }))).toEqual(["Excursion"]);
    const viaEn = merged({ ...none, query: "falling" });
    expect(names(viaEn)).toEqual(["Tombé du ciel"]);
    expect(viaEn[0].viaEnglish).toBe(true);
  });

  it("filtre marchand « Main story » : chapitres seulement ; autre marchand ou map : aucun chapitre", () => {
    expect(names(merged({ ...none, traderId: STORY_TRADER }))).toEqual(["Batya", "Excursion", "Tombé du ciel"]);
    expect(names(merged({ ...none, traderId: "prapor" }))).toEqual(["Debut"]);
    expect(names(merged({ ...none, mapId: WOODS }))).toEqual(["Signal - Partie 2", "Signal - Partie 3"]);
    expect(names(merged({ ...none, traderId: STORY_TRADER, mapId: WOODS }))).toEqual([]);
  });

  it("« Masquer les terminées » laisse les chapitres", () => {
    expect(names(merged({ ...none, hideCompleted: true }, "fr"))).toContain("Batya");
  });

  it("les chapitres sélectionnés sont épinglés avec les quêtes (clé story:<chapitre>)", () => {
    const { pinned, others, hiddenSelected } = pinSelected(merged(none), ["s3", "story:Tour", "story:Absent"]);
    expect(names(pinned)).toEqual(["Excursion", "Signal - Partie 3"]);
    expect(names(others)).toHaveLength(5);
    expect(hiddenSelected).toBe(1);
    expect(names(pinSelected(merged({ ...none, mapId: WOODS }), ["story:Tour"]).pinned)).toEqual([]);
  });
});

describe("Tout désélectionner", () => {
  it("vide aussi les chapitres de la Main story, en gardant leurs étapes cochées", () => {
    const story = { selected: ["Tour", "Batya"], done: { "Tour::a#0": true as const } };
    const state: AppState = { version: 1, gameMode: "regular", showDone: false, modes: { regular: { ...emptyModeState(), selected: [{ taskId: "a", color: 0 }], story } } };
    const next = reducer(state, { type: "clearSelection" }).modes.regular!;
    expect(next.selected).toEqual([]);
    expect(next.story).toEqual({ selected: [], done: story.done });
  });

  it("sans Main story : pas de champ story créé", () => {
    const state: AppState = { version: 1, gameMode: "regular", showDone: false, modes: { regular: emptyModeState() } };
    expect(reducer(state, { type: "clearSelection" }).modes.regular!.story).toBeUndefined();
  });

  it("vide la sélection sans toucher à la progression, aux notes ni aux points", () => {
    const regular = {
      ...emptyModeState(),
      selected: [
        { taskId: "a", color: 0 },
        { taskId: "s3", color: 1 },
      ],
      done: { "s3-o": 123 },
      notes: { "s3-o@1.0,1.0": "note" },
      manual: { "d-o": { mapId: CUSTOMS, x: 1, z: 2 } },
      customPoints: [{ id: "p", mapId: CUSTOMS, x: 0, z: 0, icon: "star" as const, label: "Planque", note: "", createdAt: 1 }],
    };
    const state: AppState = { version: 1, gameMode: "regular", showDone: false, modes: { regular, pve: { ...emptyModeState(), selected: [{ taskId: "a", color: 0 }] } } };
    const next = reducer(state, { type: "clearSelection" });
    expect(next.modes.regular!.selected).toEqual([]);
    expect(next.modes.regular!.done).toBe(regular.done);
    expect(next.modes.regular!.notes).toBe(regular.notes);
    expect(next.modes.regular!.manual).toBe(regular.manual);
    expect(next.modes.regular!.customPoints).toBe(regular.customPoints);
    expect(next.modes.pve).toBe(state.modes.pve); // autre mode intact
  });

  it("désélection d'une seule quête : les autres restent sélectionnées", () => {
    const state: AppState = {
      version: 1,
      gameMode: "regular",
      showDone: false,
      modes: { regular: { ...emptyModeState(), selected: [{ taskId: "a", color: 0 }, { taskId: "s3", color: 1 }] } },
    };
    expect(reducer(state, { type: "toggleTask", taskId: "a" }).modes.regular!.selected).toEqual([{ taskId: "s3", color: 1 }]);
  });
});
