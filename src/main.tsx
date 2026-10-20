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
  void import("./App").then(({ default: App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
