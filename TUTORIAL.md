# 🎓 ARCKI CAD — Grand Cours & Guide de Conception de A à Z
## Comment Concevoir et Coder un Studio CAO d'Architecture 2D Vectoriel Paramétrique

> **Public visé** : Ingénieurs logiciels, développeurs frontend/fullstack, architectes et passionnés d'informatique graphique.  
> **Objectif** : Comprendre, concevoir et recréer de zéro (de la première ligne de code au déploiement) une application de CAO (Conception Assistée par Ordinateur) 2D vectorielle professionnelle inspirée des meilleurs outils du marché (AutoCAD, Revit, ArchiCAD).

---

## 📑 Sommaire Général des Modules de Cours

1. [Module 1 : Philosophie, Stack Technique & Architecture Globale](#module-1--philosophie-stack-technique--architecture-globale)
2. [Module 2 : Modélisation des Données CAO (`types.ts`) & Système Métrique](#module-2--modélisation-des-données-cao-typests--système-métrique)
3. [Module 3 : Moteur Mathématique & Géométrie Vectorielle 2D](#module-3--moteur-mathématique--géométrie-vectorielle-2d)
4. [Module 4 : Le Moteur d'Accrochage Intelligent (OSNAP - Object Snap)](#module-4--le-moteur-daccrochage-intelligent-osnap---object-snap)
5. [Module 5 : Moteur de Rendu SVG & Système de Calques (Layers)](#module-5--moteur-de-rendu-svg--système-de-calques-layers)
6. [Module 6 : Machine à États & Boucle d'Événements du Canvas](#module-6--machine-à-états--boucle-dévénements-du-canvas)
7. [Module 7 : Outils & Sous-Outils Paramétriques (Murs, Formes, Tracés)](#module-7--outils--sous-outils-paramétriques-murs-formes-tracés)
8. [Module 8 : Encastrement Paramétrique des Menuiseries (Règle Métier Critique)](#module-8--encastrement-paramétrique-des-menuiseries-règle-métier-critique)
9. [Module 9 : Console de Commandes CLI & Raccourcis Clavier Pro](#module-9--console-de-commandes-cli--raccourcis-clavier-pro)
10. [Module 10 : Moteur d'Export Vectoriel DXF (AutoCAD R12) & SVG](#module-10--moteur-dexport-vectoriel-dxf-autocad-r12--svg)
11. [Module 11 : Guide de Reproduction Pas à Pas (Code de A à Z)](#module-11--guide-de-reproduction-pas-à-pas-code-de-a-à-z)

---

## Module 1 : Philosophie, Stack Technique & Architecture Globale

### 1.1 Pourquoi un éditeur CAO 2D vectoriel dans le navigateur ?
Les applications de CAO traditionnelles (AutoCAD, MicroStation) sont souvent de lourds exécutables desktop natifs (C++, DirectX/OpenGL). L'arrivée du Web moderne (SVG haute performance, Canvas 2D, WebGL, TypeScript moderne et React) permet aujourd'hui de construire des outils de dessin architectural ultra-rapides, instantanément partageables sans installation.

### 1.2 La Stack Technique Choisie
* **Vite** : Bundler ultra-rapide avec HMR instantané.
* **React 19 + TypeScript** : Modélisation déclarative de l'interface, gestion robuste des états complexes, et typage strict sans concession (`tsc --noEmit`).
* **Tailwind CSS v4** : Conception d'un thème technique sombre sombre inspiré des consoles professionnelles d'ingénierie (AutoCAD / Revit moderne), typographies `Inter` et `JetBrains Mono`.
* **SVG (Scalable Vector Graphics)** : Choisi comme moteur de rendu principal pour le dessin technique 2D :
  * Résolution infinie sans pixelisation (vectoriel pur).
  * Système de coordonnées DOM natif avec gestion des événements par entité (`onClick`, `onMouseEnter`).
  * Utilisation avancée des masques SVG (`<mask maskUnits="userSpaceOnUse">`) pour percer automatiquement les murs au droit des ouvertures.
  * Motifs paramétriques vectoriels (`<pattern>`) pour les hachures de béton armé, briques, isolants et carrelages.

### 1.3 Arborescence Structurée du Projet
```
arcki-cad/
├── index.html                 # Point d'entrée HTML avec polices JetBrains Mono
├── package.json               # Dépendances & scripts de build
├── tsconfig.json              # Configuration TypeScript stricte
├── src/
│   ├── main.tsx               # Montage de l'application React
│   ├── App.tsx                # Routeur d'écrans (Dashboard, Editor, Auth)
│   ├── types.ts               # Dictionnaire unifié de tous les types CAO
│   ├── agent.ts               # Copilote IA et analyseur d'intentions
│   └── components/
│       ├── Header.tsx         # Barre de navigation supérieure et menus
│       ├── Dashboard.tsx      # Gestionnaire de projets architecturaux
│       ├── CadEditor.tsx      # LE CŒUR : Moteur SVG, événements, outils
│       ├── CadLibraryPanel.tsx# Bibliothèque de blocs mobiliers & menuiseries
│       ├── PropertiesSidebar.tsx # Inspecteur d'attributs de l'entité
│       ├── LayerManager.tsx   # Gestionnaire des calques normalisés
│       ├── ExportModal.tsx    # Générateur de fichiers DXF, SVG et métriques
│       └── TutorialModal.tsx  # Académie interactive intégrée
```

---

## Module 2 : Modélisation des Données CAO (`types.ts`) & Système Métrique

### 2.1 Le Système d'Unités Architecturales
* En architecture française et européenne, l'unité de référence de chantier est le **millimètre (mm)** ou le **mètre (m)**.
* **Échelle Canvas** : $1 \text{ pixel SVG} = 10 \text{ millimètres (mm)}$.
  * $10 \text{ px} = 100 \text{ mm} = 10 \text{ cm}$.
  * $100 \text{ px} = 1000 \text{ mm} = 1 \text{ mètre (m)}$.
* **Épaisseurs de mur standard** :
  * Mur porteur extérieur ou refend : $200 \text{ mm}$ ($20 \text{ px}$).
  * Cloison de distribution Placostil BA13 : $72 \text{ mm}$ ($7.2 \text{ px}$).
  * Cloison séparative acoustique : $98 \text{ mm}$ ($9.8 \text{ px}$).

### 2.2 Définition de l'Entité Vectorielle Unique (`CadEntity`)
Dans un logiciel de CAO, tout objet graphique dérive d'une interface unifiée :

```typescript
export type CadTool = 
  | 'select' | 'pan' | 'wall' | 'partition' 
  | 'door' | 'window' | 'dim' | 'hatch' 
  | 'room' | 'polyline' | 'rect' | 'circle' | 'measure';

export type WallSubTool = 'single' | 'continuous' | 'rect';
export type ShapeSubTool = 'rect' | 'circle';
export type PolylineSubTool = 'straight' | 'freehand' | 'curve';

export interface CadEntity {
  id: string;
  name: string;
  type: 'wall' | 'partition' | 'door' | 'window' | 'dim' | 'room' | 'furniture' | 'rect' | 'circle' | 'line' | 'polygon' | 'polyline' | 'curve';
  layerId: string;
  
  // Coordonnées principales (en pixels canvas)
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  // Attributs paramétriques spécifiques
  radius?: number;                         // Rayon en px pour cercles
  curvePoint?: { x: number; y: number };  // Point de contrôle pour courbes Bézier
  points?: Array<{ x: number; y: number }>; // Sommets pour polygones/polylignes
  isClosed?: boolean;

  // Métrique & Bâtiment
  thickness?: number;                      // Épaisseur en mm (ex: 200, 72)
  height?: number;                         // Hauteur sous plafond (ex: 2800 mm)
  label?: string;
  area?: number;                           // Surface en m²
  material?: string;                       // Nom du matériau (ex: Béton C25/30)
  materialIndex?: string;                  // Indice ex: MAT-01
  angle?: number;                          // Orientation en degrés (0..360°)
  selected?: boolean;
  color?: string;

  // Encastrement architectural (Menuiseries)
  hostWallId?: string;                     // ID du mur hôte dans lequel elle est scellée
  openingWidth?: number;                   // Largeur de passage en mm (ex: 830, 1200)
  doorSwing?: 'left' | 'right';            // Tirant Droit ou Gauche
  doorAngle?: number;                      // Angle d'ouverture du vantail (ex: 90°)
  flipSwing?: boolean;                     // Inversion intérieur / extérieur
  sillHeight?: number;                     // Hauteur d'allège fenêtre en mm
  wallPositionRatio?: number;              // Position normalisée [0..1] le long du mur
  
  // Hachures paramétriques
  hatchPattern?: 'briques' | 'beton' | 'bois' | 'isolation' | 'carrelage' | 'sable' | 'none';
}
```

---

## Module 3 : Moteur Mathématique & Géométrie Vectorielle 2D

La CAO repose sur des formules géométriques analytiques rigoureuses. Voici les algorithmes essentiels à implémenter :

### 3.1 Distance Euclidienne et Angle d'Orientation
Entre deux points $A(x_1, y_1)$ et $B(x_2, y_2)$ :
$$\text{Distance} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
$$\theta = \text{atan2}(y_2 - y_1, x_2 - x_1) \quad (\text{en radians})$$

```typescript
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function getAngleDeg(x1: number, y1: number, x2: number, y2: number): number {
  const rad = Math.atan2(y2 - y1, x2 - x1);
  const deg = (rad * 180) / Math.PI;
  return (deg + 360) % 360;
}
```

### 3.2 Projection Orthogonale sur un Segment de Mur
Pour projeter un point curseur $C(x, y)$ sur un mur d'extrémités $P_1(x_1, y_1)$ et $P_2(x_2, y_2)$ :
1. Calculer le vecteur du mur : $\vec{v} = (x_2 - x_1, y_2 - y_1)$ et sa norme au carré $L^2 = \vec{v}_x^2 + \vec{v}_y^2$.
2. Calculer le produit scalaire : $u = \frac{(x - x_1)\vec{v}_x + (y - y_1)\vec{v}_y}{L^2}$.
3. Clamper le ratio $u$ sur $[0, 1]$ pour rester sur le segment physique.
4. Les coordonnées projetées sont :
$$x_{\text{proj}} = x_1 + u \cdot \vec{v}_x$$
$$y_{\text{proj}} = y_1 + u \cdot \vec{v}_y$$

### 3.3 Formule du Lacet (Shoelace / Gauss) pour le Calcul de Surface
Pour calculer la surface exacte d'un polygone quelconque composé de $n$ sommets $(x_0, y_0), \dots, (x_{n-1}, y_{n-1})$ :
$$\text{Surface} = \frac{1}{2} \left| \sum_{i=0}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) \right|$$
*(avec $x_n = x_0$ et $y_n = y_0$)*.

Puisque $1 \text{ px} = 10 \text{ mm} = 0.01 \text{ m}$, chaque unité d'aire SVG $1 \text{ px}^2 = 0.0001 \text{ m}^2$.  
Donc : $\text{Surface en m}^2 = \text{Surface en px}^2 \times 0.0001$.

---

## Module 4 : Le Moteur d'Accrochage Intelligent (OSNAP - Object Snap)

Dans un logiciel de CAO, l'utilisateur ne vise jamais à l'œil nu : le curseur "s'aimante" automatiquement sur les points clés du dessin.

```
       [ Grille F9 ]
             │
Curseur ──► [ Accrochage Extrémité (Endpoint P1/P2) ]
             │
            [ Accrochage Milieu (Midpoint) ]
             │
            [ Accrochage Orthogonal (Ortho F8 - 0°, 90°, 180°, 270°) ]
             │
            [ Encastrement Maçonnerie (findWallSnap) ]
```

### Algorithme de Snap Magnétique :
```typescript
function snapToElements(rawX: number, rawY: number, tolerance = 15) {
  let bestX = rawX;
  let bestY = rawY;
  let minDistance = tolerance;
  let snapType: 'endpoint' | 'midpoint' | 'grid' | 'none' = 'none';

  // 1. Accrochage sur les sommets existants (Endpoints)
  for (const ent of entities) {
    for (const pt of [{ x: ent.x1, y: ent.y1 }, { x: ent.x2, y: ent.y2 }]) {
      const d = Math.hypot(rawX - pt.x, rawY - pt.y);
      if (d < minDistance) {
        minDistance = d;
        bestX = pt.x;
        bestY = pt.y;
        snapType = 'endpoint';
      }
    }
  }

  // 2. Si aucun sommet proche, accrochage à la grille (ex: 20px / 200mm)
  if (snapType === 'none' && settings.gridSnap) {
    bestX = Math.round(rawX / settings.gridSnapSize) * settings.gridSnapSize;
    bestY = Math.round(rawY / settings.gridSnapSize) * settings.gridSnapSize;
    snapType = 'grid';
  }

  return { x: bestX, y: bestY, snapType };
}
```

---

## Module 5 : Moteur de Rendu SVG & Système de Calques (Layers)

### 5.1 Architecture SVG et Matrice de Transformation (Pan & Zoom)
Le conteneur SVG englobe un groupe principal `<g>` transformé par le panoramique (`panX, panY`) et le facteur d'échelle (`zoom`) :

```tsx
<svg className="w-full h-full cursor-crosshair overflow-hidden">
  {/* Définitions des motifs de hachures et filtres */}
  <defs>
    <pattern id="wall-concrete-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="16" stroke="#4cd7f6" strokeWidth="0.8" opacity="0.35" />
      <circle cx="8" cy="8" r="0.75" fill="#4cd7f6" opacity="0.4" />
    </pattern>
    {/* Masques de découpe dynamiques pour chaque mur percé d'ouvertures */}
  </defs>

  {/* Grille technique de fond */}
  <g id="cad-grid" transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
    {/* Rendu des lignes de grille majeure (1m) et mineure (20cm) */}
  </g>

  {/* Espace de dessin CAO */}
  <g id="cad-world" transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
    {/* 1. Murs & Cloisons avec masques de découpe */}
    {/* 2. Formes, Cercles, Polygones */}
    {/* 3. Portes & Fenêtres encastrées */}
    {/* 4. Blocs mobiliers & sanitaires */}
    {/* 5. Cotations dimensionnelles */}
    {/* 6. Fantôme interactif en cours de dessin (Rubber-band) */}
  </g>
</svg>
```

### 5.2 Les Calques Normalisés (Layers)
Comme dans AutoCAD, chaque calque isole une discipline avec sa couleur, sa visibilité et son verrouillage :
1. `structures` (#38bdf8) : Murs porteurs extérieurs et refends béton armé.
2. `cloisons` (#4edea3) : Cloisons Placostil BA13 séparatives.
3. `ouvertures` (#fbbf24) : Portes, baies vitrées et fenêtres.
4. `mobilier` (#a78bfa) : Agencements intérieurs, tables, lits, sanitaires.
5. `cotations` (#f472b6) : Lignes de cotes, cotes de niveau et surfaces de pièces.

---

## Module 6 : Machine à États & Boucle d'Événements du Canvas

### 6.1 Cycle de Vie d'un Tracé en Deux Clics ($P_1 \to P_2$)
```
[ Clic 1 sur Canvas ]
        │
        ▼
draftStart = { x, y } (Point P1 d'ancrage fixé)
        │
        ▼
[ Déplacement de la souris : handleMouseMove ]
        │
        ▼
cursorPos = { x, y }
Calcul en direct : Distance (mm), Angle (°), Delta X, Delta Y
Rendu du "Fantôme" (Ghost Drawing) en pointillés cyan
        │
        ▼
[ Clic 2 sur Canvas : handleCanvasClick ]
        │
        ▼
Création de la nouvelle CadEntity { x1: draftStart.x, y1: draftStart.y, x2: cursorPos.x, y2: cursorPos.y }
Enregistrement dans la pile d'historique Undo (Ctrl+Z)
Remise à zéro : draftStart = null (ou enchaînement si mode continu)
```

---

## Module 7 : Outils & Sous-Outils Paramétriques (Murs, Formes, Tracés)

C'est ici que réside la flexibilité réclamée par les dessinateurs projeteurs :

### 7.1 L'Outil Mur & Cloison (`wall` [W] / `partition` [C])
* **Sous-outil Mur Droit (`single`)** : Un segment droit unique entre $P_1$ et $P_2$.
* **Sous-outil Mur Continu (`continuous`)** : Chaque clic pose un angle et commence immédiatement le pan suivant. La chaîne se termine par la touche `Entrée` ou `Échap`.
* **Sous-outil 4 Murs Rectangle (`rect`)** : En deux clics (deux coins opposés), génère automatiquement les 4 murs fermés d'équerre d'une pièce avec les retours d'angle parfaits.

### 7.2 L'Outil Forme (`rect` [R])
* **Sous-outil Rectangle** : $P_1$ (coin supérieur gauche) $\to P_2$ (coin inférieur droit), calcul instantané de la surface en $\text{m}^2$ et poignées de redimensionnement aux 4 coins.
* **Sous-outil Cercle** : $P_1$ (Centre) $\to P_2$ (Rayon sur la circonférence). Rendu avec croix centrale de repère, ligne de rayon pointillée, badge affichant le diamètre $\varnothing$, le rayon $R$ et la surface $\pi R^2$.

### 7.3 L'Outil Polygone & Tracé (`polyline` [L])
* **Sous-outil Trait (`straight`)** : Chaîne de sommets polygonaux libres. Détection magnétique du premier sommet pour fermer automatiquement le polygone en surface calculée.
* **Sous-outil Libre (`freehand`)** : Maintien du clic gauche et tracé fluide à la souris. Échantillonnage intelligent des points ($d \ge 4 \text{ px}$) et détection automatique de boucle fermée.
* **Sous-outil Courbe Bézier (`curve`)** : Construction en 3 étapes :
  1. Clic 1 : $P_1$ (Départ de l'arc).
  2. Clic 2 : $P_2$ (Arrivée de l'arc).
  3. Clic 3 : Déplacement interactif du curseur pour ajuster la flèche (courbure) de l'arc.

---

## Module 8 : Encastrement Paramétrique des Menuiseries (Règle Métier Critique)

> **RÈGLE ARCHITECTURALE ABSOLUE** :
> Une porte ou une fenêtre ne flotte JAMAIS dans le vide. Elle est **scellée et encastrée** dans un mur porteur ou une cloison.

### 8.1 L'Algorithme `findWallSnap`
Lorsqu'un outil d'ouverture (`door` ou `window`) est actif :
1. Recherche du mur le plus proche du curseur sous une tolérance (ex: 250 px).
2. Projection orthogonale du centre de la baie sur l'axe du mur hôte.
3. Calcul des extrémités de tableau de maçonnerie $P_1$ et $P_2$ selon la largeur de passage (`openingWidth` : 730, 830, 900, 1200, 1400 mm).
4. Adoption instantanée de l'angle et de l'épaisseur du mur hôte.

### 8.2 Masques de Découpe SVG Automatiques (Réservation Maçonnerie)
Chaque mur hôte possède un masque SVG dynamique qui annule la matière du mur au droit de ses baies :
```xml
<mask id="wall-mask-{wall.id}" maskUnits="userSpaceOnUse">
  {/* 1. Rectangle blanc couvrant tout le mur (matière pleine) */}
  <rect x="..." y="..." width="..." height="..." fill="white" />
  {/* 2. Rectangles noirs placés au droit des ouvertures (perce la maçonnerie) */}
  <rect x="{opening.x1}" y="{opening.y1}" ... fill="black" />
</mask>
```
Le mur applique `mask="url(#wall-mask-{wall.id})"`. Les hachures de béton s'interrompent proprement et deux traits de tableau ferment la baie maçonnée.

### 8.3 Arc de Débattement et Inversion
* Les portes battantes affichent leur arc normalisé à $90^\circ$ en pointillés fins.
* La touche **`[Espace]`** inverse instantanément le sens d'ouverture (Tirant Droit $\leftrightarrow$ Tirant Gauche / Intérieur $\leftrightarrow$ Extérieur).

---

## Module 9 : Console de Commandes CLI & Raccourcis Clavier Pro

Les architectes sur AutoCAD utilisent massivement la ligne de commande. Notre studio intègre une console interactive complète :

| Raccourci | Commande CLI | Action effectuée |
|---|---|---|
| `V` | `_SELECT` | Outil Sélection & Manipulation |
| `W` | `_WALL` | Outil Mur porteur (Droit / Continu / 4 Murs) |
| `C` | `_PARTITION` | Outil Cloison Placostil 72mm |
| `P` | `_DOOR` | Outil Porte encastrée sur maçonnerie |
| `F` | `_WINDOW` | Outil Fenêtre / Baie vitrée |
| `R` | `_RECT` | Outil Forme (Rectangle / Cercle) |
| `L` | `_POLY` | Outil Tracé (Trait / Libre / Courbe) |
| `D` | `_DIM` | Cotation associative millimétrique |
| `H` | `_HATCH` | Hachures paramétriques |
| `M` | `_DIST` | Mesure de distance temps réel |
| `Espace` | `_FLIP` | Inverser le battant de porte |
| `Entrée` | `_ENTER` | Valider / Fermer polygone ou mur continu |
| `Échap` | `_ESC` | Annuler le tracé en cours ou désélectionner |
| `Ctrl+Z` / `Ctrl+Y` | `_UNDO` / `_REDO` | Annuler / Rétablir dans la pile d'historique |

---

## Module 10 : Moteur d'Export Vectoriel DXF (AutoCAD R12) & SVG

Pour être utilisé par des bureaux d'études et des charpentiers, le plan doit pouvoir être ouvert dans AutoCAD sans perte de cotes.

### Génération du Format DXF ASCII Standard (sans dépendance externe) :
Un fichier DXF est un fichier texte structuré par paires (code groupe, valeur) :
```
0
SECTION
2
ENTITIES
0
LINE
8
STRUCTURES
10
0.0
20
0.0
11
4000.0
21
0.0
0
ENDSEC
0
EOF
```
Notre fonction `generateDxfString(entities)` convertit chaque mur, porte, fenêtre et cercle en entités DXF pures (`LINE`, `ARC`, `CIRCLE`, `TEXT`), directement téléchargeables en `.dxf` !

---

## Module 11 : Guide de Reproduction Pas à Pas (Code de A à Z)

### Étape 1 : Initialiser le Projet
```bash
npm create vite@latest arcki-cad -- --template react-ts
cd arcki-cad
npm install
npm install @tailwindcss/vite tailwindcss
```

### Étape 2 : Configurer les Types (`src/types.ts`)
Définir l'interface `CadEntity` comme documenté dans le [Module 2](#module-2--modélisation-des-données-cao-typests--système-métrique).

### Étape 3 : Structurer le Composant Principal `CadEditor.tsx`
1. Créer les états de base : `entities`, `selectedIds`, `activeTool`, `draftStart`, `cursorPos`, `pan`, `zoom`.
2. Mettre en place la conversion des coordonnées souris en coordonnées monde :
```typescript
const getCanvasCoords = (e: React.MouseEvent<SVGSVGElement>) => {
  const rect = svgRef.current.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom,
  };
};
```
3. Implémenter les gestionnaires d'événements `onMouseDown`, `onMouseMove`, `onClick` et `onWheel` (zoom molette fluide centré sur le curseur).
4. Ajouter les outils et sous-outils avec le retour fantôme interactif en direct.

---

## 🏆 Félicitations !
En suivant ce cours d'ingénierie, vous maîtrisez l'ensemble de la chaîne de valeur d'un logiciel de CAO d'architecture moderne, paramétrique et performant.

*ARCKI CAD — Conçu pour l'excellence architecturale.*
