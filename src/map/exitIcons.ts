// Pastilles des sorties : rectangle vertical avec un bonhomme blanc (vert = sortie,
// orange = transit), deux bonhommes et « coop » pour les sorties coop, nom écrit à côté.
import L from "leaflet";
import type { MapExit } from "../types";

/** Le nom vient des données de l'API : on l'échappe avant de l'insérer dans le HTML du marqueur. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const PERSON =
  '<svg viewBox="0 0 12 20" aria-hidden="true"><circle cx="6" cy="3.3" r="2.7"/><path d="M2 7.4h8l-1 6H7.7L7.1 19.6H4.9l-.6-6.2H3z"/></svg>';

const cache = new Map<string, L.DivIcon>();

export function exitIcon(exit: Pick<MapExit, "kind" | "name">, opts: { offLevel?: boolean; badge?: string } = {}) {
  const key = `${exit.kind}|${exit.name}|${opts.offLevel ? 1 : 0}|${opts.badge ?? ""}`;
  let icon = cache.get(key);
  if (!icon) {
    const coop = exit.kind === "coop";
    const persons = coop ? PERSON + PERSON : PERSON;
    const classes = ["exit-pin", `exit-${exit.kind}`, opts.offLevel ? "is-off-level" : ""].join(" ");
    const badge = opts.badge ? `<span class="exit-badge">${escapeHtml(opts.badge)}</span>` : "";
    const [w, h] = coop ? [30, 32] : [17, 26];
    icon = L.divIcon({
      className: "exit-marker",
      html:
        `<div class="${classes}" style="width:${w}px;height:${h}px">` +
        `<span class="exit-persons">${persons}</span>${coop ? '<span class="exit-coop-text">coop</span>' : ""}${badge}</div>` +
        `<span class="exit-label${opts.offLevel ? " is-off-level" : ""}">${escapeHtml(exit.name)}</span>`,
      iconSize: [w, h],
      iconAnchor: [w / 2, h / 2],
      tooltipAnchor: [0, -h / 2],
      popupAnchor: [0, -h / 2],
    });
    cache.set(key, icon);
  }
  return icon;
}
