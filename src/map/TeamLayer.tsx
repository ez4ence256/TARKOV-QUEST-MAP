// Coéquipiers d'une room sur la carte, en lecture seule : leurs objectifs en cours (contour en tirets + initiale du pseudo)
// et leur position. Le pseudo est non fiable : texte React dans les popups, escapeHtml dans tout HTML Leaflet (teamIcons.ts).
import { useMemo } from "react";
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
}
export interface TeamPlayer {
  id: string;
  name: string;
  position: RoomPosition;
}

export function TeamLayer({ markers, players, coordinateRotation }: { markers: TeamMarker[]; players: TeamPlayer[]; coordinateRotation: number }) {
  return (
    <>
      {markers.map((m) => (
        <TeamPoint key={m.key} marker={m} />
      ))}
      {players.map((p) => (
        <PlayerMarker key={p.id} player={p.position} coordinateRotation={coordinateRotation} name={p.name} />
      ))}
    </>
  );
}

function TeamPoint({ marker: m }: { marker: TeamMarker }) {
  const icon = useMemo(() => teamPinIcon(m.owner, m.color), [m.owner, m.color]);
  return (
    <>
      {m.outline && (
        <Polygon positions={m.outline.map(gameToLatLng)} pathOptions={{ color: m.color, weight: 1, opacity: 0.6, fillOpacity: 0.06, dashArray: "2 4" }} interactive={false} />
      )}
      <Marker position={gameToLatLng(m)} icon={icon} zIndexOffset={-500}>
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
            <div className="popup-spawn">{tr("Lecture seule : c'est son objectif, pas le tien.", "Read-only: this is their objective, not yours.")}</div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}
