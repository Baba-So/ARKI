# Chapitre 03 — Moteur géométrique & mathématiques 2D

## 🎯 Objectifs
- Comprendre ce qu'est une fonction pure et pourquoi la géométrie du projet est isolée dans des modules sans React.
- Maîtriser les outils de base : distance, angle, projection d'un point sur un segment, surface (formule du lacet).
- Lire `src/wallGeometry.ts` : axe du mur, ligne de référence, polygone d'un mur, raccords en L et en T.
- Lire `src/viewsGeometry.ts` : projection des plans en façades et coupes.
- Savoir relier chaque calcul à l'échelle **1 px = 10 mm**.

## 📋 Prérequis
- [Chapitre 02](./chapitre_02_modelisation_donnees_typescript.md) : `CadEntity`, unités px et mm.
- Un peu de géométrie : vecteur, produit scalaire, théorème de Pythagore (tout est ré-expliqué en langage simple).

## 📁 Fichiers concernés
- [src/wallGeometry.ts](../wallGeometry.ts) — module pur : murs, onglets, tés
- [src/viewsGeometry.ts](../viewsGeometry.ts) — module pur : façades et coupes
- [src/components/CadEditor.tsx](../components/CadEditor.tsx) — fonctions locales `distToSegment`, `findWallSnap`, calcul d'aire
- [src/agent.ts](../agent.ts) — longueurs de murs en mètres

---

## 1. Fonctions pures : pourquoi ?

Une fonction est **pure** si (1) mêmes arguments donnent toujours le même résultat, et (2) elle ne modifie rien en dehors d'elle (pas de `setState`, pas de variable globale).

```
 entrées (murs)  ──▶  computeWallPolygons  ──▶  sorties (polygones)
                      aucun effet de bord
```

Avantages concrets : on peut la tester sans navigateur, la réutiliser (planches, vues, export) et React peut la rappeler à chaque dessin sans mauvaise surprise.

**État des lieux honnête.** Deux modules sont de vrais fichiers purs : `wallGeometry.ts` et `viewsGeometry.ts`. D'autres calculs (distance à un segment, `findWallSnap`, surface d'une pièce) sont aujourd'hui des **fonctions locales dans `CadEditor.tsx`** : ils lisent l'état `entities` du composant. Les extraits de ce chapitre qui les concernent sont donc signalés comme *simplifiés*.

## 2. Distance et angle

La distance entre deux points est la longueur de l'hypoténuse : √(Δx² + Δy²). JavaScript fournit `Math.hypot`. Le code applique partout la conversion en mm :

```ts
// motif répété dans CadEditor.tsx et agent.ts
const lengthMm = Math.round(Math.hypot(x2 - x1, y2 - y1) * 10); // px → mm
const lengthM  = (Math.hypot(x2 - x1, y2 - y1) * 10) / 1000;    // px → m (agent.ts)
```

Pour l'orientation, `Math.atan2(dy, dx)` donne l'angle dans les quatre quadrants (en radians). Le code le convertit puis le ramène entre 0 et 360° :

```ts
// version simplifiée du motif utilisé pour la mesure (outil M) et findWallSnap
const angleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
```

> Dans le plan SVG, **Y descend vers le bas**. Un angle de 90° pointe donc vers le bas de l'écran, pas vers le haut comme en mathématiques.

## 3. Distance d'un point à un segment

Pour savoir quel mur est le plus proche du curseur, on projette le point sur le segment puis on « bloque » la projection entre les deux extrémités (*clamp*). Extrait réel (fonction locale de `CadEditor.tsx`) :

```ts
const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};
```

`t` est le **ratio** de position : 0 = début du segment, 1 = fin, 0,5 = milieu. Le produit scalaire `(P - A)·(B - A)` divisé par la longueur au carré mesure « de combien on avance le long de AB ». Le cas `l2 === 0` protège contre un segment de longueur nulle (division par zéro).

## 4. Projection pour encastrer une ouverture (`findWallSnap`)

C'est la règle métier centrale du projet : **une porte ou une fenêtre est toujours posée sur un mur**. `findWallSnap` (fonction locale de `CadEditor.tsx`) parcourt les murs et cloisons visibles et non verrouillés, et garde la meilleure projection. Version **simplifiée** (le vrai code renvoie aussi l'angle, l'épaisseur, les extrémités P1/P2 et arrondit à 0,1 px) :

```ts
for (const wall of candidateWalls) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 15) continue;                       // mur trop court : ignoré

  const tRaw = ((px - wall.x1) * dx + (py - wall.y1) * dy) / (wallLen * wallLen);

  // l'ouverture doit rester entièrement dans la longueur du mur
  const half = openingWidthMm / 10 / 2;
  const tClamped = wallLen > half * 2 + 8
    ? Math.max((half + 3) / wallLen, Math.min(1 - (half + 3) / wallLen, tRaw))
    : 0.5;

  const projX = wall.x1 + tClamped * dx;
  const projY = wall.y1 + tClamped * dy;
  const dist = Math.hypot(px - projX, py - projY);
  // si dist est la plus petite rencontrée : on mémorise ce mur et cette projection
}
```

**Pourquoi ce choix ?** On « clampe » `t` avec une marge (`half + 3` px) pour que la baie ne déborde jamais du mur. Si le mur est plus court que la baie, on la centre (`t = 0,5`). La fonction renvoie toujours le mur le plus proche, quelle que soit la distance : c'est ce qui garantit qu'aucune ouverture ne flotte dans le vide.

Chiffres : une porte de 830 mm a une demi-largeur de 83 / 2 = 41,5 px ; sur un mur de 400 px, son centre reste donc entre (41,5 + 3) / 400 ≈ 0,11 et 0,89.

## 5. Murs : axe, ligne de référence, épaisseur

Dans `wallGeometry.ts`, la convention est écrite en tête du fichier : **`(x1, y1) → (x2, y2)` est l'AXE du mur**, et 1 px = 10 mm. La demi-épaisseur en px vaut `thickness / 20`.

La **ligne de référence** (`refLine`) est la ligne que l'utilisateur trace réellement : l'axe, ou l'une des deux faces (le « nu »). Le module sait convertir les libellés des réglages en valeurs, puis décaler le segment :

```ts
export const refSign = (r?: RefLine): number => (r === 'left' ? 1 : r === 'right' ? -1 : 0);
export const justifToRef = (j: string): RefLine =>
  (j === 'Nu Gauche' ? 'left' : j === 'Nu Droite' ? 'right' : 'center');

/** Décale un segment le long de sa normale droite (écran, Y vers le bas) de `d` px. */
export const shiftSegment = (x1: number, y1: number, x2: number, y2: number, d: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return { x1: x1 + nx * d, y1: y1 + ny * d, x2: x2 + nx * d, y2: y2 + ny * d };
};

export const refToCenterline = (x1: number, y1: number, x2: number, y2: number, thicknessMm: number, ref: RefLine) =>
  shiftSegment(x1, y1, x2, y2, (refSign(ref) * thicknessMm) / 20);
```

Exemple : on trace de (0, 0) à (100, 0) avec le « Nu Gauche » sur un mur de 200 mm.

```
 trace (ligne de référence)   y = 0   ─────────▶  sens du tracé
 axe réel du mur              y = 10  (décalé de 200/20 = 10 px vers la droite du tracé)
 face opposée                 y = 20
```

`refToCenterline(0, 0, 100, 0, 200, 'left')` renvoie un segment à `y = 10`. Le calcul de la normale `(-dy, dx) / longueur` est un **vecteur perpendiculaire unitaire** : on le multiplie par la distance voulue pour décaler.

**Pourquoi ce choix ?** Une fois l'axe calculé, tout le reste du programme (ouvertures, cotes, vues) travaille sur l'axe. La ligne de référence ne sert qu'au moment du tracé et dans l'inspecteur.

## 6. Le polygone d'un mur : `computeWallPolygons`

```ts
export function computeWallPolygons(walls: CadEntity[]): Record<string, Pt[]>
```

Elle reçoit les murs et cloisons et renvoie, pour chacun (par `id`), **4 points** `[A.plus, B.plus, B.minus, A.minus]`. Sans raccord, c'est un simple rectangle. Exemple (mur de 200 mm de (0, 0) à (100, 0)) : demi-épaisseur 10, normale `n = (0, 1)`, donc `[(0,10), (100,10), (100,-10), (0,-10)]`.

Mais deux murs qui se rencontrent ne doivent pas laisser de vide ni se chevaucher. La fonction interne `endPoints` examine chaque extrémité et cherche le meilleur raccord :

```
 Angle (L) : onglet (miter)          Té (T) : le mur qui arrive s'arrête
                                         sur la face du mur hôte
   ┌────────┐                                 │ │
   │ ╲      │                                 │ │  ← cloison prolongée ou
   │  ╲_____│                            ─────┴─┴─────  raccourcie jusqu'à la face
```

Règles réelles du code :
- **Pas de raccord si les murs sont presque parallèles** : `MIN_SIN = 0.17` (sinus de l'angle, environ 10°).
- **Une cloison peut se raccorder sur un mur, l'inverse non** (`w.type === o.type || (w.type === 'partition' && o.type === 'wall')`).
- **Angle** (même nature, extrémités qui se touchent) : on intersecte les faces des deux murs avec `lineInt` (intersection de deux droites).
- **Té** : le mur arrivant est prolongé ou raccourci jusqu'à la face du mur hôte tournée vers lui.
- **Garde-fou** : si le résultat est aberrant (point trop éloigné), on retombe sur l'extrémité droite (`square`).

Outil d'affichage : `polyToPoints(pts)` formate les points pour l'attribut `points` d'un `<polygon>` SVG. L'éditeur importe `computeWallPolygons` et `polyToPoints`, et dessine « contours puis remplissages » : les murs raccordés forment alors une maçonnerie continue (voir chapitre 04).

## 7. Surface d'une pièce : formule du lacet (Shoelace)

Pour un polygone de sommets P₀…Pₙ₋₁ : `Aire = |Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ)| / 2`. Extrait **simplifié** du calcul inline de `CadEditor.tsx` (le vrai code calcule aussi le périmètre, et gère les chaînes ouvertes) :

```ts
let sum = 0;
for (let i = 0; i < n; i++) {
  const j = (i + 1) % n;                 // le dernier sommet se reboucle sur le premier
  sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
}
const areaM2 = Math.abs(sum * 100 / 2) / 1_000_000;  // px² → mm² (×100) → m² (÷10⁶)
```

Vérification : une pièce de 400 × 300 px (soit 4 m × 3 m) donne |sum| / 2 = 120 000 px², ×100 = 12 000 000 mm², soit 12 m². ✓

Pourquoi ×100 ? 1 px = 10 mm, donc 1 px² = 10 mm × 10 mm = **100 mm²**. L'aire se convertit donc par le *carré* du facteur d'échelle, pas par le facteur lui-même.

## 8. Façades et coupes : `viewsGeometry.ts`

Une façade est une « photo » du plan vue de côté. Le plan donne (x, y) ; la façade a besoin de `u` (position gauche-droite à l'écran, en mm) et `d` (profondeur). La fonction `project` fait ce changement de repère, Nord en haut du plan :

```ts
export const project = (dir: Dir, x: number, y: number) => {
  switch (dir) {
    case 'S': return { u: x * 10, d: -y * 10 };
    case 'N': return { u: -x * 10, d: y * 10 };
    case 'E': return { u: -y * 10, d: -x * 10 };
    case 'O': return { u: y * 10, d: x * 10 };
  }
};
```

Exemple : `project('S', 50, 20)` donne `{ u: 500, d: -200 }`. Le facteur 10 est notre échelle px → mm.

Les autres briques, toutes pures :
| Élément | Rôle |
|---|---|
| `makeCut('AA' \| 'BB', value, flip)` | définit un plan de coupe (AA horizontal, BB vertical) |
| `keepSide(cut, x, y)` | côté conservé du bâtiment (devant le plan de coupe) |
| `openingZ(op)` | altitudes basse et haute d'une baie (porte 0 → 2 040 mm ; fenêtre : allège + hauteur) |
| `buildStrips(levelData, cut, viewDir)` | transforme chaque mur en **bande** (largeur `uMin..uMax`, altitude, trous des ouvertures), triée du fond vers le premier plan |
| `buildViewModel(levelData, spec)` | assemble coupe, bandes et bornes prêtes à dessiner |

Les niveaux entrent en jeu ici : `buildLevelData` trie les `CadLevel` par `elevation`, et chaque bande reçoit `z0 = level.elevation` ; la hauteur du mur vient de `w.height || level.height`. Quand un plan de coupe traverse un mur, `buildStrips` calcule le point de croisement par interpolation linéaire (`t = s1 / (s1 - s2)`) et ajoute une bande « section franche » toujours au premier plan (`depth: -1e9`).

Rappel de l'encastrement : les trous (`holes`) d'une bande viennent des ouvertures dont `hostWallId` égale l'`id` du mur. Sans mur hôte, pas de baie en façade.

## ⚠️ Pièges classiques
- **Oublier le clamp** (`t` hors de 0..1) : le point projeté sort du segment et la porte flotte au-delà du mur.
- **Diviser par zéro** sur un segment de longueur 0 : testez `len < 1e-6` ou utilisez `|| 1`, comme le fait `shiftSegment`.
- **Confondre axe et ligne de référence** : `x1..y2` est toujours l'axe ; seule la fonction `refToCenterline` convertit.
- **Convertir une aire avec le facteur de longueur** : 1 px = 10 mm mais 1 px² = 100 mm².
- **Raisonner avec Y vers le haut** : à l'écran Y croît vers le bas, les normales « droite » et « gauche » s'inversent par rapport au manuel de maths.

## ✍️ Exercices

**Exercice 1 — Longueur et surface (facile).** Un mur va de (0, 0) à (300, 400). Donnez sa longueur en mètres, puis la surface en m² d'une pièce rectangulaire de 500 × 360 px.
*Indice : `Math.hypot` puis ×10 ; pour la surface, 1 px² = 100 mm².*

<details><summary>Solution</summary>

Longueur : √(300² + 400²) = 500 px = 5 000 mm = **5 m**. Surface : 500 × 360 = 180 000 px² → ×100 = 18 000 000 mm² = **18 m²**.
</details>

**Exercice 2 — Décaler l'axe (moyen).** Quelle est l'ordonnée de l'axe pour `refToCenterline(0, 0, 100, 0, 72, 'right')` ? Et pour `'center'` ?
*Indice : `refSign('right') = -1` ; décalage = signe × épaisseur / 20.*

<details><summary>Solution</summary>

`'right'` : décalage = −1 × 72 / 20 = −3,6 px, donc l'axe est à **y = −3,6**. `'center'` : signe 0, l'axe reste à **y = 0**.
</details>

**Exercice 3 — Écrire une fonction pure (avancé).** Écrivez `polygonAreaM2(pts: {x:number;y:number}[]): number` (avec arrondi à 2 décimales) en vous inspirant de la section 7, et vérifiez-la sur un triangle (0,0), (200,0), (0,100).
*Indice : un triangle a pour aire la moitié du rectangle : 10 000 px².*

<details><summary>Solution</summary>

```ts
const polygonAreaM2 = (pts: { x: number; y: number }[]) => {
  if (pts.length < 3) return 0;
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; });
  return Math.round((Math.abs(s) / 2) * 100 / 1_000_000 * 100) / 100;
};
// triangle : |s|/2 = 10 000 px² → ×100 = 1 000 000 mm² → 1 m²
```
</details>

## 📌 À retenir
- Les calculs géométriques sont des fonctions pures ; `wallGeometry.ts` et `viewsGeometry.ts` en sont les modules, d'autres calculs vivent encore dans `CadEditor.tsx`.
- Un mur est stocké par son **axe** ; `refLine` + `refToCenterline` convertissent la ligne que l'on trace.
- `computeWallPolygons` produit un polygone de 4 points par mur et résout les raccords en L (onglet) et en T.
- `findWallSnap` projette toujours sur le mur le plus proche : c'est ce qui rend l'encastrement obligatoire.
- Échelle : longueurs × 10 (px → mm), surfaces × 100 (px² → mm²).

---
⬅️ [Chapitre précédent](./chapitre_02_modelisation_donnees_typescript.md) | [Sommaire](./README.md) | [Chapitre suivant ➡️](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md)
