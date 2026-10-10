// Onglet "Mes points" : points personnels, regroupés par map.
import type { GameMap } from "../types";
import type { CustomPoint } from "../state/store";
import { ICON_LABELS } from "../lib/objectiveTypes";
import { Icon } from "./Icon";

interface Props {
  points: CustomPoint[];
  maps: GameMap[];
  currentMapId: string | null;
  onAdd: () => void;
  onFocus: (point: CustomPoint) => void;
}

export function CustomPointsTab({ points, maps, currentMapId, onAdd, onFocus }: Props) {
  const byMap = new Map<string, CustomPoint[]>();
  for (const p of points) byMap.set(p.mapId, [...(byMap.get(p.mapId) ?? []), p]);
  const mapName = (id: string) => maps.find((m) => m.id === id)?.name ?? "Map inconnue";
  // map courante en premier
  const mapIds = [...byMap.keys()].sort((a, b) => (a === currentMapId ? -1 : b === currentMapId ? 1 : 0));

  return (
    <div className="tab-body">
      <button className="btn btn-primary btn-block" onClick={onAdd} disabled={!currentMapId}>
        ＋ Ajouter un point sur la carte
      </button>
      <p className="muted small">
        Cliquez ensuite sur la carte. Vous pourrez nommer le point, choisir son icône, écrire une note et le
        déplacer en le faisant glisser.
      </p>
      {points.length === 0 && <p className="muted">Aucun point personnel pour l'instant.</p>}
      {mapIds.map((mapId) => (
        <section key={mapId} className="custom-group">
          <div className="subhead">{mapName(mapId)}</div>
          <ul className="custom-list">
            {byMap.get(mapId)!.map((p) => (
              <li key={p.id}>
                <button className="custom-row" onClick={() => onFocus(p)}>
                  <span className="custom-icon" title={ICON_LABELS[p.icon]}>
                    <Icon id={p.icon} />
                  </span>
                  <span className="custom-text">
                    <span>{p.label || "Point perso"}</span>
                    {p.note && <span className="muted small clamp">{p.note}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
