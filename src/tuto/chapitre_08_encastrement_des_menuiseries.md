# Chapitre 08 — Encastrement des menuiseries & masques SVG

En architecture, une porte ou une fenêtre ne flotte jamais dans le vide : elle est **encastrée dans un mur** dont elle reprend l'orientation et l'épaisseur. C'est la règle métier n°1 d'ARCKI CAD. Ce chapitre montre comment le code la garantit, du clic de souris jusqu'à la découpe visuelle de la maçonnerie.

## 🎯 Objectifs

- Comprendre le principe d'aimantation sur mur : projeter un point sur un segment.
- Lire la vraie fonction `findWallSnap` (une closure de `CadEditor`) et savoir ce qu'elle retourne.
- Savoir comment une ouverture est liée à son mur (`hostWallId`) et retrouvée (`getOpeningsForWall`).
- Expliquer le masque SVG qui perce le mur, appliqué aux deux passes de rendu.
- Dessiner le battant d'une porte et inverser son sens (`Espace`).

## 📋 Prérequis

- Chapitre 03 (projection d'un point sur un segment, vecteurs unitaires) et chapitre 04 (coordonnées SVG, `transform`).
- Chapitre 07 (murs, `computeWallPolygons`, rendu en deux passes).

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : `findWallSnap`, `getOpeningsForWall`, `handleSnapOpeningToWall`, `handleInsertBlock`, `handleCanvasClick` (branches `door` / `window`), rendu des portes.
- [`src/components/CadLibraryPanel.tsx`](../components/CadLibraryPanel.tsx) : bibliothèque de menuiseries (appelle `handleInsertBlock`).
- [`src/components/PropertiesSidebar.tsx`](../components/PropertiesSidebar.tsx) : réglages de l'ouverture (largeur, battant, allège).
- [`src/types.ts`](../types.ts) : champs `hostWallId`, `openingWidth`, `doorSwing`, `flipSwing`, `wallPositionRatio`...

---

## 1. Le principe : projeter le curseur sur le mur

**Concept.** Quand vous approchez la souris d'un mur avec l'outil Porte, on cherche le point du mur le plus proche du curseur : c'est la **projection orthogonale**. Le centre de la porte est placé là, et la porte « emprunte » l'angle du mur.

Version **simplifiée** (pédagogique, ce n'est *pas* le code réel) :

```ts
// Version simplifiée : fonction pure, un seul mur
function projectOnWall(px: number, py: number, w: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const t = ((px - w.x1) * dx + (py - w.y1) * dy) / (dx * dx + dy * dy); // 0 = début, 1 = fin
  const tClamped = Math.max(0, Math.min(1, t));                          // reste sur le segment
  return { x: w.x1 + tClamped * dx, y: w.y1 + tClamped * dy, t: tClamped };
}
```

`t` mesure la position le long du mur (0 au début, 1 à la fin) ; `Math.max/min` empêche de sortir du segment. Le vrai code ajoute de quoi garder l'ouverture *entièrement* dans le mur, choisir parmi tous les murs, et calculer les deux bords de la baie.

---

## 2. La vraie `findWallSnap`

Dans le dépôt, `findWallSnap` **n'est pas une fonction exportée** : c'est une closure définie à l'intérieur du composant `CadEditor`. Elle lit donc directement `entities` et `getLayer` (l'état courant) au lieu de recevoir la liste des murs en paramètre.

```ts
// src/components/CadEditor.tsx — signature réelle
const findWallSnap = (
  px: number,
  py: number,
  openingWidthMm = 830,
  maxDistance = 140
): {
  wall: CadEntity;      // mur ou cloison hôte
  projX: number; projY: number;   // centre de l'ouverture, projeté sur l'axe du mur
  tClamped: number;               // position 0..1 le long du mur
  p1X: number; p1Y: number;       // bord 1 de la baie
  p2X: number; p2Y: number;       // bord 2 de la baie
  wallAngleDeg: number; wallAngleRad: number;
  wallThickness: number;          // épaisseur héritée
  distance: number;
  openingWidthMm: number;
} | null
```

Les étapes de l'algorithme :

1. **Candidats** : entités `wall` ou `partition` dont le calque est **visible et non verrouillé**.
2. **Pour chaque mur** (longueur ≥ 15 px) : vecteur directeur `(ux, uy)`, puis `tRaw` (la projection scalaire de la section 1).
3. **Clamp intelligent** : si le mur est plus long que l'ouverture + 8 px, `t` est borné pour que la baie reste *toute entière* sur le mur (`minT`/`maxT` avec une marge de 3 px) ; sinon l'ouverture est centrée (`tClamped = 0.5`).
4. **Meilleur mur** : celui dont le point projeté est le plus proche du curseur.
5. **Bords de la baie** : `p1 = proj − u × (largeur/2)`, `p2 = proj + u × (largeur/2)`, arrondis au dixième de px.

```ts
const tRaw = ((px - wall.x1) * dx + (py - wall.y1) * dy) / (wallLen * wallLen);
// ...
p1X: Math.round((projX - ux * halfWidthPx) * 10) / 10,
p2X: Math.round((projX + ux * halfWidthPx) * 10) / 10,
```

Détail piège : le paramètre `maxDistance` (140 par défaut) est présent dans la signature, mais le code actuel retourne **toujours le mur le plus proche** (« pour garantir l'encastrement strict ») sans comparer `distance` à ce seuil. C'est voulu : une porte ne doit jamais être refusée parce que le curseur est loin. Le retour est `null` seulement s'il n'y a aucun mur candidat.

**Pourquoi ce choix ?** Une closure accède à l'état sans le repasser partout ; le prix est qu'elle n'est pas testable seule. Les appels : outils Porte/Fenêtre, aperçu fantôme, glissement d'une ouverture, `handleInsertBlock`, et `handleSnapOpeningToWall`.

---

## 3. Sceller l'ouverture dans son mur : `hostWallId`

Après `findWallSnap`, la porte est créée avec les points `p1`/`p2` et le lien vers le mur :

```ts
// handleCanvasClick, activeTool === 'door' (extrait)
const snap = findWallSnap(cursorPos.x, cursorPos.y, doorWidth, 140);
if (!snap) { /* message CLI : "Aucun mur détecté..." */ return; }
const newDoor: CadEntity = {
  id: `door-${Date.now()}`, type: 'door', layerId: 'ouvertures',
  x1: snap.p1X, y1: snap.p1Y, x2: snap.p2X, y2: snap.p2Y,
  angle: snap.wallAngleDeg, thickness: snap.wallThickness,
  hostWallId: snap.wall.id,
  openingWidth: doorWidth, doorSwing: activeDoorSwing, doorAngle: 90, flipSwing: activeFlipSide,
};
```

La fenêtre suit le même schéma (sans battant). Elle ne s'écrit jamais sans `snap` : **aucune ouverture sans mur hôte**. Il en va de même pour l'insertion depuis la bibliothèque : `handleInsertBlock` appelle `findWallSnap(dropX, dropY, block.widthMm, 9999)` ; s'il n'y a aucun mur, il affiche « Les ouvertures sont toujours encastrées sur les murs » et n'insère rien.

### Retrouver les ouvertures d'un mur

```ts
const getOpeningsForWall = (wall: CadEntity): CadEntity[] =>
  entities.filter(ent => {
    if (ent.type !== 'door' && ent.type !== 'window') return false;
    if (!getLayer(ent.layerId).visible) return false;
    if (ent.hostWallId === wall.id) return true;              // 1. lien direct
    // 2. sinon : centre de l'ouverture proche de l'axe du mur
    const d = distToSegment(midX, midY, wall.x1, wall.y1, wall.x2, wall.y2);
    return d <= ((wall.thickness || 200) / 10) / 2 + 10;
  });
```

Le lien direct est prioritaire ; la proximité géométrique est un filet de sécurité (anciens plans, ouvertures déplacées par l'IA).

### Glisser et déplacer

- **Glissement** : tant que `draggingOpeningId` est défini, `handleCanvasMouseMove` rappelle `findWallSnap(rawX, rawY, largeur, 250)` et réécrit `x1…y2`, `angle`, `thickness`, `hostWallId` et `wallPositionRatio` (= `tClamped`). L'ouverture glisse donc sur son mur, ou saute sur un mur voisin plus proche.
- **Déplacer le mur** : lors d'un déplacement groupé, les ouvertures dont le `hostWallId` est déplacé reçoivent le même décalage.
- **Réaligner** : `handleSnapOpeningToWall` (bouton de l'inspecteur) rappelle `findWallSnap(..., 9999)` pour rattacher l'ouverture au mur le plus proche.
- **Duplication de niveau** : `duplicateLevel` ajoute un suffixe aux `id` *et* aux `hostWallId` pour que les copies restent liées entre elles.

---

## 4. Percer la maçonnerie : le masque SVG

**Concept.** Un `<mask>` SVG est une « pochoir » : blanc = visible, noir = transparent. On peint tout en blanc, puis un rectangle noir à l'emplacement de chaque baie : le mur est comme découpé, sans jamais être coupé en deux entités.

```tsx
// CadEditor.tsx, rendu des murs (extrait)
<mask key={i.maskId} id={i.maskId} maskUnits="userSpaceOnUse">
  <rect x={-5000} y={-5000} width={10000} height={10000} fill="white" />
  {i.openings.map(op => {
    const opMidX = (op.x1 + op.x2) / 2;
    const opLen = Math.hypot(op.x2 - op.x1, op.y2 - op.y1) || (op.openingWidth ? op.openingWidth / 10 : 83);
    const opAngleDeg = (Math.atan2(op.y2 - op.y1, op.x2 - op.x1) * 180) / Math.PI;
    const cutThick = Math.max(i.thick * 1.6, 36);
    return (
      <g transform={`translate(${opMidX}, ${opMidY}) rotate(${opAngleDeg})`}>
        <rect x={-opLen / 2} y={-cutThick / 2} width={opLen} height={cutThick} fill="black" />
      </g>
    );
  })}
</mask>
```

Points clés :

- l'identifiant est `mask-wall-<id du mur>` (`maskId`), et n'existe que pour les murs ayant au moins une ouverture ;
- l'angle est recalculé depuis `x1,y1 → x2,y2` de l'ouverture ; la découpe est plus épaisse que le mur (`cutThick`) pour une coupe nette sur toute l'épaisseur, même en cas de raccord ;
- le masque est appliqué sur **les deux passes** du rendu (chapitre 07) : le polygone de **contour** (`mask={... url(#...)}`) *et* le groupe de **remplissage**. Sans cela, le trait de contour traverserait la porte alors que la hachure serait bien interrompue ;
- ensuite, un troisième calque dessine les **tableaux de maçonnerie** : deux petites lignes perpendiculaires à chaque extrémité de la baie (`jambs-<id>`).

```
   mur avant                 mur après masque + tableaux
 ████████████████          ██████│        │██████
 ████████████████    ──►   ██████│        │██████
 ████████████████          ██████│        │██████
                                 ↑ tableaux (jambs)
```

---

## 5. Dessiner le battant : portes et fenêtres

Les portes sont rendues dans `entities.filter(e => e.type === 'door').map(...)`. Chaque porte est un groupe SVG placé par `translate(midX, midY) rotate(angleDeg)` : on dessine **à plat dans un repère local**, comme si le mur était horizontal. Composants : deux dormants (`rect` de la largeur de cadre `frameW = 3.5`), un seuil en pointillés, l'**arc de débattement** (`path` avec une commande `A`, tirets `3 2.5`), le **vantail** (`rect` pivoté de `leafRot`) et la **charnière** (`circle`).

Les trois champs qui commandent le battant :

| Champ | Rôle |
|---|---|
| `doorSwing` (`'left'`/`'right'`) | côté de la charnière (Tirant gauche/droit) |
| `flipSwing` | bascule intérieur/extérieur (`flip = ±1`) |
| `doorAngle` | ouverture dessinée (90° par défaut, 45° possible) |

### Inverser avec `Espace`

Dans le gestionnaire clavier de `CadEditor`, `Espace` a trois rôles selon le contexte : avec l'outil Porte actif, il bascule `activeDoorSwing` pour la prochaine porte ; avec une porte sélectionnée, il appelle `handleUpdateSelectedFields({ doorSwing: ... })` ; sinon il active le panoramique (`isSpaceHeld`). Les fenêtres (`type === 'window'`) ont dormant, allège (`sillHeight`) et `openingType` (battant, coulissant, fixe), réglés dans l'inspecteur.

---

## ⚠️ Pièges classiques

- **Croire que `findWallSnap` est pure/exportée** : c'est une closure ; elle lit `entities` et ignore les calques verrouillés ou masqués. Après un `setEntities`, elle n'est valide qu'au rendu suivant.
- **Compter sur `maxDistance`** pour refuser une porte loin d'un mur : il n'est pas appliqué, seul `null` (aucun mur) bloque la pose.
- **Oublier `hostWallId`** : la porte serait retrouvée par proximité seulement, et ne suivrait plus son mur déplacé.
- **Mettre le masque sur une seule passe** : contour visible dans la baie.
- **Unités** : `openingWidth` est en mm, `x1…y2` en px (1 px = 10 mm). Divisez par 10 !

## ✍️ Exercices

**Exercice 1 (facile).** Une porte de 900 mm est posée sur un mur. Quelle est la distance en px entre `p1` et `p2` ?

<details><summary>Solution</summary>900 mm ÷ 10 = 90 px ; <code>halfWidthPx</code> = 45, donc <code>p2 − p1 = 90</code> px le long du mur.</details>

**Exercice 2 (moyen).** Un mur horizontal va de (0,0) à (400,0) (px). Où tombe le centre d'une porte de 830 mm si le curseur est en (30, 20) ?

<details><summary>Indice</summary>Largeur 83 px ; calculez <code>minT</code>.</details>
<details><summary>Solution</summary><code>halfWidthPx = 41,5</code> ; <code>minT = (41,5+3)/400 ≈ 0,111</code> ; <code>tRaw = 0,075</code> est borné à 0,111, donc <code>projX ≈ 44,5</code>, <code>projY = 0</code> : la porte reste entièrement dans le mur.</details>

**Exercice 3 (avancé).** Ajoutez dans `PropertiesSidebar` une indication « Mur hôte : … » en vous inspirant de la détection de `hostWall`.

<details><summary>Solution</summary>Le composant reçoit déjà <code>allEntities</code> : cherchez <code>e.id === entity.hostWallId</code> et affichez son <code>name</code>.</details>

## 📌 À retenir

- Toute ouverture naît d'un `findWallSnap` : projection du curseur sur le mur le plus proche, avec angle et épaisseur hérités.
- `findWallSnap` est une closure de `CadEditor` qui renvoie `wall`, `projX/projY`, `tClamped`, `p1X…p2Y`, `wallThickness`.
- `hostWallId` lie l'ouverture à son mur ; `getOpeningsForWall` la retrouve.
- Le `<mask>` perce le mur sur les deux passes (contour et remplissage), avec tableaux de maçonnerie.
- `Espace` inverse le battant ; `doorSwing`, `flipSwing`, `doorAngle` pilotent le dessin.

⬅️ [Chapitre précédent](./chapitre_07_outils_et_sous_outils_parametriques.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_09_inspecteur_proprietes_et_calques.md) ➡️
