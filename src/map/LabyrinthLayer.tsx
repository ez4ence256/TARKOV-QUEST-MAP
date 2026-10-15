// Infos du Labyrinthe (map « the-labyrinth » seulement) : badges des 5 chambres, apparitions de clés,
// cadavres de scientifiques, salles verrouillées surlignées avec leur cadenas et l'image de leur clé.
// Positions relevées sur la carte de re3mr.com (CC BY-NC-SA 4.0), voir src/lib/labyrinth.ts.
import { useEffect } from "react";
import L from "leaflet";
import { Marker, Polygon, Popup, Tooltip, useMap } from "react-leaflet";
import { gameToLatLng } from "./crs";
import { escapeHtml } from "./exitIcons";
import { groupSize, ITEM_ICON, LABYRINTH, markerTitle, SCIENTIST_NOTE, text, type LabyrinthAnnotations, type LabyrinthMarker } from "../lib/labyrinth";
import { tr } from "../lib/i18n";

const COLORS: Record<LabyrinthMarker["color"], string> = { red: "#e03131", purple: "#ae3ec9", black: "#111", white: "#f1f3f5", green: "#2f9e44" };

const icons = new Map<string, L.DivIcon>();
const cached = (key: string, make: () => L.DivIcon) => {
  let i = icons.get(key);
  if (!i) icons.set(key, (i = make()));
  return i;
};

const markerIcon = (m: LabyrinthMarker) =>
  cached(`m${m.color}${m.n}`, () =>
    L.divIcon({
      className: "lab-marker-wrap",
      html: `<div class="lab-marker lab-${m.color}" style="--lab:${COLORS[m.color]}">${m.n}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    }),
  );

const chamberIcon = (n: number, name: string) =>
  cached(`c${n}${name}`, () =>
    L.divIcon({
      className: "lab-marker-wrap",
      html: `<div class="lab-chamber"><span class="lab-chamber-n">${n}</span><span class="lab-chamber-name">${escapeHtml(name)}</span></div>`,
      iconSize: [64, 52],
      iconAnchor: [32, 26],
      popupAnchor: [0, -22],
    }),
  );

const lockIcon = L.divIcon({
  className: "lab-marker-wrap",
  html: '<div class="lab-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0110 0v2h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1zm2 0h6V8a3 3 0 00-6 0z"/></svg></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const centroid = (poly: { x: number; z: number }[]) => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length });

/** Crédit dans l'attribution de la carte tant que la couche est affichée. */
function Credit({ text: credit }: { text: string }) {
  const map = useMap();
  useEffect(() => {
    const html = tr(`Carte du Labyrinthe : ${credit}`, `Labyrinth map: ${credit}`);
    map.attributionControl?.addAttribution(html);
    return () => {
      map.attributionControl?.removeAttribution(html);
    };
  }, [map, credit]);
  return null;
}

export function LabyrinthLayer({ data = LABYRINTH }: { data?: LabyrinthAnnotations }) {
  return (
    <>
      <Credit text={data.credit} />
      {data.rooms.map((r) => {
        const c = centroid(r.polygon);
        return (
          <span key={r.id}>
            <Polygon positions={r.polygon.map(gameToLatLng)} pathOptions={{ color: "#f2c94c", weight: 1.5, opacity: 0.7, fillColor: "#f2c94c", fillOpacity: 0.12 }} interactive={false} />
            <Marker position={gameToLatLng(r.lock)} icon={lockIcon} title={text(r.name)}>
              <Popup minWidth={220} maxWidth={280}>
                <div className="popup lab-popup">
                  <div className="popup-task">{text(r.name)}</div>
                  <div className="lab-key">
                    <img src={ITEM_ICON(r.keyItemId)} alt="" width={48} height={48} referrerPolicy="no-referrer" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    <strong>{text(r.key)}</strong>
                  </div>
                  <p className="popup-desc">{text(r.how)}</p>
                </div>
              </Popup>
            </Marker>
            <Marker position={gameToLatLng(c)} icon={L.divIcon({ className: "lab-marker-wrap", html: `<div class="lab-room-name">${escapeHtml(text(r.name))}</div>`, iconSize: [120, 16], iconAnchor: [60, 24] })} interactive={false} />
          </span>
        );
      })}
      {data.chambers.map((c) => (
        <Marker key={c.n} position={gameToLatLng(c)} icon={chamberIcon(c.n, text(c.name))} title={text(c.name)}>
          <Popup minWidth={240} maxWidth={320}>
            <div className="popup lab-popup">
              <div className="popup-task">{tr(`Chambre ${c.n} : ${text(c.name)}`, `Chamber ${c.n}: ${text(c.name)}`)}</div>
              <p className="popup-desc">{text(c.steps)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
      {data.markers.map((m) => (
        <Marker key={`${m.type}-${m.chamber ?? 0}-${m.n}`} position={gameToLatLng(m)} icon={markerIcon(m)} title={markerTitle(m, groupSize(m, data.markers))}>
          <Tooltip direction="top" offset={[0, -8]}>
            {text(m.label)}
          </Tooltip>
          <Popup minWidth={220} maxWidth={300}>
            <div className="popup lab-popup">
              <div className="popup-task">{markerTitle(m, groupSize(m, data.markers))}</div>
              <p className="popup-desc">{text(m.label)}</p>
              {m.type === "scientist" && <div className="popup-spawn">{SCIENTIST_NOTE()}</div>}
              {m.approx && <div className="popup-spawn">{tr("Position lue sur une image basse résolution (± 3 m).", "Position read from a low-resolution image (± 3 m).")}</div>}
              <div className="popup-foot">{tr("Carte de re3mr.com", "Map by re3mr.com")}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
