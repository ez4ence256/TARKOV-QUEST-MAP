import { describe, expect, it } from "vitest";
import { LIGHTKEEPER_TRADER_ID, lightkeeperSteps, lightkeeperTaskIds } from "./lightkeeper";

const task = (id: string, traderId: string, reqs: string[] = []) => ({
  id,
  traderId,
  details: { taskRequirements: reqs.map((taskId) => ({ taskId, status: ["complete"] })) } as never,
});

describe("lightkeeperTaskIds", () => {
  it("quête de Lightkeeper et ses préalables, pas les autres", () => {
    const ids = lightkeeperTaskIds([task("A", "t"), task("B", "t", ["A"]), task("LK", LIGHTKEEPER_TRADER_ID, ["B"]), task("X", "t")]);
    expect([...ids].sort()).toEqual(["A", "B", "LK"]);
  });
});

describe("lightkeeperSteps", () => {
  const t = (id: string, traderId: string, reqs: string[] = [], extra: object = {}) => ({ ...task(id, traderId, reqs), name: id, minPlayerLevel: null, lightkeeperRequired: true, ...extra }) as never as Parameters<typeof lightkeeperSteps>[0][number];
  const ids = (l: { id: string }[]) => l.map((x) => x.id);

  it("préalables avant, séparés par marchand, niveau puis nom à égalité", () => {
    const r = lightkeeperSteps([t("LK2", LIGHTKEEPER_TRADER_ID, ["LK1"]), t("LK1", LIGHTKEEPER_TRADER_ID, ["B"]), t("B", "x", ["A"]), t("A", "x"), t("Z", "x", [], { minPlayerLevel: 1 }), t("other", "x", [], { lightkeeperRequired: false })]);
    expect(ids(r.before)).toEqual(["A", "B", "Z"]);
    expect(ids(r.own)).toEqual(["LK1", "LK2"]);
  });
  it("quête du wiki après celles de tarkov.dev, préalable inconnu ignoré", () => {
    const r = lightkeeperSteps([t("W", LIGHTKEEPER_TRADER_ID, ["absent"], { source: "wiki" }), t("A", LIGHTKEEPER_TRADER_ID)]);
    expect(ids(r.own)).toEqual(["A", "W"]);
  });
  it("cycle : toutes les quêtes sont gardées", () => {
    const r = lightkeeperSteps([t("A", "x", ["B"]), t("B", "x", ["A"]), t("C", LIGHTKEEPER_TRADER_ID, ["A"])]);
    expect(ids(r.before).sort()).toEqual(["A", "B"]);
    expect(ids(r.own)).toEqual(["C"]);
  });
  it("sans quête Lightkeeper : vide", () => {
    expect(lightkeeperSteps([t("A", "x", [], { lightkeeperRequired: false })])).toEqual({ before: [], own: [] });
  });
});
