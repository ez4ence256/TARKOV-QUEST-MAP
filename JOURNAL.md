# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (10 octobre 2026, fin de session 3)

| Élément | État |
|---|---|
| Branche | `claude/tarkov-quest-planner-axir48` (dépôt `ez4ence256/testss`) |
| Derniers commits | `8b74a2f` spawns + photos du wiki · `3591047` recherche bilingue · `0fb439b` étages supérieurs · `1342d80` étages + fonds en tuiles |
| Travail non commité | Seulement `.claude/launch.json` (volontairement hors du dépôt : chemin propre à cette machine) |
| Tests | 51/51 au vert (`npm test`) |
| Compilation | OK (`npm run build`) |
| Vérifié dans le navigateur | Douanes, Littoral, Labs, Labyrinth, Icebreaker, version téléphone |
| Pas encore poussé | Les commits sont locaux (`git push` à faire) |

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
- **Étages supérieurs sur la carte de base** : leurs points sont affichés sans choisir d'étage, avec le numéro de l'étage sur l'icône et une infobulle au survol (nom de l'étage, hauteur du point, tranche de hauteur de l'étage). Le sélecteur ne garde que le niveau principal et les **souterrains**.
  - Règle (`src/map/levels.ts`) : un étage est souterrain si une de ses tranches n'a pas de limite basse (−1000/−10000), ou si toutes ses tranches sont sous le bas du niveau principal. Sinon il est supérieur. Un test vérifie que la règle s'accorde avec les noms des étages sur toutes les maps.
- **Recherche bilingue** : le nom français ou anglais trouve la quête (« Appâtage » ou « Chumming »). Elle ignore la casse, les accents et la ponctuation, tolère 1 faute à partir de 5 lettres et 2 à partir de 9, et classe les résultats. Le nom anglais est rappelé quand c'est lui qui correspond. Il vient de `tasks_en`, déjà téléchargé pour le repli : aucune requête en plus.
- **Spawns d'objets de quête** : tous les emplacements possibles sont affichés et numérotés (« Emplacement possible 3 sur 13 »). Le panneau signale les objets pour lesquels l'API ne donne aucun emplacement.
- **Photos du wiki** (onglet « Photos ») : galerie de la section « Guide » de la page wiki de la quête, via l'API MediaWiki. Légende et lien source sous chaque photo. Requêtes à la demande, une par seconde au plus, cache de 7 jours.
- Versions du cache de données : v4 (les anciennes copies sont supprimées automatiquement).

---

## Décisions prises (à ne pas remettre en cause sans raison)

- **Icebreaker** garde tous ses ponts dans le sélecteur : c'est un bateau, « souterrain » n'y a pas de sens, et 9 ponts supérieurs empilés sur la coque seraient illisibles.
- **Photos** : ce sont les photos du wiki Fandom, pas des captures perso. Choix fait en connaissance de cause : la licence des images n'est pas précisée par le wiki, et les conditions de Fandom restreignent les accès automatisés (voir CREDITS.md). Usage personnel et non commercial, à la demande, sans copie, avec la source citée.
- **Photos par quête, pas par point** : les légendes du wiki (« 1: Against the wall… ») ne donnent pas de coordonnées, donc toute association à un point serait devinée. Règle : si l'association est incertaine, on n'affiche pas.
- **Aucune traduction maison** : 137 noms de quêtes « français » sont identiques à l'anglais dans les données de tarkov.dev, et on les laisse tels quels.

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| Appels à l'API et lecture des données | `src/api/tarkovJson.ts`, `src/api/cache.ts` |
| Photos du wiki (requêtes, file d'attente, cache) | `src/api/wikiPhotos.ts`, onglet `src/components/PhotosTab.tsx` |
| Calibrage des maps (y compris les étages et les tuiles) | `src/map/calibration.ts`, `src/data/tarkov-dev-maps.json` |
| Conversion coordonnées du jeu vers la carte | `src/map/crs.ts` (portage de tarkov.dev, ne pas modifier sans les tests) |
| Étages (supérieurs, souterrains, numéro, infobulle) | `src/map/levels.ts` (+ `levels.test.ts`) |
| Fond de carte (SVG, tuiles, grille, étage affiché) | `src/map/BaseLayer.tsx` |
| Carte, marqueurs, sélecteur d'étage, infobulle | `src/map/MapView.tsx` |
| Recherche de quêtes | `src/lib/search.ts` (+ `search.test.ts`) |
| Calcul des points, spawns numérotés, progression | `src/lib/points.ts` |
| État sauvegardé (sélection, progression, notes, points) | `src/state/store.ts` |
| Panneau latéral | `src/components/*` |
| Styles (thème sombre) | `src/styles.css` |

**Conventions**
- Interface, commentaires et documentation en **français**.
- Fins de ligne **CRLF** (`core.autocrlf=true`), mais les fichiers neufs écrits par Claude sont souvent en LF dans la copie de travail. Git normalise au commit. **Un script de modification doit détecter les fins de ligne du fichier** au lieu de supposer CRLF : en session 3, cette erreur a écrasé `levels.ts` (restauré depuis git).
- Pour une regex dans un script Node écrit via un heredoc, utiliser l'outil Edit ou `String.raw` : les `\d` et `\b` se perdent sinon.
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

- **Plans des étages supérieurs** : leurs points sont sur la carte de base, mais le dessin de ces étages (SVG) n'est plus affichable, puisqu'ils ont quitté le sélecteur.
- **Photos** : rattachées à la quête, pas au point. Légendes en anglais. Licence des images non précisée par le wiki. Il faut une connexion.
- Les noms des niveaux d'Icebreaker restent en anglais (traduction seulement pour « 2nd Floor », « Underground », etc.).
- Les points perso et les objectifs placés à la main n'ont pas de hauteur, donc ils s'affichent à tous les étages.
- Les fonds en tuiles demandent une connexion : ils ne sont pas copiés dans le projet.
- Sur Réserve, certains étages n'existent qu'en tuiles. Les « 2e étage » de Réserve ont parfois une hauteur négative (−3,5 m), mais ils sont bien classés comme supérieurs.
- Échangeur n'a pas d'étage souterrain dans `maps.json` : les points du parking souterrain apparaissent au niveau principal.
- Erreur Leaflet `_leaflet_pos` possible dans la console si on change de map pendant une animation de zoom. Elle est sans conséquence visible.
- Le format de l'API n'a pas de schéma officiel : il a été déduit du code de tarkov.dev.

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- « Pousse la branche sur GitHub. »

**Mise en ligne**
- « Publie l'app sur GitHub Pages depuis le dépôt ez4ence256/testss, avec un workflow GitHub Actions qui construit et déploie à chaque push. »

**Étages**
- « Ajoute un bouton pour afficher le plan d'un étage supérieur (SVG) au survol ou au clic d'un point de cet étage. »
- « Permets de choisir l'étage d'un point perso ou d'un objectif placé à la main. »
- « Traduis les noms des ponts d'Icebreaker en français dans le sélecteur. »

**Photos**
- « Dans l'onglet Photos, ajoute une vue en grand (visionneuse) avec flèches précédent/suivant, sans quitter l'app. »
- « Ajoute dans Réglages un bouton "Vider le cache des photos du wiki". »

**Quêtes et progression**
- « Ajoute un filtre "quêtes Kappa uniquement" et un filtre par niveau du joueur. »
- « Affiche les quêtes préalables et suivantes de chaque quête (chaîne de quêtes) dans le panneau. »
- « Propose un "itinéraire" : pour la map choisie, toutes les quêtes que je peux faire en un seul raid. »

**Carte**
- « Ajoute les sorties (extracts) sur la carte, avec un bouton pour les afficher ou les masquer. »
- « Permets de basculer entre le fond SVG et le fond satellite (tuiles) sur les maps qui ont les deux. »

**Qualité**
- « Fais un audit du projet (bugs, performances, code inutile) sans rien modifier, puis propose les corrections par ordre de priorité. »
- « Corrige l'erreur Leaflet `_leaflet_pos` qui apparaît quand on change de map pendant un zoom. »
