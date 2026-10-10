// Fond de carte : SVG de tarkov-dev-svg-maps posé sur l'emprise calibrée,
// ou simple grille si aucun SVG n'est disponible pour cette map.
import { useEffect, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { MapCalibration, RawBounds } from "./calibration";
import { toLatLngBounds } from "./crs";

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
function buildSvgElement(svgText: string, layer: string | undefined): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg") throw new Error("SVG invalide");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  for (const child of Array.from(svg.children)) {
    if (child.nodeName !== "g" || !child.id || !layer) continue;
    const keep = child.id === layer || (child as SVGGElement).dataset.keepWithGroup === layer;
    if (!keep) (child as SVGGElement).style.display = "none";
  }
  return document.importNode(svg, true);
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

export function BaseLayer({
  calibration,
  fallbackBounds,
  onStatus,
}: {
  calibration?: MapCalibration;
  fallbackBounds: RawBounds;
  onStatus: (status: "svg" | "grid" | "loading") => void;
}) {
  const map = useMap();
  const [failed, setFailed] = useState(false);
  const svgUrl = calibration?.svgUrl;

  useEffect(() => {
    if (!svgUrl || !calibration) {
      onStatus("grid");
      return;
    }
    let overlay: L.SVGOverlay | null = null;
    let cancelled = false;
    onStatus("loading");
    fetchSvg(svgUrl)
      .then((text) => {
        if (cancelled) return;
        const el = buildSvgElement(text, calibration.svgLayer);
        const bounds = toLatLngBounds(calibration.svgBounds ?? calibration.bounds);
        overlay = L.svgOverlay(el, bounds, { interactive: false, className: "tqp-svg-map" }).addTo(map);
        overlay.bringToBack();
        onStatus("svg");
      })
      .catch((error) => {
        console.warn("Fond de carte indisponible", error);
        if (!cancelled) {
          setFailed(true);
          onStatus("grid");
        }
      });
    return () => {
      cancelled = true;
      overlay?.remove();
    };
  }, [map, svgUrl, calibration, onStatus]);

  if (!svgUrl || failed) return <GridLayer bounds={calibration?.bounds ?? fallbackBounds} />;
  return null;
}
