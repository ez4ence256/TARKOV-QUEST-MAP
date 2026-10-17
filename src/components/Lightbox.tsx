// Visionneuse de photos pour tout le site : un clic sur une miniature marquée `data-lightbox` (lien vers
// l'image en grand) l'ouvre par-dessus la page au lieu d'un nouvel onglet ; un clic à côté ou Échap la
// ferme. Ctrl / Maj / clic molette gardent le comportement du navigateur (nouvel onglet).
import { useEffect, useState } from "react";
import { tr } from "../lib/i18n";

export function Lightbox() {
  const [photo, setPhoto] = useState<{ src: string; caption: string } | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[data-lightbox]") as HTMLAnchorElement | null;
      if (!link) return;
      e.preventDefault();
      setPhoto({ src: link.href, caption: link.title });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!photo) return;
    // capture : Échap ferme la photo avant la fenêtre ouverte en dessous (item finder…)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPhoto(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [photo]);

  if (!photo) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.caption || tr("Photo", "Photo")} onClick={() => setPhoto(null)}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.caption} referrerPolicy="no-referrer" />
        <figcaption>
          <span>{photo.caption && photo.caption !== tr("Voir en grand", "View full size") ? photo.caption : ""}</span>
          <a href={photo.src} target="_blank" rel="noreferrer">
            {tr("Ouvrir l'original", "Open original")}
          </a>
        </figcaption>
      </figure>
      <button className="btn btn-small lightbox-close" onClick={() => setPhoto(null)} aria-label={tr("Fermer", "Close")}>
        ✕
      </button>
    </div>
  );
}
