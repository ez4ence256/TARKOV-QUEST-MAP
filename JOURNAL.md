# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (10 octobre 2026, session 4 en cours)

| Élément | État |
|---|---|
| Branche | `claude/tarkov-quest-planner-axir48` (dépôt `ez4ence256/testss`) |
| Derniers commits | `e25a742` onglet Quête · `78d3e96` réinitialisation de la progression · `8b74a2f` spawns + photos du wiki · `3591047` recherche bilingue |
| Travail non commité | Seulement `.claude/launch.json` (volontairement hors du dépôt : chemin propre à cette machine) |
| Tests | 58/58 au vert (`npm test`) |
| Compilation | OK (`npm run build`) |
| **Pas encore poussé** | Le `git push` a échoué en session 4 : Git demande des identifiants GitHub et la fenêtre de connexion ne s'ouvre pas depuis la session de Claude. À faire à la main (GitHub Desktop, ou `git push` dans un terminal). |
| **En attente de validation** | Tâche C, partie wiki : description et prérequis dans l'onglet Quête (rapport ci-dessous, 3 questions ouvertes) |
| Reste à faire en fin de session | Vérification finale dans le navigateur (Littoral + Signal - Partie 3, téléphone) une fois la partie wiki codée |

---

## Historique

### Session 1 (cloud) : première version
- App React + Vite + Leaflet, 100 % dans le navigateur, sans serveur.
- Données : API JSON de tarkov.dev (quêtes, maps, marchands), en français avec repli sur l'anglais. Cache local de 6 h, avec repli sur le cache si l'API ne répond pas.
- Choix du mode à l'ouverture : PvP, PvE ou PvP Saison. Chaque mode a sa propre progression.
- Fonds SVG de tarkov-dev-svg-maps. Calibrage et conversion de coordonnées repris de tarkov.dev, avec un test de non-régression.
- Plusieurs quêtes affichées en même temps (une couleur chacune), icônes par type d'objectif, popups avec notes et bouton « Fait », progression par quête.
- Objectifs sans position listés à part, avec placement manuel. Points personnels.
- Sauvegarde dans le localStorage, export/import en JSON.

### Session 2 (desktop, Windows) : installation, étages, fonds en tuiles
- Node.js 24.20 LTS installé avec winget (il n'y avait pas de Node sur la machine).
- Étages : sélecteur, étage affiché par-dessus le niveau principal atténué, points des autres étages grisés.
- Labs, Labyrinth, Icebreaker : fond en tuiles d'image chargées depuis `assets.tarkov.dev`, avec le crédit de l'auteur.
- L'API fournit la hauteur des points (`y`, et `top`/`bottom` pour les zones).

### Session 3 (desktop) : étages supérieurs, recherche bilingue, spawns, photos
- **Étages supérieurs sur la carte de base** : numéro d'étage sur l'icône, infobulle au survol (nom de l'étage, hauteur du point, tranche de l'étage). Le sélecteur ne garde que le niveau principal et les **souterrains**.
  - Règle (`src/map/levels.ts`) : un étage est souterrain si une de ses tranches n'a pas de limite basse (−1000/−10000), ou si toutes ses tranches sont sous le bas du niveau principal. Sinon il est supérieur.
- **Recherche bilingue** : français ou anglais (« Appâtage » ou « Chumming »), sans casse, accents ni ponctuation. Tolère 1 faute à partir de 5 lettres et 2 à partir de 9.
- **Spawns d'objets de quête** numérotés (« Emplacement possible 3 sur 13 »). Le panneau signale les objets sans emplacement dans l'API.
- **Photos du wiki** (onglet « Photos ») : galeries de la section « Guide » de la page wiki, via l'API MediaWiki.
- Version du cache de données : v4.

### Session 4 (desktop) : réinitialisation, onglet Quête, exploration de l'API du wiki
- **Étape 0 : push échoué** (identifiants GitHub, voir « État actuel »).
- **Tâche A : réinitialiser la progression** (`78d3e96`).
  - Ce qui existait déjà pour annuler un « Fait » : la case de l'objectif dans l'onglet Sélection, et le bouton « ↩ Annuler « Fait » » de la popup. Ce bouton n'est atteignable que si « Afficher les objectifs faits » est activé, puisqu'un point fait disparaît.
  - Ajouté dans Réglages > « Réinitialiser la progression (mode) » : la liste des quêtes qui ont de la progression **dans le mode actuel**, un bouton « Réinitialiser » par quête (confirmation en deux temps), et « Tout réinitialiser (mode actuel) » avec une confirmation appuyée qui propose « Exporter d'abord (JSON) ».
  - Actions `resetProgress` / `resetAllProgress` (`src/state/store.ts`, réducteur exporté) : seul `done` du mode courant change. Notes, points perso, positions placées à la main et autres modes restent intacts.
  - Tests (`src/state/store.test.ts`) avec les identifiants réels de **« Signal - Partie 3 »** (« Signal - Part 3 », 3 brouilleurs sur Littoral) : annulation d'un brouilleur, reset d'une quête, reset global, isolation entre modes.
  - Vérifié dans le navigateur : brouilleur 2 coché par erreur, réinitialisé depuis les Réglages, puis les 3 points réapparaissent ; « Tout réinitialiser » avec Annuler puis Oui.
- **Tâche B : onglet « 📜 Quête »** à côté de « 📷 Photos » (`e25a742`).
  - Contenu : nom, progression (2/3), tous les objectifs tarkov.dev avec une case à cocher chacun (la carte se met à jour aussitôt), et « Réinitialiser cette quête » (confirmation).
  - Accès : bouton « 📜 Quête » dans la popup de chaque point de la quête, et lien « 📜 quête » de la quête dans l'onglet Sélection. **Testé avec tous les points faits (3/3, aucun point sur la carte)** : l'onglet reste atteignable depuis Sélection.
  - Les onglets Quête et Photos partagent la quête affichée (`tabTaskId` dans `App.tsx`). Sur téléphone, ils n'affichent que leur logo, et les 6 onglets tiennent sur 375 px.
  - **Pas encore fait** : la partie wiki (description, prérequis), qui attend la validation du rapport de la tâche C.
- **Tâche C : exploration de l'API du wiki** (10 requêtes, au moins 1,2 s d'écart). Le rapport est ci-dessous, il n'y a pas encore de code.

---

## Ce que l'API du wiki expose réellement (exploré en session 4)

- **Endpoint** : `https://escapefromtarkov.fandom.com/api.php` (MediaWiki 1.43.9). Il répond, et fonctionne depuis l'app avec `origin=*`.
- **Ce qui marche** :
  - `action=parse` : wikitext, sections, modèles, liens, images, `redirects=1`.
  - `action=query` : `prop=revisions` (wikitext de plusieurs pages en une requête, `rvslots=main`), `categories`, `categoryinfo`, `imageinfo`, `pageprops` (qui ne contient que `fandomdescription`).
  - `list=categorymembers` : `Category:Quests` compte 898 pages, plus 1 sous-catégorie.
  - `list=search` en plein texte, et `action=opensearch`, qui renvoie aussi les URL.
- **Ce qui ne marche pas ou n'existe pas** :
  - la recherche par titre (`srwhat=title`) : « title search is disabled » ;
  - **Cargo** (`cargoquery`), **Semantic MediaWiki** (`ask`) et **Bucket** ne sont pas installés ;
  - le module **`prop=infobox`** (PortableInfobox) existe mais **renvoie un résultat vide** pour les quêtes, car leur infobox n'utilise pas ce balisage.
- **Données structurées : non.** Le seul contenu semi-structuré, ce sont les paramètres nommés du modèle `{{Infobox quest}}` dans le wikitext : `given by`, `location`, `LL requirement`, `previous`, `leads to`, `reqkappa`. Ils ne sont pas tous remplis.
- **Structure des pages** : sections dans un ordre régulier (`Dialogue`, `Requirements`, `Objectives`, `Rewards`, `Initial Equipment`, `Guide`, `Trivia`). Mais **`Requirements` est souvent absente** (Debut, Chumming), et le texte est libre (puces, liens, `<font>`, tableaux).
- La « description » utile est la réplique du marchand, dans `==Dialogue==` via `{{quote|…}}`. L'intro se limite à « X is a Quest in Escape from Tarkov ».
- **Association quête ↔ page** : 504 quêtes sur 504 ont un `wikiLink` vers ce wiki, et pour 476 le titre correspond exactement au nom anglais. Les **28 quêtes « [PVP ZONE] »** pointent vers la page de la quête normale : l'association est incertaine.
- **Pages historiques** : certaines quêtes encore présentes chez tarkov.dev sont classées « Historical content » sur le wiki (ex. Signal - Part 3, « was a Quest »).
- **Contradictions relevées entre tarkov.dev et le wiki** :

| Quête | tarkov.dev | wiki |
|---|---|---|
| Signal - Part 3 | prérequis Rat Hunting, niveau 15, Kappa non | pas de quête précédente, niveau 15, Kappa oui, page historique |
| Chumming | Kappa non, niveau 7, Skier LL2 | Kappa oui, LL2 |
| Collector | 5 quêtes, dont Postman Pat - Part 2 | 4 quêtes, sans Postman Pat - Part 2 |
| Serious Allegations | Viewer, niveau 12 | Viewer + édition Edge of Darkness |

- **tarkov.dev fournit aussi**, sans que l'app l'utilise encore : `taskRequirements` (quêtes préalables + statut), `traderRequirements` (niveau ou réputation de marchand), `minPlayerLevel`, `finishRewards`, `neededKeys`, `lightkeeperRequired`, `failConditions`, `restartable`.
- **Licence du texte** : **CC BY-NC-SA** (champ `rightsinfo`). Non commercial, attribution (un lien vers l'article suffit d'après Fandom), partage dans les mêmes conditions. Même flou que pour les photos : les conditions de Fandom interdisent les accès automatisés sans autorisation écrite, alors que le robots.txt autorise `api.php`.

### Plan proposé pour la partie wiki (en attente de validation)
- Renommer `src/api/wikiPhotos.ts` en `src/api/wiki.ts`, avec la même file d'attente (1 requête/s) et le même cache (7 jours). **Une seule requête `parse` par quête**, partagée entre l'onglet Quête et l'onglet Photos (plus 1 requête `imageinfo` pour les photos).
- Association : `wikiLink` de tarkov.dev, puis `parse` avec `redirects=1`. La page n'est acceptée que si elle existe et appartient à `Category:Quests` ou `Category:Historical content`.
- Section « Texte du wiki, en anglais » dans l'onglet Quête, avec le lien source :
  - la réplique du marchand ;
  - les prérequis du wiki à côté de ceux de tarkov.dev (niveau, quêtes précédentes, niveau de marchand), avec un avertissement en cas de désaccord ;
  - la section Objectives et le Guide (texte nettoyé, sans tableaux) ;
  - une mention « page historique » le cas échéant.
- Les objectifs à cocher restent ceux de tarkov.dev, en français.

**Questions ouvertes posées à l'utilisateur :**
1. Ce plan est-il validé ?
2. Quêtes « [PVP ZONE] » : n'afficher rien du wiki (proposition) ?
3. Afficher aussi les Rewards du wiki, ou seulement description, prérequis, objectifs et guide ?

---

## Décisions prises (à ne pas remettre en cause sans raison)

- **Icebreaker** garde tous ses ponts dans le sélecteur : c'est un bateau, « souterrain » n'y a pas de sens, et 9 ponts supérieurs empilés sur la coque seraient illisibles.
- **Photos** : ce sont les photos du wiki Fandom, pas des captures perso. Choix fait en connaissance de cause : la licence des images n'est pas précisée par le wiki, et les conditions de Fandom restreignent les accès automatisés (voir CREDITS.md). Usage personnel et non commercial, à la demande, sans copie, avec la source citée.
- **Photos par quête, pas par point** : les légendes du wiki ne donnent pas de coordonnées. Règle générale : si une association est incertaine, on n'affiche pas.
- **Aucune traduction maison** : ni des noms de quêtes (137 noms « français » sont identiques à l'anglais chez tarkov.dev), ni du texte du wiki (affiché en anglais avec la mention « texte du wiki, en anglais »).
- **tarkov.dev reste la référence** pour les positions, les objectifs à cocher et la logique de l'app. Le wiki complète (description, guide, photos). En cas de contradiction sur les prérequis, on la signale au lieu de trancher en silence.
- **Réinitialisation** : elle ne touche que la progression (`done`) du mode actuel, jamais les notes, les points perso, les positions placées à la main ni les autres modes. Toujours avec confirmation.
- **Un seul accès au wiki** dans le code (file d'attente et cache partagés), pour respecter 1 requête par seconde au plus.

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| Appels à l'API et lecture des données | `src/api/tarkovJson.ts`, `src/api/cache.ts` |
| Accès au wiki (requêtes, file d'attente, cache) | `src/api/wikiPhotos.ts` (à renommer `wiki.ts`), onglet `src/components/PhotosTab.tsx` |
| Onglet Quête | `src/components/QuestTab.tsx` |
| Réinitialisation | `src/components/ResetProgressSection.tsx`, actions dans `src/state/store.ts` |
| Bouton à confirmation en deux temps | `src/components/ConfirmButton.tsx` |
| Calibrage des maps (y compris les étages et les tuiles) | `src/map/calibration.ts`, `src/data/tarkov-dev-maps.json` |
| Conversion coordonnées du jeu vers la carte | `src/map/crs.ts` (portage de tarkov.dev, ne pas modifier sans les tests) |
| Étages (supérieurs, souterrains, numéro, infobulle) | `src/map/levels.ts` (+ `levels.test.ts`) |
| Fond de carte (SVG, tuiles, grille, étage affiché) | `src/map/BaseLayer.tsx` |
| Carte, marqueurs, popups, sélecteur d'étage | `src/map/MapView.tsx`, `src/components/PointPopups.tsx` |
| Recherche de quêtes | `src/lib/search.ts` (+ `search.test.ts`) |
| Calcul des points, spawns, progression, quêtes avec progression | `src/lib/points.ts` |
| État sauvegardé (sélection, progression, notes, points) | `src/state/store.ts` (+ `store.test.ts`) |
| Onglets du panneau | `src/App.tsx` (type `Tab`) |
| Styles (thème sombre) | `src/styles.css` |

**Conventions**
- Interface, commentaires et documentation en **français**.
- Fins de ligne **CRLF** (`core.autocrlf=true`), mais les fichiers neufs écrits par Claude sont souvent en LF dans la copie de travail. Git normalise au commit. **Un script de modification doit détecter les fins de ligne du fichier** au lieu de supposer CRLF : en session 3, cette erreur a écrasé `levels.ts` (restauré depuis git).
- Pour une regex dans un script Node écrit via un heredoc, utiliser l'outil Edit ou `String.raw` : les `\d` et `\b` se perdent sinon.
- **Serveur de développement : l'observateur de fichiers de Vite rate parfois des modifications sur ce disque (M:).** Symptôme : `X is not defined` dans la page, ou une modification invisible, alors que `tsc` passe. Vérifier ce que le serveur sert (`curl http://localhost:5173/src/App.tsx`), puis **redémarrer le serveur** (le simple `touch` ne suffit pas toujours).
- Dans l'app, `lat = z` et `lng = x` du jeu. `y` est la hauteur.
- `maps.json` de tarkov.dev fait référence : on porte sa logique au lieu de la réinventer.
- Un commit par tâche, en français, avec tests et build verts avant.

**Commandes**
- `npm run dev` : lance l'app (http://localhost:5173)
- `npm test` : lance les tests
- `npm run build` : compilation de production dans `dist/`
- `npm run sync:maps` : met à jour les SVG et le calibrage embarqués
- Node est dans `C:\Program Files\nodejs`. Dans un ancien terminal, il peut manquer au PATH : ouvrir un nouveau terminal.

---

## Limites connues

- **Plans des étages supérieurs** : leurs points sont sur la carte de base, mais le dessin de ces étages (SVG) n'est plus affichable.
- **Photos** : rattachées à la quête, pas au point. Légendes en anglais. Licence des images non précisée par le wiki. Il faut une connexion.
- **Onglet Quête** : pas encore de description ni de prérequis (partie wiki en attente). Les prérequis de tarkov.dev (`taskRequirements`, etc.) ne sont pas encore lus par l'app.
- **Bouton « Annuler « Fait » » de la popup** : visible seulement si « Afficher les objectifs faits » est activé. Les autres moyens d'annuler sont l'onglet Quête, l'onglet Sélection et les Réglages.
- Les noms des niveaux d'Icebreaker restent en anglais.
- Les points perso et les objectifs placés à la main n'ont pas de hauteur, donc ils s'affichent à tous les étages.
- Les fonds en tuiles demandent une connexion.
- Échangeur n'a pas d'étage souterrain dans `maps.json` : les points du parking apparaissent au niveau principal.
- Erreur Leaflet `_leaflet_pos` possible dans la console si on change de map pendant une animation de zoom. Elle est sans conséquence visible.
- Le format de l'API tarkov.dev n'a pas de schéma officiel : il a été déduit du code de tarkov.dev.

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- Pousser la branche à la main (GitHub Desktop ou `git push`), puisque Claude n'a pas les identifiants.
- Répondre aux 3 questions ouvertes de la tâche C, puis : « Code la partie wiki de l'onglet Quête selon le plan validé du journal, puis fais la vérification de fin de session. »

**Mise en ligne**
- « Publie l'app sur GitHub Pages depuis le dépôt ez4ence256/testss, avec un workflow GitHub Actions qui construit et déploie à chaque push. »

**Quêtes et progression**
- « Affiche dans l'onglet Quête les prérequis de tarkov.dev (quêtes préalables cliquables, niveau, marchand) et la quête suivante. »
- « Ajoute un filtre "quêtes Kappa uniquement" et un filtre par niveau du joueur. »
- « Propose un "itinéraire" : pour la map choisie, toutes les quêtes que je peux faire en un seul raid. »

**Étages**
- « Ajoute un bouton pour afficher le plan d'un étage supérieur (SVG) au survol ou au clic d'un point de cet étage. »
- « Traduis les noms des ponts d'Icebreaker en français dans le sélecteur. »

**Photos**
- « Dans l'onglet Photos, ajoute une vue en grand (visionneuse) avec flèches précédent/suivant, sans quitter l'app. »
- « Ajoute dans Réglages un bouton "Vider le cache du wiki". »

**Carte**
- « Ajoute les sorties (extracts) sur la carte, avec un bouton pour les afficher ou les masquer. »
- « Permets de basculer entre le fond SVG et le fond satellite (tuiles) sur les maps qui ont les deux. »

**Qualité**
- « Fais un audit du projet (bugs, performances, code inutile) sans rien modifier, puis propose les corrections par ordre de priorité. »
- « Corrige l'erreur Leaflet `_leaflet_pos` qui apparaît quand on change de map pendant un zoom. »
- « Configure Vite pour surveiller les fichiers par interrogation régulière (usePolling) si l'observateur rate encore des modifications sur M:. »
