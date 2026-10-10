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
- **Liste de toutes les quêtes**, avec des filtres par marchand et par map, et une **recherche bilingue** : le nom français ou anglais trouve la quête (« Appâtage » ou « Chumming »). La recherche ignore la casse, les accents et la ponctuation, et tolère les petites fautes (1 faute à partir de 5 lettres, 2 à partir de 9). Les correspondances exactes passent en premier. Quand c'est le nom anglais qui correspond, il est rappelé sous le nom français.
- **Quêtes sélectionnées épinglées** en tête de cette liste, dans une zone « Quêtes sélectionnées (n) », puis les autres quêtes. La recherche et les filtres s'appliquent aussi à la zone épinglée, qui indique combien de quêtes sélectionnées sont masquées. Le bouton **« Tout désélectionner »** vide la sélection sans toucher à la progression, aux notes ni aux points perso. Un clic sur une quête la sélectionne ou la désélectionne.
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
- **Onglet « 📜 Quête sélectionnée »** (à côté de « 📷 Photos ») :
  - en haut : nom, progression (ex. 2/3), tous les objectifs (texte tarkov.dev, en français) avec une case à cocher chacun. Décocher un objectif fait réapparaître ses points immédiatement. Bouton « Réinitialiser cette quête », avec confirmation.
  - en dessous, des **sections repliables** : Résumé (réplique du marchand, marchand, niveau, Kappa / Lightkeeper, mention « page historique »), Prérequis (tarkov.dev et wiki côte à côte, quêtes préalables et suivantes cliquables, **avertissement en cas de désaccord**), Objectifs (wiki), **À emporter** (clés, objets à trouver ou à rendre, objets à placer ou à marquer ; « Find in raid » seulement quand une source le dit), Récompenses (wiki, et tarkov.dev en comparaison si elles diffèrent), Équipement initial, Guide (texte du wiki nettoyé, conditions d'échec et « refaisable » de tarkov.dev). Une section sans données n'est pas affichée.
  - le texte du wiki est affiché **en anglais, sans traduction**, avec le lien vers sa page source.
  - quêtes « [PVP ZONE] » : un bandeau précise que le texte vient de la page de la quête normale et peut différer. On l'ouvre depuis le bouton **📜 Quête** de la popup de n'importe quel point de la quête, ou depuis le lien « 📜 quête » de la quête dans l'onglet Sélection. Ce lien marche même quand tous ses points sont faits, donc absents de la carte. Sur téléphone, les onglets Quête et Photos n'affichent que leur logo.
- **Réinitialiser la progression** (Réglages) : la liste des quêtes qui ont de la progression dans le mode actuel, avec un bouton « Réinitialiser » par quête, et « Tout réinitialiser (mode actuel) ». Les deux demandent une confirmation, la seconde avec un rappel de faire d'abord un export JSON. Seuls les objectifs cochés sont remis à « pas fait » : les notes, les points perso, les positions placées à la main et les autres modes de jeu ne sont pas touchés.
- **Spawns d'objets de quête** : tous les emplacements possibles fournis par l'API sont affichés et numérotés (« Emplacement possible 3 sur 13 » dans la popup et au survol). Le panneau indique leur nombre par map. En octobre 2026, l'API en donne pour les 109 objectifs « trouver un objet de quête » (301 emplacements, jusqu'à 16 pour un même objet).
- **Objets sans emplacement** : l'API ne donne aucun emplacement pour les objets de loot ordinaires (144 objectifs « trouver », 296 « remettre »). Le panneau le signale sous l'objectif.
- **Photos du wiki** (onglet « Photos ») : photos d'emplacements de la section « Guide » de la page de la quête sur le [wiki Escape from Tarkov](https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki), avec leur légende (en anglais) et un lien vers la page source de chaque photo. On l'ouvre avec le bouton 📷 d'une quête dans la liste, le lien « photos » du panneau ou le bouton **Photos** d'une popup. Les photos concernent la quête entière : le wiki ne dit pas à quel point de la carte correspond chaque photo, donc l'app ne les rattache pas aux points. Si la page n'a pas de photos, rien n'est affiché à la place. Détails et licence : voir [CREDITS.md](./CREDITS.md).
- **Objectifs sans position** : si l'API ne donne pas de position, l'objectif est listé à part dans le panneau de la quête. Le bouton **Placer sur la carte** permet de le positionner à la main. Le point peut ensuite être déplacé par glisser-déposer.
- **Points personnels** (onglet « Mes points ») : nom, icône, note, déplaçables.
- **Étages** :
  - **Étages supérieurs** (2e, 3e étage…) : leurs points sont affichés directement sur la carte de base. L'icône porte le numéro de l'étage, et le survol affiche une infobulle avec le nom de l'étage, la hauteur du point et la tranche de hauteur de l'étage. Sur téléphone, un appui ouvre la popup, qui indique aussi l'étage.
  - **Étages souterrains** (sous-sols, tunnels, bunkers, niveau technique de Labs…) : un sélecteur en haut à droite de la carte (liste déroulante sur téléphone) les affiche par-dessus le niveau principal, qui est alors atténué. Chaque niveau indique combien de points il contient. Les points des autres niveaux restent visibles mais grisés, avec un bouton **Afficher cet étage** dans leur popup.
  - **Règle** : un étage est souterrain si une de ses tranches de hauteur n'a pas de limite basse dans `maps.json`, ou si toutes ses tranches sont sous le bas du niveau principal. Tous les autres sont supérieurs.
  - **Exception : Icebreaker** (un bateau) garde tous ses ponts dans le sélecteur.
  - Cliquer sur un objectif dans le panneau affiche automatiquement le bon niveau.
- **Coordonnées du jeu** affichées sous le curseur (en bas à gauche), pratique pour vérifier le calibrage.
- **Sauvegarde automatique** dans le navigateur : quêtes sélectionnées, progression, notes et points. Le bouton **Exporter / Importer (JSON)** dans « Réglages » permet de faire une copie ou de changer d'appareil.
- **Interface sombre**, utilisable sur téléphone : le panneau des quêtes se replie au-dessus de la carte.
- **Panneau réglable** (ordinateur) : 440 px par défaut, de 400 à 720 px (et au plus 60 % de la fenêtre). On le règle avec la poignée entre le panneau et la carte : glisser à la souris, flèches gauche/droite au clavier, double-clic pour revenir à 440 px. La largeur est enregistrée dans le navigateur, et la carte occupe tout l'espace restant.
- **Onglets** : Sélection, Quêtes, Fiche quête, Photos, Mes points, Réglages. Les libellés ne sont jamais coupés au milieu d'un mot. Les logos s'ajoutent au texte quand le panneau est large (540 px et plus), et sur téléphone seuls les logos restent (📌 📋 📜 📷 📍 ⚙️), avec le nombre de quêtes sélectionnées.

---

## D'où viennent les données

### Quêtes, maps, marchands

Elles viennent de l'**API JSON publique de tarkov.dev** (`https://json.tarkov.dev/`). C'est celle qu'utilise le site tarkov.dev lui-même.

- Les données sont téléchargées au premier lancement, puis gardées en **cache local pendant 6 heures**. Les nouvelles quêtes apparaissent donc toutes seules, sans toucher au code.
- Le bouton **Recharger depuis l'API** (dans « Réglages ») force une mise à jour.
- Si l'API ne répond pas, l'app utilise la dernière version en cache et affiche un avertissement.
- Les noms sont en **français**. Quand une traduction manque, l'anglais est utilisé à la place. Les noms anglais sont gardés aussi (fichiers `tasks_en`, déjà téléchargés pour ce repli) : ils servent à la recherche.
- En octobre 2026, aucun nom de quête ne manque en français, mais **137 noms « français » sont identiques à l'anglais** dans les données de tarkov.dev (« Aid Stations », « Grenadier », quêtes « [PVP ZONE] »…). L'app ne traduit rien elle-même.

Positions utilisées pour placer les points (rien n'est inventé) :

- `objectives[].zones[].position` : zones à marquer, visiter, etc. Le contour `outline` est dessiné en pointillés quand il existe.
- `objectives[].possibleLocations[].positions` : emplacements possibles d'un objet de quête.

### Texte des quêtes (wiki)

- Il vient de la page wiki de la quête : le lien `wikiLink` de tarkov.dev, puis une requête `parse` avec `redirects=1`. La page n'est acceptée que si elle existe et est classée « Quests » ou « Historical content ».
- Le wiki n'a **pas de données structurées** (ni Cargo ni Semantic MediaWiki). L'app lit le wikitext : paramètres du modèle `{{Infobox quest}}` et sections (Dialogue, Requirements, Objectives, Rewards, Initial Equipment, Failure Dialogue, Guide). Tout est converti en texte. **Aucun HTML du wiki n'est inséré dans la page.**
- **Une seule requête par quête**, partagée avec l'onglet Photos, à la demande, une par seconde au plus, avec un cache de 7 jours.
- Les noms français des objets (clés, objets à rendre, récompenses) viennent du fichier de traductions `items_<langue>` de tarkov.dev (environ 1,7 Mo, téléchargé avec les quêtes). Seuls les objets cités par les quêtes sont gardés.

### Photos des emplacements

- Elles viennent du wiki Escape from Tarkov (Fandom), via son **API MediaWiki** (`api.php`, autorisée par le robots.txt du wiki). Il n'y a pas de lecture des pages HTML.
- Elles sont récupérées **à la demande** (quand l'onglet Photos s'ouvre sur une quête), avec **une requête par seconde au plus**, puis gardées en **cache local 7 jours**. Il faut 2 requêtes par quête : le texte de la page, puis les adresses des images.
- Les images sont chargées au fil du défilement, directement depuis les serveurs du wiki. Elles ne sont pas copiées dans le projet.

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
