// Informations de quête : texte du wiki (anglais) croisé avec les données de tarkov.dev.
// tarkov.dev reste la référence pour la logique de l'app ; quand les deux sources
// divergent (prérequis, Kappa, récompenses), on le signale sans trancher.

import type { GameMap, Task, Trader } from "../types";
import type { WikiPage } from "../api/wiki";
import { getLang, tr } from "./i18n";
import {
  cleanInline,
  findSection,
  firstQuote,
  parseBlocks,
  parseInfobox,
  relatedQuestItems,
  rewardNumbers,
  splitSections,
  wikiLinkTargets,
  type RelatedItem,
  type WikiBlock,
  type WikiRewardNumbers,
} from "./wikiText";

const PVP_ZONE = /\s*\[PVP ZONE\]\s*$/i;
/** Nom de quête sans le suffixe " [PVP ZONE]". */
export const baseQuestName = (name: string) => name.replace(PVP_ZONE, "");
export const isPvpZone = (task: Pick<Task, "nameEn">) => PVP_ZONE.test(task.nameEn);

/** Page acceptée seulement si elle existe et est classée comme quête (ou quête historique). */
export function acceptWikiPage(page: WikiPage): boolean {
  return page.exists && page.categories.some((c) => /^(quests|historical content)$/i.test(c));
}

export interface WikiQuest {
  pageTitle: string;
  pageUrl: string;
  /** Page classée « Historical content » : quête retirée du jeu d'après le wiki. */
  historical: boolean;
  /** Réplique du marchand (section Dialogue). */
  briefing: string | null;
  givenBy: string | null;
  location: string | null;
  /** Niveau de fidélité demandé (paramètre « LL requirement »). */
  loyaltyLevel: number | null;
  /** Kappa d'après le wiki (paramètre « reqkappa ») ; null si non indiqué. */
  kappa: boolean | null;
  /** Quêtes précédentes et suivantes (liens de l'infobox). */
  previous: string[];
  leadsTo: string[];
  /** Section Requirements : blocs, niveau demandé et liens vers d'autres pages. */
  requirements: WikiBlock[];
  requiredLevel: number | null;
  requirementLinks: string[];
  objectives: WikiBlock[];
  rewards: WikiBlock[];
  rewardNumbers: WikiRewardNumbers;
  initialEquipment: WikiBlock[];
  failureDialogue: string | null;
  /** Guide sans le tableau « Related Quest Items » (montré dans « À emporter »). */
  guide: WikiBlock[];
  relatedItems: RelatedItem[];
}

const yesNo = (raw: string | undefined): boolean | null => {
  const t = cleanInline(raw ?? "").toLowerCase();
  return t.startsWith("yes") ? true : t.startsWith("no") ? false : null;
};

/** Lit la page wiki d'une quête (sections absentes = listes vides). */
export function readWikiQuest(page: WikiPage): WikiQuest {
  const { sections } = splitSections(page.wikitext);
  const body = (title: string) => findSection(sections, title)?.body ?? "";
  const blocks = (title: string) => parseBlocks(body(title), page.title);
  const infobox = parseInfobox(page.wikitext);
  const guideBlocks = blocks("Guide");
  const relatedItems = relatedQuestItems(guideBlocks);
  const requirementsText = cleanInline(body("Requirements"));
  const ll = cleanInline(infobox["LL requirement"] ?? "").match(/\d+/);
  const self = page.title.toLowerCase();
  const links = (raw: string | undefined) => wikiLinkTargets(raw ?? "").filter((t) => t.toLowerCase() !== self);
  return {
    pageTitle: page.title,
    pageUrl: page.pageUrl,
    historical: page.categories.some((c) => /^historical content$/i.test(c)),
    briefing: firstQuote(body("Dialogue"), page.title),
    givenBy: cleanInline(infobox["given by"] ?? "") || null,
    location: cleanInline(infobox.location ?? "").replace(/\n/g, ", ") || null,
    loyaltyLevel: ll ? Number(ll[0]) : null,
    kappa: yesNo(infobox.reqkappa),
    previous: links(infobox.previous),
    leadsTo: links(infobox["leads to"]),
    requirements: blocks("Requirements"),
    requiredLevel: Number(requirementsText.match(/\blevel (\d+)/i)?.[1]) || null,
    requirementLinks: links(body("Requirements")),
    objectives: blocks("Objectives"),
    rewards: blocks("Rewards"),
    rewardNumbers: rewardNumbers(body("Rewards")),
    initialEquipment: blocks("Initial Equipment"),
    failureDialogue: firstQuote(body("Failure Dialogue"), page.title),
    guide: guideBlocks.filter((b) => !(b.type === "table" && /related quest items/i.test(b.title ?? ""))),
    relatedItems,
  };
}

// --- Prérequis ---

export interface QuestLink {
  name: string;
  /** Quête correspondante dans l'app, si elle existe (lien cliquable). */
  taskId: string | null;
}

export interface PrerequisiteComparison {
  /** Quêtes préalables selon tarkov.dev (avec le statut attendu). */
  tarkovTasks: (QuestLink & { status: string[] })[];
  /** Quêtes préalables selon le wiki (infobox « previous » + liens de Requirements). */
  wikiTasks: QuestLink[];
  /** Quêtes suivantes : celles qui demandent celle-ci (tarkov.dev) et « leads to » (wiki). */
  tarkovNext: QuestLink[];
  wikiNext: QuestLink[];
  /** Désaccords entre les deux sources, en phrases. */
  warnings: string[];
}

export interface QuestContext {
  tasks: Task[];
  traders: Trader[];
}

/** Retrouve une quête de l'app par son nom anglais, en préférant la même variante (PVP ZONE ou non). */
export function findTaskByEnglishName(name: string, ctx: QuestContext, preferPvp: boolean): Task | null {
  const target = baseQuestName(name).toLowerCase();
  const matches = ctx.tasks.filter((t) => baseQuestName(t.nameEn).toLowerCase() === target);
  return matches.find((t) => isPvpZone(t) === preferPvp) ?? matches[0] ?? null;
}

export function comparePrerequisites(task: Task, wiki: WikiQuest | null, ctx: QuestContext): PrerequisiteComparison {
  const pvp = isPvpZone(task);
  const byId = new Map(ctx.tasks.map((t) => [t.id, t]));
  const link = (name: string): QuestLink => ({ name, taskId: findTaskByEnglishName(name, ctx, pvp)?.id ?? null });
  const isQuestName = (name: string) => findTaskByEnglishName(name, ctx, pvp) !== null;

  const tarkovTasks = (task.details?.taskRequirements ?? []).map((r) => {
    const t = byId.get(r.taskId);
    return { name: t ? baseQuestName(t.nameEn) : r.taskId, taskId: t?.id ?? null, status: r.status };
  });
  const tarkovNext = ctx.tasks
    .filter((t) => t.details?.taskRequirements.some((r) => r.taskId === task.id))
    .map((t) => ({ name: baseQuestName(t.nameEn), taskId: t.id }));

  const wikiNames = wiki ? [...new Set([...wiki.previous, ...wiki.requirementLinks].filter(isQuestName))] : [];
  const wikiTasks = wikiNames.map(link);
  const wikiNext = wiki ? wiki.leadsTo.filter(isQuestName).map(link) : [];

  const warnings: string[] = [];
  if (wiki) {
    const norm = (s: string) => baseQuestName(s).toLowerCase();
    const wikiSet = new Set(wikiNames.map(norm));
    const tarkovSet = new Set(tarkovTasks.map((t) => norm(t.name)));
    for (const t of tarkovTasks) {
      if (!wikiSet.has(norm(t.name))) warnings.push(tr(`tarkov.dev demande la quête « ${t.name} », que le wiki ne mentionne pas.`, `tarkov.dev requires the quest "${t.name}", which the wiki does not mention.`));
    }
    for (const name of wikiNames) {
      if (!tarkovSet.has(norm(name))) warnings.push(tr(`Le wiki indique la quête « ${name} », absente des prérequis de tarkov.dev.`, `The wiki lists the quest "${name}", which is missing from the tarkov.dev prerequisites.`));
    }
    const level = task.minPlayerLevel || null;
    if (wiki.requiredLevel && level && wiki.requiredLevel !== level) {
      warnings.push(tr(`Niveau requis : ${level} selon tarkov.dev, ${wiki.requiredLevel} selon le wiki.`, `Required level: ${level} per tarkov.dev, ${wiki.requiredLevel} per the wiki.`));
    }
    const loyalty = task.details?.traderRequirements.find((r) => r.traderId === task.traderId && r.type === "level")?.value ?? null;
    if (wiki.loyaltyLevel && wiki.loyaltyLevel > 1 && wiki.loyaltyLevel !== loyalty) {
      warnings.push(
        tr(`Niveau de fidélité du marchand : ${loyalty ? `LL${loyalty}` : "non indiqué"} selon tarkov.dev, LL${wiki.loyaltyLevel} selon le wiki.`, `Trader loyalty level: ${loyalty ? `LL${loyalty}` : "not specified"} per tarkov.dev, LL${wiki.loyaltyLevel} per the wiki.`),
      );
    }
    if (wiki.kappa !== null && wiki.kappa !== task.kappaRequired) {
      warnings.push(
        tr(`Kappa : ${task.kappaRequired ? "requise" : "non requise"} selon tarkov.dev, ${wiki.kappa ? "requise" : "non requise"} selon le wiki.`, `Kappa: ${task.kappaRequired ? "required" : "not required"} per tarkov.dev, ${wiki.kappa ? "required" : "not required"} per the wiki.`),
      );
    }
  }
  return { tarkovTasks, wikiTasks, tarkovNext, wikiNext, warnings };
}

// --- À emporter ---

export type PackKind = "key" | "handover" | "find" | "place" | "marker" | "questItem" | "sell";

export interface PackItem {
  kind: PackKind;
  label: string;
  count: number | null;
  /** Find in raid exigé : seulement si tarkov.dev le précise. */
  foundInRaid?: boolean;
  /** Précision (map d'une clé, choix possibles…). */
  detail?: string;
  /** Objets nommés dans le libellé (pour afficher leurs images) ; absent pour « N objets au choix parmi… ». */
  itemIds?: string[];
  /** La quantité est déjà dans le libellé (« 3 objets au choix parmi 52 »). */
  countInLabel?: true;
}

const MAX_LISTED_CHOICES = 3;

/** Liste de ce qu'il faut avoir pour toute la quête, d'après tarkov.dev. */
export function packingList(task: Task, itemNames: Record<string, string>, maps: GameMap[]): PackItem[] {
  const name = (id: string) => itemNames[id] ?? tr(`objet inconnu (${id})`, `unknown item (${id})`);
  const mapName = (id: string) => maps.find((m) => m.id === id)?.name ?? "";
  const items: PackItem[] = [];
  const seen = new Set<string>();
  const add = (key: string, item: PackItem) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };
  const choices = (ids: string[], count: number | null) => {
    if (ids.length <= MAX_LISTED_CHOICES) return { label: ids.map(name).join(tr(" ou ", " or ")), itemIds: ids };
    const n = count ?? 1;
    return {
      label: tr(`${n} objet${n > 1 ? "s" : ""} au choix parmi ${ids.length}`, `${n} item${n > 1 ? "s" : ""} of your choice among ${ids.length}`),
      detail: tr("ex. ", "e.g. ") + `${ids.slice(0, MAX_LISTED_CHOICES).map(name).join(", ")}…`,
      countInLabel: true as const,
    };
  };

  // clés (par map, puis par objectif), une seule fois chacune
  for (const k of task.details?.neededKeys ?? []) {
    add(`key:${[...k.keyIds].sort().join("|")}`, { kind: "key", label: k.keyIds.map(name).join(tr(" ou ", " or ")), itemIds: k.keyIds, count: 1, detail: mapName(k.mapId) || undefined });
  }
  for (const o of task.objectives) {
    for (const group of o.requiredKeyIds ?? []) {
      add(`key:${[...group].sort().join("|")}`, { kind: "key", label: group.map(name).join(tr(" ou ", " or ")), itemIds: group, count: 1 });
    }
  }

  // objets : « trouver » puis « rendre » les mêmes objets = une seule ligne (celle de la remise)
  const itemKey = (ids: string[], count: number | null) => `item:${[...ids].sort().join("|")}:${count}`;
  const handedOver = new Set(
    task.objectives.filter((o) => o.type === "giveItem" && o.itemIds?.length).map((o) => itemKey(o.itemIds!, o.count ?? null)),
  );
  const markers = new Map<string, number>();
  for (const o of task.objectives) {
    const count = o.count ?? null;
    const fir = o.foundInRaid === undefined ? {} : { foundInRaid: o.foundInRaid };
    if ((o.type === "giveItem" || o.type === "findItem" || o.type === "sellItem") && o.itemIds?.length) {
      const kind: PackKind = o.type === "giveItem" ? "handover" : o.type === "findItem" ? "find" : "sell";
      const key = itemKey(o.itemIds, count);
      if (kind === "find" && handedOver.has(key)) continue;
      add(`${kind === "sell" ? "sell" : "obj"}:${key}`, { kind, count, ...fir, ...choices(o.itemIds, count) });
    } else if (o.type === "plantItem" && o.itemIds?.length) {
      add(`place:${o.id}`, { kind: "place", count, ...fir, ...choices(o.itemIds, count) });
    } else if (o.type === "plantQuestItem" && o.questItemId) {
      add(`place:${o.id}`, { kind: "place", count, label: name(o.questItemId), itemIds: [o.questItemId] });
    } else if ((o.type === "findQuestItem" || o.type === "giveQuestItem") && o.questItemId) {
      add(`quest:${o.questItemId}`, { kind: "questItem", count, label: name(o.questItemId), itemIds: [o.questItemId] });
    } else if (o.type === "mark" && o.markerItemId) {
      markers.set(o.markerItemId, (markers.get(o.markerItemId) ?? 0) + 1);
    }
  }
  for (const [id, n] of markers) add(`marker:${id}`, { kind: "marker", count: n, label: name(id), itemIds: [id] });
  return items;
}

// --- Récompenses ---

export const CURRENCY_IDS: Record<"Roubles" | "Dollars" | "Euros", string> = {
  Roubles: "5449016a4bdc2d6f028b456f",
  Dollars: "5696686a4bdc2da3298b456a",
  Euros: "569668774bdc2da2298b4568",
};

/** Différences de récompenses entre le wiki et tarkov.dev (expérience, argent, réputation). */
export function compareRewards(task: Task, wiki: WikiQuest | null, traders: Trader[]): string[] {
  const rewards = task.details?.rewards;
  if (!rewards || !wiki || wiki.rewards.length === 0) return [];
  const diffs: string[] = [];
  const fmt = (n: number) => n.toLocaleString(getLang() === "en" ? "en-US" : "fr-FR");
  const w = wiki.rewardNumbers;
  if (w.experience !== null && w.experience !== rewards.experience) {
    diffs.push(tr(`Expérience : ${fmt(rewards.experience)} selon tarkov.dev, ${fmt(w.experience)} selon le wiki.`, `Experience: ${fmt(rewards.experience)} per tarkov.dev, ${fmt(w.experience)} per the wiki.`));
  }
  for (const [currency, amount] of Object.entries(w.money) as ["Roubles" | "Dollars" | "Euros", number][]) {
    const td = rewards.items.find((i) => i.itemId === CURRENCY_IDS[currency])?.count ?? 0;
    if (td !== amount) diffs.push(tr(`${currency} : ${fmt(td)} selon tarkov.dev, ${fmt(amount)} selon le wiki.`, `${currency}: ${fmt(td)} per tarkov.dev, ${fmt(amount)} per the wiki.`));
  }
  for (const [traderName, value] of Object.entries(w.reputation)) {
    const trader = traders.find((t) => t.normalizedName.toLowerCase() === traderName.toLowerCase());
    if (!trader) continue;
    const td = rewards.standing.find((s) => s.traderId === trader.id)?.value ?? 0;
    if (Math.abs(td - value) > 1e-6) diffs.push(tr(`Réputation ${trader.name} : ${td} selon tarkov.dev, ${value} selon le wiki.`, `Reputation ${trader.name}: ${td} per tarkov.dev, ${value} per the wiki.`));
  }
  return diffs;
}

/** Texte d'une condition d'échec de tarkov.dev. */
export function failConditionText(
  f: { type: string; description: string; taskId?: string; status?: string[] },
  tasksById: Map<string, Task>,
): string {
  if (f.description) return f.description;
  if (f.type === "taskStatus" && f.taskId) {
    const other = tasksById.get(f.taskId)?.name ?? tr("une autre quête", "another quest");
    const status = (f.status ?? []).map((s) => STATUS_LABELS[s] ?? s).join(tr(" ou ", " or "));
    return tr(`Échoue si la quête « ${other} » est ${status || "dans un autre état"}.`, `Fails if the quest "${other}" is ${status || "in another state"}.`);
  }
  return tr(`Condition d'échec (type « ${f.type} »).`, `Fail condition (type "${f.type}").`);
}

export const STATUS_LABELS: Record<string, string> = {
  get complete() { return tr("terminée", "completed"); },
  get active() { return tr("acceptée", "started"); },
  get failed() { return tr("échouée", "failed"); },
};
