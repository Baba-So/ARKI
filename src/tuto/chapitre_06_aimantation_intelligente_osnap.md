# Chapitre 06 — Aimantation Intelligente (Grille, OSNAP, Ortho, Murs)

À la souris, il est impossible de poser deux murs exactement bout à bout. Le logiciel "corrige" donc la position du curseur en permanence : c'est l'**accrochage** (*snap*). Ce chapitre décrit la chaîne réelle d'aimantation d'ARCKI CAD et le cas particulier des portes et fenêtres, qui se collent aux murs.

## 🎯 Objectifs

- Connaître l'ordre réel des corrections appliquées au curseur (grille → OSNAP → ortho).
- Lire et comprendre `detectSnap` (extrémité, milieu) et son seuil en px.
- Comprendre l'accrochage de grille et ses réglages (`settings.snapToGrid`, `gridSnapSize`).
- Comprendre la contrainte orthogonale (`settings.ortho`).
- Comprendre `findWallSnap` : la projection d'un point sur un mur pour encastrer une ouverture.

## 📋 Prérequis

- Chapitre 03 (distance entre deux points, projection scalaire).
- Chapitre 04 (conversion écran → monde, `rawX` / `rawY`).
- Chapitre 05 (`draftStart`, `cursorPos`).

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : `handleMouseMove`, `detectSnap`, `distToSegment`, `findWallSnap`, états `activeSnap` et `settings`, glyphe d'accrochage dans le rendu SVG.
- [`src/types.ts`](../types.ts) : `CadSettings`, `CadEntity`.

---

## 1. L'ordre réel des corrections

Tout se passe dans `handleMouseMove`. Chaque étape part du résultat de la précédente, et le résultat final est rangé dans `cursorPos` (que `handleCanvasClick` lira au clic) :

```
 souris → rawX, rawY (repère monde, chapitre 04)
            │
            ▼  1. arrondi au pixel : x = round(rawX)
            ▼  2. grille (si snapToGrid ou snap, et outil de tracé) : x = round(rawX / pas) × pas
            ▼  3. OSNAP (si settings.osnap) : extrémité / milieu d'une entité → écrase la grille
            ▼  4. Ortho (si settings.ortho et P1 posé) : verrouille l'axe dominant
            ▼
         setCursorPos({ x, y })       setActiveSnap(...) → glyphe affiché
```

Différence avec un moteur "à priorités strictes" : ici l'OSNAP **remplace** la grille s'il trouve une cible proche, puis l'ortho s'applique en dernier (il peut donc modifier un point accroché). Si vous voulez un OSNAP prioritaire sur l'ortho, c'est à vous de modifier cet ordre dans `handleMouseMove`.

## 2. Étape grille

Extrait réel (abrégé) :

```tsx
const gridStep = settings.gridSnapSize || 20;               // 20 px = 200 mm
const isDrawingOrModifying = ['partition','wall','dim','rect','line','measure',
                              'door','window','polyline','select'].includes(activeTool);
const isGridSnapActive = (settings.snapToGrid || settings.snap) && isDrawingOrModifying;

if (isGridSnapActive) {
  x = Math.round(rawX / gridStep) * gridStep;
  y = Math.round(rawY / gridStep) * gridStep;
}
```

Exemple : `rawX = 237`, pas 20 → `Math.round(11,85) × 20 = 240` px, soit 2 400 mm. Les murs tombent ainsi sur des multiples de 200 mm. La touche `F9` et les boutons du dock changent `snapToGrid` et `gridSnapSize` (`setSettings`). Le pas est exprimé en **px monde** (20 px = 200 mm).

## 3. Étape OSNAP : `detectSnap`

Version réelle simplifiée (le calque est testé avec `getLayer`) :

```tsx
const detectSnap = (x: number, y: number) => {
  if (!settings.osnap) return null;
  const threshold = 14;                           // rayon d'aimantation, en px monde

  for (const ent of entities) {                   // niveau actif uniquement
    const l = getLayer(ent.layerId);
    if (!l.visible || l.locked) continue;         // pas d'accrochage sur un calque masqué/verrouillé

    if (Math.hypot(x - ent.x1, y - ent.y1) < threshold) return { x: ent.x1, y: ent.y1, type: 'Extrémité' };
    if (Math.hypot(x - ent.x2, y - ent.y2) < threshold) return { x: ent.x2, y: ent.y2, type: 'Extrémité' };

    const midX = (ent.x1 + ent.x2) / 2, midY = (ent.y1 + ent.y2) / 2;
    if (Math.hypot(x - midX, y - midY) < threshold) return { x: midX, y: midY, type: 'Milieu' };
  }
  …  // un point de référence fixe de la maquette de démonstration
  return null;
};
```

Points à bien comprendre :

- La fonction renvoie **la première cible trouvée** dans l'ordre de `entities`, pas la plus proche. Pour un moteur plus fin, on garderait la plus petite distance (exercice 2).
- Le seuil de 14 px est en repère **monde** : à fort zoom, 14 px monde = beaucoup de pixels écran. Un éditeur plus abouti diviserait le seuil par `canvasZoom` (exercice 3).
- Ne dépend que de `entities` : seules les entités du **niveau actif** sont accrochables. Les murs fantômes du niveau inférieur (`ghostEntities`) ne le sont pas.
- Le résultat sert à deux choses : corriger `x, y`, et remplir `activeSnap` pour le retour visuel.

## 4. Étape ortho

Quand un premier point existe (`draftStart`, ou `measureStart` pour l'outil mesure) et que `settings.ortho` est actif, on aligne sur l'axe dominant :

```tsx
const activeAnchor = draftStart || (activeTool === 'measure' ? measureStart : null);
if (settings.ortho && activeAnchor && (['wall','partition','line'].includes(activeTool) || activeTool === 'measure')) {
  const dx = Math.abs(x - activeAnchor.x);
  const dy = Math.abs(y - activeAnchor.y);
  if (dx > dy) y = activeAnchor.y;   // horizontal
  else         x = activeAnchor.x;   // vertical
}
```

Aucune trigonométrie : comparer `|dx|` et `|dy|` suffit. Même logique pour le déplacement d'entités (`isDraggingEntities`) et pour les poignées (`activeGrip`). `settings.ortho` est actif par défaut dans `useState<CadSettings>`.

## 5. Retour visuel : le glyphe

`activeSnap` (`{ x, y, type }`) alimente un carré vert + une étiquette à la position accrochée (bloc "OSNAP SNAP GLYPH INDICATOR" du rendu SVG) ; si aucune cible mais que la grille est active, une petite cible en pointillés est affichée sous le curseur. `onMouseLeave` du canvas remet `activeSnap` à `null`.

Pourquoi montrer l'accrochage ? Parce que le point cliqué **n'est pas** celui de la souris : l'utilisateur doit voir où il va réellement poser son mur.

## 6. Le cas particulier des ouvertures : `findWallSnap`

Les portes et fenêtres ne s'accrochent pas à un point mais à un **segment** : la règle d'or d'ARCKI CAD est qu'une ouverture est toujours encastrée dans un mur (AGENTS.md §2). `findWallSnap(px, py, openingWidthMm = 830, maxDistance = 140)` fait donc :

1. ne retenir que les entités `wall` et `partition` visibles et déverrouillées ;
2. pour chaque mur, calculer la **projection scalaire** du point sur le segment : `tRaw = ((px - x1)·dx + (py - y1)·dy) / longueur²` ;
3. **borner** `t` pour que l'ouverture reste entièrement dans la longueur du mur (marge de 3 px de chaque côté) ; si le mur est trop court, centrer (`t = 0.5`) ;
4. retenir le mur dont le point projeté (`projX`, `projY`) est le plus proche, et renvoyer aussi l'angle et l'épaisseur du mur hôte.

Appels réels : au survol avec l'outil porte/fenêtre (distance maximale 140 px monde), au glisser d'une ouverture existante (250), au dépôt depuis la bibliothèque (`9999`, on prend toujours le mur le plus proche). Le détail du placement est au chapitre 08.

La distance au segment (`distToSegment`) est le même calcul avec `t` borné entre 0 et 1 ; il sert, entre autres, à retrouver l'entité sous la souris.

---

## ⚠️ Pièges classiques

- **Mélanger les unités** : seuils et pas sont en **px monde** (1 px = 10 mm) ; ne les comparez pas à des mm.
- **Oublier de filtrer les calques masqués/verrouillés** : l'accrochage sur une entité invisible est déroutant.
- **Seuil fixe quel que soit le zoom** : à zoom 10, 14 px monde = 140 px écran ; l'aimantation semble "trop gourmande".
- **Croire que l'ortho est prioritaire sur OSNAP** : dans `handleMouseMove`, l'ortho passe après et peut déplacer un point accroché.
- **Oublier que `entities` = niveau actif** : on ne peut pas s'accrocher à un mur d'un autre étage.
- **Accrocher une ouverture "au centre du curseur"** sans `findWallSnap` : elle flotterait dans le vide (interdit par la règle métier).

## ✍️ Exercices

**Exercice 1.** Avec un pas de 20 et `rawX = 249`, quelle valeur donne l'accrochage de grille ? Et en mm ?
*Indice : divisez, arrondissez, remultipliez.*

<details><summary>Solution</summary>

`Math.round(249/20) = 12` donc `x = 240` px = 2 400 mm.
</details>

**Exercice 2.** `detectSnap` renvoie le premier candidat dans le seuil. Écrivez une version qui renvoie le plus proche.
*Indice : gardez `bestDist` et `best`, comme le faisait la version pédagogique d'origine.*

<details><summary>Solution</summary>

```tsx
let best: {x:number; y:number; type:string} | null = null, bestDist = threshold;
const test = (px:number, py:number, type:string) => {
  const d = Math.hypot(x - px, y - py);
  if (d < bestDist) { bestDist = d; best = { x: px, y: py, type }; }
};
// dans la boucle : test(ent.x1, ent.y1, 'Extrémité'); test(ent.x2, ent.y2, 'Extrémité'); test(midX, midY, 'Milieu');
return best;
```
</details>

**Exercice 3.** Rendez le seuil indépendant du zoom (toujours environ 14 px à l'écran).
*Indice : un px écran vaut `1 / canvasZoom` px monde.*

<details><summary>Solution</summary>

`const threshold = 14 / canvasZoom;` (dans `detectSnap`, qui lit déjà l'état du composant).
</details>

## 📌 À retenir

- Le curseur est corrigé dans `handleMouseMove` : grille, puis OSNAP, puis ortho ; résultat dans `cursorPos`.
- `detectSnap` : seuil 14 px monde, extrémités puis milieu, calques visibles et déverrouillés seulement.
- Pas de grille par défaut : 20 px = 200 mm, réglable via `settings.gridSnapSize`.
- `activeSnap` pilote le glyphe : l'utilisateur voit où le point sera réellement posé.
- Les ouvertures passent par `findWallSnap` (projection sur le mur), jamais par un point libre.

---

⬅️ [Chapitre précédent](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_07_outils_et_sous_outils_parametriques.md) ➡️
