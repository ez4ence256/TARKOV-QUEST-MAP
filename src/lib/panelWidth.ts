// Largeur du panneau latéral sur ordinateur : réglable avec la poignée, enregistrée
// dans le navigateur, bornée pour que les onglets restent lisibles et que la carte
// garde de la place.

export const PANEL_WIDTH_KEY = "tqp:panelWidth";
export const PANEL_DEFAULT = 440;
/** En dessous, les libellés d'onglets ne tiennent plus sur deux lignes sans couper de mot. */
export const PANEL_MIN = 400;
export const PANEL_MAX = 720;
/** Part maximale de la fenêtre occupée par le panneau. */
const PANEL_MAX_RATIO = 0.6;

/** Largeur bornée : entre PANEL_MIN et PANEL_MAX, et au plus 60 % de la fenêtre. */
export function clampPanelWidth(width: number, viewportWidth: number): number {
  const max = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.floor(viewportWidth * PANEL_MAX_RATIO)));
  if (!Number.isFinite(width)) return Math.min(PANEL_DEFAULT, max);
  return Math.round(Math.min(max, Math.max(PANEL_MIN, width)));
}

export function readPanelWidth(viewportWidth: number): number {
  try {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return clampPanelWidth(saved > 0 ? saved : PANEL_DEFAULT, viewportWidth);
  } catch {
    return clampPanelWidth(PANEL_DEFAULT, viewportWidth);
  }
}

export function savePanelWidth(width: number) {
  try {
    localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(width)));
  } catch {
    /* stockage indisponible : la largeur ne sera pas retenue */
  }
}
