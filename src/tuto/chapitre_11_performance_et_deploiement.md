# Chapitre 11 — Performance, bonnes pratiques et déploiement

Un éditeur de plan doit rester fluide pendant que la souris bouge. Ce chapitre explique **pourquoi** React peut ralentir dans une application graphique, quelles optimisations sont **réellement présentes** dans ARCKI CAD, lesquelles ne le sont pas, et comment valider puis construire le projet.

## 🎯 Objectifs

- Comprendre pourquoi un `mousemove` peut coûter cher en React.
- Reconnaître les optimisations réellement utilisées : `React.memo` sur le contenu des cadres de vue, brouillon local pendant un glisser-déposer, `useMemo` dans les vues.
- Identifier les limites de l'architecture actuelle (composant `CadEditor` monolithique).
- Savoir nettoyer correctement les écouteurs d'événements.
- Valider (`npm run lint`) et construire (`npm run build`) le projet.

## 📋 Prérequis

- [Chapitre 05](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) : `useState`, mises à jour d'état.
- [Chapitre 13](./chapitre_13_murs_ligne_reference_et_raccords.md) (optionnel, mais utile) : `computeWallPolygons`.
- Notions de rendu React (un changement d'état re-rend le composant).

## 📁 Fichiers concernés

- [src/components/CadEditor.tsx](../components/CadEditor.tsx) — éditeur principal (environ 6 900 lignes) : état, événements, rendu du plan.
- [src/components/LayoutPanel.tsx](../components/LayoutPanel.tsx) — mise en page : `ViewportContent` mémoïsé, état `drag`.
- [src/components/ViewsPanel.tsx](../components/ViewsPanel.tsx) — vues (`useMemo`).
- [src/wallGeometry.ts](../wallGeometry.ts) — `computeWallPolygons`.
- [package.json](../../package.json) et [vite.config.ts](../../vite.config.ts) — scripts et configuration de build.

---

## 1. Pourquoi un éditeur graphique ralentit

Chaque `setState` (ex. `setCursorPos` dans `CadEditor`, appelé à chaque déplacement de souris) **re-rend le composant** et tout son sous-arbre SVG qui n'est pas protégé. Un `mousemove` peut survenir plus de 60 fois par seconde. Si chacun recalcule et redessine tous les murs, hachures et cotes, l'interface saccade.

Deux leviers existent :

1. **Réduire la fréquence ou la portée** de l'état qui change (état local plutôt que global).
2. **Sauter le travail inutile** (`React.memo`, `useMemo`, `useCallback`).

## 2. Ce qui est réellement optimisé dans le code

### 2.1 `React.memo` sur le contenu des cadres de vue (LayoutPanel)

Dans la mise en page, chaque cadre (viewport) affiche un plan, une façade ou une coupe. Redessiner un cadre est coûteux (il reconstruit les données de niveaux, les bandes de murs…). Le composant `ViewportContent` est donc mémoïsé avec un **comparateur personnalisé** :

```typescript
// Extrait simplifié de LayoutPanel.tsx
const ViewportContent = React.memo(
  ({ vp, w, h, ctx }) => { /* dessin du plan, de la façade ou de la coupe */ },
  (a, b) =>
    a.vp.view === b.vp.view && a.vp.scale === b.vp.scale && a.w === b.w && a.h === b.h &&
    a.ctx.entitiesByLevel === b.ctx.entitiesByLevel && a.ctx.levels === b.ctx.levels
);
```

**Pourquoi un comparateur ?** L'objet `ctx` est recréé à chaque rendu du panneau (`const ctx = { levels, entitiesByLevel, isLayerVisible }`) ; une comparaison superficielle par défaut échouerait toujours. Le comparateur ne regarde que les références qui comptent vraiment.

### 2.2 Brouillon local pendant le glisser-déposer

Quand vous déplacez ou redimensionnez un cadre, la position intermédiaire est stockée dans un **état local** `drag` (`{ id, rect }`) ; `rectOf` utilise ce brouillon à la place de la vraie position. Le tableau `sheets` (état partagé, remonté dans `CadEditor`) n'est modifié qu'**au relâchement de la souris** (`patchItem` dans `onUp`).

```typescript
// Extrait simplifié
const onMove = (ev) => setDrag({ id, rect: { ...start, x: snap(start.x + dx), y: snap(start.y + dy) } });
const onUp = (ev) => {
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup', onUp);
  patchItem(id, { x: snap(start.x + dx), y: snap(start.y + dy) }); // un seul commit
  setDrag(null);
};
```

Résultat : pendant le geste, seul `LayoutPanel` se re-rend ; `CadEditor` et les `ViewportContent` mémoïsés restent inchangés (leurs props gardent la même référence). On gagne aussi une **seule entrée d'historique** au lieu de centaines.

### 2.3 `useMemo` dans les calculs dérivés

`ViewsPanel` mémorise les niveaux triés, les données de niveaux (`buildLevelData`), le modèle projeté, etc. Le même fichier `LayoutPanel.tsx` mémorise `wallPolys` (`computeWallPolygons`) et `planBounds`. Ces calculs ne se rejouent que si leurs dépendances changent.

### 2.4 Nettoyage des écouteurs

Tout `addEventListener` global doit avoir son `removeEventListener`. Dans `CadEditor`, le `useEffect` des raccourcis clavier ajoute des écouteurs `keydown`/`keyup` sur `window` et les retire dans sa fonction de nettoyage ; `LayoutPanel` fait de même pour `mousemove`/`mouseup` dans le geste de glisser. Sans cela, chaque remontage de composant empile des écouteurs et fuit de la mémoire.

## 3. Ce qui n'est PAS optimisé (et pourquoi c'est un choix à connaître)

- **Polygones de murs recalculés à chaque rendu.** Dans la section « 3. WALLS & PARTITIONS » de `CadEditor`, `computeWallPolygons(visWalls)` est appelé directement dans le JSX : il est donc réévalué à chaque rendu du plan, y compris quand seul le curseur a bougé. Son coût est quadratique (chaque extrémité de chaque mur est confrontée aux autres murs) : correct pour une maison, perceptible pour des centaines de murs.
- **`CadEditor` monolithique.** `CadEditor.tsx` regroupe l'état (`entities`, `cursorPos`, outils…), les événements et tout le rendu SVG. Le fichier ne contient aucun `useMemo`, `useCallback` ni `React.memo` : un changement de `cursorPos` re-rend tout le plan.
- **`entitiesByLevel` recréé à chaque rendu** (`{ ...otherLevels, [activeLevelId]: entities }`) : les composants enfants qui le reçoivent voient une nouvelle référence dès que `CadEditor` se re-rend, ce qui neutralise leur mémoïsation dans ce cas.
- **Historique.** `recordHistory` empile des copies de références du tableau `entities` (environ les 16 derniers états, via `slice(-15)`), ce qui reste léger car les entités ne sont jamais mutées.

**Pistes d'amélioration** (à faire avec mesure préalable, voir le Profiler de React DevTools) :

1. `useMemo(() => computeWallPolygons(visWalls), [entities, calques visibles])`.
2. Extraire le rendu des murs dans un composant `WallLayer` enveloppé dans `React.memo` ; l'état du curseur serait alors isolé dans un petit composant « overlay ».
3. Mémoïser `entitiesByLevel` avec `useMemo`.

Règle d'or : **mesurez avant d'optimiser**. Ajouter `memo` partout sans mesure complique le code sans gain garanti.

## 4. Valider avant de livrer

Les scripts de `package.json` :

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement Vite sur le port 3000 |
| `npm run lint` | `tsc --noEmit` : vérifie tous les types sans produire de fichier |
| `npm run build` | `vite build` : construit le bundle dans `dist/` |
| `npm run preview` | sert le build pour le tester |

```bash
npm run lint    # aucun message = aucune incohérence de type
npm run build   # produit dist/
```

`vite.config.ts` active les plugins `@vitejs/plugin-react` et `@tailwindcss/vite` (Tailwind v4), définit l'alias `@` vers la racine du projet, et gère le rechargement à chaud (HMR) selon la variable d'environnement `DISABLE_HMR` (désactivé dans AI Studio pour éviter le scintillement). Le contenu de `dist/` est statique : il peut être servi par n'importe quel hébergeur de fichiers.

## ⚠️ Pièges classiques

- **`memo` sans comparateur adapté** : une prop objet recréée à chaque rendu rend la mémoïsation inutile.
- **Dépendances de `useMemo` oubliées** : calcul périmé et bug visuel difficile à trouver.
- **Écouteur global sans nettoyage** : comportements dupliqués après un remontage.
- **Optimiser à l'aveugle** : mesurez avec le Profiler.
- **Croire que `lint` teste le comportement** : `tsc --noEmit` ne vérifie que les types.

## ✍️ Exercices

1. **Mémoïser les polygones.** Où et avec quelles dépendances placeriez-vous `useMemo` pour `computeWallPolygons` dans `CadEditor` ? *Indice : quelles données le calcul lit-il ?*
2. **Brouillon local.** Pourquoi ne pas appeler `patchItem` à chaque `mousemove` ? Citez deux inconvénients.
3. **Comparateur.** Que se passe-t-il si `ViewportContent` est mémoïsé sans comparateur ?

<details>
<summary>Solutions succinctes</summary>

1. Au niveau du composant, avant le `return` : `useMemo(() => computeWallPolygons(visWalls), [entities, layers])` (le calcul dépend des murs visibles, donc des entités et de la visibilité des calques). Les hooks ne peuvent pas être appelés dans l'IIFE du JSX.
2. Chaque appel re-rend `CadEditor` (et ses enfants) et empile une entrée d'historique par pixel.
3. `ctx` est un nouvel objet à chaque rendu : la comparaison superficielle échoue toujours, donc `memo` ne sert à rien.
</details>

## 📌 À retenir

- Un `setState` à haute fréquence (souris) est le principal risque de lenteur.
- Dans ARCKI CAD : `React.memo` (cadres de vue), brouillon `drag` local, `useMemo` dans les vues.
- `computeWallPolygons` est recalculé à chaque rendu du plan ; `CadEditor` est monolithique et sans mémoïsation.
- Mesurez avant d'optimiser, nettoyez toujours vos écouteurs.
- `npm run lint` puis `npm run build` avant toute livraison.

---

⬅️ [Chapitre précédent (10)](./chapitre_10_moteur_export_dxf_autocad_et_svg.md) | [Sommaire](./README.md) | [Chapitre suivant (12) ➡️](./chapitre_12_gestion_des_niveaux.md)
