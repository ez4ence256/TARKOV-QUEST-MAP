import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { phoneCodeFromSearch } from "./lib/phoneCapture";

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
  // La copie statique de l'accueil (index.html) est déjà à l'écran. Sur une connexion rapide, l'appli arrive avant que
  // le navigateur ait fini de l'afficher et de la mesurer : React la remplacerait trop tôt, et l'affichage du titre
  // serait compté après le JavaScript (LCP). On attend donc que cet affichage soit enregistré, 300 ms au plus.
  // Sans copie statique (interface en anglais) : aucune attente.
  const shellShown = new Promise<void>((resolve) => {
    if (!document.querySelector("#root .is-shell")) return resolve();
    const timer = window.setTimeout(resolve, 300);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")) {
      new PerformanceObserver((list, observer) => {
        if (!list.getEntries().length) return;
        observer.disconnect();
        done();
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } else {
      // navigateur sans cette mesure : deux images suffisent pour que la copie soit affichée
      requestAnimationFrame(() => requestAnimationFrame(done));
    }
  });
  void Promise.all([import("./App"), shellShown]).then(([{ default: App }]) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
