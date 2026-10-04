# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on port 3000 (host 0.0.0.0)
npm run build    # vite build
npm run lint     # tsc --noEmit — the only static check; run it after every change
```

There is no test runner. `npm run clean` uses `rm -rf` (needs a POSIX shell on Windows).

## Project

ARCKI CAD: a French-language 2D parametric CAD studio for architects (React 19 + Vite + Tailwind 4, TypeScript). Pure client-side SPA — no backend is wired in, `@google/genai`/`express` are in `package.json` but unused in `src/`. The "AI copilot" in `src/agent.ts` is a local rule-based analyzer, not an LLM call. `AGENTS.md` / `AGENT.md` (near-identical) hold the full business spec in French (shortcuts, layers, units); read them before changing editor behavior. Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).

## Architecture

- `src/App.tsx` — screen router (`dashboard` / `editor` / `auth`) plus modals; project selection is hard-coded sample data.
- `src/components/CadEditor.tsx` (~6.6k lines) — the whole editor in one component: SVG rendering, mouse/keyboard loop, OSNAP, tools, undo/redo stack, CLI command bar, dock. Most features land here; use Grep for symbols rather than reading it whole.
- `src/components/PropertiesSidebar.tsx` (inspector), `CadLibraryPanel.tsx` (block library with drag-and-drop), `LayerManager.tsx`, `ExportModal.tsx` (DXF R12 / SVG / JSON export) are driven by state owned by `CadEditor`/`App`.
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

- **Levels**: `CadEditor` keeps `entities` = entities of the *active* level only, so all drawing code is level-agnostic. Other levels live in `otherLevels`; `gotoLevel` swaps them (and resets undo history). Anything needing all levels (e.g. `ViewsPanel`) uses `entitiesByLevel`. Level elevation/height are in mm; a new floor sits at `top + 200` (slab thickness).
- `ViewsPanel` (tab "Vues") and `LayoutPanel` (tab "Mise en page") replace the 2D viewport according to `activeRail`. Façade/coupe geometry lives in `src/viewsGeometry.ts` + `ElevationDrawing.tsx`, shared by both. Sheets (`LayoutSheet`: viewports at a given scale + texts + title block, paper mm) are state in `CadEditor` so they survive tab switches.
- **Tool availability** depends on `activeRail`: Plan = all tools, Vues = select, Mise en page = select + text (tool strip buttons disabled, global shortcuts ignored outside Plan). The `text` tool means a plan annotation (`CadEntity.type === 'text'`) in Plan and a sheet text in Mise en page.
- **Walls** (`src/wallGeometry.ts`): stored geometry is the wall *axis*; `refLine` (left/center/right of the drawing direction) is applied at creation and keeps the reference line fixed when edited. Joins (miter / T) are computed at render time, drawn as outlines-then-fills so joined walls merge.
