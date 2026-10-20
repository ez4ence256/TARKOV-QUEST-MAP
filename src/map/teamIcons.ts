// Marqueurs des coéquipiers (room) : le pseudo vient d'un autre joueur, donc NON FIABLE.
// Tout texte inséré dans le HTML Leaflet passe par escapeHtml ; les couleurs viennent de nos palettes, jamais du réseau.
import L from "leaflet";
import { escapeHtml } from "./exitIcons";

/** Initiale affichée dans le marqueur (premier caractère du pseudo, en capitale). */
export const initialOf = (name: string) => ([...name.trim()][0] ?? "?").toUpperCase();

/** HTML d'un point d'objectif d'un coéquipier : pastille au contour en tirets avec l'initiale du pseudo. */
export const teamPinHtml = (name: string, color: string, count?: number) =>
  `<div class="team-pin" style="--pin:${escapeHtml(color)}"><span class="team-pin-initial">${escapeHtml(initialOf(name))}</span>${
    // emplacements possibles regroupés : leur nombre (un entier calculé ici, jamais reçu tel quel)
    count ? `<span class="team-pin-count">${Math.trunc(count)}</span>` : ""
  }</div>`;

/** HTML de la flèche de position d'un coéquipier, avec son pseudo en étiquette. */
export const teamPlayerHtml = (angle: number, name: string, color: string) =>
  `<div class="team-player"><svg width="28" height="28" viewBox="-14 -14 28 28" style="transform:rotate(${Math.round(angle)}deg)"><path d="M0 -12 L8 10 L0 5 L-8 10 Z" fill="${escapeHtml(color)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="team-player-label">${escapeHtml(name)}</span></div>`;

export const teamPinIcon = (name: string, color: string, count?: number) =>
  L.divIcon({ className: "team-marker", html: teamPinHtml(name, color, count), iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] });

export const teamPlayerIcon = (angle: number, name: string, color: string) =>
  L.divIcon({ className: "player-marker", html: teamPlayerHtml(angle, name, color), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12] });

/** Couleur d'un coéquipier (position) : bleu, pour ne pas se confondre avec la flèche verte du joueur. */
export const TEAM_PLAYER_COLOR = "#4aa3ff";
