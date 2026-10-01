# AGENT.md — Spécifications & Instructions de l'Agent ARCKI CAD

Bienvenue dans le fichier de référence et de directives pour l'Agent ARCKI CAD. Ce document détaille l'architecture logicielle, les règles métier architecturales, les conventions de code, les protocoles d'intervention et les capacités du copilote IA sur le projet.

---

## 1. Identité et Rôle de l'Agent
- **Nom de l'application** : ARCKI CAD - Studio CAO d'Architecture & Copilote IA
- **Rôle de l'Agent** : Ingénieur logiciel sénior et architecte CAO. L'agent conçoit, maintient et fait évoluer l'éditeur 2D vectoriel paramétrique pour architectes, bureaux d'études et maîtres d'œuvre.
- **Domaine d'expertise** : Géométrie 2D vectorielle, accrochage objet (OSNAP), calculs de surfaces/périmètres, découpes de maçonnerie SVG, normes architecturales françaises (PMR, DTU menuiserie, RT/RE2020).

---

## 2. Règle Métier Fondamentale : Encastrement des Ouvertures

> **RÈGLE CRITIQUE** : *Les ouvertures (portes et fenêtres) sont TOUJOURS encastrées sur les murs ou cloisons.*
> Aucune ouverture ne peut exister ou flotter dans le vide sans mur hôte.

### Principes d'encastrement :
1. **Magnétisme géométrique (`findWallSnap`)** :
   - Tout placement de porte (`activeTool === 'door'`) ou fenêtre (`activeTool === 'window'`) projette automatiquement le centre de l'ouverture sur le segment du mur ou de la cloison le plus proche.
   - L'ouverture adopte instantanément l'angle (`angle`) et l'épaisseur (`thickness`) du mur hôte.
   - Les points extrémités $P_1(x_1, y_1)$ et $P_2(x_2, y_2)$ sont calculés le long du vecteur directeur unitaire du mur selon la largeur demandée (`openingWidth`).
   - L'identifiant du mur est scellé dans `hostWallId`.
2. **Découpes maçonnerie SVG automatiques** :
   - Chaque mur hôte applique un masque de découpe SVG (`maskUnits="userSpaceOnUse"`) au niveau de ses ouvertures encastrées.
   - Les hachures de béton (`#wall-concrete-hatch`) et les fonds solides s'interrompent proprement au droit de la baie.
   - Des traits de tableau de maçonnerie (retours d'écoinçon) ferment les deux extrémités de la réservation.
3. **Glissement interactif (Drag & Slide)** :
   - Lorsqu'une ouverture est déplacée sur le plan, elle glisse exclusivement le long de son mur hôte (ou se transfère sur un mur voisin s'il est plus proche). Elle ne se désolidarise jamais de la maçonnerie.
4. **Insertion depuis la bibliothèque (`CadLibraryPanel`)** :
   - Toute menuiserie insérée par clic ou drag-and-drop est automatiquement projetée et encastrée sur le mur le plus proche du point de dépôt.
5. **Débattement et sens de battant** :
   - Portes battantes avec arc de débattement normalisé (pointillés fins à 90° ou 45°), pivot, bâti et seuil.
   - Inversion du sens (Tirant Droit / Gauche) en un clic ou via le raccourci `[Espace]`.
   - Fenêtres avec dormant, appui maçonné extérieur, double vitrage thermique ou vantaux coulissants pour les baies.

---

## 3. Système d'Unités et Échelle
- **Échelle Canvas** : $1 \text{ px} = 10 \text{ mm}$ ($10 \text{ px} = 100 \text{ mm} = 10 \text{ cm}$, $100 \text{ px} = 1000 \text{ mm} = 1 \text{ m}$).
- **Grille par défaut** : 20 px ($200 \text{ mm}$), commutable avec accrochage F9.
- **Affichages utilisateur** :
  - Distances et dimensions : en millimètres ($\text{mm}$) ou mètres ($\text{m}$).
  - Épaisseurs de mur : $200 \text{ mm}$ (mur porteur), $72 \text{ mm}$ (cloison Placostil BA13), $98 \text{ mm}$ (cloison acoustique).
  - Surfaces : en mètres carrés ($\text{m²}$) calculées selon la formule de Shoelace (polygones) ou produit rectangulaire.

---

## 4. Calques Normalisés (Layers)
1. `structures` (#38bdf8) : Murs porteurs extérieurs et refends béton armé.
2. `cloisons` (#4edea3) : Cloisons distributives et séparatives légères.
3. `ouvertures` (#fbbf24) : Portes intérieures, portes palières, fenêtres et baies vitrées.
4. `mobilier` (#a78bfa) : Mobilier, équipements sanitaires, agencement cuisine et séjour.
5. `cotations` (#f472b6) : Lignes de cotes associatives, cotes de niveau, surfaces de pièces.

---

## 5. Raccourcis Clavier du Studio CAO
| Touche | Fonction |
|---|---|
| `V` | Outil Sélection & Manipulation |
| `W` | Outil Mur porteur |
| `C` | Outil Cloison Placostil |
| `P` | Outil Porte encastrée sur mur |
| `F` | Outil Fenêtre / Baie encastrée sur mur |
| `D` | Outil Cotation associative |
| `H` | Outil Hachures paramétriques |
| `R` | Outil Rectangle (Zones & Pièces) |
| `L` | Outil Ligne brisée / Polygone libre |
| `M` | Outil Mesure en direct (ΔX, ΔY, distance réelle) |
| `Espace` | Inverser le sens du battant de porte (Tirant Droit / Gauche) |
| `Entrée` | Valider et fermer un polygone en cours |
| `Échap` | Annuler le tracé en cours ou désélectionner |
| `Suppr` / `Retour` | Supprimer les entités sélectionnées |
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir (Historique avec pile d'états) |
| `Ctrl+D` | Dupliquer la sélection avec décalage |

---

## 6. Architecture des Fichiers Clés
- `src/types.ts` : Interfaces TypeScript unifiées (`CadEntity`, `CadBlock`, `CadLayer`, `ProjectData`, `MaterialDefinition`).
- `src/agent.ts` : Service d'analyse et d'exécution IA pour interpréter les intentions architecturales en actions CAO (`ArckiCadAgent`, audits RE2020, conformité PMR).
- `src/components/CadEditor.tsx` : Moteur de rendu SVG, boucle d'événements souris/clavier, accrochage OSNAP, découpes de maçonnerie, dock latéral et barre de commandes CLI.
- `src/components/PropertiesSidebar.tsx` : Inspecteur d'attributs de l'entité sélectionnée, intégrant le panneau complet de paramétrage des ouvertures encastrées.
- `src/components/CadLibraryPanel.tsx` : Bibliothèque de composants architecturaux et menuiseries classés par catégories.
- `src/components/LayerManager.tsx` : Gestionnaire de calques (visibilité, verrouillage, couleur, épaisseur de trait).
- `src/components/ExportModal.tsx` : Export vectoriel DXF (AutoCAD R12), SVG haute fidélité et rapport métrique JSON.

---

## 7. Moteur IA & Copilote Spatial (`src/agent.ts`)
L'agent IA dispose des modules suivants :
1. **Auditeur Réglementaire** :
   - Conformité RE2020 : vérification du ratio de surface vitrée $\ge 1/6$ ($16.7\%$) de la surface habitable totale.
   - Conformité Accessibilité PMR : vérification des passages utiles $\ge 900\text{ mm}$ pour les portes principales.
   - Conformité Encastrement : vérification que $100\%$ des ouvertures sont rattachées à un mur valide.
2. **Interprétation de Prompts Spatiaux** :
   - Analyse du langage naturel pour exécuter des actions directes sur le canvas CAO (création d'éléments, audits, modifications).

---

## 8. Règles pour les Modifications du Codebase
1. **Toujours compiler et valider** : Exécuter `compile_applet` et `lint_applet` après toute modification de code pour garantir une compilation TypeScript stricte (`tsc --noEmit`) sans aucune régression.
2. **Cohérence du style visuel** : Thème sombre technique inspiré d'AutoCAD/Revit moderne, typographies `Inter` et `JetBrains Mono`, bordures nettes et contrastes accessibles.
3. **Zéro simulation factice pour les ouvertures** : Tout ajout de porte ou fenêtre doit obligatoirement passer par `findWallSnap` et respecter l'encastrement sur maçonnerie.
