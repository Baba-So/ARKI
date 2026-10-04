# Chapitre 13 — Murs : ligne de référence et raccords

Dans ARCKI CAD, un mur n'est pas « un trait épais » : c'est un **axe** auquel on associe une épaisseur, et dont le contour est recalculé pour raccorder proprement les murs entre eux (angles, tés). Ce chapitre explique le modèle « axe stocké », la ligne de référence (Nu Gauche / Axe / Nu Droite) et l'algorithme de raccord.

## 🎯 Objectifs

- Comprendre pourquoi on stocke l'**axe** du mur et non l'une de ses faces.
- Maîtriser la ligne de référence `refLine` et sa conversion en axe (`refToCenterline`).
- Savoir ce qui se passe quand on change la ligne de référence ou l'épaisseur dans l'inspecteur.
- Comprendre `computeWallPolygons` : angle en onglet, jonction en T, tolérances et garde-fou.
- Connaître la technique de rendu « contours puis remplissages ».

## 📋 Prérequis

- [Chapitre 03](./chapitre_03_moteur_geometrique_mathematiques.md) : vecteurs, normales, produit vectoriel.
- [Chapitre 07](./chapitre_07_outils_et_sous_outils_parametriques.md) : outils Mur / Cloison et sous-outils (rectangle 4 murs).
- [Chapitre 08](./chapitre_08_encastrement_des_menuiseries.md) : masques SVG des ouvertures.

## 📁 Fichiers concernés

- [src/wallGeometry.ts](../wallGeometry.ts) — `RefLine`, `refSign`, `justifToRef`, `shiftSegment`, `refToCenterline`, `computeWallPolygons`, `polyToPoints`.
- [src/components/CadEditor.tsx](../components/CadEditor.tsx) — `placeWall`, `handleUpdateSelectedFields`, section de rendu « 3. WALLS & PARTITIONS ».
- [src/components/PropertiesSidebar.tsx](../components/PropertiesSidebar.tsx) — sélecteur de ligne de référence de l'inspecteur.
- [src/types.ts](../types.ts) — champ `CadEntity.refLine`.

---

## 1. Le modèle « axe stocké »

Pour un mur (`type: 'wall'`) ou une cloison (`type: 'partition'`), `(x1,y1)→(x2,y2)` est **la ligne centrale** du mur, en px du plan (1 px = 10 mm), et `thickness` son épaisseur en mm. Le corps du mur s'étend donc de ± `thickness/20` px de chaque côté de l'axe.

**Pourquoi l'axe ?** Changer l'épaisseur ne déplace pas l'axe, les ouvertures (`hostWallId`) restent centrées sur lui, et l'algorithme de raccord travaille sur des droites (intersections d'axes). Le défaut : l'utilisateur raisonne souvent en **nus** (faces), d'où la ligne de référence.

## 2. Repère et convention de côté

Le plan est en coordonnées SVG : **Y vers le bas**. Pour un mur de direction unitaire `u = (dx, dy)`, la **normale droite** est :

$$n = (-dy,\ dx)$$

Exemple : mur dessiné vers l'Est, `u = (1, 0)` → `n = (0, 1)` : à l'écran, « à droite en avançant » est **vers le bas** (le Sud).

```
 Mur dessiné de A vers B (Est)  :   u →
 Nu GAUCHE  : la ligne tracée est la face gauche (Nord)
 ───────────────────────────  y = 0     ← ligne de référence (le trait)
 ░░░░░░░░ corps du mur ░░░░░░░           (corps à DROITE du trait)
 ─ ─ ─ ─ ─ ─ axe ─ ─ ─ ─ ─ ─  y = +e/2
 ───────────────────────────  y = +e    ↓ n (normale droite)
```

## 3. Ligne de référence → axe

Le type et les fonctions de [`wallGeometry.ts`](../wallGeometry.ts) :

```typescript
export type RefLine = 'left' | 'center' | 'right';

export const refSign = (r?: RefLine): number => (r === 'left' ? 1 : r === 'right' ? -1 : 0);

export const justifToRef = (j: string): RefLine =>
  (j === 'Nu Gauche' ? 'left' : j === 'Nu Droite' ? 'right' : 'center');

export const shiftSegment = (x1, y1, x2, y2, d) => { /* décale de d px le long de la normale droite */ };

export const refToCenterline = (x1, y1, x2, y2, thicknessMm, ref) =>
  shiftSegment(x1, y1, x2, y2, (refSign(ref) * thicknessMm) / 20);
```

(Les types des paramètres de `shiftSegment` sont omis ici pour la lisibilité.)

Lecture : la ligne de référence `left` signifie que **le trait tracé par l'utilisateur est la face gauche** ; le corps du mur est donc à droite, et l'axe est décalé de `+ épaisseur/2` le long de `n` (`refSign('left') = +1`). Pour `right`, c'est l'inverse (`-1`) ; pour `center`, aucun décalage.

| Justification (UI) | `refLine` | `refSign` | Décalage de l'axe |
|---|---|---|---|
| Nu Gauche | `left` | +1 | `+ e/2` vers la droite |
| Axe | `center` | 0 | aucun |
| Nu Droite | `right` | −1 | `− e/2` (vers la gauche) |

Exemple : trait de `(0,0)` à `(100,0)`, mur de 200 mm, Nu Gauche. Demi-épaisseur : 200/20 = 10 px, donc l'axe stocké est `(0,10)→(100,10)` ; le corps occupe `y ∈ [0, 20]`.

### `placeWall` dans `CadEditor`

Chaque site de création passe par une petite fonction qui applique la justification active :

```typescript
const placeWall = (x1: number, y1: number, x2: number, y2: number, thicknessMm: number) => {
  const ref = justifToRef(wallJustif);
  const c = refToCenterline(x1, y1, x2, y2, thicknessMm, ref);
  return { ...c, refLine: ref };
};
```

Le résultat est étalé dans l'entité (`...placeWall(...)`) : on obtient `x1, y1, x2, y2` (axe) et `refLine`. Elle est appelée sur **10 sites de création** : 4 murs du rectangle, le mur droit / continu, 4 cloisons du rectangle, la cloison droite / continue. Elle sert aussi à calculer l'aperçu pendant le tracé (deux appels dans la section de rendu du fantôme). Intérêt : une seule règle, aucun cas particulier par outil.

### Le rectangle à 4 murs

Les quatre murs sont créés dans le **sens horaire** à l'écran : haut (vers l'Est), droite (vers le Sud), bas (vers l'Ouest), gauche (vers le Nord). Dans ce sens, le côté droit de chaque mur est l'**intérieur** de la pièce. Avec Nu Gauche, le trait du rectangle tombe donc sur les **faces extérieures** et le mur grandit vers l'intérieur : les dimensions « hors tout » du rectangle correspondent à ce que l'utilisateur a tracé.

```
 (minX,minY) ──────────► (maxX,minY)
      ▲    ┌──────────────┐    │
      │    │  intérieur   │    │    sens horaire :
      │    │ (côté droit) │    ▼    n pointe vers l'intérieur
 (minX,maxY) ◄────────── (maxX,maxY)
```

## 4. Changer la ligne de référence ou l'épaisseur dans l'inspecteur

Quand l'utilisateur change `refLine` ou `thickness` (sélecteur de ligne de référence dans `PropertiesSidebar`, qui appelle `onUpdate`, c'est-à-dire `handleUpdateSelectedFields`), la règle est : **la ligne de référence reste fixe dans le plan, c'est l'axe qui se décale**.

```typescript
// Extrait de handleUpdateSelectedFields (simplifié)
const oldT = (w.thickness || (w.type === 'partition' ? 72 : 200)) / 10;
const newT = (updatedFields.thickness ?? w.thickness ?? ...) / 10;
const delta = (refSign(updatedFields.refLine ?? w.refLine) * newT) / 2
            - (refSign(w.refLine) * oldT) / 2;
const dx = (-(w.y2 - w.y1) / len) * delta;   // composante de la normale droite
const dy = ( (w.x2 - w.x1) / len) * delta;
// → le mur ET les entités dont hostWallId === w.id sont translatés de (dx, dy)
```

On calcule la **différence** entre la nouvelle et l'ancienne position de l'axe par rapport à la ligne de référence, puis on translate le mur **et ses ouvertures hébergées** (`e.hostWallId === w.id`) de ce delta, sinon portes et fenêtres resteraient au milieu de l'ancienne position. L'épaisseur est répercutée aux ouvertures (`thickness`). Exemple : un mur Nu Gauche de 200 mm passe à 300 mm : `delta = (1×30)/2 − (1×20)/2 = +5 px`, l'axe glisse de 5 px, la face gauche ne bouge pas.

## 5. Raccords : `computeWallPolygons`

Si on dessinait chaque mur comme un rectangle indépendant, deux murs à angle droit laisseraient un **coin manquant** (ou un recouvrement). La fonction `computeWallPolygons(walls)` calcule pour chaque mur un **polygone à 4 points** `[A+, B+, B-, A-]` (A = début, B = fin, `+` = côté de la normale droite, `-` = côté opposé), en ajustant les extrémités.

Elle renvoie un dictionnaire `{ [id]: Pt[] }` ; `polyToPoints` le formate pour l'attribut `points` d'un `<polygon>`.

### 5.1 Préparation

Pour chaque mur : vecteur unitaire `u`, normale `n = (-u.y, u.x)`, longueur et **demi-épaisseur `h`** en px (`thickness/20`, avec 200 mm par défaut pour un mur et 72 mm pour une cloison). Les murs de longueur quasi nulle sont ignorés.

### 5.2 Détection d'un raccord (par extrémité)

Pour chaque extrémité, on cherche le meilleur autre mur candidat :

1. **Règle de types** : un mur ne se raccorde qu'à un mur ; une cloison peut se raccorder à une cloison ou à un mur. Un mur ne se raccorde jamais sur une cloison.
2. **Angle minimal** : si `|sin(angle)| < MIN_SIN` (0,17, soit environ 10°), les murs sont considérés **parallèles** (pas de raccord ; les murs colinéaires gardent leurs extrémités droites).
3. **Intersection des axes** (`lineInt`) : on calcule le point `X` où les deux droites d'axe se coupent.
4. **Tolérance** : `X` doit être proche de l'extrémité (écart ≤ `w.h + o.h + 2` px) et à l'intérieur du mur voisin (à la même tolérance près). On garde le candidat le plus proche (plus petit « score »).

### 5.3 Angle en L : onglet (miter)

Si `X` est **près d'une extrémité du mur voisin** et que les deux murs ont le même type, c'est un angle. Chaque face est prolongée jusqu'à croiser la face correspondante de l'autre mur : les deux murs se coupent en biais, le long de la diagonale du coin.

```
   avant (rectangles indépendants)        après (onglet)

   │ ░░ │                                  │ ░░ │
   │ ░░ │                                  │ ░░ │
   │ ░░ └────────────           coin        │ ░░ ╲───────────
   │ ░░ ░░░░░░░░░░░░░           propre ──►  │ ░░░░░░░░░░░░░░░
   └─────────────────                       └─────────────────
   (coin manquant ou chevauchant)           (I et O : les 2 intersections de faces)
```

Techniquement : `I` et `O` sont les intersections des deux paires de faces (extérieure avec extérieure, intérieure avec intérieure) ; selon le signe du produit vectoriel `sgn` des directions, on les affecte à `A+/A-` (ou `B+/B-`).

### 5.4 Jonction en T

Si `X` tombe **au milieu** du mur voisin (ou si les types diffèrent, cloison sur mur), c'est un T : le mur qui arrive est **prolongé ou raccourci jusqu'à la face** du mur hôte tournée vers lui, et non jusqu'à son axe.

```
        │ cloison │                    │ cloison │
        │ (axe)   │                    │         │
        │    ▲    │            ──►     │         │
 ═══════╪════╪════╪═══════      ═══════╧═════════╧═══════
 ░░░░░░░ mur hôte ░░░░░░░       ░░░░░░░ mur hôte ░░░░░░░
 (la cloison s'arrête            (la cloison s'arrête
  au milieu du mur : trou)        sur la face du mur)
```

La face est choisie par `sigma = sign(dw · o.n)` : le côté du mur hôte vers lequel pointe le mur qui arrive.

### 5.5 Garde-fou

Si un raccord produit des points aberrants (distance à l'extrémité d'origine > `w.h*2 + o.h*2 + 12 + w.len`) ou si une intersection est impossible, la fonction **retombe sur l'extrémité droite** (`square`). On préfère un coin imparfait à un polygone qui explose.

## 6. Rendu : « contours puis remplissages »

Dans la section « 3. WALLS & PARTITIONS » de `CadEditor`, `computeWallPolygons(visWalls)` est appelé sur les murs visibles, puis pour chaque famille (`renderGroup('wall')` puis `renderGroup('partition')`) :

1. **Passe 1, contours** : `<polygon fill="none" stroke=...>` avec un trait épais (`strokeWidth = sw * 2`, centré sur le bord, donc moitié dehors / moitié dedans).
2. **Passe 2, remplissages** : `<polygon>` rempli (`url(#wall-concrete-hatch)` pour un mur, une couleur unie pour une cloison), dessiné **par-dessus** tous les contours.

```
 contours seuls :  ┌──┐┌──┐        + remplissages :  ┌─────┐
                   │  ││  │  trait interne            │     │  une seule
                   └──┘└──┘  visible                  └─────┘  maçonnerie
```

Le remplissage cache la moitié intérieure des traits aux raccords (là où les polygones se touchent ou se recouvrent) : les murs raccordés ressemblent à une seule maçonnerie continue, avec seulement le contour extérieur visible. Les **masques d'ouvertures** (`<mask id="mask-wall-...">`, chapitre 08) sont appliqués aux deux passes pour percer contour *et* remplissage, puis des traits de tableau ferment la réservation.

**Pourquoi deux groupes (murs puis cloisons) ?** Les contours des cloisons sont dessinés *après* les remplissages des murs : le trait de limite entre une cloison et un mur reste visible, ce qui distingue les deux ouvrages sur le plan.

## ⚠️ Pièges classiques

- **Confondre axe et face** : `x1,y1,x2,y2` d'un mur est l'axe, jamais la face ; exporter ou mesurer cet axe donne des longueurs « à l'axe ».
- **Oublier le repère** : Y vers le bas inverse l'intuition gauche/droite visuelle ; fiez-vous à `n = (-dy, dx)`.
- **Changer `thickness` sans décaler l'axe** quand la ligne de référence n'est pas `center` : la face de référence se déplacerait.
- **Ne déplacer que le mur** et pas ses ouvertures hébergées (`hostWallId`).
- **Appeler `computeWallPolygons` avec des murs de plusieurs niveaux** : chaque niveau doit être calculé séparément (`entities` ne contient que le niveau actif, chapitre 12).
- **Raccord inattendu** : la tolérance vaut `w.h + o.h + 2` ; deux extrémités proches mais non voulues peuvent se raccorder.

## ✍️ Exercices

1. **Calcul d'axe.** Un mur de 98 mm (cloison acoustique) est tracé de `(0,0)` à `(0,100)` (vers le Sud) en Nu Droite. Quel est l'axe stocké ? *Indice : `n = (-dy, dx)` pour `u = (0,1)`, puis `refSign('right') = -1`.*
2. **Raccord en croix.** Deux murs de 200 mm se croisent en leur milieu (un horizontal, un vertical). Faut-il ajouter un cas dans `computeWallPolygons` ? Et si le plan est dessiné avec **quatre demi-murs** qui se rejoignent au centre ?
3. **Murs colinéaires.** Deux murs bout à bout sur la même droite : que fait l'algorithme, et à quoi ressemble le rendu ?

<details>
<summary>Solutions succinctes</summary>

1. `u = (0,1)` donc `n = (-1, 0)` (vers l'Ouest). `refSign('right') = -1`, décalage = `-1 × 98/20 = -4,9` px le long de `n`, soit `+4,9` en X : axe `(4.9, 0)→(4.9, 100)`.
2. Pour deux murs traversants, aucune extrémité n'est proche de l'intersection : pas de raccord détecté, les extrémités sont droites et la croix s'affiche déjà correctement grâce aux remplissages qui recouvrent les contours internes. Avec quatre demi-murs, chaque extrémité détecte plusieurs voisins ; elle ne retient que le plus proche (`score`), ce qui peut produire des onglets arbitraires : il faudrait un cas dédié « jonction à n branches » (ex. prolonger chaque branche jusqu'au centre).
3. `cross < MIN_SIN` : pas de raccord, extrémités droites. Les remplissages des deux polygones se touchent bout à bout et cachent le trait de jonction ; une éventuelle discontinuité de hachure peut subsister.
</details>

## 📌 À retenir

- Un mur stocke son **axe** ; la ligne de référence (`refLine`) dit de quel côté du trait se trouve le corps.
- Normale droite `n = (-dy, dx)` ; `refToCenterline` décale l'axe de `refSign × e/2`.
- Changer la ligne de référence ou l'épaisseur : la ligne de référence reste fixe, l'axe et les ouvertures hébergées se décalent.
- `computeWallPolygons` produit un polygone `[A+,B+,B-,A-]` par mur : onglet en L, arrêt à la face en T, tolérance, angle minimal d'environ 10°, garde-fou.
- Rendu : contours puis remplissages, en deux groupes (murs puis cloisons).

---

⬅️ [Chapitre précédent (12)](./chapitre_12_gestion_des_niveaux.md) | [Sommaire](./README.md) | [Chapitre suivant (14) ➡️](./chapitre_14_facades_et_coupes.md)
