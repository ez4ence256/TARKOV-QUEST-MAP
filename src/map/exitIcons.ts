// Pastilles des sorties : rectangle vertical avec un bonhomme blanc (vert = sortie sans faction,
// bleu = PMC, violet = Scav, mi-bleu mi-violet = commune, orange = transit), deux bonhommes et « coop » pour les sorties coop, nom écrit à côté.
import L from "leaflet";
import type { MapExit } from "../types";
import { exitIconKind, type ExitIconKind } from "../lib/exits";

/** Le nom vient des données de l'API : on l'échappe avant de l'insérer dans le HTML du marqueur. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const PERSON =
  '<svg viewBox="0 0 12 20" aria-hidden="true"><circle cx="6" cy="3.3" r="2.7"/><path d="M2 7.4h8l-1 6H7.7L7.1 19.6H4.9l-.6-6.2H3z"/></svg>';

const cache = new Map<string, L.DivIcon>();

/** Lettres sous le bonhomme : la forme distingue les factions, pas seulement la couleur. */
const FACTION_LETTERS: Partial<Record<ExitIconKind, string>> = { pmc: "P", scav: "S", shared: "P+S" };

/** Taille de la pastille (largeur, hauteur). */
const pinSize = (kind: ExitIconKind): [number, number] => (kind === "coop" ? [30, 32] : FACTION_LETTERS[kind] ? [20, 30] : [17, 26]);

/** HTML de la pastille seule (sans nom) ; aussi utilisé par la légende des réglages. Aucune donnée de l'API. */
export function exitPinHtml(kind: ExitIconKind, extraClass = "", badge = "") {
  const persons = kind === "coop" ? PERSON + PERSON : PERSON;
  const text = kind === "coop" ? "coop" : FACTION_LETTERS[kind];
  const [w, h] = pinSize(kind);
  return (
    `<div class="exit-pin exit-${kind} ${extraClass}" style="width:${w}px;height:${h}px">` +
    `<span class="exit-persons">${persons}</span>${text ? `<span class="exit-coop-text">${text}</span>` : ""}${badge}</div>`
  );
}

export function exitIcon(exit: Pick<MapExit, "kind" | "name" | "factions">, opts: { offLevel?: boolean; badge?: string } = {}) {
  const kind = exitIconKind(exit);
  const key = `${kind}|${exit.name}|${opts.offLevel ? 1 : 0}|${opts.badge ?? ""}`;
  let icon = cache.get(key);
  if (!icon) {
    const badge = opts.badge ? `<span class="exit-badge">${escapeHtml(opts.badge)}</span>` : "";
    const [w, h] = pinSize(kind);
    icon = L.divIcon({
      className: "exit-marker",
      html:
        exitPinHtml(kind, opts.offLevel ? "is-off-level" : "", badge) +
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
