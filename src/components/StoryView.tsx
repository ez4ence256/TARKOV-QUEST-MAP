// Main story : chapitres du wiki lus étape par étape (voir src/lib/story.ts et src/api/story.ts).
// Contient les hooks de chargement, la fiche d'un chapitre (onglet Fiche quête) et la petite
// carte de l'onglet Sélection. Aucun point sur la carte : le wiki ne donne pas de coordonnées.
import { useEffect, useMemo, useState } from "react";
import { loadStoryChapters, loadStoryPage, type StoryPageData } from "../api/story";
import { pageUrlFor, type WikiPhoto } from "../api/wiki";
import { getLang, tr } from "../lib/i18n";
import { currentStepIndex, fillItems, resolveStory, stepsDone, stepText, storyStepId, type ResolvedStory, type StoryChapter } from "../lib/story";
import type { StoryItem } from "../lib/storyPoints";
import { ConfirmButton } from "./ConfirmButton";
import { WikiBlocks } from "./WikiBlocks";

/** Nom du chapitre dans la langue de l'interface (le titre anglais si la liste n'est pas chargée). */
export const chapterName = (chapters: StoryChapter[] | null, id: string) => {
  const c = chapters?.find((x) => x.id === id);
  return c ? (getLang() === "en" ? c.nameEn : c.name) : id;
};

export type ChaptersState = { status: "idle" | "loading" | "error"; chapters: null } | { status: "ready"; chapters: StoryChapter[] };

/** Liste des chapitres (1 requête, ou 2 en français), seulement quand `enabled`. */
export function useStoryChapters(enabled: boolean, retry = 0): ChaptersState {
  const [state, setState] = useState<ChaptersState>({ status: "idle", chapters: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => (s.status === "ready" ? s : { status: "loading", chapters: null }));
    loadStoryChapters(getLang())
      .then((chapters) => !cancelled && setState({ status: "ready", chapters }))
      .catch(() => !cancelled && setState({ status: "error", chapters: null }));
    return () => {
      cancelled = true;
    };
  }, [enabled, retry]);
  return state;
}

type PageState =
  | { status: "loading" }
  | { status: "error"; error: string }
  /** url / title : page dont vient le texte affiché (française ou anglaise). */
  | { status: "ready"; en: StoryPageData; resolved: ResolvedStory; url: string; title: string };

/** Chapitre lu dans la langue demandée (page anglaise + française si elle existe), avec le texte retenu. */
async function resolveChapter(id: string, chapters: ChaptersState, wantFr: boolean) {
  const frTitle = (wantFr && chapters.chapters?.find((c) => c.id === id)?.frTitle) || null;
  const en = await loadStoryPage(id, "en");
  const fr = frTitle ? await loadStoryPage(frTitle, "fr").catch(() => null) : null;
  const frUsable = fr && fr.exists ? fr : null;
  const resolved = resolveStory(en, frUsable, wantFr, (c) => chapterName(chapters.chapters, c));
  const used = resolved.choice.lang === "fr" && frUsable ? frUsable : en;
  return { en, resolved, url: used.pageUrl, title: used.title };
}

/**
 * Cases (conditions puis étapes, titre et texte dans la langue de l'interface) de chapitres, pour la
 * carte : seulement les chapitres demandés, la page étant déjà en cache quand elle a été ouverte.
 */
export function useStoryItems(ids: string[], itemNames: Record<string, string>): { items: Record<string, StoryItem[]>; chapters: StoryChapter[] | null } {
  const wantFr = getLang() === "fr";
  const chapters = useStoryChapters(ids.length > 0);
  const [items, setItems] = useState<Record<string, StoryItem[]>>({});
  const waiting = wantFr && (chapters.status === "loading" || chapters.status === "idle");
  const idsKey = ids.join("|");
  useEffect(() => {
    if (waiting) return;
    let cancelled = false;
    for (const id of ids) {
      resolveChapter(id, chapters, wantFr)
        .then(({ resolved, url, title }) => {
          const list = [...resolved.requirements, ...resolved.steps].map((s) => ({ key: s.key, title: fillItems(s.title, itemNames), text: stepText(s), photos: (s.photos ?? []).map((p) => ({ ...p, caption: fillItems(p.caption, itemNames) })), pageUrl: url, pageTitle: title }));
          if (!cancelled) setItems((prev) => ({ ...prev, [id]: list }));
        })
        .catch(() => undefined); // wiki injoignable : pas de point, la fiche du chapitre montre l'erreur
    }
    return () => {
      cancelled = true;
    };
  }, [idsKey, wantFr, waiting, itemNames]);
  return { items, chapters: chapters.chapters };
}

/**
 * Chapitre ouvert : la page anglaise, plus la française en mode français quand la liste dit
 * qu'elle existe (la progression est toujours enregistrée sous les titres anglais).
 */
export function useStoryPage(id: string, chapters: ChaptersState, wantFr: boolean): PageState {
  const [state, setState] = useState<PageState>({ status: "loading" });
  // en mode français, on attend la liste (elle donne le titre de la page française)
  const waiting = wantFr && (chapters.status === "loading" || chapters.status === "idle");
  const frTitle = (wantFr && chapters.chapters?.find((c) => c.id === id)?.frTitle) || null;
  useEffect(() => {
    if (waiting) return;
    let cancelled = false;
    setState({ status: "loading" });
    resolveChapter(id, chapters, wantFr)
      .then((ready) => !cancelled && setState({ status: "ready", ...ready }))
      .catch((error: Error) => !cancelled && setState({ status: "error", error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [id, frTitle, wantFr, waiting]);
  return state;
}

function Photo({ photo, itemNames }: { photo: WikiPhoto; itemNames: Record<string, string> }) {
  const caption = fillItems(photo.caption, itemNames);
  return (
    <a className="story-photo" href={photo.fullUrl} target="_blank" rel="noopener noreferrer" title={caption || tr("Voir en grand", "View full size")}>
      <img src={photo.thumbUrl} alt={caption || photo.file} width={120} height={68} loading="lazy" referrerPolicy="no-referrer" />
    </a>
  );
}

type Item = ResolvedStory["steps"][number];

/** Une case de la fiche (condition ou étape) : titre, texte et photos. `n` : numéro affiché (aucun pour une condition). */
function StoryRow({ item, n, index, done, current, itemNames, itemIcons, onChange }: { item: Item; n?: number; index: number; done: boolean; current: boolean; itemNames: Record<string, string>; itemIcons?: Record<string, string>; onChange: (done: boolean) => void }) {
  return (
    <li id={`story-step-${index}`} className={`story-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`} aria-current={current ? "step" : undefined}>
      <label className="story-step-head">
        <input type="checkbox" checked={done} onChange={(e) => onChange(e.target.checked)} aria-label={done ? tr("Marquer comme non fait", "Mark as not done") : tr("Marquer comme fait", "Mark as done")} />
        <span className="story-step-title">
          {n !== undefined && <span className="story-step-n">{n}.</span>} {fillItems(item.title, itemNames)}
          {item.branch && <span className="tag">{tr(`Fin ${item.branch}`, `${item.branch} ending`)}</span>}
          {current && <span className="tag tag-current">{tr("en cours", "current")}</span>}
        </span>
      </label>
      {(item.blocks.length > 0 || (item.photos?.length ?? 0) > 0) && (
        <div className="story-step-body">
          <WikiBlocks blocks={item.blocks} itemNames={itemNames} itemIcons={itemIcons} />
          {(item.photos?.length ?? 0) > 0 && (
            <div className="story-photos">
              {item.photos!.map((p) => (
                <Photo key={p.file} photo={p} itemNames={itemNames} />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const languageNote = (reason: string) =>
  reason === "missing"
    ? tr("Pas de page française pour ce chapitre sur le wiki : texte anglais.", "No French page for this chapter on the wiki: English text.")
    : tr(
        "La page française ne correspond pas à la page anglaise (étapes en nombre ou en ordre différent) : texte anglais, pour que vos cases cochées restent justes.",
        "The French page does not match the English one (different number or order of steps): English text, so that your ticks stay correct.",
      );

interface ViewProps {
  chapterId: string;
  /** Noms des objets (tarkov.dev), pour les {{identifiants}} du texte français. */
  itemNames: Record<string, string>;
  itemIcons?: Record<string, string>;
  chapters: ChaptersState;
  done: Record<string, true>;
  onSetStep: (stepKey: string, done: boolean) => void;
  onReset: () => void;
  onRetryChapters: () => void;
}

/** Fiche d'un chapitre : conditions de déblocage, objectifs, puis toutes les étapes dans l'ordre, la première case non cochée en évidence. */
export function StoryChapterView({ chapterId, itemNames, itemIcons, chapters, done, onSetStep, onReset, onRetryChapters }: ViewProps) {
  const wantFr = getLang() === "fr";
  const page = useStoryPage(chapterId, chapters, wantFr);
  const chapter = chapters.chapters?.find((c) => c.id === chapterId);
  const name = chapterName(chapters.chapters, chapterId);
  const enPageUrl = pageUrlFor(chapterId);

  // conditions d'abord, puis étapes : même liste pour le décompte et la case « en cours »
  const keys = page.status === "ready" ? [...page.resolved.requirements, ...page.resolved.steps].map((s) => s.key) : [];
  const ticked = stepsDone(chapterId, keys, done);
  const current = currentStepIndex(chapterId, keys, done);

  return (
    <>
      <div className="quest-tab-head">
        <h2 className="quest-tab-title">{name}</h2>
        {page.status === "ready" && (
          <span className={`progress-badge ${keys.length > 0 && ticked === keys.length ? "is-complete" : ""}`} title={tr("Conditions et étapes faites / total", "Requirements and steps done / total")}>
            {ticked}/{keys.length}
          </span>
        )}
      </div>
      <div className="muted small">
        {tr("Main story", "Main story")}
        {chapter && getLang() !== "en" && chapter.nameEn !== chapter.name ? ` · EN${tr(" : ", ": ")}${chapter.nameEn}` : ""}
      </div>
      <div className="warn-box" role="note">
        {tr("Attention : ce guide contient des spoilers de l'histoire.", "Warning: this guide contains story spoilers.")}
      </div>

      {page.status === "loading" && <p className="muted">{tr("Chargement du chapitre depuis le wiki…", "Loading the chapter from the wiki…")}</p>}
      {page.status === "error" && (
        <p className="error">
          {tr(`Le wiki ne répond pas (${page.error}).`, `The wiki is not responding (${page.error}).`)}{" "}
          <a href={enPageUrl} target="_blank" rel="noopener noreferrer">
            {tr("Ouvrir la page du chapitre", "Open the chapter page")}
          </a>
          {chapters.status === "error" && (
            <>
              {" · "}
              <button className="link" onClick={onRetryChapters}>
                {tr("Réessayer", "Retry")}
              </button>
            </>
          )}
        </p>
      )}
      {page.status === "ready" && !page.en.exists && (
        <p className="muted">
          {tr("Le wiki n'a pas de page pour ce chapitre.", "The wiki has no page for this chapter.")}{" "}
          <a href={enPageUrl} target="_blank" rel="noopener noreferrer">
            {tr("Ouvrir sur le wiki", "Open on the wiki")}
          </a>
        </p>
      )}
      {page.status === "ready" && page.en.exists && <Chapter page={page} chapterId={chapterId} itemNames={itemNames} itemIcons={itemIcons} done={done} ticked={ticked} current={current} wantFr={wantFr} onSetStep={onSetStep} onReset={onReset} />}
    </>
  );
}

function Chapter({
  page,
  chapterId,
  itemNames,
  itemIcons,
  done,
  ticked,
  current,
  wantFr,
  onSetStep,
  onReset,
}: {
  page: Extract<PageState, { status: "ready" }>;
  chapterId: string;
  itemNames: Record<string, string>;
  itemIcons?: Record<string, string>;
  done: Record<string, true>;
  ticked: number;
  current: number;
  wantFr: boolean;
  onSetStep: (stepKey: string, done: boolean) => void;
  onReset: () => void;
}) {
  const { resolved } = page;
  const hasBranches = useMemo(() => resolved.steps.some((s) => s.branch), [resolved]);
  return (
    <>
      <div className="wiki-source small">
        {tr("Texte et photos : wiki Escape from Tarkov (CC BY-NC-SA).", "Text and photos: Escape from Tarkov wiki (CC BY-NC-SA).")}{" "}
        <a href={page.url} target="_blank" rel="noopener noreferrer">
          {page.title}
        </a>
      </div>
      {wantFr && resolved.choice.lang === "en" && resolved.choice.reason !== "none" && <p className="muted small">{languageNote(resolved.choice.reason)}</p>}
      {hasBranches && (
        <p className="muted small">
          {tr(
            "Ce chapitre a plusieurs fins : suivez les étapes de la vôtre (étiquette « Fin »). Les autres restent décochées, donc la progression n'atteint pas le total.",
            "This chapter has several endings: follow the steps of yours (\"Ending\" tag). The others stay unticked, so progress never reaches the total.",
          )}
        </p>
      )}

      {resolved.requirements.length > 0 && (
        <section className="story-unlock" aria-label={tr("Pour débloquer ce chapitre", "To unlock this chapter")}>
          <div className="subhead">{tr(`Pour débloquer ce chapitre (${resolved.requirements.length})`, `To unlock this chapter (${resolved.requirements.length})`)}</div>
          <p className="muted small">{tr("À faire avant les étapes ci-dessous ; comptées dans la progression.", "Do these before the steps below; they count in the progress.")}</p>
          <ol className="story-steps story-reqs">
            {resolved.requirements.map((req, i) => (
              <StoryRow key={req.key} item={req} index={i} done={Boolean(done[storyStepId(chapterId, req.key)])} current={i === current} itemNames={itemNames} itemIcons={itemIcons} onChange={(v) => onSetStep(req.key, v)} />
            ))}
          </ol>
        </section>
      )}

      {resolved.objectives.length > 0 && (
        <details className="quest-section">
          <summary>{tr("Objectifs du chapitre", "Chapter objectives")}</summary>
          <div className="quest-section-body">
            <WikiBlocks blocks={resolved.objectives} itemNames={itemNames} itemIcons={itemIcons} />
          </div>
        </details>
      )}

      <div className="row-between">
        <div className="subhead">{tr(`Étapes (${resolved.steps.length})`, `Steps (${resolved.steps.length})`)}</div>
        <div className="btn-row">
          {current > 0 && (
            <button className="btn btn-small" onClick={() => document.getElementById(`story-step-${current}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}>
              {tr("Aller à l'étape en cours", "Go to current step")}
            </button>
          )}
          {ticked > 0 && (
            <ConfirmButton
              label={tr("Réinitialiser ce chapitre", "Reset this chapter")}
              question={tr(`Décocher ${ticked} étape${ticked > 1 ? "s" : ""} ?`, `Untick ${ticked} step${ticked > 1 ? "s" : ""}?`)}
              confirmLabel={tr("Oui", "Yes")}
              onConfirm={onReset}
            />
          )}
        </div>
      </div>
      {resolved.steps.length === 0 && <p className="muted">{tr("Aucune étape trouvée dans le Guide du wiki.", "No steps found in the wiki Guide.")}</p>}

      <ol className="story-steps">
        {resolved.steps.map((step, i) => {
          const index = resolved.requirements.length + i;
          return (
            <StoryRow key={step.key} item={step} n={i + 1} index={index} done={Boolean(done[storyStepId(chapterId, step.key)])} current={index === current} itemNames={itemNames} itemIcons={itemIcons} onChange={(v) => onSetStep(step.key, v)} />
          );
        })}
      </ol>
    </>
  );
}

/** Carte d'un chapitre dans l'onglet Sélection : nom, étapes faites / total, bouton pour l'ouvrir. */
export function StoryCard({
  chapterId,
  chapters,
  done,
  onOpen,
  onRemove,
}: {
  chapterId: string;
  chapters: ChaptersState;
  done: Record<string, true>;
  onOpen: () => void;
  onRemove: () => void;
}) {
  // seule la page anglaise sert au décompte (les clés de progression viennent d'elle)
  const page = useStoryPage(chapterId, chapters, false);
  const keys = page.status === "ready" ? [...page.resolved.requirements, ...page.resolved.steps].map((s) => s.key) : [];
  const name = chapterName(chapters.chapters, chapterId);
  return (
    <section className="task-card story-card">
      <div className="task-head">
        <div className="task-title">
          <div className="task-name">{name}</div>
          <div className="muted small">
            Main story
            {" · "}
            <button className="link" onClick={onOpen}>
              📜 {tr("ouvrir le chapitre", "open the chapter")}
            </button>
          </div>
        </div>
        {page.status === "ready" ? (
          <span className={`progress-badge ${keys.length > 0 && stepsDone(chapterId, keys, done) === keys.length ? "is-complete" : ""}`} title={tr("Conditions et étapes faites / total", "Requirements and steps done / total")}>
            {stepsDone(chapterId, keys, done)}/{keys.length}
          </span>
        ) : (
          <span className="muted small">{page.status === "loading" ? "…" : tr("wiki ?", "wiki?")}</span>
        )}
        <button className="icon-btn" onClick={onRemove} aria-label={tr(`Retirer ${name}`, `Remove ${name}`)} title={tr("Retirer", "Remove")}>
          ×
        </button>
      </div>
    </section>
  );
}
