// Marqueurs Leaflet (divIcon) : pastille colorée + pictogramme selon le type.
import L from "leaflet";
import { ICON_PATHS, type IconId } from "../lib/objectiveTypes";

const cache = new Map<string, L.DivIcon>();

export function markerIcon(
  icon: IconId,
  color: string,
  opts: { faded?: boolean; custom?: boolean; offLevel?: boolean; badge?: string; story?: boolean; optional?: boolean } = {},
) {
  const key = `${icon}|${color}|${opts.faded ? 1 : 0}|${opts.custom ? 1 : 0}|${opts.offLevel ? 1 : 0}|${opts.badge ?? ""}|${opts.story ? 1 : 0}|${opts.optional ? 1 : 0}`;
  let divIcon = cache.get(key);
  if (!divIcon) {
    const classes = [
      "tqp-pin",
      opts.faded ? "is-faded" : "",
      opts.custom ? "is-custom" : "",
      opts.offLevel ? "is-off-level" : "",
      opts.story ? "is-story" : "",
      opts.optional ? "is-optional" : "",
    ].join(" ");
    divIcon = L.divIcon({
      className: "tqp-marker",
      html: `<div class="${classes}" style="--pin:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${ICON_PATHS[icon]}"/></svg>${
        // numéro d'étage (étages supérieurs) : chiffres ou flèche issus de levelBadge
        opts.badge ? `<span class="tqp-pin-badge">${opts.badge}</span>` : ""
      }${
        // objectif optionnel : contour pointillé + pastille « opt » (le même mot en français et en anglais)
        opts.optional ? `<span class="tqp-pin-opt">opt</span>` : ""
      }</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14],
    });
    cache.set(key, divIcon);
  }
  return divIcon;
}

