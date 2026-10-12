// Fond de carte : SVG de tarkov-dev-svg-maps posé sur l'emprise calibrée,
// sinon tuiles d'image de tarkov.dev (Labs, Labyrinth, Icebreaker),
// sinon simple grille. Par-dessus : l'étage choisi, le niveau principal étant atténué.
import { useEffect, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { MapCalibration, MapLayer, RawBounds } from "./calibration";
import { toLatLngBounds } from "./crs";
import { mainExtraSvgLayers } from "./levels";
import { parkingAttribution, svgMatrixFor } from "./basement";
import { tr } from "../lib/i18n";

const svgCache = new Map<string, Promise<string>>();
function fetchSvg(url: string) {
  let p = svgCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    p.catch(() => svgCache.delete(url));
    svgCache.set(url, p);
  }
  return p;
}

/**
 * Prépare l'élément SVG comme le fait tarkov.dev : seul le niveau principal
 * (svgLayer) et les groupes marqués data-keep-with-group restent visibles.
 */
function buildSvgElement(svgText: string, layer: string | undefined, extra: string[] = []): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg") throw new Error("SVG invalide");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  for (const child of Array.from(svg.children)) {
    if (child.nodeName !== "g" || !child.id || !layer) continue;
    const keep = child.id === layer || extra.includes(child.id) || (child as SVGGElement).dataset.keepWithGroup === layer;
    if (!keep) (child as SVGGElement).style.display = "none";
  }
  return document.importNode(svg, true);
}

/**
 * Plan image (parking d'Interchange) : un <image> affine dans un SVG dont le repère est en mètres,
 * u = x1 - x, v = z - z1 (la rotation de 180° d'Interchange), posé sur les bornes de la carte.
 */
function imageOverlay(level: MapLayer, calibration: MapCalibration, pane: string) {
  const image = level.image!;
  const [[x1, z1], [x2, z2]] = calibration.svgBounds ?? calibration.bounds;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${Math.abs(x1 - x2)} ${Math.abs(z2 - z1)}`);
  const el = document.createElementNS(ns, "image");
  el.setAttribute("href", image.url);
  el.setAttribute("width", String(image.width));
  el.setAttribute("height", String(image.height));
  el.setAttribute("transform", `matrix(${svgMatrixFor({ x: x1, z: z1 }).join(" ")})`);
  el.setAttribute("opacity", "0.92");
  svg.appendChild(el);
  return L.svgOverlay(svg, toLatLngBounds(calibration.svgBounds ?? calibration.bounds), {
    interactive: false,
    pane,
    attribution: parkingAttribution(), // seul calque image : le plan du parking d'Interchange
  });
}

function GridLayer({ bounds }: { bounds: RawBounds }) {
  const map = useMap();
  useEffect(() => {
    const llb = toLatLngBounds(bounds);
    const group = L.layerGroup();
    L.rectangle(llb, { color: "#4b5563", weight: 1, fill: true, fillColor: "#1a1f24", fillOpacity: 1, interactive: false }).addTo(group);
    // pas de grille "rond" (10, 20, 50, 100…) donnant une dizaine de cases
    const extent = Math.max(llb.getNorth() - llb.getSouth(), llb.getEast() - llb.getWest());
    const raw = extent / 10;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= raw) ?? raw;
    const style = { color: "#2c333a", weight: 1, interactive: false };
    for (let lat = Math.ceil(llb.getSouth() / step) * step; lat <= llb.getNorth(); lat += step) {
      L.polyline([[lat, llb.getWest()], [lat, llb.getEast()]], style).addTo(group);
    }
    for (let lng = Math.ceil(llb.getWest() / step) * step; lng <= llb.getEast(); lng += step) {
      L.polyline([[llb.getSouth(), lng], [llb.getNorth(), lng]], style).addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, bounds]);
  return null;
}

export type BaseStatus = "svg" | "tiles" | "grid" | "loading";

/** Panneaux Leaflet sous les marqueurs et les contours : fond, puis étage. */
const BASE_PANE = "tqp-base";
const LEVEL_PANE = "tqp-level";
function usePanes() {
  const map = useMap();
  for (const [name, z] of [[BASE_PANE, 150], [LEVEL_PANE, 160]] as const) {
    if (!map.getPane(name)) map.createPane(name).style.zIndex = String(z);
  }
  return map;
}

function tileLayer(url: string, calibration: MapCalibration, pane: string, attribution?: string) {
  return L.tileLayer(url, {
    pane,
    tileSize: calibration.tileSize,
    bounds: toLatLngBounds(calibration.bounds),
    // mêmes niveaux de zoom natifs que tarkov.dev ; au-delà, Leaflet agrandit les tuiles
    minNativeZoom: calibration.minZoom,
    maxNativeZoom: calibration.maxZoom,
    minZoom: calibration.minZoom - 1,
    maxZoom: calibration.maxZoom + 1,
    attribution,
  });
}

/** Une image SVG (fond ou étage) : le fichier est partagé, seul le groupe affiché change. */
function svgOverlay(text: string, layer: string | undefined, calibration: MapCalibration, pane: string, extra: string[] = []) {
  const el = buildSvgElement(text, layer, extra);
  const bounds = toLatLngBounds(calibration.svgBounds ?? calibration.bounds);
  return L.svgOverlay(el, bounds, { interactive: false, className: "tqp-svg-map", pane });
}

export function BaseLayer({
  calibration,
  fallbackBounds,
  level,
  onStatus,
}: {
  calibration?: MapCalibration;
  fallbackBounds: RawBounds;
  /** Étage affiché par-dessus le niveau principal (null = aucun). */
  level: MapLayer | null;
  onStatus: (status: BaseStatus) => void;
}) {
  const map = usePanes();
  const [failed, setFailed] = useState(false);
  const svgUrl = calibration?.svgUrl;
  const tilePath = calibration?.tilePath;

  // niveau principal
  useEffect(() => {
    if (!calibration || (!svgUrl && !tilePath)) {
      onStatus("grid");
      return;
    }
    const credit = calibration.author
      ? `Fond : <a href="${calibration.authorLink ?? "#"}" target="_blank" rel="noreferrer">${calibration.author}</a>`
      : undefined;
    if (!svgUrl && tilePath) {
      const tiles = tileLayer(tilePath, calibration, BASE_PANE, credit).addTo(map);
      onStatus("tiles");
      return () => {
        tiles.remove();
      };
    }
    let overlay: L.SVGOverlay | null = null;
    let cancelled = false;
    onStatus("loading");
    fetchSvg(svgUrl!)
      .then((text) => {
        if (cancelled) return;
        overlay = svgOverlay(text, calibration.svgLayer, calibration, BASE_PANE, mainExtraSvgLayers(calibration)).addTo(map);
        onStatus("svg");
      })
      .catch((error) => {
        console.warn(tr("Fond de carte indisponible", "Base map unavailable"), error);
        if (!cancelled) {
          setFailed(true);
          onStatus("grid");
        }
      });
    return () => {
      cancelled = true;
      overlay?.remove();
    };
  }, [map, svgUrl, tilePath, calibration, onStatus]);

  // étage choisi : groupe du même SVG si la map en a un, sinon tuiles de l'étage
  useEffect(() => {
    if (!calibration || !level) return;
    map.getPane(BASE_PANE)!.classList.add("is-dimmed");
    let overlay: L.Layer | null = null;
    let cancelled = false;
    if (level.image) {
      overlay = imageOverlay(level, calibration, LEVEL_PANE).addTo(map);
    } else if (svgUrl && level.svgLayer) {
      fetchSvg(svgUrl)
        .then((text) => {
          if (!cancelled) overlay = svgOverlay(text, level.svgLayer, calibration, LEVEL_PANE).addTo(map);
        })
        .catch((error) => console.warn(tr("Étage indisponible", "Floor unavailable"), error));
    } else if (level.tilePath) {
      overlay = tileLayer(level.tilePath, calibration, LEVEL_PANE).addTo(map);
    }
    return () => {
      cancelled = true;
      overlay?.remove();
      map.getPane(BASE_PANE)?.classList.remove("is-dimmed");
    };
  }, [map, svgUrl, calibration, level]);

  if ((!svgUrl && !tilePath) || failed) return <GridLayer bounds={calibration?.bounds ?? fallbackBounds} />;
  return null;
}
