# Chapitre 02 — Modélisation des Données CAO & Typage Strict en TypeScript

Dans ce chapitre, nous allons concevoir le fichier le plus important de tout projet TypeScript : **`src/types.ts`**.  
C'est le contrat fondamental qui servira de socle à toutes nos briques architecturales.

---

## 1. Concepts Clés TypeScript Utilisés

### 1.1 `interface` vs `type alias`
* **`interface`** : Utilisée pour décrire la forme d'un objet (ex: une entité CAO, un calque). Elle peut être étendue (`extends`).
* **`type`** : Utilisé pour les unions de valeurs littérales (ex: une liste fermée d'outils ou d'options).

### 1.2 Les Unions de Littéraux (Literal Union Types)
Plutôt que d'utiliser une chaîne générique `string` pour représenter l'outil actif, nous restreignons les valeurs autorisées aux seuls outils existants :

```typescript
// ❌ MAUVAIS (vulnérable aux fautes de frappe comme 'wol' ou 'wal')
let activeTool: string = 'wall';

// ✅ EXCELLENT (TypeScript garantit qu'aucune autre valeur n'est possible)
export type CadTool = 
  | 'select' 
  | 'pan' 
  | 'wall' 
  | 'partition' 
  | 'door' 
  | 'window' 
  | 'dim' 
  | 'hatch' 
  | 'room' 
  | 'polyline' 
  | 'rect' 
  | 'circle' 
  | 'measure';
```

---

## 2. Découpage des Sous-Outils Paramétriques

Un logiciel de CAO professionnel propose des variantes pour chaque outil principal :

```typescript
// Sous-outils pour les Murs et Cloisons
export type WallSubTool = 
  | 'single'      // Mur Droit : segment unique P1 -> P2
  | 'continuous'  // Mur en Continu : chaîne de segments successifs
  | 'rect';       // 4 Murs Rectangle : boîte fermée de 4 murs d'équerre

// Sous-outils pour les Formes 2D
export type ShapeSubTool = 
  | 'rect'        // Rectangle paramétrique par deux coins
  | 'circle';     // Cercle paramétrique par Centre + Rayon

// Sous-outils pour le Tracé libre & Polygone
export type PolylineSubTool = 
  | 'straight'    // Trait : segments droits successifs
  | 'freehand'    // Libre : tracé fluide à main levée
  | 'curve';      // Courbe : arc ou courbe Bézier en 3 points
```

---

## 3. Le Système de Calques (Layers)

En CAO, aucun élément n'est orphelin : chaque objet appartient à un calque normalisé ayant sa propre visibilité, couleur et verrouillage.

```typescript
export interface CadLayer {
  id: string;
  name: string;
  category: 'structures' | 'cloisons' | 'mobilier' | 'ouvertures' | 'cotations';
  color: string;           // Couleur hexadécimale (ex: '#38bdf8')
  visible: boolean;        // Affiché ou masqué dans le SVG
  locked: boolean;         // Protégé contre toute modification accidentelle
  opacity: number;         // Opacité de 0.0 à 1.0
  entityCount: number;     // Nombre d'éléments rattachés
  lineweight?: string;     // Épaisseur d'impression (ex: '0.50mm')
  description?: string;
}
```

---

## 4. L'Entité Vectorielle Unique (`CadEntity`)

Dans un moteur CAO 2D, pour simplifier la boucle de rendu et la sélection, chaque objet géométrique dérive d'une interface unifiée :

```typescript
export interface CadEntity {
  id: string;
  name: string;
  type: 
    | 'wall'       // Mur porteur
    | 'partition'  // Cloison Placostil
    | 'door'       // Porte battante avec débattement
    | 'window'     // Fenêtre avec vitrage et allège
    | 'dim'        // Ligne de cotation
    | 'room'       // Zone / Pièce calculée
    | 'furniture'  // Bloc mobilier
    | 'rect'       // Forme rectangulaire
    | 'circle'     // Forme circulaire
    | 'line'       // Ligne simple
    | 'polygon'    // Polygone fermé
    | 'polyline'   // Ligne brisée ouverte
    | 'curve';     // Arc / Courbe Bézier
    
  layerId: string; // Référence au calque parent

  // Coordonnées spatiales (en pixels canvas, où 1 px = 10 mm)
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  // Attributs géométriques spécifiques
  radius?: number;                         // Rayon en px pour les cercles
  curvePoint?: { x: number; y: number };  // Point de contrôle pour les courbes
  points?: Array<{ x: number; y: number }>; // Sommets multiples pour les polygones
  isClosed?: boolean;                      // Forme fermée ou chaîne ouverte

  // Attributs dimensionnels & physiques
  thickness?: number;                      // Épaisseur en millimètres (ex: 200 mm)
  height?: number;                         // Hauteur sous plafond (ex: 2800 mm)
  label?: string;                          // Libellé textuel affiché
  area?: number;                           // Surface calculée en m²
  angle?: number;                          // Orientation angulaire en degrés (0..360°)
  selected?: boolean;                      // État de sélection dans l'éditeur
  color?: string;                          // Surcharge de couleur optionnelle

  // Règle Métier : Encastrement des Menuiseries
  hostWallId?: string;                     // ID du mur hôte dans lequel la baie est encastrée
  openingWidth?: number;                   // Largeur de passage en mm (730, 830, 900, 1200...)
  doorSwing?: 'left' | 'right';            // Sens d'ouverture (Tirant Gauche ou Droit)
  doorAngle?: number;                      // Angle d'ouverture du vantail (défaut: 90°)
  flipSwing?: boolean;                     // Inversion intérieur / extérieur
  sillHeight?: number;                     // Hauteur d'allège de fenêtre en mm

  // Hachures paramétriques architecturales
  hatchPattern?: 'briques' | 'beton' | 'bois' | 'isolation' | 'carrelage' | 'sable' | 'none';
}
```

---

## 5. Le Système d'Unités Métrique

La CAO exige une rigueur absolue sur les unités :
* **Unité de chantier** : Le millimètre ($\text{mm}$).
* **Unité d'écran SVG** : Le pixel ($\text{px}$).
* **Règle de conversion universelle** :
  $$1 \text{ px} = 10 \text{ mm} = 0.01 \text{ m}$$
  $$10 \text{ px} = 100 \text{ mm} = 10 \text{ cm}$$
  $$100 \text{ px} = 1000 \text{ mm} = 1 \text{ m}$$

---

## Résumé du Chapitre 02
* Vous avez créé une modélisation TypeScript stricte pour chaque entité, outil et calque.
* Vous comprenez la puissance des **unions de types** pour verrouiller les valeurs possibles.
* Vous maîtrisez le système d'échelle métrique liant les pixels SVG aux millimètres réels.

👉 **Passons au [Chapitre 03 : Moteur Mathématique & Géométrie 2D](./chapitre_03_moteur_geometrique_mathematiques.md) pour coder les algorithmes de calcul vectoriel !**
