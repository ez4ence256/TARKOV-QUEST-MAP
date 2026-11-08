import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanCaption,
  exitKey,
  loadQuestPhotos,
  loadWikiPage,
  markProxy,
  proxyActive,
  resetProxy,
  shouldFallback,
  parseExitTables,
  parseGuideGalleries,
  photoFilesForSpot,
  purgeExpiredCache,
  writeCache,
  wikiRequest,
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

describe("repli par le proxy /api/wiki", () => {
  afterEach(() => {
    resetProxy();
    vi.unstubAllGlobals();
  });

  it("shouldFallback : erreur réseau, 403 et 429 seulement", () => {
    expect(shouldFallback(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldFallback(403)).toBe(true);
    expect(shouldFallback(429)).toBe(true);
    expect(shouldFallback(500)).toBe(false);
    expect(shouldFallback(new Error("x"))).toBe(false);
  });

  it("proxy utilisé 10 minutes après un repli", () => {
    expect(proxyActive(1000)).toBe(false);
    markProxy(1000);
    expect(proxyActive(1000 + 599_999)).toBe(true);
    expect(proxyActive(1000 + 600_000)).toBe(false);
  });

  const jsonRes = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

  it("réessaie par /api/wiki si la route directe échoue, puis utilise le proxy directement", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://")) throw new TypeError("Failed to fetch");
      return jsonRes({ parse: { title: "ok" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await wikiRequest({ action: "parse", page: "A" }, "fr")).toEqual({ parse: { title: "ok" } });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([expect.stringContaining("fandom.com/fr/api.php"), "/api/wiki?lang=fr&action=parse&page=A"]);
    expect(proxyActive()).toBe(true);
    await wikiRequest({ action: "parse", page: "B" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 3e appel : proxy seul, sans retenter Fandom
  }, 10_000);

  it("garde l'erreur d'origine si le repli répond en HTML (hébergement statique)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("https://") ? new Response("", { status: 403 }) : new Response("<html>", { headers: { "Content-Type": "text/html" } }))));
    await expect(wikiRequest({ action: "parse", page: "C" })).rejects.toThrow("wiki: HTTP 403");
    expect(proxyActive()).toBe(false);
  }, 10_000);
});

describe("photoFilesForSpot", () => {
  const MAPS = ["Customs", "Woods", "Night Factory", "Factory"];
  const target = (text: string, mapName: string, allTexts: string[] = [text, "Install a camera elsewhere", "Install a camera again"]) => ({ text, allTexts, mapName, mapNames: MAPS });
  const gal = (...files: string[]) => `<gallery>\n${files.map((f) => `File:${f}`).join("\n")}\n</gallery>`;
  const bold = (t: string) => `'''${t}'''`;

  it("blocs au titre en gras sous un titre de map : le bloc exact", () => {
    const wt = [
      "==Guide==", "====[[Customs]]====",
      bold("The bucket-head villain"), "Text", gal("BucketMap.png", "Bucket.png"),
      bold("Every indie developer's worst nightmare"), gal("DevMap.png", "Dev.png"),
      "====Woods====",
      bold("The ominous sign"), gal("SignMap.png", "Sign.png"),
    ].join("\n");
    expect(photoFilesForSpot(wt, target("Install a camera to watch the indie developer's worst nightmare", "Customs"))).toEqual(["DevMap.png", "Dev.png"]);
    // le titre ne se trouve que sur une autre map : repli sur toute la map, jamais un bloc d'une autre map
    expect(photoFilesForSpot(wt, target("Install a camera at the ominous sign", "Customs"))).toEqual(["BucketMap.png", "Bucket.png", "DevMap.png", "Dev.png"]);
  });

  it("légendes par photo : la photo et la carte d'ensemble de son bloc", () => {
    const wt = "==Guide==\n<gallery>\nFile:A.png|Overview map of the area\nFile:B.png|Sniper nest on the water tower\nFile:C.png|Other thing\n</gallery>";
    expect(photoFilesForSpot(wt, target("Locate the sniper nest water tower", "Woods"))).toEqual(["A.png", "B.png"]);
  });

  it("ordinaux ignorés, lien incertain : null", () => {
    const wt = ["==Guide==", bold("Cargo on the first floor"), gal("X.png"), bold("Something else"), gal("Y.png")].join("\n");
    expect(photoFilesForSpot(wt, target("Locate the first cargo", "Customs"))).toBeNull();
  });

  it("sans galerie : null", () => {
    expect(photoFilesForSpot("==Guide==\nJuste du texte", target("Locate the thing", "Customs"))).toBeNull();
  });

  it("variante de map : Night Factory lit les titres Factory", () => {
    const wt = ["==Guide==", "====Factory====", bold("Stairway to skies"), gal("S.png"), "====Customs====", bold("Dorm"), gal("D.png")].join("\n");
    expect(photoFilesForSpot(wt, target("Install a camera at the stairway to skies", "Night Factory"))).toEqual(["S.png"]);
  });
});

describe("photoFilesForSpot : intro, titres courts, cartes d'ensemble", () => {
  const MAPS = ["Woods", "Customs"];
  const tgt = (text: string, allTexts: string[]) => ({ text, allTexts, mapName: "Woods", mapNames: MAPS });
  const gal = (...files: string[]) => `<gallery>\n${files.map((f) => `File:${f}`).join("\n")}\n</gallery>`;

  it("l'intro devant la première galerie n'est pas un titre ; un titre court suffit", () => {
    const wt = ["==Guide==", "Stash an Iskra ration pack in the ZB-016 bunker and a water bottle in the ZB-014 bunker.", gal("Overview.png"), "====ZB-016====", gal("Z16a.png", "Z16b.png"), "====ZB-014====", gal("Z14.png")].join("\n");
    const all = ["Stash an Iskra ration pack in the ZB-016 bunker on Woods", "Stash a water bottle in the ZB-014 bunker on Woods"];
    expect(photoFilesForSpot(wt, tgt(all[0], all))).toEqual(["Z16a.png", "Z16b.png"]);
    expect(photoFilesForSpot(wt, tgt(all[1], all))).toEqual(["Z14.png"]);
  });

  it("une carte d'ensemble à la légende très proche ne gagne pas seule", () => {
    const wt = "==Guide==\n<gallery>\nFile:Ov.png|Map of the pharmacy shelf stash spot\nFile:Real.png|Pharmacy shelf stash\nFile:Other.png|Cashier\n</gallery>";
    expect(photoFilesForSpot(wt, tgt("Stash the pharmacy shelf stash spot", ["Stash the pharmacy shelf stash spot", "Locate the cashier"]))).toEqual(["Ov.png", "Real.png"]);
  });
});

describe("photoFilesForSpot : quêtes sur plusieurs maps", () => {
  const MAPS = ["Woods", "Shoreline", "Factory", "Customs", "Lighthouse"];
  const tgt = (text: string, mapName: string, allTexts: string[]) => ({ text, allTexts, mapName, mapNames: MAPS });
  const gal = (...files: string[]) => `<gallery>\n${files.map((f) => `File:${f}`).join("\n")}\n</gallery>`;

  it("la map est dans la phrase du bloc (Viewer)", () => {
    const wt = [
      "==Guide==", "In this quest you have to place 1 [[WI-FI Camera]] each on [[Woods]], [[Shoreline]] and [[Factory]].", "",
      "On [[Woods]] it has to be placed at a rock ledge.", `<li style="display: inline-block;">${gal("WoodsMap.png", "WoodsLoc.png")}</li>`,
      "On [[Shoreline]] it has to be placed at the top of the lighthouse.", gal("ShoreMap.jpg", "Light.png"),
      "On [[Factory]] it has to be placed on the office stairs.", gal("FactoryLoc.png"),
    ].join("\n");
    const all = ["Place a WI-FI Camera at the rock ledge on Woods", "Place a WI-FI Camera at the lighthouse on Shoreline", "Place a WI-FI Camera at the stairs on Factory"];
    expect(photoFilesForSpot(wt, tgt(all[0], "Woods", all))).toEqual(["WoodsMap.png", "WoodsLoc.png"]);
    // sans rapprochement de texte : tous les blocs de la map, jamais ceux des autres
    expect(photoFilesForSpot(wt, tgt("Place a WI-FI Camera somewhere", "Shoreline", ["Place a WI-FI Camera somewhere", "Other one", "Third one"]))).toEqual(["ShoreMap.jpg", "Light.png"]);
  });

  it("titre de section avec lien de map (Thirsty)", () => {
    const wt = ["==Guide==", "Stash the tanks on [[Woods]] and [[Customs]].", "===[[Woods]] stashing location===", gal("WMap.png", "WLoc.png"), "===[[Customs]] stashing location===", gal("CMap.png", "CStore.png", "CLoc.png")].join("\n");
    const all = ["Stash a propane tank in the bunker", "Stash a propane tank in the store"];
    expect(photoFilesForSpot(wt, tgt(all[1], "Customs", all))).toEqual(["CMap.png", "CStore.png", "CLoc.png"]);
    expect(photoFilesForSpot(wt, tgt(all[0], "Woods", all))).toEqual(["WMap.png", "WLoc.png"]);
  });

  it("chaque objectif a son bloc (Easy Job)", () => {
    const wt = [
      "==Guide==", "Locate the helicopter in one of the basins at the water treatment plant in the north.", gal("HeliMap.png", "HeliPic.png"),
      "Additionally, kill 10 [[Rogues]] in a specific area of the water treatment plant on [[Lighthouse]].", gal("KillMap.png"),
    ].join("\n");
    const all = ["Locate the helicopter at the water treatment plant", "Kill 10 Rogues in the area of the water treatment plant"];
    expect(photoFilesForSpot(wt, tgt(all[0], "Lighthouse", all))).toEqual(["HeliMap.png", "HeliPic.png"]);
    expect(photoFilesForSpot(wt, tgt(all[1], "Lighthouse", all))).toEqual(["KillMap.png"]);
  });

  it("un seul lien de map égaré : pas de restriction", () => {
    const wt = ["==Guide==", "Spot A is near the cabins.", gal("A.png"), "Spot B, like on [[Customs]], is behind the shed.", gal("B.png")].join("\n");
    const all = ["Do the thing at the cabins", "Do the thing behind the shed"];
    // aucune des deux n'est sûre pour une autre cible : tout reste visible
    expect(photoFilesForSpot(wt, tgt("Visit the lighthouse top", "Woods", all))).toBeNull();
    expect(photoFilesForSpot(wt, tgt(all[1], "Woods", all))).toEqual(["B.png"]);
  });
});

describe("photoFilesForSpot : derniers cas", () => {
  const MAPS = ["Woods", "Shoreline"];
  const gal = (...files: string[]) => `<gallery>\n${files.map((f) => `File:${f}`).join("\n")}\n</gallery>`;

  it("objectif sans mot distinctif : niveau map seulement", () => {
    const wt = ["==Guide==", "====Woods====", gal("W.png"), "====Shoreline====", gal("S.png")].join("\n");
    const t = "Mark the first spot";
    expect(photoFilesForSpot(wt, { text: t, allTexts: [t, t], mapName: "Woods", mapNames: MAPS })).toEqual(["W.png"]);
    expect(photoFilesForSpot(gal("W.png"), { text: t, allTexts: [t, t], mapName: "Woods", mapNames: MAPS })).toBeNull();
  });

  it("le texte d'un bloc suit le dernier titre, pas l'intro", () => {
    const wt = ["==Guide==", "Mark any of the special cargo boxes.", "===Red warehouse===", gal("Map.png", "One.png"), "===Blue shed===", "Boxes by the shed.", gal("Two.png")].join("\n");
    const t = "Mark any of the special cargo boxes";
    expect(photoFilesForSpot(wt, { text: t, allTexts: [t, "Other thing"], mapName: "Woods", mapNames: MAPS })).toBeNull();
  });
});
