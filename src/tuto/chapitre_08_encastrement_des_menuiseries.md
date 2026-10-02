# Chapitre 08 — Encastrement Paramétrique des Menuiseries & Masquage SVG

En architecture et en dessin de bâtiment (normes françaises DTU), **une porte ou une fenêtre ne peut jamais flotter dans le vide**.  
Elle doit obligatoirement être **encastrée dans un mur hôte**, en perçant la maçonnerie et en adoptant l'orientation et l'épaisseur du mur.

Dans ce chapitre, nous allons concevoir ce système clé en alliant mathématiques vectorielles et **masques SVG dynamiques**.

---

## 1. L'Algorithme `findWallSnap`

Lorsqu'un outil d'ouverture (`door` ou `window`) est actif, chaque mouvement de souris recherche le mur porteur ou la cloison la plus proche :

```typescript
export interface WallSnapResult {
  hostWall: CadEntity;
  projX: number;              // Centre de l'ouverture projeté sur le mur
  projY: number;
  wallAngleDeg: number;       // Angle hérité du mur hôte
  wallThickness: number;      // Épaisseur héritée du mur hôte
  p1X: number;                // Début de la réservation maçonnée
  p1Y: number;
  p2X: number;                // Fin de la réservation maçonnée
  p2Y: number;
}

export function findWallSnap(
  cursorX: number,
  cursorY: number,
  openingWidthMm: number,
  walls: CadEntity[],
  maxSnapDist = 250
): WallSnapResult | null {
  let closestWall: CadEntity | null = null;
  let minDistance = maxSnapDist;
  let bestProj = { projX: 0, projY: 0, ratio: 0.5 };

  for (const wall of walls) {
    if (wall.type !== 'wall' && wall.type !== 'partition') continue;

    const proj = projectPointOnSegment(cursorX, cursorY, wall.x1, wall.y1, wall.x2, wall.y2);
    if (proj.distance < minDistance) {
      minDistance = proj.distance;
      closestWall = wall;
      bestProj = proj;
    }
  }

  if (!closestWall) return null;

  // Calcul du vecteur directeur unitaire du mur
  const wallAngleRad = Math.atan2(closestWall.y2 - closestWall.y1, closestWall.x2 - closestWall.x1);
  const wallAngleDeg = (wallAngleRad * 180) / Math.PI;
  const halfWidthPx = (openingWidthMm / 10) / 2;

  // Points P1 et P2 de découpe de maçonnerie le long du mur
  const ux = Math.cos(wallAngleRad);
  const uy = Math.sin(wallAngleRad);

  return {
    hostWall: closestWall,
    projX: bestProj.projX,
    projY: bestProj.projY,
    wallAngleDeg,
    wallThickness: closestWall.thickness || 200,
    p1X: bestProj.projX - halfWidthPx * ux,
    p1Y: bestProj.projY - halfWidthPx * uy,
    p2X: bestProj.projX + halfWidthPx * ux,
    p2Y: bestProj.projY + halfWidthPx * uy,
  };
}
```

---

## 2. Découpe Automatique du Mur en SVG avec `<mask maskUnits="userSpaceOnUse">`

Pour que le béton armé du mur s'interrompe proprement au droit de la porte sans avoir à découper manuellement le mur en deux morceaux, nous utilisons un **masque SVG dynamique** :

* Ce qui est **BLANC** dans le masque reste **VISIBLE**.
* Ce qui est **NOIR** dans le masque devient **TRANSPARENT (PERCÉ)**.

```tsx
{/* 1. Définition du masque pour chaque mur hôte */}
<defs>
  {walls.map(wall => {
    // Liste des ouvertures encastrées dans ce mur spécifique
    const hostOpenings = openings.filter(op => op.hostWallId === wall.id);
    if (hostOpenings.length === 0) return null;

    return (
      <mask key={`mask-${wall.id}`} id={`mask-wall-${wall.id}`} maskUnits="userSpaceOnUse">
        {/* Rectangle blanc couvrant tout l'espace (matière pleine du mur) */}
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />

        {/* Rectangles noirs au droit de chaque baie pour perforer le mur */}
        {hostOpenings.map(op => {
          const widthPx = (op.openingWidth || 830) / 10;
          const thickPx = (wall.thickness || 200) / 10 + 2; // Léger débord pour coupe nette
          return (
            <rect
              key={op.id}
              x={-widthPx / 2}
              y={-thickPx / 2}
              width={widthPx}
              height={thickPx}
              fill="black"
              transform={`translate(${(op.x1 + op.x2) / 2}, ${(op.y1 + op.y2) / 2}) rotate(${op.angle || 0})`}
            />
          );
        })}
      </mask>
    );
  })}
</defs>

{/* 2. Application du masque sur le mur */}
<polygon
  points={wallPolygonPoints}
  fill="url(#wall-concrete-hatch)"
  stroke="#4cd7f6"
  strokeWidth="2"
  mask={`url(#mask-wall-${wall.id})`}
/>
```

---

## 3. Rendu Architectural du Vantail et de l'Arc de Débattement

Une porte intérieure normalisée se compose de :
1. Un dormant (cadre bâti).
2. Un vantail battant.
3. Un arc de cercle en pointillés fins figurant le rayon de débattement à $90^\circ$.

```tsx
export const CadDoor: React.FC<{ door: CadEntity }> = ({ door }) => {
  const widthPx = (door.openingWidth || 830) / 10;
  const swing = door.doorSwing || 'right';
  const flip = door.flipSwing ? -1 : 1;
  const leafLen = widthPx - 6;

  // Arc de cercle SVG normalisé
  const arcPath = `M ${leafLen} 0 A ${leafLen} ${leafLen} 0 0 ${swing === 'left' ? 0 : 1} 0 ${flip * leafLen}`;

  return (
    <g transform={`translate(${door.x1}, ${door.y1}) rotate(${door.angle || 0})`}>
      {/* Arc de débattement pointillé */}
      <path d={arcPath} fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 2" />

      {/* Vantail mobile */}
      <rect
        x={0}
        y={-2}
        width={leafLen}
        height={4}
        fill="#fbbf24"
        transform={`rotate(${swing === 'left' ? -90 * flip : 90 * flip})`}
      />

      {/* Charnière */}
      <circle cx={0} cy={0} r={2.5} fill="#fbbf24" />
    </g>
  );
};
```

---

## 4. Inversion Instantanée du Battant avec la Touche `[Espace]`

Pour inverser le sens d'ouverture d'un seul appui sur la barre d'espace :

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    e.preventDefault();
    // Bascule Tirant Droit <-> Tirant Gauche
    setActiveDoorSwing(prev => (prev === 'left' ? 'right' : 'left'));
  }
};
```

---

## Résumé du Chapitre 08
* Vous respectez la règle métier architecturale : aucune ouverture ne flotte sans mur hôte.
* Vous utilisez les masques SVG `<mask>` pour percer dynamiquement la maçonnerie.
* Vous dessinez des portes normalisées avec arc de débattement et bascule au clavier.

👉 **Passons au [Chapitre 09 : Inspecteur d'Attributs & Calques](./chapitre_09_inspecteur_proprietes_et_calques.md) pour connecter l'interface d'édition des propriétés !**
