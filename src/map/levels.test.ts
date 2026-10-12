import { describe, expect, it } from "vitest";
import { BUNDLED_CALIBRATION } from "./calibration";
import {
  displayLevelOf,
  isShownOnLevel,
  mainExtraSvgLayers,
  extentOf,
  isOnLevel,
  isUnderground,
  levelBadge,
  levelName,
  levelOf,
  selectableLevels,
  selectableUpperOf,
  isCellarEntrance,
  upperLevelOf,
} from "./levels";

const customs = BUNDLED_CALIBRATION["customs"];
const shoreline = BUNDLED_CALIBRATION["shoreline"];
const icebreaker = BUNDLED_CALIBRATION["icebreaker"];
const layerIndex = (c: typeof customs, name: string) => c.layers.findIndex((l) => l.name === name);

describe("étages", () => {
  it("lit les étages de maps.json", () => {
    expect(customs.layers.map((l) => l.name)).toContain("2nd Floor");
    expect(customs.layers[layerIndex(customs, "2nd Floor")].svgLayer).toBe("Second_Floor");
    expect(BUNDLED_CALIBRATION["the-labyrinth"].tilePath).toMatch(/assets\.tarkov\.dev/);
  });

  it("Icebreaker : le niveau principal n'est pas listé deux fois", () => {
    expect(icebreaker.mainLevelName).toBe("Infirmary");
    expect(icebreaker.layers.some((l) => l.name === "Infirmary")).toBe(false);
    expect(levelName(icebreaker, levelOf({ x: 0, z: 0, y: 30 }, icebreaker))).toBe("Accommodation (mid)");
    expect(levelOf({ x: 0, z: 0, y: 19 }, icebreaker)).toBeNull();
  });

  it("Douanes : un point au 2e étage des dortoirs n'est pas au niveau principal", () => {
    const dorms2 = { x: 200, z: 150, y: 4 };
    const second = layerIndex(customs, "2nd Floor");
    expect(isOnLevel(dorms2, customs, null)).toBe(false);
    expect(isOnLevel(dorms2, customs, second)).toBe(true);
    expect(levelOf(dorms2, customs)).toBe(second);
    expect(levelName(customs, second)).toBe("2e étage");
  });

  it("Douanes : à la même hauteur hors bâtiment, le point reste au niveau principal", () => {
    expect(levelOf({ x: 0, z: 0, y: 4 }, customs)).toBeNull();
  });

  it("Rivage : étages par hauteur, sous-sol limité à certains bâtiments", () => {
    expect(levelName(shoreline, levelOf({ x: 0, z: 0, y: 0.5 }, shoreline))).toBe("2e étage");
    expect(levelOf({ x: 0, z: 0, y: -3 }, shoreline)).toBeNull();
    expect(levelName(shoreline, levelOf({ x: -180, z: -80, y: -10 }, shoreline))).toBe("Sous-sol");
    expect(levelOf({ x: 300, z: 300, y: -10 }, shoreline)).toBeNull();
  });

  it("une zone (haut/bas) compte pour l'étage qu'elle traverse", () => {
    const zone = { x: 0, z: 0, top: 3, bottom: 1 };
    expect(isOnLevel(zone, shoreline, layerIndex(shoreline, "2nd Floor"))).toBe(true);
  });

  it("un point sans hauteur est visible à tous les niveaux", () => {
    expect(isOnLevel({ x: 200, z: 150 }, customs, null)).toBe(true);
    expect(isOnLevel({ x: 200, z: 150 }, customs, 0)).toBe(true);
  });
});

describe("Interchange : le mall est surélevé", () => {
  const interchange = BUNDLED_CALIBRATION["interchange"];
  it("un point du rez-de-chaussée du mall (28 m) n'est pas dit « 2e étage »", () => {
    const mall = { x: 0, z: 0, y: 28.2 };
    expect(levelName(interchange, levelOf(mall, interchange))).toBe("Niveau principal du centre commercial");
    expect(levelBadge(interchange, upperLevelOf(mall, interchange)!)).toBe(""); // pas de numéro
    expect(levelName(interchange, levelOf({ x: 0, z: 0, y: 37 }, interchange))).toBe("2e étage du centre commercial");
  });
  it("hors du mall, à la même hauteur : niveau principal (les zones x/z comptent)", () => {
    expect(levelOf({ x: 300, z: 300, y: 28.2 }, interchange)).toBeNull();
  });
  it("sélecteur : principal + 2e étage du mall (Douanes inchangé) ; le rez-de-chaussée du mall est dessiné sur le principal", () => {
    const names = (c: typeof customs) => selectableLevels(c).map((l) => levelName(c, l));
    expect(names(interchange)).toEqual(["Niveau principal", "2e étage du centre commercial", "Sous-sol (parking)"]);
    expect(names(customs)).toEqual(["Niveau principal", "Sous-sol"]);
    expect(mainExtraSvgLayers(interchange)).toEqual(["First_Floor"]);
    expect(mainExtraSvgLayers(customs)).toEqual([]);
  });
  it("un point du rez-de-chaussée du mall reste sur le niveau principal, pas sur le 2e étage du mall", () => {
    const mall = { x: 0, z: 0, y: 28.2 };
    const upper = selectableLevels(interchange)[1] as number;
    expect(isShownOnLevel(mall, interchange, null)).toBe(true);
    expect(isShownOnLevel(mall, interchange, upper)).toBe(false);
    expect(isShownOnLevel({ x: 0, z: 0, y: 37 }, interchange, upper)).toBe(true);
    expect(isShownOnLevel({ x: 0, z: 0, y: 37 }, interchange, null)).toBe(false); // 2e étage du mall : grisé au principal (comme le sous-sol)
    expect(isShownOnLevel(mall, interchange, null)).toBe(true); // rez-de-chaussée du mall : plein au principal
    expect(selectableUpperOf({ x: 0, z: 0, y: 37 }, interchange)).toBe(upper);
    // autres maps : les étages supérieurs hors sélecteur restent pleins au principal
    expect(isShownOnLevel({ x: 200, z: 150, y: 4 }, customs, null)).toBe(true);
  });
  it("pas d'entrée de cave sur Labs (map sans fond de plein air)", () => {
    expect(isCellarEntrance({ x: 0, z: 0 }, BUNDLED_CALIBRATION["the-lab"])).toBe(false);
  });
});

describe("étages supérieurs et souterrains", () => {
  const selectableNames = (key: string) => {
    const c = BUNDLED_CALIBRATION[key];
    return selectableLevels(c)
      .filter((l): l is number => l !== null)
      .map((l) => c.layers[l].name);
  };

  it("seuls les souterrains vont dans le sélecteur", () => {
    expect(selectableNames("customs")).toEqual(["Underground"]);
    expect(selectableNames("shoreline")).toEqual(["Underground"]);
    expect(selectableNames("streets-of-tarkov")).toEqual(["Underground"]);
    expect(selectableNames("factory")).toEqual(["Tunnels"]);
    expect(selectableNames("ground-zero")).toEqual(["Garage"]);
    expect(selectableNames("the-lab")).toEqual(["Technical"]);
    expect(selectableNames("reserve")).toEqual(["Bunkers"]);
    expect(selectableNames("interchange")).toEqual(["3rd Floor", "Parking basement"]); // seul cas d'étage supérieur dans le sélecteur (+ mall dessiné sur le principal)
  });

  it("la règle par hauteur s'accorde avec les noms des étages (hors Icebreaker)", () => {
    const undergroundName = /underground|garage|tunnel|technical|bunker|basement/i;
    for (const [key, c] of Object.entries(BUNDLED_CALIBRATION)) {
      if (c.key === "icebreaker") continue;
      for (const layer of c.layers) {
        expect(isUnderground(c, layer), `${key} / ${layer.name}`).toBe(undergroundName.test(layer.name));
      }
    }
  });

  it("Icebreaker garde tous ses ponts dans le sélecteur", () => {
    expect(selectableLevels(icebreaker)).toHaveLength(icebreaker.layers.length + 1);
    // les ponts inférieurs sont bien sous l'Infirmary (tolérance 18,93 / 18,92)
    const storage = icebreaker.layers.find((l) => l.name === "Storage/Security")!;
    const helipad = icebreaker.layers.find((l) => l.name === "Helipad")!;
    expect(isUnderground(icebreaker, storage)).toBe(true);
    expect(isUnderground(icebreaker, helipad)).toBe(false);
  });

  it("un point d'étage supérieur s'affiche sur la carte de base, avec son étage", () => {
    const dorms2 = { x: 200, z: 150, y: 4 };
    const second = layerIndex(customs, "2nd Floor");
    expect(displayLevelOf(dorms2, customs)).toBeNull();
    expect(upperLevelOf(dorms2, customs)).toBe(second);
    expect(levelBadge(customs, second)).toBe("2");
    expect(extentOf(dorms2, customs.layers[second])).toEqual([2.7, 6.5]);
  });

  it("un point souterrain reste sur sa couche", () => {
    const basement = { x: -180, z: -80, y: -10 };
    const underground = layerIndex(shoreline, "Underground");
    expect(displayLevelOf(basement, shoreline)).toBe(underground);
    expect(upperLevelOf(basement, shoreline)).toBeNull();
  });

  it("un point du niveau principal n'a pas d'étage supérieur", () => {
    expect(upperLevelOf({ x: 0, z: 0, y: -3 }, shoreline)).toBeNull();
    expect(upperLevelOf({ x: 0, z: 0 }, customs)).toBeNull();
  });

  it("numéros d'étage pour l'icône", () => {
    const labs = BUNDLED_CALIBRATION["the-lab"];
    expect(levelBadge(labs, layerIndex(labs, "Second Level"))).toBe("2");
    expect(levelBadge(customs, layerIndex(customs, "4th Floor"))).toBe("4");
    expect(levelBadge(shoreline, layerIndex(shoreline, "3rd Floor"))).toBe("3");
  });
});
