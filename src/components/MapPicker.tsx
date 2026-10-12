import { useEffect, useRef, useState } from "react";
import type { GameMap } from "../types";
import { loadMapImages, type MapImages } from "../api/mapImages";
import { tr } from "../lib/i18n";

interface Props {
  maps: GameMap[];
  currentId: string;
  counts: Map<string, number>;
  onPick: (mapId: string) => void;
  /** Filtre : ajoute une première carte "Toutes les maps" (id "") ; absent = sélecteur de la barre du haut. */
  allLabel?: string;
  label?: string;
}

/** Sélecteur de map : bouton + grille de cartes (image du wiki, nom en surimpression). */
export function MapPicker({ maps, currentId, counts, onPick, allLabel, label }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<MapImages | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = maps.find((m) => m.id === currentId);
  const titleOf = (m: GameMap) => m.nameEn ?? m.name;
  const imageOf = (m: GameMap) => images?.byTitle[titleOf(m)];

  // chargé à la première ouverture seulement (2 requêtes au wiki, puis cache 7 jours)
  useEffect(() => {
    if (!open || images || maps.length === 0) return;
    loadMapImages(maps.map(titleOf)).then(setImages, () => undefined); // échec : cartes sans image
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    root.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return close();
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowRight: 1, ArrowDown: 2, ArrowLeft: -1, ArrowUp: -2 }[e.key];
    if (step === undefined || items.length === 0) return;
    e.preventDefault();
    items[Math.min(items.length - 1, Math.max(0, i + step))].focus();
  };

  const credit = tr("Images des maps : wiki Escape from Tarkov", "Map images: Escape from Tarkov wiki");
  return (
    <div className={`map-picker${allLabel ? " in-panel" : ""}`} ref={root} onKeyDown={onKey}>
      <button
        ref={button}
        className="input map-picker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ?? tr("Map affichée", "Displayed map")}
        disabled={maps.length === 0}
        onClick={() => setOpen((o) => !o)}
        title={credit}
      >
        {current && imageOf(current) && <img className="map-thumb" src={imageOf(current)} alt="" width={36} height={22} />}
        <span className="map-picker-name">{current?.name ?? allLabel ?? "…"}</span>
        <span className="map-picker-count">{current && counts.get(current.id) ? `(${counts.get(current.id)})` : ""}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="map-picker-list" role="listbox" aria-label={tr("Choisir une map", "Choose a map")} title={credit}>
          {allLabel && (
            <button
              role="option"
              aria-selected={currentId === ""}
              className={`map-card map-card-all${currentId === "" ? " selected" : ""}`}
              onClick={() => {
                onPick("");
                close();
              }}
            >
              <span className="map-card-name">{allLabel}</span>
            </button>
          )}
          {maps.map((m) => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === currentId}
              className={`map-card${m.id === currentId ? " selected" : ""}`}
              onClick={() => {
                onPick(m.id);
                close();
              }}
            >
              {imageOf(m) && <img src={imageOf(m)} alt={m.name} width={240} height={144} loading="lazy" />}
              <span className="map-card-name">{m.name}</span>
              {counts.get(m.id) ? <span className="map-card-count">{counts.get(m.id)}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
