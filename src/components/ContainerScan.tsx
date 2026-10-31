// Onglet « Conteneur » de la fenêtre Objets : capture d'un conteneur (junk box, sac, scav case) collée
// avec Ctrl+V, objets reconnus par leur nom court, rangés en « à vendre », « à vérifier » et « à garder ».
// La lecture est dans ItemFinder (collage) et lib/containerGrid (grille, noms, tailles) ; ici, l'affichage :
// compteurs (filtre), capture avec un cadre par objet, liste compacte reliée aux cadres.

import { useState } from "react";
import type { ListedItem } from "../api/itemList";
import type { Found, ItemSize } from "../lib/containerGrid";
import { tr } from "../lib/i18n";
import { ItemThumb } from "./ItemThumb";

/** Objet reconnu, sa place (px de la capture) et sa taille en cases. */
export type PlacedFound = Found & ItemSize & { x: number; y: number };

export type ScanState =
  | { step: "reading"; progress: number | null }
  | { step: "done"; url: string; width: number; height: number; pitch: number; found: PlacedFound[] }
  | { step: "error"; message: string };

type Status = "sell" | "check" | "keep";
const STATUSES: Status[] = ["sell", "check", "keep"];
const LABEL: Record<Status, () => string> = {
  sell: () => tr("À vendre", "To sell"),
  check: () => tr("À vérifier", "To check"),
  keep: () => tr("À garder", "To keep"),
};

interface Group {
  key: string;
  ids: string[];
  item: ListedItem | undefined;
  count: number;
  status: Status;
  /** Lu à une ou deux lettres près : le nom affiché permet de vérifier. */
  approx: boolean;
  reasons: string[];
}

const groupKey = (ids: string[]) => [...ids].sort().join("|");

export function ContainerScan(p: {
  scan: ScanState | null;
  byId: Map<string, ListedItem>;
  iconSrc: (id: string) => string;
  /** Raisons de garder l'objet (quêtes, planque) avec les filtres actuels ; vide = vendable. */
  keepReasons: (id: string) => string[];
  /** Filtres actifs, rappelés au-dessus du résultat. */
  filterLabel: string | null;
  onPick: (item: ListedItem) => void;
  onFile: (file: File) => void;
}) {
  const { scan } = p;
  // compteurs cochés : seuls leurs cadres et leurs listes restent (aucun coché = tout) ; ligne survolée : ses cadres ressortent
  const [only, setOnly] = useState<Set<Status>>(new Set());
  const [hot, setHot] = useState<string | null>(null);

  const picker = (label: string) => (
    <label className="btn btn-small container-file">
      {label}
      <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && p.onFile(e.target.files[0])} />
    </label>
  );

  if (!scan)
    return (
      <div className="container-empty">
        <p className="container-empty-title">{tr("Ctrl+V n'importe quel conteneur ou inventaire", "Ctrl+V any container or inventory")}</p>
        <p className="muted">
          {tr(
            "Junk box, sac, scav case… : capture sa grille dans le jeu, colle-la ici, et vois tout de suite quoi vendre ou garder. Chaque objet est reconnu par le nom court écrit sur sa case.",
            "Junk box, backpack, scav case…: capture its grid in the game, paste it here, and instantly see what to sell or keep. Each item is recognized by the short name on its cell.",
          )}
        </p>
        <p className="muted small">
          {tr(
            "« Kappa seulement » et « Planque » décident de ce qui est à garder ; sans eux, tout ce qu'une quête pas faite ou la planque demande est gardé.",
            "“Kappa only” and “Hideout” decide what to keep; without them, everything an unfinished quest or the hideout needs is kept.",
          )}
        </p>
        {picker(tr("Choisir une image…", "Choose an image…"))}
      </div>
    );
  if (scan.step === "reading")
    return (
      <div className="container-empty" role="status">
        <p className="container-empty-title">{tr("Lecture de la capture…", "Reading the screenshot…")}</p>
        <div className="container-progress">
          <span style={{ width: `${Math.round((scan.progress ?? 0.03) * 100)}%` }} />
        </div>
      </div>
    );
  if (scan.step === "error")
    return (
      <div className="container-empty">
        <p>{scan.message}</p>
        {picker(tr("Choisir une image…", "Choose an image…"))}
      </div>
    );

  const statusOf = (ids: string[]): Status => {
    const keeps = ids.map((id) => p.keepReasons(id).length > 0);
    return keeps.every(Boolean) ? "keep" : keeps.some(Boolean) ? "check" : "sell";
  };
  const groups = new Map<string, Group>();
  for (const f of scan.found) {
    const key = groupKey(f.ids);
    const g = groups.get(key) ?? {
      key,
      ids: f.ids,
      // « AP-20 » : la balle et sa boîte portent le même nom court ; la balle, bien plus courante, est montrée
      item: f.ids
        .map((id) => p.byId.get(id))
        .filter((i) => i !== undefined)
        .sort((a, b) => Number(/ammo pack/i.test(a.nameEn)) - Number(/ammo pack/i.test(b.nameEn)))[0],
      count: 0,
      status: statusOf(f.ids),
      approx: false,
      reasons: [...new Set(f.ids.flatMap((id) => p.keepReasons(id)))],
    };
    g.count++;
    if (f.how === "fuzzy") g.approx = true;
    groups.set(key, g);
  }
  const all = [...groups.values()].sort((a, b) => b.count - a.count || (a.item?.name ?? "").localeCompare(b.item?.name ?? ""));
  const count = (s: Status) => all.filter((g) => g.status === s).reduce((n, g) => n + g.count, 0);
  const shown = (s: Status) => only.size === 0 || only.has(s);
  const toggle = (s: Status) => {
    setHot(null); // la ligne survolée peut disparaître de la liste sans « mouseleave »
    setOnly((o) => {
      const next = new Set(o);
      if (!next.delete(s)) next.add(s);
      return next;
    });
  };

  return (
    <div className="container-result">
      <div className="container-bar">
        {STATUSES.map((s) => (
          <label key={s} className={`container-chip is-${s}${only.has(s) ? " active" : ""}${!shown(s) ? " dim" : ""}`}>
            <input type="checkbox" checked={only.has(s)} onChange={() => toggle(s)} />
            <span className="container-chip-n">{count(s)}</span> {LABEL[s]()}
          </label>
        ))}
        <span className="container-bar-note muted small">
          {p.filterLabel ? tr(`Gardé : ${p.filterLabel}`, `Kept: ${p.filterLabel}`) : tr("Gardé : toutes les quêtes", "Kept: all quests")}
        </span>
        {picker(tr("Autre image…", "Another image…"))}
      </div>

      <div className="container-layout">
        <div className="container-shot-col">
          <div className={`container-shot${hot ? " has-hot" : ""}`}>
            <img src={scan.url} alt={tr("Capture collée", "Pasted screenshot")} width={scan.width} height={scan.height} />
            {scan.found.map((f, i) => {
              const key = groupKey(f.ids);
              const g = groups.get(key)!;
              const lit = hot === key;
              return (
                <button
                  key={i}
                  className={`container-box is-${g.status}${!shown(g.status) || (hot && !lit) ? " dim" : ""}${lit ? " hot" : ""}`}
                  title={g.item?.name}
                  aria-label={g.item?.name}
                  tabIndex={-1}
                  onClick={() => g.item && p.onPick(g.item)}
                  onMouseEnter={() => setHot(key)}
                  onMouseLeave={() => setHot(null)}
                  style={{
                    left: `${((f.x - (f.w - 1) * scan.pitch) / scan.width) * 100}%`,
                    top: `${(f.y / scan.height) * 100}%`,
                    width: `${((f.w * scan.pitch) / scan.width) * 100}%`,
                    height: `${((f.h * scan.pitch) / scan.height) * 100}%`,
                  }}
                />
              );
            })}
          </div>
          <p className="muted small">
            {tr(
              `${scan.found.length} objets reconnus. Une case sans cadre n'a pas été lue : regarde-la toi-même. « ≈ » : nom lu à une lettre près.`,
              `${scan.found.length} items recognized. A cell without a frame was not read: check it yourself. “≈”: name read with a wrong letter.`,
            )}
          </p>
        </div>

        <div className="container-lists">
          {STATUSES.filter(shown).map((s) => {
            const list = all.filter((g) => g.status === s);
            if (!list.length) return null;
            return (
              <section key={s} className={`container-section is-${s}`}>
                <h3 className="container-section-title">
                  {LABEL[s]()} <span className="container-section-n">{count(s)}</span>
                </h3>
                {s === "check" && <p className="muted small">{tr("Plusieurs objets portent ce nom, pas tous à garder : ouvre-le.", "Several items share this name, not all kept: open it.")}</p>}
                <ul className="container-rows">
                  {list.map((g) => (
                    <li key={g.key}>
                      <button className={`container-row${hot === g.key ? " hot" : ""}`} onClick={() => g.item && p.onPick(g.item)} onMouseEnter={() => setHot(g.key)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(g.key)} onBlur={() => setHot(null)}>
                        <ItemThumb src={p.iconSrc(g.ids[0])} name="" size={36} />
                        <span className="container-row-text">
                          <span className="container-row-name">
                            {g.item?.name ?? g.ids[0]}
                            {g.approx && <span className="muted" title={tr("Nom lu à une lettre près", "Name read with a wrong letter")}> ≈</span>}
                          </span>
                          {s !== "sell" && g.reasons.length > 0 && (
                            <span className="container-row-why">
                              {g.reasons.slice(0, 2).join(", ")}
                              {g.reasons.length > 2 && ` +${g.reasons.length - 2}`}
                            </span>
                          )}
                          {g.ids.length > 1 && <span className="muted small">{tr(`${g.ids.length} objets portent ce nom`, `${g.ids.length} items share this name`)}</span>}
                        </span>
                        <span className="container-row-n">×{g.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
