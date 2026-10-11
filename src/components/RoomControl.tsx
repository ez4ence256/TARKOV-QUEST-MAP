// Contrôle « Room » de la barre du haut : créer, rejoindre, copier l'ID, quitter.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { tr } from "../lib/i18n";
import type { useRoom } from "../api/room";

export function RoomControl({ room }: { room: ReturnType<typeof useRoom> }) {
  const { info, error, busy, offer } = room;
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void room.join(joinId);
  };

  return (
    <div className="room" ref={wrap}>
      <button
        ref={toggle}
        className={`btn btn-small room-toggle ${info ? "is-active" : ""}`}
        aria-expanded={open}
        aria-controls="room-popover"
        title={tr("Jouer en groupe : partager sélection et progression", "Play as a group: share selection and progress")}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">👥</span>
        <span className="room-label">{info ? info.id : "Room"}</span>
        {info && <span className={`room-dot room-dot-${info.status}`} aria-hidden="true" />}
        <span className="sr-only">{info ? `Room ${info.id}, ${statusText}` : "Room"}</span>
      </button>
      {open && (
        <div id="room-popover" className="room-popover" role="dialog" aria-label="Room">
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
              <p className="muted small">
                {tr(
                  "Quêtes choisies, objectifs et chapitres cochés sont partagés. Les réinitialisations aussi.",
                  "Selected quests, ticked objectives and chapters are shared. So are resets.",
                )}
              </p>
              <button className="btn btn-small btn-danger" onClick={room.leave}>
                {tr("Quitter", "Leave")}
              </button>
            </>
          ) : (
            <>
              {offer && (
                <div className="room-offer" role="group" aria-label={tr("Room quittée", "Room left")}>
                  <p className="small">{tr("Room quittée. Que faire de votre sélection ?", "Room left. What about your selection?")}</p>
                  <div className="btn-row">
                    <button className="btn btn-small" onClick={room.keepRoomState}>
                      {tr("Garder l'état de la room", "Keep the room's state")}
                    </button>
                    <button className="btn btn-small" onClick={room.restoreBefore}>
                      {tr("Restaurer mon état d'avant", "Restore my previous state")}
                    </button>
                  </div>
                </div>
              )}
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
                  "Sans mot de passe : toute personne qui a l'ID peut modifier la room.",
                  "No password: anyone with the ID can edit the room.",
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
