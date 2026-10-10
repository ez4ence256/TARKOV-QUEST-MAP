// Poignée verticale entre le panneau et la carte (ordinateur seulement, masquée sur
// téléphone par le CSS). Glisser pour régler la largeur ; flèches gauche/droite au
// clavier ; double-clic pour revenir à la largeur par défaut. La largeur est enregistrée.
import { useRef } from "react";
import { PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, clampPanelWidth, savePanelWidth } from "../lib/panelWidth";

interface Props {
  width: number;
  onChange: (width: number) => void;
}

const KEY_STEP = 20;

export function PanelResizer({ width, onChange }: Props) {
  const drag = useRef<{ startX: number; startWidth: number; last: number } | null>(null);
  const set = (w: number, save: boolean) => {
    const clamped = clampPanelWidth(w, window.innerWidth);
    onChange(clamped);
    if (save) savePanelWidth(clamped);
    return clamped;
  };

  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur du panneau"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Glisser pour régler la largeur du panneau (double-clic : largeur par défaut)"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startX: e.clientX, startWidth: width, last: width };
        document.body.classList.add("is-resizing");
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        drag.current.last = set(drag.current.startWidth + e.clientX - drag.current.startX, false);
      }}
      onPointerUp={() => {
        if (drag.current) savePanelWidth(drag.current.last);
        drag.current = null;
        document.body.classList.remove("is-resizing");
      }}
      onPointerCancel={() => {
        drag.current = null;
        document.body.classList.remove("is-resizing");
      }}
      onDoubleClick={() => set(PANEL_DEFAULT, true)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") set(width - KEY_STEP, true);
        else if (e.key === "ArrowRight") set(width + KEY_STEP, true);
        else if (e.key === "Home") set(PANEL_MIN, true);
        else if (e.key === "End") set(PANEL_MAX, true);
        else return;
        e.preventDefault();
      }}
    />
  );
}
