// Liste des objets du finder : lecture des fichiers de traductions de json.tarkov.dev.
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHideout, loadItemList, parseItemList } from "./itemList";

const A = "5734758f24597738025ee253";
const CAT = "5447b5f14bdc2d61278b4567";
const en = { [`${A} Name`]: "Golden neck chain", [`${A} ShortName`]: "GNC", [`${CAT} Name`]: "Assault rifle", "unrelated key": "x" };
const fr = { [`${A} Name`]: "Collier en or", [`${A} ShortName`]: "Collier" };

describe("parseItemList", () => {
  it("ne garde que les objets (clé ShortName), pas les catégories", () => {
    const list = parseItemList(fr, en, "fr");
    expect(list).toEqual([{ id: A, name: "Collier en or", alts: ["Collier en or", "Collier", "Golden neck chain", "GNC"], nameEn: "Golden neck chain" }]);
  });
  it("langue absente : repli sur l'anglais", () => {
    expect(parseItemList({}, en, "fr")[0].name).toBe("Golden neck chain");
  });
});

describe("chargement", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (files: Record<string, unknown>) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const path = url.replace("https://json.tarkov.dev/", "");
      calls.push(path);
      return path in files ? { ok: true, json: async () => files[path] } : { ok: false, status: 404 };
    });
    return calls;
  };
  it("liste : seulement les deux fichiers de traductions, jamais le fichier principal (17 Mo)", async () => {
    const calls = stub({ "pve/items_fr": { data: fr }, "pve/items_en": { data: en } });
    const list = await loadItemList("pve", "fr");
    expect(list.map((i) => i.id)).toEqual([A]);
    expect(calls.sort()).toEqual(["pve/items_en", "pve/items_fr"]);
    await loadItemList("pve", "fr"); // gardé en mémoire
    expect(calls).toHaveLength(2);
  });
  it("hideout : stations nommées, usages indexés", async () => {
    stub({
      "pve/hideout": { data: { s1: { id: "s1", name: "hideout_area_3_name", levels: [{ level: 4, itemRequirements: [{ item: A, count: 10 }] }] } } },
      "pve/hideout_fr": { data: { hideout_area_3_name: "Générateur" } },
      "pve/hideout_en": { data: { hideout_area_3_name: "Generator" } },
    });
    const h = await loadHideout("pve", "fr");
    expect(h.stationName.s1).toBe("Générateur");
    expect(h.uses.get(A)).toEqual([{ stationId: "s1", level: 4, count: 10, fir: false }]);
  });
});
