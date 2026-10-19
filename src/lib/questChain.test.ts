import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { branchFailures, isGreyed, prerequisiteChanges } from "./questChain";

const mk = (id: string, reqs: [string, string[]][] = [], failedBy?: string[]): Task => ({
  id,
  name: id,
  nameEn: id,
  normalizedName: id,
  traderId: "t",
  mapId: null,
  minPlayerLevel: null,
  kappaRequired: false,
  wikiLink: null,
  objectives: [{ id: `${id}-o`, type: "mark", description: "", optional: false, mapIds: [], locations: [] }],
  details: { taskRequirements: reqs.map(([taskId, status]) => ({ taskId, status })), traderRequirements: [], neededKeys: [], rewards: null, failConditions: [], restartable: false, lightkeeperRequired: false },
  ...(failedBy ? { failedBy } : {}),
});
const sorted = (r: { complete: string[]; failed: string[] }) => ({ complete: [...r.complete].sort(), failed: [...r.failed].sort() });

describe("isGreyed", () => {
  it("terminée ou échouée", () => {
    const a = mk("a");
    expect(isGreyed(a, {}, {})).toBe(false);
    expect(isGreyed(a, { "a-o": 1 }, {})).toBe(true);
    expect(isGreyed(a, {}, { a: true })).toBe(true);
  });
});

describe("prerequisiteChanges", () => {
  it("chaîne A <- B <- C : tout est terminé", () => {
    const tasks = [mk("a"), mk("b", [["a", ["complete"]]]), mk("c", [["b", ["complete"]]])];
    expect(sorted(prerequisiteChanges("c", tasks, {}, {}))).toEqual({ complete: ["a", "b"], failed: [] });
    expect(sorted(prerequisiteChanges("c", tasks, { "a-o": 1 }, {}))).toEqual({ complete: ["b"], failed: [] });
  });
  it("prérequis « active » : non grisé, mais ses propres prérequis le sont (Out of Curiosity <- Chemical 4)", () => {
    const tasks = [mk("c3"), mk("c4", [["c3", ["complete"]]], ["curiosity", "big"]), mk("curiosity", [["c4", ["active"]]], ["c4"]), mk("big", [["c4", ["active", "complete"]]])];
    expect(sorted(prerequisiteChanges("curiosity", tasks, {}, {}))).toEqual({ complete: ["c3"], failed: [] });
    expect(sorted(prerequisiteChanges("big", tasks, {}, {}))).toEqual({ complete: ["c3"], failed: [] });
  });
  it("prérequis « failed » : échouée (Loyalty Buyout <- Chemical 4)", () => {
    const tasks = [mk("c3"), mk("c4", [["c3", ["complete"]]]), mk("loyalty", [["c4", ["failed"]]])];
    expect(sorted(prerequisiteChanges("loyalty", tasks, {}, {}))).toEqual({ complete: ["c3"], failed: ["c4"] });
  });
  it("« complete » ou « failed » : grisée terminée, sans faire échouer l'autre branche", () => {
    const tasks = [mk("supply", [], ["sabotage"]), mk("sabotage", [], ["supply"]), mk("road", [["supply", ["complete", "failed"]]])];
    expect(sorted(prerequisiteChanges("road", tasks, {}, {}))).toEqual({ complete: ["supply"], failed: [] });
  });
  it("Kind of Sabotage : Supply Plans « active » n'est pas grisée ; la terminer à la main fait échouer Kind of Sabotage", () => {
    const tasks = [mk("supply", [], ["sabotage"]), mk("sabotage", [["supply", ["active"]]], ["supply"])];
    expect(prerequisiteChanges("sabotage", tasks, {}, {})).toEqual({ complete: [], failed: [] });
    expect(branchFailures(["supply"], tasks, {}, {})).toEqual(["sabotage"]);
    expect(branchFailures(["supply"], tasks, {}, { sabotage: true })).toEqual([]);
  });
  it("prérequis terminé sans ambiguïté : ses branches exclusives échouent, pas la quête activée", () => {
    const tasks = [mk("p", [], ["alt"]), mk("alt", [], ["p"]), mk("x", [["p", ["complete"]]], ["p"])];
    expect(sorted(prerequisiteChanges("x", tasks, {}, {}))).toEqual({ complete: ["p"], failed: ["alt"] });
  });
  it("référence à soi-même et cycle : sans effet de bord, sans boucle", () => {
    const tasks = [mk("a", [["a", ["complete"]], ["b", ["complete"]]]), mk("b", [["a", ["complete"]]])];
    expect(sorted(prerequisiteChanges("a", tasks, {}, {}))).toEqual({ complete: ["b"], failed: [] });
  });
});
