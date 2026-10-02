# Chapitre 06 — Moteur d'Accrochage Intelligent (OSNAP - Object Snap)

Dans un logiciel de CAO, il est humainement impossible d'aligner deux murs au pixel près à main levée. C'est le rôle de l'**OSNAP (Object Snap)** : calculer en permanence l'aimantation idéale sous le curseur.

Dans ce chapitre, nous allons concevoir un moteur d'aimantation hiérarchique en TypeScript.

---

## 1. Hiérarchie des Priorités d'Aimantation

L'accrochage ne doit pas être chaotique : il obéit à un ordre de priorité géométrique strict :

```
                  Curseur brut de la souris (rawX, rawY)
                                     │
                 [ Priorité 1 : Sommet existant (Endpoint) ]
                 Y a-t-il une extrémité P1/P2 à moins de 15 px ?
                                ├── Oui ──► Aimante sur le sommet exact
                                └── Non
                                     │
                 [ Priorité 2 : Point Milieu (Midpoint) ]
                 Y a-t-il un milieu de mur à moins de 15 px ?
                                ├── Oui ──► Aimante au centre exact
                                └── Non
                                     │
                 [ Priorité 3 : Contrainte Orthogonale (Ortho F8) ]
                 Mode Ortho actif et premier clic P1 fixé ?
                                ├── Oui ──► Force l'alignement sur 0°, 90°, 180° ou 270°
                                └── Non
                                     │
                 [ Priorité 4 : Grille Modulaire (Snap F9) ]
                 Accrochage grille actif ?
                                ├── Oui ──► Arrondit au pas de 20 px (200 mm)
                                └── Non ──► Conserve les coordonnées brutes
```

---

## 2. Le Typage de l'Accrochage en TypeScript

Commençons par définir les types de résultat d'accrochage :

```typescript
export type SnapType = 'endpoint' | 'midpoint' | 'ortho' | 'grid' | 'none';

export interface SnapResult {
  x: number;
  y: number;
  type: SnapType;
  snapEntityId?: string;
  label?: string;
}
```

---

## 3. Implémentation du Moteur d'Accrochage

Voici la fonction pure TypeScript qui calcule l'aimantation :

```typescript
import { CadEntity } from '../types.ts';

export function calculateSnap(
  rawX: number,
  rawY: number,
  entities: CadEntity[],
  draftStart: { x: number; y: number } | null,
  options: {
    snapEnabled: boolean;
    gridSize: number;
    orthoMode: boolean;
    tolerance?: number;
  }
): SnapResult {
  const tolerance = options.tolerance ?? 15;

  // Si l'accrochage est désactivé par l'utilisateur
  if (!options.snapEnabled) {
    return { x: rawX, y: rawY, type: 'none' };
  }

  // 1. PRIORITÉ 1 : Sommets existants (Endpoints)
  let bestDist = tolerance;
  let snappedEndpoint: { x: number; y: number; id: string } | null = null;

  for (const ent of entities) {
    // Sommet P1
    const d1 = Math.hypot(rawX - ent.x1, rawY - ent.y1);
    if (d1 < bestDist) {
      bestDist = d1;
      snappedEndpoint = { x: ent.x1, y: ent.y1, id: ent.id };
    }

    // Sommet P2
    const d2 = Math.hypot(rawX - ent.x2, rawY - ent.y2);
    if (d2 < bestDist) {
      bestDist = d2;
      snappedEndpoint = { x: ent.x2, y: ent.y2, id: ent.id };
    }
  }

  if (snappedEndpoint) {
    return {
      x: snappedEndpoint.x,
      y: snappedEndpoint.y,
      type: 'endpoint',
      snapEntityId: snappedEndpoint.id,
      label: 'Extrémité (P1/P2)',
    };
  }

  // 2. PRIORITÉ 2 : Points Milieux (Midpoints)
  for (const ent of entities) {
    const midX = (ent.x1 + ent.x2) / 2;
    const midY = (ent.y1 + ent.y2) / 2;
    const dMid = Math.hypot(rawX - midX, rawY - midY);

    if (dMid < tolerance) {
      return {
        x: midX,
        y: midY,
        type: 'midpoint',
        snapEntityId: ent.id,
        label: 'Milieu',
      };
    }
  }

  // 3. PRIORITÉ 3 : Contrainte Orthogonale (Ortho F8)
  if (options.orthoMode && draftStart) {
    const dx = Math.abs(rawX - draftStart.x);
    const dy = Math.abs(rawY - draftStart.y);

    if (dx > dy) {
      // Alignement horizontal
      return { x: rawX, y: draftStart.y, type: 'ortho', label: 'Ortho H' };
    } else {
      // Alignement vertical
      return { x: draftStart.x, y: rawY, type: 'ortho', label: 'Ortho V' };
    }
  }

  // 4. PRIORITÉ 4 : Grille Modulaire (F9)
  const gridX = Math.round(rawX / options.gridSize) * options.gridSize;
  const gridY = Math.round(rawY / options.gridSize) * options.gridSize;

  return {
    x: gridX,
    y: gridY,
    type: 'grid',
    label: `Grille (${options.gridSize * 10}mm)`,
  };
}
```

---

## 4. Retours Visuels Réticule sous le Curseur (Composant React)

Pour que l'utilisateur voie instantanément le point aimanté, nous affichons un glyphe distinct selon le type d'aimantation :
* **Endpoint** : Carré vert vif.
* **Midpoint** : Triangle cyan.
* **Grille** : Petite croix blanche.

```tsx
export const SnapIndicator: React.FC<{ snap: SnapResult }> = ({ snap }) => {
  if (snap.type === 'none') return null;

  return (
    <g transform={`translate(${snap.x}, ${snap.y})`} className="pointer-events-none">
      {/* 1. Carré pour Extrémité */}
      {snap.type === 'endpoint' && (
        <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      )}

      {/* 2. Triangle pour Milieu */}
      {snap.type === 'midpoint' && (
        <polygon points="0,-5 5,4 -5,4" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
      )}

      {/* 3. Infobulle textuelle */}
      <g transform="translate(10, -10)">
        <rect x="0" y="-8" width="70" height="16" rx="3" fill="#011020" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="0.8" />
        <text x="5" y="4" fill="#38bdf8" className="text-[9px] font-mono font-bold">
          {snap.label}
        </text>
      </g>
    </g>
  );
};
```

---

## Résumé du Chapitre 06
* Vous avez créé un moteur d'aimantation hiérarchique évitant les conflits d'accrochage.
* Vos tracés s'alignent automatiquement avec une rigueur géométrique absolue.
* L'utilisateur dispose de glyphes visuels explicites indiquant le type d'accrochage actif.

👉 **Passons au [Chapitre 07 : Outils & Sous-Outils Paramétriques](./chapitre_07_outils_et_sous_outils_parametriques.md) pour implémenter les variantes de murs, formes et courbes !**
