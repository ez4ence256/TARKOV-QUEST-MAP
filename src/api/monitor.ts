// Liaison avec « Tarkov AprilOx Monitor » : flux SSE /api/monitor/{code}/events (voir server/monitor.mjs).
// Le code de liaison (16 caractères) est le seul secret : localStorage `tqp:monitor`, jamais dans l'export ni les rooms.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMode } from "../types";
import { tr } from "../lib/i18n";

export type MonitorStatus = "off" | "connecting" | "connected" | "unavailable";
export type MonitorEvent =
  | { type: "hello"; at: number }
  | { type: "task"; status: "started" | "finished" | "failed"; taskId: string; gameMode: GameMode; at: number }
  | { type: "map"; map: string; gameMode: GameMode; at: number }
  | { type: "position"; map: string; x: number; y: number; z: number; rotation: number; gameMode: GameMode; at: number };

const KEY = "tqp:monitor";
export const MONITOR_CODE = /^[A-Za-z0-9]{16}$/;
const RETRY_MS = 3000;

/** ABCD…WXYZ : le code complet n'est jamais affiché ni journalisé. */
export const maskCode = (code: string) => `${code.slice(0, 4)}…${code.slice(-4)}`;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100000;

/** Valide un message du flux (mêmes règles que le serveur) ; null si invalide. */
export function parseMonitorEvent(raw: unknown): MonitorEvent | null {
  const b = raw as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || b.v !== 1) return null;
  const at = typeof b.at === "number" && Number.isFinite(b.at) && b.at > 0 ? b.at : Date.now();
  if (b.type === "hello") return { type: "hello", at };
  const gameMode = b.gameMode === "regular" || b.gameMode === "pve" || b.gameMode === "pvp-season" ? b.gameMode : null;
  if (!gameMode) return null;
  if (b.type === "task") {
    const status = b.status;
    if ((status !== "started" && status !== "finished" && status !== "failed") || typeof b.taskId !== "string" || !/^[0-9a-f]{24}$/.test(b.taskId)) return null;
    return { type: "task", status, taskId: b.taskId, gameMode, at };
  }
  if (typeof b.map !== "string" || !/^[a-z0-9-]{1,40}$/.test(b.map)) return null;
  if (b.type === "map") return { type: "map", map: b.map, gameMode, at };
  if (b.type === "position" && num(b.x) && num(b.y) && num(b.z) && num(b.rotation)) {
    return { type: "position", map: b.map, x: b.x, y: b.y, z: b.z, rotation: b.rotation, gameMode, at };
  }
  return null;
}

function readCode(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    return code && MONITOR_CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}
function writeCode(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : la liaison dure jusqu'au rechargement */
  }
}

/** Lit `?monitor=CODE` et l'efface tout de suite de l'adresse (le code ne reste ni dans l'historique ni dans un lien copié). */
function takeUrlCode(): string | null {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("monitor");
    if (code === null) return null;
    url.searchParams.delete("monitor");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return MONITOR_CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}
// une seule fois au chargement du module (insensible au double rendu de React)
const urlCode = takeUrlCode();

/** Un hébergement statique répond en HTML : la route /api/monitor/{code} (GET) du vrai serveur répond en JSON. */
async function probe(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/monitor/${code}`);
    return (res.headers.get("content-type") ?? "").includes("application/json");
  } catch {
    return true; // réseau coupé : pas une raison de déclarer l'hébergement incapable
  }
}

export interface MonitorLink {
  code: string | null;
  status: MonitorStatus;
  lastAt: number | null;
  /** Code reçu par l'adresse, en attente de confirmation. */
  pending: string | null;
  connect: (code: string) => void;
  disconnect: () => void;
  confirmPending: () => void;
  dismissPending: () => void;
}

/** Hook de l'application : un seul flux, rappelle `onEvent` pour chaque événement valide. */
export function useMonitor(onEvent: (e: MonitorEvent) => void): MonitorLink {
  const [code, setCode] = useState<string | null>(readCode);
  const [status, setStatus] = useState<MonitorStatus>(code ? "connecting" : "off");
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(urlCode);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!code) {
      setStatus("off");
      return;
    }
    let stopped = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setStatus("connecting");
    const open = async () => {
      if (stopped) return;
      if (!(await probe(code))) return !stopped && setStatus("unavailable");
      if (stopped) return;
      const source = new EventSource(`/api/monitor/${code}/events`);
      es = source;
      source.onopen = () => setStatus("connected");
      source.onmessage = (m) => {
        let event: MonitorEvent | null = null;
        try {
          event = parseMonitorEvent(JSON.parse(String(m.data)));
        } catch {
          /* message illisible : ignoré */
        }
        if (!event) return;
        setLastAt(Date.now());
        handler.current(event);
      };
      source.onerror = () => {
        if (stopped || es !== source) return;
        setStatus("connecting");
        if (source.readyState === EventSource.CLOSED) {
          source.close(); // refus du serveur (ex. trop d'écouteurs) : on réessaie plus tard
          timer = setTimeout(() => void open(), RETRY_MS);
        }
      };
    };
    void open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      es?.close();
    };
  }, [code]);

  const connect = useCallback((next: string) => {
    if (!MONITOR_CODE.test(next)) return;
    writeCode(next);
    setLastAt(null);
    setCode(next);
  }, []);
  const disconnect = useCallback(() => {
    writeCode(null);
    setLastAt(null);
    setCode(null);
  }, []);

  return {
    code,
    status,
    lastAt,
    pending,
    connect,
    disconnect,
    confirmPending: () => {
      if (pending) connect(pending);
      setPending(null);
    },
    dismissPending: () => setPending(null),
  };
}

/** Texte d'état affiché dans les réglages. */
export function statusLine(status: MonitorStatus, lastAt: number | null): string {
  if (status === "off") return tr("Non connecté.", "Not connected.");
  if (status === "unavailable") return tr("Indisponible sur cet hébergement.", "Not available on this hosting.");
  if (status === "connecting") return tr("Connexion…", "Connecting…");
  const time = lastAt ? new Date(lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return time ? tr(`Connecté · dernier événement à ${time}`, `Connected · last event at ${time}`) : tr("Connecté · aucun événement reçu", "Connected · no event received yet");
}
