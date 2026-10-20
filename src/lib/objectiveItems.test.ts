import { describe, expect, it } from "vitest";
import type { Objective } from "../types";
import { objectiveItemRefs } from "./objectiveItems";

const obj = (o: Partial<Objective>): Objective => ({ id: "o", type: "giveItem", description: "", optional: false, mapIds: [], locations: [], ...o });

describe("objectiveItemRefs", () => {
  it("rien : aucune référence", () => {
    expect(objectiveItemRefs(obj({ type: "kill" }))).toEqual({ shown: [], hidden: [], keys: [], count: 0 });
  });
  it("objets, quantité et clés à plat", () => {
    const r = objectiveItemRefs(obj({ itemIds: ["a"], count: 3, questItemId: "q", requiredKeyIds: [["k1", "k2"], ["k1"]] }));
    expect(r).toEqual({ shown: ["a", "q"], hidden: [], keys: ["k1", "k2"], count: 3 });
  });
  it("la quantité d'éliminations n'est pas une quantité d'objets", () => {
    expect(objectiveItemRefs(obj({ type: "kill", count: 5 })).count).toBe(0);
  });
  it("liste au choix trop longue : 5 images, le reste dans hidden", () => {
    const ids = ["1", "2", "3", "4", "5", "6", "7"];
    const r = objectiveItemRefs(obj({ itemIds: ids }));
    expect(r.shown).toEqual(["1", "2", "3", "4", "5"]);
    expect(r.hidden).toEqual(["6", "7"]);
  });
  it("6 objets au choix : tous montrés", () => {
    expect(objectiveItemRefs(obj({ itemIds: ["1", "2", "3", "4", "5", "6"] })).hidden).toEqual([]);
  });
});
