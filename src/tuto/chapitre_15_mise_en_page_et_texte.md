# Chapitre 15 — Mise en page, planches et outil texte

## 🎯 Objectifs
- Modéliser une planche (format, cadres de vue, textes) avec les types `LayoutSheet`, `LayoutViewport`, `LayoutText`.
- Comprendre l'échelle 1:N et le centrage d'un plan ou d'une façade dans son cadre.
- Convertir un clic écran en coordonnées papier (`getScreenCTM().inverse()`) et gérer glisser/redimensionner avec un brouillon local.
- Imprimer une planche à l'échelle réelle (clone du SVG, `@page`).
- Ajouter un outil texte, sur la planche comme sur le plan.

## 📋 Prérequis
- Chapitre 4 (SVG, `viewBox`, transformations) et chapitre 5 (état et cycle de dessin).
- Chapitre 14 (`ViewModel`, `ElevationDrawing`).
- Notions de `useMemo`, `React.memo` et `useRef` (chapitre 11).

## 📁 Fichiers concernés
- [`src/types.ts`](../types.ts) : `SheetFormat`, `LayoutView`, `LayoutViewport`, `LayoutText`, `LayoutItem`, `LayoutSheet`, champ `fontSize` de `CadEntity`.
- [`src/components/LayoutPanel.tsx`](../components/LayoutPanel.tsx) : tout l'onglet « Mise en page ».
- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : état des planches, disponibilité des outils, outil texte du plan.
- [`src/components/PropertiesSidebar.tsx`](../components/PropertiesSidebar.tsx) : section « Texte » de l'inspecteur.

---

## 1. Le modèle de données : une planche = des éléments en mm papier

Une planche est un papier. Toutes ses coordonnées sont en **millimètres papier**, pas en pixels du plan. Les types de `src/types.ts` :

```ts
export type SheetFormat = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

export type LayoutView =
  | { type: 'plan'; levelId: string }
  | { type: 'elevation'; dir: 'S' | 'N' | 'E' | 'O' }
  | { type: 'section'; id: 'AA' | 'BB'; pos: number; flip: boolean };
```

`LayoutView` est une **union discriminée** (chapitre 2) : le champ `type` dit quelles autres propriétés existent. Le cadre de vue n'embarque aucune géométrie, seulement une *description* de ce qu'il montre ; le contenu est recalculé à partir du plan courant, donc toujours à jour.

```ts
export interface LayoutViewport {          // extrait simplifié (commentaires retirés)
  kind: 'viewport'; id: string;
  x: number; y: number; w: number; h: number;   // mm papier
  view: LayoutView;
  scale: number;        // dénominateur : 1:scale
  title: string; showTitle: boolean; frame: boolean;
}
export interface LayoutText {
  kind: 'text'; id: string; x: number; y: number;
  text: string; fontSize: number;   // mm papier
  bold: boolean; align: 'start' | 'middle' | 'end';
}
export type LayoutItem = LayoutViewport | LayoutText;
```

`LayoutSheet` regroupe `format`, `landscape`, les champs du cartouche (`project`, `title`, `author`, `sheetNo`), `showFrame` et `items: LayoutItem[]`. Le discriminant `kind` permet à `items` de mélanger cadres et textes dans un seul tableau, avec un narrowing TypeScript propre (`it.kind === 'viewport'`).

---

## 2. Formats et création d'une planche

```ts
export const FORMATS: Record<SheetFormat, [number, number]> = {
  A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189],
};
export const sheetSize = (s) => {
  const [pw, ph] = FORMATS[s.format];
  return s.landscape ? { W: ph, H: pw } : { W: pw, H: ph };
};
```
(Extrait : le type du paramètre est abrégé.) `FORMATS` est stocké en portrait ; `sheetSize` échange largeur et hauteur en paysage. `Record<SheetFormat, …>` oblige le compilateur à vérifier que tous les formats sont couverts.

`createSheet(name, levelId, scale = 50)` fabrique une planche A3 paysage avec un cadre de plan qui occupe la zone de dessin, en laissant `MARGIN` (10 mm) autour et `CART_H` (36 mm) pour le cartouche.

---

## 3. L'échelle 1:N : deux formules à retenir

Le plan est dessiné en **px plan** (1 px = 10 mm réels). Une façade (chapitre 14) est dessinée en **mm réels**. Sur papier, à l'échelle 1:`scale`, 1 mm réel devient `1/scale` mm papier. Dans `ViewportContent` :

| Contenu | Unité source | Facteur appliqué | Formule |
|---|---|---|---|
| Plan | px plan | `k` (mm papier par px) | `k = 10 / scale` |
| Façade / coupe | mm réels | `f` | `f = 1 / scale` |

Exemple : 1:50. Un mur de 5 m = 500 px plan = 5000 mm réels. `k = 0,2`, donc 500 × 0,2 = 100 mm papier. Même résultat par `f = 0,02` : 5000 × 0,02 = 100 mm.

### Centrage par boîte englobante
Chaque cadre doit montrer le projet **au centre** de son rectangle. On calcule le centre `(cx, cy)` de la boîte englobante et on translate :

```ts
const k = 10 / scale; // mm papier par px plan
const cx = bb ? (bb.minX + bb.maxX) / 2 : 0;
const cy = bb ? (bb.minY + bb.maxY) / 2 : 0;
return (
  <g transform={`translate(${w / 2 - cx * k} ${h / 2 - cy * k}) scale(${k})`}>
    <PlanDrawing entities={ents} k={k} scale={scale} showRoomNames />
  </g>
);
```
Lecture : « mettre le centre du contenu au centre du cadre (`w/2`, `h/2`), le tout à l'échelle `k` ». L'ordre `translate` puis `scale` compte : le `translate` s'exprime en mm papier, donc on multiplie `cx` par `k` soi-même.

`PlanDrawing` reçoit `k` pour compenser les épaisseurs : un texte de 3,2 mm papier s'écrit `fontSize={3.2 / k}` en px plan, car il subit ensuite `scale(k)`.

### `fitScale` : l'échelle qui tient dans le cadre
```ts
export const fitScale = (ctx: Ctx, view: LayoutView, w: number, h: number) => {
  const b = contentBoxMm(ctx, view);
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  return SCALES.find(s => bw / s <= w - 6 && bh / s <= h - 6) ?? SCALES[SCALES.length - 1];
};
```
`SCALES` (`[20, 50, 75, 100, 125, 150, 200, 250, 500]`) est parcouru de la plus grande échelle (1:20) à la plus petite : on retient la première qui tient, avec 6 mm de marge. Pour comparer, `contentBoxMm` exprime le contenu en **mm réels** quelle que soit la vue (plan × 10, façade via `buildViewModel`). Le bouton « Auto » du panneau l'appelle.

---

## 4. `ViewportContent` mémoïsé

Dessiner un plan complet est coûteux. Pendant un glisser, la souris déclenche des dizaines de rendus par seconde ; il faut éviter de redessiner le contenu du cadre quand seule sa position change.

```ts
const ViewportContent = React.memo(
  ({ vp, w, h, ctx }) => { /* ... */ },
  (a, b) =>
    a.vp.view === b.vp.view && a.vp.scale === b.vp.scale && a.w === b.w && a.h === b.h &&
    a.ctx.entitiesByLevel === b.ctx.entitiesByLevel && a.ctx.levels === b.ctx.levels
);
```
(Extrait simplifié : le corps et les types des props sont omis.) Le comparateur personnalisé dit : « ne redessine que si la vue, l'échelle, la taille ou les données du plan ont changé ». Déplacer un cadre (`x`, `y`) ne change aucun de ces critères. On compare `entitiesByLevel` et `levels` par référence : valable car l'éditeur ne les remplace que lorsqu'ils changent réellement.

---

## 5. Cadre de vue = `svg` imbriqué

```tsx
<svg x={r.x} y={r.y} width={r.w} height={r.h}
     viewBox={`0 0 ${r.w} ${r.h}`} overflow="hidden"
     style={{ pointerEvents: 'none' }}>
  <ViewportContent vp={it} w={r.w} h={r.h} ctx={ctx} />
</svg>
```
- Un `<svg>` imbriqué crée un **viewport** : son `viewBox` redéfinit l'origine en haut à gauche du cadre, donc les coordonnées du contenu sont relatives au cadre.
- `overflow="hidden"` rogne ce qui dépasse, comme un vrai cadre de vue.
- `pointerEvents: 'none'` rend le contenu insensible à la souris ; un `<rect fill="transparent">` placé dessus sert de zone de saisie du cadre entier. Sans lui, on ne cliquerait que sur les traits.

Chaque élément est enveloppé dans un `<g data-item-id={it.id}>` : c'est l'étiquette que retrouve le gestionnaire de souris.

---

## 6. Interaction : du clic écran aux coordonnées papier

Le SVG de la planche est affiché à une taille CSS variable (zoom, `maxWidth`) mais son `viewBox` fait `W × H` mm. Un clic en pixels écran doit être converti en mm papier.

```ts
const toPaper = (e: { clientX: number; clientY: number }) => {
  const svg = svgRef.current!;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
};
```
`getScreenCTM()` donne la matrice qui transforme l'espace du SVG vers l'écran ; son **inverse** fait le chemin retour. Avantage : ça reste exact quel que soit le zoom ou le défilement, sans calcul manuel de ratio.

### Glisser et redimensionner avec un brouillon (`drag`)
Mettre à jour `sheets` à chaque `mousemove` forcerait le recalcul de toutes les vues et polluerait l'état partagé. On garde donc un **brouillon local** :

```ts
const [drag, setDrag] =
  useState<null | { id: string; rect: { x: number; y: number; w: number; h: number } }>(null);
const rectOf = (i: LayoutItem) =>
  (drag && drag.id === i.id ? drag.rect
   : i.kind === 'viewport' ? { x: i.x, y: i.y, w: i.w, h: i.h } : textBox(i));
```
- `mousedown` : on repère l'élément (`closest('[data-item-id]')`) et la poignée (`closest('[data-handle]')`) ; le mode est `'resize'` ou `'move'`.
- `mousemove` : `setDrag({ id, rect })` avec la position aimantée par `snap(v) = Math.round(v * 2) / 2` (pas de 0,5 mm).
- `mouseup` : si le déplacement dépasse 0,2 mm, on **valide** une seule fois par `patchItem(...)`, puis `setDrag(null)`.

Les écouteurs `mousemove` / `mouseup` sont posés sur `window` (et retirés au `mouseup`) pour continuer à suivre la souris même quand elle sort du SVG. Le rendu lit `rectOf`, donc le brouillon prime tant qu'il existe. Une taille minimale (`Math.max(20, …)` en largeur, `Math.max(15, …)` en hauteur) évite un cadre dégénéré.

---

## 7. Outil texte de la planche

Avec `activeTool === 'text'`, un clic sur la planche pose un `LayoutText` par défaut :

```ts
if (activeTool === 'text') {
  const t: LayoutText = { kind: 'text', id: newId('txt'), x: snap(p.x), y: snap(p.y),
                          text: 'Texte', fontSize: 5, bold: false, align: 'start' };
  addItem(t);
  setActiveTool('select');
  return;
}
```
L'outil retombe sur `select` après usage (outil « une fois »). Le texte s'édite ensuite par double-clic (`window.prompt`, géré dans `onDoubleClick`) ou dans le panneau latéral.

`textBox(t)` estime la zone cliquable : largeur ≈ nombre de caractères × `fontSize` × 0,58, hauteur = lignes × `fontSize` × 1,2, décalée selon `align`. C'est une approximation : on évite de mesurer le texte rendu (`getBBox`) qui n'est pas disponible avant le rendu.

**Suppression au clavier** : un `useEffect` écoute `keydown` sur `window` ; `Suppr` / `Retour` supprime `selectedId`, `Échap` désélectionne. Le test `tag === 'INPUT' || 'TEXTAREA' || 'SELECT'` empêche de supprimer un cadre en tapant dans un champ.

---

## 8. Cartouche et impression

Le cartouche est un `<g>` dessiné en mm papier, en bas à droite : projet, titre de planche, `format · date`, numéro, auteur. Les lignes de séparation sont des `line` à 50 % et 62 % de `cartW`. Une rose des vents est dessinée en haut à droite.

La sélection (rectangle bleu, poignée de redimensionnement) est dans `<g data-ui="1">` : cette marque identifie les **éléments d'interface à ne pas imprimer**.

```ts
const printSheet = () => {
  const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-ui]').forEach(n => n.remove());
  clone.removeAttribute('style');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><style>@page{size:${W}mm ${H}mm;margin:0}
    body{margin:0}svg{width:${W}mm;height:${H}mm;display:block}</style></head>
    <body>${clone.outerHTML}</body></html>`);
  /* ... close, focus, print ... */
};
```
(Extrait simplifié : titre du document, tests de nullité et `setTimeout` omis.) Pourquoi cloner ? On imprime le papier tel quel, sans zoom d'écran, sans barre d'outils, sans sélection. `@page { size: Wmm Hmm; margin: 0 }` impose le format de la planche, et `svg { width: Wmm }` garantit l'échelle 1:1 papier : 1 unité du `viewBox` = 1 mm imprimé.

---

## 9. État partagé et outils selon l'onglet (`CadEditor`)

Les planches sont **remontées** dans `CadEditor` pour survivre quand on change d'onglet (le composant `LayoutPanel` est démonté) :

```ts
const [sheets, setSheets] = useState<LayoutSheet[]>(() => [createSheet('Plan RDC', 'lvl-rdc', 50)]);
const [activeSheetId, setActiveSheetId] = useState(() => sheets[0].id);
```
Le panneau reçoit `sheets`, `setSheets`, `activeSheetId` en props. Les initialiseurs paresseux (`() => …`) évitent de recréer une planche à chaque rendu.

Quels outils sont disponibles ? La variable `activeRail` (`'plan' | 'views' | 'bim' | 'layout' | 'rendu' | 'config'`) en décide :

| Onglet | Outils actifs |
|---|---|
| Plan | tous |
| Mise en page (`layout`) | `select`, `text` |
| autres (Vues…) | `select` seulement |

Deux endroits appliquent la règle : un `useEffect([activeRail])` qui ramène l'outil actif sur `select` s'il n'est plus permis, et le calcul `enabled` de la barre d'outils, dont les boutons indisponibles sont `disabled` (grisés). Les boutons annuler/rétablir sont aussi désactivés hors du plan (`activeRail !== 'plan'`).

---

## 10. L'outil texte du plan

Sur le plan, un texte est une `CadEntity` de type `'text'`, sur le calque `cotations`. Les champs réutilisés : `label` (contenu), `fontSize` (hauteur en **px plan**, défaut 14), `x1, y1` (ancre), `x2, y2` (boîte estimée).

Création (dans le gestionnaire de clic du canvas) :
1. refus si le calque `cotations` est verrouillé ;
2. `window.prompt` pour saisir le contenu ;
3. construction de l'entité, `recordHistory()` (pour l'annulation), ajout, sélection, retour à `select`.

**Hit-test** (sélection au clic) : le rectangle englobant est estimé à partir de `fs` : largeur ≈ `max(longueur de ligne) × fs × 0,6`, hauteur ≈ `lignes × fs × 1,2`, avec une tolérance `pickboxTolerance`. Remarquez `py >= ent.y1 - fs` : en SVG, `y` d'un `<text>` est la **ligne de base**, donc la boîte monte de `fs` au-dessus.

**Rendu** : un `<text>` avec un `<tspan>` par ligne (`dy="1.2em"` pour les suivantes), un cadre pointillé quand le texte est sélectionné ou survolé.

**Inspecteur** : la section « Texte » de `PropertiesSidebar` affiche une `textarea` (liée à `label`) et un champ « Hauteur (px plan) » (borné par `Math.max(4, …)`), qui appellent `onUpdate`.

Pourquoi deux unités de texte (mm papier sur les planches, px plan sur le plan) ? Chaque espace a son échelle : sur le plan, un texte de 14 px mesure 140 mm réels et grossit avec le dessin ; sur la planche, 5 mm papier restent 5 mm quelle que soit l'échelle des vues.

---

## Formes et personnalisation de la planche

Une planche accepte aussi des **formes** (`LayoutShape`, `src/types.ts`) en plus des cadres de vue et des textes :

| Forme | Outil (onglet Mise en page) | Interaction |
|---|---|---|
| Rectangle / ellipse | `rect` (sous-outil rectangle / cercle) | glisser |
| Ligne brisée / polygone / courbe | `polyline` | clics ; double-clic ou Entrée pour finir ; clic sur le 1er point pour fermer ; Échap annule |
| Main levée | `polyline` (sous-outil main levée) | maintenir et dessiner (lissé) |

- Chaque forme porte son **style** : couleur et épaisseur du trait, pointillés, remplissage, opacité (+ coins arrondis pour le rectangle). Le panneau « Style des nouvelles formes » règle les valeurs par défaut.
- Le glissement d'un objet utilise un **brouillon** `drag.patch` fusionné à l'objet (`eff`) puis validé au `mouseup` ; les sommets d'une ligne brisée ont leurs propres poignées (`data-handle="v<i>"`).
- Ordre d'empilement (avancer / reculer), duplication et suppression sont dans l'en-tête du panneau de la forme.
- **Personnalisation** (`LayoutSheet`, champs optionnels avec valeur par défaut) : marge, épaisseur du cadre, cadre / cartouche / flèche Nord indépendants, couleur du papier, pas d'accrochage (0,5 à 10 mm) et grille visible (non imprimée). Les textes ont couleur, police et italique.
- Piège rencontré : le conteneur du plan écoute `onClick`/`onMouseDown`. Tant que `activeTool` valait `polyline` ou `rect`, les clics sur la planche déclenchaient aussi le tracé **du plan**. Les deux gestionnaires (`handleCanvasClick`, `handleCanvasMouseDown`) ignorent donc tout événement quand `activeRail !== 'plan'`.

## ⚠️ Pièges classiques
- **Confondre `k` et `f`** : `k = 10/scale` pour le plan (px), `f = 1/scale` pour les élévations (mm). Se tromper donne un dessin dix fois trop grand ou trop petit.
- **Oublier `getScreenCTM().inverse()`** : calculer avec `getBoundingClientRect` et un ratio fixe casse dès qu'on zoome.
- **Écrire dans `sheets` à chaque `mousemove`** : tout se redessine et l'historique se remplit ; utilisez un brouillon local.
- **Retirer `pointerEvents: 'none'`** du `svg` imbriqué : le contenu capte les clics et le cadre ne se sélectionne plus.
- **Imprimer sans retirer `[data-ui]`** : la poignée et le contour bleu sortent sur le papier.
- **Écouteurs `window` non retirés** : un `mouseup` oublié laisse la planche suivre la souris en permanence.

---

## ✍️ Exercices

### Exercice 1 — Règle d'échelle graphique
Ajoutez sous chaque cadre un trait gradué de 0 à 5 m, à l'échelle du cadre.

<details>
<summary>Indices</summary>
- 5 m = 5000 mm réels = `5000 / it.scale` mm papier.
- Dessinez-le dans le `<g>` du cadre (§5), hors du `svg` imbriqué pour ne pas être rogné ; positionnez-le à `r.y + r.h + 9`.
- Aucun changement de type n'est nécessaire : le cadre connaît déjà `scale`.
</details>

<details>
<summary>Solution succincte</summary>
Dans le `map` des `items`, après le titre : `const L = 5000 / it.scale;` puis une `<line x1={r.x} x2={r.x + L} y1={yb} y2={yb} />` et cinq graduations tous les `L / 5`, avec le texte `0`, `1`, … `5 m`. Ajouter éventuellement `showScaleBar: boolean` à `LayoutViewport` pour le rendre optionnel.
</details>

### Exercice 2 — Export PDF multi-planches
Imprimer toutes les planches en un seul document.

<details>
<summary>Indices</summary>
- `printSheet` n'imprime que la planche affichée (`svgRef`). Il faut un SVG par planche.
- En CSS, `page-break-after: always` sépare les pages, mais `@page` ne gère qu'une taille par document : fixez-la sur le plus grand format ou groupez par format.
- Rendez chaque planche hors écran avec `ReactDOMServer.renderToStaticMarkup`, ou factorisez le rendu d'une planche dans un composant `SheetSvg`.
</details>

<details>
<summary>Solution succincte</summary>
Extraire le `<svg>` de la planche dans un composant `SheetSvg({ sheet })`. Pour chaque planche de `sheets`, générer son balisage, encapsuler dans un `<div style="page-break-after:always">`, concaténer dans une même fenêtre et appeler `print()`. Choisir « Enregistrer en PDF » dans la boîte d'impression du navigateur.
</details>

### Exercice 3 — Alignement du texte du plan
Ajouter un alignement (gauche / centré / droite) aux textes du plan comme sur les planches.

<details>
<summary>Indice</summary>
Reprenez `align` de `LayoutText` : l'attribut SVG `textAnchor` et le décalage de `textBox`.
</details>

<details>
<summary>Solution succincte</summary>
Ajouter `textAlign?: 'start' | 'middle' | 'end'` à `CadEntity` ; l'utiliser dans le `<text textAnchor=…>` du rendu, décaler la boîte du hit-test comme `textBox`, et exposer trois boutons dans la section « Texte » de `PropertiesSidebar`.
</details>

---

## 📌 À retenir
- Une planche stocke des descriptions de vues en **mm papier** ; le contenu est recalculé à chaque rendu.
- Échelle 1:N : plan `k = 10/scale`, élévation `f = 1/scale`, centrage par boîte englobante, `fitScale` choisit la plus grande échelle qui tient.
- Conversion écran → papier : `getScreenCTM().inverse()` ; interaction par brouillon local validé au `mouseup`.
- Impression : clone du SVG sans `[data-ui]` et `@page` aux dimensions de la planche.
- Les planches vivent dans `CadEditor` ; `activeRail` détermine les outils actifs ; le texte a deux mondes (mm papier et px plan).

---

⬅️ [Chapitre précédent](./chapitre_14_facades_et_coupes.md) | [Sommaire](./README.md)

Fin du cours : pour aller plus loin, voir le [Guide d'extension de l'application](./app/README.md).
