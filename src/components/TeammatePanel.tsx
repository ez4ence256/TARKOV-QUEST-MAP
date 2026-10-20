// Colonne « Coéquipier » de l'onglet Sélection (en room) : les quêtes choisies par UN coéquipier à la fois, en lecture seule.
// Le pseudo est non fiable : uniquement du texte React ici.
import { useMemo, useState, type ComponentProps } from "react";
import type { RoomMember } from "../api/room";
import { tr } from "../lib/i18n";
import { viewModeOf } from "../lib/roomView";
import { SelectedQuests } from "./SelectedQuests";

type QuestProps = Pick<ComponentProps<typeof SelectedQuests>, "tasks" | "traders" | "maps" | "currentMapId" | "onPhotos" | "onQuest" | "onStory" | "itemIcons" | "itemNames">;

const noop = () => {};
const NO_COUNTS = new Map<string, number>();
const NO_QUESTS = new Map<string, Set<string>>();

export function TeammatePanel({ members, viewedId, onView, ...quest }: { members: RoomMember[]; viewedId: string | null; onView: (id: string) => void } & QuestProps) {
  // téléphone : la colonne s'empile au-dessus des miennes et peut être repliée (le CSS ne montre le bouton que là)
  const [collapsed, setCollapsed] = useState(false);
  const viewed = members.find((m) => m.id === viewedId) ?? members[0];
  const tasksById = useMemo(() => new Map(quest.tasks.map((t) => [t.id, t])), [quest.tasks]);
  const view = useMemo(() => (viewed?.snapshot ? viewModeOf(viewed.snapshot, tasksById) : null), [viewed?.snapshot, tasksById]);
  if (!viewed) return null;
  return (
    <section className={`room-col room-col-team${collapsed ? " is-collapsed" : ""}`} aria-label={tr("Quêtes d'un coéquipier", "A teammate's quests")}>
      <div className="room-team-head">
        <label className="room-team-pick">
          <span className="small">{tr("Coéquipier", "Teammate")}</span>
          <select className="input" value={viewed.id} onChange={(e) => onView(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.connected ? "" : tr(" (hors ligne)", " (offline)")}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-small room-collapse" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? tr("Afficher", "Show") : tr("Replier", "Collapse")}
        </button>
      </div>
      <div className="room-team-body">
        <p className="muted small room-readonly">{tr(`Lecture seule : les quêtes de ${viewed.name}.`, `Read-only: ${viewed.name}'s quests.`)}</p>
        {view ? (
          <SelectedQuests
            {...quest}
            mode={view}
            dispatch={noop}
            onShowMap={noop}
            mapCounts={NO_COUNTS}
            questsOnMap={NO_QUESTS}
            onComplete={noop}
            onFocus={noop}
            onStartPlacing={noop}
            onBrowse={noop}
            readOnly
          />
        ) : (
          <p className="muted small">{tr(`${viewed.name} n'a encore rien publié.`, `${viewed.name} has not published anything yet.`)}</p>
        )}
      </div>
    </section>
  );
}
