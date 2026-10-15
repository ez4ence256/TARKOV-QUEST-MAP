// Petite image d'objet (taille fixe, chargement différé) ; masquée si elle ne charge pas : jamais d'image cassée.
import { useEffect, useMemo, useState } from "react";
import { loadItemThumbs } from "../api/wiki";
import { iconSrc, itemIdOf, nameIndex } from "../lib/itemIcons";

export function ItemThumb({ src, name, size = 32, title }: { src?: string; name: string; size?: number; title?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return <img className="item-icon" src={src} alt={name} title={title} width={size} height={size} style={{ width: size, height: size }} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

const wikiTitle = (cell: string) => cell.replace(/⟦item:[0-9a-f]{24}⟧/g, "").trim();

/**
 * Image de chaque nom d'objet : tarkov.dev quand le nom (ou le repère {{id}}) est reconnu, sinon
 * la vignette de sa page du wiki (une seule requête groupée pour tous les noms de la page).
 */
export function useItemIcons(names: string[], itemNames?: Record<string, string>, itemIcons?: Record<string, string>): (name: string) => string | undefined {
  const index = useMemo(() => nameIndex(itemNames ?? {}), [itemNames]);
  const key = names.join("\n");
  const unknown = useMemo(() => [...new Set(names.filter((n) => n && !itemIdOf(n, index)).map(wikiTitle).filter(Boolean))], [key, index]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (unknown.length === 0) return;
    let cancelled = false;
    loadItemThumbs(unknown)
      .then((m) => !cancelled && setThumbs(m))
      .catch(() => undefined); // wiki injoignable : le nom seul
    return () => {
      cancelled = true;
    };
  }, [unknown]);
  return (name) => {
    const id = itemIdOf(name, index);
    return id ? iconSrc(id, itemIcons) : thumbs[wikiTitle(name)];
  };
}
