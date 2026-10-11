// Sorties, coops et transits de la map affichée.
// Étages comme pour les points de quête : une sortie d'un étage souterrain n'apparaît
// que sur cet étage ; une sortie d'un étage supérieur est sur la carte de base, avec
// son numéro d'étage. Les noms sont masqués quand la carte est trop dézoomée.
import { useEffect } from "react";
import type L from "leaflet";
import { Marker, Popup, Tooltip, useMap } from "react-leaflet";
import type { GameMap, MapExit } from "../types";
import type { MapCalibration } from "./calibration";
import { gameToLatLng } from "./crs";
import { displayLevelOf, levelBadge, levelName, upperLevelOf, type Level } from "./levels";
import { exitIcon } from "./exitIcons";
import { EXIT_KIND_LABELS, factionLabel } from "../lib/exits";
import { tr } from "../lib/i18n";

/** Zoom (au-dessus du zoom d'ouverture, qui montre toute la carte) à partir duquel les noms s'affichent. */
const LABEL_ZOOM_MARGIN = 0.5;

/** Ajoute la classe « exit-labels-hidden » à la carte tant qu'elle est trop dézoomée. */
function LabelZoom({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    // zoom qui montre toute la map (la vue peut avoir été restaurée plus zoomée par FitBounds)
    const threshold = map.getBoundsZoom(bounds) + LABEL_ZOOM_MARGIN;
    const update = () => {
      const container = map.getContainer();
      container.classList.toggle("exit-labels-hidden", map.getZoom() < threshold);
      container.dataset.zoom = map.getZoom().toFixed(2); // aide au diagnostic
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
      map.getContainer().classList.remove("exit-labels-hidden");
    };
  }, [map]);
  return null;
}

function ExitInfo({ exit, maps, floor }: { exit: MapExit; maps: GameMap[]; floor: string | null }) {
  const destination = exit.destinationMapId ? maps.find((m) => m.id === exit.destinationMapId)?.name : null;
  return (
    <div className="exit-info">
      <strong>{exit.name}</strong>
      <div>{EXIT_KIND_LABELS[exit.kind]}</div>
      {exit.kind !== "transit" && <div>{tr("Faction : ", "Faction: ")}{factionLabel(exit.factions)}</div>}
      {destination && <div>{tr("Vers : ", "To: ")}{destination}</div>}
      {floor && <div>{tr("Étage : ", "Floor: ")}{floor}</div>}
    </div>
  );
}

export function ExitsLayer(props: {
  exits: MapExit[];
  maps: GameMap[];
  calibration?: MapCalibration;
  level: Level;
  /** Emprise de la map : le seuil des noms part du zoom qui la montre en entier. */
  bounds: L.LatLngBounds;
}) {
  const { calibration, level } = props;
  return (
    <>
      <LabelZoom bounds={props.bounds} />
      {props.exits.map((exit) => {
        const p = { ...exit.position, top: exit.top, bottom: exit.bottom };
        const shownOn = displayLevelOf(p, calibration);
        // sortie souterraine : seulement sur son étage
        if (shownOn !== null && shownOn !== level) return null;
        const offLevel = shownOn !== level;
        const upper = upperLevelOf(p, calibration);
        const floor = upper !== null || shownOn !== null ? levelName(calibration, upper ?? shownOn) : null;
        return (
          <Marker
            key={exit.id}
            position={gameToLatLng(exit.position)}
            icon={exitIcon(exit, {
              offLevel,
              badge: upper !== null && calibration ? levelBadge(calibration, upper) : undefined,
            })}
            zIndexOffset={offLevel ? -1100 : -100}
            keyboard={false}
          >
            <Tooltip direction="top" className="exit-tooltip">
              <ExitInfo exit={exit} maps={props.maps} floor={floor} />
            </Tooltip>
            <Popup minWidth={180}>
              <ExitInfo exit={exit} maps={props.maps} floor={floor} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
