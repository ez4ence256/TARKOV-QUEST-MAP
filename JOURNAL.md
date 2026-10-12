# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (11 octobre 2026, fin de session 7)

| Élément | État |
|---|---|
| Branche | **`main`** (renommée depuis `claude/tarkov-quest-planner-axir48` en session 7 ; dépôt **`ez4ence256/TARKOV-QUEST-MAP`**). Sur GitHub, `main` est la seule branche et la branche par défaut. |
| Derniers commits | `c12988e` case « Extracts Scav » · `709720a` main story mélangée aux quêtes · `d51bc68` photos du wiki dans le Guide · `72e0a00` pages wiki supprimées si stockage plein · `c3dc322` main story · `3302076` cache du wiki renouvelé à chaque utilisation · `6ff1ee9` cache libéré si plein · `959bb7c` images fiche quête |
| Travail non commité | Seulement `.claude/launch.json` (volontairement hors du dépôt : chemin propre à cette machine) |
| Tests | 207/207 au vert (`npx vitest run`) |
| Compilation | OK (`npm run build`). Avertissement Vite : le fichier principal fait 516 Ko (> 500 Ko). L'OCR est dans des fichiers séparés, chargés à la demande. |
| Vérifié dans le navigateur | Panneau à 400 / 440 / 520 / 540 / 560 / 720 px, fenêtre de 1024 px et zoom simulé à 125 %, téléphone · sélection épinglée avec filtre et recherche, « Tout désélectionner » · ordre des sections sur Signal - Partie 3 · sorties sur Douanes (niveau principal + sous-sol) et Labs (principal + niveau technique) · import d'une **image de synthèse** (Ctrl+V, vérification, ajout, map choisie) |
| **Pas vérifié** | **Import avec les captures de l'utilisateur** : elles ne sont pas arrivées en session 5 (ni l'image de référence 3D). |
| **Poussé sur GitHub** | Session 7 poussée jusqu'à `72e0a00` par URL HTTPS (vérifié avec `git ls-remote`). Voir « Push ». |
| **En attente de validation** | Main story : chapitres suivis en session 7, à valider à l'usage ; étude 3D (session 5) ; liste finale des libellés d'onglets (proposition) |

### Push
- Sessions 2 à 4 : jamais poussé (identifiants GitHub absents de la session de Claude).
- Session 5 : **une tentative à la toute fin, réussie** : `git push origin claude/tarkov-quest-planner-axir48` a envoyé `ecbe77a..63a8ed7` (18 commits). Après `git fetch`, local et origin sont identiques (0 en avance, 0 en retard). Les identifiants GitHub sont donc maintenant disponibles dans la session (gestionnaire d'identifiants Windows ou GitHub Desktop) ; aucune configuration Git n'a été modifiée.
- Ce commit de journal a été poussé ensuite par un second push.
- **Session 6** : le dépôt est maintenant `ez4ence256/TARKOV-QUEST-MAP`. Le remote `origin` est en SSH et ne marche pas sur ce PC. Pousser avec `git push https://github.com/ez4ence256/TARKOV-QUEST-MAP.git claude/tarkov-quest-planner-axir48`, puis vérifier avec `git ls-remote <url> claude/tarkov-quest-planner-axir48` contre `HEAD` (`origin/...` n'est pas mis à jour par un push par URL).
- **Session 7 (fin)** : branche renommée en `main`. Pousser avec `git push https://github.com/ez4ence256/TARKOV-QUEST-MAP.git main`, vérifier avec `git ls-remote https://github.com/ez4ence256/TARKOV-QUEST-MAP.git main`.

### Commits depuis la session 1 (locaux, à pousser)

| Commit | Session | Contenu |
|---|---|---|
| `1342d80` | 2 | Étages (sélecteur) et fonds en tuiles pour Labs, Labyrinth et Icebreaker |
| `0fb439b` | 3 | Étages supérieurs affichés sur la carte de base |
| `3591047` | 3 | Recherche bilingue tolérante aux fautes |
| `8b74a2f` | 3 | Spawns d'objets de quête numérotés et photos du wiki |
| `77c642c` | 3 | Journal |
| `78d3e96` | 4 | Réinitialisation de la progression |
| `e25a742` | 4 | Onglet Quête : objectifs à cocher, progression, réinitialisation |
| `c79daf5` | 4 | Journal (rapport sur l'API du wiki) |
| `708060c` | 4 | Onglet Quête : informations complètes du wiki et de tarkov.dev |
| `e362f55`, `0c90833`, `bd1f31d` | 4 | Journal |
| `010a9b4` | 5 | Panneau réglable (440 px par défaut), onglets sans césure |
| `7d2655a` | 5 | Quêtes sélectionnées épinglées, « Tout désélectionner » |
| `3cad781` | 5 | Ordre des sections de la fiche quête |
| `70bf964` | 5 | Sorties, coops et transits |
| `09d0146` | 5 | Import de quêtes par capture d'écran (OCR) |
| `63a8ed7` | 5 | Journal (fin de session 5), poussé |
| (suivant) | 5 | Journal : résultat du push |
| `8ad2e50` | 6 | Interface bilingue FR/EN : `tr(fr, en)` dans `src/lib/i18n.ts`, choix enregistré (`tqp:lang`), sélecteur dans la barre du haut et sur l'écran de choix du mode ; changer de langue reconstruit la mise en page |
| `7355d20` | 6 | Variantes de maps regroupées sur leur map de base |
| `bd5db84`, `879395c` | 6 | Carte libre sans effet ressort ; vue conservée au changement de langue et au chargement du calibrage |
| `1a441f1` | 6 | Filtre de map = map affichée |
| `df9e5f3` | 6 | Icônes de sorties PMC / Scav / communes (légende dans Réglages → Affichage) |
| `188e0b8` | 6 | Photos du wiki dans la bulle des sorties |
| `959bb7c` | 6 | Images de la fiche quête (objets, clés, récompenses), prérequis cliquables |
| `6ff1ee9` | 6 | Cache : place libérée si le stockage local est plein |
| `3302076` | 7 | Wiki : cache renouvelé à chaque utilisation, entrées expirées purgées |
| `c3dc322` | 7 | Main story : chapitres du wiki suivis étape par étape |
| `72e0a00` | 7 | Wiki : pages les moins utilisées supprimées si le stockage est plein |
| `d51bc68` | 7 | Fiche quête : photos du wiki dans la section Guide |
| `709720a` | 7 | Main story : chapitres mélangés aux quêtes, « Main story » à la place du marchand |
| `c12988e` | 7 | Carte : case « Extracts Scav » dans la barre du haut (sorties Scav seules masquées, sorties communes gardées ; choix retenu `tqp:showScavExits`) |

### Tests (207)

| Fichier | Ce qui est couvert |
|---|---|
| `src/map/crs.test.ts` | conversion de coordonnées identique à tarkov.dev |
| `src/map/levels.test.ts` | étages supérieurs / souterrains, numéro d'étage, Icebreaker |
| `src/api/tarkovJson.test.ts` | lecture de l'API (traductions, positions, prérequis, clés, Find in raid, récompenses, noms d'objets, **sorties, coops et transits**) |
| `src/api/cache.test.ts` | écriture du cache : autres entrées `tqp:data:` supprimées si le stockage est plein, avertissement si l'échec persiste |
| `src/api/wiki.test.ts` | accès au wiki : page partagée, page absente, erreurs, photos, cache, demandes simultanées |
| `src/lib/wikiText.test.ts` | lecture du wikitext sur des extraits réels |
| `src/lib/questWiki.test.ts` | association, PVP ZONE, page historique, désaccords, « à emporter », récompenses |
| `src/lib/questSections.test.ts` | ordre des sections de la fiche quête, sections ouvertes par défaut |
| `src/lib/questFilter.test.ts` | liste des quêtes : sélection épinglée, filtres, recherche, « Tout désélectionner » sans effet sur la progression |
| `src/lib/panelWidth.test.ts` | largeur du panneau : bornes, 60 % de la fenêtre, enregistrement |
| `src/lib/exits.test.ts` | sorties : classement normal / transit / coop, fusion des doublons, échappement du nom, placement réel sur Douanes, Labs, Littoral |
| `src/lib/ocrMatch.test.ts` | rapprochement OCR ↔ quêtes sur textes simulés (bruit, fautes, deux lignes, Partie 2/3, FR/EN, PVP ZONE), map dominante |
| `src/lib/ocr.test.ts` | séparation des colonnes d'une ligne lue |
| `src/lib/search.test.ts` | recherche bilingue |
| `src/lib/points.test.ts` | points de la carte, spawns numérotés, progression |
| `src/state/store.test.ts` | réinitialisation, isolation entre modes, ajout de quêtes par capture |
| `src/lib/roomSync.test.ts` | rooms : différences d'état, validation, fusion, opérations distantes |
| `server/rooms.test.ts` | rooms et serveur statique sur un vrai port (SSE à deux clients, limites, 404, MIME, traversée) |

---

## Historique

### Sessions 1 à 4 (résumé)
- **1 (cloud)** : app React + Vite + Leaflet ; données tarkov.dev (FR + repli EN, cache 6 h) ; fonds SVG calibrés ; plusieurs quêtes, icônes, popups, « Fait », notes, points perso, export/import JSON.
- **2** : Node installé ; étages ; fonds en tuiles (Labs, Labyrinth, Icebreaker).
- **3** : étages supérieurs sur la carte de base ; recherche bilingue ; spawns numérotés ; photos du wiki.
- **4** : réinitialisation de la progression ; onglet Quête ; texte du wiki (description, prérequis comparés, à emporter, récompenses, guide) ; bandeau PVP ZONE.

### Session 5 (desktop)

**Images annoncées non reçues** : l'image de référence 3D et les captures du menu Personnage > Tâches n'ont pas été jointes au message. Rien n'a été mesuré sur elles.

**Tâche 1 : panneau et onglets** (`010a9b4`)
- *Trouvé* : panneau fixe à 380 px ; onglets à largeur égale, avec la césure automatique ajoutée en session 4 (« sélec-tionnée » coupé) ; logos seulement sur 2 onglets.
- *Fait* :
  - panneau à **440 px par défaut**, réglable de **400 à 720 px** (et au plus 60 % de la fenêtre) avec une poignée : glisser, flèches au clavier, double-clic pour revenir à 440 ; largeur enregistrée (`tqp:panelWidth`) ;
  - la carte suit la largeur du panneau (ResizeObserver puis `invalidateSize`) ;
  - plus de césure ni de mot coupé. Libellés courts : **Sélection, Quêtes, Capture, Fiche quête, Photos, Mes points, Réglages** (nom complet en infobulle et pour les lecteurs d'écran, ex. « Quête sélectionnée ») ;
  - logos en plus du texte quand le panneau fait 540 px ou plus (requête de conteneur) ; logos seuls sur téléphone, avec le nombre de quêtes sélectionnées.
- *Mesuré* : une seule ligne par libellé de 440 à 720 px. À 400 px, « Fiche quête » et « Mes points » passent sur 2 lignes, un mot entier par ligne. Aucun débordement.
- *Zoom à 125 %* : **simulé** (`zoom` CSS, puis fenêtre de 1024 px), pas le vrai Ctrl+ du navigateur.
- *Captures avant/après* envoyées dans la conversation.

**Tâche 2 : sélection épinglée** (`7d2655a`)
- *Trouvé* : l'onglet « Sélection » n'affiche que les quêtes sélectionnées, et il avait **déjà** « Tout désélectionner ». La liste complète avec recherche et filtres est l'onglet **« Quêtes »** : c'est là que l'épinglage a été fait.
- *Fait* :
  - zone « Quêtes sélectionnées (n) » en tête, puis « Autres quêtes » ; recherche et filtres s'appliquent aussi à la zone, qui indique combien de quêtes sélectionnées sont masquées ;
  - « Tout désélectionner » sans confirmation : seule la sélection est vidée (`clearSelection`), vérifié dans le code, par un test et dans le navigateur ;
  - filtrage sorti dans `src/lib/questFilter.ts`.

**Tâche 3 : ordre des sections** (`3cad781`)
- Ordre : **Objectifs, À emporter, Guide** (ouvertes, texte du wiki mis en avant avec sa source), puis Récompenses, Prérequis, Équipement initial, Résumé (repliées).
- Défini dans `src/lib/questSections.ts`, avec un test.
- « Prérequis ⚠ désaccord » dans le titre quand les sources divergent ; la mention « page historique » remonte en haut de l'onglet.

**Tâche 4 : sorties, coops, transits** (`70bf964`)
- *Trouvé dans les données* (fichier `maps` de tarkov.dev) :
  - `extracts` : nom (FR pour 162 sur 162), `faction` (`pmc` 73, `scav` 56, `shared` 18, **absente pour 15** : Night Factory et Ground Zero 21+), position, `top`/`bottom`, `switch`/`switches` (sens non documenté, non affiché) ;
  - `transits` : texte FR, map de destination, position, hauteurs.
  - **Coop : aucun champ dédié.** Repérée par « (Co-op) » dans le nom anglais : 10 sorties sur 9 maps. Fiable sur les données d'octobre 2026, mais la détection casserait si un nom changeait.
  - L'API liste souvent la même sortie deux fois (PMC et Scav au même endroit) : fusionnées en « PMC et Scav ».
- *Fait* :
  - pastilles : vert = sortie, orange = transit, deux bonhommes + « coop » sur fond orange ;
  - nom écrit à côté (échappé), masqué au zoom d'ouverture et visible dès le premier cran ;
  - infobulle et popup : nom, type, faction, destination, étage ;
  - étages : sorties souterraines seulement sur leur étage, sorties d'un étage supérieur avec le numéro d'étage ;
  - bouton « Sorties » (affichées par défaut, choix retenu).
- *Vérifié* :
  - Douanes : 23 pastilles au niveau principal ; au sous-sol, la coop de la chaufferie, ZB-1011 et ZB-1012 ;
  - Labs : monte-charge au 2e niveau (badge 2) ; ascenseurs et égout au niveau technique.

**Tâche 5 : import par capture (OCR)** (`09d0146`)
- *Options comparées* : **Tesseract.js 7.0.0** (Apache-2.0, retenue) ; PaddleOCR via onnxruntime-web (MIT, beaucoup plus lourd) ; TextDetector du navigateur (expérimental, absent).
- *Chargement* :
  - moteur WebAssembly `tesseract-core-simd-lstm.wasm.js` (**3,9 Mo**) et worker (111 Ko) **intégrés au build**, chargés seulement à la première capture ;
  - données de langue **depuis le CDN jsdelivr** à la première utilisation (`eng` 2,95 Mo et `fra` 0,71 Mo compressés), **connexion nécessaire la première fois** ;
  - ensuite gardées dans **IndexedDB** (`keyval-store` : `eng.traineddata` 5,2 Mo et `fra.traineddata` 1,25 Mo, vérifié).
- *Mesure* : **uniquement sur une image de synthèse** dessinée dans le navigateur (police Arial, fond uni, noms choisis). C'est un **cas favorable**. La précision réelle sur les captures du jeu est **inconnue**.

| Réglage (image de synthèse, 8 noms dont 1 inexistant) | Résultat |
|---|---|
| sans prétraitement, découpage auto, sans séparer les colonnes | 1 nom trouvé (lignes fusionnées avec les colonnes marchand/lieu) |
| sans prétraitement, découpage auto, colonnes séparées | 7 noms trouvés |
| agrandi (+ découpage auto ou texte épars) | **7 / 7 quêtes existantes, aucune fausse** |
| « complet » (contraste + inversion) | 1 nom trouvé (l'étirement se cale sur le fond sombre) |
| agrandi + inversion simple | 7 / 7, pas de gain |

- *Réglages retenus* : agrandir seulement, découpage « texte épars » (PSM 11), séparation des colonnes aux grands espaces (1,6 × hauteur du texte). Environ 1,7 s par lecture une fois le moteur chargé.
- *Rapprochement* (`src/lib/ocrMatch.ts`) :
  - FR et EN, mode actuel seulement ;
  - le nom doit couvrir presque toute la ligne ou deux lignes ; 0,88 ou plus = reconnue, de 0,72 à 0,88 = incertaine ;
  - numéros isolés identiques (un « 1 » collé à des lettres est une erreur d'OCR, pas un numéro) ;
  - [PVP ZONE] / [JcJ] présent des deux côtés ou absent des deux côtés.
- *Parcours vérifié* : Ctrl+V dans la recherche n'est pas intercepté ; Ctrl+V ailleurs ouvre l'onglet ; 5 / 5 reconnues (dont « Il-Wisher » lu pour « Ill-Wisher ») ; « Remplacer » ; la map passe sur Littoral avec le message.

**Tâche 6 : étude 3D** (aucun code, en attente de validation)
- Voir « Étude 3D » ci-dessous.

### Session 6

**Bilingue** (`8ad2e50`)
- Pas de dictionnaire à clés : des paires en ligne `tr(fr, en)`. Les constantes de module sont résolues à l'affichage (getters ou tuples `[fr, en]`).

**Photos des sorties** (`188e0b8`)
- Les pages de map du wiki ont des wikitables `==Extractions==` et `==Transits==`, une ligne par sortie, colonne 1 = `[[File:..|240px]]`. Association par `nameEn` normalisé : **145 / 163 (89 %)** sur 12 maps.

| Map | Photos trouvées |
|---|---|
| Reserve | 14/14 |
| Woods | 22/22 |
| Icebreaker | 1/1 |
| The Lab | 8/8 |
| Labyrinth | 2/2 |
| Lighthouse | 15/15 |
| Factory | 11/12 |
| Interchange | 8/9 |
| Streets | 20/22 |
| Customs | 20/26 |
| Shoreline | 17/22 |
| Ground Zero | 7/10 |

- Les manques sont des sorties absentes des tableaux du wiki : repli sur un lien.
- 2 requêtes wiki par map à la première ouverture d'une bulle, puis cache 7 jours. Bulle de taille fixe (plus de saut d'autoPan).
- Environ 36 requêtes wiki dépensées une fois pour la mesure.

**Images de la fiche quête** (`959bb7c`)
- Source : `json.tarkov.dev/<mode>/items` (**17,3 Mo**, 5476 objets), champ `iconLink` (webp 64 px). Gardé seulement pour les `referencedItemIds` (4037).
- Préfixe `https://assets.tarkov.dev/` retiré dans le cache ; entrée de 1,57 M à 1,83 M caractères ; anciennes versions de cache purgées.
- « Found in raid » oui/non seulement quand une source le dit. Prérequis cliquables, avec niveau et marchand.

**Icônes des sorties** (`df9e5f3`)
- PMC : « P » bleu. Scav : « S » violet. Communes : moitié/moitié « P+S ». Sans faction : vert générique. Coop et transit inchangés.

**Main story (tâche 6)** : recherche seulement, **en attente de validation**
- Wiki : page « Story chapters » et une page par chapitre (10) : Tour, Falling Skies, The Ticket, Batya, The Unheard, Blue Fire, Boreas, The Labyrinth (chapitre d'histoire), They Are Already Here, Accidental Witness.
- Les champs `previous` / `leads to` de l'infobox sont presque vides (seulement Falling Skies → The Ticket) : **l'ordre de jeu n'est pas donné par le wiki**.
- Les étapes du Guide sont des titres `===` avec `<gallery>`. Les fins Savior / Debtor / Survivor / Fallen sont dans The Ticket.
- Wiki FR (`escapefromtarkov.fandom.com/fr`) : « Chapitres de l'histoire » et au moins 3 chapitres traduits.
- Endpoint histoire de tarkov.dev : introuvable (json 404, GraphQL indisponible à ce moment).
- Environ 22 requêtes wiki dépensées pour la recherche.

### Session 7 : Main story (chapitres du wiki)
- **Où** : onglet Quêtes (chapitres mélangés aux quêtes, triés avec elles, « Main story » à la place du marchand, filtre marchand « Main story », recherche FR/EN), fiche d'un chapitre dans l'onglet Fiche quête (liste déroulante, identifiant `story:<titre anglais>`), carte courte dans l'onglet Sélection. Code : `src/lib/story.ts` (lecture, clés, choix de la langue), `src/api/story.ts` (chargement, cache compact), `src/components/StoryView.tsx`.
- **État** : `ModeState.story?: { selected: string[]; done: Record<string, true> }`, séparé de `selected` (rien sur la carte). Case = `<titre anglais du chapitre>::<titre anglais normalisé de l'étape>#<n° d'occurrence>`. « Tout réinitialiser » vide aussi `story.done` ; « Tout désélectionner » vide aussi les chapitres choisis (étapes cochées gardées).
- **Écart au plan** : l'association FR/EN ne passe **pas** par `langlinks` (1 chapitre sur 10 seulement en a un) mais par la liste « Chapitres de l'histoire » du wiki FR, rapprochée de la liste EN par le **nom du fichier d'icône**. `links` dit quelles pages FR existent.
- **The Ticket** : le Guide appelle quatre modèles (une fin chacun) que `prop=wikitext` ne développe pas : 1 requête de plus pour les lire ; début commun une seule fois, puis étapes de chaque fin étiquetées. La progression n'atteint donc jamais le total (fins alternatives).
- **Langue** : texte français seulement si la page FR a le même nombre d'étapes et aucune étape dont les nombres distinctifs (quantités, sommes) viennent d'une autre position (Tour / Excursion a deux étapes inversées). Sinon anglais, avec une mention.
- Le wiki FR écrit les noms d'objets en {{identifiant tarkov.dev}} (192 dans les 8 pages) : gardés comme repères puis remplacés par le nom de `itemNames` (tarkov.dev), « […] » si l'objet est inconnu ; ils ne comptent pas dans la comparaison des nombres.
- Limites : le cache des chapitres (≈ 0,6 M caractères pour les 10 chapitres, FR compris) s'ajoute aux données de quêtes ; avec plusieurs modes en cache, une écriture peut échouer en silence et le chapitre est relu à chaque ouverture (The Ticket : environ 7 requêtes).

### Rooms (jouer en groupe)
- **Principe** : bouton « Room » à côté du sélecteur de map. « Créer une room » donne un ID de 6 caractères (sans 0 O 1 I L) à envoyer ; les autres le saisissent et « Rejoignent ». Sont partagés : **quêtes choisies, objectifs cochés, chapitres Main story choisis et étapes cochées**. Couleurs, notes, points perso et positions manuelles restent locaux.
- **Protocole** (`server/rooms.mjs`, JavaScript simple car le Node de production n'importe pas `src/*.ts`) : `POST /api/rooms {mode,state}` crée ; `GET /api/rooms/:id/events?client=…` flux **SSE** (snapshot, puis `op`, `members`, battement toutes les 25 s) ; `POST /api/rooms/:id/ops {client,ops:[{kind:task|done|story|step,id,on}]}` ; `PUT /api/rooms/:id` recrée une room de même ID ; `GET /api/rooms/:id` (existe ?). Opérations **absolues** (« on » = présent), dernier écrit gagne.
- **Client** (`src/api/room.ts`, `src/lib/roomSync.ts`, `src/components/RoomControl.tsx`) : synchronisation **par différence d'état** (pas par action) : après chaque changement local (délai 150 ms), l'état partageable est comparé au dernier état connu du serveur et les écarts sont envoyés. Les opérations reçues sont aussi appliquées à cet état connu, donc elles ne repartent pas. Le reducer a 3 actions : `roomSnapshot`, `roomOps`, `restoreMode`.
- **Jointure = fusion** : à la première connexion, union de l'état local et de la room (le surplus local est envoyé). L'état du mode est sauvegardé avant dans `localStorage` `tqp:beforeRoom:<mode>` ; « Quitter » propose de garder l'état de la room ou de restaurer l'ancien. Un joiner d'un autre mode est basculé sur celui de la room (bandeau d'information). « Quitter -> Restaurer » ne rend que la sélection et les cases cochées d'avant (notes, points perso et positions faits depuis restent). Après une reconnexion, le snapshot **remplace** l'état local (les changements faits hors ligne non envoyés sont perdus).
- **Réinitialisations** : « Réinitialiser » et « Tout désélectionner » valent pour tout le monde ; les confirmations le disent (`ConfirmButton`, `inRoom()`). « Tout désélectionner » n'a pas de confirmation, comme avant.
- **Reprise** : la room (ID, créateur, mode) est gardée dans `sessionStorage` `tqp:room` : un rechargement rejoint à nouveau. Si le serveur répond « room inconnue » (redémarrage, redéploiement), le **créateur** la recrée avec `PUT` (même ID, son état) ; les autres réessaient (6 réponses « inconnue » comptées, pas les coupures réseau) puis affichent « Room fermée » ; une page d'erreur HTML après une connexion réussie (proxy, redéploiement) est traitée comme passagère.
- **Hébergement statique** : une réponse n'est acceptée que si c'est du JSON (ou un flux d'événements) ; sinon « Rooms indisponibles sur cet hébergement », sans plantage. Le site marche toujours en statique, sans rooms.
- **Production : `npm start` est nécessaire** (Node >= 22.12, variable `PORT`, 3000 par défaut). `server/index.mjs` **remplace le serveur statique sur le même port** : il sert `dist/` (après `npm run build`) et `/api/rooms`, aucun autre port. Fichier absent = **404 sans cache** (plus de repli sur `index.html`) : c'est la vraie correction de la panne de cache décrite plus haut. `index.html` et `/` : `no-cache` ; `/assets/*` : `immutable` 1 an ; MIME complets ; chemin hors de `dist/` refusé (403). La parade de `index.html` (0.7.2) reste utile derrière un autre hébergeur.
- **Dev** : `vite.config.ts` monte le même gestionnaire (plugin `tqp-rooms`, dev et preview). Vite écoute seulement sur `localhost` (`::1`) : pour tester avec deux origines (donc deux `localStorage`, `localhost` et `127.0.0.1`), lancer `npm run dev -- --host ::` le temps du test (le serveur de dev est alors visible sur le réseau local).
- **Limites et sécurité** : rooms **en mémoire** (perdues au redémarrage, recréées par le créateur) ; **aucune authentification** : qui a l'ID modifie la room ; corps 256 Ko, 500 rooms, 20 membres, 20 000 identifiants par room, 1000 opérations par envoi, room vide supprimée après 30 min. Identifiants validés (quêtes et objectifs `[A-Za-z0-9_-:.]` 100 max ; Main story 200 max sans caractère de contrôle) des deux côtés ; rien n'est inséré comme HTML. Pas de limite par adresse IP (un client peut remplir les 500 rooms ; 500 rooms x 20 000 identifiants de 200 caractères = plusieurs Go en théorie, bien moins en pratique) ni de HTTPS/CORS (même origine uniquement).
- **Vérifié dans le navigateur** (`localhost:5173` et `127.0.0.1:5173`, deux `localStorage`) : création / jointure avec bascule de mode, quête cochée A -> B, objectif coché B -> A, chapitre Main story, réinitialisation propagée, Quitter -> restauration, redémarrage du serveur de dev (Vite recharge alors les pages : nouveaux clients) **et** de `npm start` coupé 45 s **sans recharger** les pages (les deux navigateurs reviennent, avec la sélection faite pendant la coupure), rechargement, 375 px sans débordement, hébergement statique (`python -m http.server`) -> message d'indisponibilité ; `npm run build` puis `PORT=4123 npm start` : site, room, 404 sans cache. **Non vérifié** : étapes cochées de la Main story entre navigateurs (couvert par les tests), vrai déploiement derrière Cloudflare (SSE et tampon à vérifier ; l'en-tête `X-Accel-Buffering: no` est envoyé), plus de 2 navigateurs.
- **Tests** (+24 : 207 au total) : `src/lib/roomSync.test.ts` (différences, validation, fusion/remplacement, opérations distantes) et `server/rooms.test.ts` (serveur réel sur un port libre : deux clients SSE, validation, 413, plafond de rooms, PUT, MIME, 404 sans cache, traversée de chemin).

---

## Étude 3D (session 5, en attente de validation)

**L'image de référence n'a pas été reçue.** La comparaison est faite sans elle.

**1. Sources 3D qui existent réellement (vérifiées)**
- **tarkov.dev**, entrées « 3D » de `maps.json` (13 cartes, auteur **re3mr**, reemr.se) :
  - ce sont des **images fixes** (`tarkov.dev/maps/customs-3d.jpg`, servie en `image/jpeg`) ;
  - elles n'ont **ni calibrage ni emprise** (seulement `key`, `projection`, `author`) ;
  - tarkov.dev lui-même ne met des marqueurs que sur les cartes `interactive`.
  - Donc : **aucun point de quête ni sortie ne peut y être placé**, et il n'y a pas de vraie bascule 2D/3D.
  - Licence : **CC BY-NC-SA 4.0** d'après reemr.se. L'auteur dit utiliser les lieux et bâtiments du jeu « comme référence ». **On ne peut pas vérifier** s'il a extrait des fichiers du jeu : c'est à l'utilisateur de décider.
- **Annuaires** (awesometarkov, gamemaps.net, MapGenie) : rendus 3D fixes ou sites fermés ; rien d'intégrable sous une licence claire.
- **Projets open source** : « Zibbp/Escape-From-Tarkov-Interactive-Online-Map », archivé en 2022 et en 2D ; « Tarkov Nexus » est un suivi de position, pas une carte 3D.
- **Aucune donnée 3D publique** (relief, volumes des bâtiments) trouvée qui ne vienne pas des fichiers du jeu.

**2. Option « 3D construite avec nos données »**
- *Principe* : chaque étage (groupe SVG, ou tuiles pour Labs et Icebreaker) devient un plan posé à sa hauteur réelle (tranches `extents` de `maps.json`). Caméra inclinée en perspective, que l'on peut faire tourner. Marqueurs de quêtes et sorties placés à leur hauteur (`y`, `top`/`bottom`).
- *Douanes* : 5 plans (sous-sol, sol, 2e, 3e, 4e étage). Les étages ne dessinent que l'intérieur des bâtiments, donc on verrait des « plaques » flottant au-dessus des bâtiments du sol. Lisible, avec un écart vertical réglable (vue « éclatée »).
- *Labs* : 3 plans en tuiles (technique, 1er, 2e niveau), bien lisibles.
- *Icebreaker* : 16 ponts tous les 3 m environ. Empilés tels quels, ils sont **illisibles**. Il faudrait la vue éclatée, ou n'afficher que le pont choisi et ses voisins en transparence.
- *Ce que l'option ne peut pas faire* :
  - pas de relief du terrain ;
  - pas de murs ni de volumes de bâtiments : il faudrait inventer des hauteurs, ce qui contredit la règle « rien d'inventé » ;
  - pas de textures du jeu ;
  - Woods, Lighthouse et Terminal n'ont pas d'étages : la 3D n'y serait qu'un plan incliné.
- *Technique* : three.js (MIT, 0.186.1). Ses deux fichiers font 90 + 105 Ko compressés, et ils seraient **chargés à la demande** comme l'OCR : le fichier principal ne grossit pas.
- *Performances* : quelques grands plans texturés et une centaine de marqueurs, c'est léger pour la carte graphique. Sur téléphone, la limite est la taille des textures (souvent 4096 px) : les SVG rendus en image perdent du détail en zoom rapproché.

**3. Écarté** : tout ce qui demande d'extraire ou de réutiliser des fichiers du jeu (modèles, textures).

**4. Recommandation**
- L'option « nos données » avec three.js, chargée à la demande.
- Commencer par les maps à SVG (Douanes, Littoral, Usine, Rues, Réserve, Échangeur, Ground Zero), avec un écart vertical réglable.
- Puis Labs et Icebreaker en tuiles.
- Interrupteur 2D / 3D à côté du sélecteur de map.
- Ne pas utiliser les images re3mr : impossible d'y placer les points, et leur origine n'est pas vérifiable.
- *Effort* : environ une session pour une première version sur les maps à SVG ; une demi-session de plus pour Labs, Icebreaker et le téléphone.

**Questions en attente** : valider (ou non) cette recommandation, et renvoyer l'image de référence 3D.

---

## Ce que le wiki fournit réellement (vérifié en session 4, toujours valable)
- API `https://escapefromtarkov.fandom.com/api.php` : `parse`, `query` (revisions, categories, imageinfo), `categorymembers` (898 quêtes), recherche plein texte, `opensearch`. Recherche par titre désactivée. Pas de Cargo, ni SMW, ni Bucket ; `prop=infobox` est vide pour les quêtes.
- Pas de données structurées : on lit le wikitext (`{{Infobox quest}}`, sections Dialogue, Requirements, Objectives, Rewards, Initial Equipment, Failure Dialogue, Guide, tableau « Related Quest Items » avec Find in raid).
- Texte sous CC BY-NC-SA ; images sans licence indiquée.
- Désaccords connus avec tarkov.dev : Signal - Part 3, Chumming, Collector, Serious Allegations.

---

## Décisions prises (à ne pas remettre en cause sans raison)

- **Icebreaker** garde tous ses ponts dans le sélecteur.
- **Photos du wiki** (pas de captures perso), par quête et non par point ; usage personnel et non commercial.
- **PVP ZONE** : le wiki de la quête normale est affiché, avec un bandeau.
- **Aucune traduction maison**, et **rien d'inventé**.
- **tarkov.dev est la référence** ; les contradictions avec le wiki sont signalées sans être tranchées.
- **Find in raid** : seulement quand une source le dit.
- **Sécurité** : aucun HTML du wiki inséré ; les noms affichés dans les marqueurs sont échappés.
- **Réinitialisation** : seulement `done` du mode actuel, avec confirmation.
- **Un seul accès au wiki** (`src/api/wiki.ts`, 1 requête/s, cache 7 jours).
- **Main story (session 7, après validation)** : chapitres **mélangés aux quêtes** (pas de section à part) dans « Quêtes sélectionnées » / « Autres quêtes » et dans l'onglet Sélection, triés par nom affiché ; « Main story » à la place du marchand ; « Tout désélectionner » les inclut ; `story` reste séparé de `selected` (rien sur la carte). Liste = tableau « Story chapters » + pages de `Category:Story_chapters` absentes du tableau (1 requête de plus, constaté : 10 aussi, rien à ajouter ; le wiki FR n'a pas de chapitre en plus).
- **Case « Extracts Scav » (session 7)** : dans la barre du haut, cochée par défaut ; décochée, elle masque seulement les sorties Scav (les sorties PMC + Scav, coops et transits restent). Sur téléphone, le libellé devient « Scav ».
- **Case « Extracts Scav » (session 7)** : dans la barre du haut, cochée par défaut ; décochée, elle masque seulement les sorties Scav (les sorties PMC + Scav, coops et transits restent). Sur téléphone, le libellé devient « Scav ».
- **Étages et sorties souterraines (hors version)** :
  - *Sorties* : une sortie souterraine s'affiche aussi sur le niveau principal (badge « ↓ ») si c'est une simple entrée de cave : map de plein air (fond SVG) et aucune zone d'étage supérieur de maps.json au-dessus d'elle en x/z (zones réduites de 5 m : ZB-1011 est à 3,5 m du bord de « pump 2nd »). Résultat : Douanes ZB-1011 (PMC et Scav) et bunker Voron, Littoral « Adm Basement », Réserve (3 sorties de bunker). Restent au sous-sol seulement : coop de la chaufferie (sous un bâtiment à étages), Labs, Icebreaker. `isCellarEntrance` dans `levels.ts`.
  - *Étage des points, cause* : les zones x/z des étages étaient **déjà** prises en compte. Sur Interchange, maps.json appelle « 2nd Floor » (25-34 m, limité au mall) le **rez-de-chaussée du mall**, surélevé d'environ 28 m, et « 3rd Floor » son vrai 2e étage. Noms corrigés dans `levelName` (« Niveau principal du centre commercial » sans numéro sur le badge, « 2e étage du centre commercial »). Points concernés : 18 (ex-« 2e étage ») et 10 (ex-« 3e étage ») ; les 19 autres d'Interchange sont dehors. Aucun autre changement de calcul sur les autres maps.
  - *Étage écrit dans la description* (`src/lib/floorText.ts`) : étage numéroté, rez-de-chaussée, sous-sol/basement, toit. Il passe avant le calcul dans la bulle (« d'après la description »), sans déplacer le point de couche. « underground » / « souterrain » seuls ne comptent pas (noms de lieux : bunker souterrain). 13 objectifs de la liste FR/EN en ont un. Le wiki n'est pas utilisé : ses objectifs ne sont pas rapprochés objectif par objectif. Attention : certaines traductions FR numérotent à l'européenne (Usine « 1er étage » = EN 2nd floor) ; le texte est repris tel qu'écrit.
- **Session 6** :
  - `tr(fr, en)` en ligne, sans dictionnaire ;
  - français par défaut ;
  - préfixe d'URL des icônes retiré dans le cache ;
  - photos des bulles de sorties chargées à la demande, map par map.
- **Session 5** :
  - libellés d'onglets courts : Sélection, Quêtes, Capture, Fiche quête, Photos, Mes points, Réglages (**proposition à confirmer** ; « Quête sélectionnée » reste le nom complet) ;
  - **coop repérée par « (Co-op) » dans le nom anglais** (pas de champ dans l'API) ;
  - doublons PMC/Scav fusionnés ;
  - **OCR dans le navigateur uniquement**, chargée à la demande ; worker et moteur servis par l'app ; données de langue depuis jsdelivr puis IndexedDB ;
  - réglages OCR par défaut : agrandi, texte épars, colonnes séparées ;
  - **jamais d'activation silencieuse** après un import : écran de vérification obligatoire ;
  - « Tout désélectionner » sans confirmation (action non destructive).
- **Quêtes d'événement absentes de tarkov.dev** : ajoutées depuis le wiki (objectifs du wiki, pas de points sur la carte), retirées automatiquement quand tarkov.dev les ajoute (comparaison du nom anglais et de la page wiki).
  - Source : `Category:Event_content` ∩ `Category:Quests` − `Category:Historical_content` (`src/api/eventQuests.ts`) ; 2 requêtes de liste (continuation) + 1 requête de wikitext, cache 7 jours. Tâches synthétiques `wiki-<slug>` (`source: "wiki"`), objectifs `wiki-<slug>-<n>` (puces de « Objectives », sous-puces rattachées à l'objectif), marchand et map lus dans l'infobox, niveau non renseigné. Étiquette « Événement · wiki » dans la liste et la fiche.
  - Audit : tarkov.dev gardé en entier (504/500/463 quêtes conservées, 0 retirée) ; 16 quêtes d'événement uniquement sur le wiki ; 295 pages historiques et ~92 autres pages uniquement sur le wiki (Arena, retirées, Prestige) : non ajoutées.

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| API tarkov.dev (quêtes, maps, **sorties**, marchands, noms d'objets) | `src/api/tarkovJson.ts`, cache `src/api/cache.ts` (données v9) |
| Wiki (requêtes, file d'attente, cache) | `src/api/wiki.ts` |
| Wikitext, croisement wiki ↔ tarkov.dev | `src/lib/wikiText.ts`, `src/lib/questWiki.ts` |
| Fiche quête et ordre des sections | `src/components/QuestTab.tsx`, `src/lib/questSections.ts`, `src/components/WikiBlocks.tsx` |
| Liste des quêtes, épinglage, filtres | `src/components/QuestList.tsx`, `src/lib/questFilter.ts` |
| Panneau réglable | `src/lib/panelWidth.ts`, `src/components/PanelResizer.tsx`, onglets `TABS` dans `src/App.tsx` |
| Sorties, coops, transits | `src/lib/exits.ts`, `src/map/ExitsLayer.tsx`, `src/map/exitIcons.ts` |
| Import par capture | `src/components/CaptureTab.tsx`, OCR `src/lib/ocr.ts`, rapprochement `src/lib/ocrMatch.ts`, Ctrl+V global dans `src/App.tsx` |
| Étages | `src/map/levels.ts` |
| Carte, fond, popups | `src/map/MapView.tsx`, `src/map/BaseLayer.tsx`, `src/components/PointPopups.tsx` |
| Rooms (serveur, client, bouton) | `server/rooms.mjs`, `server/index.mjs`, `src/api/room.ts`, `src/lib/roomSync.ts`, `src/components/RoomControl.tsx` |
| État sauvegardé (dont `selectTasks`, `clearSelection`, resets) | `src/state/store.ts` |
| Conversion de coordonnées | `src/map/crs.ts` (ne pas modifier sans les tests) |

**Conventions**
- Interface, commentaires et documentation en **français**.
- Fins de ligne **CRLF** (`core.autocrlf=true`), mais les fichiers neufs écrits par Claude sont souvent en LF dans la copie de travail ; Git normalise. **Un script de modification doit détecter les fins de ligne du fichier.** `file` peut se tromper (fichiers avec emojis) : compter les `\r` pour vérifier.
- Regex dans un script Node via heredoc : outil Edit ou `String.raw`.
- **Serveur Vite** : l'observateur de fichiers rate parfois des modifications sur M:. Vérifier avec `curl http://localhost:5173/src/…`, puis **redémarrer le serveur**.
- **Navigateur intégré masqué** : les animations Leaflet (zoom) n'avancent pas sans rendu. Une capture d'écran force le rendu.
- **Tests dans le navigateur qui modifient l'état** : sauvegarder `tqp:state:v1` (sessionStorage) avant, puis restaurer et recharger après.
- Dans l'app, `lat = z`, `lng = x`, `y` = hauteur.
- Nouveaux champs de données **facultatifs**.
- Un commit par tâche, en français, avec tests et build verts avant.
- **Version** : `version` de `package.json`, affichée en bas à droite de l'écran d'accueil (choix PvP / PvE / PvP Saison). **À augmenter à chaque livraison**, avant le dernier commit : `0.<session>.<n° de livraison dans la session>` (0.7.0 = fin de session 7).
- **Production (tarkov.aprilox.fr, derrière Cloudflare)** : déployée automatiquement à chaque push sur `main` (~1 min). L'hébergeur publie `index.html` avant les fichiers de `assets/` ; pendant cet écart, un fichier absent reçoit la page HTML, **mise en cache ~2 h 30** à cette adresse (« Failed to load module script … text/html »). Parade dans l'app (0.7.2) : un petit script dans `index.html` redemande le fichier avec `?r=<date>`. Vraie correction côté hébergeur : 404 (sans cache) pour un fichier absent de `assets/`, ou fichiers envoyés avant `index.html`. Les morceaux chargés plus tard (OCR) ne sont pas couverts par la parade.
- **Sorties (0.7.3)** : un clic sur une sortie ouvre l'onglet **Photos** avec ses photos du wiki (la bulle ne garde que nom, type, faction, destination, étage). Sorties à plus de 50 % de la taille de la map hors de son emprise **masquées** (`exitsNearMap`) : données tarkov.dev fausses pour Point zéro « Barrage ONU » (UN Roadblock, x = -528) et « Bunker Scav » (z = -706) ; toutes les autres sorties sont à moins de 4 % du bord. ZB-1011 (Douanes) est au **sous-sol** : visible seulement avec l'étage « Sous-sol » (règle de la session 5, inchangée).

**Commandes** : `npm run dev` · `npm start` (production : `dist/` + rooms, voir « Rooms ») · `npm test` · `npm run build` · `npm run sync:maps`. Node est dans `C:\Program Files\nodejs`. npm 12 bloque le script d'après-installation de tesseract.js (simple annonce de financement, inutile).

---

## Limites connues

- **OCR non mesurée sur de vraies captures du jeu** (seulement sur une image de synthèse favorable). La police et les textures du jeu peuvent dégrader la lecture. Il n'y a pas de recadrage manuel de la colonne des quêtes.
- **OCR, première utilisation** : connexion nécessaire (données de langue depuis jsdelivr).
- **Taille** : le fichier principal fait 516 Ko (avertissement Vite) ; le moteur OCR de 3,9 Mo est déployé avec le site mais chargé seulement à la demande.
- **[PVP ZONE] / [JcJ]** : si l'OCR ne lit pas le marqueur, la quête normale peut être proposée à la place de la version PVP ZONE.
- **Coop** : détection par le nom anglais. Le champ `switch` des sorties n'est pas affiché (sens inconnu). 15 sorties sans faction (« non précisée »).
- **Libellés d'onglets** : à 400 px, « Fiche quête » et « Mes points » passent sur 2 lignes. Le zoom à 125 % n'a été que simulé.
- Plans des étages supérieurs non affichables ; photos par quête ; texte du wiki en anglais et parfois incomplet ; récompenses comparées seulement sur l'expérience, l'argent et la réputation.
- Erreur Leaflet `_leaflet_pos` possible si on change de map pendant un zoom.
- **Session 6** :
  - le premier chargement télécharge le fichier d'objets de 17 Mo par langue, et de nouveau quand le cache de 6 h expire ;
  - localStorage proche du plein quand plusieurs modes / langues sont en cache (le dernier commit libère la place) ;
  - 18 sorties sans photo du wiki ;
  - images « lazy » non observées en chargement dans le navigateur masqué (URLs vérifiées avec `new Image()`) ;
  - pastilles de sorties vérifiées par le DOM seulement (pas de capture d'écran) ;
  - erreurs Leaflet vues seulement avec des événements synthétiques.
- **localStorage proche du quota** (~4,3 M sur ~5 M de caractères avec un seul mode en FR+EN et tous les chapitres) : l'éviction des pages du wiki les moins utilisées protège le wiki, mais mettre plusieurs modes en cache peut encore évincer des données ou des chapitres.
- **The Ticket** affiche 4 fins empilées (129 étapes) : son X/N n'atteint jamais N.

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- « Valide le plan de la main story (tâche 6) » : voir la recherche de la session 6.
- « Voici mes captures du menu Tâches : mesure l'OCR dessus et ajuste les réglages. »
- « Voici l'image de référence 3D ; je valide (ou non) la recommandation de l'étude 3D. »
- Confirmer ou corriger la liste des libellés d'onglets.

**Main story / cache**
- « Main story : choisir sa fin dans The Ticket pour n'afficher que ses étapes. »
- « Déplacer le cache du wiki vers IndexedDB (plus de place). »

**Mise en ligne**
- « Publie l'app sur GitHub Pages depuis ez4ence256/testss, avec un workflow GitHub Actions. »

**Quêtes**
- « Dans la fiche quête, ajoute un bouton "Ajouter à la sélection" quand la quête affichée n'est pas sélectionnée. »
- « Ajoute un filtre Kappa et un filtre par niveau du joueur. »
- « Liste "à emporter" regroupée pour toutes les quêtes sélectionnées d'une map. »

**Capture / OCR**
- « Ajoute un recadrage manuel de la liste avant la lecture OCR. »
- « Héberge les données de langue fra/eng dans l'app (sans CDN). »

**Qualité**
- « Dérive les icônes de l'id (`assets.tarkov.dev/<id>-icon.webp`) pour éviter le fichier d'objets de 17 Mo. »
- « Découpe le fichier principal (> 500 Ko) avec des imports dynamiques. »
- « Configure Vite en usePolling si l'observateur rate encore des modifications sur M:. »
- « Audit du projet sans rien modifier, corrections par priorité. »
