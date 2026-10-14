// Points de la Main story (case en cours de chaque chapitre sélectionné) : position relevée sur
// une carte du wiki. Style à part des quêtes : losange bleu-gris avec le pictogramme « visite ».
import { Marker, Popup, Tooltip } from "react-leaflet";
import { gameToLatLng } from "./crs";
import { markerIcon } from "./icons";
import { floorLabel, type StoryMapPoint } from "../lib/storyPoints";
import { tr } from "../lib/i18n";

export const STORY_COLOR = "#7fb2e5";

export function StoryLayer(props: {
  points: StoryMapPoint[];
  nameOf: (chapter: string) => string;
  onDone: (chapter: string, stepKey: string) => void;
  onOpen: (chapter: string) => void;
}) {
  return (
    <>
      {props.points.map((p) => (
        <Marker key={p.id} position={gameToLatLng(p)} icon={markerIcon("visit", STORY_COLOR, { story: true })} title={`${props.nameOf(p.chapter)} — ${p.stepTitle}`}>
          <Tooltip direction="top" offset={[0, -16]}>
            {p.stepTitle}
          </Tooltip>
          <Popup minWidth={240} maxWidth={320}>
            <div className="popup story-popup">
              <div className="popup-task" style={{ color: STORY_COLOR }}>
                {props.nameOf(p.chapter)} <span className="tag">Main story</span>
              </div>
              <p className="popup-desc">{p.stepTitle}</p>
              {p.count > 1 && (
                <div className="popup-spawn">
                  {tr("Position possible", "Possible position")} <strong>{p.index}</strong> {tr("sur", "of")} {p.count}
                </div>
              )}
              <div className="popup-spawn">{tr("Position relevée sur la carte du wiki", "Position read from the wiki map")}</div>
              <div className="popup-level">
                {tr("Étage : ", "Floor: ")}
                <strong>{floorLabel(p)}</strong>
              </div>
              <div className="popup-spawn">{tr(`Précision : ± ${p.errorM} m`, `Accuracy: ± ${p.errorM} m`)}</div>
              <div className="popup-actions">
                <button className="btn btn-primary" onClick={() => props.onDone(p.chapter, p.stepKey)}>
                  {tr("✓ Fait", "✓ Done")}
                </button>
                <button className="btn btn-ghost" onClick={() => props.onOpen(p.chapter)}>
                  {tr("📜 Chapitre", "📜 Chapter")}
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
