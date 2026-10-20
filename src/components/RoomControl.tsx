// Contrôle « Room » de la barre du haut : créer, rejoindre, copier l'ID, quitter.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { tr } from "../lib/i18n";
import { UiIcon } from "./UiIcon";
import type { useRoom } from "../api/room";
import { DEFAULT_NICKNAME, MAX_NICKNAME } from "../lib/roomSync";

export function RoomControl({ room, variant }: { room: ReturnType<typeof useRoom>; variant?: "rail" }) {
  const rail = variant === "rail";
  const { info, error, busy } = room;
  const [open, setOpen] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Échap ferme (focus rendu au bouton) ; un clic ailleurs ferme aussi
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const statusText = !info
    ? ""
    : info.status === "connected"
      ? tr("Connecté", "Connected")
      : info.status === "closed"
        ? tr("Room fermée", "Room closed")
        : info.status === "unavailable"
          ? tr("Rooms indisponibles sur cet hébergement", "Rooms are not available on this hosting")
          : tr("Connexion…", "Connecting…");

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers refusé : l'ID reste affiché et sélectionnable */
    }
  };

  const nickname = (
    <label className="room-name">
      <span className="small">{tr("Ton pseudo", "Your nickname")}</span>
      <input
        className="input"
        value={room.name}
        maxLength={MAX_NICKNAME}
        placeholder={DEFAULT_NICKNAME}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => room.setName(e.target.value)}
      />
    </label>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void room.join(joinId);
  };

  return (
    <div className={rail ? "room room-rail" : "room"} ref={wrap}>
      <button
        ref={toggle}
        className={`${rail ? "rail-item" : "btn btn-small room-toggle"} ${info ? "is-active" : ""}`}
        aria-expanded={open}
        aria-controls="room-popover"
        title={tr("Jouer en groupe : voir les quêtes de ses coéquipiers", "Play as a group: see your teammates' quests")}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon id="users" size={rail ? 22 : 18} />
        <span className={rail ? "rail-label" : "room-label"}>{info ? info.id : "Room"}</span>
        {info && <span className={`room-dot room-dot-${info.status}`} aria-hidden="true" />}
        <span className="sr-only">{info ? `Room ${info.id}, ${statusText}` : "Room"}</span>
      </button>
      {open && (
        <div id="room-popover" className={`room-popover${rail ? " room-popover-rail" : ""}`} role="dialog" aria-label="Room">
          {info ? (
            <>
              <div className="room-id-row">
                <code className="room-id">{info.id}</code>
                <button className="btn btn-small" onClick={copy}>
                  {copied ? tr("Copié", "Copied") : tr("Copier", "Copy")}
                </button>
              </div>
              <p className="small" role="status">
                {statusText} · {tr(`${info.members} membre${info.members > 1 ? "s" : ""}`, `${info.members} member${info.members > 1 ? "s" : ""}`)}
              </p>
              {nickname}
              <p className="muted small">
                {tr(
                  "Tes quêtes restent à toi : la room montre aux autres ce que tu affiches (quêtes choisies, objectifs cochés, position) et te montre le leur, en lecture seule.",
                  "Your quests stay yours: the room shows the others what you display (selected quests, ticked objectives, position) and shows you theirs, read-only.",
                )}
              </p>
              <button className="btn btn-small btn-danger" onClick={room.leave}>
                {tr("Quitter", "Leave")}
              </button>
            </>
          ) : (
            <>
              {nickname}
              <button className="btn btn-primary btn-small" onClick={() => void room.create()} disabled={busy}>
                {tr("Créer une room", "Create a room")}
              </button>
              <form className="room-join" onSubmit={submit}>
                <label>
                  <span className="sr-only">{tr("ID de la room", "Room ID")}</span>
                  <input
                    className="input"
                    value={joinId}
                    maxLength={6}
                    placeholder="ID"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                  />
                </label>
                <button className="btn btn-small" type="submit" disabled={busy || joinId.trim().length === 0}>
                  {tr("Rejoindre", "Join")}
                </button>
              </form>
              <p className="muted small">
                {tr(
                  "Sans mot de passe : toute personne qui a l'ID voit ce que tu publies (pseudo, quêtes, position).",
                  "No password: anyone with the ID sees what you publish (nickname, quests, position).",
                )}
              </p>
            </>
          )}
          {error && (
            <p className="room-error small" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
