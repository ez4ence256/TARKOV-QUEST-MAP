// Carte Leaflet (CRS.Simple calibré) avec les points des quêtes et les points perso.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { GameMap, MapPoint, Objective, Task } from "../types";
import type { Action, CustomPoint, ModeState } from "../state/store";
import type { MapCalibration, RawBounds } from "./calibration";
import { gameToLatLng, getCRS, latLngToGame, toLatLngBounds } from "./crs";
import { markerIcon } from "./icons";
import { BaseLayer, type BaseStatus } from "./BaseLayer";
import { ExitsLayer } from "./ExitsLayer";
import { StoryLayer } from "./StoryLayer";
import { ItemSpotsLayer, type ItemSpotMarker } from "./ItemSpotsLayer";
import { LabyrinthLayer } from "./LabyrinthLayer";
import { labyrinthFor } from "../lib/labyrinth";
import type { StoryMapPoint } from "../lib/storyPoints";
import type { ExitPhotosTarget } from "../components/PhotosTab";
import { floorFromText } from "../lib/floorText";
import {
  displayLevelOf,
  isShownOnLevel,
  extentOf,
  levelBadge,
  levelName,
  levelOf,
  selectableLevels,
  selectableUpperOf,
  upperLevelOf,
  type Level,
} from "./levels";
import { CUSTOM_POINT_COLOR, categoryOf } from "../lib/objectiveTypes";
import { CustomPopup, ObjectivePopup } from "../components/PointPopups";
import { tr, getLang } from "../lib/i18n";
import { exitsNearMap, visibleExits } from "../lib/exits";

const SHOW_EXITS_KEY = "tqp:showExits";
const SHOW_LAB_KEY = "tqp:showLabyrinth";

export type Placing = { kind: "manual"; objectiveId: string; label: string } | { kind: "custom" } | null;

interface MapViewProps {
  map: GameMap;
  /** Toutes les maps (noms des destinations de transit). */
  maps: GameMap[];
  calibration?: MapCalibration;
  points: MapPoint[];
  customPoints: CustomPoint[];
  tasksById: Map<string, Task>;
  objectivesById: Map<string, Objective>;
  colorOf: (taskId: string) => string;
  mode: ModeState;
  dispatch: (a: Action) => void;
  placing: Placing;
  onPlace: (pos: { x: number; z: number }) => void;
  /** Ouvre l'onglet Photos sur une quête. */
  onPhotos: (taskId: string) => void;
  /** Clic sur une sortie : ouvre l'onglet Photos sur elle. */
  onExit: (target: ExitPhotosTarget) => void;
  /** Ouvre l'onglet Quête sur une quête. */
  onQuest: (taskId: string) => void;
  /** Point à centrer / ouvrir (ex. clic dans le panneau) ; n change à chaque demande. */
  focus: { key: string; n: number } | null;
  /** Case « Extracts Scav » de la barre du haut. */
  showScavExits: boolean;
  /** Case en cours des chapitres Main story sélectionnés, sur cette map. */
  storyPoints: StoryMapPoint[];
  storyName: (chapter: string) => string;
  onStoryDone: (chapter: string, stepKey: string) => void;
  onStoryOpen: (chapter: string) => void;
  onStoryPhotos: (chapter: string, stepKey: string, source: string) => void;
  /** Meilleurs spots d'un objet (item finder), toutes maps : seuls ceux de cette map sont montrés. */
  itemSpots: ItemSpotMarker[];
  onClearItemSpots: () => void;
}

/** Emprise par défaut quand une map n'a pas de calibrage : celle des points, sinon un carré. */
function boundsFromPoints(points: { x: number; z: number }[]): RawBounds {
  if (points.length === 0) return [[-500, -500], [500, 500]];
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const pad = 50;
  return [
    [Math.max(...xs) + pad, Math.max(...zs) + pad],
    [Math.min(...xs) - pad, Math.min(...zs) - pad],
  ];
}

function MapEvents({ placing, onPlace, onMove }: {
  placing: Placing;
  onPlace: MapViewProps["onPlace"];
  onMove: (p: { x: number; z: number } | null) => void;
}) {
  // Références toujours à jour : un clic juste après "Placer" doit être pris en compte
  // même si Leaflet n'a pas encore reçu les nouveaux gestionnaires.
  const latest = useRef({ placing, onPlace });
  latest.current = { placing, onPlace };
  useMapEvents({
    click(e) {
      if (latest.current.placing) latest.current.onPlace(latLngToGame(e.latlng));
    },
    mousemove(e) {
      onMove(latLngToGame(e.latlng));
    },
    mouseout() {
      onMove(null);
    },
  });
  return null;
}

/** Ferme les popups ouvertes quand on passe en mode placement (sinon elles gênent le clic). */
function ClosePopupsWhenPlacing({ placing }: { placing: Placing }) {
  const map = useMap();
  useEffect(() => {
    if (placing) map.closePopup();
  }, [placing, map]);
  return null;
}

/** Crédit du fond de carte (tuiles tarkov.dev), sans le lien Leaflet par défaut. */
function AttributionPrefix() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return null;
}

/** Leaflet ne suit que la taille de la fenêtre : on le prévient quand le panneau change de largeur. */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Dernière vue de la map affichée : MapView est recréé (langue, calibrage en ligne) sans changement de map.
let lastView: { mapId: string; center: L.LatLng; zoom: number } | null = null;

function FitBounds({ bounds, mapId }: { bounds: L.LatLngBounds; mapId: string }) {
  const map = useMap();
  useEffect(() => {
    // on ne recadre qu'au changement de map ; sinon on reprend la vue où elle était
    if (lastView?.mapId === mapId) map.setView(lastView.center, lastView.zoom, { animate: false });
    else {
      map.fitBounds(bounds);
      lastView = { mapId, center: map.getCenter(), zoom: map.getZoom() };
    }
    const save = () => {
      lastView = { mapId, center: map.getCenter(), zoom: map.getZoom() };
    };
    map.on("moveend zoomend", save);
    return () => {
      map.off("moveend zoomend", save);
    };
  }, [map]);
  return null;
}

/** Centre la carte sur un point demandé depuis le panneau et ouvre sa popup. */
function FocusPoint({ focus, points, markers, onLevel }: {
  focus: MapViewProps["focus"];
  points: { key: string; x: number; z: number }[];
  markers: React.RefObject<Map<string, L.Marker>>;
  /** Affiche l'étage du point demandé. */
  onLevel: (p: { x: number; z: number }) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const p = points.find((pt) => pt.key === focus.key);
    if (!p) return;
    onLevel(p);
    map.setView(gameToLatLng(p), Math.max(map.getZoom(), map.getMinZoom() + 2));
    // la popup s'ouvre une fois le marqueur rendu
    setTimeout(() => markers.current?.get(focus.key)?.openPopup(), 0);
    // volontairement déclenché seulement par une nouvelle demande (pas par l'ajout de points)
  }, [focus, map]);
  return null;
}

function MapViewInner(props: MapViewProps) {
  const { calibration, points, customPoints, mode, dispatch } = props;
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const [baseStatus, setBaseStatus] = useState<BaseStatus>("loading");
  const [level, setLevel] = useState<Level>(null);
  // sorties affichées par défaut ; le choix est retenu dans le navigateur
  const [showExits, setShowExits] = useState(() => {
    try {
      return localStorage.getItem(SHOW_EXITS_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // infos du Labyrinthe (map « the-labyrinth » seulement), affichées par défaut
  const labyrinth = labyrinthFor(props.map.normalizedName);
  const [showLab, setShowLab] = useState(() => {
    try {
      return localStorage.getItem(SHOW_LAB_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const toggleLab = () =>
    setShowLab((v) => {
      try {
        localStorage.setItem(SHOW_LAB_KEY, v ? "0" : "1");
      } catch {
        /* préférence non retenue */
      }
      return !v;
    });
  const toggleExits = () =>
    setShowExits((v) => {
      try {
        localStorage.setItem(SHOW_EXITS_KEY, v ? "0" : "1");
      } catch {
        /* préférence non retenue */
      }
      return !v;
    });
  const exits = useMemo(
    () => visibleExits(exitsNearMap(props.map.exits ?? [], calibration?.bounds), props.showScavExits),
    [props.map, props.showScavExits, calibration],
  );
  const layers = calibration?.layers ?? [];
  // niveaux du sélecteur : principal + souterrains (les autres étages supérieurs sont sur la carte de base)
  const pickerLevels = useMemo(() => selectableLevels(calibration), [calibration]);
  const markers = useMemo(() => ({ current: new Map<string, L.Marker>() }), []);

  const crs = useMemo(() => getCRS(calibration), [calibration]);
  // Emprise : calibrage si connu, sinon déduite des points (calculée une seule fois par map).
  const rawBounds = useMemo<RawBounds>(
    () => calibration?.bounds ?? boundsFromPoints([...points, ...customPoints]),
    [calibration],
  );
  const bounds = useMemo(() => toLatLngBounds(rawBounds), [rawBounds]);
  // un cran de dézoom de plus que tarkov.dev, pour voir les grandes maps en entier
  const minZoom = calibration ? calibration.minZoom - 1 : -2;
  const maxZoom = calibration ? calibration.maxZoom + 1 : 6;
  const onStatus = useCallback((s: BaseStatus) => setBaseStatus(s), []);
  const showLevelOf = useCallback(
    (p: { x: number; z: number }) => setLevel(selectableUpperOf(p, calibration) ?? displayLevelOf(p, calibration)),
    [calibration],
  );
  // nombre de points restants par niveau, pour le sélecteur
  const levelCounts = useMemo(() => {
    const counts = new Map<Level, number>();
    for (const pt of points) {
      if (mode.done[pt.objectiveId ?? ""]) continue;
      const l = selectableUpperOf(pt, calibration) ?? displayLevelOf(pt, calibration); // étage supérieur du sélecteur : compté chez lui seulement
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return counts;
  }, [points, mode.done, calibration]);

  const registerMarker = (key: string) => (m: L.Marker | null) => {
    if (m) markers.current.set(key, m);
    else markers.current.delete(key);
  };

  const spotsHere = useMemo(() => props.itemSpots.filter((s) => s.mapId === props.map.id), [props.itemSpots, props.map.id]);
  const allFocusable = useMemo(
    () => [...points, ...customPoints.map((c) => ({ key: `custom:${c.id}`, x: c.x, z: c.z })), ...spotsHere],
    [points, customPoints, spotsHere],
  );

  return (
    <div className={`map-wrap ${props.placing ? "is-placing" : ""}`}>
      <MapContainer
        crs={crs}
        // pas de maxBounds : déplacement libre, sans retour en arrière ; le recadrage se fait au changement de map
        bounds={bounds}
        minZoom={minZoom}
        maxZoom={maxZoom}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        attributionControl
        className="leaflet-map"
      >
        <FitBounds bounds={bounds} mapId={props.map.id} />
        <InvalidateOnResize />
        {showExits && exits.length > 0 && (
          <ExitsLayer exits={exits} maps={props.maps} calibration={calibration} level={level} bounds={bounds} mapTitle={props.map.nameEn ?? props.map.name} onExit={props.onExit} />
        )}
        <AttributionPrefix />
        <BaseLayer
          calibration={calibration}
          fallbackBounds={rawBounds}
          level={level === null ? null : (layers[level] ?? null)}
          onStatus={onStatus}
        />
        <ClosePopupsWhenPlacing placing={props.placing} />
        <MapEvents placing={props.placing} onPlace={props.onPlace} onMove={setCursor} />
        <FocusPoint focus={props.focus} points={allFocusable} markers={markers} onLevel={showLevelOf} />

        {labyrinth && showLab && <LabyrinthLayer data={labyrinth} />}
        <StoryLayer points={props.storyPoints} nameOf={props.storyName} onDone={props.onStoryDone} onOpen={props.onStoryOpen} onPhotos={props.onStoryPhotos} />
        <ItemSpotsLayer spots={spotsHere} register={registerMarker} onClear={props.onClearItemSpots} />

        {points.map((pt) => {
          const task = pt.taskId ? props.tasksById.get(pt.taskId) : undefined;
          const objective = pt.objectiveId ? props.objectivesById.get(pt.objectiveId) : undefined;
          if (!task || !objective) return null;
          const color = props.colorOf(task.id);
          const done = Boolean(mode.done[objective.id]);
          const manual = pt.kind === "manual";
          const pointLevel = levelOf(pt, calibration);
          const shownOn = displayLevelOf(pt, calibration);
          const offLevel = !isShownOnLevel(pt, calibration, level);
          const upper = upperLevelOf(pt, calibration);
          const textFloor = manual ? null : floorFromText(objective.description);
          return (
            <MarkerWithOutline
              key={pt.key}
              point={pt}
              color={color}
              title={`${task.name} — ${objective.description}${pt.spawn ? ` (${tr("emplacement possible", "possible location")} ${pt.spawn.index}/${pt.spawn.count})` : ""}`}
              icon={markerIcon(categoryOf(objective.type), color, {
                faded: done,
                offLevel,
                badge: upper !== null && calibration ? levelBadge(calibration, upper) || undefined : undefined,
              })}
              offLevel={offLevel}
              tooltip={upper !== null && calibration ? <UpperLevelTooltip point={pt} calibration={calibration} level={upper} /> : null}
              register={registerMarker(pt.key)}
              draggable={manual}
              onDragEnd={(p) =>
                dispatch({ type: "setManual", objectiveId: objective.id, position: { mapId: pt.mapId, ...p } })
              }
            >
              <ObjectivePopup
                task={task}
                objective={objective}
                color={color}
                mapName={props.map.name}
                note={mode.notes[pt.key] ?? ""}
                done={done}
                manual={manual}
                spawn={pt.spawn}
                onPhotos={task.wikiLink ? () => props.onPhotos(task.id) : undefined}
                onQuest={() => props.onQuest(task.id)}
                levelLabel={textFloor ?? (layers.length > 0 && !manual ? levelName(calibration, pointLevel) : undefined)}
                levelSource={textFloor ? tr("d'après la description", "from the description") : undefined}
                onShowLevel={offLevel ? () => setLevel(shownOn) : undefined}
                onNote={(note) => dispatch({ type: "setNote", key: pt.key, note })}
                onDone={(value) => dispatch({ type: "setDone", objectiveId: objective.id, done: value })}
                onRemoveManual={() => dispatch({ type: "setManual", objectiveId: objective.id, position: null })}
              />
            </MarkerWithOutline>
          );
        })}

        {customPoints.map((cp) => (
          <Marker
            key={cp.id}
            ref={registerMarker(`custom:${cp.id}`)}
            position={gameToLatLng(cp)}
            icon={markerIcon(cp.icon, CUSTOM_POINT_COLOR, { custom: true })}
            draggable
            title={cp.label || tr("Point perso", "Custom point")}
            eventHandlers={{
              dragend: (e) =>
                dispatch({ type: "updateCustom", id: cp.id, patch: latLngToGame((e.target as L.Marker).getLatLng()) }),
            }}
          >
            <Popup minWidth={240} maxWidth={300}>
              <CustomPopup
                point={cp}
                onChange={(patch) => dispatch({ type: "updateCustom", id: cp.id, patch })}
                onRemove={() => dispatch({ type: "removeCustom", id: cp.id })}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {exits.length > 0 && (
        <button
          className={`map-toggle exits-toggle ${showExits ? "is-on" : ""}`}
          aria-pressed={showExits}
          onClick={toggleExits}
          title={showExits ? tr("Masquer les sorties et transits", "Hide exits and transits") : tr("Afficher les sorties et transits", "Show exits and transits")}
        >
          <span className="exit-swatch" aria-hidden="true" /> {tr("Sorties", "Exits")}
        </button>
      )}
      {labyrinth && (
        <button
          className={`map-toggle lab-toggle ${showLab ? "is-on" : ""}`}
          style={{ top: exits.length > 0 ? 120 : 84 }}
          aria-pressed={showLab}
          onClick={toggleLab}
          title={showLab ? tr("Masquer les infos du Labyrinthe", "Hide the Labyrinth info") : tr("Afficher les infos du Labyrinthe", "Show the Labyrinth info")}
        >
          <span className="exit-swatch" aria-hidden="true" /> {tr("Infos du Labyrinthe", "Labyrinth info")}
        </button>
      )}
      {pickerLevels.length > 1 && (
        <div className="level-picker" role="radiogroup" aria-label={tr("Étage affiché", "Displayed floor")}>
          <div className="level-picker-title">{tr("Étage", "Floor")}</div>
          {pickerLevels.map((l) => (
            <button
              key={l ?? "main"}
              role="radio"
              aria-checked={level === l}
              className={`level-btn ${level === l ? "is-active" : ""}`}
              onClick={() => setLevel(l)}
            >
              <span>{levelName(calibration, l)}</span>
              {levelCounts.get(l) ? <span className="level-count">{levelCounts.get(l)}</span> : null}
            </button>
          ))}
        </div>
      )}
      {pickerLevels.length > 1 && (
        // version compacte pour téléphone (affichée par le CSS)
        <select
          className="input level-select"
          aria-label={tr("Étage affiché", "Displayed floor")}
          value={level ?? ""}
          onChange={(e) => setLevel(e.target.value === "" ? null : Number(e.target.value))}
        >
          {pickerLevels.map((l) => (
            <option key={l ?? "main"} value={l ?? ""}>
              {levelName(calibration, l)}
              {levelCounts.get(l) ? ` (${levelCounts.get(l)})` : ""}
            </option>
          ))}
        </select>
      )}
      {props.placing && (
        <div className="map-banner">
          {props.placing.kind === "manual"
            ? tr(`Cliquez sur la carte pour placer : ${props.placing.label}`, `Click on the map to place: ${props.placing.label}`)
            : tr("Cliquez sur la carte pour ajouter votre point", "Click on the map to add your point")}
        </div>
      )}
      {baseStatus === "grid" && (
        <div className="map-notice">
          {calibration
            ? tr("Pas de fond de carte pour cette map : grille affichée, positions calibrées.", "No base map for this map: grid shown, positions calibrated.")
            : tr("Map non calibrée : positions brutes du jeu, sans fond de carte.", "Map not calibrated: raw in-game positions, no base map.")}
        </div>
      )}
      <div className="map-coords" aria-live="off">
        {cursor ? `x ${cursor.x.toFixed(1)} · z ${cursor.z.toFixed(1)}` : "x — · z —"}
      </div>
    </div>
  );
}

const formatHeight = (n: number) => n.toLocaleString(getLang() === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 1 });
/** Tranche de hauteur lisible ; maps.json note les bornes ouvertes ±1000 ou ±10000. */
function formatExtent([low, high]: [number, number]) {
  if (high >= 1000) return tr(`au-dessus de ${formatHeight(low)} m`, `above ${formatHeight(low)} m`);
  if (low <= -1000) return tr(`sous ${formatHeight(high)} m`, `below ${formatHeight(high)} m`);
  return tr(`de ${formatHeight(low)} à ${formatHeight(high)} m`, `from ${formatHeight(low)} to ${formatHeight(high)} m`);
}

/** Infobulle d'un point d'étage supérieur : nom de l'étage, hauteur du point et de l'étage. */
function UpperLevelTooltip({ point, calibration, level }: {
  point: MapPoint;
  calibration: MapCalibration;
  level: number;
}) {
  const extent = extentOf(point, calibration.layers[level]);
  const height =
    point.bottom !== undefined && point.top !== undefined
      ? tr(`zone de ${formatHeight(point.bottom)} à ${formatHeight(point.top)} m`, `zone from ${formatHeight(point.bottom)} to ${formatHeight(point.top)} m`)
      : point.y !== undefined
        ? `${formatHeight(point.y)} m`
        : null;
  return (
    <>
      <strong>{levelName(calibration, level)}</strong>
      {height && <div>{tr("Hauteur du point : ", "Point height: ")}{height}</div>}
      {extent && <div className="muted">{tr("Étage : ", "Floor: ")}{formatExtent(extent)}</div>}
    </>
  );
}

/** Marqueur d'objectif + contour de zone (si l'API en fournit un). */
function MarkerWithOutline(props: {
  point: MapPoint;
  color: string;
  title: string;
  icon: L.DivIcon;
  register: (m: L.Marker | null) => void;
  draggable: boolean;
  offLevel: boolean;
  /** Infobulle au survol (étage des points des étages supérieurs). */
  tooltip: React.ReactNode;
  onDragEnd: (p: { x: number; z: number }) => void;
  children: React.ReactNode;
}) {
  const { point } = props;
  return (
    <>
      {point.outline && (
        <Polygon
          positions={point.outline.map(gameToLatLng)}
          pathOptions={{
            color: props.color,
            weight: 1,
            opacity: props.offLevel ? 0.25 : 0.7,
            fillOpacity: props.offLevel ? 0.04 : 0.12,
            dashArray: "4 3",
          }}
          interactive={false}
        />
      )}
      <Marker
        ref={props.register}
        position={gameToLatLng(point)}
        icon={props.icon}
        title={props.title}
        zIndexOffset={props.offLevel ? -1000 : 0}
        draggable={props.draggable}
        eventHandlers={
          props.draggable
            ? { dragend: (e) => props.onDragEnd(latLngToGame((e.target as L.Marker).getLatLng())) }
            : undefined
        }
      >
        {props.tooltip && (
          <Tooltip direction="top" offset={[0, -14]} className="level-tooltip">
            {props.tooltip}
          </Tooltip>
        )}
        <Popup minWidth={240} maxWidth={320}>
          {props.children}
        </Popup>
      </Marker>
    </>
  );
}

export const MapView = memo(MapViewInner);
