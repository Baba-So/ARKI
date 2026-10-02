# Chapitre 04 — Moteur SVG & Système de Coordonnées Monde vs Écran en React

Dans ce chapitre, nous entrons dans le vif du sujet de **React** appliqué à l'informatique graphique :  
Comment transformer un simple écran de navigateur en un **canvas infini avec panoramique (Pan) et zoom fluide (Zoom)** ?

---

## 1. Coordonnées Écran vs Coordonnées Monde (World Space)

Il y a deux repères orthogonaux distincts à ne jamais confondre :
1. **Le Repère Écran (Screen Space)** : Ce sont les pixels physiques de la fenêtre du navigateur retournés par `e.clientX` et `e.clientY`.
2. **Le Repère Monde CAO (World Space)** : C'est le plan architectural virtuel infini, où le point $(0, 0)$ est l'origine du projet.

```
+────────────────────────────────────────────────────────────+
│  Écran (0, 0)                                              │
│     │                                                      │
│     ▼  Pan (pan.x, pan.y)                                  │
│        +──────────────────────────────────────────────+    │
│        │  Monde CAO (0, 0)                            │    │
│        │      Mur L=4000mm                            │    │
│        │      [─────────────────────────────]         │    │
│        │                                              │    │
│        +──────────────────────────────────────────────+    │
│                                                            │
+────────────────────────────────────────────────────────────+
```

### La Formule de Transformation Inverse
Pour savoir sur quel point architectural l'utilisateur clique :

$$\text{World}_X = \frac{\text{Screen}_X - \text{Pan}_X}{\text{Zoom}}$$
$$\text{World}_Y = \frac{\text{Screen}_Y - \text{Pan}_Y}{\text{Zoom}}$$

---

## 2. Le Hook `useRef` pour Accéder au DOM SVG

En React, nous n'utilisons jamais `document.getElementById` pour manipuler le canvas. Nous utilisons le hook **`useRef`** qui crée une référence mutable attachée à l'élément SVG :

```tsx
import React, { useRef, useState } from 'react';

export const CadViewport: React.FC = () => {
  // 1. Référence typée vers l'élément SVG natif
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 2. États React pour le Panoramique et le Zoom
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 200, y: 150 });
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 = échelle 100%

  // 3. Fonction de conversion des coordonnées
  const getCanvasCoords = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    
    // Position du SVG dans la fenêtre du navigateur
    const rect = svgRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Application de la formule inverse
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    };
  };

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-[#051424] cursor-crosshair select-none"
    >
      {/* Conteneur Monde transformé par Pan & Zoom */}
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Vos entités architecturales iront ici */}
      </g>
    </svg>
  );
};
```

---

## 3. Zoom Fluide Centré sur la Souris (`onWheel`)

Un piège classique en programmation graphique est de zoomer par rapport au coin supérieur gauche $(0, 0)$.  
Pour zoomer **exactement sur le point survolé par le pointeur de la souris** :

```tsx
const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
  e.preventDefault();

  if (!svgRef.current) return;
  const rect = svgRef.current.getBoundingClientRect();
  const mouseScreenX = e.clientX - rect.left;
  const mouseScreenY = e.clientY - rect.top;

  // Facteur de zoom (10% d'agrandissement ou rétrécissement)
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(10.0, Math.max(0.1, zoom * zoomFactor));

  // Ajustement du Pan pour conserver le point sous le curseur immobile
  const newPanX = mouseScreenX - (mouseScreenX - pan.x) * (newZoom / zoom);
  const newPanY = mouseScreenY - (mouseScreenY - pan.y) * (newZoom / zoom);

  setZoom(newZoom);
  setPan({ x: newPanX, y: newPanY });
};
```

---

## 4. Affichage de la Grille Technique CAO

Une grille de repère technique est indispensable. Elle comporte :
* Des **lignes mineures** tous les $20 \text{ px}$ ($200 \text{ mm}$ réels).
* Des **lignes majeures** tous les $100 \text{ px}$ ($1 \text{ m}$ réel).

Nous pouvons utiliser les motifs vectoriels `<pattern>` de SVG qui se répètent à l'infini avec un coût processeur quasi nul :

```tsx
<defs>
  {/* Grille mineure 20px (200mm) */}
  <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0a2238" strokeWidth="0.8" />
  </pattern>

  {/* Grille majeure 100px (1m) */}
  <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
    <rect width="100" height="100" fill="url(#grid-minor)" />
    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#123b5c" strokeWidth="1.2" />
  </pattern>
</defs>

{/* Remplissage infini */}
<rect
  x="-100000"
  y="-100000"
  width="200000"
  height="200000"
  fill="url(#grid-major)"
/>
```

---

## Résumé du Chapitre 04
* Vous savez utiliser `useRef` pour cibler le conteneur SVG sans briser le modèle déclaratif de React.
* Vous maîtrisez la conversion mathématique des coordonnées écran vers le repère monde.
* Vous avez implémenté un système de Panoramique et Zoom centré sur le curseur avec grille technique infinie.

👉 **Passons au [Chapitre 05 : Machine à États & Cycle de Tracé](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) pour dessiner vos premières entités à la souris !**
