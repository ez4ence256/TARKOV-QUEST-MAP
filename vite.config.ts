import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base: "./" permet de servir le build depuis n'importe quel sous-dossier
// (ex. GitHub Pages) sans configuration supplémentaire.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
