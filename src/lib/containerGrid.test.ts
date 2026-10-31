import { describe, expect, it } from "vitest";
import { agreed, BORDER, buildShortIndex, cellStrip, detectGrid, iconScores, matchShort, matchStrip, nameStrip, narrowByIcon, profilePeriod, stripScale, unreadCells, type Found, type Grid, type StripWord } from "./containerGrid";
import { P } from "./itemImage";

const items = [
  { id: "vase", shorts: ["Vase"] },
  { id: "flash", shorts: ["Flash drive"] },
  { id: "duct", shorts: ["Duct tape"] },
  { id: "vpx", shorts: ["VPX"] },
  { id: "gpx", shorts: ["GPX"] },
  { id: "mb", shorts: ["MB"] },
  { id: "or", shorts: ["OR"] },
  { id: "hdd", shorts: ["HDD"] },
  { id: "skull1", shorts: ["Skull"] },
  { id: "skull2", shorts: ["Skull"] },
  { id: "sailor", shorts: ["Sailor"] },
];
const index = buildShortIndex(items);

describe("matchShort", () => {
  it("exact, sans la lettre de bord, nom coupé, lettres confondues par l'OCR", () => {
    expect(matchShort("vase", index)).toEqual({ ids: ["vase"], how: "exact" });
    expect(matchShort("VPXI", index)?.ids).toEqual(["vpx"]);
    expect(matchShort("Flash driv", index)).toEqual({ ids: ["flash"], how: "prefix" });
    expect(matchShort("Quctitape", index)).toEqual({ ids: ["duct"], how: "fuzzy" });
    expect(matchShort("SAVIORX", index)).toBeNull(); // plaque d'un joueur, le « _ » perdu
  });
  it("nom partagé : tous les objets possibles", () => expect(matchShort("Skull", index)?.ids).toEqual(["skull1", "skull2"]));
  it("noms courts : jamais à peu près (VPX / GPX)", () => {
    expect(matchShort("VPY", index)).toBeNull();
    expect(matchShort("GPX", index)?.ids).toEqual(["gpx"]);
  });
  it("3 majuscules : D lu comme O", () => {
    expect(matchShort("-HDO", index)?.ids).toEqual(["hdd"]);
    expect(matchShort("Hdo", index)).toBeNull();
    expect(matchShort("MBO", buildShortIndex([{ id: "m80", shorts: ["M80"] }]))?.ids).toEqual(["m80"]);
  });
  it("début mal lu, fin du nom juste", () => {
    const btc = buildShortIndex([{ id: "btc", shorts: ["0.2BTC"] }, { id: "gpu", shorts: ["GPU"] }]);
    expect(matchShort("..7e28TC", btc)?.ids).toEqual(["btc"]);
    expect(matchShort("9128TC", btc)?.ids).toEqual(["btc"]);
    expect(matchShort("e2erc", btc)).toBeNull();
  });
  it("3 lettres : J lu comme I, g comme e", () => {
    const three = buildShortIndex([{ id: "fmj", shorts: ["FMJ"] }, { id: "egg", shorts: ["Egg"] }]);
    expect(matchShort("FMI", three)?.ids).toEqual(["fmj"]);
    expect(matchShort("Ege", three)?.ids).toEqual(["egg"]);
  });
  it("0 lu à la place de O", () => {
    const h2o2 = buildShortIndex([{ id: "h2o2", shorts: ["H2O2"] }, { id: "tea", shorts: ["42"] }]);
    expect(matchShort("H202", h2o2)?.ids).toEqual(["h2o2"]);
    expect(matchShort("42", h2o2)?.ids).toEqual(["tea"]);
  });
});

describe("matchStrip", () => {
  const grid: Grid = { pitch: 63, ox: 5, oy: 25 };
  const s = stripScale(grid);
  // mot dont le bord droit est à `right` px de la capture (calé au bord droit de la case, comme dans le jeu)
  const word = (text: string, right: number, width = 30, confidence = 80): StripWord => ({ text, confidence, x0: BORDER + (right - width) * s, x1: BORDER + right * s });
  const cellRight = (col: number) => grid.ox + (col + 1) * grid.pitch - 3;

  it("colonne de la case en haut à droite, même si le bord de case allonge le mot", () => {
    const found = matchStrip([word("Vase", cellRight(2)), word("VPXI", cellRight(5) + 5, 20)], grid, 4, index);
    expect(found.map((f) => [f.text, f.row, f.col])).toEqual([["Vase", 4, 2], ["VPXI", 4, 5]]);
  });
  it("deux mots proches font un nom ; deux noms voisins collés sont repris un par un", () => {
    const flash = [word("Flash", cellRight(3) - 22, 25), word("driv", cellRight(3), 18)];
    expect(matchStrip(flash, grid, 0, index).map((f) => f.ids)).toEqual([["flash"]]);
    const glued = [word("Vase", cellRight(1)), word("Skull", cellRight(2) - 0, 28)];
    glued[1].x0 = glued[0].x1 + 2 * s;
    expect(matchStrip(glued, grid, 0, index).map((f) => f.ids[0])).toEqual(["vase", "skull1"]);
    // mot d'une lettre : collé à son voisin, sinon « scdr. » seul serait un autre tournevis
    const scdr = buildShortIndex([{ id: "flat", shorts: ["F scdr."] }, { id: "scdr", shorts: ["Scdr."] }]);
    expect(matchStrip([word("F", cellRight(0) - 30, 7), word("scdr.", cellRight(0), 25)], grid, 0, scdr).map((f) => f.ids)).toEqual([["flat"]]);
  });
  it("noms de 2-3 lettres : calés au bord, mêmes majuscules, et pas de nom de joueur", () => {
    expect(matchStrip([word("MB", cellRight(6), 12)], grid, 0, index)).toHaveLength(1);
    expect(matchStrip([word("MB", cellRight(6) - 25, 12)], grid, 0, index)).toHaveLength(0); // au milieu de la case : bout d'icône
    expect(matchStrip([word("Or", cellRight(1), 12)], grid, 0, index)).toHaveLength(0); // « OR » est un autre objet
    expect(matchStrip([word("SAVIOR_X", cellRight(1), 45)], grid, 0, index)).toHaveLength(0);
    expect(matchStrip([word("_Vase", cellRight(1), 40)], grid, 0, index)).toHaveLength(1); // reste du bord de case
  });
});

describe("grille", () => {
  it("période : la case (63), pas son double", () => {
    const profile = new Float32Array(900).map((_, i) => (i % 63 === 5 ? 100 : i % 126 === 68 ? 30 : 1));
    expect(profilePeriod(profile)).toBe(63);
  });
  it("cases dessinées : pas et décalage", () => {
    const width = 300;
    const height = 250;
    const data = new Uint8ClampedArray(width * height * 4).fill(40);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) if ((x - 7) % 63 === 0 || (y - 20) % 63 === 0) data.fill(200, (y * width + x) * 4, (y * width + x) * 4 + 3);
    expect(detectGrid({ width, height, data })?.pitch).toBeCloseTo(63, 0);
  });
  it("capture qui commence sur un bord de case ; objets de 2 cases de large partout (pas de trait vertical intérieur)", () => {
    const width = 380;
    const height = 320;
    const data = new Uint8ClampedArray(width * height * 4).fill(40);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) if (x % 126 === 0 || y % 63 === 0) data.fill(200, (y * width + x) * 4, (y * width + x) * 4 + 3);
    const g = detectGrid({ width, height, data })!;
    expect(g.pitch).toBeCloseTo(63, 0);
    expect(Math.abs(g.ox)).toBeLessThan(1.5);
    expect(Math.abs(g.oy)).toBeLessThan(1.5);
  });
  it("traits pâles sous des noms très contrastés : la grille suit les traits, pas les lettres", () => {
    const width = 400;
    const height = 400;
    const data = new Uint8ClampedArray(width * height * 4).fill(40);
    const set = (x: number, y: number, v: number) => data.fill(v, (y * width + x) * 4, (y * width + x) * 4 + 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if ((x - 7) % 56 === 0 || (y - 20) % 56 === 0) set(x, y, 60);
        // « lettres » : barres claires de 2 px, 9 px sous le trait, sur la moitié droite de chaque case
        const cy = (y - 20 + 56) % 56;
        if ((cy === 9 || cy === 10 || cy === 16 || cy === 17) && (x - 7 + 56) % 56 > 25 && (x - 7 + 56) % 56 < 52 && x % 3 !== 0) set(x, y, 230);
      }
    const g = detectGrid({ width, height, data })!;
    expect(g.pitch).toBeCloseTo(56, 0);
    const d = (((g.oy - 20) % 56) + 56) % 56;
    expect(Math.min(d, 56 - d)).toBeLessThan(1.5);
  });
});

describe("bande du nom", () => {
  // une rangée de 3 cases de 63 px, fond sombre, trait clair en haut (bord de case) et une « lettre » claire
  // dans la moitié droite de la case 1
  const grid: Grid = { pitch: 63, ox: 0, oy: 0 };
  const width = 189;
  const height = 63;
  const data = new Uint8ClampedArray(width * height * 4).fill(30);
  const paint = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(220, (y * width + x) * 4, (y * width + x) * 4 + 3);
  };
  paint(0, width, 1, 3);
  paint(110, 113, 4, 12);
  const strip = nameStrip({ width, height, data }, grid, 0);
  const black = (x0: number, x1: number) => {
    let n = 0;
    for (let y = 0; y < strip.height; y++) for (let x = x0; x < x1; x++) if (strip.data[(y * strip.width + x) * 4] === 0) n++;
    return n;
  };

  it("le bord de case est effacé, la lettre reste", () => {
    const s = stripScale(grid);
    expect(black(BORDER, BORDER + 100 * s)).toBe(0);
    expect(black(BORDER + 105 * s, BORDER + 120 * s)).toBeGreaterThan(0);
  });
  it("case sans nom reconnu mais avec des lettres : relue seule, à sa place", () => {
    expect(unreadCells(strip, grid, [])).toEqual([1]);
    expect(unreadCells(strip, grid, [{ col: 1 }])).toEqual([]);
    const { img, shift } = cellStrip(strip, grid, 1);
    expect(img.height).toBe(strip.height);
    expect(shift).toBe(Math.round(63 * stripScale(grid)));
  });
});

describe("noms partagés et noms de 2 lettres", () => {
  it("l'image départage, objet tourné compris", () => {
    // capture 3x1 : moitié gauche rouge, reste bleu ; référence 1x3 (même objet debout) et 3x1 toute bleue
    const pitch = 20;
    const img = { width: 3 * pitch, height: pitch, data: new Uint8ClampedArray(3 * pitch * pitch * 4) };
    for (let y = 0; y < pitch; y++) for (let x = 0; x < 3 * pitch; x++) img.data.set(x < pitch ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 3 * pitch + x) * 4);
    const thumb = (w: number, h: number, at: (x: number, y: number) => number[]) => ({ w, h, d: Uint8Array.from({ length: w * h * 3 }, (_, k) => at(Math.floor(k / 3) % w, Math.floor(k / 3 / w))[k % 3]) });
    const standing = thumb(P, 3 * P, (_, y) => (y >= 2 * P ? [255, 0, 0] : [0, 0, 255])); // tourné : la gauche rouge en bas
    const blue = thumb(3 * P, P, () => [0, 0, 255]);
    const small = thumb(P, P, () => [255, 0, 0]);
    const scores = iconScores(img, { pitch, ox: 0, oy: 0 }, 0, { col: 2, w: 3, h: 1 }, [{ id: "blue", thumb: blue }, { id: "cat", thumb: standing }, { id: "small", thumb: small }]);
    expect(scores[0]).toMatchObject({ id: "cat", score: 0, size: true });
    expect(narrowByIcon(["blue", "cat", "small", "noimage"], scores)).toEqual(["cat", "noimage"]);
  });
  it("2 lettres mal assurées : gardées si deux lectures concordent", () => {
    const ec = (row: number, col: number, text = "EC"): Found => ({ row, col, text, ids: ["ec"], how: "exact", weak: true });
    expect(agreed([ec(0, 4), ec(0, 4, "EC")], [])).toHaveLength(1);
    expect(agreed([ec(0, 4), ec(1, 4)], [])).toHaveLength(0);
    expect(agreed([ec(0, 4), ec(0, 4)], [{ ...ec(0, 4, "Vase"), weak: undefined }])).toHaveLength(0);
  });
});
