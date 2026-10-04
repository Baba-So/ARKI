# 11 — Projets, tableau de bord et exports

Ce guide décrit la chaîne **projet → enregistrement automatique → tableau de bord → exports**.

```
CadEditor (état)  ──snapshot──►  App  ──saveProject──►  projectStore (localStorage)
      ▲                           │                           │
      └── initialProject ◄── loadProject ◄───────────────────┘
                                  │
          Dashboard (useProjects) ┴──► ExportModal ──► exporters.tsx (SVG, DXF, PDF, JSON, CSV)
```

## 1. Le projet : `ProjectSnapshot`

Défini dans `src/types.ts`, c'est **tout ce qui est enregistré et exporté** :

| Champ | Contenu |
|---|---|
| `levels`, `activeLevelId`, `levelAutoStack` | niveaux ([chapitre 12](../chapitre_12_gestion_des_niveaux.md)) |
| `entitiesByLevel` | entités de **tous** les niveaux (dans l'éditeur, `entities` = niveau actif) |
| `layers` | calques |
| `sheets`, `activeSheetId` | planches de mise en page |

`ProjectMeta` est la **fiche** affichée au tableau de bord (nom, phase, version, dates, `stats`).
Les blocs importés ne sont pas dans le snapshot : ils sont dans `blockStore` et **embarqués dans le fichier projet** exporté.

## 2. Enregistrement automatique

- `CadEditor` construit `snapshot` à chaque rendu et appelle `onSnapshot(snapshot)` **600 ms après la dernière modification** (et une dernière fois au démontage si des changements restent).
- Il ne sauvegarde **rien tant que rien n'a changé** (`firstRun` / `dirty`) : ouvrir l'exemple sans le toucher ne crée pas de copie.
- `App.handleSnapshot` appelle `saveProject(id, snapshot)` (`src/projectStore.ts`) : document `arcki.project.<id>` + fiche dans l'index `arcki.projects.v1`, avec les statistiques recalculées (`computeStats`).
- À l'ouverture, `App.handleOpenProject` charge `loadProject(id)` et le passe à l'éditeur via `initialProject` ; `key` force un rechargement complet de l'éditeur.
- `getSnapshotRef` (ref fournie par `App`) permet à l'export de lire l'**état exact** de l'éditeur, même pendant le délai de 600 ms.

Projet d'exemple « Villa Horizon » : `SAMPLE_ENTITIES` / `DEFAULT_LAYERS` (`src/constants/sampleProject.ts`). Il apparaît toujours dans la liste ; une fois modifié, sa copie enregistrée le remplace ; « Réinitialiser » supprime la copie.

Nouveau projet : `createProject` → projet **vierge** (RDC à la hauteur sous plafond saisie, calques normalisés, une planche).

## 3. Le tableau de bord (`Dashboard.tsx`)

Entièrement piloté par les données : `useProjects()` (hook `useSyncExternalStore`) → cartes, liste, filtres par catégorie avec compteurs réels, tris, recherche (nom, lieu, phase).

- **Vignette réelle** : `PlanThumbnail` dessine le plan du niveau le plus bas du projet (murs raccordés, ouvertures, pièces).
- **Indicateurs** : projets, niveaux et objets, surface des pièces, **espace de stockage** utilisé (`storageUsage`, limite typique de 5 Mo).
- **Actions par projet** : renommer, dupliquer, exporter (ouvre `ExportModal` sur ce projet), supprimer (ou réinitialiser pour l'exemple).
- **Import** : un fichier `.arcki.json` (glisser-déposer ou sélection) → `importProjectFile` : validation de la structure, ajout des blocs manquants, **nouveau projet** créé. DXF/DWG/IFC ne sont pas importés (indiqué à l'écran).

## 4. Les exports (`exporters.tsx` + `ExportModal.tsx`)

| Format | Fonction | Remarques |
|---|---|---|
| **Projet ARCKI** `.arcki.json` | `exportProjectJson` | sauvegarde complète réimportable (inclut les blocs utilisés) |
| **SVG** | `exportSvg` | un bloc par niveau (le plus haut d'abord), échelle 1:20 → 1:500, largeur réelle en mm sur le papier ; utilise `PlanDrawing` rendu en statique |
| **DXF** | `exportDxf` | R12 (AC1009) ASCII, mm, **Y inversé**, calques ARCKI (suffixés du niveau s'il y en a plusieurs), **Z = altitude du niveau** ; murs = polylignes fermées issues de `computeWallPolygons` |
| **PDF** | `exportPdf` (+ `printSheets` en secours) | **vrai fichier `.pdf`** : une page par planche à la taille exacte du papier ; planche rendue en image à 150 / 200 / 300 dpi puis compressée sans perte. « Imprimer… » (`printSheets`) ouvre la fenêtre d'impression pour un PDF **vectoriel** |
| **Rapport** | `exportMetricsJson` | métriques par niveau (`analyzePlanMetrics`) et totaux |
| **Métrés** | `exportSchedulesCsv` | pièces, murs et cloisons (longueur, surface brute), ouvertures ; `;` + BOM UTF-8 pour Excel |

Options : niveaux (cases), calques inclus (cases, par défaut les calques visibles), échelle (SVG), planches (PDF).

**Rendu statique** : SVG et PDF réutilisent les composants React de rendu (`PlanDrawing`, `SheetSvg` dans `sheetRender.tsx`) via `renderToStaticMarkup`, chargé par `import('react-dom/server')` **à la demande** pour ne pas alourdir le chargement initial. C'est ce qui garantit que **l'écran, l'impression et l'export montrent la même chose**.

### Comment fonctionne le PDF (`exportPdf`)
1. Chaque planche est rendue en SVG statique (`SheetSvg` + `renderToStaticMarkup`) avec des `width`/`height` en **pixels** = taille papier × dpi (résolution plafonnée à ≈ 40 millions de pixels : un A0 est automatiquement ramené vers ~100 dpi).
2. Le SVG est chargé dans une `Image` (URL de blob) puis dessiné sur un `<canvas>` blanc.
3. Les pixels RGB sont compressés avec `CompressionStream('deflate')` (zlib = `FlateDecode` du PDF) ; si le navigateur ne l'a pas, repli en JPEG (`DCTDecode`).
4. `buildPdf` écrit le fichier à la main (PDF 1.4 : catalogue, pages, une image plein cadre par page, table `xref`) — aucune dépendance. Les dimensions de page sont en points (`mm × 72 / 25,4`).

Limites : le contenu est **raster** (texte non sélectionnable) ; pour du vectoriel, passer par « Imprimer… ». Les polices sont celles du système (une `Image` SVG ne charge pas de polices web).

### Ajouter un format d'export
1. Écrire `exportXxx(snapshot, name, options): ExportFile` (`{ filename, mime, content }`) dans `exporters.tsx` — fonction pure, sans état React.
2. Ajouter son entrée à `FORMATS` dans `ExportModal.tsx`, et le cas dans `run()` (et dans `usesLevels` / `usesLayers` si besoin).
3. Respecter : 1 px = 10 mm, calques `visible`/inclus, niveaux, hauteur et altitude en mm.
4. Tester : télécharger, ouvrir dans le logiciel cible.

### Ajouter un indicateur au tableau de bord
Ajouter le champ à `ProjectStats` (`types.ts`), le calculer dans `computeStats` (`projectStore.ts`), l'afficher dans `Dashboard.tsx` — les anciens projets enregistrés n'ont pas le champ : prévoir une valeur par défaut à l'affichage.

## ⚠️ Pièges
- **Stockage plein** : `saveProject` renvoie `false` (le projet reste en mémoire seulement) ; exporter régulièrement le JSON.
- **Rendu serveur** : `renderToStaticMarkup` n'exécute ni effets ni hooks d'état ; les composants de rendu doivent rester **purs**.
- **Pop-up bloqué** : seul « Imprimer… » ouvre une fenêtre ; le navigateur peut la bloquer (message affiché). L'export PDF direct n'en a pas besoin.
- **Mémoire** : un très grand format à haute résolution demande de gros canevas ; la résolution est plafonnée automatiquement.
- **DXF et unités** : toujours multiplier par 10 (px → mm) et inverser Y.

⬅️ [10 — Blocs : vues, import, prompt IA](./10_blocs_vues_import_et_prompt_ia.md) | [Index](./README.md)
