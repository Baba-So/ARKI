# 03 — Créer un type d'entité

Une **entité** est un objet persistant du plan (`CadEntity` dans `src/types.ts`) : mur, porte, pièce, cote, texte…
Créer un type, c'est lui donner **des données, un rendu, une façon d'être sélectionné, déplacé, listé et imprimé**.

Exemple fil rouge : le type **`'text'`** (annotation sur le plan), réellement dans le code.

---

## ✅ Check-list complète

| # | À faire | Fichier | Recherche |
|---|---|---|---|
| 1 | Ajouter la valeur à l'union `type` + champs éventuels | `types.ts` | `export interface CadEntity` |
| 2 | **Rendu** dans le plan | `CadEditor.tsx` | `3A. TEXTES` / `3B. FORMES` (blocs numérotés) |
| 3 | **Sélection** par clic (hit-test) | `CadEditor.tsx` | `getEntityAtPoint` |
| 4 | **Déplacement** (par défaut automatique si vous utilisez `x1,y1,x2,y2`) | `CadEditor.tsx` | `deltaX` |
| 5 | **Poignées** spécifiques *(facultatif)* | `CadEditor.tsx` | `handleGripMouseDown` |
| 6 | **Inspecteur** : afficher/éditer ses attributs | `PropertiesSidebar.tsx` | `entity.type ===` |
| 7 | **Rendu papier** (mise en page) | `LayoutPanel.tsx` | `renderEntity` dans `PlanDrawing` |
| 8 | **Vues** (façades/coupes) si pertinent | `viewsGeometry.ts` | `buildStrips` |
| 9 | **Création** (outil ou bloc) | voir [02](./02_creer_un_outil.md) | — |
| 10 | **Métriques / copilote** si pertinent | `agent.ts` | `analyzePlanMetrics` |

---

## Étape 1 — Les données

```ts
// src/types.ts
export interface CadEntity {
  id: string;
  name: string;
  type: 'wall' | 'partition' | … | 'curve' | 'text';   // ← union discriminée : on ajoute 'text'
  layerId: string;
  x1: number; y1: number; x2: number; y2: number;      // boîte / extrémités (px plan)
  fontSize?: number;                                   // ← champ propre au texte (px plan)
  label?: string;                                      // ← le contenu du texte
  …
}
```

**Conventions de modélisation** (à respecter pour que le déplacement et l'export marchent sans code supplémentaire) :
- Toujours renseigner `x1,y1,x2,y2` (même si l'objet est un point : `x2=x1`, `y2=y1`) → le déplacement générique décale ces 4 nombres.
- Les attributs optionnels portent un **`?`** et une valeur par défaut au rendu (`ent.fontSize || 14`).
- Les unités : positions en **px plan** (1 px = 10 mm) ; dimensions physiques (épaisseur, hauteur) en **mm**.

## Étape 2 — Le rendu

Le plan SVG est une suite de blocs numérotés dans `CadEditor.tsx`, **dans l'ordre de superposition** (le dernier est dessiné au-dessus). Ajoutez un bloc au bon endroit :

```tsx
{/* 3A. TEXTES / ANNOTATIONS */}
{entities.filter(e => e.type === 'text').map(ent => {
  const l = getLayer(ent.layerId);
  if (!l.visible) return null;                                    // ① calque masqué
  const isSelected = selectedIds.includes(ent.id);
  return (
    <g key={ent.id}
       data-entity-id={ent.id}                                    // ② identifie l'entité (sélection/survol)
       onClick={(e) => handleEntityClick(e, ent)}                 // ③ clic = sélection
       className="cursor-pointer"
       opacity={l.locked ? 0.6 : 1}>                              // ④ calque verrouillé
      <text x={ent.x1} y={ent.y1} fontSize={ent.fontSize || 14} fill={ent.color || l.color}>
        {(ent.label || '').split('\n').map((ln, i) =>
          <tspan key={i} x={ent.x1} dy={i === 0 ? 0 : '1.2em'}>{ln}</tspan>)}
      </text>
    </g>
  );
})}
```

Réflexes : ① `layer.visible` ② `data-entity-id` ③ `handleEntityClick` ④ opacité si verrouillé ⑤ couleur issue de `ent.color || l.color` ⑥ aspect « sélectionné/survolé » (cadre pointillé).

## Étape 3 — La sélection (hit-test)

Le clic « au curseur » passe par `getEntityAtPoint(px, py, tolérance)`, qui parcourt les entités par **familles de géométrie**. Ajoutez la vôtre :

```ts
if (ent.type === 'text') {
  const lines = (ent.label || '').split('\n');
  const fs = ent.fontSize || 14;
  const tw = Math.max(...lines.map(l => l.length), 1) * fs * 0.6;     // largeur estimée
  if (px >= ent.x1 - tol && px <= ent.x1 + tw + tol &&
      py >= ent.y1 - fs - tol && py <= ent.y1 + (lines.length - 1) * fs * 1.2 + tol) return ent;
}
```
Familles déjà gérées : segment (`wall`, `partition`, `line`), boîte (`furniture`, `rect`), cercle, courbe, polygone. Si votre objet se rapproche d'une famille, **ajoutez simplement son type à la condition existante**.

## Étape 4 — Déplacement et poignées
- **Déplacement** : la sélection est déplacée en décalant `x1,y1,x2,y2` (et `points`/`curvePoint` s'ils existent). Rien à faire si vous respectez la convention de l'étape 1.
- **Poignées** (étirer, pivoter) : voir `handleGripMouseDown` et le bloc `interactive-grips-*` ; copiez celui du type le plus proche (`furniture` pour une boîte).

## Étape 6 — L'inspecteur

```tsx
{entity.type === 'text' && (
  <div className="…">
    <textarea value={entity.label || ''} onChange={e => onUpdate({ label: e.target.value })} />
    <input type="number" value={entity.fontSize || 14}
           onChange={e => onUpdate({ fontSize: Math.max(4, Number(e.target.value)) })} />
  </div>
)}
```
`onUpdate(champs)` fusionne les champs dans l'entité sélectionnée (voir `handleUpdateSelectedFields`). Détails : [06](./06_inspecteur_et_panneaux.md).

## Étape 7 — La mise en page
`PlanDrawing` (dans `LayoutPanel.tsx`) redessine les entités **en blanc et noir, à l'échelle**. Ajoutez un `case 'text':` dans son `renderEntity` ; sinon l'entité n'apparaîtra pas sur les planches. Toute dimension (épaisseur de trait, taille de police fixe) se divise par `k` (mm papier par px plan) pour rester constante **sur le papier**.

## 🧪 Test manuel
1. Créer l'entité → elle apparaît. 2. La sélectionner par clic. 3. La déplacer. 4. Ctrl+Z / Ctrl+Y. 5. Masquer/verrouiller son calque. 6. Changer de niveau et revenir. 7. L'ouvrir dans Mise en page (cadre de plan). 8. `npm run lint`.

## ⚠️ Pièges classiques
- **Union non exhaustive** : un `switch (e.type)` sans `default` peut ignorer silencieusement votre type.
- **Oublier le calque** : toute entité a un `layerId` existant (sinon `getLayer` renvoie le 1er calque).
- **Clés React** : `key={ent.id}` obligatoire dans les `.map`.
- **Stocker des unités mélangées** (mm et px dans le même champ).
- **Entité hébergée** (comme une porte) : si elle dépend d'une autre (`hostWallId`), il faut aussi la **dupliquer/remapper** (voir duplication de niveau) et la **déplacer avec l'hôte**.

## ✍️ Exercice
Créez le type **`'north'`** (flèche Nord) : un symbole de 40 px de rayon, déplaçable, sans inspecteur. Vérifiez qu'il n'est pas pris en compte dans la boîte englobante d'un cadre de plan (voir `planBBox` qui ignore déjà `dim` et `text`).

⬅️ [02 — Créer un outil](./02_creer_un_outil.md) | [Index](./README.md) | [04 — Créer un paramètre ➡️](./04_creer_un_parametre.md)
