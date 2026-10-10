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
import {
  displayLevelOf,
  extentOf,
  levelBadge,
  levelName,
  levelOf,
  selectableLevels,
  upperLevelOf,
  type Level,
} from "./levels";
import { CUSTOM_POINT_COLOR, categoryOf } from "../lib/objectiveTypes";
import { CustomPopup, ObjectivePopup } from "../components/PointPopups";

export type Placing = { kind: "manual"; objectiveId: string; label: string } | { kind: "custom" } | null;

interface MapViewProps {
  map: GameMap;
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
  /** Ouvre l'onglet Quête sur une quête. */
  onQuest: (taskId: string) => void;
  /** Point à centrer / ouvrir (ex. clic dans le panneau) ; n change à chaque demande. */
  focus: { key: string; n: number } | null;
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

/** Agrandit une emprise d'un facteur (comme getScaledBounds de tarkov.dev). */
function scaleBounds(b: L.LatLngBounds, factor: number) {
  const c = b.getCenter();
  const dLat = ((b.getNorth() - b.getSouth()) * factor) / 2;
  const dLng = ((b.getEast() - b.getWest()) * factor) / 2;
  return L.latLngBounds([c.lat - dLat, c.lng - dLng], [c.lat + dLat, c.lng + dLng]);
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

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds);
    // seulement au montage : on ne recadre pas à chaque nouveau point
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
  const layers = calibration?.layers ?? [];
  // niveaux du sélecteur : principal + souterrains (les étages supérieurs sont sur la carte de base)
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
    (p: { x: number; z: number }) => setLevel(displayLevelOf(p, calibration)),
    [calibration],
  );
  // nombre de points restants par niveau, pour le sélecteur
  const levelCounts = useMemo(() => {
    const counts = new Map<Level, number>();
    for (const pt of points) {
      if (mode.done[pt.objectiveId ?? ""]) continue;
      const l = displayLevelOf(pt, calibration);
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return counts;
  }, [points, mode.done, calibration]);

  const registerMarker = (key: string) => (m: L.Marker | null) => {
    if (m) markers.current.set(key, m);
    else markers.current.delete(key);
  };

  const allFocusable = useMemo(
    () => [...points, ...customPoints.map((c) => ({ key: `custom:${c.id}`, x: c.x, z: c.z }))],
    [points, customPoints],
  );

  return (
    <div className={`map-wrap ${props.placing ? "is-placing" : ""}`}>
      <MapContainer
        crs={crs}
        bounds={bounds}
        maxBounds={scaleBounds(bounds, 1.5)}
        minZoom={minZoom}
        maxZoom={maxZoom}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        attributionControl
        className="leaflet-map"
      >
        <FitBounds bounds={bounds} />
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

        {points.map((pt) => {
          const task = pt.taskId ? props.tasksById.get(pt.taskId) : undefined;
          const objective = pt.objectiveId ? props.objectivesById.get(pt.objectiveId) : undefined;
          if (!task || !objective) return null;
          const color = props.colorOf(task.id);
          const done = Boolean(mode.done[objective.id]);
          const manual = pt.kind === "manual";
          const pointLevel = levelOf(pt, calibration);
          const shownOn = displayLevelOf(pt, calibration);
          const offLevel = shownOn !== level;
          const upper = upperLevelOf(pt, calibration);
          return (
            <MarkerWithOutline
              key={pt.key}
              point={pt}
              color={color}
              title={`${task.name} — ${objective.description}${pt.spawn ? ` (emplacement possible ${pt.spawn.index}/${pt.spawn.count})` : ""}`}
              icon={markerIcon(categoryOf(objective.type), color, {
                faded: done,
                offLevel,
                badge: upper !== null && calibration ? levelBadge(calibration, upper) : undefined,
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
                levelLabel={layers.length > 0 && !manual ? levelName(calibration, pointLevel) : undefined}
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
            title={cp.label || "Point perso"}
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

      {pickerLevels.length > 1 && (
        <div className="level-picker" role="radiogroup" aria-label="Étage affiché">
          <div className="level-picker-title">Étage</div>
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
          aria-label="Étage affiché"
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
            ? `Cliquez sur la carte pour placer : ${props.placing.label}`
            : "Cliquez sur la carte pour ajouter votre point"}
        </div>
      )}
      {baseStatus === "grid" && (
        <div className="map-notice">
          {calibration
            ? "Pas de fond de carte pour cette map : grille affichée, positions calibrées."
            : "Map non calibrée : positions brutes du jeu, sans fond de carte."}
        </div>
      )}
      <div className="map-coords" aria-live="off">
        {cursor ? `x ${cursor.x.toFixed(1)} · z ${cursor.z.toFixed(1)}` : "x — · z —"}
      </div>
    </div>
  );
}

const formatHeight = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
/** Tranche de hauteur lisible ; maps.json note les bornes ouvertes ±1000 ou ±10000. */
function formatExtent([low, high]: [number, number]) {
  if (high >= 1000) return `au-dessus de ${formatHeight(low)} m`;
  if (low <= -1000) return `sous ${formatHeight(high)} m`;
  return `de ${formatHeight(low)} à ${formatHeight(high)} m`;
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
      ? `zone de ${formatHeight(point.bottom)} à ${formatHeight(point.top)} m`
      : point.y !== undefined
        ? `${formatHeight(point.y)} m`
        : null;
  return (
    <>
      <strong>{levelName(calibration, level)}</strong>
      {height && <div>Hauteur du point : {height}</div>}
      {extent && <div className="muted">Étage : {formatExtent(extent)}</div>}
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
