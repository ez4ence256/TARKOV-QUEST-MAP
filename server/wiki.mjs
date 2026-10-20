// Proxy « wiki » : repli same-origin quand le navigateur ne peut pas joindre l'API Fandom (blocage réseau/CORS).
// JavaScript simple (le Node de production ne sait pas importer src/*.ts). Tout est en mémoire.
// GET /api/wiki?lang=en|fr&<paramètres MediaWiki> → JSON du wiki tel quel. Les requêtes (titres de pages) ne sont jamais journalisées.
import { readFileSync } from "node:fs";

export const LIMITS = {
  maxEntries: 1000,
  maxBytes: 50 * 1024 * 1024,
  ttlMs: 24 * 60 * 60 * 1000,
  gapMs: 500, // 2 requêtes/s au plus vers Fandom, tous clients confondus
  timeoutMs: 15_000,
  perIpPerMin: 120,
  maxQueryChars: 2000,
};

// Exactement les paramètres que l'appli envoie (src/api/*.ts), rien d'autre.
const ACTIONS = new Set(["parse", "query"]);
const KEYS = new Set([
  "action", "page", "prop", "redirects", "titles", "section",
  "iiprop", "iiurlwidth", "piprop", "pithumbsize", "cllimit", "clshow", "clcategories",
  "rvprop", "rvslots", "generator", "gcmtitle", "gcmnamespace", "gcmlimit",
  "continue", "gcmcontinue", "clcontinue",
]);
const HOSTS = { en: "https://escapefromtarkov.fandom.com/api.php", fr: "https://escapefromtarkov.fandom.com/fr/api.php" };

let version = "0";
try {
  version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
} catch {
  /* version inconnue : le User-Agent reste valable */
}
const USER_AGENT = `TarkovQuestPlanner/${version} (+https://tarkov.aprilox.fr)`;

let upstream = (url, init) => fetch(url, init);
/** Remplace le fetch amont (tests). */
export function setUpstreamFetch(fn) {
  upstream = fn;
}

/** @type {Map<string, string>} clé → corps JSON ; l'ordre d'insertion sert de LRU. */
const cache = new Map();
const times = new Map();
const inflight = new Map();
const ips = new Map();
let bytes = 0;
let tail = Promise.resolve();
let lastAt = 0;

/** Vide tout (tests). */
export function resetWiki() {
  cache.clear();
  times.clear();
  inflight.clear();
  ips.clear();
  bytes = 0;
  tail = Promise.resolve();
  lastAt = 0;
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

// derrière un proxy : la dernière entrée de X-Forwarded-For est celle ajoutée par le proxy de confiance
function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",").pop().trim();
  return fwd || req.socket.remoteAddress || "?";
}

/** Fenêtre fixe d'une minute ; renvoie false si la limite est dépassée. */
function hit(key, now) {
  const slot = ips.get(key) ?? { start: now, n: 0 };
  ips.set(key, slot);
  if (now - slot.start >= 60_000) {
    slot.start = now;
    slot.n = 0;
  }
  return ++slot.n <= LIMITS.perIpPerMin;
}

function store(key, body) {
  const old = cache.get(key);
  if (old !== undefined) bytes -= old.length;
  cache.delete(key);
  cache.set(key, body);
  times.set(key, Date.now());
  bytes += body.length;
  while (cache.size > LIMITS.maxEntries || bytes > LIMITS.maxBytes) {
    const [k, v] = cache.entries().next().value;
    cache.delete(k);
    times.delete(k);
    bytes -= v.length;
  }
}

function cached(key) {
  const body = cache.get(key);
  if (body === undefined) return undefined;
  if (Date.now() - times.get(key) > LIMITS.ttlMs) {
    cache.delete(key);
    bytes -= body.length;
    return undefined;
  }
  cache.delete(key); // le plus récemment lu passe en fin de Map
  cache.set(key, body);
  return body;
}

/** Une requête amont à la fois dans le débit autorisé ; rejette en cas d'erreur (rien n'est mis en cache). */
function fetchUpstream(lang, params) {
  const run = tail.then(async () => {
    const wait = lastAt + LIMITS.gapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    const url = `${HOSTS[lang]}?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`;
    const r = await upstream(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(LIMITS.timeoutMs) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const data = JSON.parse(text);
    return { text, ok: !data.error }; // une erreur MediaWiki (page absente…) est transmise mais pas mise en cache
  });
  tail = run.catch(() => undefined);
  return run;
}

/** Gestionnaire HTTP pour /api/wiki ; renvoie false si l'URL n'est pas la sienne. */
export function handleWiki(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/wiki") return false;
  req.resume();
  if (req.method !== "GET") {
    json(res, 405, { error: "method-not-allowed" }, { Allow: "GET" });
    return true;
  }
  const params = {};
  let chars = 0;
  let lang = "";
  for (const [k, v] of url.searchParams) {
    chars += k.length + v.length;
    if (k === "lang") lang = v;
    else if (KEYS.has(k)) params[k] = v;
    else return json(res, 400, { error: "bad-param" }), true;
  }
  if (!(lang in HOSTS) || !ACTIONS.has(params.action) || chars > LIMITS.maxQueryChars) {
    json(res, 400, { error: "bad-request" });
    return true;
  }
  if (!hit(clientIp(req), Date.now())) {
    json(res, 429, { error: "rate-limited" }, { "Retry-After": "60" });
    return true;
  }
  const key = lang + "?" + new URLSearchParams(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1)));
  const ok = (body) => json(res, 200, body, { "Cache-Control": "public, max-age=3600" });
  const hitBody = cached(key);
  if (hitBody !== undefined) {
    ok(hitBody);
    return true;
  }
  let p = inflight.get(key);
  if (!p) {
    p = fetchUpstream(lang, params).then((r) => {
      if (r.ok) store(key, r.text);
      return r;
    });
    inflight.set(key, p);
    const done = () => inflight.delete(key);
    p.then(done, done);
  }
  p.then((r) => ok(r.text), () => json(res, 502, { error: "upstream-failed" }));
  return true;
}

// Nettoyage : compteurs d'IP périmés.
setInterval(() => {
  const now = Date.now();
  for (const [ip, s] of ips) if (now - s.start >= 60_000) ips.delete(ip);
}, 60_000).unref();
