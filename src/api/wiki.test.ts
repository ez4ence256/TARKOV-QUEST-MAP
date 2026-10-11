import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanCaption, exitKey, loadQuestPhotos, loadWikiPage, parseExitTables, parseGuideGalleries, wikiTitleFromLink } from "./wiki";

// Extrait de wikitext construit pour le test (même structure que les pages de quêtes du wiki)
const WIKITEXT = `==Objectives==
<gallery>
File:Not a guide photo.png|Ne doit pas être gardée
</gallery>
==Guide==
[[File:Item icon.png|link=Hard drive]]
<gallery widths="300" heights="169" mode="packed">
File:House map.png|House locations marked on map
File:SA house1.png|1: Against the wall<br/>2: Under the [[Table|broken table]]
File:Missing file.png|Fichier supprimé du wiki
</gallery>
===Detail===
<gallery>
Image:Rock.png|alt=Rocher|'''Rock''' near the road
</gallery>
==Trivia==
<gallery>
File:Trivia.png|Hors guide
</gallery>`;

describe("lecture du wiki", () => {
  it("reconnaît les liens du wiki fournis par tarkov.dev", () => {
    expect(wikiTitleFromLink("https://escapefromtarkov.fandom.com/wiki/Serious_Allegations")).toBe("Serious Allegations");
    expect(wikiTitleFromLink("https://escapefromtarkov.fandom.com/wiki/Chemical_-_Part_4")).toBe("Chemical - Part 4");
    expect(wikiTitleFromLink("https://example.com/wiki/Serious_Allegations")).toBeNull();
    expect(wikiTitleFromLink(null)).toBeNull();
  });

  it("nettoie les légendes", () => {
    expect(cleanCaption("1: Against the wall<br/>2: Under the [[Table|broken table]]")).toBe(
      "1: Against the wall\n2: Under the broken table",
    );
    expect(cleanCaption("'''Rock''' near {{tpl}}the road")).toBe("Rock near the road");
  });

  it("ne garde que les galeries de la section Guide (sous-sections comprises)", () => {
    expect(parseGuideGalleries(WIKITEXT)).toEqual([
      { file: "House map.png", caption: "House locations marked on map" },
      { file: "SA house1.png", caption: "1: Against the wall\n2: Under the broken table" },
      { file: "Missing file.png", caption: "Fichier supprimé du wiki" },
      { file: "Rock.png", caption: "Rock near the road" },
    ]);
    expect(parseGuideGalleries("==Rewards==\n<gallery>\nFile:A.png|a\n</gallery>")).toEqual([]);
  });
});

describe("loadQuestPhotos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("assemble les photos, ignore les fichiers absents et met en cache", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      expect(params.get("origin")).toBe("*");
      if (params.get("action") === "parse") {
        return new Response(JSON.stringify({ parse: { wikitext: WIKITEXT } }));
      }
      const page = (title: string, name: string) => ({
        title,
        imageinfo: [
          {
            url: `https://img.example/${name}`,
            thumburl: `https://img.example/thumb/${name}`,
            descriptionurl: `https://escapefromtarkov.fandom.com/wiki/${title.replace(/ /g, "_")}`,
          },
        ],
      });
      return new Response(
        JSON.stringify({
          query: {
            normalized: [{ from: "File:SA house1.png", to: "File:SA house1.png" }],
            pages: [
              page("File:House map.png", "map.png"),
              page("File:SA house1.png", "house1.png"),
              { title: "File:Missing file.png", missing: true },
              page("File:Rock.png", "rock.png"),
            ],
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const link = "https://escapefromtarkov.fandom.com/wiki/Serious_Allegations";
    const gallery = await loadQuestPhotos(link);
    expect(gallery.photos.map((p) => p.file)).toEqual(["House map.png", "SA house1.png", "Rock.png"]);
    expect(gallery.photos[1]).toMatchObject({
      thumbUrl: "https://img.example/thumb/house1.png",
      pageUrl: "https://escapefromtarkov.fandom.com/wiki/File:SA_house1.png",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // deuxième appel : servi par le cache, aucune requête
    await loadQuestPhotos(link);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deux demandes simultanées des photos : une seule série de requêtes", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      if (params.get("action") === "parse") return new Response(JSON.stringify({ parse: { wikitext: WIKITEXT, categories: [] } }));
      return new Response(JSON.stringify({ query: { pages: [] } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const link = "https://escapefromtarkov.fandom.com/wiki/Serious_Allegations";
    await Promise.all([loadQuestPhotos(link), loadQuestPhotos(link)]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 parse + 1 imageinfo
  });

  it("renvoie une galerie vide si la page n'a pas de photos dans le Guide", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ parse: { wikitext: "==Guide==\nPas d'image." } })));
    vi.stubGlobal("fetch", fetchMock);
    const gallery = await loadQuestPhotos("https://escapefromtarkov.fandom.com/wiki/No_Photos");
    expect(gallery.photos).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas de requête d'images inutile
  });
});

describe("loadWikiPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("une seule requête parse, partagée entre l'onglet Quête et l'onglet Photos", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      expect(params.get("action")).toBe("parse");
      expect(params.get("redirects")).toBe("1");
      expect(params.get("prop")).toBe("wikitext|categories");
      return new Response(
        JSON.stringify({
          parse: {
            title: "Signal - Part 3",
            wikitext: "{{Historical content}}\n==Guide==\nPas d'image.",
            categories: [{ category: "Historical_content" }, { category: "Quests" }],
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const link = "https://escapefromtarkov.fandom.com/wiki/Signal_-_Part_3";
    // les deux onglets demandent la page en même temps
    const [page] = await Promise.all([loadWikiPage(link), loadQuestPhotos(link)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page).toMatchObject({
      title: "Signal - Part 3",
      exists: true,
      pageUrl: "https://escapefromtarkov.fandom.com/wiki/Signal_-_Part_3",
      categories: ["Historical content", "Quests"],
    });
    await loadWikiPage(link); // cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("page absente : exists = false, sans erreur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "missingtitle", info: "The page you specified doesn't exist." } }))),
    );
    const page = await loadWikiPage("https://escapefromtarkov.fandom.com/wiki/Delivery_from_the_Past");
    expect(page.exists).toBe(false);
    expect(page.wikitext).toBe("");
  });

  it("une autre erreur du wiki remonte (pas de page vide inventée)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(loadWikiPage("https://escapefromtarkov.fandom.com/wiki/Debut")).rejects.toThrow(/503/);
  });
});

// Extrait réel (raccourci) des sections Extractions et Transits de la page « Customs » du wiki
const EXITS_WIKITEXT = `==Extractions==
To locate the extractions use the [[Customs#Maps|maps]] below the table.
{| class="wikitable sortable stickyheader" style="text-align: center;"
!Extraction
!Name
!Faction
!Notes
|-
![[File:Administration Gate.png|240px]]
! style="text-align: left;" |Administration Gate
|Scav
|
|-
![[File:Boiler room basement.png|240px]]
! style="text-align: left;" |Boiler Room Basement (Co-op)
|All
|[[Scav]] + PMC
|[[File:Boiler room basement2.png|240px]]<br/>In the basement of the boiler building.
|-
! [[File:Fac Gate 3.png|240px]]
! style="text-align: left;" | Gate 3
|All
|[[File:Factory key icon.png|frameless|64px|link=Factory emergency exit key]]<br/>Used to open the door
|[[File:GCargoElevatorAnnouncement.wav|282px]]
|}

==Transits==
{| class="wikitable"
!Transit
!Name
|-
![[File:CustomsTransitToFactory.png|240px]]
! style="text-align: left;" |Transit to Factory
|All
|}

==Maps==
![[File:Hors section.png|240px]]`;

describe("photos des sorties", () => {
  const entries = parseExitTables(EXITS_WIKITEXT);
  it("lit une ligne par sortie, sans l'en-tête ni les sections voisines", () => {
    expect(entries.map((e) => e.name)).toEqual(["Administration Gate", "Boiler Room Basement (Co-op)", "Gate 3", "Transit to Factory"]);
  });
  it("garde les photos (colonne 1 et notes) avec leur légende, sans icônes ni sons", () => {
    expect(entries[0].photos).toEqual([{ file: "Administration Gate.png", caption: "" }]);
    expect(entries[1].photos).toEqual([
      { file: "Boiler room basement.png", caption: "" },
      { file: "Boiler room basement2.png", caption: "In the basement of the boiler building." },
    ]);
    expect(entries[2].photos).toEqual([{ file: "Fac Gate 3.png", caption: "" }]);
  });
  it("compare les noms sans casse, ponctuation ni suffixe entre parenthèses", () => {
    expect(exitKey("Boiler Room Basement (Co-Op)")).toBe(exitKey("boiler room basement"));
    expect(exitKey("Railroad Passage (Flare)")).toBe("railroad passage");
    expect(exitKey("Smugglers' Bunker (ZB-1012)")).toBe(exitKey("Smugglers Bunker"));
  });
});
