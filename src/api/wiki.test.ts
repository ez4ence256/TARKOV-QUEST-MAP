import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanCaption,
  exitKey,
  loadQuestPhotos,
  loadWikiPage,
  parseExitTables,
  parseGuideGalleries,
  purgeExpiredCache,
  writeCache,
  wikiTitleFromLink,
} from "./wiki";

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

describe("durée de vie du cache", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const link = "https://escapefromtarkov.fandom.com/wiki/Debut";
  const stubWiki = () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ parse: { title: "Debut", wikitext: "x", categories: [] } })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("une lecture avant 7 jours renouvelle le cache pour 7 jours de plus", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); // les setTimeout restent réels (pause entre requêtes)
    vi.setSystemTime(0);
    const fetchMock = stubWiki();
    await loadWikiPage(link);
    vi.setSystemTime(6 * DAY);
    await loadWikiPage(link); // renouvelle
    vi.setSystemTime(12 * DAY); // 12 j après le téléchargement, 6 j après le dernier usage
    await loadWikiPage(link);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("une entrée non utilisée pendant plus de 7 jours est retéléchargée", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const fetchMock = stubWiki();
    await loadWikiPage(link);
    vi.setSystemTime(8 * DAY);
    await loadWikiPage(link);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("la purge retire les entrées expirées et illisibles, garde les fraîches et les autres clés", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * DAY);
    localStorage.setItem("tqp:wiki:v2:page:vieille", JSON.stringify({ fetchedAt: 0 }));
    localStorage.setItem("tqp:wiki:v2:page:cassee", "{pas du json");
    localStorage.setItem("tqp:wiki:v2:page:fraiche", JSON.stringify({ fetchedAt: 0, usedAt: 9 * DAY }));
    localStorage.setItem("tqp:state:v1", "garde");
    purgeExpiredCache();
    expect(Object.keys(localStorage).sort()).toEqual(["tqp:state:v1", "tqp:wiki:v2:page:fraiche"]);
  });
});

describe("stockage plein", () => {
  const P = "tqp:wiki:v2:";
  const realSet = Storage.prototype.setItem;
  /** Faux quota : setItem lève si le total des valeurs dépasse la limite. */
  const quota = (limit: number) =>
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      const others = Object.keys(this).reduce((n, o) => (o === k ? n : n + (this.getItem(o) ?? "").length), 0);
      if (others + v.length > limit) throw new DOMException("plein", "QuotaExceededError");
      realSet.call(this, k, v);
    });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  const put = (k: string, usedAt: number) => localStorage.setItem(P + k, JSON.stringify({ fetchedAt: 1, usedAt, pad: "x".repeat(50) }));

  it("supprime les pages les moins utilisées d'abord, garde les récentes et les autres clés", () => {
    put("a", 100);
    put("b", 300);
    put("c", 200);
    localStorage.setItem("tqp:data:x", "y".repeat(500));
    quota(800);
    writeCache("neuve", { fetchedAt: 5, pad: "z".repeat(150) });
    expect(localStorage.getItem(P + "neuve")).not.toBeNull();
    expect(localStorage.getItem(P + "a")).toBeNull(); // la plus ancienne
    expect(localStorage.getItem(P + "c")).toBeNull();
    expect(localStorage.getItem(P + "b")).not.toBeNull(); // la plus récente survit
    expect(localStorage.getItem("tqp:data:x")).toHaveLength(500);
  });

  it("abandonne sans erreur quand il ne reste plus rien à libérer, sans toucher aux autres clés", () => {
    put("a", 100);
    localStorage.setItem("tqp:data:x", "y".repeat(500));
    quota(600);
    expect(() => writeCache("neuve", { fetchedAt: 5, pad: "z".repeat(300) })).not.toThrow();
    expect(localStorage.getItem(P + "neuve")).toBeNull();
    expect(localStorage.getItem(P + "a")).toBeNull();
    expect(localStorage.getItem("tqp:data:x")).toHaveLength(500);
  });
});
