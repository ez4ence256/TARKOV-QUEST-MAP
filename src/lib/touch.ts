/** Appareil tactile (téléphone, tablette) : pas de clavier, donc pas de Ctrl+V. */
export const isTouch = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
