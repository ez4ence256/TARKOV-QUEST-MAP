// Client des rooms : connexion SSE + envoi des différences d'état (voir server/rooms.mjs).
// On ne suit pas les actions une à une : après chaque changement local, on compare l'état partageable
// au dernier état connu du serveur (`synced`) et on envoie des opérations absolues { kind, id, on }.
// Les opérations reçues sont appliquées aussi à `synced`, donc elles ne repartent jamais.

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import type { GameMode } from "../types";
import { tr } from "../lib/i18n";
import { applyOpsToRoom, diffRoom, parseRoomOps, parseRoomState, roomStateOf, type RoomOp, type RoomState } from "../lib/roomSync";
import { emptyModeState, sanitizeState, type Action, type AppState, type ModeState } from "../state/store";

export type RoomStatus = "connecting" | "connected" | "reconnecting" | "closed" | "unavailable";
export interface RoomInfo {
  id: string;
  creator: boolean;
  status: RoomStatus;
  members: number;
}

const SESSION_KEY = "tqp:room";
export const backupKey = (mode: GameMode) => `tqp:beforeRoom:${mode}`;
export const ROOM_ID = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const MODE_IDS: GameMode[] = ["regular", "pve", "pvp-season"];
const SEND_DELAY = 150;
const MAX_OPS = 1000;
const CLOSED_AFTER = 6; // essais (2,5 s) d'un non-créateur avant « Room fermée »

let activeRoom = false;
/** Vrai quand ce navigateur est dans une room (sert à prévenir que les réinitialisations sont partagées). */
export const inRoom = () => activeRoom;

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

interface Hooks {
  /** ModeState du mode de la room (état local courant). */
  getMode: (mode: GameMode) => ModeState | undefined;
  onSnapshot: (mode: GameMode, state: RoomState, first: boolean) => void;
  onOps: (mode: GameMode, ops: RoomOp[]) => void;
  onInfo: (patch: Partial<RoomInfo>) => void;
  onMode: (mode: GameMode) => void;
  onError: (message: string) => void;
}

export class RoomClient {
  readonly clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  private synced: RoomState | null = null;
  private es: EventSource | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private hadSnapshot = false;
  private recovering = false;
  private sending = false;

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

  /** À appeler après chaque changement d'état local. */
  schedule(delay = SEND_DELAY) {
    if (this.stopped || !this.synced) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private connect() {
    if (this.stopped) return;
    const es = new EventSource(`/api/rooms/${this.id}/events?client=${this.clientId}`);
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
    if (msg.type === "snapshot") {
      const state = parseRoomState(msg.state);
      const mode = MODE_IDS.find((m) => m === msg.mode);
      if (!state || !mode) return;
      const first = !this.hadSnapshot;
      this.hadSnapshot = true;
      this.mode = mode;
      this.synced = state;
      this.hooks.onMode(mode);
      this.hooks.onSnapshot(mode, state, first);
      this.hooks.onInfo({ status: "connected", members: Number(msg.members) || 1 });
      this.schedule(); // à la jointure : envoie ce que le local avait en plus
    } else if (msg.type === "op" && this.synced && this.mode) {
      const ops = parseRoomOps(msg.ops);
      if (!ops || msg.from === this.clientId) return;
      this.synced = applyOpsToRoom(this.synced, ops);
      this.hooks.onOps(this.mode, ops);
    } else if (msg.type === "members") {
      this.hooks.onInfo({ members: Number(msg.members) || 1 });
    }
  }

  private async flush() {
    if (this.stopped || !this.synced || !this.mode) return;
    if (this.sending) return this.schedule();
    const ops = diffRoom(this.synced, roomStateOf(this.hooks.getMode(this.mode)));
    if (!ops.length) return;
    const chunk = ops.slice(0, MAX_OPS);
    this.sending = true;
    let again = ops.length > chunk.length;
    try {
      const r = await api("POST", `/api/rooms/${this.id}/ops`, { client: this.clientId, ops: chunk });
      if (r.status === 200) {
        if (this.synced) this.synced = applyOpsToRoom(this.synced, chunk);
      } else if (r.status === 404) {
        this.es?.close();
        void this.recover();
        again = false;
      } else {
        again = false;
        this.hooks.onError(tr("La room a refusé ces changements (limite atteinte).", "The room refused these changes (limit reached)."));
      }
    } catch {
      again = true; // réseau coupé : on réessaie
    } finally {
      this.sending = false;
    }
    if (again) this.schedule(2000);
  }

  /** Connexion perdue pour de bon : la room existe-t-elle encore ? Le créateur la recrée si besoin. */
  private async recover() {
    if (this.recovering) return;
    this.recovering = true;
    this.hooks.onInfo({ status: "reconnecting" });
    try {
      for (let attempt = 0; !this.stopped; attempt++) {
        try {
          const r = await api("GET", `/api/rooms/${this.id}`);
          if (r.status === 200) return this.connect();
          if (r.status === 404 && this.creator && this.mode) {
            const put = await api("PUT", `/api/rooms/${this.id}`, { mode: this.mode, state: roomStateOf(this.hooks.getMode(this.mode)) });
            if (put.status === 200) return this.connect();
          } else if (!this.creator && attempt + 1 >= CLOSED_AFTER) {
            return this.hooks.onInfo({ status: "closed" });
          }
        } catch (e) {
          if (e instanceof Unavailable && (e.hosting || !this.hadSnapshot)) return this.hooks.onInfo({ status: "unavailable" });
        }
        await sleep(Math.min(2500 + attempt * 1000, 10000));
      }
    } finally {
      this.recovering = false;
    }
  }
}

// --- sessionStorage : la room survit à un rechargement de la page ---

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

/** Hook de l'application : une room à la fois, synchronisée avec le reducer. */
export function useRoom(state: AppState, dispatch: Dispatch<Action>) {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Après « Quitter » : propose de garder la room ou de restaurer l'état d'avant. */
  const [offer, setOffer] = useState<GameMode | null>(null);
  const client = useRef<RoomClient | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => client.current?.schedule(), [state]);

  const stop = useCallback(() => {
    client.current?.stop();
    client.current = null;
    activeRoom = false;
  }, []);

  const begin = useCallback(
    (id: string, creator: boolean, mode: GameMode | null, fresh: boolean) => {
      stop();
      setError(null);
      setOffer(null);
      activeRoom = true;
      writeSaved({ id, creator, mode });
      setInfo({ id, creator, status: "connecting", members: 1 });
      const c = new RoomClient(id, creator, mode, {
        getMode: (m) => stateRef.current.modes[m],
        onMode: (m) => writeSaved({ id, creator, mode: m }),
        onSnapshot: (m, roomState, first) => {
          const cur = stateRef.current;
          if (first && fresh) {
            try {
              localStorage.setItem(backupKey(m), JSON.stringify(cur.modes[m] ?? emptyModeState()));
            } catch {
              /* stockage plein : pas de sauvegarde */
            }
          }
          if (cur.gameMode !== m) {
            if (cur.gameMode) setNotice(tr(`La room est en mode ${m === "regular" ? "PvP" : m === "pve" ? "PvE" : "PvP Saison"} : vous y avez été basculé.`, `The room is in ${m === "regular" ? "PvP" : m === "pve" ? "PvE" : "PvP Season"} mode: you were switched to it.`));
            dispatch({ type: "setGameMode", mode: m });
          }
          dispatch({ type: "roomSnapshot", mode: m, state: roomState, replace: !first });
        },
        onOps: (m, ops) => dispatch({ type: "roomOps", mode: m, ops }),
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
    if (saved) begin(saved.id, saved.creator, saved.mode, false);
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
      const r = await api("POST", "/api/rooms", { mode, state: roomStateOf(state.modes[mode]) });
      if (r.status === 201 && typeof r.data.id === "string") begin(r.data.id, true, mode, true);
      else setError(tr("Création impossible (limite du serveur atteinte ?).", "Could not create the room (server limit reached?)."));
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
      const r = await api("GET", `/api/rooms/${id}`);
      if (r.status === 200) begin(id, false, null, true);
      else setError(tr("Room introuvable.", "Room not found."));
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    const mode = client.current ? readSaved()?.mode ?? null : null;
    stop();
    writeSaved(null);
    setInfo(null);
    try {
      if (mode && localStorage.getItem(backupKey(mode))) setOffer(mode);
    } catch {
      /* stockage indisponible */
    }
  };

  const dropBackup = (mode: GameMode) => {
    try {
      localStorage.removeItem(backupKey(mode));
    } catch {
      /* rien */
    }
    setOffer(null);
  };
  const keepRoomState = () => offer && dropBackup(offer);
  const restoreBefore = () => {
    if (!offer) return;
    try {
      const saved = sanitizeState({ modes: { [offer]: JSON.parse(localStorage.getItem(backupKey(offer)) ?? "null") } }).modes[offer];
      if (saved) dispatch({ type: "restoreMode", mode: offer, state: saved });
    } catch {
      /* sauvegarde illisible : on garde l'état actuel */
    }
    dropBackup(offer);
  };

  return { info, notice, dismissNotice: () => setNotice(null), error, busy, offer, create, join, leave, keepRoomState, restoreBefore };
}
