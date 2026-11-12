// Onglet "Photos" : photos d'emplacements d'une quête, tirées du wiki Escape from Tarkov.
// Chargées seulement quand l'onglet est ouvert sur une quête (voir src/api/wiki.ts).
import { Fragment, useEffect, useState } from "react";
import type { GameMap, Task } from "../types";
import { WIKI_HOST, loadExitPhotos, loadQuestPhotos, loadWikiPage, photoFilesForSpot, photosForExit, type ExitPhotosPage, type WikiGallery, type WikiPhoto } from "../api/wiki";
import { EXIT_KIND_LABELS } from "../lib/exits";
import { tr } from "../lib/i18n";

/** Sortie cliquée sur la carte. */
export interface ExitPhotosTarget {
  /** Titre de la page de la map sur le wiki (anglais). */
  mapTitle: string;
  /** Nom affiché (langue de l'app) et nom anglais (clé du wiki). */
  name: string;
  nameEn: string;
  kind: keyof typeof EXIT_KIND_LABELS;
}

/** Case en cours de la Main story, cliquée dans la bulle d'un point de la carte. */
export interface StoryPhotosTarget {
  title: string;
  photos: WikiPhoto[];
  /** Sous-titres de l'étape (photo.section = n -> sous-titre n - 1), pour grouper les photos. */
  sections?: string[];
  pageUrl?: string;
  pageTitle?: string;
}

/** Point de la carte cliqué : on ne montre que les photos que le wiki lui associe, si le lien est certain. */
export interface PhotoSpot {
  objectiveId: string;
  mapId: string;
}

interface Props {
  tasks: Task[];
  /** Quêtes sélectionnées (proposées dans la liste). */
  selectedIds: string[];
  /** Quête affichée. */
  taskId: string | null;
  onTaskChange: (taskId: string) => void;
  /** Sortie cliquée sur la carte : ses photos remplacent celles de la quête. */
  exit?: ExitPhotosTarget | null;
  /** Case de la Main story : ses photos remplacent celles de la quête. */
  story?: StoryPhotosTarget | null;
  /** Point cliqué sur la carte : filtre les photos de la quête. */
  spot?: PhotoSpot | null;
  maps?: GameMap[];
  /** « Voir toutes les photos » : abandonne le filtre. */
  onShowAll?: () => void;
}

type PhotosState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; gallery: WikiGallery }
  | { status: "error"; error: string };

function useQuestPhotos(wikiLink: string | null) {
  const [state, setState] = useState<PhotosState>({ status: "idle" });
  useEffect(() => {
    if (!wikiLink) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loadQuestPhotos(wikiLink)
      .then((gallery) => !cancelled && setState({ status: "ready", gallery }))
      .catch((error: Error) => !cancelled && setState({ status: "error", error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [wikiLink]);
  return state;
}

/** Fichiers du wiki propres au point cliqué (null : tout montrer). `undefined` tant que la page du wiki se charge. */
function useSpotFiles(task: Task | undefined, spot: PhotoSpot | null | undefined, maps: GameMap[]): string[] | null | undefined {
  const [state, setState] = useState<{ key: string; files: string[] | null } | null>(null);
  const objective = spot ? task?.objectives.find((o) => o.id === spot.objectiveId) : undefined;
  const map = spot ? maps.find((m) => m.id === spot.mapId) : undefined;
  const wikiLink = task?.wikiLink ?? null;
  const key = spot && objective && map && wikiLink ? `${wikiLink}|${spot.objectiveId}|${spot.mapId}` : null;
  useEffect(() => {
    if (!key || !task || !objective || !map || !wikiLink) return;
    let cancelled = false;
    const textOf = (o: { descriptionEn?: string; description: string }) => o.descriptionEn ?? o.description;
    loadWikiPage(wikiLink).then(
      (page) => {
        if (cancelled) return;
        const files = photoFilesForSpot(page.wikitext, {
          text: textOf(objective),
          allTexts: task.objectives.filter((o) => o.locations.length > 0).map(textOf),
          mapName: map.nameEn ?? map.name,
          mapNames: maps.map((m) => m.nameEn ?? m.name),
        });
        setState({ key, files });
      },
      () => !cancelled && setState({ key, files: null }),
    );
    return () => {
      cancelled = true;
    };
    // task, objective et map découlent de key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return null;
  return state?.key === key ? state.files : undefined;
}

function PhotoList({ photos }: { photos: WikiPhoto[] }) {
  return (
    <ul className="photo-grid">
      {photos.map((photo, i) => (
        <li key={`${photo.file}-${i}`} className="photo">
          <a data-lightbox href={photo.fullUrl} target="_blank" rel="noreferrer" title={photo.caption || tr("Voir en grand", "View full size")}>
            <img src={photo.thumbUrl} alt={photo.caption || photo.file} loading="lazy" referrerPolicy="no-referrer" />
          </a>
          {photo.caption && <p className="photo-caption">{photo.caption}</p>}
          <a className="photo-source" href={photo.pageUrl} target="_blank" rel="noreferrer">
            {tr(`Source : wiki (${photo.file})`, `Source: wiki (${photo.file})`)}
          </a>
        </li>
      ))}
    </ul>
  );
}

type ExitState = { status: "loading" } | { status: "ready"; page: ExitPhotosPage } | { status: "error" };

/** Photos d'une sortie (page de sa map sur le wiki, en cache). Sans photo ou en erreur : lien vers la page. */
function StoryPhotosView({ story }: { story: StoryPhotosTarget }) {
  return (
    <>
      <p>
        <strong>{story.title}</strong>
      </p>
      {story.photos.length === 0 && <p className="muted">{tr("Pas de photo pour cette étape", "No photo for this step")}</p>}
      {/* une liste par sous-partie de l'étape (Customs, Woods…), sous son sous-titre */}
      {[...new Set(story.photos.map((p) => p.section ?? 0))].map((section) => (
        <Fragment key={section}>
          {story.sections?.[section - 1] && <h3 className="photo-section">{story.sections[section - 1]}</h3>}
          <PhotoList photos={story.photos.filter((p) => (p.section ?? 0) === section)} />
        </Fragment>
      ))}
      {story.pageUrl && (
        <p className="muted small">
          {tr("Photos : ", "Photos: ")}
          <a href={story.pageUrl} target="_blank" rel="noreferrer">
            {story.pageTitle ?? tr("wiki Escape from Tarkov", "Escape from Tarkov wiki")}
          </a>{" "}
          (CC BY-NC-SA)
        </p>
      )}
    </>
  );
}

function ExitPhotosView({ exit }: { exit: ExitPhotosTarget }) {
  const [state, setState] = useState<ExitState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadExitPhotos(exit.mapTitle).then(
      (page) => !cancelled && setState({ status: "ready", page }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [exit.mapTitle]);
  const photos = state.status === "ready" ? photosForExit(state.page, exit.nameEn) : [];
  const pageUrl = state.status === "ready" ? state.page.pageUrl : `https://${WIKI_HOST}/wiki/${encodeURIComponent(exit.mapTitle.replace(/ /g, "_"))}`;
  return (
    <>
      <p>
        <strong>{exit.name}</strong> - {exit.mapTitle}
        <br />
        <span className="muted small">{EXIT_KIND_LABELS[exit.kind]}</span>
      </p>
      {state.status === "loading" && <p className="muted">{tr("Chargement des photos du wiki…", "Loading wiki photos…")}</p>}
      {state.status !== "loading" && photos.length === 0 && (
        <p>
          <a href={pageUrl} target="_blank" rel="noreferrer">
            {tr("Voir la page du wiki", "See the wiki page")}
          </a>
        </p>
      )}
      {photos.length > 0 && <PhotoList photos={photos} />}
      <p className="muted small">
        {tr("Photos : ", "Photos: ")}
        <a href={pageUrl} target="_blank" rel="noreferrer">
          {tr("wiki Escape from Tarkov", "Escape from Tarkov wiki")}
        </a>{" "}
        (CC BY-NC-SA)
      </p>
    </>
  );
}

export function PhotosTab({ tasks, selectedIds, taskId, onTaskChange, exit, story, spot, maps = [], onShowAll }: Props) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  // quêtes proposées : la sélection, plus la quête demandée si elle n'en fait pas partie
  const optionIds = [...new Set([...(taskId ? [taskId] : []), ...selectedIds])].filter(
    (id) => tasksById.get(id)?.wikiLink,
  );
  const current = (taskId && tasksById.get(taskId)) || (optionIds[0] ? tasksById.get(optionIds[0]) : undefined);
  const photos = useQuestPhotos(exit || story ? null : (current?.wikiLink ?? null));
  const spotFiles = useSpotFiles(exit || story ? undefined : current, spot, maps);

  if (!current && !exit && !story) {
    return (
      <div className="tab-body empty">
        <p>{tr("Sélectionne une quête, ou utilise le bouton « Photos des emplacements » d'une quête dans la liste.", "Select a quest, or use the “Location photos” button of a quest in the list.")}</p>
      </div>
    );
  }

  return (
    <div className="tab-body">
      <select
        className="input"
        value={exit || story ? "" : current!.id}
        onChange={(e) => e.target.value && onTaskChange(e.target.value)}
        aria-label={tr("Quête dont afficher les photos", "Quest to show photos for")}
      >
        {story && <option value="">{story.title}</option>}
        {!story && exit && <option value="">{tr("Sortie : ", "Exit: ")}{exit.name}</option>}
        {optionIds.map((id) => (
          <option key={id} value={id}>
            {tasksById.get(id)!.name}
          </option>
        ))}
      </select>
      {story ? <StoryPhotosView story={story} /> : exit ? <ExitPhotosView exit={exit} /> : <QuestPhotos current={current!} photos={photos} spotFiles={spotFiles} onShowAll={onShowAll} />}
    </div>
  );
}

function QuestPhotos({ current, photos, spotFiles, onShowAll }: { current: Task; photos: PhotosState; spotFiles: string[] | null | undefined; onShowAll?: () => void }) {
  // spotFiles undefined : le wiki se charge, on n'affiche pas tout en attendant
  const all = photos.status === "ready" ? photos.gallery.photos : [];
  const some = spotFiles ? spotFiles.flatMap((f) => all.find((p) => p.file === f) ?? []) : [];
  const shown = some.length > 0 && some.length < all.length ? some : all;
  const filtered = shown !== all;
  const waiting = spotFiles === undefined;
  return (
    <>
      <p className="muted small">
        {tr("Photos de la section « Guide » du", "Photos from the \"Guide\" section of the")}{" "}
        <a href={current.wikiLink!} target="_blank" rel="noreferrer">
          {tr("wiki Escape from Tarkov", "Escape from Tarkov wiki")}
        </a>
        {filtered
          ? tr(", légendes en anglais.", ", captions in English.")
          : tr(
              ", légendes en anglais. Elles concernent la quête entière : le wiki ne dit pas à quel point de la carte correspond chaque photo.",
              ", captions in English. They apply to the whole quest: the wiki does not say which point on the map each photo matches.",
            )}
      </p>

      {(photos.status === "loading" || (photos.status === "ready" && waiting)) && <p className="muted">{tr("Chargement des photos du wiki…", "Loading wiki photos…")}</p>}
      {photos.status === "error" && (
        <p className="error">
          {tr(`Le wiki ne répond pas (${photos.error}).`, `The wiki is not responding (${photos.error}).`)}{" "}
          <a href={current.wikiLink!} target="_blank" rel="noreferrer">
            {tr("Ouvrir la page de la quête", "Open the quest page")}
          </a>
        </p>
      )}
      {photos.status === "ready" && photos.gallery.photos.length === 0 && (
        <p className="muted">{tr("Le wiki n'a pas de photos d'emplacement pour cette quête.", "The wiki has no location photos for this quest.")}</p>
      )}
      {photos.status === "ready" && !waiting && filtered && (
        <p className="muted small">
          {tr(`Photos de ce point (${shown.length} sur ${all.length})`, `Photos of this point (${shown.length} of ${all.length})`)}{" "}
          <button className="btn btn-ghost btn-small" onClick={onShowAll}>
            {tr("Voir toutes les photos", "Show all photos")}
          </button>
        </p>
      )}
      {photos.status === "ready" && !waiting && shown.length > 0 && <PhotoList photos={shown} />}
    </>
  );
}
