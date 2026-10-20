// Côté PC de la capture par téléphone : session sur le relais, QR code, attente des photos.
// Quand le téléphone confirme, les photos sont récupérées (lecture unique) et remises à CaptureTab pour l'OCR.
import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { tr } from "../lib/i18n";
import { isLocalOrigin, normalizeOrigin, phoneUrl, PHONE_ORIGIN_KEY } from "../lib/phoneCapture";

type State =
  | { step: "idle" }
  | { step: "starting" }
  | { step: "waiting"; code: string; count: number }
  | { step: "fetching" }
  | { step: "error"; message: string };

function savedOrigin(): string {
  try {
    return localStorage.getItem(PHONE_ORIGIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function PhoneCapture({ onPhotos }: { onPhotos: (photos: Blob[]) => void }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [typed, setTyped] = useState(savedOrigin);
  const local = isLocalOrigin(window.location.origin);
  const origin = local ? normalizeOrigin(typed) : window.location.origin;
  const latest = useRef(onPhotos);
  latest.current = onPhotos; // le gestionnaire du flux voit toujours les quêtes du mode actuel
  const code = state.step === "waiting" ? state.code : null;

  // test en local : le serveur donne l'adresse réseau du PC, plus besoin de la taper (reste modifiable)
  useEffect(() => {
    if (!local || typed) return;
    fetch("/api/phone/lan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { origins?: unknown } | null) => {
        const first = Array.isArray(d?.origins) ? d.origins.find((o): o is string => typeof o === "string") : undefined;
        if (first) setTyped((t) => t || first);
      })
      .catch(() => undefined);
  }, [local, typed]);

  const start = async () => {
    setState({ step: "starting" });
    try {
      const res = await fetch("/api/phone", { method: "POST" });
      // un hébergement statique répond en HTML (ou refuse le POST) : seul le vrai serveur répond en JSON
      if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
        return setState({ step: "error", message: tr("Indisponible sur cet hébergement.", "Not available on this hosting.") });
      }
      if (!res.ok) throw new Error(String(res.status));
      setState({ step: "waiting", code: ((await res.json()) as { code: string }).code, count: 0 });
    } catch {
      setState({ step: "error", message: tr("Impossible de démarrer la session (serveur saturé ou injoignable).", "Could not start the session (server busy or unreachable).") });
    }
  };

  // flux du PC : nombre de photos reçues, puis « done » avec les identifiants à récupérer
  useEffect(() => {
    if (!code) return;
    const es = new EventSource(`/api/phone/${code}/events`);
    es.addEventListener("photos", (m) => {
      const count = Number(JSON.parse((m as MessageEvent).data).count);
      if (Number.isFinite(count)) setState((s) => (s.step === "waiting" ? { ...s, count } : s));
    });
    es.addEventListener("done", async (m) => {
      es.close();
      setState({ step: "fetching" });
      try {
        const ids = (JSON.parse((m as MessageEvent).data).ids as unknown[]).filter((id): id is string => typeof id === "string");
        const blobs: Blob[] = [];
        for (const id of ids) {
          const res = await fetch(`/api/phone/${code}/photo/${id}`);
          if (!res.ok) throw new Error(String(res.status));
          blobs.push(await res.blob());
        }
        setState({ step: "idle" });
        latest.current(blobs);
      } catch {
        setState({ step: "error", message: tr("Photos non récupérées (session expirée ?). Recommence.", "Could not fetch the photos (session expired?). Start again.") });
      }
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setState({ step: "error", message: tr("Connexion perdue ou session expirée. Recommence.", "Connection lost or session expired. Start again.") });
    };
    return () => es.close();
  }, [code]);

  // QR en data: GIF généré localement (aucun service externe)
  const qr = useMemo(() => {
    if (!code || !origin) return null;
    const q = qrcode(0, "M");
    q.addData(phoneUrl(origin, code));
    q.make();
    return q.createDataURL(5, 3);
  }, [code, origin]);

  if (state.step === "idle" || state.step === "error") {
    return (
      <div className="btn-row">
        <button className="btn btn-primary btn-small" onClick={() => void start()}>
          {tr("Capturer avec ton téléphone", "Capture with your phone")}
        </button>
        {state.step === "error" && <span className="error small">{state.message}</span>}
      </div>
    );
  }
  if (state.step === "starting" || state.step === "fetching") {
    return <p className="small" role="status">{state.step === "starting" ? tr("Démarrage…", "Starting…") : tr("Récupération des photos…", "Fetching the photos…")}</p>;
  }

  return (
    <div className="phone-capture">
      {local && (
        <label className="small">
          {tr("Adresse de ce PC sur ton réseau, ex. http://192.168.1.20:5174", "Address of this PC on your network, e.g. http://192.168.1.20:5174")}
          <input
            className="input"
            type="url"
            value={typed}
            placeholder="http://192.168.1.20:5174"
            onChange={(e) => {
              setTyped(e.target.value);
              try {
                localStorage.setItem(PHONE_ORIGIN_KEY, e.target.value);
              } catch {
                /* stockage indisponible : l'adresse n'est simplement pas retenue */
              }
            }}
          />
        </label>
      )}
      {qr && origin ? (
        <>
          <p className="small">
            {local
              ? tr("Scanne ce QR code avec ton téléphone (en Wi-Fi sur le même réseau que ce PC : en 5G, il ne peut pas joindre un site local) :", "Scan this QR code with your phone (on the same Wi-Fi as this PC: on mobile data it cannot reach a local site):")
              : tr("Scanne ce QR code avec ton téléphone (Wi-Fi ou 4G/5G) :", "Scan this QR code with your phone (Wi-Fi or mobile data):")}
          </p>
          <img className="phone-qr" src={qr} alt={tr("QR code à scanner avec le téléphone", "QR code to scan with the phone")} width={220} height={220} />
          <p className="muted small phone-url">{phoneUrl(origin, state.code)}</p>
        </>
      ) : (
        <p className="muted small">{tr("Saisis l'adresse de ce PC pour afficher le QR code.", "Enter this PC's address to show the QR code.")}</p>
      )}
      <p className="small" role="status">{tr(`En attente des photos… (${state.count} reçue(s))`, `Waiting for the photos… (${state.count} received)`)}</p>
      <div className="btn-row">
        <button className="btn btn-small" onClick={() => setState({ step: "idle" })}>
          {tr("Annuler", "Cancel")}
        </button>
      </div>
    </div>
  );
}
