// Les services de l'app (rooms, monitor, capture par téléphone, relais du wiki) derrière une seule fonction :
// le serveur de production (index.mjs) et Vite (vite.config.ts) montent ainsi exactement la même chaîne.

import { handleRooms } from "./rooms.mjs";
import { handleMonitor } from "./monitor.mjs";
import { handlePhone } from "./phone.mjs";
import { handleWiki } from "./wiki.mjs";

/** Traite la requête si elle vise un service /api/… ; renvoie false sinon (fichier statique). */
export function handleApi(req, res) {
  return handleRooms(req, res) || handleMonitor(req, res) || handlePhone(req, res) || handleWiki(req, res);
}
