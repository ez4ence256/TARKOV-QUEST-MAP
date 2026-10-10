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

Les SVG sont copiés tels quels. L'application se contente de masquer, à l'affichage, les étages autres que le niveau du sol.

---

## Calibrage des cartes et conversion des coordonnées : tarkov.dev

- **Source :** https://github.com/the-hideout/tarkov-dev (commit `97ff6e7`, 9 octobre 2026)
- **Fichiers concernés :**
  - `src/data/tarkov-dev-maps.json` : copie de `src/data/maps.json` (valeurs `transform`, `coordinateRotation`, `bounds`, `svgBounds`, `svgLayer`)
  - `src/map/crs.ts` : portage des fonctions `getCRS`, `applyRotation`, `pos` et `getBounds` de `src/pages/map/index.jsx`
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
