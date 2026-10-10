# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (11 octobre 2026, fin de session 5)

| Élément | État |
|---|---|
| Branche | `claude/tarkov-quest-planner-axir48` (dépôt `ez4ence256/testss`) |
| Derniers commits | `09d0146` import par capture (OCR) · `70bf964` sorties/coops/transits · `3cad781` ordre des sections · `7d2655a` sélection épinglée · `010a9b4` panneau réglable |
| Travail non commité | Seulement `.claude/launch.json` (volontairement hors du dépôt : chemin propre à cette machine) |
| Tests | 121/121 au vert (`npm test`) |
| Compilation | OK (`npm run build`). Avertissement Vite : le fichier principal fait 516 Ko (> 500 Ko). L'OCR est dans des fichiers séparés, chargés à la demande. |
| Vérifié dans le navigateur | Panneau à 400 / 440 / 520 / 540 / 560 / 720 px, fenêtre de 1024 px et zoom simulé à 125 %, téléphone · sélection épinglée avec filtre et recherche, « Tout désélectionner » · ordre des sections sur Signal - Partie 3 · sorties sur Douanes (niveau principal + sous-sol) et Labs (principal + niveau technique) · import d'une **image de synthèse** (Ctrl+V, vérification, ajout, map choisie) |
| **Pas vérifié** | **Import avec les captures de l'utilisateur** : elles ne sont pas arrivées en session 5 (ni l'image de référence 3D). |
| **Pas encore poussé** | Voir « Push » ci-dessous. Pour compter les commits locaux : `git rev-list --count origin/claude/tarkov-quest-planner-axir48..HEAD` (18 juste après le commit de ce journal ; GitHub n'a que `ecbe77a`). |
| **En attente de validation** | Étude 3D (tâche 6, rapport ci-dessous) ; liste finale des libellés d'onglets (proposition) |

### Push
- Sessions 2 à 4 : jamais poussé (identifiants GitHub absents de la session de Claude).
- Session 5 : une tentative à la toute fin, résultat noté juste en dessous.
- **Résultat de la tentative de la session 5 : (voir le commit suivant de ce journal, ou le message final de la session)**

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
| (suivant) | 5 | Journal (fin de session 5) |

### Tests (121)

| Fichier | Ce qui est couvert |
|---|---|
| `src/map/crs.test.ts` | conversion de coordonnées identique à tarkov.dev |
| `src/map/levels.test.ts` | étages supérieurs / souterrains, numéro d'étage, Icebreaker |
| `src/api/tarkovJson.test.ts` | lecture de l'API (traductions, positions, prérequis, clés, Find in raid, récompenses, noms d'objets, **sorties, coops et transits**) |
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
- **Session 5** :
  - libellés d'onglets courts : Sélection, Quêtes, Capture, Fiche quête, Photos, Mes points, Réglages (**proposition à confirmer** ; « Quête sélectionnée » reste le nom complet) ;
  - **coop repérée par « (Co-op) » dans le nom anglais** (pas de champ dans l'API) ;
  - doublons PMC/Scav fusionnés ;
  - **OCR dans le navigateur uniquement**, chargée à la demande ; worker et moteur servis par l'app ; données de langue depuis jsdelivr puis IndexedDB ;
  - réglages OCR par défaut : agrandi, texte épars, colonnes séparées ;
  - **jamais d'activation silencieuse** après un import : écran de vérification obligatoire ;
  - « Tout désélectionner » sans confirmation (action non destructive).

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| API tarkov.dev (quêtes, maps, **sorties**, marchands, noms d'objets) | `src/api/tarkovJson.ts`, cache `src/api/cache.ts` (données v6) |
| Wiki (requêtes, file d'attente, cache) | `src/api/wiki.ts` |
| Wikitext, croisement wiki ↔ tarkov.dev | `src/lib/wikiText.ts`, `src/lib/questWiki.ts` |
| Fiche quête et ordre des sections | `src/components/QuestTab.tsx`, `src/lib/questSections.ts`, `src/components/WikiBlocks.tsx` |
| Liste des quêtes, épinglage, filtres | `src/components/QuestList.tsx`, `src/lib/questFilter.ts` |
| Panneau réglable | `src/lib/panelWidth.ts`, `src/components/PanelResizer.tsx`, onglets `TABS` dans `src/App.tsx` |
| Sorties, coops, transits | `src/lib/exits.ts`, `src/map/ExitsLayer.tsx`, `src/map/exitIcons.ts` |
| Import par capture | `src/components/CaptureTab.tsx`, OCR `src/lib/ocr.ts`, rapprochement `src/lib/ocrMatch.ts`, Ctrl+V global dans `src/App.tsx` |
| Étages | `src/map/levels.ts` |
| Carte, fond, popups | `src/map/MapView.tsx`, `src/map/BaseLayer.tsx`, `src/components/PointPopups.tsx` |
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

**Commandes** : `npm run dev` · `npm test` · `npm run build` · `npm run sync:maps`. Node est dans `C:\Program Files\nodejs`. npm 12 bloque le script d'après-installation de tesseract.js (simple annonce de financement, inutile).

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

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- Pousser la branche à la main si la tentative de la session 5 a échoué (voir « Push »).
- « Voici mes captures du menu Tâches : mesure l'OCR dessus et ajuste les réglages. »
- « Voici l'image de référence 3D ; je valide (ou non) la recommandation de l'étude 3D. »
- Confirmer ou corriger la liste des libellés d'onglets.

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
- « Découpe le fichier principal (> 500 Ko) avec des imports dynamiques. »
- « Configure Vite en usePolling si l'observateur rate encore des modifications sur M:. »
- « Audit du projet sans rien modifier, corrections par priorité. »
