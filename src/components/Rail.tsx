// Barre latérale : accès aux vues du panneau, aux outils et aux réglages.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tr, type Lang } from "../lib/i18n";
import { UiIcon } from "./UiIcon";
import { version } from "../../package.json";
import type { UiIconId } from "../lib/uiIcons";

/** Groupes de vues du panneau (App garde l'union `Tab` interne). */
export type RailGroup = "selection" | "add" | "detail" | "custom" | "hideout" | "settings";

interface ItemProps {
  icon: UiIconId;
  label: string;
  /** Nom complet (infobulle, lecteur d'écran) ; par défaut le libellé. */
  full?: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}

function RailItem({ icon, label, full, active, count, onClick }: ItemProps) {
  const name = `${full ?? label}${count ? ` (${count})` : ""}`;
  return (
    <button className={`rail-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={name} title={name} onClick={onClick}>
      <span className="rail-icon">
        <UiIcon id={icon} size={22} />
        {count ? <span className="rail-count">{count}</span> : null}
      </span>
      <span className="rail-label">{label}</span>
    </button>
  );
}

interface Props {
  modeLabel: string | undefined;
  onModeBadge: () => void;
  /** Groupe actif (panneau ouvert sur une de ses vues), sinon null. */
  active: RailGroup | null;
  selectedCount: number;
  onGroup: (g: RailGroup) => void;
  raid: boolean;
  onRaid: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** Boutons-déclencheurs montés une seule fois (ItemFinder, TraderWindow, RoomControl). */
  finder: ReactNode;
  traders: ReactNode;
  room: ReactNode;
}

export function Rail(p: Props) {
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  // téléphone : le menu « Plus » se ferme d'un clic ailleurs
  useEffect(() => {
    if (!more) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!moreRef.current?.contains(t) && !plusRef.current?.contains(t)) setMore(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [more]);

  const group = (g: RailGroup) => () => {
    setMore(false);
    p.onGroup(g);
  };
  const panelName = p.panelOpen ? tr("Masquer le panneau", "Hide panel") : tr("Afficher le panneau", "Show panel");

  return (
    <nav className="rail" aria-label={tr("Navigation", "Navigation")}>
      <div className="rail-brand" title="Tarkov Quest Planner">
        TQP
      </div>
      <button className="mode-badge" onClick={p.onModeBadge} title={tr("Changer de mode de jeu", "Change game mode")}>
        {p.modeLabel}
      </button>
      <RailItem icon="list-checks" label={tr("Mes quêtes", "My quests")} active={p.active === "selection"} count={p.selectedCount} onClick={group("selection")} />
      <RailItem icon="list-plus" label={tr("Ajouter", "Add")} full={tr("Ajouter des quêtes", "Add quests")} active={p.active === "add"} onClick={group("add")} />
      <RailItem icon="file-text" label={tr("Détails", "Details")} full={tr("Détails de la quête", "Quest details")} active={p.active === "detail"} onClick={group("detail")} />
      <div className="rail-sep" />
      {p.finder}
      <div className={`rail-more${more ? " is-open" : ""}`} ref={moreRef}>
        {p.traders}
        {p.room}
        <RailItem icon="map-pin" label={tr("Points", "Points")} full={tr("Mes points", "My points")} active={p.active === "custom"} onClick={group("custom")} />
        <RailItem icon="warehouse" label={tr("Planque", "Hideout")} active={p.active === "hideout"} onClick={group("hideout")} />
        <div className="rail-spacer" />
        <div className="rail-sep" />
        <RailItem icon="settings" label={tr("Réglages", "Settings")} active={p.active === "settings"} onClick={group("settings")} />
        <RailItem icon="crosshair" label={tr("Raid", "Raid")} full={tr("Mode raid", "Raid mode")} active={p.raid} onClick={() => { setMore(false); p.onRaid(); }} />
        <button
          className="rail-item"
          aria-label={tr("Langue", "Language")}
          title={tr("Langue de l'interface et des noms de quêtes, maps et objets", "Language of the interface and of quest, map and item names")}
          onClick={() => p.onLang(p.lang === "en" ? "fr" : "en")}
        >
          <span className="rail-icon">
            <UiIcon id="languages" size={22} />
          </span>
          <span className="rail-label">{p.lang === "en" ? "EN" : "FR"}</span>
        </button>
      </div>
      <button ref={plusRef} className={`rail-item rail-plus${more ? " is-active" : ""}`} aria-expanded={more} aria-label={tr("Plus", "More")} title={tr("Plus", "More")} onClick={() => setMore((m) => !m)}>
        <span className="rail-icon">
          <UiIcon id="ellipsis" size={22} />
        </span>
        <span className="rail-label">{tr("Plus", "More")}</span>
      </button>
      <div className="rail-version">v{version}</div>
      <button className="rail-item rail-collapse" aria-expanded={p.panelOpen} aria-controls="side-panel" aria-label={panelName} title={panelName} onClick={p.onTogglePanel}>
        <span className="rail-icon">
          <UiIcon id={p.panelOpen ? "panel-left-close" : "panel-left-open"} size={22} />
        </span>
      </button>
    </nav>
  );
}
