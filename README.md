# ARCKI CAD — Studio CAO d'Architecture & Copilote IA 📐🏛️

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![Conformité RE2020 & PMR](https://img.shields.io/badge/Normes-RE2020%20%7C%20PMR-emerald.svg)](#règles-métier--conformité-réglementaire)

**ARCKI CAD** est un studio de Conception Assistée par Ordinateur (CAO) 2D vectoriel paramétrique et un copilote IA spatial, conçu sur mesure pour les architectes, les maîtres d’œuvre et les bureaux d'études techniques (BET). 

Inspiré de l’ergonomie et des standards de l'industrie (AutoCAD, Revit, Archicad), ARCKI CAD combine la fluidité du web moderne avec la rigueur des normes de construction françaises et européennes (DTU maçonnerie/menuiserie, accessibilité PMR, réglementation thermique & environnementale RE2020).

---

## 📑 Sommaire

- [Fonctionnalités Clés](#-fonctionnalités-clés)
- [Règle Métier Fondamentale : Encastrement des Ouvertures](#-règle-métier-fondamentale--encastrement-des-ouvertures)
- [Système d'Unités & Échelle](#-système-dunités--échelle)
- [Calques Normalisés (Layers)](#-calques-normalisés-layers)
- [Raccourcis Clavier](#-raccourcis-clavier)
- [Moteur IA & Audits Réglementaires](#-moteur-ia--audits-réglementaires)
- [Architecture Logicielle](#-architecture-logicielle)
- [Installation & Démarrage](#-installation--démarrage)
- [Formats d'Exportation](#-formats-dexportation)

---

## 🌟 Fonctionnalités Clés

- **Moteur Vectoriel SVG Haute Précision** : Rendu temps réel au 1/100e avec zoom infini centré sur curseur, pan fluide et grille dynamique.
- **Accrochage Objet Intelligent (OSNAP)** : Magnétisme instantané sur extrémités, milieux de segments, projections orthogonales et axes de murs.
- **Gestionnaire de Calques Avancé** : Masquage, verrouillage, opacité, épaisseurs de traits ISO et codes couleur normalisés.
- **Calculateur Métrique & Shoelace** : Détection des pièces fermées et calcul instantané des surfaces habitables ($m^2$) et périmètres sans approximation.
- **Bibliothèque d’Éléments Paramétriques** : Mobilier d’agencement, équipements sanitaires PMR avec aire de rotation $\varnothing 1,50\text{ m}$, cuisine, ouvertures et menuiseries.
- **Lignes de Cotation Associatives** : Cotes architecturales avec lignes de rappel, têtes de cotes normalisées et cotes de niveau.
- **Hachures Paramétriques** : Motifs conformes pour béton armé, briques, isolation thermique continue, bois et carrelage.
- **Ligne de Commande CLI Intégrée** : Interface textuelle rapide inspirée de la barre de commandes AutoCAD.

---

## 🚪 Règle Métier Fondamentale : Encastrement des Ouvertures

> **Principe Cardinal** : *Dans ARCKI CAD, une menuiserie (porte ou fenêtre) ne peut jamais flotter dans le vide.* Elle est obligatoirement encastrée et asservie à un mur porteur ou une cloison hôte.

1. **Magnétisme Géométrique (`findWallSnap`)** :
   - Le placement d’une porte (`[P]`) ou fenêtre (`[F]`) projette automatiquement le centre de l'ouverture sur le segment de mur le plus proche.
   - L'ouverture hérite immédiatement de l'angle d'orientation ($\theta$), de l'épaisseur ($e$) et de la référence du mur hôte (`hostWallId`).
2. **Réservation & Découpe Maçonnerie SVG** :
   - Masque de découpe dynamique (`<mask maskUnits="userSpaceOnUse">`) appliqué sur le mur hôte : le béton et les traits de doublage s'interrompent rigoureusement au droit de la baie.
   - Création automatique des retours d'écoinçon (tableaux de maçonnerie).
3. **Glissement Interactif (Drag & Slide)** :
   - Le déplacement à la souris contraint la baie le long de l'axe de son mur hôte (avec saut automatique sur un mur adjacent si le curseur s'en rapproche).
4. **Débattement et Vantail** :
   - Arc de débattement normalisé quart-de-cercle (pointillés fins).
   - Inversion instantanée du sens d'ouverture (Tirant Droit / Tirant Gauche) par la touche `[Espace]`.
   - Fenêtres avec profilés PVC/Alu, dormant, double vitrage thermique et appui extérieur maçonné.

---

## 📏 Système d'Unités & Échelle

| Unité Canvas | Unité Réelle | Équivalence |
|---|---|---|
| **$1\text{ px}$** | **$10\text{ mm}$** | $1\text{ cm}$ |
| **$10\text{ px}$** | **$100\text{ mm}$** | $10\text{ cm}$ / $0,1\text{ m}$ |
| **$100\text{ px}$** | **$1000\text{ mm}$** | **$1,00\text{ m}$** (Échelle de base) |

- **Grille par défaut** : Pas de $20\text{ px}$ ($200\text{ mm}$), commutable avec accrochage magnétique.
- **Épaisseurs standards** :
  - Mur porteur béton armé : $200\text{ mm}$ ($20\text{ px}$).
  - Cloison distributive Placostil BA13 : $72\text{ mm}$ ($7,2\text{ px}$).
  - Cloison acoustique séparative : $98\text{ mm}$ ($9,8\text{ px}$).
- **Calcul des surfaces** : Formule mathématique de Shoelace (polygones simples et concaves) :
  $$S = \frac{1}{2} \left| \sum_{i=1}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) + (x_n y_1 - x_1 y_n) \right| \times 10^{-4} \text{ m²}$$

---

## 🎨 Calques Normalisés (Layers)

| Calque | Couleur | Épaisseur ISO | Description |
|---|---|---|---|
| `structures` | `#38bdf8` (Cyan) | $0.50\text{ mm}$ | Murs porteurs extérieurs, refends et poteaux béton armé |
| `cloisons` | `#4edea3` (Vert Émeraude) | $0.25\text{ mm}$ | Cloisons distributives sèches et doublages thermiques |
| `ouvertures` | `#fbbf24` (Ambre) | $0.20\text{ mm}$ | Portes intérieures, portes d'entrée, fenêtres et baies vitrées |
| `mobilier` | `#a78bfa` (Violet) | $0.18\text{ mm}$ | Agencement intérieur, sanitaires, cuisine et électroménager |
| `cotations` | `#f472b6` (Rose) | $0.15\text{ mm}$ | Lignes de cotes associatives, cotes de niveau et surfaces |

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
|---|---|
| `V` | Outil **Sélection** & Manipulation |
| `W` | Outil **Mur porteur** ($200\text{ mm}$) |
| `C` | Outil **Cloison** Placostil ($72\text{ mm}$) |
| `P` | Outil **Porte encastrée** sur maçonnerie |
| `F` | Outil **Fenêtre / Baie vitrée** encastrée |
| `D` | Outil **Cotation associative** |
| `H` | Outil **Hachures paramétriques** |
| `R` | Outil **Zone / Pièce rectangulaire** |
| `L` | Outil **Ligne polygonale libre** |
| `M` | Outil **Mesure dynamique** (distance réelle & $\Delta X, \Delta Y$) |
| `Espace` | **Inverser le sens du battant** de porte (Tirant Droit / Gauche) |
| `Entrée` | Valider et fermer le polygone / contour de pièce |
| `Échap` | Annuler le tracé en cours ou désélectionner |
| `Suppr` / `Retour` | Supprimer les entités sélectionnées |
| `Ctrl + Z` / `Ctrl + Y` | Annuler / Rétablir (Pile d'historique) |
| `Ctrl + D` | Dupliquer l'entité sélectionnée avec décalage |

---

## 🤖 Moteur IA & Audits Réglementaires

Le module `src/agent.ts` embarque un copilote d'expertise architecturale capable d'analyser en temps réel le graphe d'entités vectorielles :

- **Conformité RE2020 (Éclairage Naturel)** :
  - Vérification automatique du ratio surface vitrée / surface habitable :
    $$\text{Ratio Vitré} = \frac{\sum S_{\text{fenêtres}}}{S_{\text{habitable}}} \ge \frac{1}{6} \approx 16,7\%$$
- **Conformité Accessibilité PMR (Arrêté du 24 décembre 2015)** :
  - Détection automatique des portes avec passage utile libre $\ge 900\text{ mm}$.
  - Alertes pour les portes d'accès aux pièces de vie inférieures à $830\text{ mm}$.
- **Contrôle d'Intégrité Structurelle** :
  - Audit d'encastrement garantissant que $100\%$ des baies sont rattachées à un mur hôte valide.

---

## 🏗️ Architecture Logicielle

```
/
├── AGENT.md                       # Spécifications & directives de l'Agent IA
├── AGENTS.md                      # Référence système et règles architecturales
├── index.html                     # Point d'entrée HTML5 optimisé SEO
├── package.json                   # Dépendances et scripts Vite/React
├── src/
│   ├── main.tsx                   # Montage racine React 19
│   ├── App.tsx                    # Composant chapeau et gestion des modales
│   ├── types.ts                   # Interfaces TypeScript unifiées (CadEntity, CadLayer, etc.)
│   ├── agent.ts                   # Copilote IA : audits RE2020, PMR et métrés
│   ├── index.css                  # Thème sombre architectural et Tailwind v4
│   └── components/
│       ├── CadEditor.tsx          # Moteur de rendu SVG, événements souris/clavier, OSNAP
│       ├── PropertiesSidebar.tsx  # Inspecteur d'attributs & paramétrage d'encastrement
│       ├── CadLibraryPanel.tsx    # Bibliothèque de composants architecturaux et mobilier
│       ├── LayerManager.tsx       # Gestionnaire de calques professionnel
│       └── ExportModal.tsx        # Moteur d'exportation DXF, SVG et rapport JSON
```

---

## 🚀 Installation & Démarrage

### Prérequis
- **Node.js** : version 18.x ou supérieure
- Gestionnaire de paquets : **npm**, **pnpm** ou **bun**

### Installation
```bash
# Cloner le dépôt
git clone <url-du-depot>
cd arcki-cad

# Installer les dépendances
npm install
```

### Développement
```bash
# Lancer le serveur de développement Vite (port 3000)
npm run dev
```
Ouvrez votre navigateur à l'adresse [http://localhost:3000](http://localhost:3000).

### Compilation & Vérification des Types
```bash
# Validation stricte TypeScript
npm run lint

# Build de production
npm run build
```

---

## 📤 Formats d'Exportation

1. **AutoCAD DXF (R12 / AC1009)** : Fichier d'échange universel pour logiciels CAO/DAO (AutoCAD, DraftSight, LibreCAD, QCad) avec respect strict de la table des calques et des couleurs.
2. **SVG Vectoriel Haute Définition** : Rendu vectoriel natif à l'échelle pour impressions architecturales et dossiers de permis de construire.
3. **Métré & Audit JSON / PDF** : Rapport complet des surfaces habitables pièce par pièce, linéaires de murs porteurs et bilan de conformité RE2020 / PMR.

---

*Développé avec passion pour l'architecture contemporaine et l'ingénierie du bâtiment.*
