# Tarkov Quest Planner

Planificateur de quêtes pour **Escape from Tarkov**, sur carte.

Vous choisissez une ou plusieurs quêtes, et leurs objectifs apparaissent en points sur la carte : une couleur par quête, une icône par type d'objectif. Vous pouvez annoter chaque point et le cocher au fur et à mesure.

Tout tourne dans le navigateur : pas de serveur, pas de compte.

---

## Lancer le projet

Il faut [Node.js](https://nodejs.org) **22.12 ou plus récent** (exigé par Vite et Vitest).

```bash
npm install
npm run dev
```

Ouvrez ensuite l'adresse affichée dans le terminal (en général http://localhost:5173).

Autres commandes utiles :

| Commande | Rôle |
|---|---|
| `npm run build` | Vérifie les types et construit la version de production dans `dist/` |
| `npm run preview` | Sert la version construite, pour la tester |
| `npm test` | Lance les tests unitaires |
| `npm run sync:maps` | Met à jour la copie locale des cartes SVG et du calibrage |

Le dossier `dist/` est un site statique. Vous pouvez le déposer tel quel sur n'importe quel hébergement : GitHub Pages, Netlify, ou un simple dossier.

---

## Fonctionnalités

- **Mode de jeu** demandé à chaque ouverture : PvP, PvE ou PvP Saison. Chaque mode a sa propre progression.
- **Liste de toutes les quêtes**, avec une recherche par nom (insensible aux accents) et des filtres par marchand et par map.
- **Sélecteur de map** : toutes les maps fournies par l'API. Le nombre de points restants est indiqué entre parenthèses.
- **Plusieurs quêtes à la fois** sur la même carte, une couleur par quête.
- **Icônes selon le type d'objectif** (champ `type` de l'API) :

  | Icône | Types de l'API |
  |---|---|
  | Marquer | `mark` |
  | Visiter | `visit` |
  | Fouiller / chercher | `findQuestItem` |
  | Trouver un objet | `findItem`, `giveItem`, `giveQuestItem`, `haveItem`, `sellItem` |
  | Placer un objet | `plantItem`, `plantQuestItem` |
  | Autre | tous les autres types |

- **Popup au clic sur un point** : nom de la quête, description de l'objectif, notes éditables et bouton **Fait**.
- **« Fait »** retire le point de la carte et coche l'objectif dans le panneau, qui affiche la progression (ex. 2/4, sans compter les objectifs optionnels). Pour annuler, décochez l'objectif dans le panneau. Vous pouvez aussi activer « Afficher les objectifs faits » dans les réglages.
- **Objectifs sans position** : si l'API ne donne pas de position, l'objectif est listé à part dans le panneau de la quête. Le bouton **Placer sur la carte** permet de le positionner à la main. Le point peut ensuite être déplacé par glisser-déposer.
- **Points personnels** (onglet « Mes points ») : nom, icône, note, déplaçables.
- **Étages** : sur les maps qui en ont (Douanes, Littoral, Usine, Labs, Icebreaker…), un sélecteur en haut à droite de la carte affiche l'étage voulu par-dessus le niveau principal, qui est alors atténué. Chaque étage indique combien de points il contient. Les points des autres étages restent visibles mais grisés, et leur popup donne leur étage avec un bouton **Afficher cet étage**. Cliquer sur un objectif dans le panneau affiche automatiquement le bon étage.
- **Coordonnées du jeu** affichées sous le curseur (en bas à gauche), pratique pour vérifier le calibrage.
- **Sauvegarde automatique** dans le navigateur : quêtes sélectionnées, progression, notes et points. Le bouton **Exporter / Importer (JSON)** dans « Réglages » permet de faire une copie ou de changer d'appareil.
- **Interface sombre**, utilisable sur téléphone : le panneau des quêtes se replie au-dessus de la carte.

---

## D'où viennent les données

### Quêtes, maps, marchands

Elles viennent de l'**API JSON publique de tarkov.dev** (`https://json.tarkov.dev/`). C'est celle qu'utilise le site tarkov.dev lui-même.

- Les données sont téléchargées au premier lancement, puis gardées en **cache local pendant 6 heures**. Les nouvelles quêtes apparaissent donc toutes seules, sans toucher au code.
- Le bouton **Recharger depuis l'API** (dans « Réglages ») force une mise à jour.
- Si l'API ne répond pas, l'app utilise la dernière version en cache et affiche un avertissement.
- Les noms sont en **français**. Quand une traduction manque, l'anglais est utilisé à la place.

Positions utilisées pour placer les points (rien n'est inventé) :

- `objectives[].zones[].position` : zones à marquer, visiter, etc. Le contour `outline` est dessiné en pointillés quand il existe.
- `objectives[].possibleLocations[].positions` : emplacements possibles d'un objet de quête.

### Fonds de carte et calibrage

- Les **SVG** viennent de [tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps) et sont copiés dans `public/maps/svg/`.
- **Labs, Labyrinth et Icebreaker** n'ont pas de SVG : leur fond est fait de tuiles d'image chargées depuis `assets.tarkov.dev`, comme sur le site tarkov.dev. Elles ne sont pas copiées dans le projet et demandent donc une connexion.
- Les **étages** (tranches de hauteur, zones des bâtiments) viennent aussi de `maps.json`. La hauteur des points vient de l'API : `y` des positions, `top` et `bottom` des zones.
- Le **calibrage** vient du fichier `src/data/maps.json` du site tarkov.dev : valeurs `transform`, `coordinateRotation`, `bounds` et `svgBounds`. Une copie est embarquée, et l'app essaie aussi de récupérer la version en ligne sur GitHub (cache de 24 h).
- La **conversion des coordonnées** (`src/map/crs.ts`) est un portage fidèle du code de tarkov.dev. Un test vérifie qu'elle donne exactement les mêmes pixels que l'original sur toutes les maps.

Licences et sources détaillées : voir [CREDITS.md](./CREDITS.md).

---

## Limites connues

- **Fonds en tuiles (Labs, Labyrinth, Icebreaker)** : sans connexion, ou si `assets.tarkov.dev` ne répond pas, ces maps s'affichent sans fond. Les points restent bien placés.
- Les **noms d'étages** sont traduits pour les cas courants (« 2e étage », « Sous-sol »…). Ceux d'Icebreaker restent en anglais, tels que fournis par tarkov.dev.
- Les **points placés à la main** et les **points personnels** n'ont pas de hauteur : ils sont visibles à tous les étages.
- Une **map absente du calibrage** (nouvelle map pas encore ajoutée à tarkov.dev) s'affiche en coordonnées brutes, avec un avertissement.
- Le format de l'API JSON n'est pas décrit par un schéma officiel. Il a été déduit du code source de tarkov.dev, et l'app ignore les champs inattendus au lieu de planter.

---

## Organisation du code

```
src/
  api/          récupération des données (tarkovJson.ts) et cache local (cache.ts)
  map/          calibrage, conversion de coordonnées, étages, carte Leaflet, fond SVG/tuiles, icônes
  state/        état personnel sauvegardé (sélection, progression, notes, points) + export/import
  lib/          types d'objectifs/icônes, calcul des points et de la progression
  components/   panneau : liste des quêtes, sélection, points perso, réglages, popups
scripts/
  sync-maps.mjs met à jour les SVG et le calibrage embarqués
public/maps/svg fonds de carte (CC BY-NC-SA 4.0)
```
