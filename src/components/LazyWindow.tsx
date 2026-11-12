// Bouton de la barre latérale dont la fenêtre est chargée à la demande : le code de la fenêtre (ItemFinder, TraderWindow)
// n'est téléchargé qu'au premier clic (ou au survol / focus du bouton). Le vrai composant, une fois chargé, remplace le bouton
// et s'ouvre tout seul en cliquant son propre bouton (il rend le déclencheur en premier) : même focus, même fermeture.
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { UiIcon } from "./UiIcon";
import type { UiIconId } from "../lib/uiIcons";

export function LazyWindow<C extends ComponentType<any>>({
  load,
  icon,
  label,
  title,
  ariaLabel,
  forceLoad,
  children,
}: {
  load: () => Promise<C>;
  icon: UiIconId;
  label: string;
  title: string;
  ariaLabel?: string;
  /** Charger tout de suite, sans ouvrir par clic (la fenêtre s'ouvre déjà d'elle-même, ex. un objet demandé ailleurs). */
  forceLoad?: boolean;
  children: (Component: C) => ReactNode;
}) {
  const [Comp, setComp] = useState<C | null>(null);
  const [busy, setBusy] = useState(false);
  const openOnLoad = useRef(false);
  const box = useRef<HTMLSpanElement>(null);

  const start = (open: boolean) => {
    openOnLoad.current ||= open;
    if (busy || Comp) return;
    setBusy(true);
    load().then(
      (c) => setComp(() => c),
      () => {
        openOnLoad.current = false;
        setBusy(false); // chargement raté (réseau, déploiement) : le bouton reste, on peut recliquer
      },
    );
  };
  useEffect(() => {
    if (forceLoad) start(false);
  }, [forceLoad]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (Comp && openOnLoad.current) {
      openOnLoad.current = false;
      box.current?.querySelector("button")?.click();
    }
  }, [Comp]);

  return (
    <span ref={box} style={{ display: "contents" }}>
      {Comp ? (
        children(Comp)
      ) : (
        <button
          className="rail-item"
          onClick={() => start(true)}
          onPointerEnter={() => void load().catch(() => {})}
          onFocus={() => void load().catch(() => {})}
          aria-haspopup="dialog"
          aria-busy={busy}
          aria-label={ariaLabel}
          title={title}
        >
          <UiIcon id={icon} size={22} />
          <span className="rail-label">{label}</span>
        </button>
      )}
    </span>
  );
}
