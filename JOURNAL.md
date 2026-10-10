# Journal de bord : Tarkov Quest Planner

Ce fichier sert de mémoire pour les prochaines sessions. Pour reprendre le travail, colle-le (ou cite-le) au début de ton prompt.

---

## État actuel (10 octobre 2026)

| Élément | État |
|---|---|
| Branche | `claude/tarkov-quest-planner-axir48` (dépôt `ez4ence256/testss`) |
| Dernier commit | `ecbe77a` : première version complète |
| Travail non commité | Étages, fonds de Labs, Labyrinth et Icebreaker, journal, `.claude/launch.json` |
| Tests | 30/30 au vert (`npm test`) |
| Compilation | OK (`npm run build`) |
| Vérifié dans le navigateur | Oui : Douanes, Littoral, Labs, Labyrinth, Icebreaker, version téléphone |

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
- **Étages** : sélecteur en haut à droite de la carte, avec le nombre de points par étage. L'étage choisi s'affiche par-dessus le niveau principal, qui est atténué. Les points des autres étages sont grisés, leur popup indique leur étage, et un clic dans le panneau affiche le bon étage. Sur téléphone, le sélecteur devient une liste déroulante.
- **Labs, Labyrinth, Icebreaker** : fond en tuiles d'image chargées depuis `assets.tarkov.dev`, avec le crédit de l'auteur affiché.
- L'API fournit maintenant la hauteur des points (`y`, et `top`/`bottom` pour les zones). Les versions du cache ont été montées (données en v2, calibrage en v2), et les anciennes copies sont supprimées.

---

## Repères techniques

| Sujet | Où regarder |
|---|---|
| Appels à l'API et lecture des données | `src/api/tarkovJson.ts`, `src/api/cache.ts` |
| Calibrage des maps (y compris les étages et les tuiles) | `src/map/calibration.ts`, `src/data/tarkov-dev-maps.json` |
| Conversion coordonnées du jeu vers la carte | `src/map/crs.ts` (portage de tarkov.dev, ne pas modifier sans les tests) |
| Logique des étages | `src/map/levels.ts` (+ `levels.test.ts`) |
| Fond de carte (SVG, tuiles, grille, étage affiché) | `src/map/BaseLayer.tsx` |
| Carte, marqueurs, sélecteur d'étage | `src/map/MapView.tsx` |
| État sauvegardé (sélection, progression, notes, points) | `src/state/store.ts` |
| Calcul des points et de la progression | `src/lib/points.ts` |
| Panneau latéral | `src/components/*` |
| Styles (thème sombre) | `src/styles.css` |

**Conventions**
- Interface, commentaires et documentation en **français**.
- Les fichiers sont en fins de ligne **CRLF** sur cette machine (`core.autocrlf=true`).
- Dans l'app, `lat = z` et `lng = x` du jeu. `y` est la hauteur.
- `maps.json` de tarkov.dev fait référence : on porte sa logique au lieu de la réinventer.

**Commandes**
- `npm run dev` : lance l'app (http://localhost:5173)
- `npm test` : lance les tests
- `npm run build` : compilation de production dans `dist/`
- `npm run sync:maps` : met à jour les SVG et le calibrage embarqués

---

## Limites connues

- Les noms des niveaux d'Icebreaker restent en anglais (traduction seulement pour « 2nd Floor », « Underground », etc.).
- Les points perso et les objectifs placés à la main n'ont pas de hauteur, donc ils s'affichent à tous les étages.
- Les fonds en tuiles demandent une connexion : ils ne sont pas copiés dans le projet.
- Sur Réserve, certains étages n'existent qu'en tuiles : un étage en image peut donc s'afficher par-dessus un fond SVG, et les styles diffèrent.
- Erreur Leaflet `_leaflet_pos` possible dans la console si on change de map pendant une animation de zoom. Elle est sans conséquence visible.
- Le format de l'API n'a pas de schéma officiel : il a été déduit du code de tarkov.dev.

---

## Idées pour la suite (prompts prêts à l'emploi)

**À faire en premier**
- « Commite le travail en cours (étages + fonds en tuiles) avec un message en français. »

**Mise en ligne**
- « Publie l'app sur GitHub Pages depuis le dépôt ez4ence256/testss, avec un workflow GitHub Actions qui construit et déploie à chaque push. »

**Étages**
- « Permets de choisir l'étage d'un point perso ou d'un objectif placé à la main, pour qu'il soit grisé sur les autres étages. »
- « Trie le sélecteur d'étage du plus haut au plus bas, et traduis les noms des niveaux d'Icebreaker en français. »

**Quêtes et progression**
- « Ajoute un filtre "quêtes Kappa uniquement" et un filtre par niveau du joueur. »
- « Affiche les quêtes préalables et suivantes de chaque quête (chaîne de quêtes) dans le panneau. »
- « Propose un "itinéraire" : pour la map choisie, toutes les quêtes que je peux faire en un seul raid. »

**Carte**
- « Ajoute les sorties (extracts) et les spawns sur la carte, avec un bouton pour les afficher ou les masquer. »
- « Permets de basculer entre le fond SVG et le fond satellite (tuiles) sur les maps qui ont les deux. »

**Qualité**
- « Fais un audit du projet (bugs, performances, code inutile) sans rien modifier, puis propose les corrections par ordre de priorité. »
- « Corrige l'erreur Leaflet `_leaflet_pos` qui apparaît quand on change de map pendant un zoom. »
