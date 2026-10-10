import { ICON_PATHS, type IconId } from "../lib/objectiveTypes";

/** Pictogramme SVG en ligne (hérite de la couleur du texte). */
export function Icon({ id, size = 16 }: { id: IconId; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" fill="currentColor" d={ICON_PATHS[id]} />
    </svg>
  );
}
