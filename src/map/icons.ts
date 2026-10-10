// Marqueurs Leaflet (divIcon) : pastille colorée + pictogramme selon le type.
import L from "leaflet";
import { ICON_PATHS, type IconId } from "../lib/objectiveTypes";

const cache = new Map<string, L.DivIcon>();

export function markerIcon(
  icon: IconId,
  color: string,
  opts: { faded?: boolean; custom?: boolean; offLevel?: boolean } = {},
) {
  const key = `${icon}|${color}|${opts.faded ? 1 : 0}|${opts.custom ? 1 : 0}|${opts.offLevel ? 1 : 0}`;
  let divIcon = cache.get(key);
  if (!divIcon) {
    const classes = [
      "tqp-pin",
      opts.faded ? "is-faded" : "",
      opts.custom ? "is-custom" : "",
      opts.offLevel ? "is-off-level" : "",
    ].join(" ");
    divIcon = L.divIcon({
      className: "tqp-marker",
      html: `<div class="${classes}" style="--pin:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${ICON_PATHS[icon]}"/></svg></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14],
    });
    cache.set(key, divIcon);
  }
  return divIcon;
}

