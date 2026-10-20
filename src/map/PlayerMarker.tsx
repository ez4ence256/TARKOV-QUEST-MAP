// Position du joueur envoyée par le Monitor : flèche orientée qui s'efface en 5 minutes.
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { tr } from "../lib/i18n";
import { arrowAngle, playerOpacity } from "../lib/playerMarker";
import { gameToLatLng } from "./crs";

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
  rotation: number;
  /** Heure de réception (ms). */
  at: number;
}

export function PlayerMarker({ player, coordinateRotation }: { player: PlayerPosition; coordinateRotation: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [player]);
  const angle = arrowAngle(player.rotation, coordinateRotation);
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "player-marker",
        html: `<svg width="28" height="28" viewBox="-14 -14 28 28" style="transform:rotate(${angle}deg)"><path d="M0 -12 L8 10 L0 5 L-8 10 Z" fill="#35d07f" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -12],
      }),
    [angle],
  );
  const age = now - player.at;
  const opacity = playerOpacity(age);
  if (opacity <= 0) return null;
  const min = Math.max(0, Math.floor(age / 60000));
  return (
    <Marker position={gameToLatLng(player)} icon={icon} opacity={opacity} zIndexOffset={5000}>
      <Popup>{tr(`Ta position (capture d'écran, il y a ${min} min)`, `Your position (screenshot, ${min} min ago)`)}</Popup>
    </Marker>
  );
}
