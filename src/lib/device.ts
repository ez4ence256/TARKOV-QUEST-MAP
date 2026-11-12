// Type d'appareil, lu une seule fois au chargement : tous les textes qui en dépendent
// (Ctrl+V sur ordinateur, photo sur téléphone) restent ainsi cohérents entre eux.

/** Écran tactile comme pointeur principal (téléphone, tablette) : pas de Ctrl+V, la capture se fait en photo. */
export const IS_TOUCH = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
