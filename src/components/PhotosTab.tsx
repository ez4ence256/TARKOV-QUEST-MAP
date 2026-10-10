// Onglet "Photos" : photos d'emplacements d'une quête, tirées du wiki Escape from Tarkov.
// Chargées seulement quand l'onglet est ouvert sur une quête (voir src/api/wikiPhotos.ts).
import { useEffect, useState } from "react";
import type { Task } from "../types";
import { loadQuestPhotos, type WikiGallery } from "../api/wikiPhotos";

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
        <p>Sélectionnez une quête, ou utilisez le bouton 📷 d'une quête dans la liste.</p>
      </div>
    );
  }

  return (
    <div className="tab-body">
      <select
        className="input"
        value={current.id}
        onChange={(e) => onTaskChange(e.target.value)}
        aria-label="Quête dont afficher les photos"
      >
        {optionIds.map((id) => (
          <option key={id} value={id}>
            {tasksById.get(id)!.name}
          </option>
        ))}
      </select>
      <p className="muted small">
        Photos de la section « Guide » du{" "}
        <a href={current.wikiLink!} target="_blank" rel="noreferrer">
          wiki Escape from Tarkov
        </a>
        , légendes en anglais. Elles concernent la quête entière : le wiki ne dit pas à quel point de la carte
        correspond chaque photo.
      </p>

      {photos.status === "loading" && <p className="muted">Chargement des photos du wiki…</p>}
      {photos.status === "error" && (
        <p className="error">
          Le wiki ne répond pas ({photos.error}).{" "}
          <a href={current.wikiLink!} target="_blank" rel="noreferrer">
            Ouvrir la page de la quête
          </a>
        </p>
      )}
      {photos.status === "ready" && photos.gallery.photos.length === 0 && (
        <p className="muted">Le wiki n'a pas de photos d'emplacement pour cette quête.</p>
      )}
      {photos.status === "ready" && photos.gallery.photos.length > 0 && (
        <ul className="photo-grid">
          {photos.gallery.photos.map((photo) => (
            <li key={photo.file} className="photo">
              <a href={photo.fullUrl} target="_blank" rel="noreferrer" title="Voir en grand">
                <img src={photo.thumbUrl} alt={photo.caption || photo.file} loading="lazy" referrerPolicy="no-referrer" />
              </a>
              {photo.caption && <p className="photo-caption">{photo.caption}</p>}
              <a className="photo-source" href={photo.pageUrl} target="_blank" rel="noreferrer">
                Source : wiki ({photo.file})
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
