import { createElement } from "react";
import { UI_ICONS, type UiIconId } from "../lib/uiIcons";

/** Icône SVG de l'interface (trait, hérite de la couleur du texte). */
export function UiIcon({ id, size = 18, className }: { id: UiIconId; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `ui-icon ${className}` : "ui-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {UI_ICONS[id].map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Même SVG en chaîne HTML, pour les endroits qui construisent du HTML (Leaflet). */
export function uiIconSvg(id: UiIconId, size = 18): string {
  const els = UI_ICONS[id]
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(" ")}/>`)
    .join("");
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${els}</svg>`;
}
