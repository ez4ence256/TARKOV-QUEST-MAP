// Coéquipiers d'une room sur la carte, en lecture seule : leurs objectifs en cours (contour en tirets + initiale du pseudo)
// et leur position. Le pseudo est non fiable : texte React dans les popups, escapeHtml dans tout HTML Leaflet (teamIcons.ts).
import { useEffect, useMemo, useState } from "react";
import { Marker, Polygon, Popup, Tooltip } from "react-leaflet";
import type { GamePosition } from "../types";
import type { RoomPosition } from "../lib/roomSync";
import { tr } from "../lib/i18n";
import { gameToLatLng } from "./crs";
import { PlayerMarker } from "./PlayerMarker";
import { teamPinIcon } from "./teamIcons";

export interface TeamMarker {
  key: string;
  /** Pseudo du coéquipier. */
  owner: string;
  x: number;
  z: number;
  outline?: GamePosition[];
  color: string;
  /** « Quête — objectif » ou « Chapitre — étape ». */
  text: string;
  /** Emplacements possibles d'un même objet : un seul point (rep) tant que le groupe n'est pas déplié. */
  group?: { id: string; rep: boolean; count: number };
}
export interface TeamPlayer {
  id: string;
  name: string;
  position: RoomPosition;
}

export function TeamLayer({ markers, players, coordinateRotation }: { markers: TeamMarker[]; players: TeamPlayer[]; coordinateRotation: number }) {
  // groupes dépliés de mon côté ; un groupe qui disparaît (quête retirée) redevient replié
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(markers.flatMap((m) => (m.group ? [m.group.id] : [])));
    setOpen((s) => {
      const kept = [...s].filter((id) => ids.has(id));
      return kept.length === s.size ? s : new Set(kept);
    });
  }, [markers]);
  const toggle = (id: string, on: boolean) =>
    setOpen((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <>
      {markers.map((m) => {
        const folded = Boolean(m.group) && !open.has(m.group!.id);
        if (folded && !m.group!.rep) return null;
        return (
          <TeamPoint
            key={m.key}
            marker={m}
            count={folded ? m.group!.count : undefined}
            onUnfold={folded ? () => toggle(m.group!.id, true) : undefined}
            onFold={m.group && !folded ? () => toggle(m.group!.id, false) : undefined}
          />
        );
      })}
      {players.map((p) => (
        <PlayerMarker key={p.id} player={p.position} coordinateRotation={coordinateRotation} name={p.name} />
      ))}
    </>
  );
}

function TeamPoint({ marker: m, count, onUnfold, onFold }: { marker: TeamMarker; count?: number; onUnfold?: () => void; onFold?: () => void }) {
  const icon = useMemo(() => teamPinIcon(m.owner, m.color, count), [m.owner, m.color, count]);
  return (
    <>
      {m.outline && (
        <Polygon positions={m.outline.map(gameToLatLng)} pathOptions={{ color: m.color, weight: 1, opacity: 0.6, fillOpacity: 0.06, dashArray: "2 4" }} interactive={false} />
      )}
      <Marker position={gameToLatLng(m)} icon={icon} zIndexOffset={-500} eventHandlers={onUnfold ? { click: onUnfold } : undefined}>
        <Tooltip direction="top" offset={[0, -14]}>
          {m.owner}
        </Tooltip>
        <Popup minWidth={200} maxWidth={300}>
          <div className="popup">
            <div className="popup-task" style={{ color: m.color }}>
              {tr("Objectif de", "Objective of")} {m.owner}
              {" :"}
            </div>
            <p className="popup-desc">{m.text}</p>
            {count && <div className="popup-spawn">{tr(`${count} emplacements possibles`, `${count} possible locations`)}</div>}
            {onFold && (
              <button className="btn btn-ghost btn-small" onClick={onFold}>
                {tr("Regrouper en un seul point", "Fold into a single point")}
              </button>
            )}
            <div className="popup-spawn">{tr("Lecture seule : c'est son objectif, pas le tien.", "Read-only: this is their objective, not yours.")}</div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
