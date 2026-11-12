import { describe, expect, it } from "vitest";
import { LIGHTKEEPER_TRADER_ID, lightkeeperTaskIds } from "./lightkeeper";

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
