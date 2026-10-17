// Meilleurs spots d'un objet (item finder, « Voir sur la carte ») : un marqueur numéroté par spot de la
// map affichée, jusqu'à ce qu'on les retire.
import { Marker, Popup, Tooltip } from "react-leaflet";
import type L from "leaflet";
import { gameToLatLng } from "./crs";
import { markerIcon } from "./icons";
import { tr } from "../lib/i18n";

export const SPOT_COLOR = "#e2cf9a";

export interface ItemSpotMarker {
  /** Clé du marqueur (« spot:<n> »), pour le centrer. */
  key: string;
  mapId: string;
  x: number;
  y: number;
  z: number;
  /** Rang du spot (1 = meilleur). */
  rank: number;
  item: string;
  /** Nombre de points d'apparition regroupés et porte proche, déjà rédigés. */
  details: string[];
}

export function ItemSpotsLayer(props: { spots: ItemSpotMarker[]; register: (key: string) => (m: L.Marker | null) => void; onClear: () => void }) {
  return (
    <>
      {props.spots.map((s) => (
        <Marker key={s.key} ref={props.register(s.key)} position={gameToLatLng(s)} icon={markerIcon("loot", SPOT_COLOR, { badge: String(s.rank) })} title={`${s.item} — spot ${s.rank}`}>
          <Tooltip direction="top" offset={[0, -16]}>
            {s.item} — spot {s.rank}
          </Tooltip>
          <Popup minWidth={220} maxWidth={300}>
            <div className="popup">
              <div className="popup-task" style={{ color: SPOT_COLOR }}>
                {s.item} <span className="tag">{tr(`Spot ${s.rank}`, `Spot ${s.rank}`)}</span>
              </div>
              {s.details.map((d) => (
                <p key={d} className="popup-desc">
                  {d}
                </p>
              ))}
              <div className="popup-spawn">{tr("Points d'apparition au sol relevés par tarkov.dev", "Loose loot spawn points from tarkov.dev")}</div>
              <div className="popup-actions">
                <button className="btn btn-ghost" onClick={props.onClear}>
                  {tr("Retirer les spots", "Remove the spots")}
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
