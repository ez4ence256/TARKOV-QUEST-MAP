import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanCaption, loadQuestPhotos, parseGuideGalleries, wikiTitleFromLink } from "./wikiPhotos";

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

  it("renvoie une galerie vide si la page n'a pas de photos dans le Guide", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ parse: { wikitext: "==Guide==\nPas d'image." } })));
    vi.stubGlobal("fetch", fetchMock);
    const gallery = await loadQuestPhotos("https://escapefromtarkov.fandom.com/wiki/No_Photos");
    expect(gallery.photos).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas de requête d'images inutile
  });
});
