# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (11 octobre 2026, fin de session 4)

| Élément | État |
|---|---|
| Branche | `claude/tarkov-quest-planner-axir48` (dépôt `ez4ence256/testss`) |
| Derniers commits | `708060c` onglet Quête : infos complètes wiki + tarkov.dev · `e25a742` onglet Quête · `78d3e96` réinitialisation de la progression |
| Travail non commité | Seulement `.claude/launch.json` (volontairement hors du dépôt : chemin propre à cette machine) |
| Tests | 84/84 au vert (`npm test`) |
| Compilation | OK (`npm run build`) |
| Vérifié dans le navigateur | Littoral + Signal - Partie 3 (page historique, prérequis en désaccord, brouilleur coché par erreur puis décoché via l'onglet Quête et via les Réglages), quête PVP ZONE (bandeau), quête avec clé (Health Care Privacy - Part 2), quête avec objets Find in raid (First in Line), version téléphone |
| **Pas encore poussé** | **10 commits** en local, absents de GitHub : `origin` n'a que `ecbe77a` (session 1). Le `git push` échoue depuis la session de Claude (identifiants GitHub). **À faire à la main** : GitHub Desktop, ou `git push` dans un terminal. |

### Commits depuis la session 1 (tous locaux, à pousser)

| Commit | Session | Contenu |
|---|---|---|
| `1342d80` | 2 | Étages (sélecteur) et fonds en tuiles pour Labs, Labyrinth et Icebreaker |
| `0fb439b` | 3 | Étages supérieurs affichés sur la carte de base |
| `3591047` | 3 | Recherche bilingue tolérante aux fautes |
| `8b74a2f` | 3 | Spawns d'objets de quête numérotés et photos du wiki |
| `77c642c` | 3 | Journal |
| `78d3e96` | 4 | Réinitialisation de la progression (par quête, tout le mode actuel) |
| `e25a742` | 4 | Onglet Quête : objectifs à cocher, progression, réinitialisation |
| `c79daf5` | 4 | Journal (rapport sur l'API du wiki) |
| `708060c` | 4 | Onglet Quête : informations complètes du wiki et de tarkov.dev |
| `e362f55` | 4 | Journal (fin de session 4) |

### Tests (84)

| Fichier | Ce qui est couvert |
|---|---|
| `src/map/crs.test.ts` | conversion de coordonnées identique à tarkov.dev |
| `src/map/levels.test.ts` | étages supérieurs / souterrains, numéro d'étage, Icebreaker |
| `src/api/tarkovJson.test.ts` | lecture de l'API tarkov.dev (traductions, positions, prérequis, clés, Find in raid, récompenses, noms d'objets) |
| `src/api/wiki.test.ts` | accès au wiki : page partagée entre onglets, page absente, erreurs, photos, cache, demandes simultanées |
| `src/lib/wikiText.test.ts` | lecture du wikitext sur des extraits réels (sections, Infobox, listes, tableaux, Find in raid, récompenses) |
| `src/lib/questWiki.test.ts` | association, PVP ZONE, page historique, désaccords de prérequis, « à emporter », récompenses |
| `src/lib/search.test.ts` | recherche bilingue et tolérance aux fautes |
| `src/lib/points.test.ts` | points de la carte, spawns numérotés, progression |
| `src/state/store.test.ts` | réinitialisation (par quête, tout, isolation entre modes) avec Signal - Partie 3 |

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
- **Étages supérieurs sur la carte de base** : numéro d'étage sur l'icône, infobulle au survol. Le sélecteur ne garde que le niveau principal et les **souterrains** (règle dans `src/map/levels.ts`).
- **Recherche bilingue** : français ou anglais, sans casse, accents ni ponctuation, tolérante aux fautes.
- **Spawns d'objets de quête** numérotés (« Emplacement possible 3 sur 13 »).
- **Photos du wiki** (onglet « Photos ») : galeries de la section « Guide », via l'API MediaWiki.

### Session 4 (desktop) : réinitialisation, onglet Quête, texte du wiki
- **Push échoué** (identifiants GitHub), à faire à la main.
- **Réinitialisation de la progression** (`78d3e96`) : dans Réglages, par quête ou « Tout réinitialiser (mode actuel) », avec confirmation (la seconde propose d'exporter d'abord en JSON). Seul `done` du mode courant change. Tests avec les vrais identifiants de « Signal - Partie 3 ».
- **Onglet « 📜 Quête sélectionnée »** (`e25a742`, puis `708060c`), à côté de « 📷 Photos » :
  - en haut : progression, objectifs tarkov.dev à cocher (la carte se met à jour aussitôt), « Réinitialiser cette quête » ;
  - sections repliables (`<details>`, 44 px de haut sur téléphone) : **Résumé, Prérequis, Objectifs (wiki), À emporter, Récompenses, Équipement initial, Guide** ; une section sans données n'est pas affichée ;
  - accès : bouton « 📜 Quête » dans la popup de chaque point, lien « 📜 quête » dans l'onglet Sélection (marche aussi quand tous les points sont faits).
- **Texte du wiki** (`708060c`) :
  - `src/api/wikiPhotos.ts` est devenu `src/api/wiki.ts` : même file d'attente (1 requête/s), même cache (7 jours). **Une seule requête `parse` par quête**, partagée avec l'onglet Photos, et les demandes simultanées sont regroupées ;
  - lecture du wikitext : `src/lib/wikiText.ts` ;
  - croisement avec tarkov.dev : `src/lib/questWiki.ts` (prérequis et désaccords, liste « à emporter », comparaison des récompenses).
- **Données tarkov.dev en plus** (`Task.details`, champs facultatifs des objectifs) : `taskRequirements`, `traderRequirements`, `neededKeys`, `requiredKeys`, `foundInRaid`, `finishRewards`, `failConditions`, `restartable`, `lightkeeperRequired`, et **noms français des objets** (`items_fr`, environ 1,7 Mo ; seuls les 3 918 objets cités par les quêtes sont gardés). Cache de données v5.
- **Barre d'onglets** : six onglets dans 380 px ; les libellés longs passent à la ligne avec césure française. Sur téléphone, Quête et Photos n'affichent que leur logo.
- **Corrigé pendant les vérifications** :
  - l'onglet Photos envoyait deux requêtes `imageinfo` au lieu d'une (double rendu de React en développement) : le chargement des photos est maintenant partagé comme celui des pages ;
  - une cellule du wiki écrite `||Texte` (sans attributs) gardait un « | » parasite ;
  - « 3 × 1 objet au choix parmi 52 » est devenu « 3 objets au choix parmi 52 » ;
  - les quêtes liées issues de tarkov.dev sont affichées avec leur nom français ; celles qui viennent du wiki gardent leur nom anglais.
- **Exploration du wiki** : environ 12 requêtes au total pendant la session, espacées d'au moins 1,2 s. Les scripts d'exploration sont restés hors du dépôt (dossier temporaire).

---

## Ce que le wiki fournit réellement (vérifié en session 4)

- **API** : `https://escapefromtarkov.fandom.com/api.php` (MediaWiki 1.43.9), utilisable depuis l'app avec `origin=*`.
  - Fonctionne : `action=parse` (wikitext, sections, modèles, catégories, `redirects=1`), `action=query` (`revisions`, `categories`, `categoryinfo`, `imageinfo`), `list=categorymembers` (`Category:Quests` : 898 pages), `list=search` en plein texte, `action=opensearch`.
  - N'existe pas ou ne marche pas : recherche par titre (`srwhat=title` désactivée), **Cargo**, **Semantic MediaWiki**, **Bucket**. **`prop=infobox` (PortableInfobox) renvoie un résultat vide pour les quêtes.**
- **Pas de données structurées.** Formats relevés sur 9 pages (Signal - Part 3, Debut, Chumming, Serious Allegations, Collector, Health Care Privacy - Part 2, First in Line, Easy Money - Part 2, The Survivalist Path - Tough Guy) :
  - **modèles** : seulement `{{Infobox quest}}`, `{{quote}}`, `{{PAGENAME}}`, `{{Navbox quests}}`, `{{Historical content}}` ;
  - **paramètres d'Infobox quest remplis** : toujours `image` et `given by` ; souvent `location`, `previous`, `leads to` (plusieurs valeurs séparées par `<br/>`), `reqkappa` (`<font>Yes/No</font>`), `LL requirement` ; jamais `reward`, `reputation`, `time limit`, `related` ;
  - **sections** : `Dialogue` (réplique dans `{{quote}}`), `Requirements` (souvent absente), `Objectives`, `Rewards` (puces imbriquées + `{{quote}}` final), `Initial Equipment`, `Failure Dialogue`, `Guide` (sous-sections jusqu'à `====`, listes, galeries, tableau « Related Quest Items »), `Trivia` ;
  - **tableau « Related Quest Items »** : colonnes Icon (parfois absente), Item name, Amount, Requirement (Required / Handover item…), **Find in raid** (Yes / No / N/A), Notes ;
  - fin de page : `{{Navbox quests}}`, catégories, liens vers les autres langues (`[[fr:…]]`).
- **tarkov.dev** donne `foundInRaid` **explicitement** sur les objectifs giveItem, findItem, plantItem et sellItem. C'est la source utilisée en priorité dans « À emporter ». Les mentions Find in raid du wiki sont affichées à part, sur les lignes du tableau du wiki.
- **Association** : 504 quêtes sur 504 ont un `wikiLink`. Pour 476, le titre correspond au nom anglais. Les 28 quêtes « [PVP ZONE] » pointent vers la page de la quête normale.
- **Désaccords connus** avec tarkov.dev : Signal - Part 3 (Rat Hunting absent du wiki, Kappa, page historique), Chumming (Kappa), Collector (Postman Pat - Part 2 absent du wiki). Serious Allegations : le wiki ajoute « édition Edge of Darkness », que tarkov.dev n'a pas. Ce n'est pas détecté comme désaccord : le texte du wiki est simplement affiché.
- **Licence du texte : CC BY-NC-SA** (champ `rightsinfo`). Attribution par un lien vers la page, usage non commercial, partage dans les mêmes conditions. Les images n'ont pas de licence indiquée.

---

## Décisions prises (à ne pas remettre en cause sans raison)

- **Icebreaker** garde tous ses ponts dans le sélecteur : c'est un bateau, « souterrain » n'y a pas de sens.
- **Photos** : ce sont les photos du wiki Fandom, pas des captures perso. Choix fait en connaissance de cause (licence des images non précisée, conditions de Fandom restrictives). Usage personnel et non commercial, à la demande, sans copie, avec la source citée.
- **Photos par quête, pas par point** : les légendes du wiki ne donnent pas de coordonnées. Règle générale : si une association est incertaine, on n'affiche pas.
- **Exception à cette règle (session 4) : les quêtes « [PVP ZONE] »** affichent tout ce que le wiki fournit, à partir de la page de la quête normale correspondante. Un bandeau bien visible en haut de l'onglet Quête précise : « Cette quête PVP ZONE n'a pas de page propre sur le wiki : le texte affiché est celui de la quête normale « X » et peut différer (objectifs, récompenses). »
- **Aucune traduction maison** : ni des noms de quêtes, ni du texte du wiki (affiché en anglais avec la mention « Texte du wiki, en anglais » et le lien source).
- **tarkov.dev reste la référence** pour les positions, les objectifs à cocher et la logique de l'app. Le wiki complète (description, guide, récompenses, photos). En cas de contradiction (prérequis, niveau, fidélité, Kappa, récompenses), **on affiche un avertissement au lieu de trancher**.
- **Find in raid** : affiché seulement quand une source le dit explicitement (tarkov.dev `foundInRaid`, ou colonne Yes/No du tableau du wiki). Jamais deviné.
- **Rien d'inventé** : page absente ou non classée « Quests » / « Historical content », ou section absente, et rien n'est affiché du wiki pour cette partie.
- **Sécurité** : le texte du wiki est converti en texte brut et rendu par React. Aucun HTML du wiki n'est inséré.
- **Réinitialisation** : elle ne touche que la progression (`done`) du mode actuel, jamais les notes, les points perso, les positions placées à la main ni les autres modes. Toujours avec confirmation.
- **Un seul accès au wiki** dans le code (`src/api/wiki.ts`) : file d'attente et cache partagés, 1 requête par seconde au plus, à la demande.

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| Appels à l'API tarkov.dev et lecture des données | `src/api/tarkovJson.ts`, `src/api/cache.ts` |
| Accès au wiki (requêtes, file d'attente, cache, page + photos) | `src/api/wiki.ts` (+ `wiki.test.ts`) |
| Lecture du wikitext (sections, Infobox, blocs, tableau des objets, récompenses) | `src/lib/wikiText.ts` (+ `wikiText.test.ts`, extraits réels) |
| Croisement wiki ↔ tarkov.dev (prérequis, à emporter, récompenses, PVP ZONE) | `src/lib/questWiki.ts` (+ `questWiki.test.ts`) |
| Onglet Quête | `src/components/QuestTab.tsx`, rendu du texte : `src/components/WikiBlocks.tsx` |
| Onglet Photos | `src/components/PhotosTab.tsx` |
| Réinitialisation | `src/components/ResetProgressSection.tsx`, actions dans `src/state/store.ts` |
| Bouton à confirmation en deux temps | `src/components/ConfirmButton.tsx` |
| Calibrage des maps (y compris les étages et les tuiles) | `src/map/calibration.ts`, `src/data/tarkov-dev-maps.json` |
| Conversion coordonnées du jeu vers la carte | `src/map/crs.ts` (portage de tarkov.dev, ne pas modifier sans les tests) |
| Étages | `src/map/levels.ts` (+ `levels.test.ts`) |
| Fond de carte (SVG, tuiles, grille, étage affiché) | `src/map/BaseLayer.tsx` |
| Carte, marqueurs, popups, sélecteur d'étage | `src/map/MapView.tsx`, `src/components/PointPopups.tsx` |
| Recherche de quêtes | `src/lib/search.ts` (+ `search.test.ts`) |
| Calcul des points, spawns, progression | `src/lib/points.ts` |
| État sauvegardé | `src/state/store.ts` (+ `store.test.ts`) |
| Onglets du panneau | `src/App.tsx` (type `Tab`, `tabTaskId` partagé par Quête et Photos) |
| Styles (thème sombre) | `src/styles.css` |

**Conventions**
- Interface, commentaires et documentation en **français**.
- Fins de ligne **CRLF** (`core.autocrlf=true`), mais les fichiers neufs écrits par Claude sont souvent en LF dans la copie de travail. Git normalise au commit. **Un script de modification doit détecter les fins de ligne du fichier** au lieu de supposer CRLF : en session 3, cette erreur a écrasé `levels.ts` (restauré depuis git).
- Pour une regex dans un script Node écrit via un heredoc, utiliser l'outil Edit ou `String.raw` : les `\d` et `\b` se perdent sinon.
- **Serveur de développement : l'observateur de fichiers de Vite rate parfois des modifications sur ce disque (M:).** Symptôme : `X is not defined` dans la page, ou une modification invisible, alors que `tsc` passe. Vérifier ce que le serveur sert (`curl http://localhost:5173/src/App.tsx`), puis **redémarrer le serveur**.
- Dans l'app, `lat = z` et `lng = x` du jeu. `y` est la hauteur.
- `maps.json` de tarkov.dev fait référence : on porte sa logique au lieu de la réinventer.
- Nouveaux champs de données : **facultatifs** (`Task.details`, champs d'objectif), pour ne pas casser les anciennes données en cache ni les fixtures de test.
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
- **Texte du wiki** :
  - en anglais, pas toujours complet (section Requirements souvent absente) ;
  - certaines conditions du wiki (ex. « édition Edge of Darkness ») ne sont pas comparées automatiquement, elles sont juste affichées ;
  - la comparaison des prérequis repose sur les liens de l'infobox (`previous`) et de la section Requirements : un wiki incomplet peut produire un avertissement « que le wiki ne mentionne pas » ;
  - quêtes PVP ZONE : texte de la quête normale (bandeau).
- **Comparaison des récompenses** : seulement l'expérience, l'argent de base (Roubles, Dollars, Euros) et la réputation. Les objets ne sont pas comparés (noms anglais côté wiki, français côté tarkov.dev).
- **Barre d'onglets** : avec 6 onglets dans 380 px, les libellés passent sur deux lignes sur ordinateur.
- **Bouton « Annuler « Fait » » de la popup** : visible seulement si « Afficher les objectifs faits » est activé. Les autres moyens d'annuler sont l'onglet Quête, l'onglet Sélection et les Réglages.
- Les noms des niveaux d'Icebreaker restent en anglais.
- Les points perso et les objectifs placés à la main n'ont pas de hauteur, donc ils s'affichent à tous les étages.
- Les fonds en tuiles et le wiki demandent une connexion.
- Erreur Leaflet `_leaflet_pos` possible dans la console si on change de map pendant une animation de zoom. Elle est sans conséquence visible.
- Le format de l'API tarkov.dev n'a pas de schéma officiel : il a été déduit du code de tarkov.dev.

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- **Pousser la branche à la main** (GitHub Desktop ou `git push`), puisque Claude n'a pas les identifiants.

**Mise en ligne**
- « Publie l'app sur GitHub Pages depuis le dépôt ez4ence256/testss, avec un workflow GitHub Actions qui construit et déploie à chaque push. »

**Quêtes et progression**
- « Dans l'onglet Quête, ajoute un bouton "Ajouter à la sélection" quand la quête affichée n'est pas sélectionnée (ex. après un clic sur une quête préalable). »
- « Ajoute un filtre "quêtes Kappa uniquement" et un filtre par niveau du joueur. »
- « Propose un "itinéraire" : pour la map choisie, toutes les quêtes que je peux faire en un seul raid. »
- « Ajoute une liste "à emporter" pour toutes les quêtes sélectionnées d'une map, regroupée. »

**Wiki**
- « Ajoute dans Réglages un bouton "Vider le cache du wiki" et l'âge du cache par quête. »
- « Compare aussi les objets des récompenses (noms anglais du wiki ↔ items_en de tarkov.dev). »

**Étages**
- « Ajoute un bouton pour afficher le plan d'un étage supérieur (SVG) au survol ou au clic d'un point de cet étage. »

**Carte**
- « Ajoute les sorties (extracts) sur la carte, avec un bouton pour les afficher ou les masquer. »

**Qualité**
- « Fais un audit du projet (bugs, performances, code inutile) sans rien modifier, puis propose les corrections par ordre de priorité. »
- « Configure Vite pour surveiller les fichiers par interrogation régulière (usePolling) si l'observateur rate encore des modifications sur M:. »
