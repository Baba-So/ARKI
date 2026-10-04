# 07 — Calques, matériaux et bibliothèque

Trois « catalogues » de données de référence : **calques** (organisation), **matériaux** (caractéristiques), **blocs** (objets prêts à poser).

---

## 1. Ajouter un calque

### Le modèle
```ts
// src/types.ts
export interface CadLayer {
  id: string;
  name: string;
  category: 'structures' | 'cloisons' | 'mobilier' | 'ouvertures' | 'cotations';
  color: string;          // #rrggbb
  visible: boolean;
  locked: boolean;
  opacity: number;
  entityCount: number;
  lineweight?: string;    // ex. '0.50mm'
  description?: string;
}
```
Les **cinq calques normalisés** du projet : `structures` (#38bdf8), `cloisons` (#4edea3), `ouvertures` (#fbbf24), `mobilier` (#a78bfa), `cotations` (#f472b6).

### Deux façons d'en ajouter
| Besoin | Méthode |
|---|---|
| Calque **utilisateur** (au runtime) | `handleAddLayer(name, category, color)` dans `CadEditor` — appelé par le formulaire de `LayerManager` (`onAddLayer`) |
| Calque **par défaut** du projet | ajouter un objet dans `useState<CadLayer[]>([...])` (cherchez `const [layers`) |

### Ajouter une **catégorie** de calque
1. Étendre l'union `category` dans `types.ts`.
2. `LayerManager.tsx` : l'ajouter à la liste déroulante `newLayerCategory`.
3. Décider quels **outils** écrivent dessus (`layerId: '…'` dans `handleCanvasClick`).

### Règles d'usage dans le code
- Toute entité porte un `layerId`. Pour la lire : `getLayer(ent.layerId)` (renvoie le 1er calque si l'id est inconnu).
- **Visible** : un calque masqué n'est ni dessiné ni sélectionné (`if (!l.visible) return null` dans chaque bloc de rendu ; `getEntityAtPoint` ignore `!visible || locked`).
- **Verrouillé** : lecture seule — rendu atténué, non sélectionnable, et les outils refusent d'écrire dessus (`if (l.locked) { alert(...); return; }`).
- Les **Vues** et la **Mise en page** reçoivent `isLayerVisible(layerId)` : un calque masqué disparaît aussi des façades, coupes et planches.

---

## 2. Ajouter un matériau

```ts
// src/constants/materials.ts
export const ARCHITECTURAL_MATERIALS: MaterialDefinition[] = [
  {
    index: 'MAT-01',               // identifiant stable référencé par les entités
    name: 'Béton Armé Banché C25/30',
    category: 'structure',         // 'structure' | 'cloisons' | 'menuiserie' | 'finition' | 'isolation'
    density: '2 400 kg/m³',
    lambda: '1.75 W/m.K',          // conductivité thermique
    acoustic: 'Rw = 58 dB',
    carbonIndex: 'B',
    color: '#4cd7f6',
    description: '…',
  },
  …
];
```
Étapes :
1. Ajouter l'objet avec un **nouvel `index` unique** (`MAT-09`…). Ne **réutilisez ni ne renumérotez** les index existants : les entités les stockent (`materialIndex`).
2. L'utiliser à la création : `materialIndex: 'MAT-09'`.
3. Le proposer dans l'inspecteur (liste déroulante, voir exercice du [guide 06](./06_inspecteur_et_panneaux.md)).

---

## 3. Ajouter un bloc à la bibliothèque

```ts
// src/components/CadLibraryPanel.tsx
export const PREDEFINED_CAD_BLOCKS: CadBlock[] = [
  {
    id: 'block-table-dining-6p',       // unique
    name: 'Table Repas 6 Places',
    category: 'sejour',                // 'sejour'|'cuisine'|'chambre'|'sanitaire'|'menuiserie'|'exterieur'
    widthMm: 1800, heightMm: 900,      // dimensions réelles (mm)
    defaultLayer: 'mobilier',          // calque cible
    icon: 'table_restaurant',          // icône Material Symbols
    description: '…',
    renderType: 'table',               // forme de la vignette dans la bibliothèque
  },
  …
];
```

### Ce qui se passe à l'insertion (`handleInsertBlock`)
- **Mobilier** (`category !== 'menuiserie'`) : création d'une entité `type: 'furniture'`, rectangle de `widthMm/10 × heightMm/10` px centré sur le point de dépôt, `blockId` mémorisé, matériau `MAT-07`.
- **Menuiserie** (`category === 'menuiserie'` ou `renderType` `door`/`window`) : passage **obligatoire** par `findWallSnap` → l'ouverture est encastrée dans le mur le plus proche (règle métier fondamentale).
- Deux déclencheurs : clic sur le bouton d'insertion, ou **glisser-déposer** sur le canevas (`handleCanvasDrop`, données `application/json`).

> `renderType` dessine la **vignette** du panneau. Sur le plan, un meuble est un rectangle étiqueté (`furniture`). Pour un dessin détaillé du meuble sur le plan, ajoutez un rendu par `blockId`/`renderType` dans le bloc `D. BLOCS MOBILIERS` de `CadEditor.tsx`.

### ✅ Check-list d'un nouveau bloc
1. Entrée dans `PREDEFINED_CAD_BLOCKS` (dimensions **en mm**).
2. Catégorie existante (sinon l'ajouter au type `CadBlock['category']` **et** aux filtres du panneau).
3. Si c'est une menuiserie : vérifier qu'elle s'encastre bien (largeur ≤ longueur de mur).
4. Tester : clic, glisser-déposer, Ctrl+Z, changement de niveau.

---

## ⚠️ Pièges classiques
- **Renuméroter des matériaux** → les anciens objets pointent vers le mauvais matériau.
- **Bloc sans `defaultLayer` valide** → l'objet atterrit sur un calque inexistant.
- **Dimensions en px** au lieu de mm dans `CadBlock` (le code divise par 10 lui-même).
- **Ajouter un calque sans prévoir qui y écrit** → calque vide inutile.

## ✍️ Exercice
Ajoutez le bloc **« Lit double 160×200 »** (catégorie `chambre`, calque `mobilier`) et un matériau **« Parquet chêne massif »** (`MAT-09`, catégorie `finition`) ; faites-le utiliser par ce bloc à l'insertion.
<details><summary>Indice</summary>
Dans `handleInsertBlock`, remplacez `materialIndex: 'MAT-07'` par `block.category === 'chambre' ? 'MAT-09' : 'MAT-07'`, ou ajoutez un champ optionnel `materialIndex?` à `CadBlock` (plus propre).
</details>

⬅️ [06 — Inspecteur et panneaux](./06_inspecteur_et_panneaux.md) | [Index](./README.md) | [08 — Commandes, raccourcis, exports ➡️](./08_commandes_raccourcis_exports.md)
