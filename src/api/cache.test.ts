import { afterEach, describe, expect, it, vi } from "vitest";
import { withWikiKappa, writeCachedData } from "./cache";
import type { TarkovData } from "../types";

const fake = (gameMode: string, language: string) => ({ gameMode, language }) as unknown as TarkovData;

describe("writeCachedData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("libère les autres entrées si le stockage est plein, puis réessaie", () => {
    localStorage.setItem("tqp:data:v11:pve:fr", "x");
    localStorage.setItem("autre", "garde");
    const set = Storage.prototype.setItem;
    let first = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k, v) {
      if (first) {
        first = false;
        throw new Error("quota");
      }
      set.call(this, k, v);
    });
    writeCachedData(fake("regular", "en"));
    expect(localStorage.getItem("tqp:data:v11:pve:fr")).toBeNull();
    expect(localStorage.getItem("tqp:data:v11:regular:en")).not.toBeNull();
    expect(localStorage.getItem("autre")).toBe("garde");
  });

  it("garde un simple avertissement si l'écriture échoue encore", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeCachedData(fake("regular", "en"));
    expect(warn).toHaveBeenCalled();
  });
});

describe("withWikiKappa", () => {
  it("garde le drapeau tarkov.dev et ajoute les quêtes du wiki", () => {
    const task = (id: string, kappaRequired: boolean) => ({ id, kappaRequired });
    const data = { tasks: [task("a", true), task("b", false), task("c", false)] } as unknown as TarkovData;
    const out = withWikiKappa(data, new Set(["b"]));
    expect(out.tasks.map((t) => t.kappaRequired)).toEqual([true, true, false]);
    expect(data.tasks[1].kappaRequired).toBe(false);
  });
});
