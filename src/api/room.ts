// Client des rooms v2 : connexion SSE, publication de MON instantané, réception de ceux des autres (voir server/rooms.mjs).
// Rien de ce qui vient de la room n'est écrit dans l'état local : les quêtes de chacun restent à lui.
// Après chaque changement local, on republie (délai 400 ms) si l'instantané a vraiment changé ; on republie aussi à chaque (re)connexion.

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import type { GameMode, Task } from "../types";
import { tr } from "../lib/i18n";
import {
  cleanNickname,
  MAX_NICKNAME,
  parseMembers,
  parseSnapshot,
  publicSnapshotOf,
  publishablePosition,
  type RoomMemberInfo,
  type RoomSnapshot,
} from "../lib/roomSync";
import type { Action, AppState } from "../state/store";

export type RoomStatus = "connecting" | "connected" | "reconnecting" | "closed" | "unavailable";
export interface RoomInfo {
  id: string;
  creator: boolean;
  status: RoomStatus;
  /** Membres connectés (moi compris). */
  members: number;
}
/** Un autre membre de la room : son pseudo et son dernier instantané (null tant qu'il n'a rien publié). */
export interface RoomMember extends RoomMemberInfo {
  snapshot: RoomSnapshot | null;
  /** Heure serveur de la dernière publication. */
  at: number;
}

const SESSION_KEY = "tqp:room";
const NAME_KEY = "tqp:roomName";
export const ROOM_ID = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const MODE_IDS: GameMode[] = ["regular", "pve", "pvp-season"];
const PROTOCOL = 2;
const SEND_DELAY = 400;
const CLOSED_AFTER = 6; // essais (2,5 s) d'un non-créateur avant « Room fermée »

class Unavailable extends Error {
  constructor(readonly hosting: boolean) {
    super(hosting ? "hosting" : "network");
  }
}

/** Appel JSON ; refuse toute réponse qui n'est pas du JSON (ex. index.html servi par un hébergement statique). */
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Unavailable(false);
  }
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) throw new Unavailable(true);
  try {
    return { status: res.status, data: ((await res.json()) as Record<string, unknown>) ?? {} };
  } catch {
    throw new Unavailable(true);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Message de protocole du serveur (ancienne page encore ouverte), à afficher tel quel. */
const protocolMessage = (data: Record<string, unknown>) => (data.error === "protocol" && typeof data.message === "string" ? data.message : null);

interface Hooks {
  /** Pseudo et instantané à publier maintenant ; null tant que les données ne sont pas chargées. */
  getPublish: (mode: GameMode) => { name: string; snapshot: RoomSnapshot } | null;
  onMode: (mode: GameMode) => void;
  onMembers: (members: RoomMemberInfo[]) => void;
  onMember: (id: string, name: string, snapshot: RoomSnapshot, at: number) => void;
  onInfo: (patch: Partial<RoomInfo>) => void;
  onError: (message: string) => void;
}

export class RoomClient {
  readonly clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  private es: EventSource | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private hadHello = false;
  private recovering = false;
  private sending = false;
  /** Dernière publication acceptée par le serveur (JSON) : on n'envoie rien de plus tant que rien ne change. */
  private lastSent = "";

  constructor(
    readonly id: string,
    readonly creator: boolean,
    private mode: GameMode | null,
    private hooks: Hooks,
  ) {}

  start() {
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.es?.close();
  }

  /** À appeler après chaque changement local possible : publie si l'instantané a changé. */
  schedule(delay = SEND_DELAY) {
    if (this.stopped || !this.hadHello) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private connect() {
    if (this.stopped) return;
    const es = new EventSource(`/api/rooms/${this.id}/events?v=${PROTOCOL}&client=${this.clientId}`);
    this.es = es;
    es.onmessage = (e) => this.onMessage(String(e.data));
    es.onerror = () => {
      if (this.stopped || this.es !== es) return;
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        void this.recover();
      } else this.hooks.onInfo({ status: "reconnecting" }); // le navigateur réessaie seul
    };
  }

  private onMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "hello") {
      const mode = MODE_IDS.find((m) => m === msg.mode);
      const members = parseMembers(msg.members);
      if (!mode || !members) return;
      this.hadHello = true;
      this.mode = mode;
      this.lastSent = ""; // reconnexion : le serveur a pu tout perdre, on republie
      this.hooks.onMode(mode);
      this.hooks.onMembers(members);
      this.hooks.onInfo({ status: "connected", members: members.filter((m) => m.connected).length || 1 });
      this.schedule(0);
    } else if (msg.type === "members") {
      const members = parseMembers(msg.members);
      if (!members) return;
      this.hooks.onMembers(members);
      this.hooks.onInfo({ members: members.filter((m) => m.connected).length || 1 });
    } else if (msg.type === "member") {
      const snapshot = parseSnapshot(msg.snapshot);
      if (!snapshot || typeof msg.id !== "string" || msg.id === this.clientId || typeof msg.at !== "number") return;
      this.hooks.onMember(msg.id, cleanNickname(msg.name), snapshot, msg.at);
    }
  }

  private async flush() {
    if (this.stopped || !this.mode) return;
    if (this.sending) return this.schedule();
    const pub = this.hooks.getPublish(this.mode);
    if (!pub) return;
    const key = JSON.stringify(pub);
    if (key === this.lastSent) return;
    this.sending = true;
    let retry = 0;
    try {
      const r = await api("POST", `/api/rooms/${this.id}/publish`, { v: PROTOCOL, client: this.clientId, name: pub.name, snapshot: pub.snapshot });
      if (r.status === 200) this.lastSent = key;
      else if (r.status === 404) {
        this.es?.close();
        void this.recover();
      } else if (r.status === 429) retry = 1500; // trop de publications d'un coup ou room pleine : on réessaie
      else this.hooks.onError(protocolMessage(r.data) ?? tr("La room a refusé ton instantané.", "The room refused your snapshot."));
    } catch {
      retry = 2000; // réseau coupé : on réessaie
    } finally {
      this.sending = false;
    }
    if (retry) this.schedule(retry);
  }

  /** Connexion perdue pour de bon : la room existe-t-elle encore ? Le créateur la recrée si besoin. */
  private async recover() {
    if (this.recovering) return;
    this.recovering = true;
    this.hooks.onInfo({ status: "reconnecting" });
    let missing = 0; // réponses « room inconnue » seulement : une coupure du serveur ne compte pas
    try {
      for (let attempt = 0; !this.stopped; attempt++) {
        try {
          const r = await api("GET", `/api/rooms/${this.id}?v=${PROTOCOL}`);
          if (r.status === 200) return this.connect();
          const protocol = protocolMessage(r.data);
          if (protocol) {
            this.hooks.onError(protocol);
            return this.hooks.onInfo({ status: "closed" });
          }
          if (r.status === 404 && this.creator && this.mode) {
            const put = await api("PUT", `/api/rooms/${this.id}`, { v: PROTOCOL, mode: this.mode });
            if (put.status === 200) return this.connect();
          } else if (r.status === 404 && ++missing >= CLOSED_AFTER) {
            return this.hooks.onInfo({ status: "closed" });
          }
        } catch (e) {
          // une page d'erreur HTML (proxy, redéploiement) après une connexion réussie est passagère
          if (e instanceof Unavailable && !this.hadHello) return this.hooks.onInfo({ status: "unavailable" });
        }
        await sleep(Math.min(2500 + attempt * 1000, 10000));
      }
    } finally {
      this.recovering = false;
    }
  }
}

// --- stockage : la room survit à un rechargement (sessionStorage), le pseudo reste (localStorage) ---

interface Saved {
  id: string;
  creator: boolean;
  mode: GameMode | null;
}
function readSaved(): Saved | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (raw && typeof raw.id === "string" && ROOM_ID.test(raw.id)) {
      return { id: raw.id, creator: raw.creator === true, mode: MODE_IDS.find((m) => m === raw.mode) ?? null };
    }
  } catch {
    /* stockage indisponible */
  }
  return null;
}
function writeSaved(saved: Saved | null) {
  try {
    if (saved) sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}
function readName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? "").slice(0, MAX_NICKNAME);
  } catch {
    return "";
  }
}

export interface RoomContext {
  tasksById: ReadonlyMap<string, Task>;
  /** Dernière position du Monitor (map du site) ; publiée si elle est récente et du mode de la room. */
  position: { mapId: string; x: number; y: number; z: number; rotation: number; at: number; gameMode: GameMode } | null;
}

/** Hook de l'application : une room à la fois. N'écrit jamais dans l'état (sauf le mode de jeu, pour afficher celui de la room). */
export function useRoom(state: AppState, dispatch: Dispatch<Action>, ctx: RoomContext) {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setNameState] = useState(readName);
  const [list, setList] = useState<RoomMemberInfo[]>([]);
  const [snaps, setSnaps] = useState<Record<string, { snapshot: RoomSnapshot; at: number }>>({});
  const client = useRef<RoomClient | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const nameRef = useRef(name);
  nameRef.current = name;

  // tout changement local peut changer l'instantané : le client compare avant d'envoyer
  useEffect(() => client.current?.schedule(), [state.modes, ctx.tasksById, ctx.position, name]);

  const stop = useCallback(() => {
    client.current?.stop();
    client.current = null;
    setList([]);
    setSnaps({});
  }, []);

  const begin = useCallback(
    (id: string, creator: boolean, mode: GameMode | null) => {
      stop();
      setError(null);
      writeSaved({ id, creator, mode });
      setInfo({ id, creator, status: "connecting", members: 1 });
      let firstHello = true;
      const c = new RoomClient(id, creator, mode, {
        getPublish: (m) => {
          const { tasksById, position } = ctxRef.current;
          if (tasksById.size === 0) return null; // données pas encore chargées : on ne publie pas un instantané vide
          const snapshot = publicSnapshotOf(stateRef.current.modes[m], tasksById);
          const pos = publishablePosition(position, m);
          return { name: cleanNickname(nameRef.current), snapshot: pos ? { ...snapshot, position: pos } : snapshot };
        },
        onMode: (m) => {
          writeSaved({ id, creator, mode: m });
          // une seule fois, à la jointure : une reconnexion ne ramène pas de force sur le mode de la room
          if (!firstHello) return;
          firstHello = false;
          const cur = stateRef.current;
          if (cur.gameMode === m) return;
          // seul l'affichage change de mode : aucune quête locale n'est touchée
          if (cur.gameMode) setNotice(tr(`La room est en mode ${m === "regular" ? "PvP" : m === "pve" ? "PvE" : "PvP Saison"} : vous y avez été basculé.`, `The room is in ${m === "regular" ? "PvP" : m === "pve" ? "PvE" : "PvP Season"} mode: you were switched to it.`));
          dispatch({ type: "setGameMode", mode: m });
        },
        onMembers: (members) => {
          setList(members.filter((x) => x.id !== c.clientId));
          setSnaps((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => members.some((x) => x.id === k))));
        },
        onMember: (mid, mname, snapshot, at) => {
          setSnaps((prev) => ({ ...prev, [mid]: { snapshot, at } }));
          setList((prev) => (prev.some((x) => x.id === mid) ? prev.map((x) => (x.id === mid ? { ...x, name: mname } : x)) : prev));
        },
        onInfo: (patch) => setInfo((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev)),
        onError: setError,
      });
      client.current = c;
      c.start();
    },
    [dispatch, stop],
  );

  // rechargement de la page : on rejoint la room enregistrée
  useEffect(() => {
    const saved = readSaved();
    if (saved) begin(saved.id, saved.creator, saved.mode);
    return stop;
  }, [begin, stop]);

  const failure = (e: unknown) =>
    setError(
      e instanceof Unavailable && e.hosting
        ? tr("Rooms indisponibles sur cet hébergement.", "Rooms are not available on this hosting.")
        : tr("Serveur injoignable, réessayez.", "Server unreachable, try again."),
    );

  const create = async () => {
    const mode = state.gameMode;
    if (!mode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api("POST", "/api/rooms", { v: PROTOCOL, mode });
      if (r.status === 201 && typeof r.data.id === "string") begin(r.data.id, true, mode);
      else setError(protocolMessage(r.data) ?? tr("Création impossible (limite du serveur atteinte ?).", "Could not create the room (server limit reached?)."));
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };

  const join = async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (busy) return;
    if (!ROOM_ID.test(id)) return setError(tr("ID invalide (6 caractères).", "Invalid ID (6 characters)."));
    setBusy(true);
    setError(null);
    try {
      const r = await api("GET", `/api/rooms/${id}?v=${PROTOCOL}`);
      if (r.status === 200) begin(id, false, null);
      else setError(protocolMessage(r.data) ?? tr("Room introuvable.", "Room not found."));
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };

  /** Quitter = se déconnecter : rien n'a été fusionné, il n'y a rien à restaurer. */
  const leave = () => {
    stop();
    writeSaved(null);
    setInfo(null);
  };

  const setName = (raw: string) => {
    const next = raw.slice(0, MAX_NICKNAME);
    setNameState(next);
    try {
      localStorage.setItem(NAME_KEY, next);
    } catch {
      /* pseudo non retenu */
    }
  };

  /** Les autres membres connus (pas moi), avec leur dernier instantané. */
  const members: RoomMember[] = useMemo(
    () => list.map((m) => ({ ...m, snapshot: snaps[m.id]?.snapshot ?? null, at: snaps[m.id]?.at ?? 0 })),
    [list, snaps],
  );

  return { info, notice, dismissNotice: () => setNotice(null), error, busy, name, setName, members, create, join, leave };
}
