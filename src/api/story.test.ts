import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStoryChapters, loadStoryPage } from "./story";

// Même forme que le tableau réel de « Story chapters » (réduit à deux chapitres)
const row = (icon: string, link: string) => `|-\n|style="text-align:center;"|[[File:${icon}|link=x]]\n|[[${link}]]\n|[[File:Banner.png|450px]]`;
const LIST_EN = `{| class="wikitable"\n!Icon\n!Chapter\n!Banner\n${row("Tour Icon.png", "Tour")}\n${row("Batya Icon.png", "Batya")}\n|-\n|}`;
const LIST_FR = `{| class="wikitable"\n!Icône\n!Chapitre\n!Bannière\n${row("Tour Icon.png", "Excursion")}\n${row("Batya Icon.png", "Batya")}\n|-\n|}`;

const TICKET = `==Objectives==\n* Talk\n==Guide==\n<div>\n{{The Ticket Section Savior Guide}}\n</div>\n\n===Escape===\nGo.\n<gallery>\nFile:Exit.png|The exit\nFile:Gone.png|Removed\n</gallery>\n`;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map((c) => new URL(c[0] as string));

describe("liste des chapitres", () => {
  it("français : une requête par wiki, noms et pages françaises existantes, puis cache", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const fr = u.pathname.startsWith("/fr/");
      return new Response(
        JSON.stringify({
          parse: fr
            ? { wikitext: LIST_FR, links: [{ title: "Excursion", exists: true }, { title: "Batya", exists: false }] }
            : { wikitext: LIST_EN, links: [] },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const chapters = await loadStoryChapters("fr");
    expect(chapters).toEqual([
      { id: "Tour", nameEn: "Tour", name: "Excursion", frTitle: "Excursion" },
      { id: "Batya", nameEn: "Batya", name: "Batya", frTitle: null }, // lien rouge : pas de page française
    ]);
    expect(calls(fetchMock).map((u) => u.pathname)).toEqual(["/api.php", "/fr/api.php"]);

    await loadStoryChapters("fr");
    await loadStoryChapters("en");
    expect(fetchMock).toHaveBeenCalledTimes(2); // tout vient du cache
  });

  it("liste française en panne : les noms anglais suffisent", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new URL(url).pathname.startsWith("/fr/") ? new Response("", { status: 503 }) : new Response(JSON.stringify({ parse: { wikitext: LIST_EN } })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const chapters = await loadStoryChapters("fr");
    expect(chapters.map((c) => c.name)).toEqual(["Tour", "Batya"]);
  });
});

describe("un chapitre", () => {
  it("page + modèles de fins + photos en trois requêtes, résultat en cache (sans wikitext)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const p = new URL(url).searchParams;
      if (p.get("action") === "parse") return new Response(JSON.stringify({ parse: { title: "The Ticket", wikitext: TICKET } }));
      if (p.get("prop") === "revisions") {
        expect(p.get("titles")).toBe("Template:The Ticket Section Savior Guide");
        return new Response(
          JSON.stringify({ query: { pages: [{ title: "Template:The Ticket Section Savior Guide", revisions: [{ slots: { main: { content: "===Accept the offer===\nYes." } } }] }] } }),
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            pages: [
              { title: "File:Exit.png", imageinfo: [{ url: "https://img/exit.png", thumburl: "https://img/t/exit.png", descriptionurl: "https://wiki/File:Exit.png" }] },
              { title: "File:Gone.png", missing: true },
            ],
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await loadStoryPage("The Ticket", "en");
    expect(page.exists).toBe(true);
    expect(page.steps.map((s) => `${s.branch ?? "-"}|${s.title}`)).toEqual(["-|Accept the offer", "-|Escape"]);
    // photo absente du wiki : écartée, sans image cassée ; la présente a son adresse
    expect(page.steps[1].photos?.map((p) => p.file)).toEqual(["Exit.png"]);
    expect(page.steps[1].files).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const again = await loadStoryPage("The Ticket", "en");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // le cache est compact, mais la relecture redonne les mêmes photos (légende comprise)
    expect(again.steps[1].photos).toEqual([
      { file: "Exit.png", caption: "The exit", thumbUrl: "https://img/t/exit.png", fullUrl: "https://img/exit.png", pageUrl: "https://escapefromtarkov.fandom.com/wiki/File:Exit.png" },
    ]);
    const stored = Object.entries(localStorage).find(([k]) => k.includes("story:en:The Ticket"))?.[1] ?? "";
    expect(stored).not.toContain("wds-tabber");
    expect(stored).toContain("Accept the offer");
  });

  it("page française : les modèles sont demandés au wiki français (absents : étapes de la page seulement)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const p = new URL(url).searchParams;
      if (p.get("action") === "parse") return new Response(JSON.stringify({ parse: { title: "Le ticket", wikitext: TICKET } }));
      return new Response(JSON.stringify({ query: { pages: [{ title: "Modèle:The Ticket Section Savior Guide", missing: true }] } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = await loadStoryPage("Le ticket", "fr");
    expect(calls(fetchMock).map((u) => u.pathname)).toEqual(["/fr/api.php", "/fr/api.php", "/fr/api.php"]); // parse, modèles, photos : tout sur le wiki français
    expect(page.steps.map((s) => s.title)).toEqual(["Escape"]);
  });

  it("page française absente : exists=false mémorisé, aucune autre requête", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: "missingtitle", info: "The page you specified doesn't exist." } })));
    vi.stubGlobal("fetch", fetchMock);
    const page = await loadStoryPage("Flammes bleues", "fr");
    expect(page).toMatchObject({ exists: false, steps: [], pageUrl: "https://escapefromtarkov.fandom.com/fr/wiki/Flammes_bleues" });
    expect(calls(fetchMock)[0].pathname).toBe("/fr/api.php");
    await loadStoryPage("Flammes bleues", "fr");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("erreur du wiki : propagée, rien n'est mis en cache", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(loadStoryPage("Boreas", "en")).rejects.toThrow("HTTP 500");
    expect(Object.keys(localStorage).filter((k) => k.includes("story:"))).toEqual([]);
  });
});
