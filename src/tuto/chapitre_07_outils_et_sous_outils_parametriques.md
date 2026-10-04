# Chapitre 07 — Outils & sous-outils paramétriques

Un logiciel de CAO propose des dizaines de gestes de dessin : tracer un mur, une cloison, un cercle, une courbe, poser un texte... Ce chapitre explique comment ARCKI CAD organise tout cela avec quelques variables d'état React, et comment un simple clic se transforme en entité de plan.

## 🎯 Objectifs

- Distinguer l'**outil actif** (`activeTool`) des **sous-outils** (`wallSubTool`, `partitionSubTool`, `shapeSubTool`, `polylineSubTool`).
- Comprendre la mécanique « clic 1 / clic 2 » grâce à `draftStart` et au gestionnaire `handleCanvasClick`.
- Maîtriser la **ligne de référence** des murs (`refLine`, `placeWall`) : Nu Gauche, Axe, Nu Droite.
- Savoir pourquoi les murs sont dessinés avec des **raccords** (`computeWallPolygons`) et en deux passes.
- Découvrir l'outil **Texte** et le dessin de formes (cercle, main levée, courbe).

## 📋 Prérequis

- Chapitre 02 (types `CadEntity`, `CadTool`, `WallSubTool`) et chapitre 05 (état React, cycle de dessin).
- Chapitre 06 (OSNAP) : la position `cursorPos` utilisée ici est déjà aimantée.

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : états d'outils, `handleCanvasClick`, `placeWall`, barre d'outils, rendu des murs.
- [`src/wallGeometry.ts`](../wallGeometry.ts) : `refToCenterline`, `justifToRef`, `refSign`, `computeWallPolygons`, `polyToPoints`.
- [`src/types.ts`](../types.ts) : `CadTool`, `WallSubTool`, `ShapeSubTool`, `PolylineSubTool`, `CadEntity`.
- [`src/components/PropertiesSidebar.tsx`](../components/PropertiesSidebar.tsx) : blocs « Ligne de référence » et « Texte » (chapitre 09).

---

## 1. Un outil, des sous-outils : l'état dans `CadEditor`

**Concept.** Quand vous appuyez sur `W`, vous choisissez l'outil « Mur ». Mais un mur peut être tracé de trois façons : segment unique, chaîne continue, ou boîte de quatre murs. L'outil est donc un premier niveau (`activeTool`), la façon de s'en servir un second niveau (le sous-outil).

```tsx
// src/components/CadEditor.tsx (extraits)
const [wallSubTool, setWallSubTool] = useState<WallSubTool>('single');
const [partitionSubTool, setPartitionSubTool] = useState<WallSubTool>('single');
const [shapeSubTool, setShapeSubTool] = useState<ShapeSubTool>('rect');
const [polylineSubTool, setPolylineSubTool] = useState<PolylineSubTool>('straight');

const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
const [curveP1, setCurveP1] = useState<{ x: number; y: number } | null>(null);
const [curveStep, setCurveStep] = useState<0 | 1 | 2>(0);
```

Les types viennent de `src/types.ts` : `WallSubTool = 'single' | 'continuous' | 'rect'`, `ShapeSubTool = 'rect' | 'circle'`, `PolylineSubTool = 'straight' | 'freehand' | 'curve'`. Murs et cloisons partagent le même type `WallSubTool` mais ont chacun leur variable : on peut donc régler « Mur : continu » et « Cloison : droite » en même temps.

**Pourquoi ce choix ?** Des unions de chaînes littérales empêchent les états impossibles (un sous-outil `'banana'` ne compile pas) et gardent la logique lisible : un `if (wallSubTool === 'rect')` suffit.

### La barre latérale d'outils

La bande verticale de gauche est un simple tableau d'objets `{ id, icon, key, title, hasSub }` parcouru par `.map()`. L'icône et l'infobulle changent selon le sous-outil courant (par exemple `wallSubTool === 'rect' ? 'crop_square' : ...`). Les outils `wall`, `partition`, `rect` et `polyline` ont `hasSub: true` : un clic droit (`onContextMenu`) ouvre un menu volant (`activeFlyout`) pour choisir le sous-outil. Chaque outil est aussi désactivé selon l'onglet actif : en **Plan** tous les outils sont disponibles, en **Mise en page** seuls `select` et `text` le sont, en **Vues** seul `select`.

---

## 2. La mécanique « clic 1 / clic 2 » : `handleCanvasClick`

**Concept.** Presque tous les tracés suivent le même scénario : le premier clic mémorise un point de départ (`draftStart`), le second crée l'entité et remet `draftStart` à `null`. Pendant ce temps, l'aperçu élastique suit le curseur.

```
 Clic 1                    Mouvement                  Clic 2
 draftStart = P1  ───────► aperçu P1 → curseur ─────► entité créée
                                                      draftStart = null
                                                      (ou = P2 si chaînage)
```

`handleCanvasClick` est un grand `if / else if` sur `activeTool` : `text`, `wall`, `partition`, `door`, `window`, `dim`, `rect`, `polyline`, etc. Il commence toujours par vérifier que le **calque cible n'est pas verrouillé** (`getLayer('structures').locked`), puis crée l'entité, appelle `recordHistory()` (annuler/rétablir) et `setEntities(prev => [...prev, newEntity])`.

---

## 3. Les trois variantes de murs

### 3.1 Mur droit (`single`) et mur continu (`continuous`)

```tsx
// handleCanvasClick, activeTool === 'wall' (extrait simplifié)
const newWall: CadEntity = {
  id: `wall-${Date.now()}`,
  type: 'wall',
  layerId: 'structures',
  ...placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, wallThickness),
  thickness: wallThickness,
  height: wallHeight,
};
// ...
if (wallSubTool === 'continuous' || chaining) {
  setDraftStart({ x: cursorPos.x, y: cursorPos.y }); // P2 devient le nouveau P1
} else {
  setDraftStart(null);
}
```

Deux détails réels à connaître : `placeWall` (section 4) calcule les coordonnées x1…y2 et la `refLine` ; et il existe un booléen `chaining` (vrai par défaut) qui enchaîne les murs même en mode `single`. La chaîne se termine avec `Entrée` ou `Échap`.

### 3.2 « 4 murs rectangle » (`rect`)

Deux clics sur deux coins opposés créent d'un coup quatre entités `wall` (Nord, Est, Sud, Ouest) dans le même `setEntities`, puis les sélectionnent toutes. Il n'y a pas de fonction dédiée : le code est écrit directement dans `handleCanvasClick`, et chaque côté passe par `placeWall`, donc la ligne de référence s'applique aux quatre murs. Les murs sont dessinés dans le **sens horaire** (Nord vers l'est, puis Est vers le sud...), ce qui rend la justification cohérente.

La branche `partition` fonctionne de la même façon avec `partitionSubTool`, le calque `cloisons` et `partitionThickness` (72 mm par défaut).

---

## 4. La ligne de référence des murs

**Concept.** Quand vous cliquez deux points, le mur doit-il être *centré* sur la ligne, ou la ligne doit-elle coïncider avec une de ses *faces* ? En architecture on parle de justification : on veut souvent que la face extérieure d'un mur de 200 mm tombe pile sur le trait de cadastre, par exemple.

Le modèle de données le permet par `CadEntity.refLine?: 'left' | 'center' | 'right'`. Mais attention : `(x1,y1)→(x2,y2)` reste toujours l'**axe** du mur (convention de `wallGeometry.ts`). La ligne de référence ne sert qu'à *décaler* cet axe au moment du tracé.

```ts
// src/wallGeometry.ts
export const refSign = (r?: RefLine) => (r === 'left' ? 1 : r === 'right' ? -1 : 0);
export const justifToRef = (j: string): RefLine =>
  j === 'Nu Gauche' ? 'left' : j === 'Nu Droite' ? 'right' : 'center';

// Décale le segment le long de sa normale de (signe × épaisseur / 2) px
export const refToCenterline = (x1, y1, x2, y2, thicknessMm, ref) =>
  shiftSegment(x1, y1, x2, y2, (refSign(ref) * thicknessMm) / 20);
```

```tsx
// CadEditor.tsx
const [wallJustif, setWallJustif] = useState<'Nu Gauche' | 'Axe' | 'Nu Droite'>('Axe');
const placeWall = (x1, y1, x2, y2, thicknessMm) => {
  const ref = justifToRef(wallJustif);
  const c = refToCenterline(x1, y1, x2, y2, thicknessMm, ref);
  return { ...c, refLine: ref };
};
```

Le calcul : épaisseur en mm ÷ 10 = épaisseur en px, ÷ 2 = demi-épaisseur, d'où `/ 20`. Pour un mur de 200 mm en « Nu Gauche », l'axe est décalé de 10 px (100 mm) sur le côté droit du sens de tracé : le corps du mur se place à droite des points cliqués, et la face gauche suit exactement votre trait.

```
 sens du tracé  ───────────►      Nu Gauche : le corps est à DROITE du trait
 ─────────────────────────        ┌───────────────────┐
 trait cliqué (ligne de réf.)     │   corps du mur    │  (axe décalé de +e/2)
                                  └───────────────────┘
```

Dans la barre d'outils contextuelle, le bouton **LIGNE RÉF.** fait tourner `wallJustif` entre `Nu Gauche`, `Axe` et `Nu Droite`. Pour un rectangle tracé dans le sens horaire, « Nu Gauche » place les faces extérieures sur le trait.

**Pourquoi ce choix ?** Garder l'axe dans `x1…y2` simplifie tout le reste (accrochage, portes, longueurs, export). La justification n'est qu'un décalage appliqué à l'entrée, plus un champ mémorisé (`refLine`) pour pouvoir la changer plus tard.

### Changer la ligne dans l'inspecteur

Dans l'inspecteur, le bloc **« Ligne de référence (sens du tracé) »** appelle `onUpdate({ refLine })`, qui est en réalité `handleUpdateSelectedFields` :

```tsx
const delta = (refSign(updatedFields.refLine ?? w.refLine) * newT) / 2
            - (refSign(w.refLine) * oldT) / 2;
// l'axe du mur ET les ouvertures où hostWallId === w.id sont décalés de delta
```

La ligne de référence reste **fixe dans le plan** : c'est le corps du mur qui glisse de part et d'autre, et les portes/fenêtres encastrées (`hostWallId`) suivent. Même logique si l'on change l'épaisseur. Le détail est approfondi au [chapitre 13](./chapitre_13_murs_ligne_reference_et_raccords.md).

---

## 5. Raccords de murs : `computeWallPolygons`

**Concept.** Deux murs qui se rencontrent à angle droit, dessinés comme deux rectangles, laissent un coin « ouvert » ou un trait parasite à l'intérieur. En vrai, la maçonnerie est continue. `computeWallPolygons(walls)` calcule, pour chaque mur, un polygone de 4 points dont les extrémités sont ajustées :

- **angle (L)** : onglet (miter) entre deux murs de même nature ;
- **té (T)** : le mur qui arrive est prolongé ou raccourci jusqu'à la face du mur porteur ; une cloison peut s'arrêter sur un mur, jamais l'inverse ;
- murs presque parallèles (moins d'environ 10°) : pas de raccord ; extrémité droite.

Le rendu (dans `CadEditor`) se fait en **deux passes** par catégorie (`renderGroup('wall')` puis `renderGroup('partition')`) :

1. **Passe contours** : polygones sans remplissage, trait épais (`strokeWidth={i.sw * 2}`).
2. **Passe remplissages** : polygones remplis (hachure `#wall-concrete-hatch` pour les murs, `#273647` pour les cloisons) qui recouvrent la moitié intérieure des traits.

Résultat : le trait de contour n'apparaît que sur le bord extérieur de la maçonnerie, et les jonctions deviennent une seule masse continue. Les polygones sont convertis en attribut SVG par `polyToPoints`.

```
 sans raccord              avec raccord (2 passes)
 ┌────────┐                ┌────────────┐
 │        │┌──             │            │
 └────────┘│               │    ┌───────┘   plus de trait
 ┌─┐       │               │    │           parasite au coin
```

Le **masque d'ouverture** (chapitre 08) est appliqué aux **deux passes** (`mask={... url(#mask-wall-<id>)}` sur le contour *et* sur le remplissage) : sinon le trait de contour resterait visible dans la baie de la porte.

---

## 6. Formes, main levée, courbe, texte

### Cercle (`shapeSubTool === 'circle'`)
Clic 1 = centre, clic 2 = rayon. L'entité `circle` stocke le centre en `x1,y1`, un point de la circonférence en `x2,y2`, et `radius` en px. La surface vaut π × R² avec R converti en mètres : `Math.PI * Math.pow(rMm / 1000, 2)`.

### Main levée (`polylineSubTool === 'freehand'`)
Le tracé s'appuie sur trois événements souris : `handleCanvasMouseDown` démarre la capture (`setIsDrawingFreehand(true)`, premier point dans `freehandPoints`), le déplacement ajoute des points, le relâchement crée l'entité si l'on a au moins 3 points. Si le dernier point est à moins de 24 px du premier, la forme est **fermée** : type `polygon`, surface calculée avec la formule de Shoelace ; sinon type `polyline`.

### Courbe (`polylineSubTool === 'curve'`)
Machine à états `curveStep` 0 → 1 → 2 : P1, P2 (la corde), puis un 3e clic fixe `curvePoint`, point de contrôle d'une courbe de Bézier quadratique (`type: 'curve'`).

### Outil Texte (`activeTool === 'text'`, touche `T`)
Un clic ouvre un `window.prompt`, puis crée une entité `type: 'text'` sur le calque **`cotations`** (refusé s'il est verrouillé). Le contenu est dans `label`, la hauteur dans `fontSize` (14 px plan par défaut) ; `x2,y2` ne sert qu'à approximer l'emprise. Après création, l'outil repasse à `select` et l'entité est sélectionnée. Dans l'onglet *Mise en page*, `T` reste actif pour poser du texte sur la planche (`LayoutText`). L'inspecteur propose un bloc **« Texte »** : zone de saisie (`label`) et hauteur (`fontSize`, minimum 4).

### Niveaux
Tous ces outils dessinent dans les entités du **niveau actif** : `entities` contient toujours le niveau courant, les autres sont rangés dans `otherLevels`. Voir le [chapitre 12](./chapitre_12_gestion_des_niveaux.md).

---

## ⚠️ Pièges classiques

- **Oublier `setDraftStart(null)`** en changeant d'outil : le prochain tracé démarrerait d'un ancien point. La bande d'outils le fait dans son `onClick`.
- **Confondre axe et ligne de référence** : `x1…y2` est toujours l'axe ; ne recalculez jamais l'épaisseur à la main, passez par `placeWall`.
- **Penser que `single` ne chaîne jamais** : `chaining` (vrai par défaut) enchaîne aussi les murs droits.
- **Mettre le masque d'ouverture sur une seule passe** : le contour réapparaît dans la baie.
- **Appeler `setEntities` sans `recordHistory()`** : l'annulation `Ctrl+Z` ne verrait pas l'action.

## ✍️ Exercices

**Exercice 1 (facile).** Vous tracez un mur de 200 mm de gauche à droite avec « Nu Droite ». De combien de pixels l'axe est-il décalé et de quel côté ?

<details><summary>Indice</summary>Appliquez <code>refSign('right') * épaisseur / 20</code>.</details>
<details><summary>Solution</summary><code>refSign('right') = -1</code> donc décalage de −10 px (100 mm) le long de la normale ; l'axe passe à gauche du sens de tracé, le corps du mur est donc à gauche du trait (la face droite suit le trait).</details>

**Exercice 2 (moyen).** Ajoutez un nouveau sous-outil `'diag'` au type `WallSubTool`. Quels fichiers/endroits faut-il toucher ?

<details><summary>Indice</summary>Le compilateur TypeScript vous guide : cherchez les <code>wallSubTool ===</code>.</details>
<details><summary>Solution</summary>L'union dans <code>types.ts</code>, la branche dans <code>handleCanvasClick</code>, le menu volant des sous-outils, l'icône/titre de la bande d'outils, et éventuellement l'aperçu élastique du rendu.</details>

**Exercice 3 (avancé).** Un mur Nord de 6 m et un mur Est arrivent en angle droit : lequel des deux cas de `computeWallPolygons` s'applique ? Et pour une cloison qui arrive au milieu du mur Nord ?

<details><summary>Solution</summary>Angle : onglet (<code>atOEnd</code> et même type). Cloison au milieu : té, elle est prolongée/raccourcie jusqu'à la face du mur porteur.</details>

## 📌 À retenir

- `activeTool` choisit l'outil ; un sous-outil précise le geste ; `draftStart` mémorise le premier clic.
- `(x1,y1,x2,y2)` d'un mur = son **axe** ; `placeWall` applique la ligne de référence au tracé.
- Changer `refLine` dans l'inspecteur déplace le corps du mur et ses ouvertures, pas la ligne fixe.
- Murs et cloisons sont dessinés par `computeWallPolygons` en deux passes (contours puis remplissages).
- Le texte vit sur le calque `cotations` ; tout outil dessine dans le niveau actif.

⬅️ [Chapitre précédent](./chapitre_06_aimantation_intelligente_osnap.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_08_encastrement_des_menuiseries.md) ➡️
