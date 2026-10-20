// Images des objets qu'un objectif demande (objet à remettre, clé, arme à monter…), sous son texte.
import type { Objective } from "../types";
import { iconSrc } from "../lib/itemIcons";
import { objectiveItemRefs } from "../lib/objectiveItems";
import { tr } from "../lib/i18n";
import { ItemThumb } from "./ItemThumb";

export function ObjectiveItems({ objective, itemIcons, itemNames, size = 28 }: { objective: Objective; itemIcons: Record<string, string>; itemNames: Record<string, string>; size?: number }) {
  const { shown, hidden, keys, count } = objectiveItemRefs(objective);
  if (shown.length + hidden.length + keys.length === 0) return null;
  const name = (id: string) => itemNames[id] ?? id;
  return (
    <span className="objective-items">
      {shown.map((id) => (
        <ItemThumb key={id} src={iconSrc(id, itemIcons)} name={name(id)} title={name(id)} size={size} />
      ))}
      {hidden.length > 0 && (
        <span className="chip objective-items-more" title={[...shown, ...hidden].map(name).join(", ")}>
          +{hidden.length}
        </span>
      )}
      {count > 0 && <span className="objective-items-count">×{count}</span>}
      {objective.foundInRaid && <span className="finder-pill fir">FIR</span>}
      {keys.map((id) => (
        <ItemThumb key={`k${id}`} src={iconSrc(id, itemIcons)} name={name(id)} title={`${tr("clé", "key")} : ${name(id)}`} size={Math.round(size * 0.8)} />
      ))}
    </span>
  );
}
