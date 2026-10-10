// Onglet « Capture » : importer des quêtes depuis une capture du menu Personnage > Tâches.
// Ctrl+V (géré par App), bouton « Choisir une image » ou glisser-déposer. L'OCR tourne dans
// le navigateur (lib/ocr.ts) ; le rapprochement avec les noms est strict (lib/ocrMatch.ts).
// Rien n'est jamais ajouté sans passer par l'écran de vérification.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../types";
import { matchOcrLines, type OcrMatch, type OcrMatchResult } from "../lib/ocrMatch";
import type { OcrProgress } from "../lib/ocr";

interface Props {
  /** Quêtes du mode actuel (seules candidates). */
  tasks: Task[];
  /** Image reçue par Ctrl+V ailleurs dans l'app ; `n` change à chaque collage. */
  pasted: { blob: Blob; n: number } | null;
  /** Ajoute les quêtes cochées ; renvoie le message à afficher (map affichée ou non). */
  onApply: (taskIds: string[], replace: boolean) => string;
}

type State =
  | { step: "idle" }
  | { step: "reading"; progress: OcrProgress | null }
  | { step: "review"; result: OcrMatchResult }
  | { step: "error"; message: string };

/** Étapes de Tesseract.js, en français. */
const STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "Chargement du moteur de lecture…",
  "initializing tesseract": "Démarrage du moteur…",
  "loading language traineddata": "Données de langue (téléchargées la première fois)…",
  "loading language traineddata (from cache)": "Données de langue (cache)…",
  "initializing api": "Démarrage du moteur…",
  "recognizing text": "Lecture du texte…",
};

export function CaptureTab({ tasks, pasted, onApply }: Props) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const handleImage = async (blob: Blob) => {
    setMessage(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setState({ step: "reading", progress: null });
    try {
      const { readImageLines } = await import("../lib/ocr");
      const lines = await readImageLines(blob, (progress) => setState({ step: "reading", progress }));
      const result = matchOcrLines(
        lines.map((l) => l.text),
        tasks,
      );
      setChecked(new Set(result.recognized.map((m) => m.taskId)));
      setState({ step: "review", result });
    } catch (error) {
      setState({
        step: "error",
        message: `Lecture impossible : ${(error as Error).message}. La première utilisation demande une connexion (données de langue).`,
      });
    }
  };

  // image collée ailleurs dans l'app (Ctrl+V)
  useEffect(() => {
    if (pasted) void handleImage(pasted.blob);
    // seulement à chaque nouveau collage
  }, [pasted?.n]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const toggle = (taskId: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  const row = (m: OcrMatch, uncertain: boolean) => {
    const task = tasksById.get(m.taskId);
    if (!task) return null;
    return (
      <li key={m.taskId} className="capture-row">
        <label className="check">
          <input type="checkbox" checked={checked.has(m.taskId)} onChange={() => toggle(m.taskId)} />
          <span>
            <span className="capture-name">{task.name}</span>
            {task.nameEn !== task.name && <span className="muted small"> · {task.nameEn}</span>}
            <span className="muted small capture-read">
              {uncertain ? "Lu par l'OCR : " : "Lu : "}« {m.text} »{uncertain ? ` · ressemblance ${Math.round(m.score * 100)} %` : ""}
            </span>
          </span>
        </label>
      </li>
    );
  };

  const progress = state.step === "reading" ? state.progress : null;

  return (
    <div
      className={`tab-body capture-tab ${dragging ? "is-dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
        if (file) void handleImage(file);
      }}
    >
      <div className="subhead">Importer des quêtes depuis une capture</div>
      <p className="small">
        Faites une capture du menu <strong>Personnage &gt; Tâches</strong> du jeu (filtré par map si vous voulez), puis{" "}
        <kbd>Ctrl</kbd>+<kbd>V</kbd> n'importe où dans l'app (sauf dans un champ de texte), ou :
      </p>
      <div className="btn-row">
        <button className="btn btn-primary btn-small" onClick={() => fileRef.current?.click()}>
          Choisir une image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImage(file);
            e.target.value = "";
          }}
        />
        <span className="muted small">ou glissez-déposez l'image ici.</span>
      </div>
      <p className="muted small">
        La lecture se fait dans votre navigateur : l'image n'est envoyée nulle part. La première fois, environ 4 Mo de
        données de langue (français + anglais) sont téléchargés, puis gardés en cache.
      </p>

      {preview && <img className="capture-preview" src={preview} alt="Capture importée" />}

      {state.step === "reading" && (
        <div className="capture-progress" role="status">
          <div>{STATUS_LABELS[progress?.status ?? ""] ?? "Préparation…"}</div>
          <progress max={1} value={progress?.progress ?? 0} />
        </div>
      )}
      {state.step === "error" && <p className="error">{state.message}</p>}

      {state.step === "review" && (
        <>
          {state.result.recognized.length === 0 && state.result.uncertain.length === 0 ? (
            <p className="warn-box">
              Aucune quête reconnue sur cette capture. Essayez une capture plus nette du menu Personnage &gt; Tâches,
              recadrée sur la liste des quêtes, et vérifiez que le bon mode de jeu est choisi.
            </p>
          ) : (
            <>
              {state.result.recognized.length > 0 && (
                <section>
                  <div className="subhead">Reconnues ({state.result.recognized.length})</div>
                  <ul className="capture-list">{state.result.recognized.map((m) => row(m, false))}</ul>
                </section>
              )}
              {state.result.uncertain.length > 0 && (
                <section>
                  <div className="subhead">Incertaines ({state.result.uncertain.length}) : à vérifier</div>
                  <ul className="capture-list">{state.result.uncertain.map((m) => row(m, true))}</ul>
                </section>
              )}
              <label className="check">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Remplacer ma sélection actuelle
              </label>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={checked.size === 0}
                  onClick={() => {
                    setMessage(onApply([...checked], replace));
                    setState({ step: "idle" });
                  }}
                >
                  Ajouter à la sélection ({checked.size})
                </button>
              </div>
            </>
          )}
          {state.result.unmatched.length > 0 && (
            <details className="capture-unmatched">
              <summary>Lignes non reconnues ({state.result.unmatched.length})</summary>
              <ul className="plain-list small">
                {state.result.unmatched.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {message && (
        <p className="capture-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
