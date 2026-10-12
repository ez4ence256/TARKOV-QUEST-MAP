# Crédits et licences

Ce projet est un outil personnel, non commercial, qui n'est **pas affilié** à Battlestate Games ni à l'équipe de tarkov.dev.

« Escape from Tarkov » est une marque de Battlestate Games.

---

## Fonds de carte : tarkov-dev-svg-maps

- **Source :** https://github.com/the-hideout/tarkov-dev-svg-maps (commit `5a8b611`, février 2026)
- **Fichiers concernés :** `public/maps/svg/*.svg`
- **Licence :** [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](http://creativecommons.org/licenses/by-nc-sa/4.0/). Le texte complet est dans `public/maps/svg/LICENSE.md`.

Ce que ça implique :

- **Attribution :** les cartes sont créditées à leurs auteurs, les contributeurs de tarkov-dev-svg-maps (The Hideout).
- **Pas d'usage commercial**, que ce soit des cartes ou de ce projet tant qu'il les contient.
- **Partage dans les mêmes conditions :** une version modifiée des SVG doit rester sous CC BY-NC-SA 4.0.
- **Clause anti-triche du dépôt :** tout usage dans un logiciel de triche (radar, ESP, bots…) révoque automatiquement la licence.

Les SVG sont copiés tels quels. L'application se contente de choisir, à l'affichage, quels groupes (étages) sont visibles.

---

## Fonds de carte en tuiles : assets.tarkov.dev

- **Source :** `https://assets.tarkov.dev/maps/…/{z}/{x}/{y}.png` (chemins `tilePath` de `maps.json`)
- **Maps concernées :** Labs, Labyrinth et Icebreaker (pas de SVG), ainsi que les étages qui n'existent qu'en tuiles (Réserve, par exemple).
- **Auteurs :** Tarkov.dev (Labs, Labyrinth), [TarkovBOT.eu](https://tarkovbot.eu/) (Icebreaker), comme indiqué dans `maps.json`. Le crédit s'affiche en bas à droite de la carte.
- Les images sont chargées par le navigateur de l'utilisateur. **Elles ne sont pas incluses dans ce dépôt.**
- Je n'ai pas trouvé de licence publiée pour ces images. Utilisez-les dans l'esprit du projet tarkov.dev : communautaire et non commercial.

---

## Calibrage des cartes et conversion des coordonnées : tarkov.dev

- **Source :** https://github.com/the-hideout/tarkov-dev (commit `97ff6e7`, 9 octobre 2026)
- **Fichiers concernés :**
  - `src/data/tarkov-dev-maps.json` : copie de `src/data/maps.json` (valeurs `transform`, `coordinateRotation`, `bounds`, `svgBounds`, `svgLayer`, `tilePath`, `heightRange`, `layers`)
  - `src/map/crs.ts` : portage des fonctions `getCRS`, `applyRotation`, `pos` et `getBounds` de `src/pages/map/index.jsx`
  - `src/map/levels.ts` : portage des fonctions `markerIsOnLayer` et `markerIsOnActiveLayer` du même fichier (à quel étage appartient un point)
- **Licence :** MIT

```
MIT License

Copyright (c) 2019 Oskar Risberg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Texte des quêtes : wiki Escape from Tarkov (Fandom)

- **Source :** https://escapefromtarkov.fandom.com/ , pages des quêtes (sections Dialogue, Requirements, Objectives, Rewards, Initial Equipment, Failure Dialogue, Guide et modèle Infobox quest), lues via l'API MediaWiki (`action=parse`).
- **Licence du texte : CC BY-NC-SA** (indiquée par l'API du wiki : `rightsinfo`). Ce que ça implique :
  - **Attribution :** chaque texte affiché porte la mention « Texte du wiki, en anglais » et un lien vers la page source. Fandom accepte un lien vers l'article comme attribution.
  - **Pas d'usage commercial.**
  - **Partage dans les mêmes conditions :** le texte affiché reste sous CC BY-NC-SA.
- Le texte est chargé à la demande par le navigateur de l'utilisateur, affiché **sans traduction**, et **n'est pas inclus dans ce dépôt**. Les tests contiennent de courts extraits de pages réelles, sous la même licence.
- **Main story (session 7) :** les chapitres de l'histoire sont lus sur le wiki anglais et, en mode français, sur le **wiki français** (même hôte, sous `/fr/`, même licence CC BY-NC-SA) quand sa page correspond à la page anglaise. La mention « Texte et photos : wiki Escape from Tarkov (CC BY-NC-SA) » et le lien vers la page utilisée (française ou anglaise) sont affichés dans la fiche du chapitre. Le texte n'est pas traduit par l'application.
- Mêmes réserves que pour les photos : les conditions d'utilisation de Fandom restreignent les accès automatisés. Ce projet reste un **usage personnel et non commercial**, à la demande, une requête par seconde au plus, avec un cache de 7 jours.

---

## Photos des emplacements : wiki Escape from Tarkov (Fandom)

- **Source :** https://escapefromtarkov.fandom.com/ , section « Guide » des pages de quêtes, lue via l'API MediaWiki (`api.php`).
- Les photos sont chargées à la demande par le navigateur de l'utilisateur. **Elles ne sont pas incluses dans ce dépôt.** Chaque photo affiche un lien vers sa page source sur le wiki.
- **Licence : pas claire.** Ce qui a été vérifié le 10 octobre 2026 :
  - Le texte du wiki est sous **CC BY-NC-SA** (d'après l'API du wiki).
  - La [page de licence de Fandom](https://www.fandom.com/licensing) précise que les médias (images) **ne suivent pas forcément la licence du texte**, et qu'il faut consulter la page de chaque fichier.
  - Les pages de fichiers vérifiées **n'indiquent aucune licence**. Ce sont des captures du jeu, dont les droits appartiennent à Battlestate Games.
  - Les [conditions d'utilisation de Fandom](https://www.fandom.com/terms-of-use) interdisent les accès automatisés (« robot, spider, scraper ») sans autorisation écrite. Le robots.txt du wiki autorise l'API (`api.php`) pour tous les robots, mais bloque ClaudeBot et les autres robots d'IA sur tout le site.
- Le propriétaire du projet a choisi d'afficher ces photos **pour un usage personnel et non commercial**, à la demande, sans les copier, en citant la source. Ne réutilisez pas ces images ailleurs sans vérifier leurs droits.

---

## Plans du mall et du parking d'Interchange : re3mr.com et wiki Escape from Tarkov

- **Source :** panneaux « PARKING » (sections A à D, garages Idea, Goshan et Oli), « FIRST FLOOR » et « SECOND FLOOR » de l'affiche [`File:Interchange Interactive Map Base.webp`](https://escapefromtarkov.fandom.com/wiki/File:Interchange_Interactive_Map_Base.webp), « Map made by re3mr.com in cooperation with the Escape from Tarkov Wiki ».
- **Licence :** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (indiquée sur l'affiche). Fichiers **recadrés** (un panneau chacun, fond noir rendu transparent, **icônes, lettres et textes retirés**, limités à l'intérieur du mall pour les deux étages) : `public/maps/interchange-parking.webp`, `interchange-mall-first.webp`, `interchange-mall-second.webp`. Même licence pour ces dérivés ; usage non commercial, ne les réutilisez pas ailleurs sans respecter ces conditions.
- Le plan Minibus du wiki (`File:InterchangeMinibusLocations.jpg`) n'a servi qu'au recalage du parking ; il n'est pas inclus. Les deux étages du mall sont recalés sur les groupes First_Floor et Second_Floor du SVG de tarkov-dev-svg-maps (voir `src/map/basement.ts`).
- Le crédit s'affiche aussi sur la carte quand un de ces plans est visible.

---

## Données des quêtes : API JSON de tarkov.dev

- **Source :** https://json.tarkov.dev/ (endpoints `<mode>/tasks`, `<mode>/maps`, `<mode>/traders` et leurs traductions `_fr` / `_en`)
- Les données sont téléchargées par le navigateur de l'utilisateur. **Elles ne sont pas incluses dans ce dépôt.**
- Je n'ai pas trouvé de licence publiée spécifiquement pour les données de l'API. Utilisez-les dans l'esprit du projet tarkov.dev : communautaire et non commercial.

Le format a été déduit, sans copier de code, des dépôts suivants :

- [the-hideout/tarkov-data-manager](https://github.com/the-hideout/tarkov-data-manager) (GPL-3.0) : `jobs/update-quests.mjs`, `update-maps.mjs`, `update-traders.mjs`, `data/json_api_endpoints.json`
- [the-hideout/tarkov-api](https://github.com/the-hideout/tarkov-api) (GPL-3.0) : `schema-static.mjs`, `resolvers/taskResolver.mjs`

---

## Bibliothèques

| Bibliothèque | Licence |
|---|---|
| [React](https://react.dev) / React DOM | MIT |
| [Leaflet](https://leafletjs.com) | BSD-2-Clause |
| [React Leaflet](https://react-leaflet.js.org) | Hippocratic License 2.1 |
| [Vite](https://vite.dev), [Vitest](https://vitest.dev), [TypeScript](https://www.typescriptlang.org) (outils de développement) | MIT / Apache-2.0 |
| [Tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 (OCR de l'import par capture, chargé à la demande) | Apache-2.0 |
| [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 6.1.2 (moteur [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) compilé en WebAssembly, intégré au build) | Apache-2.0 |
| Données de langue `fra` et `eng` ([@tesseract.js-data](https://www.npmjs.com/org/tesseract.js-data), modèles `4.0.0_best_int` issus de [tessdata_best](https://github.com/tesseract-ocr/tessdata_best)) : téléchargées depuis le CDN jsdelivr à la première capture, **non incluses dans ce dépôt** | paquets npm : MIT ; modèles tessdata : Apache-2.0 |
