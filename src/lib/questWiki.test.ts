// Croisement wiki ↔ tarkov.dev, avec de courts extraits réels du wiki (CC BY-NC-SA)
// et des données tarkov.dev réduites aux champs utiles.
import { describe, expect, it } from "vitest";
import type { Task, TaskDetails, Trader } from "../types";
import type { WikiPage } from "../api/wiki";
import {
  acceptWikiPage,
  baseQuestName,
  compareRewards,
  comparePrerequisites,
  failConditionText,
  isPvpZone,
  packingList,
  readWikiQuest,
} from "./questWiki";

const page = (title: string, wikitext: string, categories = ["Quests"]): WikiPage => ({
  title,
  pageUrl: `https://escapefromtarkov.fandom.com/wiki/${title.replace(/ /g, "_")}`,
  exists: true,
  wikitext,
  categories,
  fetchedAt: 0,
});

const details = (d: Partial<TaskDetails> = {}): TaskDetails => ({
  taskRequirements: [],
  traderRequirements: [],
  neededKeys: [],
  rewards: null,
  failConditions: [],
  restartable: false,
  lightkeeperRequired: false,
  ...d,
});

const task = (id: string, nameEn: string, extra: Partial<Task> = {}): Task => ({
  id,
  name: nameEn,
  nameEn,
  normalizedName: id,
  traderId: "mechanic",
  mapId: null,
  minPlayerLevel: null,
  kappaRequired: false,
  wikiLink: `https://escapefromtarkov.fandom.com/wiki/${baseQuestName(nameEn).replace(/ /g, "_")}`,
  objectives: [],
  details: details(),
  ...extra,
});

const traders: Trader[] = [
  { id: "mechanic", name: "Mécano", normalizedName: "mechanic", imageLink: null },
  { id: "skier", name: "Skier", normalizedName: "skier", imageLink: null },
  { id: "ref", name: "Ref", normalizedName: "ref", imageLink: null },
];

// --- extraits réels ---
const SIGNAL_3_WIKI = page(
  "Signal - Part 3",
  `{{Historical content}}
{{Infobox quest
|given by     =[[Mechanic]]
|previous     =
|leads to     =
|reqkappa     =<font color="red">Yes</font>
}}
==Dialogue==
{{quote|Install suppressors on the antennas you found.}}
==Requirements==
* Must be level 15 to start this quest.
==Rewards==
* +8,500 [[EXP]]
* [[Mechanic]] Rep <font color="green">'''+0.02'''</font>
* 30,000 Roubles
`,
  ["Historical content", "Quests"],
);

const COLLECTOR_WIKI = page(
  "Collector",
  `{{Infobox quest
|given by     =[[Fence]]
|previous     =[[Collector#Requirements|See requirements]]
|reqkappa     =<font color="red">Yes</font>
}}
==Requirements==
* Complete the quests:
** [[Chemical - Part 3]]
** [[Sew it Good - Part 2]]
`,
);

const EASY_MONEY_2_WIKI = page(
  "Easy Money - Part 2",
  `{{Infobox quest
|given by     =[[Ref]]
|previous     =[[Easy Money - Part 1]]
|leads to     =[[Balancing - Part 1]]<br/>[[Provide Viewership]]
|reqkappa     =<font color="green">No</font>
}}
==Guide==
{|class="wikitable"
! colspan="4" | Related Quest Items
|-
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
|-
|Any [[food]] item
|5
|Handover item
!<font color="red">Yes</font>
|}
Some advice.
`,
);

describe("association quête ↔ page wiki", () => {
  it("n'accepte que les pages existantes classées quête ou quête historique", () => {
    expect(acceptWikiPage(SIGNAL_3_WIKI)).toBe(true);
    expect(acceptWikiPage(page("Signal Jammer", "objet", ["Quest items"]))).toBe(false);
    expect(acceptWikiPage({ ...SIGNAL_3_WIKI, exists: false })).toBe(false);
  });

  it("page historique repérée par sa catégorie", () => {
    expect(readWikiQuest(SIGNAL_3_WIKI).historical).toBe(true);
    expect(readWikiQuest(COLLECTOR_WIKI).historical).toBe(false);
  });

  it("quête PVP ZONE : nom de la quête normale utilisée pour le wiki", () => {
    const pvp = task("em2pvp", "Easy Money - Part 2 [PVP ZONE]");
    expect(isPvpZone(pvp)).toBe(true);
    expect(baseQuestName(pvp.nameEn)).toBe("Easy Money - Part 2");
    expect(pvp.wikiLink).toBe("https://escapefromtarkov.fandom.com/wiki/Easy_Money_-_Part_2");
    expect(isPvpZone(task("em2", "Easy Money - Part 2"))).toBe(false);
  });
});

describe("lecture d'une page de quête", () => {
  it("réplique, infobox, prérequis, récompenses", () => {
    const wiki = readWikiQuest(SIGNAL_3_WIKI);
    expect(wiki).toMatchObject({
      briefing: "Install suppressors on the antennas you found.",
      givenBy: "Mechanic",
      kappa: true,
      previous: [],
      requiredLevel: 15,
      rewardNumbers: { experience: 8500, money: { Roubles: 30000 }, reputation: { Mechanic: 0.02 } },
    });
  });

  it("le lien de l'infobox vers la page elle-même n'est pas une quête préalable", () => {
    expect(readWikiQuest(COLLECTOR_WIKI).previous).toEqual([]);
    expect(readWikiQuest(COLLECTOR_WIKI).requirementLinks).toEqual(["Chemical - Part 3", "Sew it Good - Part 2"]);
  });

  it("le tableau « Related Quest Items » passe du Guide à la liste « à emporter »", () => {
    const wiki = readWikiQuest(EASY_MONEY_2_WIKI);
    expect(wiki.relatedItems).toEqual([
      { name: "Any food item", amount: "5", requirement: "Handover item", foundInRaid: true, notes: "" },
    ]);
    expect(wiki.guide).toEqual([{ type: "paragraph", text: "Some advice." }]);
  });
});

describe("comparaison des prérequis", () => {
  const ratHunting = task("rat", "Rat Hunting");
  const signal3 = task("signal3", "Signal - Part 3", {
    minPlayerLevel: 15,
    kappaRequired: false,
    details: details({ taskRequirements: [{ taskId: "rat", status: ["complete"] }] }),
  });
  const ctx = { tasks: [ratHunting, signal3], traders };

  it("Signal - Part 3 : quête préalable et Kappa en désaccord, niveau d'accord", () => {
    const cmp = comparePrerequisites(signal3, readWikiQuest(SIGNAL_3_WIKI), ctx);
    expect(cmp.tarkovTasks).toEqual([{ name: "Rat Hunting", taskId: "rat", status: ["complete"] }]);
    expect(cmp.wikiTasks).toEqual([]);
    expect(cmp.warnings).toEqual([
      "tarkov.dev demande la quête « Rat Hunting », que le wiki ne mentionne pas.",
      "Kappa : non requise selon tarkov.dev, requise selon le wiki.",
    ]);
    // quête suivante d'après tarkov.dev (celle qui demande Rat Hunting)
    expect(comparePrerequisites(ratHunting, null, ctx).tarkovNext).toEqual([{ name: "Signal - Part 3", taskId: "signal3" }]);
  });

  it("Collector : une quête préalable en plus chez tarkov.dev", () => {
    const names = ["Chemical - Part 3", "Sew it Good - Part 2", "Postman Pat - Part 2"];
    const prereqs = names.map((n, i) => task(`p${i}`, n));
    const collector = task("collector", "Collector", {
      kappaRequired: true,
      details: details({ taskRequirements: prereqs.map((p) => ({ taskId: p.id, status: ["complete"] })) }),
    });
    const cmp = comparePrerequisites(collector, readWikiQuest(COLLECTOR_WIKI), { tasks: [...prereqs, collector], traders });
    expect(cmp.warnings).toEqual(["tarkov.dev demande la quête « Postman Pat - Part 2 », que le wiki ne mentionne pas."]);
    expect(cmp.wikiTasks.map((t) => t.taskId)).toEqual(["p0", "p1"]); // cliquables
  });

  it("PVP ZONE : les quêtes [PVP ZONE] de tarkov.dev correspondent aux pages normales du wiki", () => {
    const part1 = task("em1pvp", "Easy Money - Part 1 [PVP ZONE]");
    const balancing = task("bal1pvp", "Balancing - Part 1 [PVP ZONE]");
    const em2 = task("em2pvp", "Easy Money - Part 2 [PVP ZONE]", {
      traderId: "ref",
      details: details({ taskRequirements: [{ taskId: "em1pvp", status: ["complete"] }] }),
    });
    const cmp = comparePrerequisites(em2, readWikiQuest(EASY_MONEY_2_WIKI), { tasks: [part1, balancing, em2], traders });
    expect(cmp.warnings).toEqual([]);
    expect(cmp.wikiTasks).toEqual([{ name: "Easy Money - Part 1", taskId: "em1pvp" }]);
    // « Provide Viewership » n'existe pas dans l'app : pas proposé comme lien
    expect(cmp.wikiNext).toEqual([{ name: "Balancing - Part 1", taskId: "bal1pvp" }]);
  });

  it("sans page wiki : prérequis tarkov.dev seuls, aucun avertissement", () => {
    expect(comparePrerequisites(signal3, null, ctx).warnings).toEqual([]);
  });
});

describe("à emporter", () => {
  const names = { key306: "Clé 306 aile ouest", key306b: "Clé 306 (copie)", folder: "Dossier 0060", med1: "Salewa", med2: "AI-2", med3: "IFAK", med4: "Grizzly", ms2000: "Marqueur MS2000", jammer: "Brouilleur" };
  const hcp2 = task("hcp2", "Health Care Privacy - Part 2", {
    details: details({ neededKeys: [{ mapId: "shoreline", keyIds: ["key306"] }] }),
    objectives: [
      { id: "o1", type: "findQuestItem", description: "", optional: false, mapIds: [], locations: [], questItemId: "folder", requiredKeyIds: [["key306"]] },
      { id: "o2", type: "giveQuestItem", description: "", optional: false, mapIds: [], locations: [], questItemId: "folder" },
      { id: "o3", type: "findItem", description: "", optional: false, mapIds: [], locations: [], itemIds: ["med1", "med2", "med3", "med4"], count: 3, foundInRaid: true },
      { id: "o4", type: "giveItem", description: "", optional: false, mapIds: [], locations: [], itemIds: ["med4", "med3", "med2", "med1"], count: 3, foundInRaid: true },
      { id: "o5", type: "plantItem", description: "", optional: false, mapIds: [], locations: [], itemIds: ["jammer"], count: 1, foundInRaid: false },
      { id: "o6", type: "mark", description: "", optional: false, mapIds: [], locations: [], markerItemId: "ms2000" },
      { id: "o7", type: "mark", description: "", optional: false, mapIds: [], locations: [], markerItemId: "ms2000" },
      { id: "o8", type: "visit", description: "", optional: false, mapIds: [], locations: [], requiredKeyIds: [["key306b", "key306"]] },
    ],
  });

  it("clés, objets (Find in raid seulement si tarkov.dev le dit), outils à poser, sans doublons", () => {
    const list = packingList(hcp2, names, [{ id: "shoreline", name: "Littoral", normalizedName: "shoreline" }]);
    expect(list).toEqual([
      { kind: "key", label: "Clé 306 aile ouest", count: 1, detail: "Littoral" },
      { kind: "key", label: "Clé 306 (copie) ou Clé 306 aile ouest", count: 1 },
      { kind: "questItem", count: null, label: "Dossier 0060" },
      // findItem + giveItem des mêmes objets : une seule ligne
      { kind: "handover", count: 3, foundInRaid: true, label: "3 objets au choix parmi 4", detail: "ex. Grizzly, IFAK, AI-2…", countInLabel: true },
      { kind: "place", count: 1, foundInRaid: false, label: "Brouilleur" },
      { kind: "marker", count: 2, label: "Marqueur MS2000" },
    ]);
    // objet de quête : pas de mention Find in raid (tarkov.dev ne la donne pas)
    expect(list.find((i) => i.kind === "questItem")).not.toHaveProperty("foundInRaid");
  });
});

describe("récompenses", () => {
  it("signale les différences entre le wiki et tarkov.dev", () => {
    const signal3 = task("signal3", "Signal - Part 3", {
      details: details({
        rewards: {
          experience: 8500,
          items: [{ itemId: "5449016a4bdc2d6f028b456f", count: 33000 }],
          standing: [{ traderId: "mechanic", value: 0.02 }],
          offerUnlocks: [],
          skills: [],
        },
      }),
    });
    expect(compareRewards(signal3, readWikiQuest(SIGNAL_3_WIKI), traders)).toEqual([
      `Roubles : ${(33000).toLocaleString("fr-FR")} selon tarkov.dev, ${(30000).toLocaleString("fr-FR")} selon le wiki.`,
    ]);
  });

  it("conditions d'échec rédigées à partir de tarkov.dev", () => {
    const other = task("other", "Other");
    expect(
      failConditionText({ type: "taskStatus", description: "", taskId: "other", status: ["complete"] }, new Map([["other", other]])),
    ).toBe("Échoue si la quête « Other » est terminée.");
  });
});
