import { describe, expect, it } from "vitest";
import { downscaleSize, isLocalOrigin, mergeOcrResults, normalizeOrigin, phoneCodeFromSearch, phoneUrl } from "./phoneCapture";
import type { OcrMatch, OcrMatchResult } from "./ocrMatch";

const m = (taskId: string, score: number, text = taskId): OcrMatch => ({ taskId, score, text, lineIndexes: [0] });
const res = (recognized: OcrMatch[], uncertain: OcrMatch[] = [], unmatched: string[] = []): OcrMatchResult => ({ recognized, uncertain, unmatched });

describe("phoneCodeFromSearch", () => {
  it("accepte 24 caractères alphanumériques seulement", () => {
    const code = "AbCdEfGh1234567890abcdEF";
    expect(phoneCodeFromSearch(`?phone=${code}`)).toBe(code);
    expect(phoneCodeFromSearch(`?x=1&phone=${code}`)).toBe(code);
    expect(phoneCodeFromSearch("?phone=court")).toBeNull();
    expect(phoneCodeFromSearch(`?phone=${code}0`)).toBeNull();
    expect(phoneCodeFromSearch("?phone=AbCdEfGh1234567890abcd-_")).toBeNull();
    expect(phoneCodeFromSearch("")).toBeNull();
  });
});

describe("downscaleSize", () => {
  it("réduit le plus grand côté à 1600 en gardant les proportions", () => {
    expect(downscaleSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(downscaleSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it("n'agrandit jamais", () => {
    expect(downscaleSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(downscaleSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
  it("reste au moins à 1 pixel", () => {
    expect(downscaleSize(100000, 10)).toEqual({ width: 1600, height: 1 });
  });
});

describe("adresse du PC", () => {
  it("détecte localhost", () => {
    for (const o of ["http://localhost:5174", "http://127.0.0.1:5174", "http://[::1]:5174", "http://app.localhost"]) expect(isLocalOrigin(o)).toBe(true);
    expect(isLocalOrigin("http://192.168.1.20:5174")).toBe(false);
    expect(isLocalOrigin("https://exemple.fr")).toBe(false);
  });
  it("normalise la saisie", () => {
    expect(normalizeOrigin("192.168.1.20:5174")).toBe("http://192.168.1.20:5174");
    expect(normalizeOrigin(" http://192.168.1.20:5174/abc?x=1 ")).toBe("http://192.168.1.20:5174");
    expect(normalizeOrigin("https://pc.local")).toBe("https://pc.local");
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("http://")).toBeNull();
  });
  it("construit l'adresse du QR", () => {
    expect(phoneUrl("http://192.168.1.20:5174", "ABC")).toBe("http://192.168.1.20:5174/?phone=ABC");
  });
});

describe("mergeOcrResults", () => {
  it("une seule photo : résultat inchangé", () => {
    const r = res([m("a", 0.95)]);
    expect(mergeOcrResults([r])).toBe(r);
  });
  it("dédoublonne par quête en gardant le meilleur score", () => {
    const out = mergeOcrResults([res([m("a", 0.9, "vieux")], [m("b", 0.75)]), res([m("a", 0.97, "net")], [], ["bruit"])]);
    expect(out.recognized).toEqual([m("a", 0.97, "net")]);
    expect(out.uncertain).toEqual([m("b", 0.75)]);
    expect(out.unmatched).toEqual(["bruit"]);
  });
  it("reclasse : une quête incertaine puis nette devient reconnue", () => {
    const out = mergeOcrResults([res([], [m("a", 0.8)]), res([m("a", 0.92)])]);
    expect(out.recognized.map((x) => x.taskId)).toEqual(["a"]);
    expect(out.uncertain).toEqual([]);
  });
  it("garde les quêtes de photos différentes", () => {
    const out = mergeOcrResults([res([m("a", 0.9)]), res([m("b", 0.9)])]);
    expect(out.recognized.map((x) => x.taskId)).toEqual(["a", "b"]);
  });
});
