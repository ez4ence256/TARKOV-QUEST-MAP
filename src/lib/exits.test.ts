// Sorties : classement, fusion, et placement de sorties réelles (positions de l'API
// tarkov.dev relevées en octobre 2026) sur le calibrage et les étages de l'app.
import { describe, expect, it } from "vitest";
import type { MapExit } from "../types";
import { BUNDLED_CALIBRATION } from "../map/calibration";
import { isInBounds } from "../map/crs";
import { displayLevelOf, isCellarEntrance, levelName, upperLevelOf } from "../map/levels";
import { exitIconKind, factionLabel, factionsOf, isCoopName, exitsNearMap, mergeExits, visibleExits } from "./exits";
import { escapeHtml } from "../map/exitIcons";

describe("nom affiché sur la carte", () => {
  it("le nom venant des données est échappé avant d'aller dans le HTML du marqueur", () => {
    expect(escapeHtml(`Smugglers' Path <b>"x"</b> & co`)).toBe("Smugglers&#39; Path &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; co");
  });
});

const exit = (nameEn: string, x: number, y: number, z: number, extra: Partial<MapExit> = {}): MapExit => ({
  id: nameEn,
  kind: isCoopName(nameEn) ? "coop" : "extract",
  name: nameEn,
  nameEn,
  factions: [],
  position: { x, y, z },
  ...extra,
});

describe("classement des sorties", () => {
  it("coop : seulement si le nom anglais contient « (Co-op) »", () => {
    expect(isCoopName("Boiler Room Basement (Co-op)")).toBe(true);
    expect(isCoopName("Scav Camp (Co-Op)")).toBe(true);
    // sortie partagée PMC + Scav mais pas coop
    expect(isCoopName("Armored Train")).toBe(false);
    expect(isCoopName("Cooperative Store")).toBe(false);
  });

  it("factions de l'API", () => {
    expect(factionsOf("pmc")).toEqual(["pmc"]);
    expect(factionsOf("shared")).toEqual(["pmc", "scav"]);
    expect(factionsOf(undefined)).toEqual([]);
    expect(factionLabel(["pmc", "scav"])).toBe("PMC et Scav");
    expect(factionLabel([])).toBe("non précisée par les données");
  });

  it("fusionne les doublons PMC/Scav au même endroit, pas les sorties homonymes éloignées", () => {
    const merged = mergeExits([
      exit("Crossroads", -336.33, 2.19, -86.39, { factions: ["pmc"] }),
      exit("Crossroads", -336.18, 2.19, -86.27, { factions: ["scav"] }),
      exit("Road to Customs", -859.05, -42.07, 0.49, { factions: ["scav"] }),
      exit("Road to Customs", 100, 0, 100, { factions: ["pmc"] }),
    ]);
    expect(merged.map((e) => [e.nameEn, e.factions])).toEqual([
      ["Crossroads", ["pmc", "scav"]],
      ["Road to Customs", ["scav"]],
      ["Road to Customs", ["pmc"]],
    ]);
  });

  it("un transit n'est jamais fusionné avec une sortie", () => {
    const merged = mergeExits([
      exit("Transit to Shoreline", 20, 0, 139, { kind: "transit" }),
      exit("Transit to Shoreline", 20, 0, 139, { kind: "extract" }),
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("icône d'une sortie", () => {
  const kindOf = (kind: MapExit["kind"], factions: MapExit["factions"]) => exitIconKind({ kind, factions });
  it("PMC seul, Scav seul, commune", () => {
    expect(kindOf("extract", ["pmc"])).toBe("pmc");
    expect(kindOf("extract", ["scav"])).toBe("scav");
    expect(kindOf("extract", factionsOf("shared"))).toBe("shared");
  });
  it("doublon PMC + Scav fusionné : commune", () => {
    const [m] = mergeExits([exit("A", 0, 0, 0, { factions: ["pmc"] }), exit("A", 1, 0, 1, { factions: ["scav"] })]);
    expect(kindOf(m.kind, m.factions)).toBe("shared");
  });
  it("faction inconnue : icône générique", () => {
    expect(kindOf("extract", [])).toBe("extract");
    expect(kindOf("extract", factionsOf("autre"))).toBe("extract");
  });
  it("coop et transit priment sur la faction", () => {
    expect(kindOf("coop", ["pmc", "scav"])).toBe("coop");
    expect(kindOf("coop", ["scav"])).toBe("coop");
    expect(kindOf("transit", ["pmc"])).toBe("transit");
  });
});

describe("case « Extracts Scav »", () => {
  const all = [
    exit("Scav", 0, 0, 0, { factions: ["scav"] }),
    exit("Shared", 0, 0, 1, { factions: ["pmc", "scav"] }),
    exit("Pmc", 0, 0, 2, { factions: ["pmc"] }),
    exit("Coop", 0, 0, 3, { kind: "coop", factions: ["scav"] }),
    exit("Transit", 0, 0, 4, { kind: "transit" }),
    exit("None", 0, 0, 5, { factions: [] }),
  ];
  it("cochée : tout reste", () => expect(visibleExits(all, true)).toHaveLength(6));
  it("décochée : seules les sorties Scav seules disparaissent", () => {
    expect(visibleExits(all, false).map((e) => e.nameEn)).toEqual(["Shared", "Pmc", "Coop", "Transit", "None"]);
  });
});

describe("placement de sorties réelles (calibrage et étages)", () => {
  const customs = BUNDLED_CALIBRATION["customs"];
  const labs = BUNDLED_CALIBRATION["the-lab"];
  const shoreline = BUNDLED_CALIBRATION["shoreline"];
  const pos = (e: MapExit) => ({ ...e.position, top: e.top, bottom: e.bottom });

  it("Douanes : les sorties tombent dans l'emprise de la carte", () => {
    for (const e of [
      exit("Crossroads", -336.33, 2.19, -86.39),
      exit("ZB-1011", 621.5, -2.07, -126.48),
      exit("RUAF Roadblock", -10.25, 1.92, -138.45),
      exit("Smugglers' Boat", -41.51, -12.63, 122.67),
    ]) {
      expect(isInBounds(customs.bounds, e.position), e.nameEn).toBe(true);
    }
  });

  it("Douanes : la sortie coop du sous-sol de la chaufferie n'apparaît qu'au sous-sol", () => {
    const boiler = exit("Boiler Room Basement (Co-op)", 106.97, -4.71, -43.62, { top: -3.36, bottom: -6.06 });
    const level = displayLevelOf(pos(boiler), customs);
    expect(level).not.toBeNull();
    expect(levelName(customs, level)).toBe("Sous-sol");
    // sous un bâtiment à étages (zone « boiler ») : pas d'entrée de cave, jamais sur le niveau principal
    expect(isCellarEntrance(boiler.position, customs)).toBe(false);
    // une sortie en surface reste sur le niveau principal
    expect(displayLevelOf(pos(exit("Crossroads", -336.33, 2.19, -86.39, { top: 5.06, bottom: -0.68 })), customs)).toBeNull();
  });

  it("Labs : ascenseur du bloc médical au niveau technique, monte-charge au 2e niveau (carte de base)", () => {
    const medical = exit("Medical Block Elevator", -112.3, -3.11, -344.04, { top: -1.61, bottom: -4.61 });
    expect(levelName(labs, displayLevelOf(pos(medical), labs))).toBe("Niveau technique");
    const cargo = exit("Cargo Elevator", -111.79, 5.38, -408.55, { top: 6.88, bottom: 3.88 });
    expect(displayLevelOf(pos(cargo), labs)).toBeNull(); // sur la carte de base…
    expect(levelName(labs, upperLevelOf(pos(cargo), labs))).toBe("2e niveau"); // …avec l'étage indiqué
    expect(isInBounds(labs.bounds, medical.position)).toBe(true);
    expect(isInBounds(labs.bounds, cargo.position)).toBe(true);
  });

  it("Littoral : la sortie du sous-sol de l'administration n'apparaît qu'au sous-sol", () => {
    const admin = exit("Admin Basement", -256.87, -7.71, -149.78, { top: -5.95, bottom: -9.46 });
    expect(levelName(shoreline, displayLevelOf(pos(admin), shoreline))).toBe("Sous-sol");
    expect(isInBounds(shoreline.bounds, admin.position)).toBe(true);
  });
});

describe("cas rapportés (données tarkov.dev d'octobre 2026)", () => {
  it("Douanes : ZB-1011 (ligne PMC + ligne Scav au nom français différent) est une seule sortie, au sous-sol", () => {
    const merged = mergeExits([
      exit("ZB-1011", 621.5, -2.07, -126.48, { factions: ["pmc"], top: 0.11, bottom: -4.25 }),
      exit("ZB-1011", 625.57, -2.72, -127.71, { factions: ["scav"], top: -0.31, bottom: -5.13 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].factions).toEqual(["pmc", "scav"]);
    const customs = BUNDLED_CALIBRATION["customs"];
    const p = { ...merged[0].position, top: merged[0].top, bottom: merged[0].bottom };
    expect(levelName(customs, displayLevelOf(p, customs))).toBe("Sous-sol");
    // simple entrée de cave, rien au-dessus : aussi sur le niveau principal (avec le badge « sous-sol »)
    expect(isCellarEntrance(p, customs)).toBe(true);
    expect(isCellarEntrance({ x: 625.57, z: -127.71 }, customs)).toBe(true);
  });

  it("Point zéro : « Barrage ONU » et « Bunker scav » (à plus d'une largeur de map) sont écartés, Pinewood au bord reste", () => {
    const gz = BUNDLED_CALIBRATION["ground-zero"];
    const exits = [
      exit("UN Roadblock", -527.87, 1.68, 288.23),
      exit("Scav Bunker", 220.43, 20.54, -705.8),
      exit("Pinewood Basement (Co-Op)", -113.71, -2.93, 65.63),
      exit("Mira Ave (Flare)", 218.23, 17.99, -38.51),
    ];
    expect(exits.filter((e) => !isInBounds(gz.bounds, e.position)).map((e) => e.nameEn)).toContain("UN Roadblock");
    expect(exitsNearMap(exits, gz.bounds).map((e) => e.nameEn)).toEqual(["Pinewood Basement (Co-Op)", "Mira Ave (Flare)"]);
    expect(exitsNearMap(exits, undefined)).toHaveLength(4);
  });
});
