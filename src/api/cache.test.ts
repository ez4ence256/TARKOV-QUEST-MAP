import { afterEach, describe, expect, it, vi } from "vitest";
import { DATA_TTL_MS, loadTarkovData, writeCachedData } from "./cache";
import * as api from "./tarkovJson";
import type { TarkovData } from "../types";

const fake = (gameMode: string, language: string) => ({ gameMode, language }) as unknown as TarkovData;

describe("writeCachedData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("libère les autres entrées si le stockage est plein, puis réessaie", () => {
    localStorage.setItem("tqp:data:v13:pve:fr", "x");
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
    expect(localStorage.getItem("tqp:data:v13:pve:fr")).toBeNull();
    expect(localStorage.getItem("tqp:data:v13:regular:en")).not.toBeNull();
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

describe("loadTarkovData (cache périmé)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  const old = () => ({ gameMode: "regular", language: "fr", fetchedAt: Date.now() - DATA_TTL_MS - 1, tasks: [] }) as unknown as TarkovData;

  it("sert le cache périmé tout de suite puis donne les données fraîches à onRefresh", async () => {
    writeCachedData(old());
    const fresh = { ...old(), fetchedAt: Date.now() } as TarkovData;
    vi.spyOn(api, "fetchTarkovData").mockResolvedValue(fresh);
    const onRefresh = vi.fn();
    const res = await loadTarkovData("regular", "fr", { onRefresh });
    expect(res.source).toBe("cache");
    await vi.waitFor(() => expect(onRefresh).toHaveBeenCalledWith({ data: fresh, source: "network" }));
    expect(JSON.parse(localStorage.getItem("tqp:data:v13:regular:fr")!).fetchedAt).toBe(fresh.fetchedAt);
  });

  it("hors ligne : garde le cache périmé et le signale à onRefresh", async () => {
    writeCachedData(old());
    vi.spyOn(api, "fetchTarkovData").mockRejectedValue(new Error("HTTP 503"));
    const onRefresh = vi.fn();
    await loadTarkovData("regular", "fr", { onRefresh });
    await vi.waitFor(() => expect(onRefresh).toHaveBeenCalledWith(expect.objectContaining({ source: "stale", error: "HTTP 503" })));
  });

  it("sans onRefresh ou en rechargement forcé, attend l'API", async () => {
    writeCachedData(old());
    const fresh = { ...old(), fetchedAt: Date.now() } as TarkovData;
    vi.spyOn(api, "fetchTarkovData").mockResolvedValue(fresh);
    expect((await loadTarkovData("regular", "fr")).source).toBe("network");
    expect((await loadTarkovData("regular", "fr", { force: true, onRefresh: vi.fn() })).source).toBe("network");
  });
});
