// Extraits courts de pages réelles du wiki Escape from Tarkov (Fandom, texte sous
// CC BY-NC-SA), relevés en octobre 2026, pour tester la lecture du wikitext.
import { describe, expect, it } from "vitest";
import {
  cleanInline,
  findSection,
  firstQuote,
  parseBlocks,
  parseInfobox,
  relatedQuestItems,
  rewardNumbers,
  splitSections,
  wikiLinkTargets,
} from "./wikiText";

// Signal - Part 3 (début de page, réduit)
const SIGNAL_3 = `{{Historical content}}
{{Infobox quest
|icon         =
|image        =SignalIcon.png
|location     =[[Shoreline]]
|given by     =[[Mechanic]]
|previous     =
|leads to     =
|reqkappa     =<font color="red">Yes</font>
}}

'''{{PAGENAME}}''' was a [[Quests|Quest]] in ''[[Escape from Tarkov]]''.

==Dialogue==
{{quote|Install suppressors on the antennas you found, and, just in case, another one on the tower, also there on the Shoreline.}}

==Requirements==
* Must be level 15 to start this quest.

==Objectives==
* Place the first [[Signal Jammer]] on the specified place on [[Shoreline]]

==Initial Equipment==
Unlocks purchase of [[Signal Jammer]] at [[Mechanic]] LL1.
{|class="wikitable"
!Icon
!Item name
!Amount
!Notes
|-
![[File:Signal Jammer icon.png|frameless|link=Signal Jammer]]
|[[Signal Jammer]]
|3
|To be placed on the antennas.
|}
`;

// Easy Money - Part 2 (page de la quête normale, utilisée pour la version [PVP ZONE])
const EASY_MONEY_2_INFOBOX = `{{Infobox quest
|given by     =[[Ref]]
|previous     =[[Easy Money - Part 1]]
|leads to     =[[Balancing - Part 1]]<br/>[[Provide Viewership]]
|reqkappa     =<font color="green">No</font>
}}`;
const EASY_MONEY_2_GUIDE = `{|class="wikitable"
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

{{Navbox quests}}
[[Category:Quests]]

[[fr:Argent facile - Partie 2]]`;

// Health Care Privacy - Part 2 : une clé (Find in raid N/A) et un objet de quête
const HCP2_GUIDE = `{|class="wikitable"
! colspan="7" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
!Notes
|-
|[[File:WestWing306KeyIcon.png|frameless|64px|frameless|link=Health Resort west wing room 306 key]]
|[[Health Resort west wing room 306 key]]
|1
|Required
!N/A
|Unlocks Health Resort west wing room 306 on [[Shoreline]] where the [[Secure Folder 0060]] is located.
|-
|[[File:Docs 0060 icon.png|frameless|64px|link=Secure Folder 0060]]
|[[Secure Folder 0060]]
|1
|Handover item
!<font color="red">Yes</font>
|''This [[Quests#Quest items|quest item]] can only be found if the quest is active.''<br>''If the player fails to extract with this item, they will lose it.''
|}
The [[Secure Folder 0060]] can be found on [[Shoreline]], in room 306 of the west wing at the Resort, located on a windowsill.

<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Inside West wing room 306.png|Folder location on the windowsill
</gallery></li>`;

// Debut : récompenses
const DEBUT_REWARDS = `* +3,000 [[EXP]]
* [[Prapor]] Rep <font color="green">'''+0.1'''</font>
* 80,000 Roubles
** 84,000 Roubles with [[Hideout#Modules|Intelligence center]] Level 1
{{quote|So, you got it done. Can't say I'm surprised, but it's always worth making sure!}}`;

// Collector : prérequis en liste imbriquée
const COLLECTOR_REQUIREMENTS = `* Reach Loyalty Level 4 with [[Prapor]], [[Therapist]], [[Skier]], [[Peacekeeper]], [[Mechanic]], [[Ragman]] and [[Jaeger]]
* [[Scavs#Scav karma|Scav karma]] of at least +3
* Complete the quests:
** [[Chemical - Part 3]]
** [[Sew it Good - Part 2]]`;

describe("lecture du wikitext", () => {
  it("découpe les sections de niveau 2, même avec un espace après le titre", () => {
    const { sections } = splitSections(SIGNAL_3);
    expect(sections.map((s) => s.title)).toEqual(["Dialogue", "Requirements", "Objectives", "Initial Equipment"]);
    expect(findSection(sections, "requirements")?.body.trim()).toBe("* Must be level 15 to start this quest.");
  });

  it("lit les paramètres de l'Infobox quest (vides exclus)", () => {
    expect(parseInfobox(SIGNAL_3)).toEqual({
      image: "SignalIcon.png",
      location: "[[Shoreline]]",
      "given by": "[[Mechanic]]",
      reqkappa: '<font color="red">Yes</font>',
    });
    const easy = parseInfobox(EASY_MONEY_2_INFOBOX);
    expect(wikiLinkTargets(easy["leads to"])).toEqual(["Balancing - Part 1", "Provide Viewership"]);
    expect(cleanInline(easy.reqkappa)).toBe("No");
    expect(parseInfobox("pas d'infobox")).toEqual({});
  });

  it("nettoie le texte : liens, gras, <font>, PAGENAME, entités", () => {
    expect(cleanInline("'''{{PAGENAME}}''' was a [[Quests|Quest]] in ''[[Escape from Tarkov]]''.", "Signal - Part 3")).toBe(
      "Signal - Part 3 was a Quest in Escape from Tarkov.",
    );
    expect(cleanInline('[[Hideout#Modules]] &amp; <font color="red">in raid</font>')).toBe("Hideout & in raid");
    expect(cleanInline("[[File:X.png|link=Y]][[Category:Quests]][[fr:Première fois]]")).toBe("");
  });

  it("cibles des liens, sans ancres, fichiers ni catégories", () => {
    expect(wikiLinkTargets("[[Scavs#Scav karma|Scav karma]] [[File:a.png]] [[Chemical - Part 3]]")).toEqual([
      "Scavs",
      "Chemical - Part 3",
    ]);
  });

  it("réplique du marchand (premier {{quote}})", () => {
    const dialogue = findSection(splitSections(SIGNAL_3).sections, "Dialogue")!.body;
    expect(firstQuote(dialogue)).toMatch(/^Install suppressors on the antennas/);
  });

  it("listes imbriquées", () => {
    const [list] = parseBlocks(COLLECTOR_REQUIREMENTS);
    expect(list.type === "list" && list.items.map((i) => [i.depth, i.text])).toEqual([
      [1, "Reach Loyalty Level 4 with Prapor, Therapist, Skier, Peacekeeper, Mechanic, Ragman and Jaeger"],
      [1, "Scav karma of at least +3"],
      [1, "Complete the quests:"],
      [2, "Chemical - Part 3"],
      [2, "Sew it Good - Part 2"],
    ]);
  });

  it("tableaux convertis en texte, galeries, Navbox, catégories et langues retirés", () => {
    const blocks = parseBlocks(HCP2_GUIDE);
    expect(blocks.map((b) => b.type)).toEqual(["table", "paragraph"]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      text: "The Secure Folder 0060 can be found on Shoreline, in room 306 of the west wing at the Resort, located on a windowsill.",
    });
    expect(parseBlocks(EASY_MONEY_2_GUIDE).map((b) => b.type)).toEqual(["table"]);
    const equipment = parseBlocks(findSection(splitSections(SIGNAL_3).sections, "Initial Equipment")!.body);
    expect(equipment[1]).toEqual({
      type: "table",
      title: null,
      headers: ["Icon", "Item name", "Amount", "Notes"],
      rows: [["", "Signal Jammer", "3", "To be placed on the antennas."]],
    });
  });

  it("tableau « Related Quest Items » : clés, objets et statut Find in raid", () => {
    expect(relatedQuestItems(parseBlocks(HCP2_GUIDE))).toEqual([
      {
        name: "Health Resort west wing room 306 key",
        amount: "1",
        requirement: "Required",
        foundInRaid: null, // N/A : pas de mention
        notes: "Unlocks Health Resort west wing room 306 on Shoreline where the Secure Folder 0060 is located.",
      },
      {
        name: "Secure Folder 0060",
        amount: "1",
        requirement: "Handover item",
        foundInRaid: true,
        notes:
          "This quest item can only be found if the quest is active.\nIf the player fails to extract with this item, they will lose it.",
      },
    ]);
    // sans colonne Icon
    expect(relatedQuestItems(parseBlocks(EASY_MONEY_2_GUIDE))).toEqual([
      { name: "Any food item", amount: "5", requirement: "Handover item", foundInRaid: true, notes: "" },
    ]);
    expect(relatedQuestItems(parseBlocks("Pas de tableau."))).toEqual([]);
    // Signal - Part 3 : cellule écrite "||Can be purchased…" (sans attributs)
    const signal = `{|class="wikitable"
! colspan="6" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!Find in raid
!Notes
|-
![[File:Signal Jammer icon.png|link=Signal Jammer]]
|[[Signal Jammer]]
|3
|Required
!N/A
||Can be purchased from [[Mechanic]] LL1.
|}`;
    expect(relatedQuestItems(parseBlocks(signal))[0]).toMatchObject({ name: "Signal Jammer", notes: "Can be purchased from Mechanic LL1." });
  });

  it("chiffres des récompenses (lignes de premier niveau seulement)", () => {
    expect(rewardNumbers(DEBUT_REWARDS)).toEqual({ experience: 3000, money: { Roubles: 80000 }, reputation: { Prapor: 0.1 } });
    const blocks = parseBlocks(DEBUT_REWARDS);
    expect(blocks.map((b) => b.type)).toEqual(["list", "quote"]);
  });
});
