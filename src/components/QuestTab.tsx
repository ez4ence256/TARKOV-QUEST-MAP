// Onglet "Quête" : tout ce qu'il faut savoir et faire pour une quête.
//  - en haut : progression, objectifs tarkov.dev à cocher, réinitialisation ;
//  - dessous, sections repliables dans l'ordre de lib/questSections.ts : Objectifs,
//    À emporter, Guide (ouvertes, texte du wiki mis en avant), puis Récompenses,
//    Prérequis, Équipement initial et Résumé (repliées).
// Reste atteignable même quand tous les points sont faits (donc absents de la carte) :
// depuis la popup d'un autre point de la quête, ou depuis la quête dans le panneau.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameMap, Task, Trader } from "../types";
import { ICON_LABELS, categoryOf } from "../lib/objectiveTypes";
import { taskProgress } from "../lib/points";
import { loadWikiPage, type WikiPage } from "../api/wiki";
import {
  acceptWikiPage,
  compareRewards,
  comparePrerequisites,
  failConditionText,
  isPvpZone,
  packingList,
  readWikiQuest,
  STATUS_LABELS,
  type PackItem,
  type QuestLink,
  type WikiQuest,
} from "../lib/questWiki";
import { Icon } from "./Icon";
import { ConfirmButton } from "./ConfirmButton";
import { WikiBlocks } from "./WikiBlocks";
import { QUEST_SECTIONS, type QuestSectionId } from "../lib/questSections";

interface Props {
  tasks: Task[];
  traders: Trader[];
  maps: GameMap[];
  itemNames: Record<string, string>;
  /** Quêtes sélectionnées (proposées dans la liste). */
  selectedIds: string[];
  /** Quête affichée. */
  taskId: string | null;
  /** Change la quête affichée (liste, ou quête préalable / suivante cliquée). */
  onTaskChange: (taskId: string) => void;
  done: Record<string, number>;
  onSetDone: (objectiveId: string, done: boolean) => void;
  onReset: (task: Task) => void;
  onPhotos: (taskId: string) => void;
}

/** Quêtes proposées dans un onglet (Quête, Photos) : la quête demandée, puis la sélection. */
export function tabTaskOptions(taskId: string | null, selectedIds: string[]) {
  return [...new Set([...(taskId ? [taskId] : []), ...selectedIds])];
}

type WikiState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; page: WikiPage }
  | { status: "error"; error: string };

function useWikiPage(wikiLink: string | null): WikiState {
  const [state, setState] = useState<WikiState>({ status: "none" });
  useEffect(() => {
    if (!wikiLink) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loadWikiPage(wikiLink)
      .then((page) => !cancelled && setState({ status: "ready", page }))
      .catch((error: Error) => !cancelled && setState({ status: "error", error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [wikiLink]);
  return state;
}

/** Section repliable ; non affichée si elle n'a rien à montrer. */
function Section({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="quest-section" open={open}>
      <summary>{title}</summary>
      <div className="quest-section-body">{children}</div>
    </details>
  );
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="warn-box" role="note">
      <strong>Les sources ne sont pas d'accord :</strong>
      <ul>
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Liste de quêtes, cliquables quand elles existent dans l'app. `displayName` donne le nom
 * affiché (nom de l'app, en français) ; sans lui, le nom anglais du wiki est gardé.
 */
function QuestLinks({
  links,
  onOpen,
  suffix,
  displayName,
}: {
  links: QuestLink[];
  onOpen: (id: string) => void;
  suffix?: (l: QuestLink) => string;
  displayName?: (l: QuestLink) => string;
}) {
  return (
    <ul className="plain-list">
      {links.map((l) => (
        <li key={l.name}>
          {l.taskId ? (
            <button className="link" onClick={() => onOpen(l.taskId!)} title={l.name}>
              {displayName?.(l) ?? l.name}
            </button>
          ) : (
            l.name
          )}
          {suffix?.(l)}
        </li>
      ))}
    </ul>
  );
}

const PACK_GROUPS: { kinds: PackItem["kind"][]; title: string }[] = [
  { kinds: ["key"], title: "Clés" },
  { kinds: ["handover", "find", "sell"], title: "Objets à trouver ou à rendre" },
  { kinds: ["questItem"], title: "Objets de quête à trouver en raid" },
  { kinds: ["place", "marker"], title: "À placer ou à marquer" },
];

const firLabel = (fir: boolean | null | undefined) =>
  fir === true ? "Find in raid" : fir === false ? "Pas Find in raid" : null;

const fmt = (n: number) => n.toLocaleString("fr-FR");

export function QuestTab(p: Props) {
  const tasksById = useMemo(() => new Map(p.tasks.map((t) => [t.id, t])), [p.tasks]);
  const optionIds = tabTaskOptions(p.taskId, p.selectedIds).filter((id) => tasksById.has(id));
  const task = optionIds.length > 0 ? tasksById.get(optionIds[0]) : undefined;
  const wikiState = useWikiPage(task?.wikiLink ?? null);

  const wiki: WikiQuest | null = useMemo(
    () => (wikiState.status === "ready" && acceptWikiPage(wikiState.page) ? readWikiQuest(wikiState.page) : null),
    [wikiState],
  );

  if (!task) {
    return (
      <div className="tab-body empty">
        <p>Sélectionnez une quête, ou ouvrez-la depuis un point de la carte (bouton 📜 Quête).</p>
      </div>
    );
  }

  const ctx = { tasks: p.tasks, traders: p.traders };
  const progress = taskProgress(task, p.done);
  const checked = task.objectives.filter((o) => p.done[o.id]).length;
  const traderName = (id: string) => p.traders.find((t) => t.id === id)?.name ?? "?";
  const prereq = comparePrerequisites(task, wiki, ctx);
  const pack = packingList(task, p.itemNames, p.maps);
  const rewardDiffs = compareRewards(task, wiki, p.traders);
  const rewards = task.details?.rewards ?? null;
  const showTarkovRewards = rewards !== null && (rewardDiffs.length > 0 || !wiki || wiki.rewards.length === 0);
  const pvp = isPvpZone(task) && wiki !== null;
  const itemName = (id: string) => p.itemNames[id] ?? `objet inconnu (${id})`;
  const statusText = (l: QuestLink & { status?: string[] }) =>
    l.status?.length ? ` (${l.status.map((s) => STATUS_LABELS[s] ?? s).join(" ou ")})` : "";
  // quêtes de tarkov.dev : nom de l'app (français) ; celles du wiki gardent leur nom anglais
  const appName = (l: QuestLink) => (l.taskId ? tasksById.get(l.taskId)?.name : undefined) ?? l.name;
  const traderReqs = task.details?.traderRequirements ?? [];
  const failConditions = task.details?.failConditions ?? [];

  const hasPrereq =
    prereq.tarkovTasks.length > 0 ||
    prereq.wikiTasks.length > 0 ||
    prereq.tarkovNext.length > 0 ||
    prereq.wikiNext.length > 0 ||
    traderReqs.length > 0 ||
    Boolean(task.minPlayerLevel) ||
    (wiki?.requirements.length ?? 0) > 0 ||
    prereq.warnings.length > 0;
  const hasPack = pack.length > 0 || (wiki?.relatedItems.length ?? 0) > 0;
  const hasRewards = (wiki?.rewards.length ?? 0) > 0 || showTarkovRewards;
  const hasGuide = (wiki?.guide.length ?? 0) > 0 || failConditions.length > 0 || task.details?.restartable === true;

  /** Mention de la source, en tête des sections où le texte du wiki est mis en avant. */
  const wikiSource = wiki && (
    <div className="wiki-source small">
      Texte du wiki, en anglais :{" "}
      <a href={wiki.pageUrl} target="_blank" rel="noreferrer">
        {wiki.pageTitle}
      </a>
    </div>
  );

  // contenu de chaque section ; null = pas de données, section masquée
  const sections: Record<QuestSectionId, ReactNode | null> = {
    objectives:
      wiki && wiki.objectives.length > 0 ? (
        <div className="wiki-highlight">
          {wikiSource}
          <WikiBlocks blocks={wiki.objectives} />
        </div>
      ) : null,

    pack: hasPack ? (
      <>
        {wiki && wiki.relatedItems.length > 0 && (
          <div className="wiki-highlight">
            {wikiSource}
            <div className="wiki-heading wiki-heading-4">Tableau « Related Quest Items »</div>
            <ul className="plain-list pack-list">
              {wiki.relatedItems.map((r, k) => (
                <li key={k}>
                  {r.amount && r.amount !== "1" ? `${r.amount} × ` : ""}
                  {r.name}
                  {r.requirement && <span className="muted small"> · {r.requirement}</span>}
                  {firLabel(r.foundInRaid) && <span className={`fir-tag ${r.foundInRaid ? "is-fir" : ""}`}>{firLabel(r.foundInRaid)}</span>}
                  {r.notes && <div className="muted small pre-line">{r.notes}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pack.length > 0 && (
          <>
            <div className="muted small">Pour toute la quête, d'après tarkov.dev (à reprendre après une mort) :</div>
            {PACK_GROUPS.map((g) => {
              const items = pack.filter((i) => g.kinds.includes(i.kind));
              if (items.length === 0) return null;
              return (
                <div key={g.title}>
                  <div className="wiki-heading wiki-heading-4">{g.title}</div>
                  <ul className="plain-list pack-list">
                    {items.map((i, k) => (
                      <li key={k}>
                        {!i.countInLabel && i.count && i.count > 1 ? `${i.count} × ` : ""}
                        {i.label}
                        {i.kind === "sell" && " (à vendre)"}
                        {firLabel(i.foundInRaid) && <span className={`fir-tag ${i.foundInRaid ? "is-fir" : ""}`}>{firLabel(i.foundInRaid)}</span>}
                        {i.detail && <span className="muted small"> · {i.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </>
    ) : null,

    guide: hasGuide ? (
      <>
        {wiki && wiki.guide.length > 0 && (
          <div className="wiki-highlight">
            {wikiSource}
            <WikiBlocks blocks={wiki.guide} />
          </div>
        )}
        {(failConditions.length > 0 || task.details?.restartable) && (
          <>
            <div className="wiki-heading wiki-heading-3">Selon tarkov.dev</div>
            <ul className="plain-list">
              {failConditions.map((f, i) => (
                <li key={i}>{failConditionText(f, tasksById)}</li>
              ))}
              {task.details && failConditions.length > 0 && (
                <li>Refaisable après un échec : {task.details.restartable ? "oui" : "non"}</li>
              )}
              {task.details?.restartable && failConditions.length === 0 && <li>Refaisable après un échec : oui</li>}
            </ul>
          </>
        )}
      </>
    ) : null,

    rewards: hasRewards ? (
      <>
        {wiki && wiki.rewards.length > 0 && <WikiBlocks blocks={wiki.rewards} />}
        <Warnings items={rewardDiffs} />
        {showTarkovRewards && rewards && (
          <>
            <div className="wiki-heading wiki-heading-3">Selon tarkov.dev</div>
            <ul className="plain-list">
              {rewards.experience > 0 && <li>+{fmt(rewards.experience)} EXP</li>}
              {rewards.standing.map((s, i) => (
                <li key={`s${i}`}>
                  Réputation {traderName(s.traderId)} {s.value > 0 ? "+" : ""}
                  {s.value}
                </li>
              ))}
              {rewards.items.map((r, i) => (
                <li key={`i${i}`}>
                  {fmt(r.count)} × {itemName(r.itemId)}
                </li>
              ))}
              {rewards.offerUnlocks.map((u, i) => (
                <li key={`o${i}`}>
                  Débloque l'achat de {itemName(u.itemId)} chez {traderName(u.traderId)} (niveau {u.level})
                </li>
              ))}
              {rewards.skills.map((s, i) => (
                <li key={`k${i}`}>
                  Compétence « {s.skill} » : niveau {s.level}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    ) : null,

    prereq: hasPrereq ? (
      <>
        <Warnings items={prereq.warnings} />
        <div className="wiki-heading wiki-heading-3">Selon tarkov.dev</div>
        <ul className="plain-list">
          {task.minPlayerLevel ? <li>Niveau {task.minPlayerLevel}</li> : null}
          {traderReqs.map((r, i) => (
            <li key={i}>
              {traderName(r.traderId)} : {r.type === "level" ? "niveau de fidélité" : "réputation"} {r.compare} {r.value}
            </li>
          ))}
          {prereq.tarkovTasks.length === 0 && <li>Aucune quête préalable</li>}
        </ul>
        {prereq.tarkovTasks.length > 0 && (
          <>
            <div className="muted small">Quêtes préalables :</div>
            <QuestLinks links={prereq.tarkovTasks} onOpen={p.onTaskChange} suffix={statusText} displayName={appName} />
          </>
        )}
        {wiki && (
          <>
            <div className="wiki-heading wiki-heading-3">Selon le wiki (en anglais)</div>
            {wiki.loyaltyLevel !== null && <div className="small">LL requirement : {wiki.loyaltyLevel}</div>}
            {wiki.requirements.length > 0 && <WikiBlocks blocks={wiki.requirements} />}
            {prereq.wikiTasks.length > 0 && (
              <>
                <div className="muted small">Quêtes précédentes (previous) :</div>
                <QuestLinks links={prereq.wikiTasks} onOpen={p.onTaskChange} />
              </>
            )}
            {wiki.requirements.length === 0 && prereq.wikiTasks.length === 0 && wiki.loyaltyLevel === null && (
              <div className="muted small">Le wiki ne donne pas de prérequis.</div>
            )}
          </>
        )}
        {(prereq.tarkovNext.length > 0 || prereq.wikiNext.length > 0) && (
          <>
            <div className="wiki-heading wiki-heading-3">Quêtes suivantes</div>
            {prereq.tarkovNext.length > 0 && (
              <QuestLinks links={prereq.tarkovNext} onOpen={p.onTaskChange} suffix={() => " (tarkov.dev)"} displayName={appName} />
            )}
            {prereq.wikiNext.length > 0 && <QuestLinks links={prereq.wikiNext} onOpen={p.onTaskChange} suffix={() => " (wiki)"} />}
          </>
        )}
      </>
    ) : null,

    equipment: wiki && wiki.initialEquipment.length > 0 ? <WikiBlocks blocks={wiki.initialEquipment} /> : null,

    summary: (
      <>
        {wiki?.briefing && <blockquote className="wiki-quote">{wiki.briefing}</blockquote>}
        <ul className="plain-list">
          <li>
            Marchand : {traderName(task.traderId)}
            {wiki?.givenBy && wiki.givenBy.toLowerCase() !== p.traders.find((t) => t.id === task.traderId)?.normalizedName
              ? ` (wiki : ${wiki.givenBy})`
              : ""}
          </li>
          {wiki?.location && <li>Lieu (wiki) : {wiki.location}</li>}
          {task.minPlayerLevel ? <li>Niveau requis : {task.minPlayerLevel}</li> : null}
          <li>
            Kappa : {task.kappaRequired ? "requise" : "non requise"} (tarkov.dev)
            {wiki && wiki.kappa !== null ? ` · ${wiki.kappa ? "requise" : "non requise"} (wiki)` : ""}
          </li>
          {task.details?.lightkeeperRequired && <li>Requise pour Lightkeeper (tarkov.dev)</li>}
        </ul>
        {wiki?.failureDialogue && (
          <>
            <div className="wiki-heading wiki-heading-3">Réplique en cas d'échec</div>
            <blockquote className="wiki-quote">{wiki.failureDialogue}</blockquote>
          </>
        )}
      </>
    ),
  };

  return (
    <div className="tab-body quest-tab">
      <div className="subhead">Quête sélectionnée</div>
      {optionIds.length > 1 && (
        <select className="input" value={task.id} onChange={(e) => p.onTaskChange(e.target.value)} aria-label="Quête affichée">
          {optionIds.map((id) => (
            <option key={id} value={id}>
              {tasksById.get(id)!.name}
            </option>
          ))}
        </select>
      )}

      {pvp && (
        <div className="pvp-banner" role="note">
          Cette quête PVP ZONE n'a pas de page propre sur le wiki : le texte affiché est celui de la quête normale «{" "}
          {wiki!.pageTitle} » et peut différer (objectifs, récompenses).
        </div>
      )}
      {wiki?.historical && (
        <div className="warn-box" role="note">
          Page historique : d'après le wiki, cette quête n'est plus dans le jeu (catégorie « Historical content »).
        </div>
      )}

      <div className="quest-tab-head">
        <h2 className="quest-tab-title">{task.name}</h2>
        <span
          className={`progress-badge ${progress.done === progress.total && progress.total > 0 ? "is-complete" : ""}`}
          title="Objectifs faits / objectifs obligatoires"
        >
          {progress.done}/{progress.total}
        </span>
      </div>
      <div className="muted small">
        {traderName(task.traderId)}
        {task.minPlayerLevel ? ` · niveau ${task.minPlayerLevel}` : ""}
        {task.kappaRequired ? " · Kappa" : ""}
        {task.nameEn !== task.name ? ` · EN : ${task.nameEn}` : ""}
      </div>

      <div className="subhead">Objectifs à cocher (tarkov.dev)</div>
      <ul className="objectives">
        {task.objectives.map((o) => {
          const isDone = Boolean(p.done[o.id]);
          const cat = categoryOf(o.type);
          const spawns = o.locations.filter((l) => l.possible).length;
          return (
            <li key={o.id} className={`objective ${isDone ? "is-done" : ""}`}>
              <label className="objective-check">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => p.onSetDone(o.id, e.target.checked)}
                  aria-label={isDone ? "Marquer comme non fait" : "Marquer comme fait"}
                />
              </label>
              <div className="objective-body">
                <div className="objective-desc">
                  <span className="objective-icon" title={ICON_LABELS[cat]}>
                    <Icon id={cat} size={14} />
                  </span>
                  {o.description || <em className="muted">(sans description)</em>}
                  {o.optional && <span className="tag">optionnel</span>}
                </div>
                {spawns > 1 && <div className="objective-note">{spawns} emplacements possibles sur la carte</div>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Décocher un objectif fait réapparaître ses points sur la carte.</p>
      <div className="btn-row">
        {checked > 0 && (
          <ConfirmButton
            label="Réinitialiser cette quête"
            question={`Décocher ${checked} objectif${checked > 1 ? "s" : ""} ?`}
            confirmLabel="Oui"
            onConfirm={() => p.onReset(task)}
          />
        )}
        {task.wikiLink && (
          <button className="btn btn-small" onClick={() => p.onPhotos(task.id)}>
            📷 Photos
          </button>
        )}
      </div>

      <div className="wiki-status small">
        {wikiState.status === "loading" && <span className="muted">Chargement du wiki…</span>}
        {wikiState.status === "error" && (
          <span className="error">
            Le wiki ne répond pas ({wikiState.error}). Les informations ci-dessous viennent seulement de tarkov.dev.
          </span>
        )}
        {wikiState.status === "ready" && !wiki && (
          <span className="muted">Pas de page de quête sur le wiki : seules les données tarkov.dev sont affichées.</span>
        )}
        {wiki && (
          <span className="muted">
            Texte du wiki, en anglais :{" "}
            <a href={wiki.pageUrl} target="_blank" rel="noreferrer">
              {wiki.pageTitle}
            </a>{" "}
            (Escape from Tarkov Wiki, CC BY-NC-SA).
          </span>
        )}
      </div>

      {QUEST_SECTIONS.map((s) => {
        const content = sections[s.id];
        if (!content) return null; // section sans données : masquée
        const title = s.id === "prereq" && prereq.warnings.length > 0 ? `${s.title} ⚠ désaccord` : s.title;
        return (
          <Section key={`${task.id}:${s.id}`} title={title} open={s.open}>
            {content}
          </Section>
        );
      })}
    </div>
  );
}
