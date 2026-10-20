# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on port 3000 (host 0.0.0.0)
npm run build    # vite build
npm run lint     # tsc --noEmit — static type check; run it after every change
npm test         # tsx src/tests/run.ts — node:assert tests of the pure modules (walls, levels, façades, exports, blocks, DXF import, projects)
```

There is no test framework: add cases to `src/tests/run.ts` (modules run under Node with an in-memory `localStorage`, see `src/tests/setup.ts`; code that needs `DOMParser`/`document` is not testable there). `npm run clean` uses `rm -rf` (needs a POSIX shell on Windows).

## Project

ARCKI CAD: a French-language 2D parametric CAD studio for architects (React 19 + Vite + Tailwind 4, TypeScript). Pure client-side SPA — no backend is wired in, `@google/genai`/`express` are in `package.json` but unused in `src/`. The "AI copilot" in `src/agent.ts` is a local rule-based analyzer, not an LLM call. `AGENTS.md` / `AGENT.md` (near-identical) hold the full business spec in French (shortcuts, layers, units); read them before changing editor behavior. Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).

## Architecture

- `src/App.tsx` — screen router (`dashboard` / `editor` / `auth`) plus modals; project selection is hard-coded sample data.
- `src/components/CadEditor.tsx` (~6.6k lines) — the whole editor in one component: SVG rendering, mouse/keyboard loop, OSNAP, tools, undo/redo stack, CLI command bar, dock. Most features land here; use Grep for symbols rather than reading it whole.
- `src/components/PropertiesSidebar.tsx` (inspector), `CadLibraryPanel.tsx` (block library with drag-and-drop), `LayerManager.tsx`, `ExportModal.tsx` are driven by state owned by `CadEditor`/`App`.
- `src/types.ts` — `CadEntity` is the single union-ish entity shape (walls, partitions, doors, windows, rooms, polygons, dimensions, hatches) discriminated by `type`; `CadTool` lists the tools.
- `src/constants/materials.ts` — material/hatch definitions.
- `src/tuto/` — French tutorial chapters documenting the engine; not code.

## Domain rules that cut across files

- **Scale**: 1 px = 10 mm (grid 20 px = 200 mm). Convert in both directions when computing lengths/areas (areas via Shoelace for polygons).
- **Openings are always hosted**: doors/windows must go through `findWallSnap` (`CadEditor.tsx`, ~line 939), which sets `hostWallId`, `angle`, `thickness` and endpoints. It is called from every insertion path (tool click, library drop, drag/slide ~1501, initial placement ~2832/6429). Never create an opening entity without it. Dragging slides along the host wall and may transfer to a neighbouring wall.
- **Masonry cutouts**: each host wall renders an SVG `<mask maskUnits="userSpaceOnUse">` to cut hatch/fill at its openings; keep it consistent when changing opening geometry.
- **Layers** are the five normalized ones (`structures`, `cloisons`, `ouvertures`, `mobilier`, `cotations`).
- `agent.ts` `analyzePlanMetrics` assumes the 10 mm/px scale and PMR door width ≥ 900 mm.

## Niveaux, vues et mise en page

- **Levels**: `CadEditor` keeps `entities` = entities of the *active* level only, so all drawing code is level-agnostic. Other levels live in `otherLevels`; `gotoLevel` swaps them (and resets undo history). Anything needing all levels (e.g. `ViewsPanel`) uses `entitiesByLevel`. Level elevation/height are in mm; a new floor sits at `top + 200` (slab thickness). `CadLevel.slabMm` is the slab under a level's floor (default 200); `src/levels.ts` `restackLevels` re-computes altitudes (RDC anchored at 0) and the "Configurer les étages" dialog (`LevelsConfigDialog`, applied by `applyLevelsConfig`) edits heights/slabs/count in one go.
- `ViewsPanel` (tab "Vues") and `LayoutPanel` (tab "Mise en page") replace the 2D viewport according to `activeRail`. Façade/coupe geometry lives in `src/viewsGeometry.ts` + `ElevationDrawing.tsx`, shared by both. Sheets (`LayoutSheet`: viewports at a given scale + texts + title block, paper mm) are state in `CadEditor` so they survive tab switches.
- **Tool availability** depends on `activeRail`: Plan = all tools, Vues = select, Mise en page = select + text + rect + polyline, which draw sheet shapes (`LayoutShape`: rectangle, ellipse, polyline/polygon/curve/freehand) (tool strip buttons disabled, global shortcuts ignored outside Plan). The `text` tool means a plan annotation (`CadEntity.type === 'text'`) in Plan and a sheet text in Mise en page. `handleCanvasClick`/`handleCanvasMouseDown` return early when `activeRail !== 'plan'`, otherwise clicks in Vues/Mise en page would leak into the plan tools.
- **Walls** (`src/wallGeometry.ts`): stored geometry is the wall *axis*; `refLine` (left/center/right of the drawing direction) is applied at creation and keeps the reference line fixed when edited. Joins (miter / T) are computed at render time, drawn as outlines-then-fills so joined walls merge.
- **Blocks** (`CadBlock`): mobilier = 3 views (`top`/`front`/`side`), opening = 2 (`top` = horizontal wall section, `front`), as SVG fragments in mm (`BlockViews`). `src/blockSymbols.ts` generates parametric symbols per `renderType`; imported blocks (JSON, `src/blockSchema.ts`, SVG sanitized by whitelist — never bypass it, views are injected with `dangerouslySetInnerHTML`) live in `src/blockStore.ts` (`useBlocks`, `findBlock`, persisted in localStorage). The plan draws a furniture entity's `top` view stretched into its box; façades draw an opening block's `front` view in the bay. The import dialog also builds the AI prompt (`buildBlockPrompt`). See `src/tuto/app/10_blocs_vues_import_et_prompt_ia.md`.

## Projets, tableau de bord, exports

- A project is a `ProjectSnapshot` (levels, `entitiesByLevel`, layers, sheets). `CadEditor` reports it via `onSnapshot` (600 ms debounce, only after a real change) and exposes the exact current state through `getSnapshotRef`; `App` autosaves it with `saveProject` (`src/projectStore.ts`, localStorage keys `arcki.projects.v1` / `arcki.project.<id>`) and reloads it through `initialProject` (editor `key` forces a full reload). "Villa Horizon" is a built-in sample (`src/constants/sampleProject.ts`); new projects start empty.
- `Dashboard.tsx` is data-driven (`useProjects`, real thumbnails via `PlanThumbnail`, real stats and storage usage, rename/duplicate/export/delete, `.arcki.json` import). Don't reintroduce mock numbers.
- Exports are real (`src/exporters.tsx`): project JSON, SVG, DXF R12 (mm, Y inverted, Z = level elevation), PDF as a real file: `exportPdfVector` (default; `SheetSvg` → jsPDF + svg2pdf.js, dynamically imported, selectable text) with automatic fallback to `exportPdf` (page rasterized at 150/200/300 dpi, Flate-compressed, hand-written PDF 1.4); `printSheets` = print-dialog alternative. Known svg2pdf limit: pattern fills (section cut hatching) are not all reproduced, metrics JSON, schedules CSV. SVG/PDF reuse the render components (`PlanDrawing`, `SheetSvg` in `components/sheetRender.tsx`) through `renderToStaticMarkup` (dynamically imported) — keep those components pure. See `src/tuto/app/11_projets_dashboard_et_exports.md`.

## Layout responsive de l'éditeur

- Zones : en-tête global (fixe, 56 px) → barre contextuelle (hauteur `min-h-10`, **elle peut passer sur 2 lignes**, ne jamais la remettre à hauteur fixe sinon la 2ᵉ ligne passe sous l'en-tête) → rail + bande d'outils + canevas + dock → CLI/état.
- Densité adaptée à l'écran avec des variantes Tailwind : largeur (`lg`, `xl`, `2xl` : libellés des sous-outils, bouton Calques, badges de l'en-tête) et **hauteur** (`[@media(max-height:760px)]:` rail sans libellés, `[@media(max-height:780px)]:` bande d'outils compacte, cartouche du plan masqué). Le rail défile (`overflow-y-auto`) ; la bande d'outils ne défile pas (le menu de sous-outils est un enfant absolu) donc elle doit tenir en hauteur.
- Dock droit : replié par défaut sous 1180 px de large, `w-72 xl:w-80`. Les tiroirs gauche Calques/Bibliothèque ne s'affichent que si le dock est fermé (jamais en double) ; les boutons du rail et de la barre ouvrent alors l'onglet correspondant du dock.
- **Popovers et fenêtres** : tout panneau flottant ouvert depuis la barre du haut (menu des niveaux, fenêtres de blocs / d'export / de configuration) est rendu dans `document.body` via `createPortal` ; le menu des niveaux est en plus en `position: fixed` calé sous son bouton (`getBoundingClientRect`), `z-[70]`, hauteur limitée à l'écran avec défilement. Un `absolute` dans la barre du haut passerait **sous** le dock et le rail (empilements `z-30`/`z-40` des frères suivants) et serait rogné.

## Divers (à connaître)

- **Hatches**: patterns live in `HatchPatterns.tsx` (`HatchPatternDef`); `hatchScale` / `hatchColor` on an entity generate a per-entity pattern `hatchx-<id>` (see `hatchPatternId`). Inspector: scale slider + colour.
- **Header actions** (undo / redo / fit) call the editor through `actionsRef` (set by `CadEditor`, read in `App`). The editor shows the real project name/phase via `projectInfo`.
- **DXF import** (`src/dxfImport.ts`): ASCII DXF only (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT/MTEXT), units from `$INSUNITS`, becomes a new project. "Tout sauvegarder" (dashboard) exports/imports every project + imported blocks (`arcki-workspace` file).
- `findWallSnap` now honours its `maxDistance` argument (callers passing 9999 stay unlimited); `Ctrl+Y` redoes; the AI audit runs on **all** levels.
