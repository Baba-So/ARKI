# Chapitre 07 — Outils & Sous-Outils Paramétriques en React

Dans ce chapitre, nous allons concevoir l'architecture permettant à l'utilisateur de jongler entre les différents outils et leurs sous-outils paramétriques.

---

## 1. Modélisation des États d'Outils en React

Plutôt que d'éparpiller des variables booléennes complexes, nous utilisons des états typés avec nos unions littérales définies au Chapitre 02 :

```tsx
// Outil principal actif
const [activeTool, setActiveTool] = useState<CadTool>('wall');

// Sous-outils spécifiques
const [wallSubTool, setWallSubTool] = useState<WallSubTool>('single');
const [shapeSubTool, setShapeSubTool] = useState<ShapeSubTool>('rect');
const [polylineSubTool, setPolylineSubTool] = useState<PolylineSubTool>('straight');

// États temporaires de tracé
const [polyPoints, setPolyPoints] = useState<Array<{ x: number; y: number }>>([]);
const [curveStep, setCurveStep] = useState<0 | 1 | 2>(0);
const [curveP1, setCurveP1] = useState<{ x: number; y: number } | null>(null);
const [curveP2, setCurveP2] = useState<{ x: number; y: number } | null>(null);
```

---

## 2. Implémentation des 3 Variantes de Murs

### 2.1 Mur Droit (`single`)
C'est le tracé standard :
1. Clic 1 : fixe $P_1$.
2. Clic 2 : fixe $P_2$, ajoute le mur et réinitialise `draftStart = null`.

### 2.2 Mur en Continu (`continuous`)
Chaque clic valide le pan précédent et démarre immédiatement le pan suivant depuis le même point :

```typescript
// Clic 2 en mode continu :
const newWall = createWallEntity(draftStart, coords, wallThickness);
setEntities(prev => [...prev, newWall]);

// On ne remet pas à null : P2 devient le nouveau P1 !
setDraftStart(coords);
```
La chaîne se termine lorsque l'utilisateur appuie sur **`Entrée`** ou **`Échap`**.

### 2.3 Mur en 4 Murs Rectangle (`rect`)
En seulement deux clics (deux coins opposés), cette fonction génère automatiquement les 4 pans de murs connectés d'équerre d'une pièce :

```typescript
const handleCreate4WallsRect = (c1: { x: number; y: number }, c2: { x: number; y: number }, thickness: number) => {
  const minX = Math.min(c1.x, c2.x);
  const maxX = Math.max(c1.x, c2.x);
  const minY = Math.min(c1.y, c2.y);
  const maxY = Math.max(c1.y, c2.y);

  // 4 murs assemblés : Nord, Est, Sud, Ouest
  const wallNorth: CadEntity = { id: `wall-${Date.now()}-N`, type: 'wall', layerId: 'structures', x1: minX, y1: minY, x2: maxX, y2: minY, thickness };
  const wallEast:  CadEntity = { id: `wall-${Date.now()}-E`, type: 'wall', layerId: 'structures', x1: maxX, y1: minY, x2: maxX, y2: maxY, thickness };
  const wallSouth: CadEntity = { id: `wall-${Date.now()}-S`, type: 'wall', layerId: 'structures', x1: maxX, y1: maxY, x2: minX, y2: maxY, thickness };
  const wallWest:  CadEntity = { id: `wall-${Date.now()}-W`, type: 'wall', layerId: 'structures', x1: minX, y1: maxY, x2: minX, y2: minY, thickness };

  setEntities(prev => [...prev, wallNorth, wallEast, wallSouth, wallWest]);
  setDraftStart(null);
};
```

---

## 3. Implémentation des Formes (Rectangle vs Cercle)

Dans le sous-outil **Cercle**, le premier clic positionne le centre $(c_x, c_y)$ et le deuxième clic définit le rayon $R$ :

```typescript
const handleCircleClick = (coords: { x: number; y: number }) => {
  if (!draftStart) {
    setDraftStart(coords); // Centre fixé
  } else {
    const radiusPx = Math.hypot(coords.x - draftStart.x, coords.y - draftStart.y);
    const radiusMm = Math.round(radiusPx * 10);
    const areaM2 = Math.round(Math.PI * Math.pow(radiusMm / 1000, 2) * 100) / 100;

    const newCircle: CadEntity = {
      id: `circle-${Date.now()}`,
      name: `Cercle ⌀=${radiusMm * 2}mm`,
      type: 'circle',
      layerId: 'structures',
      x1: draftStart.x, // Centre X
      y1: draftStart.y, // Centre Y
      x2: coords.x,
      y2: coords.y,
      radius: radiusPx,
      area: areaM2,
    };

    setEntities(prev => [...prev, newCircle]);
    setDraftStart(null);
  }
};
```

---

## 4. Implémentation du Tracé Libre (Main Levée) et Courbe Bézier

### 4.1 Tracé Libre (`freehand`)
L'utilisateur maintient le clic gauche enfoncé et glisse la souris :
* `onMouseDown` : `setIsDrawingFreehand(true); setFreehandPoints([coords]);`
* `onMouseMove` : si la distance avec le dernier point est $\ge 4 \text{ px}$, on ajoute le point à la liste.
* `onMouseUp` : si plus de 3 points sont enregistrés, on convertit la liste en une `CadEntity` de type `polyline`.

### 4.2 Courbe Bézier 3 Points (`curve`)
1. **Étape 0** : Clic sur $P_1$ (Point de départ).
2. **Étape 1** : Clic sur $P_2$ (Point d'arrivée de la corde).
3. **Étape 2** : Déplacement de la souris pour ajuster le point de contrôle Bézier, puis 3ᵉ clic pour enregistrer l'arc :

```xml
<path
  d={`M ${ent.x1} ${ent.y1} Q ${ent.curvePoint.x} ${ent.curvePoint.y} ${ent.x2} ${ent.y2}`}
  fill="none"
  stroke="#38bdf8"
  strokeWidth="2"
/>
```

---

## 5. Composant de Barre d'Outils Contextuelle

Pour permettre à l'utilisateur de changer de sous-outil en un clic :

```tsx
export const ContextualSubToolbar: React.FC = () => {
  return (
    <div className="flex items-center gap-1 bg-[#020d18] p-1 rounded border border-outline-variant/30 font-mono text-xs">
      <span className="text-[10px] text-cyan-400 font-bold px-1 uppercase">SOUS-OUTIL :</span>
      {[
        { id: 'single', label: 'Mur Droit' },
        { id: 'continuous', label: 'Mur Continu' },
        { id: 'rect', label: '4 Murs Rectangle' },
      ].map(sub => (
        <button
          key={sub.id}
          onClick={() => setWallSubTool(sub.id as WallSubTool)}
          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
            wallSubTool === sub.id
              ? 'bg-cyan-500 text-slate-900 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {sub.label}
        </button>
      ))}
    </div>
  );
};
```

---

## Résumé du Chapitre 07
* Vous avez implémenté une machine à états souple pour gérer de multiples sous-outils.
* Vous savez générer des pièces rectangulaires complètes en une seule interaction.
* Vous maîtrisez le tracé de cercles, de tracés libres et d'arcs Bézier quadratiques en SVG.

👉 **Passons au [Chapitre 08 : Encastrement des Menuiseries](./chapitre_08_encastrement_des_menuiseries.md) pour appliquer les règles architecturales de découpe des murs !**
