# Chapitre 02 — Modélisation des données CAO en TypeScript

## 🎯 Objectifs
- Distinguer `interface`, `type` et unions de littéraux, et savoir lequel choisir.
- Lire `src/types.ts`, le « contrat » commun à tout l'éditeur.
- Comprendre pourquoi toutes les formes dessinées partagent une seule interface `CadEntity`.
- Découvrir les types récents : niveaux (`CadLevel`), ligne de référence des murs (`refLine`), texte, planches de mise en page.
- Appliquer la règle d'échelle **1 px = 10 mm** et relier les types aux règles métier (calques, ouvertures encastrées).

## 📋 Prérequis
- [Chapitre 01](./chapitre_01_fondations_react_ts_vite.md) : savoir lancer `npm run lint` et lire une `interface`.
- Notion d'objet JavaScript (`{ clé: valeur }`) et de tableau.

## 📁 Fichiers concernés
- [src/types.ts](../types.ts) — tous les types partagés (263 lignes environ)
- [src/agent.ts](../agent.ts) — consomme `CadEntity` pour produire des audits
- [src/constants/materials.ts](../constants/materials.ts) — tableau typé `MaterialDefinition[]`
- [src/components/CadEditor.tsx](../components/CadEditor.tsx) — déclare l'état `entities`, `levels`, `sheets`

---

## 1. Pourquoi un fichier de types central ?

Un éditeur de plans manipule des dizaines de notions : outils, calques, murs, portes, niveaux, planches. Si chaque composant inventait sa propre forme de « mur », ils finiraient par se contredire. On écrit donc **une seule fois** la définition dans `src/types.ts`, et tous les fichiers l'importent :

```ts
import { CadEntity } from './types.ts';
```

Si on renomme ou ajoute un champ, TypeScript signale immédiatement tous les endroits à corriger (`npm run lint`).

## 2. `interface`, `type` et unions de littéraux

| Outil | Sert à | Exemple réel dans `types.ts` |
|---|---|---|
| `interface` | décrire la forme d'un objet | `CadLayer`, `CadEntity`, `CadLevel` |
| `type` + union `'a' \| 'b'` | une liste **fermée** de valeurs | `CadTool`, `SheetFormat` |
| union discriminée | plusieurs formes, repérées par un champ | `LayoutView`, `LayoutItem` |

### Union de littéraux : interdire les fautes de frappe
Version **tronquée** de `CadTool` (le vrai type contient aussi `'cut'`, `'arc'`, `'circle'`, etc.) :

```ts
export type CadTool =
  | 'select' | 'pan' | 'wall' | 'partition' | 'door' | 'window'
  | 'dim' | 'hatch' | 'room' | 'polyline' | 'rect' | 'circle'
  | 'arc' | 'cut' | 'measure' | 'text';
```

Avec `useState<CadTool>('select')`, écrire `setActiveTool('wal')` est une erreur de compilation. L'outil `'text'` est l'un des ajouts récents.

### Sous-outils
```ts
export type WallSubTool = 'single' | 'continuous' | 'rect';       // droit, chaîne, 4 murs
export type ShapeSubTool = 'rect' | 'circle';
export type PolylineSubTool = 'straight' | 'freehand' | 'curve';
```

**Pourquoi ce choix ?** Un seul outil « mur » existe pour l'utilisateur, mais trois façons de le tracer. Séparer outil et sous-outil évite de multiplier les valeurs de `CadTool`.

## 3. Calques : `CadLayer`

```ts
export interface CadLayer {
  id: string;
  name: string;
  category: 'structures' | 'cloisons' | 'mobilier' | 'ouvertures' | 'cotations';
  color: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  entityCount: number;
  lineweight?: string;
  description?: string;
}
```

Les cinq catégories correspondent aux calques normalisés du projet. Un champ suivi de `?` est **optionnel** (voir piège 2).

## 4. L'entité unique : `CadEntity`

Plutôt qu'une interface par forme (mur, porte, cercle…), le projet utilise **une seule** interface large dont de nombreux champs sont optionnels. Version **simplifiée** (les groupes les plus importants) :

```ts
export interface CadEntity {
  id: string;
  name: string;
  type: 'wall' | 'partition' | 'door' | 'window' | 'dim' | 'room' | 'furniture'
      | 'rect' | 'circle' | 'line' | 'polygon' | 'polyline' | 'curve' | 'text';
  layerId: string;

  // Géométrie de base (px plan)
  x1: number; y1: number; x2: number; y2: number;
  radius?: number;
  curvePoint?: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
  isClosed?: boolean;

  // Mur / cloison
  thickness?: number;                       // mm
  refLine?: 'left' | 'center' | 'right';    // ligne de référence, 'center' par défaut
  height?: number;                          // mm

  // Texte
  fontSize?: number;                        // hauteur en px plan, pour type 'text'

  // Ouvertures encastrées
  hostWallId?: string;
  openingWidth?: number;                    // mm
  wallPositionRatio?: number;               // 0..1 le long du mur hôte
  doorSwing?: 'left' | 'right';
  flipSwing?: boolean;
  sillHeight?: number;                      // allège, mm
  openingType?: 'door_single' | 'door_double' | 'door_pocket'
              | 'window_casement' | 'window_sliding' | 'window_fixed';
  // … hachures, cotation, matière, etc.
}
```

**Pourquoi ce choix ?** La boucle de rendu, la sélection, l'annulation (Ctrl+Z) et l'export manipulent tous des listes de `CadEntity`. Une seule forme rend ces fonctions simples (`entities.filter(e => e.type === 'wall')`). Le prix à payer : il faut tester qu'un champ optionnel existe avant de s'en servir. Ainsi `agent.ts` écrit `d.openingWidth || Math.hypot(...) * 10` pour retomber sur la longueur réelle.

### Ce que veut dire `x1, y1, x2, y2` selon le type
| Type | Signification des coordonnées |
|---|---|
| `wall`, `partition` | **axe** du mur : début → fin (voir chapitre 03) |
| `door`, `window` | extrémités de la baie, calculées sur le mur hôte |
| `rect`, `room` | deux coins opposés |
| `circle` | centre et `radius` |
| `text` | position d'ancrage, taille via `fontSize` |

## 5. Les murs et la ligne de référence (`refLine`)

Quand on trace un mur, la ligne cliquée n'est pas forcément son milieu : un architecte peut vouloir tracer le **nu** (la face) d'un mur. `refLine` mémorise le choix `'left' | 'center' | 'right'`, relatif au sens du tracé. Côté réglages, `CadSettings.wallJustif` utilise des libellés français (`'Nu Gauche' | 'Axe' | 'Nu Droite'`). Le module `wallGeometry.ts` fait la conversion avec `justifToRef`, que nous verrons au chapitre 03.

Comme `x1..y2` stockent toujours l'axe, le reste du code (ouvertures, cotes, vues) n'a pas besoin de connaître la ligne de référence.

## 6. Niveaux : `CadLevel`

```ts
export interface CadLevel {
  id: string;
  name: string;       // "RDC", "R+1"
  elevation: number;  // altitude du plancher fini, mm (RDC = 0)
  height: number;     // hauteur sous plafond / hauteur de mur par défaut, mm
}
```

Dans `CadEditor.tsx`, l'état initial est `[{ id: 'lvl-rdc', name: 'RDC', elevation: 0, height: 2800 }]`. Notez que `CadEntity` ne contient **pas** de `levelId` : les entités du niveau actif sont dans l'état `entities`, celles des autres niveaux dans `otherLevels: Record<string, CadEntity[]>`, indexées par l'id du niveau. L'altitude (`elevation`) sert ensuite aux façades et coupes (chapitre 03, section 8).

## 7. Mise en page : planches et vues

Les planches imprimables (`LayoutSheet`) utilisent des **unions discriminées** : un champ (`type` ou `kind`) dit quelle forme on a sous les yeux.

```ts
export type LayoutView =
  | { type: 'plan'; levelId: string }
  | { type: 'elevation'; dir: 'S' | 'N' | 'E' | 'O' }
  | { type: 'section'; id: 'AA' | 'BB'; pos: number; flip: boolean };

export type LayoutItem = LayoutViewport | LayoutText;  // kind: 'viewport' | 'text'
```

*(`LayoutViewport` et `LayoutText` sont des interfaces complètes dans `types.ts` : position `x, y, w, h` en **mm papier**, échelle `scale` = dénominateur de `1:scale`.)*

Grâce à la discrimination, TypeScript sait, après un `if (view.type === 'plan')`, que `view.levelId` existe :

```ts
function describe(view: LayoutView): string {
  if (view.type === 'plan') return `Plan du niveau ${view.levelId}`;
  if (view.type === 'elevation') return `Façade ${view.dir}`;
  return `Coupe ${view.id}`;               // ici, TypeScript sait que c'est 'section'
}
```
*(exemple pédagogique, absent du dépôt)*

Attention aux unités : **px plan** (1 px = 10 mm réels) pour les entités, **mm papier** pour les planches. Ne jamais les mélanger.

## 8. Le système d'unités

```
1 px  = 10 mm  = 0,01 m
10 px = 100 mm
100 px = 1 000 mm = 1 m
```

| Grandeur | Stockée en | Conversion |
|---|---|---|
| coordonnées `x1…y2`, `radius`, `fontSize` | px plan | × 10 → mm |
| `thickness`, `height`, `openingWidth`, `sillHeight`, `elevation` | **mm** | ÷ 10 → px |
| `area` | m² | — |

Exemple : un mur porteur de 200 mm d'épaisseur a une demi-épaisseur de 200 / 20 = 10 px (c'est exactement `thickness / 20` dans `wallGeometry.ts`).

## 9. Matières et agent : deux consommateurs de ces types

- `src/constants/materials.ts` exporte `ARCHITECTURAL_MATERIALS: MaterialDefinition[]` : le compilateur vérifie que chaque matière a bien ses champs (`index`, `lambda`, `carbonIndex`…).
- `src/agent.ts` définit `analyzePlanMetrics(entities: CadEntity[])` qui renvoie un `AgentMetricReport` (longueurs de murs, portes PMR ≥ 900 mm, ratio de vitrage). C'est un calcul par règles, sans appel à un modèle externe.

## ⚠️ Pièges classiques
- **Confondre px et mm** : `thickness: 200` est en mm, mais `x1: 200` est en px (donc 2 m !).
- **Utiliser un champ optionnel sans le tester** : `e.thickness * 2` est `NaN` si `thickness` vaut `undefined`. Écrire `(e.thickness ?? 200)`. Rappel : sans `strict`, TypeScript ne vous préviendra pas.
- **`type` ou `interface` ?** Pour un objet, préférez `interface`. Pour une liste de valeurs, utilisez `type`.
- **Types « fantômes »** : `types.ts` contient aussi `CadWall`, `CadRoom`, `CadDoor`, `CadWindow`, `CadDimension`, anciens types spécialisés. Le moteur actuel travaille avec `CadEntity` ; ne les utilisez pas pour de nouvelles fonctionnalités.
- **Oublier un cas dans une union** : ajouter `'text'` à `CadTool` oblige à gérer ce nouvel outil partout où l'on énumère les outils.

## ✍️ Exercices

**Exercice 1 — Lire un type (facile).** Combien de valeurs `CadEntity['type']` accepte-t-il ? Lesquelles concernent des murs ?
*Indice : relisez la section 4 ou ouvrez `src/types.ts`.*

<details><summary>Solution</summary>

14 valeurs : `wall`, `partition`, `door`, `window`, `dim`, `room`, `furniture`, `rect`, `circle`, `line`, `polygon`, `polyline`, `curve`, `text`. Les murs : `wall` (porteur) et `partition` (cloison).
</details>

**Exercice 2 — Convertir (moyen).** Une cloison placostil de 72 mm part de (100, 50) à (400, 50). Donnez sa longueur en mm, sa demi-épaisseur en px, et écrivez l'objet `CadEntity` minimal (les champs obligatoires uniquement).
*Indice : champs obligatoires = ceux sans `?`.*

<details><summary>Solution</summary>

Longueur : 300 px = 3 000 mm. Demi-épaisseur : 72 / 20 = 3,6 px.
```ts
const p: CadEntity = {
  id: 'p1', name: 'Cloison', type: 'partition', layerId: 'cloisons',
  x1: 100, y1: 50, x2: 400, y2: 50, thickness: 72,
};
```
(`thickness` n'est pas obligatoire mais est ajouté ici ; sans lui, le moteur suppose 72 mm pour une cloison.)
</details>

**Exercice 3 — Union discriminée (avancé).** Écrivez `viewTitle(item: LayoutItem): string` qui renvoie `item.title` pour un cadre de vue et `item.text` pour un texte.
*Indice : testez `item.kind`.*

<details><summary>Solution</summary>

```ts
const viewTitle = (item: LayoutItem) => (item.kind === 'viewport' ? item.title : item.text);
```
</details>

## 📌 À retenir
- `src/types.ts` est la source unique de vérité : on le modifie en premier, `npm run lint` montre ensuite les conséquences.
- Les unions de littéraux (`CadTool`, `SheetFormat`) interdisent les valeurs invalides ; les unions discriminées (`LayoutView`, `LayoutItem`) permettent de traiter des formes différentes sans erreur.
- `CadEntity` est une entité unique à champs optionnels : toujours tester ou donner une valeur par défaut.
- Coordonnées en px plan, dimensions physiques en mm, planches en mm papier : **1 px = 10 mm**.
- Les types récents : `CadLevel`, `refLine`, `type: 'text'` + `fontSize`, `CadTool 'text'`, `LayoutSheet`/`LayoutViewport`/`LayoutText`/`LayoutView`.

---
⬅️ [Chapitre précédent](./chapitre_01_fondations_react_ts_vite.md) | [Sommaire](./README.md) | [Chapitre suivant ➡️](./chapitre_03_moteur_geometrique_mathematiques.md)
