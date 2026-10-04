# 01 — Architecture de l'application

## 🎯 Objectif
Savoir **où vit chaque chose** (état, rendu, interaction, calcul) avant de modifier quoi que ce soit.

---

## 1. Vue d'ensemble

```
index.html → src/main.tsx → src/App.tsx
                               │  ScreenType : 'dashboard' | 'editor' | 'auth'
                               ├─ Dashboard.tsx      (liste des projets)
                               ├─ AuthScreen.tsx
                               └─ CadEditor.tsx      ← TOUT l'éditeur
                                     ├─ barre haute (outil/paramètres contextuels, niveau, calques)
                                     ├─ rail de gauche (onglets : Plan, Vues, Calques, Mise en page, Rendu, Blocs, Config)
                                     ├─ bande d'outils (V, W, C, R, L, P, F, A, D, H, M, T…)
                                     ├─ zone centrale  = UN des trois rendus, selon activeRail :
                                     │      'plan'   → canevas SVG 2D (dessin)
                                     │      'views'  → <ViewsPanel/>   (façades & coupes)
                                     │      'layout' → <LayoutPanel/>  (planches)
                                     ├─ dock de droite (onglets : Propriétés, Calques, Bibliothèque, Copilote IA)
                                     └─ barre de commande CLI + barre d'état
```

## 2. Qui fait quoi

| Fichier | Rôle | Contient de l'état ? |
|---|---|---|
| `src/types.ts` | **Contrat de données** : `CadEntity`, `CadTool`, `CadLayer`, `CadLevel`, `CadSettings`, `LayoutSheet`… | non |
| `src/components/CadEditor.tsx` | État + boucle d'événements + rendu du plan + câblage des panneaux | **oui (tout l'état de l'éditeur)** |
| `src/components/PropertiesSidebar.tsx` | Inspecteur de l'entité sélectionnée | non (props) |
| `src/components/CadLibraryPanel.tsx` | Bibliothèque de blocs (`PREDEFINED_CAD_BLOCKS`) | un peu (filtres) |
| `src/components/LayerManager.tsx` | Gestion des calques | un peu (UI) |
| `src/components/LevelManager.tsx` | Gestion des niveaux (RDC, R+1…) | non |
| `src/components/ViewsPanel.tsx` | Onglet Vues (UI de réglage) | UI locale |
| `src/components/ElevationDrawing.tsx` | Dessin d'une façade/coupe (partagé Vues + Mise en page) | non |
| `src/components/LayoutPanel.tsx` | Éditeur de planches | sélection/zoom/glissé locaux ; planches dans `CadEditor` |
| `src/components/ExportModal.tsx` | Fenêtre d'export (interface ; voir guide 08) | UI locale |
| `src/wallGeometry.ts` | **Calcul pur** : ligne de référence, raccords de murs | non |
| `src/viewsGeometry.ts` | **Calcul pur** : projection façades / coupes | non |
| `src/agent.ts` | Analyse métrique/réglementaire locale (copilote) | non |
| `src/constants/materials.ts` | Matériaux (`MAT-01`…) | non |

> 💡 Les fichiers `*Geometry.ts` sont des **fonctions pures** : entrées → sorties, aucun état React. C'est l'endroit idéal pour mettre une logique nouvelle : elle sera testable et réutilisable (écran *et* impression).

## 3. L'état de `CadEditor` (les variables à connaître)

| Variable | Rôle |
|---|---|
| `entities` / `setEntities` | Entités du **niveau actif** |
| `selectedIds` | Identifiants sélectionnés |
| `activeTool` (`CadTool`) | Outil courant |
| `draftStart`, `polyPoints`… | Tracé en cours (le « fantôme ») |
| `activeRail` | Onglet du rail : `'plan' \| 'views' \| 'bim' \| 'layout' \| 'rendu' \| 'config'` |
| `rightDockTab` | Onglet du dock : `'props' \| 'layers' \| 'library' \| 'ai'` |
| `layers` | Calques |
| `levels`, `activeLevelId`, `otherLevels`, `entitiesByLevel` | Niveaux |
| `sheets`, `activeSheetId` | Planches de mise en page |
| `settings` (`CadSettings`) | Réglages globaux (grille, snap, ortho…) |
| `wallThickness`, `wallHeight`, `wallJustif`, `partitionThickness`… | Paramètres des outils mur/cloison |
| `historyStack` / `redoStack` | Annuler / rétablir |
| `panOffset`, `canvasZoom`, `cursorPos` | Caméra et curseur (coordonnées plan) |

## 4. Le flux d'une action utilisateur

```
Clic souris ─► handleCanvasMouseDown / handleCanvasClick
                │   (convertit écran → plan, applique snap/ortho, route selon activeTool)
                ▼
          recordHistory()          ← photographie AVANT modification (annuler)
                ▼
          setEntities(prev => [...prev, nouvelleEntité])
                ▼
          re-rendu React ─► le SVG est recalculé à partir de `entities`
```

Règles :
- **Toujours** appeler `recordHistory()` avant une modification destinée à être annulable.
- **Jamais** muter `entities` en place : `setEntities(prev => prev.map(...))`.
- Les calculs lourds de géométrie vont dans `*Geometry.ts`, pas dans le JSX.

## 5. Où chercher ? (Grep)

| Je cherche… | Mot-clé |
|---|---|
| La création d'objets au clic | `handleCanvasClick` |
| La sélection / hit-test | `getEntityAtPoint`, `handleEntityClick` |
| Le rendu des murs | `3. WALLS & PARTITIONS` |
| La bande d'outils | `Compact CAD Drafting Tools Strip` |
| Les raccourcis clavier | `Tool keys` (dans l'écouteur `handleKeyDown`) |
| La CLI | `handleCliSubmit` |
| Le rail de gauche | `Extreme Left CAD Mode Rail` |
| Le dock de droite | `RIGHT MULTI-FUNCTIONAL DOCK` |

⬅️ [Index](./README.md) | [02 — Créer un outil ➡️](./02_creer_un_outil.md)
