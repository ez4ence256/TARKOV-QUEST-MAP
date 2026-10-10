// Rapprochement OCR ↔ quêtes, sur des textes d'OCR simulés (l'OCR elle-même n'est pas
// lancée). Noms réels de l'API tarkov.dev (français et anglais).
import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { dominantMap, matchOcrLines, normalizeOcr, numbersOf, similarity } from "./ocrMatch";

const t = (id: string, name: string, nameEn: string): Pick<Task, "id" | "name" | "nameEn"> => ({ id, name, nameEn });
const TASKS = [
  t("sig2", "Signal - Partie 2", "Signal - Part 2"),
  t("sig3", "Signal - Partie 3", "Signal - Part 3"),
  t("sig4", "Signal - Partie 4", "Signal - Part 4"),
  t("chum", "Appâtage", "Chumming"),
  t("fil", "En tête de file", "First in Line"),
  t("hcp2", "Soins privés - Partie 2", "Health Care Privacy - Part 2"),
  t("em2", "Argent facile - Partie 2", "Easy Money - Part 2"),
  t("em2pvp", "Argent facile - Partie 2 [JcJ]", "Easy Money - Part 2 [PVP ZONE]"),
  t("gun1", "Armurier - Partie 1", "Gunsmith - Part 1"),
  t("gun11", "Armurier - Partie 11", "Gunsmith - Part 11"),
  t("tough", "La voie du survivaliste - Dur à cuire", "The Survivalist Path - Tough Guy"),
  t("debut", "Debut", "Debut"),
];
const ids = (ms: { taskId: string }[]) => ms.map((m) => m.taskId);

describe("normalisation", () => {
  it("accents, casse, ponctuation", () => {
    expect(normalizeOcr("Soins privés – Partie 2")).toBe("soins prives partie 2");
    expect(normalizeOcr("  En tête  de file ")).toBe("en tete de file");
    expect(numbersOf("gunsmith part 11")).toEqual(["11"]);
    expect(similarity("signal partie 3", "signal partie 3")).toBe(1);
  });
});

describe("rapprochement des lignes OCR", () => {
  it("reconnaît les noms français et anglais, et ignore le reste de la capture", () => {
    const r = matchOcrLines(
      [
        "TÂCHES",
        "Signal - Partie 3",
        "Le Mécano",
        "Placez le premier brouilleur à l'endroit spécifié",
        "First in Line",
        "Thérapeute",
        "ACCEPTER",
        "Appâtage",
      ],
      TASKS,
    );
    expect(ids(r.recognized)).toEqual(["sig3", "fil", "chum"]);
    expect(r.uncertain).toEqual([]);
    expect(r.unmatched).toEqual(["TÂCHES", "Le Mécano", "Placez le premier brouilleur à l'endroit spécifié", "Thérapeute", "ACCEPTER"]);
  });

  it("tolère le bruit et les petites fautes de l'OCR", () => {
    const r = matchOcrLines(["Signa1 - Partie 3", "Soins prlvés — Partie 2", "Appatage."], TASKS);
    // « Signa1 » : « 1 » lu à la place de « l », collé au mot : ce n'est pas un numéro
    expect(ids(r.recognized)).toEqual(["sig3", "hcp2", "chum"]);
    expect(r.unmatched).toEqual([]);
    expect(numbersOf(normalizeOcr("Signa1 - Partie 3"))).toEqual(["3"]);
  });

  it("les numéros doivent correspondre exactement : Partie 2 n'est jamais Partie 3", () => {
    const r = matchOcrLines(["Signal - Partie 2", "Gunsmith - Part 1"], TASKS);
    expect(ids(r.recognized)).toEqual(["sig2", "gun1"]);
    // un numéro mal lu ne bascule pas vers la quête voisine
    const wrong = matchOcrLines(["Signal - Partie 5", "Gunsmith - Part 111"], TASKS);
    expect(wrong.recognized).toEqual([]);
    expect(wrong.uncertain).toEqual([]);
  });

  it("nom coupé sur deux lignes", () => {
    const r = matchOcrLines(["La voie du survivaliste -", "Dur à cuire", "Soins privés -", "Partie 2"], TASKS);
    expect(ids(r.recognized)).toEqual(["tough", "hcp2"]);
    expect(r.recognized[0].lineIndexes).toEqual([0, 1]);
    expect(r.unmatched).toEqual([]);
  });

  it("[PVP ZONE] / [JcJ] : jamais confondue avec la quête normale", () => {
    expect(ids(matchOcrLines(["Argent facile - Partie 2 [JcJ]"], TASKS).recognized)).toEqual(["em2pvp"]);
    expect(ids(matchOcrLines(["Easy Money - Part 2 [PVP ZONE]"], TASKS).recognized)).toEqual(["em2pvp"]);
    expect(ids(matchOcrLines(["Argent facile - Partie 2"], TASKS).recognized)).toEqual(["em2"]);
  });

  it("ligne qui contient le nom mais beaucoup plus longue : pas reconnue", () => {
    const r = matchOcrLines(["Signal - Partie 3 : placez les brouilleurs sur le littoral"], TASKS);
    expect(r.recognized).toEqual([]);
  });

  it("correspondance approximative : classée « incertaine », jamais cochée d'office", () => {
    const r2 = matchOcrLines(["En tete dc flle"], TASKS);
    expect(ids(r2.uncertain)).toEqual(["fil"]);
    expect(r2.uncertain[0].score).toBeLessThan(0.88);
  });

  it("une quête n'est proposée qu'une fois, et seulement parmi les quêtes fournies (mode actuel)", () => {
    const r = matchOcrLines(["Appâtage", "Chumming"], TASKS);
    expect(ids(r.recognized)).toEqual(["chum"]);
    expect(r.unmatched).toEqual(["Chumming"]);
    expect(matchOcrLines(["Signal - Partie 3"], TASKS.filter((x) => x.id !== "sig3")).recognized).toEqual([]);
  });

  it("rien de reconnu", () => {
    const r = matchOcrLines(["", "Inventaire", "12:45"], TASKS);
    expect(r.recognized).toEqual([]);
    expect(r.uncertain).toEqual([]);
    expect(r.unmatched).toEqual(["Inventaire", "12:45"]);
  });
});

describe("map à afficher après l'import", () => {
  const loc = (mapId: string) => ({ mapId, position: { x: 0, y: 0, z: 0 } });
  const quest = (...maps: string[]) => ({
    objectives: [{ id: "o", type: "mark", description: "", optional: false, mapIds: [], locations: maps.map(loc) }],
  });
  it("la map qui a la majorité des points", () => {
    expect(dominantMap([quest("shoreline", "shoreline"), quest("shoreline", "customs")])).toBe("shoreline");
  });
  it("points répartis sur plusieurs maps, ou aucun point : on ne change pas de map", () => {
    expect(dominantMap([quest("shoreline"), quest("customs")])).toBeNull();
    expect(dominantMap([quest()])).toBeNull();
  });
});
