// Marqueur de position du joueur (Monitor) : opacité qui s'efface avec le temps et angle de la flèche.

export const PLAYER_FADE_MS = 5 * 60 * 1000;

/** 1 au moment de la capture, puis décroît linéairement jusqu'à 0 au bout de 5 minutes. */
export const playerOpacity = (ageMs: number) => Math.min(1, Math.max(0, 1 - ageMs / PLAYER_FADE_MS));

/**
 * Angle CSS (sens horaire depuis le haut de l'écran) de la flèche. Le cap du jeu part de +z (le haut de la carte
 * non tournée) en sens horaire ; on lui applique la même rotation que la projection de la carte (voir crs.ts applyRotation).
 */
export function arrowAngle(rotation: number, coordinateRotation: number): number {
  const h = (rotation * Math.PI) / 180;
  const t = (coordinateRotation * Math.PI) / 180;
  const lng = Math.sin(h); // x du jeu
  const lat = Math.cos(h); // z du jeu
  const deg = (Math.atan2(lng * Math.cos(t) - lat * Math.sin(t), lng * Math.sin(t) + lat * Math.cos(t)) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}
