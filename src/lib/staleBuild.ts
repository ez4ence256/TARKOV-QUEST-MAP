// Page ouverte avant une mise à jour du site : ses fichiers chargés à la demande (OCR…) n'existent plus.
import { tr } from "./i18n";

/** Échec de chargement d'un module à la demande (Chrome, Firefox, Safari). */
export const isStaleBuildError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    String((error as Error | undefined)?.message ?? error),
  );

export const staleBuildMessage = () =>
  tr(
    "Le site a été mis à jour pendant que la page était ouverte : recharge la page (F5).",
    "The site was updated while this page was open: reload the page (F5).",
  );
