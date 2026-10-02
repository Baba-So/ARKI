# Chapitre 03 — Moteur Mathématique & Géométrie 2D en TypeScript

Un logiciel de CAO n'est pas un simple outil de dessin comme Paint : c'est un **calculateur géométrique de précision**.  
Dans ce chapitre, nous allons écrire des **fonctions pures** en TypeScript pour exécuter les calculs vectoriels indispensables.

---

## 1. Qu'est-ce qu'une "Fonction Pure" en TypeScript ?

Une fonction est dite **pure** lorsqu'elle satisfait deux conditions :
1. Pour les mêmes arguments donnés, elle retourne toujours exactement le même résultat.
2. Elle ne modifie aucun état extérieur (aucun effet de bord, aucune mutation d'objet).

En React, séparer les calculs mathématiques dans des fonctions pures permet de les tester facilement et d'éviter les bugs de re-rendu.

---

## 2. Distance Euclidienne & Norme Vectorielle

Pour calculer la distance réelle entre deux points $P_1(x_1, y_1)$ et $P_2(x_2, y_2)$ :

$$\text{Distance} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

En JavaScript/TypeScript moderne, nous utilisons la fonction native optimisée `Math.hypot` :

```typescript
/**
 * Calcule la distance euclidienne entre deux points en pixels
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Calcule la distance réelle en millimètres
 */
export function getDistanceMm(x1: number, y1: number, x2: number, y2: number): number {
  return Math.round(getDistance(x1, y1, x2, y2) * 10);
}
```

---

## 3. Angle d'Orientation & Normalisation

Pour déterminer l'angle d'un mur ou d'une ligne, nous utilisons `Math.atan2(dy, dx)`, qui prend en compte le signe de chaque composante pour retourner l'angle dans tous les quadrants trigonométriques :

```typescript
/**
 * Retourne l'angle en degrés normalisé entre 0° et 360°
 */
export function getAngleDeg(x1: number, y1: number, x2: number, y2: number): number {
  const rad = Math.atan2(y2 - y1, x2 - x1);
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
```

---

## 4. Donner de l'Épaisseur à un Mur (Vecteur Perpendiculaire)

Un mur n'est pas un simple trait filaire à 1 pixel : il possède une épaisseur réelle (ex: 200 mm pour un mur porteur).  
Pour générer les 4 sommets du polygone rectangulaire qui forme le corps du mur :

```
             P1 (+perp) ───────────────────────── P2 (+perp)
                 ▲                                   ▲
                 │        Ligne d'axe du mur         │
            P1 (x1, y1) ───────────────────────── P2 (x2, y2)
                 │                                   │
                 ▼                                   ▼
             P1 (-perp) ───────────────────────── P2 (-perp)
```

### Le Code TypeScript :
```typescript
export interface WallPolygonPoints {
  p1Top: { x: number; y: number };
  p2Top: { x: number; y: number };
  p2Bottom: { x: number; y: number };
  p1Bottom: { x: number; y: number };
}

export function computeWallPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessMm: number
): WallPolygonPoints {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const halfThickPx = (thicknessMm / 10) / 2;

  // Vecteur normal perpendiculaire unitaire : (-sin, cos) ou (sin, -cos)
  const perpX = Math.sin(angle) * halfThickPx;
  const perpY = -Math.cos(angle) * halfThickPx;

  return {
    p1Top:    { x: x1 + perpX, y: y1 + perpY },
    p2Top:    { x: x2 + perpX, y: y2 + perpY },
    p2Bottom: { x: x2 - perpX, y: y2 - perpY },
    p1Bottom: { x: x1 - perpX, y: y1 - perpY },
  };
}
```

---

## 5. Projection Orthogonale d'un Point sur un Segment (Snap Maçonnerie)

Lorsqu'on déplace une porte ou une fenêtre près d'un mur, nous devons projeter la position du curseur $C(x, y)$ sur le segment du mur défini par $P_1(x_1, y_1)$ et $P_2(x_2, y_2)$ :

```typescript
export function projectPointOnSegment(
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { projX: number; projY: number; ratio: number; distance: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { projX: x1, projY: y1, ratio: 0, distance: Math.hypot(cx - x1, cy - y1) };
  }

  // Produit scalaire normalisé
  let ratio = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  
  // Clamping entre 0 et 1 pour rester sur le segment physique du mur
  ratio = Math.max(0, Math.min(1, ratio));

  const projX = x1 + ratio * dx;
  const projY = y1 + ratio * dy;
  const distance = Math.hypot(cx - projX, cy - projY);

  return { projX, projY, ratio, distance };
}
```

---

## 6. Calcul de Surface de Polygone (Formule du Lacet / Shoelace)

Pour calculer la surface exacte d'une pièce composée de n'importe quel nombre de sommets :

```typescript
export function calculatePolygonAreaM2(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }

  const areaPx = Math.abs(sum) / 2;
  
  // Conversion en mètres carrés :
  // 1 px = 0.01 m => 1 px² = 0.0001 m²
  const areaM2 = areaPx * 0.0001;
  
  return Math.round(areaM2 * 100) / 100;
}
```

---

## Résumé du Chapitre 03
* Vous maîtrisez l'écriture de fonctions mathématiques pures en TypeScript.
* Vous savez calculer des distances réelles, des angles orientés et projeter un point sur un mur.
* Vous disposez de l'algorithme exact pour calculer les surfaces intérieures des pièces en $\text{m}^2$.

👉 **Rendez-vous au [Chapitre 04 : Moteur SVG & Système de Coordonnées](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md) pour afficher votre premier canvas CAO interactif !**
