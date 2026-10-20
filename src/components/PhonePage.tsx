// Page minimale ouverte par le QR code (`/?phone=CODE`) : photos du menu Tâches, envoyées au PC.
// Rien n'est stocké sur le téléphone (ni localStorage ni état de l'appli) ; les photos ne font que transiter par le relais.
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { tr } from "../lib/i18n";
import { downscaleSize } from "../lib/phoneCapture";

interface Photo {
  id: string;
  url: string; // miniature locale (URL d'objet)
}

/** Réduit la photo (côté long ≤ 1600 px) et l'encode en JPEG 0,85 ; l'orientation EXIF est appliquée. */
async function shrink(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = downscaleSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode");
  return blob;
}

const HTTP_ERRORS: Record<number, [string, string]> = {
  404: ["Session expirée : rouvre le QR code sur le PC.", "Session expired: open the QR code on the PC again."],
  409: ["Trop de photos (12 au plus) ou déjà envoyé.", "Too many photos (12 at most) or already sent."],
  413: ["Photo trop lourde.", "Photo too large."],
  429: ["Trop de requêtes, réessaie dans une minute.", "Too many requests, try again in a minute."],
  503: ["Serveur saturé, réessaie dans une minute.", "Server busy, try again in a minute."],
};
const httpError = (status: number) => tr(...(HTTP_ERRORS[status] ?? ["Envoi impossible.", "Could not send."]));

export function PhonePage({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = `/api/phone/${code}`;

  useEffect(() => {
    document.title = tr("Photos des quêtes", "Quest photos");
  }, []);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de reprendre la même photo / une nouvelle tout de suite
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await shrink(file);
      const res = await fetch(`${api}/photo`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error(httpError(res.status));
      const { id } = (await res.json()) as { id: string };
      setPhotos((p) => [...p, { id, url: URL.createObjectURL(blob) }]);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === "encode" || err instanceof TypeError || (err as Error).name === "InvalidStateError" ? tr("Photo illisible ou réseau coupé : réessaie.", "Unreadable photo or network down: try again.") : msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: Photo) => {
    setError(null);
    try {
      const res = await fetch(`${api}/photo/${photo.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(httpError(res.status));
      URL.revokeObjectURL(photo.url);
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
    } catch (err) {
      setError(err instanceof TypeError ? tr("Réseau coupé : réessaie.", "Network down: try again.") : (err as Error).message);
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/done`, { method: "POST" });
      if (!res.ok) throw new Error(httpError(res.status));
      setSent(true);
    } catch (err) {
      setError(err instanceof TypeError ? tr("Réseau coupé : réessaie.", "Network down: try again.") : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <main className="phone-page">
        <h1>{tr("Envoyé !", "Sent!")}</h1>
        <p>{tr("Tu peux fermer cette page.", "You can close this page.")}</p>
      </main>
    );
  }

  return (
    <main className="phone-page">
      <h1>{tr("Tarkov Quest Planner — photos des quêtes", "Tarkov Quest Planner — quest photos")}</h1>
      <p className="muted">
        {tr(
          "Photographie le menu Tâches du jeu, fais défiler la liste, recommence autant que nécessaire.",
          "Photograph the in-game Tasks menu, scroll the list, and repeat as needed.",
        )}
      </p>
      <button className="btn btn-primary phone-shot" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? tr("Envoi…", "Sending…") : tr("Prendre une photo", "Take a photo")}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      {error && <p className="error" role="alert">{error}</p>}
      <p role="status">{`${photos.length} photo${photos.length > 1 ? "s" : ""}`}</p>
      <ul className="phone-thumbs">
        {photos.map((p, i) => (
          <li key={p.id}>
            <img src={p.url} alt={`Photo ${i + 1}`} />
            <button className="btn btn-small" disabled={busy} onClick={() => void remove(p)}>
              {tr("Retirer", "Remove")}
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-primary phone-shot" disabled={busy || photos.length === 0} onClick={() => void send()}>
        {tr("C'est bon, envoyer", "Done, send")}
      </button>
    </main>
  );
}
