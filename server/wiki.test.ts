// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAppServer } from "./index.mjs";
import { LIMITS, resetWiki, setUpstreamFetch } from "./wiki.mjs";

let server: http.Server;
let base: string;
const saved = { ...LIMITS };

beforeAll(async () => {
  const dist = path.join(mkdtempSync(path.join(tmpdir(), "tqp-wiki-")), "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, "index.html"), "<!doctype html>");
  server = createAppServer(dist);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  LIMITS.gapMs = 0; // pas d'attente entre les requêtes amont dans les tests
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
afterEach(() => {
  resetWiki();
  Object.assign(LIMITS, saved, { gapMs: 0 });
});

const okUpstream = () => vi.fn(async () => new Response(JSON.stringify({ parse: { title: "T" } }), { status: 200 }));
const get = (qs: string) => fetch(`${base}/api/wiki?${qs}`);
const Q = "lang=en&action=parse&page=Foo&prop=wikitext&redirects=1";

describe("/api/wiki", () => {
  it("refuse les paramètres, actions et langues hors liste (400)", async () => {
    const up = okUpstream();
    setUpstreamFetch(up);
    for (const qs of ["lang=en&action=edit&page=X", "lang=de&action=parse&page=X", "action=parse&page=X", "lang=en&action=parse&page=X&origin=*", "lang=en&action=parse&evil=1", `lang=en&action=parse&page=${"a".repeat(2001)}`]) {
      const r = await get(qs);
      expect(r.status).toBe(400);
      expect(await r.json()).toHaveProperty("error");
    }
    expect(up).not.toHaveBeenCalled();
  });

  it("transmet le JSON du wiki (format forcé, User-Agent) et sert le cache ensuite", async () => {
    const up = okUpstream();
    setUpstreamFetch(up);
    const a = await get(Q);
    expect(a.status).toBe(200);
    expect(a.headers.get("content-type")).toContain("application/json");
    expect(a.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await a.json()).toEqual({ parse: { title: "T" } });
    expect(await (await get(Q)).json()).toEqual({ parse: { title: "T" } });
    expect(up).toHaveBeenCalledTimes(1);
    const [url, init] = up.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/escapefromtarkov\.fandom\.com\/api\.php\?/);
    expect(url).toContain("format=json");
    expect(url).toContain("formatversion=2");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^TarkovQuestPlanner\//);
    await get(Q.replace("lang=en", "lang=fr"));
    expect(String(up.mock.calls[1][0])).toContain("/fr/api.php");
  });

  it("regroupe les requêtes identiques simultanées en un seul appel amont", async () => {
    const up = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return new Response("{\"query\":{}}");
    });
    setUpstreamFetch(up);
    const rs = await Promise.all([get(Q), get(Q), get(Q)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it("limite chaque IP (429 + Retry-After)", async () => {
    setUpstreamFetch(okUpstream());
    LIMITS.perIpPerMin = 2;
    expect((await get(Q)).status).toBe(200);
    expect((await get(Q)).status).toBe(200);
    const r = await get(Q);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
  });

  it("répond 502 si le wiki échoue, sans mettre l'erreur en cache", async () => {
    const up = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(new Response("{\"parse\":{}}"));
    setUpstreamFetch(up);
    const bad = await get(Q);
    expect(bad.status).toBe(502);
    expect(await bad.json()).toEqual({ error: "upstream-failed" });
    expect((await get(Q)).status).toBe(200);
    expect(up).toHaveBeenCalledTimes(2);
    setUpstreamFetch(vi.fn(async () => new Response("<html>", { status: 403 })));
    expect((await get(Q + "&section=1")).status).toBe(502);
  });
});
