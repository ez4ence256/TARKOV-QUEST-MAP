// Onglet "Photos" : photos d'emplacements d'une quête, tirées du wiki Escape from Tarkov.
// Chargées seulement quand l'onglet est ouvert sur une quête (voir src/api/wiki.ts).
import { useEffect, useState } from "react";
import type { Task } from "../types";
import { loadQuestPhotos, type WikiGallery } from "../api/wiki";
import { tr } from "../lib/i18n";

interface Props {
  tasks: Task[];
  /** Quêtes sélectionnées (proposées dans la liste). */
  selectedIds: string[];
  /** Quête affichée. */
  taskId: string | null;
  onTaskChange: (taskId: string) => void;
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

export function PhotosTab({ tasks, selectedIds, taskId, onTaskChange }: Props) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  // quêtes proposées : la sélection, plus la quête demandée si elle n'en fait pas partie
  const optionIds = [...new Set([...(taskId ? [taskId] : []), ...selectedIds])].filter(
    (id) => tasksById.get(id)?.wikiLink,
  );
  const current = (taskId && tasksById.get(taskId)) || (optionIds[0] ? tasksById.get(optionIds[0]) : undefined);
  const photos = useQuestPhotos(current?.wikiLink ?? null);

  if (!current) {
    return (
      <div className="tab-body empty">
        <p>{tr("Sélectionnez une quête, ou utilisez le bouton 📷 d'une quête dans la liste.", "Select a quest, or use the 📷 button of a quest in the list.")}</p>
      </div>
    );
  }

  return (
    <div className="tab-body">
      <select
        className="input"
        value={current.id}
        onChange={(e) => onTaskChange(e.target.value)}
        aria-label={tr("Quête dont afficher les photos", "Quest to show photos for")}
      >
        {optionIds.map((id) => (
          <option key={id} value={id}>
            {tasksById.get(id)!.name}
          </option>
        ))}
      </select>
      <p className="muted small">
        {tr("Photos de la section « Guide » du", "Photos from the \"Guide\" section of the")}{" "}
        <a href={current.wikiLink!} target="_blank" rel="noreferrer">
          {tr("wiki Escape from Tarkov", "Escape from Tarkov wiki")}
        </a>
        {tr(
          ", légendes en anglais. Elles concernent la quête entière : le wiki ne dit pas à quel point de la carte correspond chaque photo.",
          ", captions in English. They apply to the whole quest: the wiki does not say which point on the map each photo matches.",
        )}
      </p>

      {photos.status === "loading" && <p className="muted">{tr("Chargement des photos du wiki…", "Loading wiki photos…")}</p>}
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
      {photos.status === "ready" && photos.gallery.photos.length > 0 && (
        <ul className="photo-grid">
          {photos.gallery.photos.map((photo) => (
            <li key={photo.file} className="photo">
              <a href={photo.fullUrl} target="_blank" rel="noreferrer" title={tr("Voir en grand", "View full size")}>
                <img src={photo.thumbUrl} alt={photo.caption || photo.file} loading="lazy" referrerPolicy="no-referrer" />
              </a>
              {photo.caption && <p className="photo-caption">{photo.caption}</p>}
              <a className="photo-source" href={photo.pageUrl} target="_blank" rel="noreferrer">
                {tr(`Source : wiki (${photo.file})`, `Source: wiki (${photo.file})`)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
