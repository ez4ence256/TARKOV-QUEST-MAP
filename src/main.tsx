import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { phoneCodeFromSearch } from "./lib/phoneCapture";

/** Attend que le navigateur ait enregistré le contenu déjà affiché (LCP), 300 ms au plus. */
function contentPainted(): Promise<void> {
  const el = document.getElementById("root");
  if (!el?.hasChildNodes()) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const observer = new PerformanceObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 300);
    } catch {
      resolve(); // PerformanceObserver ou ce type d'entrée indisponible
    }
  });
}

// `/?phone=CODE` (QR code de la capture par téléphone) : page minimale, sans charger l'appli ni lire son stockage.
const phoneCode = phoneCodeFromSearch(window.location.search);
const root = createRoot(document.getElementById("root")!);
if (phoneCode) {
  void import("./components/PhonePage").then(({ PhonePage }) =>
    root.render(
      <StrictMode>
        <PhonePage code={phoneCode} />
      </StrictMode>,
    ),
  );
} else {
  // la copie statique de l'accueil (index.html) doit être peinte et comptée comme LCP avant que React la remplace
  void Promise.all([import("./App"), contentPainted()]).then(([{ default: App }]) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
