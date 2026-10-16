// Item finder : où un objet sert-il ? Index construit depuis les quêtes déjà chargées (objectifs, clés,
// récompenses) et depuis le hideout (niveaux de stations). Logique pure, sans réseau.
import type { Task } from "../types";
import { tr } from "./i18n";

export type UseRole = "give" | "find" | "plant" | "sell" | "use" | "build" | "key" | "marker" | "reward" | "offer";
export interface ItemUse {
  role: UseRole;
  count?: number;
  /** Trouvé en raid exigé. */
  fir?: boolean;
  optional?: boolean;
}
export interface QuestUse {
  taskId: string;
  uses: ItemUse[];
}
export interface HideoutUse {
  stationId: string;
  level: number;
  count: number;
  fir: boolean;
}

const OBJECTIVE_ROLE: Record<string, UseRole> = {
  giveItem: "give",
  giveQuestItem: "give",
  haveItem: "give",
  findItem: "find",
  findQuestItem: "find",
  plantItem: "plant",
  plantQuestItem: "plant",
  sellItem: "sell",
};

/** Objet -> quêtes qui le demandent, le font utiliser, exigent sa clé ou le donnent en récompense. */
export function buildUsageIndex(tasks: Task[]): Map<string, QuestUse[]> {
  const index = new Map<string, QuestUse[]>();
  for (const task of tasks) {
    const mine = new Map<string, ItemUse[]>();
    const add = (id: string | undefined, use: ItemUse) => {
      if (!id) return;
      const list = mine.get(id) ?? [];
      // une même exigence répétée (clé de l'objectif et de la quête) ne compte qu'une fois
      if (!list.some((u) => u.role === use.role && u.count === use.count && u.fir === use.fir && u.optional === use.optional)) list.push(use);
      mine.set(id, list);
    };
    for (const o of task.objectives) {
      const optional = o.optional || undefined;
      const role = OBJECTIVE_ROLE[o.type];
      const fir = o.foundInRaid || undefined;
      if (role) for (const id of [...(o.itemIds ?? []), ...(o.questItemId ? [o.questItemId] : [])]) add(id, { role, count: o.count, fir, optional });
      for (const id of o.useItemIds ?? []) add(id, { role: "use", count: o.count, optional });
      for (const id of o.buildItemIds ?? []) add(id, { role: "build", optional });
      for (const id of o.requiredKeyIds?.flat() ?? []) add(id, { role: "key", optional });
      add(o.markerItemId, { role: "marker", optional });
    }
    for (const k of task.details?.neededKeys ?? []) for (const id of k.keyIds) add(id, { role: "key" });
    for (const r of task.details?.rewards?.items ?? []) add(r.itemId, { role: "reward", count: r.count });
    for (const r of task.details?.rewards?.offerUnlocks ?? []) add(r.itemId, { role: "offer" });
    for (const [id, uses] of mine) {
      const list = index.get(id) ?? [];
      list.push({ taskId: task.id, uses });
      index.set(id, list);
    }
  }
  return index;
}

/** Hideout brut de json.tarkov.dev (stations indexées par id) -> objet -> niveaux de stations qui l'exigent. */
export function buildHideoutIndex(raw: unknown): Map<string, HideoutUse[]> {
  const index = new Map<string, HideoutUse[]>();
  const stations = (Array.isArray(raw) ? raw : Object.values((raw ?? {}) as object)) as any[];
  for (const station of stations) {
    for (const lvl of Array.isArray(station?.levels) ? station.levels : []) {
      for (const req of Array.isArray(lvl?.itemRequirements) ? lvl.itemRequirements : []) {
        const id = typeof req?.item === "string" ? req.item : req?.item?.id;
        if (!id || typeof station.id !== "string") continue;
        const list = index.get(id) ?? [];
        list.push({ stationId: station.id, level: Number(lvl.level) || 0, count: Number(req.count) || 1, fir: req.attributes?.foundInRaid === true });
        index.set(id, list);
      }
    }
  }
  return index;
}

/** Échange (barter) ou craft qui touche l'objet : il y entre (« in ») ou en sort (« out »). */
export interface Exchange {
  side: "in" | "out";
  /** Marchand (barter) ou station (craft), et niveau. */
  sourceId: string;
  level: number;
  /** Quantité de CET objet dans l'échange. */
  count: number;
  fir: boolean;
  /** Durée du craft en secondes. */
  duration?: number;
  /** Les objets de l'autre côté : ce qu'on obtient (side « in ») ou ce qu'il faut donner (side « out »). */
  others: { id: string; count: number }[];
  /** Side « in » : les autres objets à donner avec celui-ci. */
  with?: { id: string; count: number }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON brut de l'API, lu prudemment */
const idOf = (v: any): string | undefined => (typeof v === "string" ? v : typeof v?.id === "string" ? v.id : undefined);
const entries = (raw: unknown): any[] => (Array.isArray(raw) ? raw : Object.values((raw ?? {}) as object));
const stacks = (list: any): { id: string; count: number; fir: boolean }[] =>
  (Array.isArray(list) ? list : [])
    .map((r: any) => ({ id: idOf(r?.item) ?? "", count: Number(r?.count) || 1, fir: r?.attributes?.foundInRaid === true }))
    .filter((r: { id: string }) => r.id);

/** Barters (« offeredItem » contre « requiredItems ») ou crafts (« productItem » avec « requiredItems ») -> objet -> échanges. */
function buildExchangeIndex(raw: unknown, kind: "barter" | "craft"): Map<string, Exchange[]> {
  const index = new Map<string, Exchange[]>();
  const push = (id: string, e: Exchange) => index.set(id, [...(index.get(id) ?? []), e]);
  for (const x of entries(raw)) {
    const out = stacks([kind === "barter" ? x?.offeredItem : x?.productItem]);
    const inn = stacks(x?.requiredItems);
    const sourceId = (kind === "barter" ? idOf(x?.trader) : idOf(x?.station)) ?? "";
    if (!sourceId || out.length === 0) continue;
    const base = { sourceId, level: Number(kind === "barter" ? x.minTraderLevel : x.level) || 1, ...(kind === "craft" ? { duration: Number(x.duration) || 0 } : {}) };
    for (const r of inn) push(r.id, { ...base, side: "in", count: r.count, fir: r.fir, others: out.map((o) => ({ id: o.id, count: o.count })), with: inn.filter((x) => x !== r).map((x) => ({ id: x.id, count: x.count })) });
    for (const o of out) push(o.id, { ...base, side: "out", count: o.count, fir: false, others: inn.map((r) => ({ id: r.id, count: r.count })) });
  }
  return index;
}
export const buildBarterIndex = (raw: unknown) => buildExchangeIndex(raw, "barter");
export const buildCraftIndex = (raw: unknown) => buildExchangeIndex(raw, "craft");

/** 4350 s -> « 1 h 13 min » */
export function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")} min` : ""}` : `${m} min`;
}

const ROLE_LABEL: Record<UseRole, [string, string]> = {
  give: ["À rendre", "Hand over"],
  find: ["À trouver", "Find"],
  plant: ["À poser", "Place"],
  sell: ["À vendre", "Sell"],
  use: ["À utiliser", "Use"],
  build: ["Pour monter une arme", "For a weapon build"],
  key: ["Clé requise", "Key required"],
  marker: ["Marqueur à poser", "Marker to place"],
  reward: ["Récompense", "Reward"],
  offer: ["Débloque une offre de marchand", "Unlocks a trader offer"],
};
const WITH_COUNT: UseRole[] = ["give", "find", "plant", "sell", "use", "reward"];

/** « À rendre ×3 (FIR) » */
export function useLabel(u: ItemUse): string {
  const [fr, en] = ROLE_LABEL[u.role];
  const count = u.count !== undefined && WITH_COUNT.includes(u.role) && (u.count > 1 || u.role === "reward") ? ` ×${u.count}` : "";
  return tr(fr, en) + count + (u.fir ? " (FIR)" : "") + (u.optional ? tr(" (optionnel)", " (optional)") : "");
}
