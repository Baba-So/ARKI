import React, { useState, useRef, useEffect } from 'react';
import { CadTool, CadSettings, CadLayer, CadEntity, CadBlock, CadLevel, LayoutSheet, ProjectSnapshot, WallSubTool, ShapeSubTool, PolylineSubTool } from '../types.ts';
import { DEFAULT_LAYERS, SAMPLE_ENTITIES } from '../constants/sampleProject.ts';
import { LayerManager } from './LayerManager.tsx';
import { PropertiesSidebar } from './PropertiesSidebar.tsx';
import { CadLibraryPanel } from './CadLibraryPanel.tsx';
import { ArckiCadAgent } from '../agent.ts';
import { ViewsPanel } from './ViewsPanel.tsx';
import { LayoutPanel, createSheet } from './LayoutPanel.tsx';
import { LevelManager } from './LevelManager.tsx';
import { LevelsConfigDialog, LevelsConfigResult } from './LevelsConfigDialog.tsx';
import { restackLevels } from '../levels.ts';
import { BlockSvg, blockColor } from './BlockSvg.tsx';
import { findBlock, useBlocks } from '../blockStore.ts';
import { inferRenderType, isOpeningBlock, openingKindOf } from '../blockSymbols.ts';
import { computeWallPolygons, polyToPoints, refToCenterline, justifToRef, refSign } from '../wallGeometry.ts';

interface CadEditorProps {
  onOpenNewProject: () => void;
  onOpenExport: () => void;
  /** Projet à charger (sinon : projet d'exemple « Villa Horizon »). */
  initialProject?: ProjectSnapshot;
  /** Appelé (avec temporisation) après chaque modification, et à la fermeture si des changements restent : enregistrement automatique + exports. */
  onSnapshot?: (snapshot: ProjectSnapshot) => void;
  /** Permet à App de lire l'état exact de l'éditeur à la demande (exports). */
  getSnapshotRef?: React.MutableRefObject<(() => ProjectSnapshot) | null>;
}

export const CadEditor: React.FC<CadEditorProps> = ({
  onOpenExport,
  initialProject,
  onSnapshot,
  getSnapshotRef,
}) => {
  // Navigation active tab in the left rail: 'plan' | 'views' | 'bim' | 'layout' | 'rendu' | 'config'
  const [activeRail, setActiveRail] = useState<'plan' | 'views' | 'bim' | 'layout' | 'rendu' | 'config'>('plan');
  
  // Active CAD tool on the left toolbar
  const [activeTool, setActiveTool] = useState<CadTool>('select');
  useBlocks(); // se re-rend quand des blocs sont importés / supprimés (symboles du plan)

  // Right Dock active tab: 'props' | 'layers' | 'library' | 'ai'
  const [rightDockTab, setRightDockTab] = useState<'props' | 'layers' | 'library' | 'ai'>('props');
  // Désactivation de l'ouverture automatique de la fenêtre des paramètres lors de la sélection (désactivée par défaut selon demande utilisateur)
  const [autoOpenPropsOnSelect, setAutoOpenPropsOnSelect] = useState(false);
  // Visibilité du panneau dock droit (rétractable)
  const [isRightDockOpen, setIsRightDockOpen] = useState(true);

  // Active Hatch Pattern for parametric hatch tool
  const [activeHatchPattern, setActiveHatchPattern] = useState<'briques' | 'beton' | 'bois' | 'isolation' | 'carrelage' | 'sable'>('briques');

  // Lateral Sidebar Layer Manager drawer
  const [isSidebarLayersOpen, setIsSidebarLayersOpen] = useState(false);
  // Lateral Sidebar Library drawer
  const [isSidebarLibraryOpen, setIsSidebarLibraryOpen] = useState(false);

  // Layers State
  const [layers, setLayers] = useState<CadLayer[]>(() => initialProject?.layers ?? DEFAULT_LAYERS);

  // Initial Villa Horizon CAD Entities
  const [entities, setEntities] = useState<CadEntity[]>(() =>
    initialProject ? initialProject.entitiesByLevel[initialProject.activeLevelId] ?? [] : SAMPLE_ENTITIES
  );

  // Selected Entities IDs set
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Niveaux (RDC, R+1, …) ─────────────────────────────────────────────
  // `entities` contient toujours les entités du niveau ACTIF (tout le code de dessin reste inchangé) ;
  // les autres niveaux sont rangés dans `otherLevels` et échangés lors d'un changement de niveau.
  const [levels, setLevels] = useState<CadLevel[]>(() => initialProject?.levels ?? [{ id: 'lvl-rdc', name: 'RDC', elevation: 0, height: 2800 }]);
  const [activeLevelId, setActiveLevelId] = useState(() => initialProject?.activeLevelId ?? 'lvl-rdc');
  const [otherLevels, setOtherLevels] = useState<Record<string, CadEntity[]>>(() => {
    if (!initialProject) return {};
    const { [initialProject.activeLevelId]: _active, ...rest } = initialProject.entitiesByLevel;
    void _active;
    return rest;
  });
  const [levelAutoStack, setLevelAutoStack] = useState(() => initialProject?.levelAutoStack ?? true); // altitudes recalculées automatiquement
  const [isLevelsConfigOpen, setIsLevelsConfigOpen] = useState(false);

  const activeLevel = levels.find(l => l.id === activeLevelId) || levels[0];

  // Un outil devenu indisponible dans l'onglet courant retombe sur la sélection
  useEffect(() => {
    const allowed = activeRail === 'plan' ? null : activeRail === 'layout' ? ['select', 'text', 'rect', 'polyline'] : ['select'];
    if (allowed && !allowed.includes(activeTool)) {
      setActiveTool('select');
      setDraftStart(null);
    }
  }, [activeRail]);

  // ── Mise en page : planches (conservées en changeant d'onglet) ──
  const [sheets, setSheets] = useState<LayoutSheet[]>(() =>
    initialProject?.sheets?.length ? initialProject.sheets : [createSheet('Plan RDC', initialProject?.activeLevelId ?? 'lvl-rdc', 50)]
  );
  const [activeSheetId, setActiveSheetId] = useState(() => initialProject?.activeSheetId ?? sheets[0].id);
  const entitiesByLevel: Record<string, CadEntity[]> = { ...otherLevels, [activeLevelId]: entities };
  // ── Enregistrement automatique / exports : l'instantané complet du projet est remonté à App ──
  const snapshot: ProjectSnapshot = { levels, activeLevelId, levelAutoStack, entitiesByLevel, layers, sheets, activeSheetId };
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  useEffect(() => {
    if (!getSnapshotRef) return;
    getSnapshotRef.current = () => snapRef.current;
    return () => { getSnapshotRef.current = null; };
  }, []);
  const firstRun = useRef(true);
  const dirty = useRef(false);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; } // pas d'enregistrement tant que rien n'a changé
    dirty.current = true;
    if (!onSnapshot) return;
    const t = setTimeout(() => { onSnapshot(snapRef.current); dirty.current = false; }, 600);
    return () => clearTimeout(t);
  }, [levels, entities, otherLevels, layers, sheets, levelAutoStack, activeLevelId, activeSheetId]);
  useEffect(() => () => { if (dirty.current) onSnapshot?.(snapRef.current); }, []); // dernière sauvegarde à la fermeture

  const entityCounts = Object.fromEntries(Object.entries(entitiesByLevel).map(([k, v]) => [k, v.length]));
  // Niveau situé juste en dessous : affiché en fond estompé pour le calage des murs
  const belowLevel = [...levels]
    .filter(l => l.elevation < activeLevel.elevation)
    .sort((a, b) => b.elevation - a.elevation)[0];
  const ghostEntities = belowLevel ? (entitiesByLevel[belowLevel.id] || []).filter(e => e.type === 'wall' || e.type === 'partition') : [];

  const gotoLevel = (id: string, data: Record<string, CadEntity[]>, lvls: CadLevel[]) => {
    const { [id]: target = [], ...rest } = data;
    setOtherLevels(rest);
    setEntities(target);
    setActiveLevelId(id);
    setSelectedIds([]);
    setHistoryStack([]);
    setRedoStack([]);
    const lv = lvls.find(l => l.id === id);
    if (lv) setWallHeight(lv.height);
  };
  const handleSelectLevel = (id: string) => {
    if (id === activeLevelId) return;
    gotoLevel(id, entitiesByLevel, levels);
  };
  const addLevel = (where: 'above' | 'below') => {
    const top = Math.max(...levels.map(l => l.elevation + l.height));
    const bottom = Math.min(...levels.map(l => l.elevation));
    const height = activeLevel.height;
    const nl: CadLevel =
      where === 'above'
        ? { id: `lvl-${Date.now()}`, name: `R+${levels.filter(l => l.elevation > 0).length + 1}`, elevation: top + 200, height }
        : { id: `lvl-${Date.now()}`, name: `SS-${levels.filter(l => l.elevation < 0).length + 1}`, elevation: bottom - height - 200, height };
    const next = [...levels, nl];
    setLevels(next);
    gotoLevel(nl.id, { ...entitiesByLevel, [nl.id]: [] }, next);
  };
  const duplicateLevel = (id: string) => {
    const src = levels.find(l => l.id === id);
    if (!src) return;
    const top = Math.max(...levels.map(l => l.elevation + l.height));
    const nl: CadLevel = { id: `lvl-${Date.now()}`, name: `R+${levels.filter(l => l.elevation > 0).length + 1}`, elevation: top + 200, height: src.height };
    const suffix = `-${nl.id.slice(-4)}`;
    const copy = (entitiesByLevel[id] || []).map(e => ({
      ...e,
      id: `${e.id}${suffix}`,
      hostWallId: e.hostWallId ? `${e.hostWallId}${suffix}` : e.hostWallId,
    }));
    const next = [...levels, nl];
    setLevels(next);
    gotoLevel(nl.id, { ...entitiesByLevel, [nl.id]: copy }, next);
  };
  const updateLevel = (id: string, patch: Partial<CadLevel>) => {
    let next = levels.map(l => (l.id === id ? { ...l, ...patch } : l));
    if (patch.elevation !== undefined) setLevelAutoStack(false); // altitude saisie à la main : on quitte le mode automatique
    else if (levelAutoStack && (patch.height !== undefined || patch.slabMm !== undefined)) next = restackLevels(next);
    setLevels(next);
    if (id === activeLevelId && patch.height) setWallHeight(patch.height);
  };
  /** Applique la configuration des étages (hauteurs, dalles, altitudes, niveaux ajoutés / supprimés). */
  const applyLevelsConfig = (r: LevelsConfigResult) => {
    const keep = new Set(r.levels.map(l => l.id));
    const data: Record<string, CadEntity[]> = { ...entitiesByLevel };
    Object.keys(data).forEach(k => { if (!keep.has(k)) delete data[k]; });
    r.levels.forEach(l => {
      if (!data[l.id]) data[l.id] = [];
      const old = levels.find(o => o.id === l.id);
      if (r.updateWalls && old && old.height !== l.height) {
        data[l.id] = data[l.id].map(e => (e.type === 'wall' || e.type === 'partition' ? { ...e, height: l.height } : e));
      }
    });
    const target = keep.has(activeLevelId)
      ? activeLevelId
      : [...r.levels].sort((a, b) => Math.abs(a.elevation) - Math.abs(b.elevation))[0].id;
    setLevels(r.levels);
    setLevelAutoStack(r.autoStack);
    gotoLevel(target, data, r.levels);
    setIsLevelsConfigOpen(false);
  };
  const deleteLevel = (id: string) => {
    if (levels.length <= 1) return;
    const next = levels.filter(l => l.id !== id);
    setLevels(next);
    const data = { ...entitiesByLevel };
    delete data[id];
    if (id === activeLevelId) {
      const fallback = [...next].sort((a, b) => a.elevation - b.elevation)[0];
      gotoLevel(fallback.id, data, next);
    } else {
      const { [activeLevelId]: _cur, ...rest } = data;
      void _cur;
      setOtherLevels(rest);
    }
  };

  // Undo history stack
  const [historyStack, setHistoryStack] = useState<CadEntity[][]>([]);
  const [redoStack, setRedoStack] = useState<CadEntity[][]>([]);

  // Push to history before changing entities
  const recordHistory = () => {
    setHistoryStack(prev => [...prev.slice(-15), entities]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack(prev => [...prev, entities]);
    setHistoryStack(prev => prev.slice(0, -1));
    setEntities(previous);
    setSelectedIds([]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack(prev => [...prev, entities]);
    setRedoStack(prev => prev.slice(0, -1));
    setEntities(next);
  };

  // Delete all selected entities
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    recordHistory();
    const count = selectedIds.length;
    setEntities(prev => prev.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
    setCliHistory(prev => [
      ...prev.slice(-3),
      `_DELETE : ${count} entité(s) supprimée(s).`,
      'Commande: ',
    ]);
  };

  // Duplicate selected entities
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    recordHistory();
    const newItems: CadEntity[] = [];
    const newIds: string[] = [];

    entities.forEach(e => {
      if (selectedIds.includes(e.id)) {
        const dupId = `${e.type}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        newIds.push(dupId);
        newItems.push({
          ...e,
          id: dupId,
          name: `${e.name} (Copie)`,
          x1: e.x1 + 30,
          y1: e.y1 + 30,
          x2: e.x2 + 30,
          y2: e.y2 + 30,
        });
      }
    });

    setEntities(prev => [...prev, ...newItems]);
    setSelectedIds(newIds);
  };

  // Insert a block from Library (via click or drag & drop)
  const handleInsertBlock = (block: CadBlock, targetX?: number, targetY?: number) => {
    let dropX = targetX;
    let dropY = targetY;

    if (dropX === undefined || dropY === undefined) {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        dropX = Math.round((rect.width / 2 - panOffset.x) / canvasZoom);
        dropY = Math.round((rect.height / 2 - panOffset.y) / canvasZoom);
      } else {
        dropX = 500;
        dropY = 400;
      }
    }

    // Openings (portes et fenêtres) : Encastrement obligatoire sur mur
    if (isOpeningBlock(block)) {
      const snap = findWallSnap(dropX, dropY, block.widthMm, 9999);
      if (!snap) {
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_INSERT [${block.name}] impossible : Les ouvertures sont toujours encastrées sur les murs. Tracez d'abord un mur ou une cloison.`,
          'Commande: '
        ]);
        return;
      }
      const isWin = openingKindOf(block) === 'window';
      const newEntity: CadEntity = {
        id: `${block.id}-${Date.now()}`,
        name: `${block.name} encastrée (${snap.wall.type === 'partition' ? 'Cloison' : 'Mur'})`,
        type: isWin ? 'window' : 'door',
        layerId: 'ouvertures',
        x1: snap.p1X,
        y1: snap.p1Y,
        x2: snap.p2X,
        y2: snap.p2Y,
        angle: snap.wallAngleDeg,
        thickness: snap.wallThickness,
        hostWallId: snap.wall.id,
        openingWidth: block.widthMm,
        doorSwing: activeDoorSwing || 'right',
        doorAngle: 90,
        flipSwing: activeFlipSide || false,
        label: block.name,
        subText: `${block.widthMm}x${block.heightMm} mm`,
        materialIndex: isWin ? 'MAT-06' : 'MAT-07',
        blockId: block.id,
      };

      recordHistory();
      setEntities(prev => [...prev, newEntity]);
      setSelectedIds([newEntity.id]);
      if (autoOpenPropsOnSelect) {
        setRightDockTab('props');
      }
      setCliHistory(prev => [
        ...prev.slice(-3),
        `_INSERT [${block.name}] encastrée sur "${snap.wall.name}" : L = ${block.widthMm} mm, Épaisseur = ${snap.wallThickness} mm, Angle = ${snap.wallAngleDeg}°`,
        'Commande: '
      ]);
      return;
    }

    const widthPx = Math.round(block.widthMm / 10);
    const heightPx = Math.round(block.heightMm / 10);

    const newEntity: CadEntity = {
      id: `${block.id}-${Date.now()}`,
      name: block.name,
      type: 'furniture',
      layerId: block.defaultLayer,
      x1: dropX - Math.round(widthPx / 2),
      y1: dropY - Math.round(heightPx / 2),
      x2: dropX + Math.round(widthPx / 2),
      y2: dropY + Math.round(heightPx / 2),
      label: block.name,
      subText: `${block.widthMm}x${block.heightMm} mm`,
      materialIndex: 'MAT-07',
      blockId: block.id,
    };

    recordHistory();
    setEntities(prev => [...prev, newEntity]);
    setSelectedIds([newEntity.id]);
    if (autoOpenPropsOnSelect) {
      setRightDockTab('props');
    }
    setCliHistory(prev => [
      ...prev.slice(-3),
      `_INSERT [${block.name}] aux coordonnées <${dropX * 10}, ${dropY * 10}>`,
      'Commande: '
    ]);
  };

  // Handle Drag & Drop of Blocks onto CAD Canvas
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const block: CadBlock = JSON.parse(dataStr);
      if (!canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const dropX = Math.round((e.clientX - rect.left - panOffset.x) / canvasZoom);
      const dropY = Math.round((e.clientY - rect.top - panOffset.y) / canvasZoom);

      handleInsertBlock(block, dropX, dropY);
    } catch (err) {
      console.error('Error dropping block', err);
    }
  };

  // Layer callbacks
  const handleToggleVisibility = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  };

  const handleToggleLock = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l));
  };

  const handleChangeColor = (layerId: string, color: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, color } : l));
  };

  const handleAddLayer = (name: string, category: CadLayer['category'], color: string) => {
    const newL: CadLayer = {
      id: `layer-${Date.now()}`,
      name,
      category,
      color,
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 0,
      lineweight: '0.20mm',
    };
    setLayers(prev => [...prev, newL]);
  };

  // Get active layer details
  const getLayer = (layerId: string) => {
    return layers.find(l => l.id === layerId) || layers[0];
  };

  // Wall & Partition parametric settings in sub-toolbar
  const [wallType, setWallType] = useState('Mur Porteur Extérieur');
  const [wallThickness, setWallThickness] = useState(200);
  // Ligne de référence → axe réel : décale (x1,y1,x2,y2) selon la justification active
  const placeWall = (x1: number, y1: number, x2: number, y2: number, thicknessMm: number) => {
    const ref = justifToRef(wallJustif);
    const c = refToCenterline(x1, y1, x2, y2, thicknessMm, ref);
    return { ...c, refLine: ref };
  };
  const [wallHeight, setWallHeight] = useState(2800);
  const [wallLength, setWallLength] = useState(4250);
  const [wallJustif, setWallJustif] = useState<'Nu Gauche' | 'Axe' | 'Nu Droite'>('Axe');
  const [chaining, setChaining] = useState(true);

  // Partition (Cloisons) dedicated settings
  const [partitionType, setPartitionType] = useState('Placostil 72mm (BA13)');
  const [partitionThickness, setPartitionThickness] = useState(72);

  // Openings (Portes & Fenêtres) parametric settings & smart snap state
  const [doorWidthSetting, setDoorWidthSetting] = useState(830);
  const [windowWidthSetting, setWindowWidthSetting] = useState(1200);
  const [activeDoorSwing, setActiveDoorSwing] = useState<'right' | 'left'>('right');
  const [activeFlipSide, setActiveFlipSide] = useState<boolean>(false);
  const [draggingOpeningId, setDraggingOpeningId] = useState<string | null>(null);

  // Dynamic AI Diff state
  const [isAiDiffApplied, setIsAiDiffApplied] = useState(false);
  const [isAiDiffPreview, setIsAiDiffPreview] = useState(false);

  // Interactive CAD Drawing & P1 Anchor state
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);

  // Outils & Sous-outils paramétriques
  // 1. Mur : Mur droit (single) | Mur en continu (continuous) | 4 Murs rectangle (rect)
  const [wallSubTool, setWallSubTool] = useState<WallSubTool>('single');
  // 2. Cloison : Cloison droite (single) | Cloison continue (continuous) | 4 Cloisons rectangle (rect)
  const [partitionSubTool, setPartitionSubTool] = useState<WallSubTool>('single');
  // 3. Forme : Rectangle (rect) | Cercle (circle)
  const [shapeSubTool, setShapeSubTool] = useState<ShapeSubTool>('rect');
  // 4. Polygone / Tracé : Trait droit (straight) | Tracé libre main levée (freehand) | Courbe arc (curve)
  const [polylineSubTool, setPolylineSubTool] = useState<PolylineSubTool>('straight');

  // Tracé à main levée (Freehand)
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Tracé de courbe / Arc 3 points (P1, P2, Courbure)
  const [curveP1, setCurveP1] = useState<{ x: number; y: number } | null>(null);
  const [curveP2, setCurveP2] = useState<{ x: number; y: number } | null>(null);
  const [curveStep, setCurveStep] = useState<0 | 1 | 2>(0);

  // Popover latéral des sous-outils
  const [activeFlyout, setActiveFlyout] = useState<'wall' | 'partition' | 'rect' | 'polyline' | null>(null);

  // Multi-point drafting for Polygons & Polylines
  const [polyPoints, setPolyPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [rectMode, setRectMode] = useState<'zone' | 'walls'>('zone'); // Mode rectangle: Zone fermée ou 4 Murs

  // Real-time Distance Measurement state (M / _DIST)
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureResult, setMeasureResult] = useState<{
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    distanceMm: number;
    dxMm: number;
    dyMm: number;
    angleDeg: number;
  } | null>(null);

  // Box Selection (Marquis drag)
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxCurrent, setBoxCurrent] = useState<{ x: number; y: number } | null>(null);

  // Dynamic Canvas coordinates & crosshairs
  const [cursorPos, setCursorPos] = useState({ x: 985, y: 690 });
  const [isOverCanvas, setIsOverCanvas] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  // Synchronized refs for 60fps wheel zoom without stale closures
  const canvasZoomRef = useRef(canvasZoom);
  canvasZoomRef.current = canvasZoom;
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;

  // Déplacement interactif d'entités sélectionnées (Translate / Move)
  const [isDraggingEntities, setIsDraggingEntities] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragInitialEntities, setDragInitialEntities] = useState<Map<string, CadEntity>>(new Map());
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Modification paramétrique par poignées (Grips / Handles)
  const [activeGrip, setActiveGrip] = useState<{
    entityId: string;
    gripType: string;
    initialEntity: CadEntity;
  } | null>(null);
  const [hoveredGrip, setHoveredGrip] = useState<{ entityId: string; gripType: string } | null>(null);

  // Canvas Ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Fonctions de Zoom interactives (Molette & Boutons)
  const handleZoomIn = () => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setCanvasZoom(prev => {
      const newZoom = Math.min(prev * 1.25, 10);
      setPanOffset(p => {
        const cadX = (cx - p.x) / prev;
        const cadY = (cy - p.y) / prev;
        return { x: cx - cadX * newZoom, y: cy - cadY * newZoom };
      });
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setCanvasZoom(prev => {
      const newZoom = Math.max(prev / 1.25, 0.1);
      setPanOffset(p => {
        const cadX = (cx - p.x) / prev;
        const cadY = (cy - p.y) / prev;
        return { x: cx - cadX * newZoom, y: cy - cadY * newZoom };
      });
      return newZoom;
    });
  };

  const handleZoomReset = () => {
    setCanvasZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleZoomFit = () => {
    if (entities.length === 0 || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entities.forEach(ent => {
      const x1 = ent.x1 ?? 0;
      const y1 = ent.y1 ?? 0;
      const x2 = ent.x2 ?? (x1 + 60);
      const y2 = ent.y2 ?? (y1 + 60);
      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);
    });

    if (minX === Infinity) return;
    const contentW = maxX - minX + 120;
    const contentH = maxY - minY + 120;
    const fitZoom = Math.min(Math.max(Math.min((rect.width * 0.85) / contentW, (rect.height * 0.85) / contentH), 0.15), 4);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setCanvasZoom(fitZoom);
    setPanOffset({
      x: rect.width / 2 - midX * fitZoom,
      y: rect.height / 2 - midY * fitZoom,
    });
  };

  // Clic sur une poignée pour amorcer la modification
  const handleGripMouseDown = (entity: CadEntity, gripType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setActiveGrip({
      entityId: entity.id,
      gripType,
      initialEntity: { ...entity },
    });
  };

  // Zoom Molette centré sur la position réelle du curseur & Pan Trackpad
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      const currentZoom = canvasZoomRef.current;
      const currentPan = panOffsetRef.current;

      // Panoramique fluide au pavé tactile (défilement horizontal/vertical sans pincement)
      if (!e.ctrlKey && (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) < 30)) {
        setPanOffset({
          x: currentPan.x - e.deltaX,
          y: currentPan.y - e.deltaY,
        });
        return;
      }

      // Zoom professionnel centré sur le point sous la souris
      const isPinch = e.ctrlKey;
      const sensitivity = isPinch ? 0.015 : 0.0018;
      const factor = Math.exp(-e.deltaY * sensitivity);
      const newZoom = Math.min(Math.max(currentZoom * factor, 0.1), 10);

      const cadX = (mouseScreenX - currentPan.x) / currentZoom;
      const cadY = (mouseScreenY - currentPan.y) / currentZoom;

      const newPanX = mouseScreenX - cadX * newZoom;
      const newPanY = mouseScreenY - cadY * newZoom;

      setCanvasZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Snap detection state
  const [activeSnap, setActiveSnap] = useState<{ x: number; y: number; type: string } | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  // CAD Modes / Toggles
  const [settings, setSettings] = useState<CadSettings>({
    snap: true,
    snapToGrid: true, // Magnétisme à la grille 20px activé par défaut
    gridSnapSize: 20, // Pas de 20px (200mm à l'échelle CAO)
    gridDisplayType: 'both',
    ortho: true,
    polar: false,
    osnap: true,
    grid: true,
    lineWeight: false,
    dynHud: true,
    units: 'mm',
    precision: '0.1',
    wallThickness: 200,
    wallHeight: 2800,
    wallJustif: 'Axe',
    wallMaterial: 'Béton banché + ITE 140mm',
    chaining: true,
    level: 'RDC (+0.00m)',
    projection: 'ORTHOGONAL 2D',
  });

  // CLI State
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<string[]>([
    'ARCKI CAD Core v4.8 initialisé.',
    'Tapez une commande ou sélectionnez un outil (V: Sélection, W: Mur, C: Cloison, P: Porte).',
    'Commande: ',
  ]);

  // AI Copilot prompt chat
  const [aiPrompt, setAiPrompt] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'user',
      text: 'Agrandir le salon à 36 m² en repoussant la façade Sud de 800 mm...',
    },
    {
      sender: 'assistant',
      text: 'Proposition prête : 1 mur porteur déplacé (+800mm Y), 2 cloisons étirées, 3 cotes et surfaces recalculées (Salon: 32.4 → 36.1 m²).',
    },
  ]);

  // OSNAP Proximity Detection
  const detectSnap = (x: number, y: number) => {
    if (!settings.osnap) return null;
    const threshold = 14;

    // Check all entity endpoints and corners
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;

      // Endpoint 1
      if (Math.hypot(x - ent.x1, y - ent.y1) < threshold) {
        return { x: ent.x1, y: ent.y1, type: 'Extrémité' };
      }
      // Endpoint 2
      if (Math.hypot(x - ent.x2, y - ent.y2) < threshold) {
        return { x: ent.x2, y: ent.y2, type: 'Extrémité' };
      }
      // Midpoint
      const midX = (ent.x1 + ent.x2) / 2;
      const midY = (ent.y1 + ent.y2) / 2;
      if (Math.hypot(x - midX, y - midY) < threshold) {
        return { x: midX, y: midY, type: 'Milieu' };
      }
    }

    // Fixed Villa Horizon reference point at (560, 680)
    if (Math.hypot(x - 560, y - 680) < threshold) {
      return { x: 560, y: 680, type: 'Extrémité [5600, 6800]' };
    }

    return null;
  };

  // Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  // Trouve le mur ou cloison le plus proche et calcule la projection exacte pour encastrer l'ouverture
  const findWallSnap = (
    px: number,
    py: number,
    openingWidthMm = 830,
    maxDistance = 140
  ): {
    wall: CadEntity;
    projX: number;
    projY: number;
    tClamped: number;
    p1X: number;
    p1Y: number;
    p2X: number;
    p2Y: number;
    wallAngleDeg: number;
    wallAngleRad: number;
    wallThickness: number;
    distance: number;
    openingWidthMm: number;
  } | null => {
    const candidateWalls = entities.filter(e => {
      if (e.type !== 'wall' && e.type !== 'partition') return false;
      const l = getLayer(e.layerId);
      return l.visible && !l.locked;
    });

    if (candidateWalls.length === 0) return null;

    let bestSnap: any = null;
    let minDistance = Infinity;

    const openingLengthPx = openingWidthMm / 10;
    const halfWidthPx = openingLengthPx / 2;

    for (const wall of candidateWalls) {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const wallLen = Math.hypot(dx, dy);
      if (wallLen < 15) continue;

      const ux = dx / wallLen;
      const uy = dy / wallLen;

      // Projection scalaire de (px, py) le long du mur
      const tRaw = ((px - wall.x1) * dx + (py - wall.y1) * dy) / (wallLen * wallLen);

      // Clamp pour que l'ouverture reste entièrement encastrée dans la longueur du mur
      let tClamped: number;
      if (wallLen > openingLengthPx + 8) {
        const minT = (halfWidthPx + 3) / wallLen;
        const maxT = 1 - (halfWidthPx + 3) / wallLen;
        tClamped = Math.max(minT, Math.min(maxT, tRaw));
      } else {
        tClamped = 0.5;
      }

      const projX = Math.round((wall.x1 + tClamped * dx) * 10) / 10;
      const projY = Math.round((wall.y1 + tClamped * dy) * 10) / 10;
      const dist = Math.hypot(px - projX, py - projY);

      if (dist < minDistance) {
        minDistance = dist;
        const wallAngleRad = Math.atan2(dy, dx);
        const wallAngleDeg = Math.round((wallAngleRad * 180 / Math.PI + 360) % 360);
        const wallThickness = wall.thickness || (wall.type === 'partition' ? 72 : 200);

        bestSnap = {
          wall,
          projX,
          projY,
          tClamped,
          p1X: Math.round((projX - ux * halfWidthPx) * 10) / 10,
          p1Y: Math.round((projY - uy * halfWidthPx) * 10) / 10,
          p2X: Math.round((projX + ux * halfWidthPx) * 10) / 10,
          p2Y: Math.round((projY + uy * halfWidthPx) * 10) / 10,
          wallAngleDeg,
          wallAngleRad,
          wallThickness,
          distance: dist,
          openingWidthMm,
        };
      }
    }

    // Toujours retourner le mur le plus proche pour garantir l'encastrement strict sur maçonnerie
    return bestSnap;
  };

  // Récupère toutes les ouvertures (portes et fenêtres) encastrées sur un mur ou cloison donné
  const getOpeningsForWall = (wall: CadEntity): CadEntity[] => {
    return entities.filter(ent => {
      if (ent.type !== 'door' && ent.type !== 'window') return false;
      const l = getLayer(ent.layerId);
      if (!l.visible) return false;

      // 1. Détection par hostWallId direct
      if (ent.hostWallId === wall.id) return true;

      // 2. Ou proximité géométrique du centre de l'ouverture avec l'axe du mur
      const midX = (ent.x1 + ent.x2) / 2;
      const midY = (ent.y1 + ent.y2) / 2;
      const d = distToSegment(midX, midY, wall.x1, wall.y1, wall.x2, wall.y2);
      const wallThickPx = (wall.thickness || 200) / 10;
      return d <= (wallThickPx / 2 + 10);
    });
  };

  // Ré-encastrer et réaligner précisément une ouverture sur le mur le plus proche
  const handleSnapOpeningToWall = (openingId: string) => {
    const op = entities.find(e => e.id === openingId);
    if (!op) return;
    const opMidX = (op.x1 + op.x2) / 2;
    const opMidY = (op.y1 + op.y2) / 2;
    const snap = findWallSnap(opMidX, opMidY, op.openingWidth || 830, 9999);
    if (!snap) return;
    recordHistory();
    setEntities(prev => prev.map(e => {
      if (e.id !== openingId) return e;
      return {
        ...e,
        x1: snap.p1X,
        y1: snap.p1Y,
        x2: snap.p2X,
        y2: snap.p2Y,
        angle: snap.wallAngleDeg,
        thickness: snap.wallThickness,
        hostWallId: snap.wall.id,
        wallPositionRatio: snap.tClamped,
      };
    }));
    setCliHistory(prev => [
      ...prev.slice(-3),
      `_SNAP [${op.name}] ré-encastrée avec succès sur "${snap.wall.name}" (ép. ${snap.wallThickness}mm, angle ${snap.wallAngleDeg}°)`,
      'Commande: '
    ]);
  };

  // Find CAD entity directly under the cursor center with CAD pickbox tolerance
  const getEntityAtPoint = (px: number, py: number, pickboxTolerance = 9): CadEntity | null => {
    // 1. Check dimensions, openings (doors & windows) - high precision
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;
      if (ent.type === 'dim') {
        const d1 = distToSegment(px, py, ent.x1, ent.y1, ent.x2, ent.y2);
        const ang = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
        const perpX = Math.sin(ang);
        const perpY = -Math.cos(ang);
        const offset = ent.dimOffset || 16;
        const d2 = distToSegment(px, py, ent.x1 + perpX * offset, ent.y1 + perpY * offset, ent.x2 + perpX * offset, ent.y2 + perpY * offset);
        if (Math.min(d1, d2) <= pickboxTolerance + 6) return ent;
      } else if (ent.type === 'door') {
        const d = distToSegment(px, py, ent.x1, ent.y1, ent.x2, ent.y2);
        const midX = (ent.x1 + ent.x2) / 2;
        const midY = (ent.y1 + ent.y2) / 2;
        const distCenter = Math.hypot(px - midX, py - midY);
        const doorLen = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1) || 80;
        if (d <= pickboxTolerance + 8 || distCenter <= doorLen * 0.75) return ent;
      } else if (ent.type === 'window') {
        const d = distToSegment(px, py, ent.x1, ent.y1, ent.x2, ent.y2);
        const th = (ent.thickness || 200) / 20;
        if (d <= pickboxTolerance + th + 4) return ent;
      }
    }
    // 2. Check walls and partitions
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;
      if (['wall', 'partition', 'line', 'polyline'].includes(ent.type)) {
        const halfThick = ent.thickness ? ent.thickness / 20 : 6;
        const d = distToSegment(px, py, ent.x1, ent.y1, ent.x2, ent.y2);
        if (d <= halfThick + pickboxTolerance) return ent;
      }
    }
    // 3. Check furniture, rects, circles, curves, and polygons
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;
      if (ent.type === 'text') {
        const lines = (ent.label || '').split('\n');
        const fs = ent.fontSize || 14;
        const tw = Math.max(...lines.map(l => l.length), 1) * fs * 0.6;
        if (px >= ent.x1 - pickboxTolerance && px <= ent.x1 + tw + pickboxTolerance && py >= ent.y1 - fs - pickboxTolerance && py <= ent.y1 + (lines.length - 1) * fs * 1.2 + pickboxTolerance) return ent;
      }
      if (ent.type === 'furniture' || ent.type === 'rect') {
        const minX = Math.min(ent.x1, ent.x2) - pickboxTolerance;
        const maxX = Math.max(ent.x1, ent.x2) + pickboxTolerance;
        const minY = Math.min(ent.y1, ent.y2) - pickboxTolerance;
        const maxY = Math.max(ent.y1, ent.y2) + pickboxTolerance;
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) return ent;
      }
      if (ent.type === 'circle') {
        const r = ent.radius ?? Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
        const distCenter = Math.hypot(px - ent.x1, py - ent.y1);
        if (Math.abs(distCenter - r) <= pickboxTolerance + 6 || distCenter <= r) return ent;
      }
      if (ent.type === 'curve') {
        const cp = ent.curvePoint ?? { x: (ent.x1 + ent.x2) / 2, y: (ent.y1 + ent.y2) / 2 };
        const d1 = distToSegment(px, py, ent.x1, ent.y1, cp.x, cp.y);
        const d2 = distToSegment(px, py, cp.x, cp.y, ent.x2, ent.y2);
        if (Math.min(d1, d2) <= pickboxTolerance + 8) return ent;
      }
      if ((ent.type === 'polygon' || ent.type === 'polyline') && ent.points && ent.points.length > 1) {
        const pts = ent.points;
        const n = pts.length;
        for (let i = 0; i < (ent.isClosed ? n : n - 1); i++) {
          const j = (i + 1) % n;
          const d = distToSegment(px, py, pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          if (d <= pickboxTolerance + 6) return ent;
        }
        if (ent.isClosed) {
          let inside = false;
          for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) return ent;
        }
      }
    }
    // 4. Check rooms (bounding box)
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;
      if (ent.type === 'room') {
        const minX = Math.min(ent.x1, ent.x2);
        const maxX = Math.max(ent.x1, ent.x2);
        const minY = Math.min(ent.y1, ent.y2);
        const maxY = Math.max(ent.y1, ent.y2);
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) return ent;
      }
    }
    return null;
  };

  // Handle Mouse movement on CAD canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Déplacement de la vue / Panoramique (Pan)
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left - panOffset.x) / canvasZoom;
    const rawY = (e.clientY - rect.top - panOffset.y) / canvasZoom;
    let x = Math.round(rawX);
    let y = Math.round(rawY);

    // Snap-to-grid: Magnétisme à la grille 20px (pour les outils de tracé, mesure et modification)
    const gridStep = settings.gridSnapSize || 20;
    const isDrawingOrModifying = ['partition', 'wall', 'dim', 'rect', 'line', 'measure', 'door', 'window', 'polyline', 'select'].includes(activeTool);
    const isGridSnapActive = (settings.snapToGrid || settings.snap) && isDrawingOrModifying;

    if (isGridSnapActive) {
      x = Math.round(rawX / gridStep) * gridStep;
      y = Math.round(rawY / gridStep) * gridStep;
    }

    // OSNAP Object Snap detection (priorité aux extrémités d'objets)
    const snap = detectSnap(x, y);
    if (snap) {
      x = snap.x;
      y = snap.y;
      setActiveSnap(snap);
    } else if (isGridSnapActive) {
      setActiveSnap({ x, y, type: `Grille ${gridStep}px [${x * 10}, ${y * 10}]` });
    } else {
      setActiveSnap(null);
    }

    // Ortho lock if drawing or measuring with an anchor P1
    const activeAnchor = draftStart || (activeTool === 'measure' ? measureStart : null);
    if (settings.ortho && activeAnchor && (['wall', 'partition', 'line'].includes(activeTool) || activeTool === 'measure')) {
      const dx = Math.abs(x - activeAnchor.x);
      const dy = Math.abs(y - activeAnchor.y);
      if (dx > dy) {
        y = activeAnchor.y; // Lock horizontally
      } else {
        x = activeAnchor.x; // Lock vertically
      }
    }

    setCursorPos({ x, y });

    // Capture des points de tracé libre (Freehand)
    if (isDrawingFreehand) {
      const lastPt = freehandPoints[freehandPoints.length - 1];
      if (!lastPt || Math.hypot(x - lastPt.x, y - lastPt.y) >= 4) {
        setFreehandPoints(prev => [...prev, { x, y }]);
      }
    }

    // 2. MODIFICATION D'UNE POIGNÉE ACTIVE (Grip Stretch / Resize / Vertex Move)
    if (activeGrip) {
      const initial = activeGrip.initialEntity;
      let targetX = x;
      let targetY = y;

      // Contrainte Orthogonale pour modification de mur/cloison/ligne
      if (settings.ortho && ['wall', 'partition', 'line'].includes(initial.type)) {
        if (activeGrip.gripType === 'p1') {
          const dx = Math.abs(targetX - initial.x2);
          const dy = Math.abs(targetY - initial.y2);
          if (dx > dy) targetY = initial.y2;
          else targetX = initial.x2;
        } else if (activeGrip.gripType === 'p2') {
          const dx = Math.abs(targetX - initial.x1);
          const dy = Math.abs(targetY - initial.y1);
          if (dx > dy) targetY = initial.y1;
          else targetX = initial.x1;
        }
      }

      setEntities(prev => prev.map(item => {
        if (item.id !== activeGrip.entityId) return item;

        // Murs, Cloisons, Lignes, Cotations
        if (activeGrip.gripType === 'p1') {
          const newLen = Math.round(Math.hypot(item.x2 - targetX, item.y2 - targetY) * 10);
          return { ...item, x1: targetX, y1: targetY, lengthMm: newLen };
        }
        if (activeGrip.gripType === 'p2') {
          const newLen = Math.round(Math.hypot(targetX - item.x1, targetY - item.y1) * 10);
          return { ...item, x2: targetX, y2: targetY, lengthMm: newLen };
        }
        if (activeGrip.gripType === 'mid') {
          const curMidX = (initial.x1 + initial.x2) / 2;
          const curMidY = (initial.y1 + initial.y2) / 2;
          const dx = targetX - curMidX;
          const dy = targetY - curMidY;
          return {
            ...item,
            x1: initial.x1 + dx,
            y1: initial.y1 + dy,
            x2: initial.x2 + dx,
            y2: initial.y2 + dy,
          };
        }

        // Pièces et Rectangles (Coins et arêtes étirables)
        if (item.type === 'room' || item.type === 'rect') {
          let rx1 = initial.x1;
          let ry1 = initial.y1;
          let rx2 = initial.x2;
          let ry2 = initial.y2;

          if (activeGrip.gripType === 'corner-tl') { rx1 = targetX; ry1 = targetY; }
          else if (activeGrip.gripType === 'corner-tr') { rx2 = targetX; ry1 = targetY; }
          else if (activeGrip.gripType === 'corner-br') { rx2 = targetX; ry2 = targetY; }
          else if (activeGrip.gripType === 'corner-bl') { rx1 = targetX; ry2 = targetY; }
          else if (activeGrip.gripType === 'edge-top') { ry1 = targetY; }
          else if (activeGrip.gripType === 'edge-right') { rx2 = targetX; }
          else if (activeGrip.gripType === 'edge-bottom') { ry2 = targetY; }
          else if (activeGrip.gripType === 'edge-left') { rx1 = targetX; }

          const wMm = Math.abs(rx2 - rx1) * 10;
          const hMm = Math.abs(ry2 - ry1) * 10;
          const newArea = Math.round((wMm * hMm) / 10000) / 100;
          return {
            ...item,
            x1: rx1,
            y1: ry1,
            x2: rx2,
            y2: ry2,
            area: newArea,
          };
        }

        // Polygones et traits multiples (déplacement de sommet)
        if (activeGrip.gripType.startsWith('point-') && item.points) {
          const idx = parseInt(activeGrip.gripType.replace('point-', ''), 10);
          const nextPts = [...item.points];
          nextPts[idx] = { x: targetX, y: targetY };
          return { ...item, points: nextPts };
        }

        // Blocs mobiliers
        if (item.type === 'furniture') {
          if (activeGrip.gripType === 'mid') {
            const bx1 = initial.x1;
            const by1 = initial.y1;
            const bx2 = initial.x2;
            const by2 = initial.y2;
            const curMidX = (bx1 + bx2) / 2;
            const curMidY = (by1 + by2) / 2;
            const dx = targetX - curMidX;
            const dy = targetY - curMidY;
            return {
              ...item,
              x1: bx1 + dx,
              y1: by1 + dy,
              x2: bx2 + dx,
              y2: by2 + dy,
            };
          }
        }

        // Formes Circulaires (centre et rayon)
        if (item.type === 'circle') {
          if (activeGrip.gripType === 'radius') {
            const newR = Math.max(5, Math.hypot(targetX - item.x1, targetY - item.y1));
            const rMm = Math.round(newR * 10);
            const areaM2 = Math.round(Math.PI * Math.pow(rMm / 1000, 2) * 100) / 100;
            return {
              ...item,
              radius: newR,
              x2: targetX,
              y2: targetY,
              area: areaM2,
              label: `⌀ ${rMm * 2} mm`,
              subText: `R: ${rMm} mm · ${areaM2.toFixed(2)} m²`,
            };
          }
          if (activeGrip.gripType === 'center') {
            const dx = targetX - initial.x1;
            const dy = targetY - initial.y1;
            return {
              ...item,
              x1: targetX,
              y1: targetY,
              x2: (initial.x2 ?? initial.x1) + dx,
              y2: (initial.y2 ?? initial.y1) + dy,
            };
          }
        }

        // Courbes / Arcs Bézier
        if (item.type === 'curve') {
          if (activeGrip.gripType === 'p1') {
            return { ...item, x1: targetX, y1: targetY };
          }
          if (activeGrip.gripType === 'p2') {
            return { ...item, x2: targetX, y2: targetY };
          }
          if (activeGrip.gripType === 'control') {
            return { ...item, curvePoint: { x: targetX, y: targetY } };
          }
        }

        return item;
      }));
      return;
    }

    // 3. DÉPLACEMENT INTERACTIF EN GROUPE DES ÉLÉMENTS SÉLECTIONNÉS (Translate / Move)
    if (isDraggingEntities && dragStartPos && dragInitialEntities.size > 0) {
      let deltaX = x - dragStartPos.x;
      let deltaY = y - dragStartPos.y;

      if (settings.ortho) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          deltaY = 0;
        } else {
          deltaX = 0;
        }
      }

      setDragDelta({ dx: deltaX, dy: deltaY });

      setEntities(prev => prev.map(ent => {
        const initial = dragInitialEntities.get(ent.id);
        if (!initial) {
          // Si le mur hôte d'une porte/fenêtre est déplacé, déplacer l'ouverture avec lui !
          if ((ent.type === 'door' || ent.type === 'window') && ent.hostWallId && dragInitialEntities.has(ent.hostWallId)) {
            return {
              ...ent,
              x1: ent.x1 + deltaX,
              y1: ent.y1 + deltaY,
              x2: ent.x2 + deltaX,
              y2: ent.y2 + deltaY,
            };
          }
          return ent;
        }

        // Murs, Cloisons, Cotes, Lignes
        if (ent.type === 'wall' || ent.type === 'partition' || ent.type === 'dim' || ent.type === 'line') {
          return {
            ...ent,
            x1: initial.x1 + deltaX,
            y1: initial.y1 + deltaY,
            x2: initial.x2 + deltaX,
            y2: initial.y2 + deltaY,
          };
        }
        // Pièces et Rectangles
        if (ent.type === 'room' || ent.type === 'rect') {
          return {
            ...ent,
            x1: initial.x1 + deltaX,
            y1: initial.y1 + deltaY,
            x2: initial.x2 + deltaX,
            y2: initial.y2 + deltaY,
          };
        }
        // Cercles
        if (ent.type === 'circle') {
          return {
            ...ent,
            x1: initial.x1 + deltaX,
            y1: initial.y1 + deltaY,
            x2: (initial.x2 ?? initial.x1) + deltaX,
            y2: (initial.y2 ?? initial.y1) + deltaY,
          };
        }
        // Courbes
        if (ent.type === 'curve') {
          return {
            ...ent,
            x1: initial.x1 + deltaX,
            y1: initial.y1 + deltaY,
            x2: initial.x2 + deltaX,
            y2: initial.y2 + deltaY,
            curvePoint: initial.curvePoint ? { x: initial.curvePoint.x + deltaX, y: initial.curvePoint.y + deltaY } : undefined,
          };
        }
        // Blocs et mobilier
        if (ent.type === 'furniture') {
          return {
            ...ent,
            x1: initial.x1 + deltaX,
            y1: initial.y1 + deltaY,
            x2: initial.x2 + deltaX,
            y2: initial.y2 + deltaY,
          };
        }
        // Polygones
        if (ent.points && initial.points) {
          return {
            ...ent,
            points: initial.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })),
          };
        }
        return {
          ...ent,
          x1: initial.x1 + deltaX,
          y1: initial.y1 + deltaY,
          x2: initial.x2 + deltaX,
          y2: initial.y2 + deltaY,
        };
      }));
      return;
    }

    // Box selection update
    if (isBoxSelecting && boxStart) {
      setBoxCurrent({ x, y });
    }

    // Détection de survol pour l'outil de sélection
    if (activeTool === 'select' && !isBoxSelecting && !isDraggingEntities && !activeGrip) {
      const hit = getEntityAtPoint(x, y, 9);
      setHoveredEntityId(hit ? hit.id : null);
    } else if (hoveredEntityId) {
      setHoveredEntityId(null);
    }

    // 4. Glissement fluide d'une ouverture (porte / fenêtre) le long d'un mur hôte
    if (draggingOpeningId) {
      const op = entities.find(ent => ent.id === draggingOpeningId);
      if (op) {
        const snapW = findWallSnap(rawX, rawY, op.openingWidth || 830, 250);
        if (snapW) {
          setEntities(prev => prev.map(ent => {
            if (ent.id !== draggingOpeningId) return ent;
            return {
              ...ent,
              x1: snapW.p1X,
              y1: snapW.p1Y,
              x2: snapW.p2X,
              y2: snapW.p2Y,
              angle: snapW.wallAngleDeg,
              thickness: snapW.wallThickness,
              hostWallId: snapW.wall.id,
              wallPositionRatio: snapW.tClamped,
            };
          }));
        }
      }
    }
  };

  // Handle Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Vues / Mise en page : les panneaux gèrent leurs propres interactions, le plan ne réagit pas
    if (activeRail !== 'plan') return;
    // Clic Molette (button 1) ou Alt+Clic ou Espace maintenu ou Outil Pan : Panoramique immédiat
    if (e.button === 1 || e.altKey || isSpaceHeld || activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (e.button !== 0) return; // Bouton gauche uniquement

    // Tracé libre (Polygone / Libre) : début de capture au maintien du clic
    if (activeTool === 'polyline' && polylineSubTool === 'freehand') {
      setIsDrawingFreehand(true);
      setFreehandPoints([{ x: cursorPos.x, y: cursorPos.y }]);
      return;
    }

    // Si outil sélection : sélection ou déplacement d'éléments
    if (activeTool === 'select') {
      const targetEntityId = (e.target as HTMLElement).closest('[data-entity-id]')?.getAttribute('data-entity-id');
      const clickedEntity = (targetEntityId ? entities.find(ent => ent.id === targetEntityId) : null) || getEntityAtPoint(cursorPos.x, cursorPos.y, 9);

      if (clickedEntity) {
        const l = getLayer(clickedEntity.layerId);
        if (!l.locked) {
          let currentSelected = selectedIds;
          if (e.shiftKey) {
            currentSelected = selectedIds.includes(clickedEntity.id)
              ? selectedIds.filter(id => id !== clickedEntity.id)
              : [...selectedIds, clickedEntity.id];
            setSelectedIds(currentSelected);
          } else {
            if (!selectedIds.includes(clickedEntity.id)) {
              currentSelected = [clickedEntity.id];
              setSelectedIds(currentSelected);
            }
          }

          if (autoOpenPropsOnSelect) {
            setRightDockTab('props');
          }

          // Déplacement de porte/fenêtre encastrée sur mur
          if (clickedEntity.type === 'door' || clickedEntity.type === 'window') {
            setDraggingOpeningId(clickedEntity.id);
          } else {
            // Début du déplacement interactif des entités sélectionnées
            setIsDraggingEntities(true);
            setDragStartPos({ x: cursorPos.x, y: cursorPos.y });
            const initMap = new Map<string, CadEntity>();
            entities.forEach(ent => {
              if (currentSelected.includes(ent.id)) {
                initMap.set(ent.id, { ...ent });
              }
            });
            setDragInitialEntities(initMap);
          }
        }
        setIsBoxSelecting(false);
        setBoxStart(null);
        setBoxCurrent(null);
      } else {
        // Clic dans le vide : rectangle de sélection
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setIsBoxSelecting(true);
        setBoxStart({ x: cursorPos.x, y: cursorPos.y });
        setBoxCurrent({ x: cursorPos.x, y: cursorPos.y });
      }
    }
  };

  // Handle Canvas Mouse Up (Ends box selection, element drag & grip modification)
  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Fin du tracé libre (Freehand)
    if (isDrawingFreehand) {
      if (freehandPoints.length >= 3) {
        const isClosed = Math.hypot(freehandPoints[0].x - freehandPoints[freehandPoints.length - 1].x, freehandPoints[0].y - freehandPoints[freehandPoints.length - 1].y) < 24;
        const pts = [...freehandPoints];
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const minY = Math.min(...pts.map(p => p.y));
        const maxY = Math.max(...pts.map(p => p.y));
        let polyArea = 0;
        if (isClosed) {
          let s = 0;
          for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
          }
          polyArea = Math.round(Math.abs(s / 2) / 10000) / 100;
        }

        const newEntity: CadEntity = {
          id: `freehand-${Date.now()}`,
          name: isClosed ? `Forme Libre Fermée (${pts.length} pts)` : `Tracé Libre (${pts.length} pts)`,
          type: isClosed ? 'polygon' : 'polyline',
          layerId: 'structures',
          x1: minX,
          y1: minY,
          x2: maxX,
          y2: maxY,
          points: pts,
          isClosed,
          area: polyArea > 0 ? polyArea : undefined,
          label: isClosed ? `FORME LIBRE (${pts.length} PTS)` : `TRACÉ LIBRE`,
          subText: polyArea > 0 ? `${polyArea} m²` : undefined,
        };
        recordHistory();
        setEntities(prev => [...prev, newEntity]);
        setSelectedIds([newEntity.id]);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_FREEHAND Tracé libre créé : ${pts.length} points ${isClosed ? `(Polygone fermé - ${polyArea} m²)` : '(Polyligne ouverte)'}`,
          'Commande: ',
        ]);
      }
      setIsDrawingFreehand(false);
      setFreehandPoints([]);
      return;
    }

    // Fin de modification d'une poignée
    if (activeGrip) {
      recordHistory();
      setCliHistory(prev => [
        ...prev.slice(-3),
        `_STRETCH : Poignée [${activeGrip.gripType}] modifiée avec succès.`,
        'Commande: ',
      ]);
      setActiveGrip(null);
    }

    // Fin de déplacement d'entités
    if (isDraggingEntities) {
      if (Math.hypot(dragDelta.dx, dragDelta.dy) > 1) {
        recordHistory();
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_MOVE : ${dragInitialEntities.size} entité(s) déplacée(s) (ΔX: ${Math.round(dragDelta.dx * 10)} mm, ΔY: ${Math.round(dragDelta.dy * 10)} mm)`,
          'Commande: ',
        ]);
      }
      setIsDraggingEntities(false);
      setDragStartPos(null);
      setDragInitialEntities(new Map());
      setDragDelta({ dx: 0, dy: 0 });
    }

    if (draggingOpeningId) {
      recordHistory();
      setDraggingOpeningId(null);
    }

    if (isBoxSelecting && boxStart && boxCurrent) {
      setIsBoxSelecting(false);
      const dragDist = Math.hypot(boxCurrent.x - boxStart.x, boxCurrent.y - boxStart.y);

      if (dragDist > 5) {
        const minX = Math.min(boxStart.x, boxCurrent.x);
        const maxX = Math.max(boxStart.x, boxCurrent.x);
        const minY = Math.min(boxStart.y, boxCurrent.y);
        const maxY = Math.max(boxStart.y, boxCurrent.y);

        // Find entities within or intersecting selection box
        const selected: string[] = [];
        entities.forEach(ent => {
          const l = getLayer(ent.layerId);
          if (!l.visible || l.locked) return;

          const entMinX = Math.min(ent.x1, ent.x2);
          const entMaxX = Math.max(ent.x1, ent.x2);
          const entMinY = Math.min(ent.y1, ent.y2);
          const entMaxY = Math.max(ent.y1, ent.y2);

          // Box overlaps entity bounding box
          if (entMaxX >= minX && entMinX <= maxX && entMaxY >= minY && entMinY <= maxY) {
            selected.push(ent.id);
          }
        });

        setSelectedIds(prev => Array.from(new Set([...prev, ...selected])));
        if (selected.length > 0 && autoOpenPropsOnSelect) {
          setRightDockTab('props');
        }
      }
      setBoxStart(null);
      setBoxCurrent(null);
    }
  };

  // Handle element click to select / toggle & open properties sidebar
  const handleEntityClick = (e: React.MouseEvent, entity: CadEntity) => {
    const l = getLayer(entity.layerId);
    if (!l.visible || l.locked) return;

    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedIds(prev => 
        prev.includes(entity.id) ? prev.filter(id => id !== entity.id) : [...prev, entity.id]
      );
    } else {
      setSelectedIds([entity.id]);
    }
    if (autoOpenPropsOnSelect) {
      setRightDockTab('props');
    }
    if (activeTool !== 'select' && !draftStart) {
      setActiveTool('select');
    }
  };

  // Finalise et crée la forme polygonale ou polyligne à partir des traits
  const finalizePolygon = (pts: Array<{ x: number; y: number }>, isClosed = true) => {
    if (pts.length < 2) {
      setPolyPoints([]);
      return;
    }

    let areaPx = 0;
    let perimeterPx = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (isClosed || i < n - 1) {
        areaPx += pts[i].x * pts[j].y;
        areaPx -= pts[j].x * pts[i].y;
        perimeterPx += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      }
    }
    const areaM2 = Math.abs(areaPx * 100 / 2) / 1000000;
    const perimeterMm = Math.round(perimeterPx * 10);
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));

    const newPoly: CadEntity = {
      id: `poly-${Date.now()}`,
      name: isClosed
        ? `Polygone ${pts.length} sommets (${areaM2.toFixed(2)} m²)`
        : `Ligne brisée ${pts.length} traits (${(perimeterMm / 1000).toFixed(2)} m)`,
      type: isClosed ? 'polygon' : 'polyline',
      layerId: 'structures',
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: maxY,
      points: [...pts],
      isClosed,
      area: Number(areaM2.toFixed(2)),
      label: isClosed ? `POLYGONE (${pts.length} SOMMETS)` : `FORME (${pts.length} TRAITS)`,
      subText: isClosed ? `${areaM2.toFixed(2)} m² · P=${(perimeterMm / 1000).toFixed(2)}m` : `L=${(perimeterMm / 1000).toFixed(2)}m`,
      hatchPattern: activeHatchPattern,
      thickness: wallThickness,
      height: wallHeight,
    };

    recordHistory();
    setEntities(prev => [...prev, newPoly]);
    setSelectedIds([newPoly.id]);
    if (autoOpenPropsOnSelect) {
      setRightDockTab('props');
    }
    setPolyPoints([]);
    setCliHistory(prev => [
      ...prev.slice(-3),
      `_POLY Forme ${isClosed ? 'polygonale fermée' : 'polyligne'} créée : ${pts.length} traits (${isClosed ? `${areaM2.toFixed(2)} m²` : `${(perimeterMm / 1000).toFixed(2)} m`})`,
      'Commande: '
    ]);
  };

  // Handle Canvas Click to create elements
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeRail !== 'plan') return; // les clics dans Vues / Mise en page n'agissent pas sur le plan
    if (e.button !== 0 || isBoxSelecting) return;

    if (activeTool === 'select') {
      return; // Déjà géré précisément au centre du curseur dans handleCanvasMouseDown
    }

    // 0. TEXTE / ANNOTATION (T)
    if (activeTool === 'text') {
      const l = getLayer('cotations');
      if (l.locked) {
        alert("Le calque Cotations est verrouillé. Déverrouillez-le pour ajouter un texte.");
        return;
      }
      const content = window.prompt('Texte à insérer sur le plan :', 'Texte');
      if (content === null || content.trim() === '') return;
      const fs = 14;
      const lines = content.split('\n');
      const newText: CadEntity = {
        id: `text-${Date.now()}`,
        name: `Texte « ${content.slice(0, 24)} »`,
        type: 'text',
        layerId: 'cotations',
        x1: cursorPos.x,
        y1: cursorPos.y,
        x2: cursorPos.x + Math.max(...lines.map(s2 => s2.length), 1) * fs * 0.6,
        y2: cursorPos.y + lines.length * fs * 1.2,
        label: content,
        fontSize: fs,
      };
      recordHistory();
      setEntities(prev => [...prev, newText]);
      setSelectedIds([newText.id]);
      setActiveTool('select');
      if (autoOpenPropsOnSelect) {
        setRightDockTab('props');
      }
      return;
    }

    // 1. WALL CREATION (W) - Mur Droit, Mur Continu, 4 Murs Rectangle
    if (activeTool === 'wall') {
      const l = getLayer('structures');
      if (l.locked) {
        alert("Le calque Structures est verrouillé. Déverrouillez-le pour dessiner un mur.");
        return;
      }

      if (wallSubTool === 'rect') {
        // Sous-outil : 4 MURS RECTANGLE (Boîte 4 murs d'un coup)
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_WALL_RECT Coin 1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}>`,
            'Déplacez le curseur et cliquez pour fixer le 2ème coin (génère 4 murs connectés) :',
          ]);
        } else {
          const minX = Math.min(draftStart.x, cursorPos.x);
          const maxX = Math.max(draftStart.x, cursorPos.x);
          const minY = Math.min(draftStart.y, cursorPos.y);
          const maxY = Math.max(draftStart.y, cursorPos.y);
          const wMm = Math.round((maxX - minX) * 10);
          const hMm = Math.round((maxY - minY) * 10);
          if (wMm < 40 && hMm < 40) return;

          const now = Date.now();
          const wallTop: CadEntity = {
            id: `wall-top-${now}`,
            name: `Mur Extérieur Nord L=${wMm}mm`,
            type: 'wall',
            layerId: 'structures',
            ...placeWall(minX, minY, maxX, minY, wallThickness),
            thickness: wallThickness, height: wallHeight,
            material: 'Béton banché + ITE 140mm', materialIndex: 'MAT-01',
          };
          const wallRight: CadEntity = {
            id: `wall-right-${now}`,
            name: `Mur Extérieur Est L=${hMm}mm`,
            type: 'wall',
            layerId: 'structures',
            ...placeWall(maxX, minY, maxX, maxY, wallThickness),
            thickness: wallThickness, height: wallHeight,
            material: 'Béton banché + ITE 140mm', materialIndex: 'MAT-01',
          };
          const wallBottom: CadEntity = {
            id: `wall-bottom-${now}`,
            name: `Mur Extérieur Sud L=${wMm}mm`,
            type: 'wall',
            layerId: 'structures',
            ...placeWall(maxX, maxY, minX, maxY, wallThickness),
            thickness: wallThickness, height: wallHeight,
            material: 'Béton banché + ITE 140mm', materialIndex: 'MAT-01',
          };
          const wallLeft: CadEntity = {
            id: `wall-left-${now}`,
            name: `Mur Extérieur Ouest L=${hMm}mm`,
            type: 'wall',
            layerId: 'structures',
            ...placeWall(minX, maxY, minX, minY, wallThickness),
            thickness: wallThickness, height: wallHeight,
            material: 'Béton banché + ITE 140mm', materialIndex: 'MAT-01',
          };

          recordHistory();
          setEntities(prev => [...prev, wallTop, wallRight, wallBottom, wallLeft]);
          setSelectedIds([wallTop.id, wallRight.id, wallBottom.id, wallLeft.id]);
          setDraftStart(null);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_WALL_RECT 4 Murs Porteurs créés : ${wMm} × ${hMm} mm (${((wMm * hMm) / 1000000).toFixed(2)} m²)`,
            'Commande: ',
          ]);
        }
      } else {
        // Sous-outils : Mur Droit (single) ou Mur Continu (continuous)
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_WALL P1: <${cursorPos.x * 10}, ${cursorPos.y * 10}> [Mode: ${wallSubTool === 'continuous' ? 'Mur Continu' : 'Mur Droit'}]`,
            'Spécifiez le point suivant ou Entrée pour valider :',
          ]);
        } else {
          const lengthMm = Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10);
          if (lengthMm < 30) return;

          const newWall: CadEntity = {
            id: `wall-${Date.now()}`,
            name: `Mur Extérieur L=${lengthMm}mm`,
            type: 'wall',
            layerId: 'structures',
            ...placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, wallThickness),
            thickness: wallThickness,
            height: wallHeight,
            material: 'Béton banché + ITE 140mm',
            materialIndex: 'MAT-01',
          };
          recordHistory();
          setEntities(prev => [...prev, newWall]);
          setSelectedIds([newWall.id]);

          if (wallSubTool === 'continuous' || chaining) {
            setDraftStart({ x: cursorPos.x, y: cursorPos.y });
            setCliHistory(prev => [
              ...prev.slice(-3),
              `_WALL Segment créé : ${lengthMm} mm (Mur Continu actif)`,
              'Point suivant ou Échap/Entrée pour terminer :',
            ]);
          } else {
            setDraftStart(null);
            setCliHistory(prev => [
              ...prev.slice(-3),
              `_WALL Mur Droit créé : Longueur ${lengthMm} mm`,
              'Commande: ',
            ]);
          }
        }
      }
    }

    // 2. PARTITION CREATION (C) - Cloison Droite, Continue ou 4 Cloisons Rectangle
    else if (activeTool === 'partition') {
      const l = getLayer('cloisons');
      if (l.locked) {
        alert("Le calque Cloisons est verrouillé. Déverrouillez-le pour implanter des cloisons.");
        return;
      }

      if (partitionSubTool === 'rect') {
        // 4 CLOISONS RECTANGLE
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_PARTITION_RECT Coin 1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}>`,
            'Déplacez et cliquez pour fixer le 2ème coin (génère 4 cloisons connectées) :',
          ]);
        } else {
          const minX = Math.min(draftStart.x, cursorPos.x);
          const maxX = Math.max(draftStart.x, cursorPos.x);
          const minY = Math.min(draftStart.y, cursorPos.y);
          const maxY = Math.max(draftStart.y, cursorPos.y);
          const wMm = Math.round((maxX - minX) * 10);
          const hMm = Math.round((maxY - minY) * 10);
          if (wMm < 40 && hMm < 40) return;

          const now = Date.now();
          const pTop: CadEntity = {
            id: `part-top-${now}`, name: `Cloison Nord L=${wMm}mm`,
            type: 'partition', layerId: 'cloisons',
            ...placeWall(minX, minY, maxX, minY, partitionThickness),
            thickness: partitionThickness, height: wallHeight,
            material: partitionType, materialIndex: 'MAT-02',
          };
          const pRight: CadEntity = {
            id: `part-right-${now}`, name: `Cloison Est L=${hMm}mm`,
            type: 'partition', layerId: 'cloisons',
            ...placeWall(maxX, minY, maxX, maxY, partitionThickness),
            thickness: partitionThickness, height: wallHeight,
            material: partitionType, materialIndex: 'MAT-02',
          };
          const pBottom: CadEntity = {
            id: `part-bottom-${now}`, name: `Cloison Sud L=${wMm}mm`,
            type: 'partition', layerId: 'cloisons',
            ...placeWall(maxX, maxY, minX, maxY, partitionThickness),
            thickness: partitionThickness, height: wallHeight,
            material: partitionType, materialIndex: 'MAT-02',
          };
          const pLeft: CadEntity = {
            id: `part-left-${now}`, name: `Cloison Ouest L=${hMm}mm`,
            type: 'partition', layerId: 'cloisons',
            ...placeWall(minX, maxY, minX, minY, partitionThickness),
            thickness: partitionThickness, height: wallHeight,
            material: partitionType, materialIndex: 'MAT-02',
          };

          recordHistory();
          setEntities(prev => [...prev, pTop, pRight, pBottom, pLeft]);
          setSelectedIds([pTop.id, pRight.id, pBottom.id, pLeft.id]);
          setDraftStart(null);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_PARTITION_RECT 4 Cloisons créées : ${wMm} × ${hMm} mm (${((wMm * hMm) / 1000000).toFixed(2)} m²)`,
            'Commande: ',
          ]);
        }
      } else {
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_PARTITION P1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}> [Mode: ${partitionSubTool === 'continuous' ? 'Cloison Continue' : 'Cloison Droite'}]`,
            'Spécifiez le 2ème point sur la grille de points ou Échap pour annuler :',
          ]);
        } else {
          const lengthMm = Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10);
          if (lengthMm < 30) return;

          const newPart: CadEntity = {
            id: `partition-${Date.now()}`,
            name: `Cloison ${partitionType} L=${lengthMm}mm`,
            type: 'partition',
            layerId: 'cloisons',
            ...placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, partitionThickness),
            thickness: partitionThickness,
            height: wallHeight,
            material: partitionType,
            materialIndex: partitionType.includes('98') ? 'MAT-03' : partitionType.includes('Vitrée') ? 'MAT-08' : 'MAT-02',
          };
          recordHistory();
          setEntities(prev => [...prev, newPart]);
          setSelectedIds([newPart.id]);
          if (partitionSubTool === 'continuous' || chaining) {
            setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          } else {
            setDraftStart(null);
          }
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_PARTITION créée : ${lengthMm} mm`,
            partitionSubTool === 'continuous' ? 'Point suivant de cloison ou Échap :' : 'Commande : ',
          ]);
        }
      }
    }

    // 3. ENCASTREMENT AUTOMATIQUE DE PORTE SUR MUR (P)
    else if (activeTool === 'door') {
      const l = getLayer('ouvertures');
      if (l.locked) {
        alert("Le calque Menuiseries est verrouillé.");
        return;
      }

      const doorWidth = doorWidthSetting || 830;
      const snap = findWallSnap(cursorPos.x, cursorPos.y, doorWidth, 140);

      if (!snap) {
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_DOOR : Aucun mur détecté à proximité. Cliquez sur un mur ou une cloison pour y encastrer la porte.`,
          'Commande: ',
        ]);
        return;
      }

      const newDoor: CadEntity = {
        id: `door-${Date.now()}`,
        name: `Porte ${doorWidth}mm encastrée (${snap.wall.type === 'partition' ? 'Cloison' : 'Mur'})`,
        type: 'door',
        layerId: 'ouvertures',
        x1: snap.p1X,
        y1: snap.p1Y,
        x2: snap.p2X,
        y2: snap.p2Y,
        angle: snap.wallAngleDeg,
        thickness: snap.wallThickness,
        hostWallId: snap.wall.id,
        openingWidth: doorWidth,
        doorSwing: activeDoorSwing,
        doorAngle: 90,
        flipSwing: activeFlipSide,
        label: `PORTE ${doorWidth}mm`,
        materialIndex: 'MAT-07',
      };
      recordHistory();
      setEntities(prev => [...prev, newDoor]);
      setSelectedIds([newDoor.id]);
      if (autoOpenPropsOnSelect) {
        setRightDockTab('props');
      }
      setCliHistory(prev => [
        ...prev.slice(-3),
        `_DOOR encastrée sur "${snap.wall.name}" : L = ${doorWidth} mm, Épaisseur = ${snap.wallThickness} mm, Angle = ${snap.wallAngleDeg}°`,
        'Commande: ',
      ]);
    }

    // 4. ENCASTREMENT AUTOMATIQUE DE FENÊTRE SUR MUR (F)
    else if (activeTool === 'window') {
      const l = getLayer('ouvertures');
      if (l.locked) return;

      const winWidth = windowWidthSetting || 1200;
      const snap = findWallSnap(cursorPos.x, cursorPos.y, winWidth, 140);

      if (!snap) {
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_WINDOW : Aucun mur détecté à proximité. Cliquez sur un mur pour y encastrer la fenêtre.`,
          'Commande: ',
        ]);
        return;
      }

      const newWin: CadEntity = {
        id: `window-${Date.now()}`,
        name: `Fenêtre ${winWidth}x1250 encastrée (${snap.wall.name})`,
        type: 'window',
        layerId: 'ouvertures',
        x1: snap.p1X,
        y1: snap.p1Y,
        x2: snap.p2X,
        y2: snap.p2Y,
        angle: snap.wallAngleDeg,
        thickness: snap.wallThickness,
        hostWallId: snap.wall.id,
        openingWidth: winWidth,
        label: `FENÊTRE ${winWidth}x1250`,
        materialIndex: 'MAT-06',
      };
      recordHistory();
      setEntities(prev => [...prev, newWin]);
      setSelectedIds([newWin.id]);
      if (autoOpenPropsOnSelect) {
        setRightDockTab('props');
      }
      setCliHistory(prev => [
        ...prev.slice(-3),
        `_WINDOW encastrée sur "${snap.wall.name}" : L = ${winWidth} mm, Épaisseur = ${snap.wallThickness} mm, Angle = ${snap.wallAngleDeg}°`,
        'Commande: '
      ]);
    }

    // 5. COTATION AUTOMATIQUE (D / _DIM)
    else if (activeTool === 'dim') {
      const l = getLayer('cotations');
      if (l.locked) {
        alert("Le calque Cotations est verrouillé. Déverrouillez-le pour placer des cotations.");
        return;
      }

      if (!draftStart) {
        setDraftStart({ x: cursorPos.x, y: cursorPos.y });
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_DIM P1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}>`,
          'Spécifiez le 2ème point (P2) pour placer la ligne de cotation automatique :'
        ]);
      } else {
        const lengthMm = Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10);
        if (lengthMm < 30) return;

        const newDim: CadEntity = {
          id: `dim-${Date.now()}`,
          name: `Cotation ${lengthMm.toLocaleString('fr-FR')} mm (${(lengthMm / 1000).toFixed(2)} m)`,
          type: 'dim',
          layerId: 'cotations',
          x1: draftStart.x,
          y1: draftStart.y,
          x2: cursorPos.x,
          y2: cursorPos.y,
          label: `${lengthMm.toLocaleString('fr-FR')} mm`,
          subText: `${(lengthMm / 1000).toFixed(2)} m`,
          dimOffset: 16,
          dimOrientation: 'aligned',
        };
        recordHistory();
        setEntities(prev => [...prev, newDim]);
        setSelectedIds([newDim.id]);
        setDraftStart(null);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_DIM créée : ${lengthMm} mm (${(lengthMm / 1000).toFixed(2)} m) sur le calque Cotations`,
          'Commande: '
        ]);
      }
    }

    // 5B. HACHURES PARAMÉTRIQUES (H / _HATCH)
    else if (activeTool === 'hatch') {
      const hit = getEntityAtPoint(cursorPos.x, cursorPos.y, 16);
      const targetRoom = (hit && (hit.type === 'room' || hit.type === 'rect' || hit.type === 'wall'))
        ? hit
        : entities.find(e => (e.type === 'room' || e.type === 'rect') && cursorPos.x >= Math.min(e.x1, e.x2) && cursorPos.x <= Math.max(e.x1, e.x2) && cursorPos.y >= Math.min(e.y1, e.y2) && cursorPos.y <= Math.max(e.y1, e.y2));

      if (targetRoom) {
        recordHistory();
        setEntities(prev => prev.map(e => e.id === targetRoom.id ? { ...e, hatchPattern: activeHatchPattern } : e));
        setSelectedIds([targetRoom.id]);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_HATCH : Motif de hachures [${activeHatchPattern.toUpperCase()}] appliqué à ${targetRoom.name}`,
          'Commande: '
        ]);
      } else {
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_HATCH : Aucune pièce ou zone fermée détectée à ce point. Cliquez à l'intérieur d'une pièce.`,
          'Commande: '
        ]);
      }
    }

    // 6. FORME (R) - Rectangle ou Cercle
    else if (activeTool === 'rect') {
      if (shapeSubTool === 'circle') {
        // Sous-outil : CERCLE
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_CIRCLE Centre : <${cursorPos.x * 10}, ${cursorPos.y * 10}> mm`,
            'Déplacez le curseur et cliquez pour fixer le rayon du cercle :'
          ]);
        } else {
          const rPx = Math.max(5, Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y));
          const rMm = Math.round(rPx * 10);
          const dMm = rMm * 2;
          const areaM2 = Math.round(Math.PI * Math.pow(rMm / 1000, 2) * 100) / 100;
          if (rMm < 20) return;

          const newCircle: CadEntity = {
            id: `circle-${Date.now()}`,
            name: `Forme Circulaire ⌀${dMm}mm (R=${rMm}mm)`,
            type: 'circle',
            layerId: 'structures',
            x1: draftStart.x,
            y1: draftStart.y,
            x2: cursorPos.x,
            y2: cursorPos.y,
            radius: rPx,
            area: areaM2,
            label: `⌀ ${dMm} mm`,
            subText: `R: ${rMm} mm · ${areaM2.toFixed(2)} m²`,
            hatchPattern: activeHatchPattern,
            thickness: wallThickness,
            height: wallHeight,
          };
          recordHistory();
          setEntities(prev => [...prev, newCircle]);
          setSelectedIds([newCircle.id]);
          if (autoOpenPropsOnSelect) {
            setRightDockTab('props');
          }
          setDraftStart(null);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_CIRCLE Cercle créé : ⌀ ${dMm} mm (Rayon ${rMm} mm, Surface ${areaM2.toFixed(2)} m²)`,
            'Commande: '
          ]);
        }
      } else {
        // Sous-outil : RECTANGLE
        if (!draftStart) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_RECT Coin 1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}> mm`,
            'Déplacez le curseur et cliquez pour fixer le 2ème coin du rectangle :'
          ]);
        } else {
          const widthMm = Math.round(Math.abs(cursorPos.x - draftStart.x) * 10);
          const heightMm = Math.round(Math.abs(cursorPos.y - draftStart.y) * 10);
          const areaM2 = Math.round(((widthMm * heightMm) / 1000000) * 100) / 100;
          if (widthMm < 20 && heightMm < 20) return;

          const minX = Math.min(draftStart.x, cursorPos.x);
          const minY = Math.min(draftStart.y, cursorPos.y);
          const maxX = Math.max(draftStart.x, cursorPos.x);
          const maxY = Math.max(draftStart.y, cursorPos.y);

          const newRect: CadEntity = {
            id: `rect-${Date.now()}`,
            name: `Forme Rectangulaire ${widthMm}×${heightMm} mm`,
            type: 'rect',
            layerId: 'structures',
            x1: minX,
            y1: minY,
            x2: maxX,
            y2: maxY,
            area: areaM2,
            label: `${widthMm} × ${heightMm} mm`,
            subText: `${areaM2.toFixed(2)} m²`,
            hatchPattern: activeHatchPattern,
            thickness: wallThickness,
            height: wallHeight,
          };
          recordHistory();
          setEntities(prev => [...prev, newRect]);
          setSelectedIds([newRect.id]);
          if (autoOpenPropsOnSelect) {
            setRightDockTab('props');
          }
          setDraftStart(null);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_RECT Forme rectangulaire créée : ${widthMm} × ${heightMm} mm (${areaM2.toFixed(2)} m²)`,
            'Commande: '
          ]);
        }
      }
    }

    // 6B. POLYGONE & TRACÉ (L / _POLY) - Trait, Libre, ou Courbe
    else if (activeTool === 'polyline') {
      if (polylineSubTool === 'curve') {
        // Sous-outil : COURBE / ARC BÉZIER 3 POINTS
        if (curveStep === 0 || !curveP1) {
          setCurveP1({ x: cursorPos.x, y: cursorPos.y });
          setCurveStep(1);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_ARC P1 (Départ) : <${cursorPos.x * 10}, ${cursorPos.y * 10}> mm`,
            'Cliquez pour fixer le Point 2 (Arrivée de la courbe) :',
          ]);
        } else if (curveStep === 1) {
          setCurveP2({ x: cursorPos.x, y: cursorPos.y });
          setCurveStep(2);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_ARC P2 (Arrivée) : <${cursorPos.x * 10}, ${cursorPos.y * 10}> mm`,
            'Déplacez le curseur pour modeler la courbure / flèche de l\'arc et cliquez pour valider :',
          ]);
        } else if (curveStep === 2 && curveP1 && curveP2) {
          const chordMm = Math.round(Math.hypot(curveP2.x - curveP1.x, curveP2.y - curveP1.y) * 10);
          const newCurve: CadEntity = {
            id: `curve-${Date.now()}`,
            name: `Courbe / Arc Bézier (Corde=${chordMm}mm)`,
            type: 'curve',
            layerId: 'structures',
            x1: curveP1.x,
            y1: curveP1.y,
            x2: curveP2.x,
            y2: curveP2.y,
            curvePoint: { x: cursorPos.x, y: cursorPos.y },
            label: `ARC CORDE ${chordMm}mm`,
          };
          recordHistory();
          setEntities(prev => [...prev, newCurve]);
          setSelectedIds([newCurve.id]);
          setCurveP1(null);
          setCurveP2(null);
          setCurveStep(0);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_ARC Courbe Bézier créée : Corde ${chordMm} mm`,
            'Commande: ',
          ]);
        }
      } else if (polylineSubTool === 'freehand') {
        // Tracé libre à main levée
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_FREEHAND : Maintenez le clic gauche et glissez pour dessiner votre tracé organique à main levée.`,
          'Commande: ',
        ]);
      } else {
        // Sous-outil : TRAIT / SEGMENTS MULTIPLES (straight)
        const curPt = { x: cursorPos.x, y: cursorPos.y };

        if (polyPoints.length === 0) {
          setPolyPoints([curPt]);
          setCliHistory(prev => [
            ...prev.slice(-3),
            `_POLY Sommet 1 : <${curPt.x * 10}, ${curPt.y * 10}> mm`,
            'Cliquez pour ajouter des traits successifs (Cliquez sur P1 ou appuyez sur Entrée pour fermer le polygone) :'
          ]);
        } else {
          const firstPt = polyPoints[0];
          const distToFirst = Math.hypot(curPt.x - firstPt.x, curPt.y - firstPt.y);

          // Si clic proche du point initial (P1) et au moins 3 sommets -> fermer le polygone
          if (polyPoints.length >= 3 && distToFirst < 18) {
            finalizePolygon(polyPoints, true);
          } else {
            const nextPoints = [...polyPoints, curPt];
            const lastPt = polyPoints[polyPoints.length - 1];
            const segDistMm = Math.round(Math.hypot(curPt.x - lastPt.x, curPt.y - lastPt.y) * 10);
            setPolyPoints(nextPoints);
            setCliHistory(prev => [
              ...prev.slice(-3),
              `_POLY Trait ${nextPoints.length - 1} posé : ${segDistMm} mm (${nextPoints.length} sommets)`,
              'Tracez le trait suivant, ou appuyez sur Entrée pour valider :'
            ]);
          }
        }
      }
    }

    // 7. ROOM / PIÈCE (A)
    else if (activeTool === 'room') {
      const newRoom: CadEntity = {
        id: `room-${Date.now()}`,
        name: 'Nouvelle Pièce',
        type: 'room',
        layerId: 'cotations',
        x1: cursorPos.x - 70,
        y1: cursorPos.y - 50,
        x2: cursorPos.x + 70,
        y2: cursorPos.y + 50,
        label: 'PIÈCE AMÉNAGÉE',
        subText: 'SOL CARRELAGE',
        area: 12.50,
        height: 2.80,
      };
      recordHistory();
      setEntities(prev => [...prev, newRoom]);
      setSelectedIds([newRoom.id]);
    }

    // 8. REAL-TIME DISTANCE MEASUREMENT TOOL (M / _DIST)
    else if (activeTool === 'measure') {
      if (!measureStart) {
        // First Point (P1)
        setMeasureStart({ x: cursorPos.x, y: cursorPos.y });
        setMeasureResult(null);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_DIST Point 1 : <${cursorPos.x * 10} mm, ${cursorPos.y * 10} mm>`,
          'Déplacez le curseur pour afficher la distance en temps réel, puis cliquez pour fixer P2 :',
        ]);
      } else {
        // Second Point (P2) -> Lock Measurement
        const dxPx = cursorPos.x - measureStart.x;
        const dyPx = cursorPos.y - measureStart.y;
        const distMm = Math.round(Math.hypot(dxPx, dyPx) * 10);
        const dxMm = Math.round(Math.abs(dxPx) * 10);
        const dyMm = Math.round(Math.abs(dyPx) * 10);
        const angleDeg = Math.round(((Math.atan2(dyPx, dxPx) * 180 / Math.PI + 360) % 360) * 10) / 10;

        setMeasureResult({
          p1: { ...measureStart },
          p2: { ...cursorPos },
          distanceMm: distMm,
          dxMm,
          dyMm,
          angleDeg,
        });
        setMeasureStart(null);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_DIST Terminé : L = ${distMm} mm (${(distMm / 1000).toFixed(3)} m) | ΔX = ${dxMm} mm, ΔY = ${dyMm} mm | Angle = ${angleDeg}°`,
          'Cliquez pour démarrer une nouvelle mesure ou Échap pour réinitialiser.',
        ]);
      }
    }
  };

  // Convert current measurement into a permanent associative dimension entity
  const handleConvertMeasureToDim = () => {
    if (!measureResult) return;
    const newDim: CadEntity = {
      id: `dim-${Date.now()}`,
      name: `Cotation ${measureResult.distanceMm} mm`,
      type: 'dim',
      layerId: 'cotations',
      x1: measureResult.p1.x,
      y1: measureResult.p1.y,
      x2: measureResult.p2.x,
      y2: measureResult.p2.y,
      label: `${measureResult.distanceMm}`,
    };
    recordHistory();
    setEntities(prev => [...prev, newDim]);
    setSelectedIds([newDim.id]);
    setMeasureResult(null);
    setCliHistory(prev => [
      ...prev.slice(-3),
      `_DIM créée à partir de la mesure : ${measureResult.distanceMm} mm (Calque Cotations)`,
      'Commande : ',
    ]);
  };

  // Keyboard Shortcuts listener (Delete, Escape, Ctrl+Z, Ctrl+D, Tool shortcuts, Space Pan, Zoom keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Hors onglet Plan (Vues, Mise en page) : les outils de dessin sont inactifs ; seuls V et T restent actifs
      if (activeRail !== 'plan') {
        const k = e.key.toLowerCase();
        if (k === 'v' && !e.ctrlKey && !e.metaKey) setActiveTool('select');
        else if (activeRail === 'layout' && !e.ctrlKey && !e.metaKey && k === 't') setActiveTool('text');
        else if (activeRail === 'layout' && !e.ctrlKey && !e.metaKey && k === 'r') setActiveTool('rect');
        else if (activeRail === 'layout' && !e.ctrlKey && !e.metaKey && k === 'l') setActiveTool('polyline');
        return;
      }

      // Space key: Inverser le sens d'ouverture de porte OU Activer Panoramique (Main)
      if (e.code === 'Space') {
        if (activeTool === 'door') {
          e.preventDefault();
          setActiveDoorSwing(prev => prev === 'left' ? 'right' : 'left');
          return;
        }
        const currentDoor = selectedIds.length === 1 ? entities.find(e => e.id === selectedIds[0] && e.type === 'door') : null;
        if (currentDoor) {
          e.preventDefault();
          handleUpdateSelectedFields({
            doorSwing: currentDoor.doorSwing === 'left' ? 'right' : 'left'
          });
          return;
        }
        // Panoramique / Main avec Espace maintenu :
        if (!e.repeat) {
          e.preventDefault();
          setIsSpaceHeld(true);
        }
      }

      // Zoom Hotkeys (+, -, 0, Ctrl+0)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomReset();
        return;
      }

      // Enter key: valider le polygone ou forme active, ou terminer mur continu
      if (e.key === 'Enter') {
        if (activeTool === 'polyline' && polyPoints.length >= 2) {
          e.preventDefault();
          finalizePolygon(polyPoints, polyPoints.length >= 3);
          return;
        }
        if ((activeTool === 'wall' || activeTool === 'partition') && draftStart) {
          e.preventDefault();
          setDraftStart(null);
          setCliHistory(prev => [...prev.slice(-3), 'Chaîne de murs / cloisons terminée.', 'Commande: ']);
          return;
        }
      }

      // Escape key: annuler le tracé en cours, poignée ou sélection
      if (e.key === 'Escape') {
        if (activeFlyout) {
          setActiveFlyout(null);
          return;
        }
        if (curveStep > 0) {
          e.preventDefault();
          setCurveStep(0);
          setCurveP1(null);
          setCurveP2(null);
          setCliHistory(prev => [...prev.slice(-3), 'Tracé de courbe / arc annulé.', 'Commande: ']);
          return;
        }
        if (activeGrip) {
          e.preventDefault();
          setEntities(prev => prev.map(ent => ent.id === activeGrip.entityId ? activeGrip.initialEntity : ent));
          setActiveGrip(null);
          return;
        }
        if (isDraggingEntities && dragInitialEntities.size > 0) {
          e.preventDefault();
          setEntities(prev => prev.map(ent => dragInitialEntities.get(ent.id) || ent));
          setIsDraggingEntities(false);
          setDragStartPos(null);
          setDragInitialEntities(new Map());
          setDragDelta({ dx: 0, dy: 0 });
          return;
        }
        if (polyPoints.length > 0) {
          e.preventDefault();
          setPolyPoints([]);
          setCliHistory(prev => [...prev.slice(-3), 'Tracé de polygone annulé.', 'Commande: ']);
          return;
        }
        if (draftStart) {
          e.preventDefault();
          setDraftStart(null);
          return;
        }
        if (measureStart) {
          e.preventDefault();
          setMeasureStart(null);
          return;
        }
        setSelectedIds([]);
        return;
      }

      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Tool keys
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          setDraftStart(null);
          break;
        case 'w':
          setActiveTool('wall');
          setDraftStart(null);
          break;
        case 'c':
          setActiveTool('partition');
          setDraftStart(null);
          break;
        case 'p':
          setActiveTool('door');
          setDraftStart(null);
          break;
        case 'f':
          setActiveTool('window');
          setDraftStart(null);
          break;
        case 'd':
          setActiveTool('dim');
          setDraftStart(null);
          break;
        case 'h':
          setActiveTool('hatch');
          setDraftStart(null);
          break;
        case 'b':
          setIsSidebarLibraryOpen(prev => !prev);
          setRightDockTab('library');
          break;
        case 'a':
          setActiveTool('room');
          setDraftStart(null);
          break;
        case 'l':
          setActiveTool('polyline');
          setDraftStart(null);
          break;
        case 'r':
          setActiveTool('rect');
          setDraftStart(null);
          break;
        case 'm':
          setActiveTool('measure');
          setMeasureStart(null);
          setDraftStart(null);
          break;
        case 't':
          setActiveTool('text');
          setDraftStart(null);
          break;
        case 'g':
          e.preventDefault();
          setSettings(s => ({ ...s, snap: !s.snapToGrid, snapToGrid: !s.snapToGrid }));
          break;
        case 'f8':
          e.preventDefault();
          setSettings(s => ({ ...s, ortho: !s.ortho }));
          break;
        case 'f9':
          e.preventDefault();
          setSettings(s => ({ ...s, snap: !s.snapToGrid, snapToGrid: !s.snapToGrid }));
          break;
        case 'f3':
          e.preventDefault();
          setSettings(s => ({ ...s, osnap: !s.osnap }));
          break;
        case 'f7':
          e.preventDefault();
          setSettings(s => ({ ...s, grid: !s.grid }));
          break;
        case 'f12':
          e.preventDefault();
          setSettings(s => ({ ...s, dynHud: !s.dynHud }));
          break;
        case 'escape':
          setDraftStart(null);
          setMeasureStart(null);
          setMeasureResult(null);
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, entities, historyStack, redoStack, draftStart, measureStart, measureResult, isBoxSelecting, activeTool, polyPoints, activeGrip, isDraggingEntities, dragInitialEntities, activeRail]);

  // Handle CLI Submit
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim().toUpperCase();
    const newHist = [...cliHistory, `ARCKI-CLI > ${cliInput}`];

    if (cmd.startsWith('_WALL') || cmd === 'W') {
      setActiveTool('wall');
      setDraftStart(null);
      const parts = cmd.split(' ');
      if (parts[1] && !isNaN(Number(parts[1]))) {
        setWallLength(Number(parts[1]));
        newHist.push(`Longueur mur fixée à ${parts[1]} mm.`);
      }
    } else if (cmd.startsWith('_PARTITION') || cmd.startsWith('CLOISON') || cmd === 'C') {
      setActiveTool('partition');
      setDraftStart(null);
      newHist.push(`Outil CLOISON activé (Snap Grille: ${settings.snapToGrid ? '20px ACTIF' : 'DÉSACTIVÉ'}).`);
    } else if (cmd.startsWith('_DIST') || cmd.startsWith('DIST') || cmd.startsWith('_MEASURE') || cmd.startsWith('MEASURE') || cmd === 'M') {
      setActiveTool('measure');
      setMeasureStart(null);
      setMeasureResult(null);
      setDraftStart(null);
      newHist.push('Outil MESURE DE DISTANCE activé (M / _DIST). Cliquez deux points sur le plan pour mesurer en temps réel.');
    } else if (cmd.startsWith('SNAP') || cmd.startsWith('_SNAP')) {
      const parts = cmd.split(' ');
      if (parts[1] && !isNaN(Number(parts[1]))) {
        const sz = Number(parts[1]);
        setSettings(s => ({ ...s, gridSnapSize: sz, snapToGrid: true, snap: true }));
        newHist.push(`Magnétisme grille fixé à ${sz}px (${sz * 10} mm).`);
      } else if (cmd.includes('OFF')) {
        setSettings(s => ({ ...s, snapToGrid: false, snap: false }));
        newHist.push('Magnétisme à la grille DÉSACTIVÉ.');
      } else {
        setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snap: !s.snapToGrid }));
        newHist.push(`Magnétisme à la grille 20px ${!settings.snapToGrid ? 'ACTIVÉ' : 'DÉSACTIVÉ'}.`);
      }
    } else if (cmd === 'GRID' || cmd === '_GRID') {
      setSettings(s => ({ ...s, grid: !s.grid }));
      newHist.push(`Affichage grille ${!settings.grid ? 'ACTIVÉ' : 'MASQUÉ'}.`);
    } else if (cmd === 'PROPS' || cmd === 'PR' || cmd === 'PROP') {
      setRightDockTab('props');
      newHist.push('Volet des Propriétés (Longueur, Angle, Matériau) ouvert.');
    } else if (cmd === 'LAYERS' || cmd === 'LA') {
      setIsSidebarLayersOpen(true);
      newHist.push('Gestionnaire de calques ouvert dans la sidebar.');
    } else if (cmd === 'DELETE' || cmd === 'DEL' || cmd === 'SUPPR' || cmd === 'ERASE') {
      handleDeleteSelected();
      newHist.push('Suppression exécutée sur la sélection.');
    } else if (cmd.startsWith('_DIM') || cmd.startsWith('DIM') || cmd.startsWith('COTE') || cmd === 'D') {
      setActiveTool('dim');
      setDraftStart(null);
      newHist.push('Outil COTATION AUTOMATIQUE activé (D). Spécifiez le 1er point (P1) puis le 2ème (P2).');
    } else if (cmd.startsWith('_HATCH') || cmd.startsWith('HATCH') || cmd.startsWith('HACHURE') || cmd === 'H') {
      setActiveTool('hatch');
      newHist.push(`Outil HACHURES PARAMÉTRIQUES activé (H). Motif: [${activeHatchPattern}]. Cliquez dans une pièce.`);
    } else if (cmd.startsWith('_LIB') || cmd.startsWith('LIB') || cmd.startsWith('BLOC') || cmd === 'B') {
      setIsSidebarLibraryOpen(true);
      setRightDockTab('library');
      newHist.push('Panneau latéral BIBLIOTHÈQUE ouvert (glisser-déposer de blocs).');
    } else if (cmd.startsWith('_RECT') || cmd.startsWith('RECT') || cmd === 'R') {
      setActiveTool('rect');
      setDraftStart(null);
      newHist.push('Outil RECTANGLE activé (R). Cliquez pour fixer le 1er coin, puis le 2ème pour créer la forme rectangulaire.');
    } else if (cmd.startsWith('_POLY') || cmd.startsWith('POLY') || cmd.startsWith('PLINE') || cmd === 'L') {
      setActiveTool('polyline');
      setPolyPoints([]);
      setDraftStart(null);
      newHist.push('Outil POLYGONE / TRAITS activé (L). Cliquez pour ajouter des traits successifs, puis Entrée ou clic P1 pour fermer la forme.');
    } else if (cmd.startsWith('AUTOPROP') || cmd === '_PROPS_AUTO') {
      setAutoOpenPropsOnSelect(prev => !prev);
      newHist.push(`Ouverture automatique des paramètres au clic : ${!autoOpenPropsOnSelect ? 'ACTIVÉE' : 'DÉSACTIVÉE'}.`);
    } else if (cmd.startsWith('_DOOR') || cmd === 'P') {
      setActiveTool('door');
      newHist.push('Outil PORTE activé. Cliquez pour insérer.');
    } else if (cmd === '_EXTEND 800' || cmd === 'EXTEND') {
      setIsAiDiffApplied(true);
      newHist.push('Façade Sud étendue de +800mm. Surfaces recalculées.');
    } else if (cmd.startsWith('ZOOM') || cmd === 'Z') {
      if (cmd.includes('E') || cmd.includes('EXTENTS') || cmd.includes('TOUT') || cmd.includes('FIT')) {
        handleZoomFit();
        newHist.push('ZOOM ÉTENDU (CADRER TOUT) : Vue cadrée sur l\'ensemble des entités du plan.');
      } else if (cmd.includes('100') || cmd.includes('1:1') || cmd.includes('RESET')) {
        handleZoomReset();
        newHist.push('ZOOM 100% : Échelle 1:1 rétablie.');
      } else {
        handleZoomFit();
        newHist.push('ZOOM : Vue optimisée (Z E: Cadrer tout, Z 100: Réinitialiser 1:1).');
      }
    } else if (cmd === 'PAN' || cmd === 'MAIN' || cmd === '_PAN') {
      setActiveTool('pan');
      newHist.push('Outil Panoramique / Main activé. Glissez sur le canvas pour déplacer la vue (ou maintenez Espace).');
    } else if (cmd === 'HELP') {
      newHist.push('Commandes: _WALL, _DOOR, _DELETE, LAYERS (LA), ZOOM (Z E / Z 100), PAN, HELP');
    } else {
      newHist.push(`Commande validée: ${cmd}.`);
    }

    setCliHistory(newHist.slice(-5));
    setCliInput('');
  };

  // Submit AI Prompt in Copilot tab
  const handleSendAiPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const userText = aiPrompt.trim();
    setCopilotMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiPrompt('');

    try {
      const result = await ArckiCadAgent.processRequest(userText, entities);

      // Si l'utilisateur a demandé d'insérer une porte PMR
      if (userText.toLowerCase().includes('porte') || userText.toLowerCase().includes('pmr')) {
        const snap = findWallSnap(420, 240, 900, 9999);
        if (snap) {
          const pmrDoor: CadEntity = {
            id: `door-pmr-${Date.now()}`,
            name: `Porte PMR 900mm encastrée (${snap.wall.name})`,
            type: 'door',
            layerId: 'ouvertures',
            x1: snap.p1X,
            y1: snap.p1Y,
            x2: snap.p2X,
            y2: snap.p2Y,
            angle: snap.wallAngleDeg,
            thickness: snap.wallThickness,
            hostWallId: snap.wall.id,
            openingWidth: 900,
            doorSwing: 'left',
            doorAngle: 90,
            label: 'PORTE 900mm PMR',
            materialIndex: 'MAT-07',
          };
          recordHistory();
          setEntities(prev => [...prev, pmrDoor]);
          setSelectedIds([pmrDoor.id]);
        }
      } else if (userText.toLowerCase().includes('supprimer') || userText.toLowerCase().includes('effacer')) {
        handleDeleteSelected();
      } else if (userText.toLowerCase().includes('salon') || userText.toLowerCase().includes('agrandir')) {
        setIsAiDiffApplied(true);
      }

      setCopilotMessages(prev => [...prev, { sender: 'assistant', text: result.reply }]);
    } catch {
      setCopilotMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: "Agent ARCKI CAD actif : calculs métriques, encastrement des ouvertures et audit réglementaire prêts.",
        },
      ]);
    }
  };

  // Find currently selected entity (first one for single inspect)
  const primarySelectedEntity = entities.find(e => selectedIds[0] === e.id);

  // Update primary selected entity property
  const handleUpdateSelectedProp = (key: keyof CadEntity, value: any) => {
    if (!primarySelectedEntity) return;
    recordHistory();
    setEntities(prev => prev.map(e => e.id === primarySelectedEntity.id ? { ...e, [key]: value } : e));
  };

  // Update multiple fields on selected entity
  const handleUpdateSelectedFields = (updatedFields: Partial<CadEntity>) => {
    if (!primarySelectedEntity) return;
    recordHistory();
    const w = primarySelectedEntity;
    const isWallLike = w.type === 'wall' || w.type === 'partition';
    if (isWallLike && (updatedFields.refLine !== undefined || updatedFields.thickness !== undefined)) {
      // La ligne de référence reste fixe dans le plan : l'axe (et les ouvertures encastrées) se décalent
      const oldT = (w.thickness || (w.type === 'partition' ? 72 : 200)) / 10;
      const newT = (updatedFields.thickness ?? w.thickness ?? (w.type === 'partition' ? 72 : 200)) / 10;
      const delta = (refSign(updatedFields.refLine ?? w.refLine) * newT) / 2 - (refSign(w.refLine) * oldT) / 2;
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
      const dx = (-(w.y2 - w.y1) / len) * delta;
      const dy = ((w.x2 - w.x1) / len) * delta;
      setEntities(prev =>
        prev.map(e => {
          if (e.id === w.id) return { ...e, ...updatedFields, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
          if (e.hostWallId === w.id) {
            return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy, ...(updatedFields.thickness ? { thickness: updatedFields.thickness } : {}) };
          }
          return e;
        })
      );
      return;
    }
    setEntities(prev => prev.map(e => e.id === primarySelectedEntity.id ? { ...e, ...updatedFields } : e));
  };

  // Dynamic area for Salon based on AI diff state
  const salonArea = isAiDiffApplied ? '36.10' : '32.40';
  const salonYShift = isAiDiffApplied ? 30 : 0;
  const currentDrawDist = draftStart 
    ? Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10)
    : Math.max(100, Math.round(Math.abs(cursorPos.x - 560) * 10));

  // Real-time distance measurement live calculation (P1 -> Cursor)
  const liveMeasureDistMm = measureStart
    ? Math.round(Math.hypot(cursorPos.x - measureStart.x, cursorPos.y - measureStart.y) * 10)
    : 0;
  const liveMeasureDxMm = measureStart
    ? Math.round(Math.abs(cursorPos.x - measureStart.x) * 10)
    : 0;
  const liveMeasureDyMm = measureStart
    ? Math.round(Math.abs(cursorPos.y - measureStart.y) * 10)
    : 0;
  const liveMeasureAngleDeg = measureStart
    ? Math.round(((Math.atan2(cursorPos.y - measureStart.y, cursorPos.x - measureStart.x) * 180 / Math.PI + 360) % 360) * 10) / 10
    : 0;

  return (
    <div className="flex flex-col w-full h-[calc(100vh-3.5rem)] select-none overflow-hidden bg-background font-body-md text-on-surface">
      {/* 1. TOP CONTEXTUAL SUB-TOOLBAR */}
      <div className="flex-none h-10 bg-surface-container-lowest border-b border-outline-variant/30 px-3 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap overflow-hidden">
          {/* Active Tool Badge */}
          <div className="flex items-center gap-1.5 bg-surface-container-high px-2 py-1 rounded">
            <span className="material-symbols-outlined text-[15px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              {activeTool === 'select' ? 'near_me' : activeTool === 'measure' ? 'square_foot' : activeTool === 'wall' ? 'view_column' : activeTool === 'door' ? 'meeting_room' : activeTool === 'dim' ? 'straighten' : activeTool === 'partition' ? 'splitscreen' : 'architecture'}
            </span>
            <span className="font-mono text-[11px] text-primary font-bold tracking-wider uppercase">
              {activeTool === 'select' ? 'SÉLECTION [V]' : activeTool === 'measure' ? 'MESURE DISTANCE [M]' : activeTool === 'wall' ? 'MUR [W]' : activeTool === 'partition' ? 'CLOISON [C]' : activeTool === 'door' ? 'PORTE [P]' : activeTool === 'dim' ? 'COTATION [D]' : activeTool.toUpperCase()}
            </span>
          </div>

          {/* Selection Actions Quick Bar (when entities are selected) */}
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded border border-primary/40">
              <span className="font-mono text-[10px] text-primary font-bold">
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </span>
              <div className="h-3 w-px bg-outline-variant/30 mx-0.5"></div>
              {/* Properties Sidebar Toggle Button */}
              <button
                onClick={() => {
                  setRightDockTab('props');
                }}
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1 transition-colors border ${
                  rightDockTab === 'props'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-high text-primary border-primary/30 hover:bg-surface-bright'
                }`}
                title="Afficher les propriétés (Longueur, Angle, Matériau) dans le panneau latéral droit"
              >
                <span className="material-symbols-outlined text-[13px]">tune</span>
                <span>Propriétés</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-2 py-0.5 rounded bg-error/20 hover:bg-error text-on-error font-mono text-[10px] font-bold flex items-center gap-1 transition-colors"
                title="Supprimer la sélection (Touche Suppr / Delete)"
              >
                <span className="material-symbols-outlined text-[13px]">delete</span>
                <span className="hidden sm:inline">Supprimer (Suppr)</span>
              </button>
              <button
                onClick={handleDuplicateSelected}
                className="px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-[10px] flex items-center gap-1 transition-colors"
                title="Dupliquer la sélection (Ctrl+D)"
              >
                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                <span className="hidden sm:inline">Dupliquer</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="p-0.5 text-outline hover:text-on-surface"
                title="Désélectionner (Échap)"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ) : activeTool === 'partition' ? (
            <>
              {/* Partition Sub-tools Selector */}
              <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="font-mono text-[9px] text-tertiary px-1 font-semibold uppercase">MODE:</span>
                {[
                  { id: 'single', label: 'Droite', icon: 'segment', title: 'Cloison Droite (Segment P1 → P2)' },
                  { id: 'continuous', label: 'Continue', icon: 'timeline', title: 'Cloison Continue (Chaîne successive)' },
                  { id: 'rect', label: '4 Cloisons Rect', icon: 'crop_square', title: '4 Cloisons en boîte rectangulaire' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setPartitionSubTool(sub.id as WallSubTool);
                      setDraftStart(null);
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-all border ${
                      partitionSubTool === sub.id
                        ? 'bg-tertiary text-on-tertiary font-bold border-tertiary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                    title={sub.title}
                  >
                    <span className="material-symbols-outlined text-[13px]">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>

              {/* Partition Type Dropdown */}
              <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20 text-xs">
                <span className="font-mono text-[10px] text-tertiary font-bold">CLOISON:</span>
                <select
                  value={partitionType}
                  onChange={(e) => {
                    setPartitionType(e.target.value);
                    if (e.target.value.includes('72')) setPartitionThickness(72);
                    else if (e.target.value.includes('98')) setPartitionThickness(98);
                    else if (e.target.value.includes('120')) setPartitionThickness(120);
                    else if (e.target.value.includes('Vitrée')) setPartitionThickness(50);
                  }}
                  className="bg-transparent text-on-surface hover:text-tertiary outline-none cursor-pointer font-medium text-xs"
                >
                  <option value="Placostil 72mm (BA13)" className="bg-surface-container-low">Placostil 72mm (Standard)</option>
                  <option value="Placostil 98mm (Double BA13)" className="bg-surface-container-low">Placostil 98mm (Acoustique)</option>
                  <option value="Cloison Séparation 120mm" className="bg-surface-container-low">Cloison Séparation 120mm</option>
                  <option value="Verrière Atelier Acier 50mm" className="bg-surface-container-low">Verrière Atelier Acier 50mm</option>
                </select>
              </div>

              {/* Partition Thickness */}
              <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20">
                <span className="font-mono text-[10px] text-outline">ÉP:</span>
                <input
                  type="number"
                  value={partitionThickness}
                  onChange={(e) => setPartitionThickness(Number(e.target.value))}
                  className="w-10 bg-transparent text-tertiary font-mono text-[11px] font-bold text-center outline-none"
                />
                <span className="font-mono text-[10px] text-on-surface-variant">mm</span>
              </div>

              {/* SNAP-TO-GRID 20px BUTTON */}
              <button
                onClick={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snap: !s.snapToGrid }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all border ${
                  settings.snapToGrid
                    ? 'bg-tertiary-container/30 text-tertiary border-tertiary/60 font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                }`}
                title="Activer/Désactiver le magnétisme sur la grille de points 20px (Touche G ou F9)"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {settings.snapToGrid ? 'grid_goldenratio' : 'grid_off'}
                </span>
                <span>SNAP GRILLE 20px</span>
                <span className={`w-1.5 h-1.5 rounded-full ${settings.snapToGrid ? 'bg-tertiary animate-pulse' : 'bg-outline-variant'}`}></span>
              </button>

              {/* Grid Snap Step Selector */}
              <div className="hidden lg:flex items-center gap-0.5 bg-surface-container-low px-1 py-0.5 rounded border border-outline-variant/20 text-[10px] font-mono">
                <span className="text-outline mr-1">PAS:</span>
                {[10, 20, 40].map(sz => (
                  <button
                    key={sz}
                    onClick={() => setSettings(s => ({ ...s, gridSnapSize: sz, snapToGrid: true }))}
                    className={`px-1.5 py-0.2 rounded transition-colors ${
                      settings.gridSnapSize === sz && settings.snapToGrid
                        ? 'bg-tertiary text-on-tertiary font-bold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>

              {/* Continuous Chaining */}
              <button
                onClick={() => setChaining(!chaining)}
                className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
                  chaining
                    ? 'bg-surface-container-high text-primary border-primary/30 font-medium'
                    : 'bg-surface-container-low text-outline border-outline-variant/20'
                }`}
                title="Chaînage automatique des segments de cloison"
              >
                <span className="material-symbols-outlined text-[13px]">link</span>
                <span>Chaînage</span>
              </button>
            </>
          ) : activeTool === 'measure' ? (
            <>
              {/* Measure Status & Live Distance Pill */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="material-symbols-outlined text-[15px] text-amber-400">
                  straighten
                </span>
                <span className="font-mono text-[10px] text-outline uppercase font-semibold">
                  {measureStart ? 'Mesure en direct' : measureResult ? 'Résultat' : 'Prêt'} :
                </span>
                {measureStart ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30 animate-pulse">
                      📏 {liveMeasureDistMm.toLocaleString('fr-FR')} mm ({(liveMeasureDistMm / 1000).toFixed(3)} m)
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant hidden md:inline">
                      ΔX: <strong className="text-on-surface">{liveMeasureDxMm} mm</strong> · ΔY: <strong className="text-on-surface">{liveMeasureDyMm} mm</strong> · ∠ {liveMeasureAngleDeg}°
                    </span>
                  </div>
                ) : measureResult ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-sky-400 font-bold bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/30">
                      📏 {measureResult.distanceMm.toLocaleString('fr-FR')} mm ({(measureResult.distanceMm / 1000).toFixed(3)} m)
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant hidden md:inline">
                      ΔX: {measureResult.dxMm} mm · ΔY: {measureResult.dyMm} mm · {measureResult.angleDeg}°
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    Cliquez sur le plan pour poser le point P1
                  </span>
                )}
              </div>

              {/* Actions when measureResult is available */}
              {measureResult && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleConvertMeasureToDim}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-[10px] font-bold transition-colors"
                    title="Convertir cette mesure en une cotation permanente sur le calque Cotations"
                  >
                    <span className="material-symbols-outlined text-[13px]">straighten</span>
                    <span>Convertir en Cotation</span>
                  </button>
                  <button
                    onClick={() => {
                      setMeasureResult(null);
                      setMeasureStart(null);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-mono text-[10px] transition-colors"
                    title="Effacer et démarrer une nouvelle mesure"
                  >
                    <span className="material-symbols-outlined text-[13px]">refresh</span>
                    <span>Nouvelle mesure</span>
                  </button>
                </div>
              )}

              {/* Cancel active measurement in progress */}
              {measureStart && (
                <button
                  onClick={() => setMeasureStart(null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high hover:bg-error/20 text-on-surface-variant hover:text-error font-mono text-[10px] transition-colors"
                  title="Annuler le point P1 (Échap)"
                >
                  <span className="material-symbols-outlined text-[13px]">cancel</span>
                  <span>Annuler P1</span>
                </button>
              )}

              {/* SNAP-TO-GRID Toggle for Measurement */}
              <button
                onClick={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snap: !s.snapToGrid }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all border ${
                  settings.snapToGrid
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                }`}
                title="Accrocher les points de mesure sur la grille 20px (F9)"
              >
                <span className="material-symbols-outlined text-[14px]">grid_goldenratio</span>
                <span>Snap 20px</span>
                {settings.snapToGrid && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
              </button>

              {/* ORTHO Toggle for Measurement */}
              <button
                onClick={() => setSettings(s => ({ ...s, ortho: !s.ortho }))}
                className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono transition-all border ${
                  settings.ortho
                    ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                }`}
                title="Verrouiller les mesures à l'horizontale / verticale (F8)"
              >
                <span>ORTHO (F8)</span>
              </button>
            </>
          ) : activeTool === 'dim' ? (
            <>
              {/* Cotation Sub-toolbar */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="material-symbols-outlined text-[15px] text-primary">straighten</span>
                <span className="font-mono text-[10px] text-outline uppercase font-semibold">COTATION :</span>
                <span className={`font-mono text-[11px] ${draftStart ? 'text-amber-400 font-bold animate-pulse' : 'text-primary'}`}>
                  {draftStart ? `P1 fixé [${draftStart.x * 10}, ${draftStart.y * 10}] → Cliquez P2` : 'Cliquez sur le premier point (P1)'}
                </span>
              </div>
              {draftStart && (
                <button
                  onClick={() => setDraftStart(null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high hover:bg-error/20 text-on-surface-variant hover:text-error font-mono text-[10px] transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">cancel</span>
                  <span>Annuler P1</span>
                </button>
              )}
              <span className="text-[10px] font-mono text-outline hidden lg:inline ml-auto">
                Place automatiquement la ligne de dimension avec lignes de rappel et tiques à 45°
              </span>
            </>
          ) : activeTool === 'hatch' ? (
            <>
              {/* Hatch Paramétrique Sub-toolbar */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="material-symbols-outlined text-[15px] text-tertiary">texture</span>
                <span className="font-mono text-[10px] text-outline uppercase font-semibold">MOTIF HACHURE :</span>
                <div className="flex items-center gap-1">
                  {(['briques', 'beton', 'bois', 'isolation', 'carrelage', 'sable'] as const).map((pat) => (
                    <button
                      key={pat}
                      onClick={() => setActiveHatchPattern(pat)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all border ${
                        activeHatchPattern === pat
                          ? 'bg-tertiary text-on-tertiary font-bold border-tertiary shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                      }`}
                    >
                      {pat}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[10px] font-mono text-outline hidden lg:inline ml-auto">
                Cliquez sur une pièce ou une zone fermée pour appliquer le motif paramétrique
              </span>
            </>
          ) : activeTool === 'door' ? (
            <>
              {/* Door Encastrée Sub-toolbar */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="material-symbols-outlined text-[15px] text-amber-400">meeting_room</span>
                <span className="font-mono text-[10px] text-outline uppercase font-semibold">PORTE ENCASTRÉE :</span>
                <div className="flex items-center gap-1">
                  {[730, 830, 900, 1000].map((w) => (
                    <button
                      key={w}
                      onClick={() => setDoorWidthSetting(w)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                        doorWidthSetting === w
                          ? 'bg-amber-500/20 text-amber-300 font-bold border-amber-500/40 shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                      }`}
                      title={`Largeur de passage : ${w} mm ${w === 900 ? '(Norme PMR)' : ''}`}
                    >
                      {w}mm {w === 900 ? 'PMR' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sens du battant (Left / Right) */}
              <div className="flex items-center gap-1 bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="font-mono text-[10px] text-outline">BATTANT:</span>
                <button
                  onClick={() => setActiveDoorSwing('right')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                    activeDoorSwing === 'right' ? 'bg-primary/20 text-primary font-bold' : 'text-outline hover:text-on-surface'
                  }`}
                  title="Tirant Droit"
                >
                  Droit
                </button>
                <button
                  onClick={() => setActiveDoorSwing('left')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                    activeDoorSwing === 'left' ? 'bg-primary/20 text-primary font-bold' : 'text-outline hover:text-on-surface'
                  }`}
                  title="Tirant Gauche"
                >
                  Gauche
                </button>
                <button
                  onClick={() => setActiveFlipSide(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ml-0.5 border ${
                    activeFlipSide ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-surface-container border-outline-variant/20 text-outline hover:text-on-surface'
                  }`}
                  title="Inverser le sens d'ouverture intérieur / extérieur"
                >
                  Inverser
                </button>
              </div>

              <span className="text-[10px] font-mono text-amber-300/90 hidden lg:inline ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Encastrement et rotation automatique sur le mur le plus proche</span>
              </span>
            </>
          ) : activeTool === 'window' ? (
            <>
              {/* Window Encastrée Sub-toolbar */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="material-symbols-outlined text-[15px] text-sky-400">window</span>
                <span className="font-mono text-[10px] text-outline uppercase font-semibold">FENÊTRE ENCASTRÉE :</span>
                <div className="flex items-center gap-1">
                  {[600, 900, 1200, 1400, 1800, 2400].map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowWidthSetting(w)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                        windowWidthSetting === w
                          ? 'bg-sky-500/20 text-sky-300 font-bold border-sky-500/40 shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                      }`}
                      title={`Largeur baie : ${w} mm`}
                    >
                      {w >= 2400 ? `Baie ${w}mm` : `${w}mm`}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[10px] font-mono text-sky-300/90 hidden lg:inline ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                <span>Découpe et orientation automatique dans l'épaisseur de la maçonnerie</span>
              </span>
            </>
          ) : activeTool === 'rect' ? (
            <>
              {/* Forme Sub-tools Selector */}
              <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="font-mono text-[9px] text-sky-400 px-1 font-semibold uppercase">SOUS-OUTIL FORME:</span>
                {[
                  { id: 'rect', label: 'Rectangle', icon: 'rectangle', desc: 'Emprise rectangulaire 2 coins (R)' },
                  { id: 'circle', label: 'Cercle', icon: 'radio_button_unchecked', desc: 'Cercle paramétrique (Centre + Rayon)' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setShapeSubTool(sub.id as ShapeSubTool);
                      setDraftStart(null);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all border ${
                      shapeSubTool === sub.id
                        ? 'bg-sky-500 text-white font-bold border-sky-400 shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                    title={sub.desc}
                  >
                    <span className="material-symbols-outlined text-[13px]">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>

              {/* Status info */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20 text-xs font-mono">
                <span className="text-[10px] text-outline">
                  {shapeSubTool === 'circle' ? 'CERCLE:' : 'RECTANGLE:'}
                </span>
                <span className="text-[11px] text-sky-300 font-bold">
                  {draftStart
                    ? shapeSubTool === 'circle'
                      ? `Centre fixé → Déplacez pour rayon (${Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10)} mm)`
                      : `Coin 1 fixé → Cliquez pour coin 2 (${Math.round(Math.abs(cursorPos.x - draftStart.x) * 10)} × ${Math.round(Math.abs(cursorPos.y - draftStart.y) * 10)} mm)`
                    : shapeSubTool === 'circle'
                    ? 'Cliquez pour positionner le centre du cercle'
                    : 'Cliquez pour fixer le premier coin'}
                </span>
              </div>
            </>
          ) : activeTool === 'polyline' ? (
            <>
              {/* Polygone Sub-tools Selector */}
              <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="font-mono text-[9px] text-primary px-1 font-semibold uppercase">SOUS-OUTIL TRACÉ:</span>
                {[
                  { id: 'straight', label: 'Trait / Segments', icon: 'polyline', desc: 'Tracé de traits successifs (L)' },
                  { id: 'freehand', label: 'Libre (Main levée)', icon: 'gesture', desc: 'Tracé libre fluide au glisser' },
                  { id: 'curve', label: 'Courbe / Arc', icon: 'gesture_select', desc: 'Courbe ou arc Bézier 3 points' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setPolylineSubTool(sub.id as PolylineSubTool);
                      setPolyPoints([]);
                      setCurveStep(0);
                      setCurveP1(null);
                      setCurveP2(null);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all border ${
                      polylineSubTool === sub.id
                        ? 'bg-primary text-on-primary font-bold border-primary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                    title={sub.desc}
                  >
                    <span className="material-symbols-outlined text-[13px]">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20 text-xs font-mono">
                <span className="text-[10px] text-outline">STATUT:</span>
                <span className="text-[11px] text-primary font-bold">
                  {polylineSubTool === 'freehand'
                    ? 'Maintenez le clic gauche et glissez pour dessiner à main levée'
                    : polylineSubTool === 'curve'
                    ? curveStep === 1
                      ? 'P1 fixé → Cliquez pour fixer le point d\'arrivée (P2)'
                      : curveStep === 2
                      ? 'P1 et P2 fixés → Ajustez la courbure et cliquez pour valider'
                      : 'Cliquez pour fixer le point de départ de l\'arc'
                    : polyPoints.length > 0
                    ? `${polyPoints.length} point(s) posé(s) → Clic P1 ou Entrée pour fermer`
                    : 'Cliquez pour démarrer la chaîne de traits'}
                </span>
              </div>

              {polylineSubTool === 'straight' && polyPoints.length >= 2 && (
                <button
                  onClick={() => finalizePolygon(polyPoints, polyPoints.length >= 3)}
                  className="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-[10px] font-bold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">check</span>
                  <span>Valider (Entrée)</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Wall Sub-tools Selector */}
              <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/30 text-xs">
                <span className="font-mono text-[9px] text-primary px-1 font-semibold uppercase">SOUS-OUTIL MUR:</span>
                {[
                  { id: 'single', label: 'Mur Droit', icon: 'segment', desc: 'Segment droit unique P1 → P2' },
                  { id: 'continuous', label: 'Mur Continu', icon: 'timeline', desc: 'Murs consécutifs en continu (Entrée pour terminer)' },
                  { id: 'rect', label: '4 Murs Rectangle', icon: 'crop_square', desc: 'Boîte fermée de 4 murs d\'un coup' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setWallSubTool(sub.id as WallSubTool);
                      setDraftStart(null);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all border ${
                      wallSubTool === sub.id
                        ? 'bg-primary text-on-primary font-bold border-primary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                    title={sub.desc}
                  >
                    <span className="material-symbols-outlined text-[13px]">{sub.icon}</span>
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>

              {/* Wall Type Dropdown */}
              <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20 text-xs">
                <span className="font-mono text-[10px] text-on-surface-variant">TYPE:</span>
                <select
                  value={wallType}
                  onChange={(e) => setWallType(e.target.value)}
                  className="bg-transparent text-on-surface hover:text-primary outline-none cursor-pointer font-medium"
                >
                  <option value="Mur Porteur Extérieur" className="bg-surface-container-low">Mur Porteur Extérieur</option>
                  <option value="Mur de Refend Béton" className="bg-surface-container-low">Mur de Refend Béton</option>
                  <option value="Cloison Placostil 72mm" className="bg-surface-container-low">Cloison Placostil 72mm</option>
                </select>
              </div>

              {/* Thickness Scrubber */}
              <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20">
                <span className="font-mono text-[10px] text-outline">ÉP:</span>
                <input
                  type="number"
                  value={wallThickness}
                  onChange={(e) => setWallThickness(Number(e.target.value))}
                  className="w-10 bg-transparent text-primary font-mono text-[11px] font-bold text-center outline-none"
                />
                <span className="font-mono text-[10px] text-on-surface-variant">mm</span>
              </div>

              {/* Height Scrubber */}
              <div className="hidden sm:flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20">
                <span className="font-mono text-[10px] text-outline">HT:</span>
                <input
                  type="number"
                  value={wallHeight}
                  onChange={(e) => setWallHeight(Number(e.target.value))}
                  className="w-12 bg-transparent text-on-surface font-mono text-[11px] font-bold text-center outline-none"
                />
                <span className="font-mono text-[10px] text-on-surface-variant">mm</span>
              </div>

              {/* Justification Selector */}
              <div className="hidden md:flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20 text-xs">
                <span className="font-mono text-[10px] text-outline">LIGNE RÉF.:</span>
                <button
                  onClick={() => {
                    setWallJustif(prev => prev === 'Nu Gauche' ? 'Axe' : prev === 'Axe' ? 'Nu Droite' : 'Nu Gauche');
                  }}
                  className="flex items-center gap-1 text-on-surface hover:text-primary transition-colors"
                  title="Ligne de référence du tracé : le corps du mur se place à droite (Nu Gauche), centré (Axe) ou à gauche (Nu Droite) des points cliqués. Un rectangle tracé dans le sens horaire : Nu Gauche = faces extérieures sur le trait."
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {wallJustif === 'Nu Gauche' ? 'align_horizontal_left' : wallJustif === 'Nu Droite' ? 'align_horizontal_right' : 'align_horizontal_center'}
                  </span>
                  <span>{wallJustif}</span>
                </button>
              </div>

              {/* SNAP-TO-GRID Button for Walls */}
              <button
                onClick={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snap: !s.snapToGrid }))}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono transition-all border ${
                  settings.snapToGrid
                    ? 'bg-tertiary-container/30 text-tertiary border-tertiary/60 font-bold shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                }`}
                title="Magnétisme à la grille 20px (F9)"
              >
                <span className="material-symbols-outlined text-[14px]">grid_goldenratio</span>
                <span>SNAP 20px</span>
                {settings.snapToGrid && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>}
              </button>
            </>
          )}

          {/* Quick Layers Button */}
          <button
            onClick={() => setIsSidebarLayersOpen(!isSidebarLayersOpen)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors border ${
              isSidebarLayersOpen
                ? 'bg-primary-container/20 text-primary border-primary/40 font-bold'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20'
            }`}
            title="Ouvrir le gestionnaire de calques (LA)"
          >
            <span className="material-symbols-outlined text-[14px]">layers</span>
            <span className="hidden sm:inline">Calques ({layers.filter(l => l.visible).length}/{layers.length})</span>
          </button>
        </div>

        {/* View Controls & Proj HUD */}
        <div className="flex items-center gap-2">
          <LevelManager
            levels={levels}
            activeLevelId={activeLevelId}
            entityCounts={entityCounts}
            onSelect={handleSelectLevel}
            onAddAbove={() => addLevel('above')}
            onAddBelow={() => addLevel('below')}
            onDuplicate={duplicateLevel}
            onUpdate={updateLevel}
            onDelete={deleteLevel}
            onOpenConfig={() => setIsLevelsConfigOpen(true)}
          />
          {isLevelsConfigOpen && (
            <LevelsConfigDialog
              levels={levels}
              entityCounts={entityCounts}
              autoStack={levelAutoStack}
              onApply={applyLevelsConfig}
              onClose={() => setIsLevelsConfigOpen(false)}
            />
          )}
          <button
            onClick={() => setActiveRail(activeRail === 'views' ? 'plan' : 'views')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border border-outline-variant/20 text-[11px] font-mono transition-colors ${
              activeRail === 'views' ? 'bg-secondary/20 text-secondary font-bold' : 'bg-surface-container-low text-secondary'
            }`}
            title="Basculer entre le Plan 2D et les Vues (façades & coupes)"
          >
            <span className="material-symbols-outlined text-[13px]">
              {activeRail === 'views' ? 'view_quilt' : 'layers'}
            </span>
            <span>{activeRail === 'views' ? 'FAÇADES & COUPES' : 'PLAN 2D'}</span>
          </button>
          <button
            onClick={() => {
              setCanvasZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
            title="Réinitialiser l'orientation du plan"
          >
            <span className="material-symbols-outlined text-[15px]">navigation</span>
          </button>
        </div>
      </div>

      {/* 2. WORKSPACE MIDDLE: LEFT TOOLBAR + (OPTIONAL SIDEBAR LAYERS DRAWER) + MAIN 2D VIEWPORT + RIGHT INSPECTOR/AI */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Extreme Left CAD Mode Rail */}
        <aside className="w-14 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between py-2 items-center z-40 flex-none">
          <nav className="flex flex-col gap-1 w-full px-1">
            <button
              onClick={() => setActiveRail('plan')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
                activeRail === 'plan' ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Vue Plan 2D"
            >
              <span className="material-symbols-outlined text-[19px]">architecture</span>
              <span className="font-mono text-[9px] mt-0.5">Plan</span>
            </button>
            <button
              onClick={() => setActiveRail('views')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
                activeRail === 'views' ? 'bg-surface-container-high text-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Vues : façades et coupes"
            >
              <span className="material-symbols-outlined text-[19px]">view_quilt</span>
              <span className="font-mono text-[9px] mt-0.5">Vues</span>
            </button>
            <button
              onClick={() => {
                setIsSidebarLayersOpen(!isSidebarLayersOpen);
                setActiveRail('bim');
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors relative ${
                isSidebarLayersOpen || activeRail === 'bim'
                  ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Gestionnaire de Calques (Layers)"
            >
              <span className="material-symbols-outlined text-[19px]">layers</span>
              <span className="font-mono text-[9px] mt-0.5">Calques</span>
              {isSidebarLayersOpen && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setActiveRail(activeRail === 'layout' ? 'plan' : 'layout')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
                activeRail === 'layout' ? 'bg-surface-container-high text-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Mise en page : planche, échelle et cartouche"
            >
              <span className="material-symbols-outlined text-[19px]">grid_view</span>
              <span className="font-mono text-[9px] mt-0.5">Mise en page</span>
            </button>
            <button
              onClick={onOpenExport}
              className="flex flex-col items-center justify-center py-2 px-1 rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              title="Rendu Visuel & Export"
            >
              <span className="material-symbols-outlined text-[19px]">photo_camera</span>
              <span className="font-mono text-[9px] mt-0.5">Rendu</span>
            </button>
            <button
              onClick={() => {
                setIsSidebarLibraryOpen(prev => !prev);
                setRightDockTab('library');
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors relative ${
                isSidebarLibraryOpen || rightDockTab === 'library'
                  ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Bibliothèque de blocs de mobilier & menuiseries (B)"
            >
              <span className="material-symbols-outlined text-[19px]">category</span>
              <span className="font-mono text-[9px] mt-0.5">Blocs</span>
              {isSidebarLibraryOpen && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setRightDockTab('props')}
              className="flex flex-col items-center justify-center py-2 px-1 rounded text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              title="Configuration du projet"
            >
              <span className="material-symbols-outlined text-[19px]">settings</span>
              <span className="font-mono text-[9px] mt-0.5">Config</span>
            </button>
          </nav>

          <div className="flex flex-col items-center gap-1 text-outline">
            <button
              onClick={() => setSettings(s => ({ ...s, snap: !s.snap }))}
              className={`p-1.5 rounded transition-colors ${settings.snap ? 'text-tertiary bg-tertiary-container/10' : 'hover:text-primary'}`}
              title="Snap Magnétique (F9)"
            >
              <span className="material-symbols-outlined text-[17px]">grid_on</span>
            </button>
            <button
              onClick={() => {
                const cliEl = document.getElementById('cad-cli-input');
                cliEl?.focus();
              }}
              className="p-1.5 hover:text-primary transition-colors"
              title="Console Scripting (CLI)"
            >
              <span className="material-symbols-outlined text-[17px]">terminal</span>
            </button>
          </div>
        </aside>

        {/* Compact CAD Drafting Tools Strip */}
        <aside className="w-11 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col items-center py-1 gap-1 z-30 shadow-md flex-none relative">
          {[
            { id: 'select', icon: 'near_me', key: 'V', title: 'Sélection & Manipulation (V)' },
            { id: 'pan', icon: 'pan_tool', key: 'Space', title: 'Panoramique / Déplacer la vue (Maintenir Espace ou Clic Molette)' },
            { id: 'wall', icon: wallSubTool === 'rect' ? 'crop_square' : wallSubTool === 'continuous' ? 'timeline' : 'view_column', key: 'W', title: `Mur (${wallSubTool === 'rect' ? '4 Murs Rectangle' : wallSubTool === 'continuous' ? 'Mur Continu' : 'Mur Droit'}) [W]`, hasSub: true },
            { id: 'partition', icon: partitionSubTool === 'rect' ? 'crop_square' : partitionSubTool === 'continuous' ? 'timeline' : 'splitscreen', key: 'C', title: `Cloison (${partitionSubTool === 'rect' ? '4 Cloisons Rect' : partitionSubTool === 'continuous' ? 'Continue' : 'Droite'}) [C]`, hasSub: true },
            { id: 'rect', icon: shapeSubTool === 'circle' ? 'radio_button_unchecked' : 'rectangle', key: 'R', title: `Forme (${shapeSubTool === 'circle' ? 'Cercle' : 'Rectangle'}) [R]`, hasSub: true },
            { id: 'polyline', icon: polylineSubTool === 'freehand' ? 'gesture' : polylineSubTool === 'curve' ? 'gesture_select' : 'polyline', key: 'L', title: `Tracé (${polylineSubTool === 'freehand' ? 'Libre / Main levée' : polylineSubTool === 'curve' ? 'Courbe / Arc' : 'Trait'}) [L]`, hasSub: true },
            { id: 'door', icon: 'meeting_room', key: 'P', title: 'Porte avec sens (P)' },
            { id: 'window', icon: 'window', key: 'F', title: 'Fenêtre / Baie vitrée (F)' },
            { id: 'room', icon: 'crop_free', key: 'A', title: 'Détecteur de surfaces / Pièces (A)' },
            { id: 'dim', icon: 'straighten', key: 'D', title: 'Cotation Automatique (D / _DIM)' },
            { id: 'hatch', icon: 'texture', key: 'H', title: 'Hachures Paramétriques (H / _HATCH)' },
            { id: 'measure', icon: 'square_foot', key: 'M', title: 'Mesure de distance en temps réel (M / _DIST)' },
            { id: 'text', icon: 'title', key: 'T', title: activeRail === 'layout' ? 'Texte sur la planche (T) : cliquez sur la planche' : 'Texte / annotation sur le plan (T)' },
          ].map((t) => {
            // Outils disponibles selon l'onglet : Plan = tous ; Vues = sélection ; Mise en page = sélection + texte
            const enabled = activeRail === 'plan' || (activeRail === 'layout' ? ['select', 'text', 'rect', 'polyline'] : ['select']).includes(t.id);
            return (
            <div key={t.id} className="relative group">
              <button
                disabled={!enabled}
                onClick={() => {
                  setActiveTool(t.id as CadTool);
                  setDraftStart(null);
                  setMeasureStart(null);
                  if (activeFlyout && activeFlyout !== t.id) setActiveFlyout(null);
                }}
                onContextMenu={(e) => {
                  if (t.hasSub) {
                    e.preventDefault();
                    setActiveFlyout(prev => prev === t.id ? null : (t.id as any));
                  }
                }}
                className={`relative w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  !enabled
                    ? 'text-on-surface-variant/25 cursor-not-allowed'
                    : activeTool === t.id
                    ? 'bg-surface-container-high text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
                title={enabled ? t.title : `${t.title} — indisponible dans cet onglet`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: activeTool === t.id ? "'FILL' 1" : "'FILL' 0" }}>
                  {t.icon}
                </span>
                {activeTool === t.id && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                )}
                {t.hasSub && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTool(t.id as CadTool);
                      setActiveFlyout(prev => prev === t.id ? null : (t.id as any));
                    }}
                    className="absolute bottom-0 right-0 text-[8px] text-outline-variant hover:text-primary leading-none cursor-pointer p-0.5"
                    title="Menu des sous-outils"
                  >
                    ▾
                  </span>
                )}
                {t.key && !t.hasSub && (
                  <span className={`absolute bottom-0 right-0.5 font-mono text-[8px] ${activeTool === t.id ? 'text-primary font-bold' : 'text-outline'}`}>
                    {t.key}
                  </span>
                )}
              </button>
            </div>
            );
          })}

          {/* Subtools Flyout Menu */}
          {activeFlyout && (
            <div
              className="absolute left-12 z-50 bg-[#020d18]/95 backdrop-blur-md border border-primary/40 rounded-lg p-2 shadow-2xl font-mono text-xs flex flex-col gap-1 w-64 select-none animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: activeFlyout === 'wall' ? '65px' : activeFlyout === 'partition' ? '100px' : activeFlyout === 'rect' ? '135px' : '170px'
              }}
            >
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-outline-variant/30 text-[10px] text-outline uppercase font-bold">
                <span>
                  {activeFlyout === 'wall' ? 'Sous-outils Mur' : activeFlyout === 'partition' ? 'Sous-outils Cloison' : activeFlyout === 'rect' ? 'Sous-outils Forme' : 'Sous-outils Tracé'}
                </span>
                <button onClick={() => setActiveFlyout(null)} className="hover:text-primary text-[12px] px-1">✕</button>
              </div>

              {activeFlyout === 'wall' && [
                { id: 'single', label: 'Mur Droit', icon: 'segment', desc: 'Segment unique droit (P1 → P2)' },
                { id: 'continuous', label: 'Mur Continu', icon: 'timeline', desc: 'Murs consécutifs en chaîne (Entrée pour valider)' },
                { id: 'rect', label: '4 Murs Rectangle', icon: 'crop_square', desc: 'Génère 4 murs connectés en boîte fermée' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setActiveTool('wall');
                    setWallSubTool(sub.id as WallSubTool);
                    setDraftStart(null);
                    setActiveFlyout(null);
                  }}
                  className={`flex items-start gap-2 p-1.5 rounded transition-all text-left ${
                    wallSubTool === sub.id && activeTool === 'wall'
                      ? 'bg-primary/20 text-primary border border-primary/50 font-bold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">{sub.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold">{sub.label}</div>
                    <div className="text-[9px] text-outline font-normal">{sub.desc}</div>
                  </div>
                </button>
              ))}

              {activeFlyout === 'partition' && [
                { id: 'single', label: 'Cloison Droite', icon: 'segment', desc: 'Segment unique droit (P1 → P2)' },
                { id: 'continuous', label: 'Cloison Continue', icon: 'timeline', desc: 'Cloisons consécutives en chaîne' },
                { id: 'rect', label: '4 Cloisons Rectangle', icon: 'crop_square', desc: 'Boîte fermée de 4 cloisons' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setActiveTool('partition');
                    setPartitionSubTool(sub.id as WallSubTool);
                    setDraftStart(null);
                    setActiveFlyout(null);
                  }}
                  className={`flex items-start gap-2 p-1.5 rounded transition-all text-left ${
                    partitionSubTool === sub.id && activeTool === 'partition'
                      ? 'bg-tertiary/20 text-tertiary border border-tertiary/50 font-bold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">{sub.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold">{sub.label}</div>
                    <div className="text-[9px] text-outline font-normal">{sub.desc}</div>
                  </div>
                </button>
              ))}

              {activeFlyout === 'rect' && [
                { id: 'rect', label: 'Rectangle', icon: 'rectangle', desc: 'Emprise rectangulaire (L × H mm)' },
                { id: 'circle', label: 'Cercle', icon: 'radio_button_unchecked', desc: 'Forme circulaire (Centre + Rayon)' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setActiveTool('rect');
                    setShapeSubTool(sub.id as ShapeSubTool);
                    setDraftStart(null);
                    setActiveFlyout(null);
                  }}
                  className={`flex items-start gap-2 p-1.5 rounded transition-all text-left ${
                    shapeSubTool === sub.id && activeTool === 'rect'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-400/50 font-bold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-sky-400 mt-0.5">{sub.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold">{sub.label}</div>
                    <div className="text-[9px] text-outline font-normal">{sub.desc}</div>
                  </div>
                </button>
              ))}

              {activeFlyout === 'polyline' && [
                { id: 'straight', label: 'Trait / Segments', icon: 'polyline', desc: 'Traits droits successifs (fermer ou Entrée)' },
                { id: 'freehand', label: 'Libre (Main levée)', icon: 'gesture', desc: 'Tracé fluide au glisser de souris' },
                { id: 'curve', label: 'Courbe / Arc Bézier', icon: 'gesture_select', desc: 'Arc ou courbe paramétrique 3 points' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setActiveTool('polyline');
                    setPolylineSubTool(sub.id as PolylineSubTool);
                    setPolyPoints([]);
                    setCurveStep(0);
                    setCurveP1(null);
                    setCurveP2(null);
                    setActiveFlyout(null);
                  }}
                  className={`flex items-start gap-2 p-1.5 rounded transition-all text-left ${
                    polylineSubTool === sub.id && activeTool === 'polyline'
                      ? 'bg-primary/20 text-primary border border-primary/50 font-bold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">{sub.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold">{sub.label}</div>
                    <div className="text-[9px] text-outline font-normal">{sub.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="w-5 h-px bg-outline-variant/30 my-0.5"></div>

          {/* Quick Undo / Redo in toolstrip */}
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || activeRail !== 'plan'}
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            title="Annuler dernière action (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[17px]">undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0 || activeRail !== 'plan'}
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            title="Rétablir (Ctrl+Y)"
          >
            <span className="material-symbols-outlined text-[17px]">redo</span>
          </button>

          {/* Delete Button (Active when selected) */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              selectedIds.length > 0 ? 'text-error hover:bg-error/20 font-bold' : 'text-outline-variant opacity-30 cursor-not-allowed'
            }`}
            title="Supprimer les éléments sélectionnés (Suppr)"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </aside>

        {/* LATERAL SIDEBAR LAYER MANAGER */}
        {isSidebarLayersOpen && (
          <LayerManager
            layers={layers}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onChangeColor={handleChangeColor}
            onAddLayer={handleAddLayer}
            onClose={() => setIsSidebarLayersOpen(false)}
          />
        )}

        {/* LATERAL SIDEBAR LIBRARY DRAWER */}
        {isSidebarLibraryOpen && (
          <aside className="w-84 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col z-30 shadow-2xl overflow-hidden flex-none">
            <CadLibraryPanel
              onInsertBlock={handleInsertBlock}
              onClose={() => setIsSidebarLibraryOpen(false)}
            />
          </aside>
        )}

        {/* Central CAD Canvas Viewport */}
        <main
          ref={canvasContainerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsOverCanvas(true)}
          onMouseLeave={() => {
            setIsOverCanvas(false);
            setActiveSnap(null);
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onClick={handleCanvasClick}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleCanvasDrop}
          className={`flex-1 relative overflow-hidden bg-[#06101c] ${
            isPanning ? 'cursor-grabbing' : (isSpaceHeld || activeTool === 'pan') ? 'cursor-grab' : 'cursor-none'
          }`}
        >
          {activeRail === 'layout' ? (
            <LayoutPanel
              levels={levels}
              entitiesByLevel={entitiesByLevel}
              isLayerVisible={(id) => getLayer(id).visible}
              activeLevelId={activeLevelId}
              sheets={sheets}
              setSheets={setSheets}
              activeSheetId={activeSheetId}
              setActiveSheetId={setActiveSheetId}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              shapeSubTool={shapeSubTool}
              setShapeSubTool={setShapeSubTool}
              polylineSubTool={polylineSubTool}
              setPolylineSubTool={setPolylineSubTool}
              onBackToPlan={() => setActiveRail('plan')}
            />
          ) : activeRail === 'views' ? (
            <ViewsPanel
              levels={levels}
              entitiesByLevel={entitiesByLevel}
              activeLevelId={activeLevelId}
              isLayerVisible={(id) => getLayer(id).visible}
              selectedIds={selectedIds}
              onBackToPlan={() => setActiveRail('plan')}
            />
          ) : (
            /* 2D Plan Viewport (Vector Canvas with Dynamic Entities) */
            <div 
              className="absolute inset-0 overflow-visible"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${canvasZoom})`,
                transformOrigin: '0 0',
                transition: 'none'
              }}
            >
              {/* Millimeter / Meter CAD Grid Pattern with 20px Points Matrix */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Minor 20px Grid with Dot at every intersection */}
                  <pattern id="cad-minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0e2338" strokeWidth="0.5" opacity={settings.grid ? 0.35 : 0} />
                    {/* Grille de points 20px */}
                    <circle cx="0" cy="0" r="1.15" fill={settings.snapToGrid ? "#4edea3" : "#4cd7f6"} opacity={settings.grid ? (settings.snapToGrid ? 0.75 : 0.4) : 0} />
                    <circle cx="20" cy="20" r="1.15" fill={settings.snapToGrid ? "#4edea3" : "#4cd7f6"} opacity={settings.grid ? (settings.snapToGrid ? 0.75 : 0.4) : 0} />
                  </pattern>
                  <pattern id="cad-major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <rect width="100" height="100" fill="url(#cad-minor-grid)" />
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#163450" strokeWidth="1" opacity={settings.grid ? 0.75 : 0} />
                    {/* Major 100px point marker */}
                    <circle cx="0" cy="0" r="2.2" fill={settings.snapToGrid ? "#4edea3" : "#4cd7f6"} opacity={settings.grid ? 0.95 : 0} />
                  </pattern>
                  <pattern id="wall-concrete-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#1c2b3c" strokeWidth="1.8" />
                    <line x1="4" y1="2" x2="4" y2="6" stroke="#4cd7f6" strokeWidth="0.8" opacity="0.4" />
                  </pattern>
                </defs>
                <rect x="-30000" y="-30000" width="60000" height="60000" fill="url(#cad-major-grid)" />
              </svg>

              {/* Reactive Architectural Geometry Layer (1:1 CAD Coordinates) */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                <defs>
                  {/* HACHURE BRIQUES: Running bond brick pattern */}
                  <pattern id="hatch-briques" width="28" height="14" patternUnits="userSpaceOnUse">
                    <rect width="28" height="14" fill="#0d1b2a" fillOpacity="0.6" />
                    <line x1="0" y1="0" x2="28" y2="0" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                    <line x1="0" y1="7" x2="28" y2="7" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                    <line x1="0" y1="14" x2="28" y2="14" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                    <line x1="0" y1="0" x2="0" y2="7" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                    <line x1="14" y1="7" x2="14" y2="14" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                    <line x1="28" y1="0" x2="28" y2="7" stroke="#f97316" strokeWidth="1" strokeOpacity="0.6" />
                  </pattern>

                  {/* HACHURE BÉTON: Aggregates triangles + dots DIN standard */}
                  <pattern id="hatch-beton" width="22" height="22" patternUnits="userSpaceOnUse">
                    <rect width="22" height="22" fill="#0c1d2e" fillOpacity="0.6" />
                    <polygon points="4,5 8,11 3,10" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.75" />
                    <polygon points="15,15 18,18 13,19" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.75" />
                    <circle cx="13" cy="7" r="0.9" fill="#94a3b8" fillOpacity="0.75" />
                    <circle cx="6" cy="18" r="0.9" fill="#94a3b8" fillOpacity="0.75" />
                    <circle cx="19" cy="11" r="0.7" fill="#94a3b8" fillOpacity="0.6" />
                  </pattern>

                  {/* HACHURE BOIS: Parquet oak wood slats */}
                  <pattern id="hatch-bois" width="32" height="16" patternUnits="userSpaceOnUse">
                    <rect width="32" height="16" fill="#141923" fillOpacity="0.6" />
                    <line x1="0" y1="0" x2="32" y2="0" stroke="#f59e0b" strokeWidth="0.9" strokeOpacity="0.6" />
                    <line x1="0" y1="8" x2="32" y2="8" stroke="#f59e0b" strokeWidth="0.9" strokeOpacity="0.6" />
                    <line x1="0" y1="16" x2="32" y2="16" stroke="#f59e0b" strokeWidth="0.9" strokeOpacity="0.6" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="0.9" strokeOpacity="0.6" />
                    <line x1="16" y1="8" x2="16" y2="16" stroke="#f59e0b" strokeWidth="0.9" strokeOpacity="0.6" />
                    <path d="M 4,4 Q 16,2 26,5" fill="none" stroke="#d97706" strokeWidth="0.6" strokeOpacity="0.35" />
                    <path d="M 2,12 Q 14,10 28,13" fill="none" stroke="#d97706" strokeWidth="0.6" strokeOpacity="0.35" />
                  </pattern>

                  {/* HACHURE ISOLATION: Classic batt loops */}
                  <pattern id="hatch-isolation" width="20" height="16" patternUnits="userSpaceOnUse">
                    <rect width="20" height="16" fill="#101c28" fillOpacity="0.6" />
                    <path d="M 0,8 Q 5,0 10,8 T 20,8" fill="none" stroke="#eab308" strokeWidth="1" strokeOpacity="0.65" />
                    <line x1="0" y1="0" x2="20" y2="0" stroke="#ca8a04" strokeWidth="0.6" strokeDasharray="2 2" strokeOpacity="0.4" />
                    <line x1="0" y1="16" x2="20" y2="16" stroke="#ca8a04" strokeWidth="0.6" strokeDasharray="2 2" strokeOpacity="0.4" />
                  </pattern>

                  {/* HACHURE CARRELAGE: Clean grid tile lines */}
                  <pattern id="hatch-carrelage" width="18" height="18" patternUnits="userSpaceOnUse">
                    <rect width="18" height="18" fill="#0d2438" fillOpacity="0.6" />
                    <line x1="0" y1="0" x2="18" y2="0" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.55" />
                    <line x1="0" y1="0" x2="0" y2="18" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.55" />
                  </pattern>

                  {/* HACHURE SABLE: Fine sand stipple */}
                  <pattern id="hatch-sable" width="14" height="14" patternUnits="userSpaceOnUse">
                    <rect width="14" height="14" fill="#151e28" fillOpacity="0.6" />
                    <circle cx="3" cy="3" r="0.75" fill="#94a3b8" fillOpacity="0.65" />
                    <circle cx="10" cy="4" r="0.6" fill="#94a3b8" fillOpacity="0.55" />
                    <circle cx="6" cy="10" r="0.8" fill="#94a3b8" fillOpacity="0.65" />
                    <circle cx="12" cy="11" r="0.6" fill="#94a3b8" fillOpacity="0.55" />
                  </pattern>
                </defs>

                {/* 0. NIVEAU INFÉRIEUR EN FOND ESTOMPÉ (calage des murs de l'étage) */}
                {ghostEntities.length > 0 && (
                  <g className="pointer-events-none" opacity={0.22}>
                    {ghostEntities.map(g => (
                      <line
                        key={`ghost-${g.id}`}
                        x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
                        stroke="#94a3b8"
                        strokeWidth={Math.max((g.thickness || 100) / 10, 2)}
                        strokeLinecap="butt"
                      />
                    ))}
                  </g>
                )}

                {/* 1. ROOMS (Background fills & labels & parametric hatch patterns) */}
                {entities.filter(e => e.type === 'room').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const isHatchTarget = activeTool === 'hatch' && isHovered;
                  const hasHatch = ent.hatchPattern && ent.hatchPattern !== 'none';
                  const w = Math.abs(ent.x2 - ent.x1);
                  const h = Math.abs(ent.y2 - ent.y1);

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer"
                    >
                      {/* Base room surface */}
                      <rect
                        x={Math.min(ent.x1, ent.x2)}
                        y={Math.min(ent.y1, ent.y2)}
                        width={w}
                        height={h}
                        fill="#0d1c2d"
                        fillOpacity="0.45"
                      />

                      {/* Parametric Architectural Hatch Pattern Layer */}
                      {hasHatch && (
                        <rect
                          x={Math.min(ent.x1, ent.x2)}
                          y={Math.min(ent.y1, ent.y2)}
                          width={w}
                          height={h}
                          fill={`url(#hatch-${ent.hatchPattern})`}
                          fillOpacity={0.85}
                        />
                      )}

                      {/* Selection / Hover / Hatch Target Outline */}
                      <rect
                        x={Math.min(ent.x1, ent.x2)}
                        y={Math.min(ent.y1, ent.y2)}
                        width={w}
                        height={h}
                        fill={isHatchTarget ? `url(#hatch-${activeHatchPattern})` : 'none'}
                        fillOpacity={isHatchTarget ? 0.45 : 0}
                        stroke={isSelected ? '#ffb95f' : isHatchTarget ? '#a855f7' : isHovered ? '#38bdf8' : isAiDiffPreview ? '#4edea3' : '#173048'}
                        strokeWidth={isSelected ? 2.5 : isHatchTarget ? 2 : isHovered ? 1.8 : 0.8}
                        strokeDasharray={isSelected ? '5 3' : isHatchTarget ? '4 2' : isHovered ? '3 2' : 'none'}
                      />

                      {/* Hatch Tag Pill Badge */}
                      {hasHatch && (
                        <g transform={`translate(${Math.min(ent.x1, ent.x2) + 8}, ${Math.min(ent.y1, ent.y2) + 14})`}>
                          <rect x="0" y="-8" width={ent.hatchPattern!.length * 6.5 + 16} height="13" rx="2" fill="#030b14" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="0.6" />
                          <text x="5" y="1" fill="#38bdf8" className="text-[8px] font-mono font-bold uppercase" fontFamily="JetBrains Mono">
                            {ent.hatchPattern}
                          </text>
                        </g>
                      )}

                      {/* Centered Room Labels */}
                      <g transform={`translate(${(ent.x1 + ent.x2) / 2}, ${(ent.y1 + ent.y2) / 2})`}>
                        <rect x="-85" y="-14" width="170" height="44" rx="4" fill="#020914" fillOpacity="0.8" />
                        <text textAnchor="middle" className="text-[13px] fill-on-surface font-semibold tracking-wide" fontFamily="Inter">
                          {ent.label}
                        </text>
                        <text textAnchor="middle" y="17" fill={isSelected ? '#ffb95f' : l.color} className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                          {ent.id === 'room-salon' ? `${salonArea} m²` : `${ent.area} m²`} · HSP: {ent.height || 2.80}m
                        </text>
                        {ent.subText && (
                          <text textAnchor="middle" y="29" className="text-[9px] fill-outline font-mono" fontFamily="JetBrains Mono">
                            {ent.subText}
                          </text>
                        )}
                      </g>
                    </g>
                  );
                })}

                {/* 2. MOBILIER & AGENCEMENT */}
                {entities.filter(e => e.type === 'furniture').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;
                  const w = Math.abs(ent.x2 - ent.x1);
                  const h = Math.abs(ent.y2 - ent.y1);

                  const midX = (ent.x1 + ent.x2) / 2;
                  const midY = (ent.y1 + ent.y2) / 2;
                  const rot = ent.angle || 0;

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      transform={rot ? `rotate(${rot} ${midX} ${midY})` : undefined}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {(() => {
                        // Symbole du bloc (vue de dessus) étiré dans l'emprise de l'entité ;
                        // meubles posés sans bloc d'origine : symbole déduit du nom
                        const blk = findBlock(ent.blockId) || {
                          id: `inferred-${ent.id}`, name: ent.name, category: 'sejour' as const, widthMm: Math.max(w, 1) * 10, heightMm: Math.max(h, 1) * 10,
                          defaultLayer: ent.layerId, icon: 'chair', description: '', renderType: inferRenderType(ent.name),
                        };
                        const minX = Math.min(ent.x1, ent.x2), minY = Math.min(ent.y1, ent.y2);
                        return (
                          <>
                            <rect x={minX} y={minY} width={w} height={h} fill="transparent" />
                            <BlockSvg block={blk} view="top" stretch color={isSelected || isHovered ? strokeColor : blockColor(blk)} box={{ x: minX, y: minY, width: w, height: h }} />
                            {(isSelected || isHovered) && (
                              <rect x={minX} y={minY} width={w} height={h} fill="none" stroke={strokeColor} strokeWidth={isSelected ? 1.6 : 1.2} strokeDasharray={isHovered ? '3 2' : '4 2'} />
                            )}
                            {w >= 40 && (
                              <text x={minX + w / 2} y={minY + h + 9} textAnchor="middle" fill={strokeColor} className="text-[7px] font-mono select-none pointer-events-none" fontFamily="JetBrains Mono" opacity={0.85}>
                                {ent.label || ent.name}
                              </text>
                            )}
                          </>
                        );
                      })()}

                      {/* Grips on selection */}
                      {isSelected && (
                        <>
                          <rect x={ent.x1 - 3} y={ent.y1 - 3} width="6" height="6" fill="#ffb95f" />
                          <rect x={ent.x2 - 3} y={ent.y2 - 3} width="6" height="6" fill="#ffb95f" />
                        </>
                      )}
                    </g>
                  );
                })}

                {/* 3. WALLS & PARTITIONS — raccords calculés (onglets / tés) ; contours puis remplissages
                    pour que les murs raccordés forment une seule maçonnerie continue */}
                {(() => {
                  const visWalls = entities.filter(e => ['wall', 'partition'].includes(e.type) && getLayer(e.layerId).visible);
                  const polys = computeWallPolygons(visWalls);

                  const renderGroup = (kind: 'wall' | 'partition') => {
                    const group = visWalls.filter(e => e.type === kind);
                    if (!group.length) return null;
                    const info = group.map(ent => {
                      const l = getLayer(ent.layerId);
                      const isSelected = selectedIds.includes(ent.id);
                      const isHovered = hoveredEntityId === ent.id && !isSelected;
                      const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                      const sw = isSelected ? 2.5 : isHovered ? 2.5 : kind === 'wall' ? 2 : 1.5;
                      const openings = getOpeningsForWall(ent);
                      return { ent, l, isSelected, isHovered, strokeColor, sw, openings, thick: ent.thickness ? ent.thickness / 10 : 8, maskId: `mask-wall-${ent.id}` };
                    });
                    return (
                      <React.Fragment key={`wall-group-${kind}`}>
                        {/* Masques de découpe de maçonnerie pour portes & fenêtres */}
                        <defs>
                          {info.filter(i => i.openings.length > 0).map(i => (
                            <mask key={i.maskId} id={i.maskId} maskUnits="userSpaceOnUse">
                              <rect x={-5000} y={-5000} width={10000} height={10000} fill="white" />
                              {i.openings.map(op => {
                                const opMidX = (op.x1 + op.x2) / 2;
                                const opMidY = (op.y1 + op.y2) / 2;
                                const opLen = Math.hypot(op.x2 - op.x1, op.y2 - op.y1) || (op.openingWidth ? op.openingWidth / 10 : 83);
                                const opAngleDeg = (Math.atan2(op.y2 - op.y1, op.x2 - op.x1) * 180) / Math.PI;
                                const cutThick = Math.max(i.thick * 1.6, 36);
                                return (
                                  <g key={`cut-${op.id}`} transform={`translate(${opMidX}, ${opMidY}) rotate(${opAngleDeg})`}>
                                    <rect x={-opLen / 2} y={-cutThick / 2} width={opLen} height={cutThick} fill="black" />
                                  </g>
                                );
                              })}
                            </mask>
                          ))}
                        </defs>

                        {/* Passe 1 : contours (demi-épaisseur extérieure visible) */}
                        <g className="pointer-events-none">
                          {info.map(i => polys[i.ent.id] && (
                            <polygon
                              key={`o-${i.ent.id}`}
                              points={polyToPoints(polys[i.ent.id])}
                              fill="none"
                              stroke={i.strokeColor}
                              strokeWidth={i.sw * 2}
                              strokeLinejoin="miter"
                              opacity={i.l.locked ? 0.6 : 1}
                              mask={i.openings.length > 0 ? `url(#${i.maskId})` : undefined}
                            />
                          ))}
                        </g>

                        {/* Passe 2 : remplissages (masquent les contours intérieurs aux raccords) */}
                        {info.map(i => polys[i.ent.id] && (
                          <g
                            key={`f-${i.ent.id}`}
                            data-entity-id={i.ent.id}
                            onClick={(e) => handleEntityClick(e, i.ent)}
                            className="cursor-pointer"
                            opacity={i.l.locked ? 0.6 : 1}
                            mask={i.openings.length > 0 ? `url(#${i.maskId})` : undefined}
                          >
                            <polygon
                              points={polyToPoints(polys[i.ent.id])}
                              fill={kind === 'wall' ? 'url(#wall-concrete-hatch)' : '#273647'}
                              stroke="none"
                            />
                          </g>
                        ))}

                        {/* Tableaux de maçonnerie aux deux extrémités de chaque ouverture + poignées de sélection */}
                        {info.map(i => (
                          <g key={`x-${i.ent.id}`} className="pointer-events-none">
                            {i.openings.map(op => {
                              const opAngleRad = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
                              const halfThick = i.thick / 2;
                              const perpX = -Math.sin(opAngleRad) * halfThick;
                              const perpY = Math.cos(opAngleRad) * halfThick;
                              return (
                                <g key={`jambs-${op.id}`}>
                                  <line x1={op.x1 - perpX} y1={op.y1 - perpY} x2={op.x1 + perpX} y2={op.y1 + perpY} stroke={i.strokeColor} strokeWidth={i.sw} />
                                  <line x1={op.x2 - perpX} y1={op.y2 - perpY} x2={op.x2 + perpX} y2={op.y2 + perpY} stroke={i.strokeColor} strokeWidth={i.sw} />
                                </g>
                              );
                            })}
                            {i.isSelected && (
                              <>
                                <line x1={i.ent.x1} y1={i.ent.y1} x2={i.ent.x2} y2={i.ent.y2} stroke="#ffb95f" strokeWidth="0.8" strokeDasharray="6 3 1 3" opacity="0.8" />
                                <rect x={i.ent.x1 - 3.5} y={i.ent.y1 - 3.5} width="7" height="7" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                                <rect x={i.ent.x2 - 3.5} y={i.ent.y2 - 3.5} width="7" height="7" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                                <rect x={(i.ent.x1 + i.ent.x2) / 2 - 3.5} y={(i.ent.y1 + i.ent.y2) / 2 - 3.5} width="7" height="7" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                              </>
                            )}
                          </g>
                        ))}
                      </React.Fragment>
                    );
                  };

                  return (
                    <>
                      {renderGroup('wall')}
                      {renderGroup('partition')}
                    </>
                  );
                })()}

                {/* 3A. TEXTES / ANNOTATIONS */}
                {entities.filter(e => e.type === 'text').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const fs = ent.fontSize || 14;
                  const lines = (ent.label || '').split('\n');
                  const tw = Math.max(...lines.map(s2 => s2.length), 1) * fs * 0.6;
                  return (
                    <g
                      key={ent.id}
                      data-entity-id={ent.id}
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {(isSelected || isHovered) && (
                        <rect x={ent.x1 - 3} y={ent.y1 - fs - 2} width={tw + 6} height={lines.length * fs * 1.2 + 4} fill="none" stroke={isSelected ? '#ffb95f' : '#38bdf8'} strokeWidth={1} strokeDasharray="4 2" />
                      )}
                      <text x={ent.x1} y={ent.y1} fontSize={fs} fill={ent.color || l.color} fontFamily="Inter, sans-serif" className="select-none">
                        {lines.map((ln, i) => (
                          <tspan key={i} x={ent.x1} dy={i === 0 ? 0 : '1.2em'}>{ln}</tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}

                {/* 3B. FORMES RECTANGULAIRES (Outil Rectangle R) */}
                {entities.filter(e => e.type === 'rect').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                  const minX = Math.min(ent.x1, ent.x2);
                  const minY = Math.min(ent.y1, ent.y2);
                  const w = Math.max(2, Math.abs(ent.x2 - ent.x1));
                  const h = Math.max(2, Math.abs(ent.y2 - ent.y1));
                  const widthMm = Math.round(w * 10);
                  const heightMm = Math.round(h * 10);
                  const areaM2 = ent.area || Math.round(((widthMm * heightMm) / 1000000) * 100) / 100;
                  const fillUrl = ent.hatchPattern && ent.hatchPattern !== 'none'
                    ? `url(#hatch-${ent.hatchPattern})`
                    : 'rgba(56, 189, 248, 0.08)';

                  return (
                    <g
                      key={ent.id}
                      data-entity-id={ent.id}
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {/* Fond et contour de la forme rectangulaire */}
                      <rect
                        x={minX}
                        y={minY}
                        width={w}
                        height={h}
                        fill={fillUrl}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.8}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                      />

                      {/* Étiquette centrale avec dimensions et surface */}
                      <g transform={`translate(${minX + w / 2}, ${minY + h / 2})`} className="pointer-events-none">
                        <rect
                          x="-65"
                          y="-18"
                          width="130"
                          height="36"
                          rx="4"
                          fill="#011020"
                          fillOpacity="0.88"
                          stroke={strokeColor}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="-3"
                          textAnchor="middle"
                          fill="#f8fafc"
                          className="text-[10px] font-mono font-bold"
                          fontFamily="JetBrains Mono"
                        >
                          {widthMm} × {heightMm} mm
                        </text>
                        <text
                          x="0"
                          y="11"
                          textAnchor="middle"
                          fill={strokeColor}
                          className="text-[9px] font-mono font-semibold"
                          fontFamily="JetBrains Mono"
                        >
                          {areaM2} m²
                        </text>
                      </g>

                      {/* Poignées de redimensionnement aux 4 coins lors de la sélection */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          <rect x={minX - 4} y={minY - 4} width="8" height="8" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={minX + w - 4} y={minY - 4} width="8" height="8" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={minX + w - 4} y={minY + h - 4} width="8" height="8" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={minX - 4} y={minY + h - 4} width="8" height="8" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 3B-2. FORMES CIRCULAIRES (Outil Forme -> Cercle) */}
                {entities.filter(e => e.type === 'circle').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                  const cx = ent.x1;
                  const cy = ent.y1;
                  const r = ent.radius ?? Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
                  const rMm = Math.round(r * 10);
                  const dMm = rMm * 2;
                  const areaM2 = ent.area ?? Math.round(Math.PI * Math.pow(rMm / 1000, 2) * 100) / 100;
                  const fillUrl = ent.hatchPattern && ent.hatchPattern !== 'none'
                    ? `url(#hatch-${ent.hatchPattern})`
                    : 'rgba(56, 189, 248, 0.08)';

                  return (
                    <g
                      key={ent.id}
                      data-entity-id={ent.id}
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {/* Cercle principal */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={fillUrl}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.8}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                      />
                      {/* Croix centrale de repère */}
                      <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={strokeColor} strokeWidth="1" />
                      <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={strokeColor} strokeWidth="1" />
                      {/* Ligne de rayon */}
                      <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke={strokeColor} strokeWidth="1" strokeDasharray="3 2" />

                      {/* Badge central d'information */}
                      <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                        <rect
                          x="-60"
                          y="-16"
                          width="120"
                          height="32"
                          rx="4"
                          fill="#011020"
                          fillOpacity="0.88"
                          stroke={strokeColor}
                          strokeWidth="1"
                        />
                        <text x="0" y="-2" textAnchor="middle" fill="#f8fafc" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                          ⌀ {dMm} mm (R: {rMm})
                        </text>
                        <text x="0" y="10" textAnchor="middle" fill={strokeColor} className="text-[9px] font-mono font-semibold" fontFamily="JetBrains Mono">
                          {areaM2} m²
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* 3C. POLYGONES & FORMES DIVERSES À TRAITS MULTIPLES (Outil Polygone L) */}
                {entities.filter(e => e.type === 'polygon' || e.type === 'polyline').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                  const pts = ent.points || [];
                  if (pts.length < 2) return null;
                  const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                  const isClosed = ent.isClosed ?? true;
                  const fillUrl = isClosed && ent.hatchPattern && ent.hatchPattern !== 'none'
                    ? `url(#hatch-${ent.hatchPattern})`
                    : isClosed
                    ? 'rgba(76, 215, 246, 0.08)'
                    : 'none';

                  const centroidX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                  const centroidY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

                  return (
                    <g
                      key={ent.id}
                      data-entity-id={ent.id}
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {isClosed ? (
                        <polygon
                          points={pointsStr}
                          fill={fillUrl}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2.2 : 1.8}
                          strokeDasharray={isSelected ? '6 3' : undefined}
                        />
                      ) : (
                        <polyline
                          points={pointsStr}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2.2 : 1.8}
                        />
                      )}

                      {/* Poignées de sommets */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          {pts.map((p, idx) => (
                            <rect
                              key={idx}
                              x={p.x - 3.5}
                              y={p.y - 3.5}
                              width="7"
                              height="7"
                              fill="#4cd7f6"
                              stroke="#051424"
                              strokeWidth="1"
                            />
                          ))}
                        </g>
                      )}

                      {/* Badge central d'information */}
                      {isClosed && ent.area && (
                        <g transform={`translate(${centroidX}, ${centroidY})`} className="pointer-events-none">
                          <rect
                            x="-55"
                            y="-14"
                            width="110"
                            height="28"
                            rx="4"
                            fill="#011020"
                            fillOpacity="0.88"
                            stroke={strokeColor}
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="-1"
                            textAnchor="middle"
                            fill="#f8fafc"
                            className="text-[9px] font-mono font-bold"
                            fontFamily="JetBrains Mono"
                          >
                            {ent.label || `POLYGONE (${pts.length} TRAITS)`}
                          </text>
                          <text
                            x="0"
                            y="9"
                            textAnchor="middle"
                            fill={strokeColor}
                            className="text-[8px] font-mono font-semibold"
                            fontFamily="JetBrains Mono"
                          >
                            {ent.area} m²
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 3C-2. COURBES & ARCS BÉZIER (Outil Polygone -> Courbe) */}
                {entities.filter(e => e.type === 'curve').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                  const cp = ent.curvePoint ?? { x: (ent.x1 + ent.x2) / 2, y: (ent.y1 + ent.y2) / 2 - 30 };
                  const pathD = `M ${ent.x1} ${ent.y1} Q ${cp.x} ${cp.y} ${ent.x2} ${ent.y2}`;
                  const chordMm = Math.round(Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1) * 10);

                  return (
                    <g
                      key={ent.id}
                      data-entity-id={ent.id}
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {/* Tracé de la courbe */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                      />
                      {/* Extrémités */}
                      <circle cx={ent.x1} cy={ent.y1} r="3.5" fill={strokeColor} />
                      <circle cx={ent.x2} cy={ent.y2} r="3.5" fill={strokeColor} />

                      {/* Lignes de contrôle visibles lors de la sélection */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          <line x1={ent.x1} y1={ent.y1} x2={cp.x} y2={cp.y} stroke="#ffb95f" strokeWidth="0.8" strokeDasharray="3 3" />
                          <line x1={ent.x2} y1={ent.y2} x2={cp.x} y2={cp.y} stroke="#ffb95f" strokeWidth="0.8" strokeDasharray="3 3" />
                          <circle cx={cp.x} cy={cp.y} r="5" fill="#ffb95f" stroke="#051424" strokeWidth="1.5" />
                        </g>
                      )}

                      {/* Étiquette d'information */}
                      <g transform={`translate(${cp.x}, ${cp.y - 14})`} className="pointer-events-none">
                        <rect x="-55" y="-10" width="110" height="20" rx="3" fill="#011020" fillOpacity="0.88" stroke={strokeColor} strokeWidth="1" />
                        <text x="0" y="4" textAnchor="middle" fill="#f8fafc" className="text-[9px] font-mono font-bold" fontFamily="JetBrains Mono">
                          ARC {chordMm} mm
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* 4. DOORS & SWINGS (Menuiseries architecturales encastrées) */}
                {entities.filter(e => e.type === 'door').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const color = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;
                  
                  const widthPx = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1) || (ent.openingWidth ? ent.openingWidth / 10 : 83);
                  const midX = (ent.x1 + ent.x2) / 2;
                  const midY = (ent.y1 + ent.y2) / 2;
                  const angleRad = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
                  const angleDeg = (angleRad * 180) / Math.PI;
                  const wallThick = ent.thickness ? (ent.thickness / 10) : 20;
                  const swing = ent.doorSwing || 'right';
                  const openAngle = ent.doorAngle !== undefined ? ent.doorAngle : 90;
                  const flip = ent.flipSwing ? -1 : 1;
                  const halfW = widthPx / 2;
                  const halfThick = wallThick / 2;
                  const frameW = 3.5;
                  const leafLen = Math.max(10, widthPx - frameW * 2);
                  
                  const hx = swing === 'left' ? (-halfW + frameW) : (halfW - frameW);
                  const leafRot = swing === 'left' ? (flip * -openAngle) : (180 + flip * openAngle);
                  const leafRad = leafRot * Math.PI / 180;
                  const tipX = hx + leafLen * Math.cos(leafRad);
                  const tipY = leafLen * Math.sin(leafRad);
                  const closedTipX = swing === 'left' ? (hx + leafLen) : (hx - leafLen);

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {/* Dormants / Bâti de porte (gauche et droite) */}
                      <rect x={-halfW} y={-halfThick} width={frameW} height={wallThick} rx={0.8} fill="#1e293b" stroke={color} strokeWidth={1} />
                      <rect x={halfW - frameW} y={-halfThick} width={frameW} height={wallThick} rx={0.8} fill="#1e293b" stroke={color} strokeWidth={1} />

                      {/* Seuil de porte (pointillés discrets) */}
                      <line x1={-halfW + frameW} y1={0} x2={halfW - frameW} y2={0} stroke={color} strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />

                      {/* Arc de débattement du battant */}
                      {openAngle > 0 && (
                        <path
                          d={`M ${closedTipX} 0 A ${leafLen} ${leafLen} 0 0 ${swing === 'left' ? (flip > 0 ? 0 : 1) : (flip > 0 ? 1 : 0)} ${tipX} ${tipY}`}
                          fill="none"
                          stroke={color}
                          strokeWidth={isSelected ? 1.5 : 1}
                          strokeDasharray="3 2.5"
                          opacity={0.85}
                        />
                      )}

                      {/* Vantail / Battant de porte */}
                      <rect
                        x={0}
                        y={-1.8}
                        width={leafLen}
                        height={3.6}
                        rx={0.8}
                        fill={isSelected ? '#ffb95f' : color}
                        fillOpacity={0.9}
                        stroke={isSelected ? '#051424' : color}
                        strokeWidth={0.8}
                        transform={`translate(${hx}, 0) rotate(${leafRot})`}
                      />

                      {/* Pivot de rotation (Charnière) */}
                      <circle cx={hx} cy={0} r={2.2} fill={color} stroke="#020914" strokeWidth={0.8} />

                      {/* Étiquette d'ouverture */}
                      <g transform={`translate(0, ${flip * (halfThick + 12)})`} className="pointer-events-none select-none">
                        <rect x="-44" y="-7" width="88" height="14" rx="3" fill="#020914" fillOpacity="0.88" stroke={color} strokeWidth={0.6} />
                        <text textAnchor="middle" y={3.5} fill={color} className="text-[8px] font-mono font-bold" fontFamily="JetBrains Mono">
                          {ent.label || `PORTE ${ent.openingWidth || Math.round(widthPx * 10)}mm`}
                        </text>
                      </g>

                      {/* Grips de sélection CAD */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          <rect x={hx - 3.5} y={-3.5} width="7" height="7" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                          <circle cx={tipX} cy={tipY} r={3.5} fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={-3.5} y={-3.5} width="7" height="7" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 5. WINDOWS & BAIES (Menuiseries vitrées encastrées) */}
                {entities.filter(e => e.type === 'window').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const color = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;

                  const widthPx = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1) || (ent.openingWidth ? ent.openingWidth / 10 : 120);
                  const midX = (ent.x1 + ent.x2) / 2;
                  const midY = (ent.y1 + ent.y2) / 2;
                  const angleRad = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
                  const angleDeg = (angleRad * 180) / Math.PI;
                  const wallThick = ent.thickness ? (ent.thickness / 10) : 20;
                  const halfW = widthPx / 2;
                  const halfThick = wallThick / 2;
                  const isSliding = widthPx >= 160 || ent.name.toLowerCase().includes('baie') || ent.openingType === 'window_sliding';

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}
                      className="cursor-pointer group"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {/* Dormant / Châssis extérieur */}
                      <rect
                        x={-halfW}
                        y={-halfThick}
                        width={widthPx}
                        height={wallThick}
                        fill="#0b1b2b"
                        fillOpacity="0.9"
                        stroke={color}
                        strokeWidth={isSelected ? 2 : 1.2}
                      />

                      {/* Appui de fenêtre (Côté extérieur) */}
                      <line
                        x1={-halfW - 3}
                        y1={-halfThick - 1.5}
                        x2={halfW + 3}
                        y2={-halfThick - 1.5}
                        stroke={color}
                        strokeWidth={1.8}
                      />

                      {/* Vitrage double ou vantaux coulissants */}
                      {isSliding ? (
                        <>
                          {/* Vantail 1 */}
                          <rect
                            x={-halfW + 3}
                            y={-halfThick * 0.75}
                            width={halfW + 1}
                            height={halfThick * 0.75}
                            rx={1}
                            fill="#38bdf8"
                            fillOpacity="0.25"
                            stroke="#38bdf8"
                            strokeWidth={1}
                          />
                          {/* Vantail 2 */}
                          <rect
                            x={-2}
                            y={0}
                            width={halfW + 1}
                            height={halfThick * 0.75}
                            rx={1}
                            fill="#38bdf8"
                            fillOpacity="0.25"
                            stroke="#38bdf8"
                            strokeWidth={1}
                          />
                        </>
                      ) : (
                        <>
                          {/* Double vitrage thermique (2 lignes parallèles) */}
                          <line x1={-halfW + 4} y1={-2} x2={halfW - 4} y2={-2} stroke="#38bdf8" strokeWidth={1.2} />
                          <line x1={-halfW + 4} y1={2} x2={halfW - 4} y2={2} stroke="#38bdf8" strokeWidth={1.2} />
                          {/* Meneau central pour les fenêtres larges */}
                          {widthPx >= 80 && (
                            <line x1={0} y1={-halfThick} x2={0} y2={halfThick} stroke={color} strokeWidth={1.4} />
                          )}
                        </>
                      )}

                      {/* Étiquette de la fenêtre */}
                      <g transform={`translate(0, ${halfThick + 12})`} className="pointer-events-none select-none">
                        <rect x="-55" y="-7" width="110" height="14" rx="3" fill="#020914" fillOpacity="0.88" stroke={color} strokeWidth={0.6} />
                        <text textAnchor="middle" y={3.5} fill={color} className="text-[8px] font-mono font-bold" fontFamily="JetBrains Mono">
                          {ent.label || `FENÊTRE ${ent.openingWidth || Math.round(widthPx * 10)}mm`}
                        </text>
                      </g>

                      {/* Grips de sélection */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          <rect x={-halfW - 3} y={-3} width="6" height="6" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                          <rect x={halfW - 3} y={-3} width="6" height="6" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                          <rect x={-3} y={-3} width="6" height="6" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 6. COTATIONS ASSOCIATIVES */}
                {entities.filter(e => e.type === 'dim').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const color = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;

                  // Compute angle and perpendicular offset vector
                  const angle = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
                  const perpX = Math.sin(angle);
                  const perpY = -Math.cos(angle);
                  const offset = ent.dimOffset !== undefined ? ent.dimOffset : 16;

                  const dX1 = ent.x1 + perpX * offset;
                  const dY1 = ent.y1 + perpY * offset;
                  const dX2 = ent.x2 + perpX * offset;
                  const dY2 = ent.y2 + perpY * offset;

                  // 45 degree tick marks at ends
                  const tickLen = 6;
                  const tickAng = angle + Math.PI / 4;
                  const tDx = Math.cos(tickAng) * tickLen;
                  const tDy = Math.sin(tickAng) * tickLen;

                  const midX = (dX1 + dX2) / 2;
                  const midY = (dY1 + dY2) / 2;

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer group"
                    >
                      {/* Witness lines from reference points to dimension line */}
                      <line
                        x1={ent.x1}
                        y1={ent.y1}
                        x2={dX1 + perpX * 3}
                        y2={dY1 + perpY * 3}
                        stroke="#64748b"
                        strokeWidth="0.8"
                        strokeDasharray={offset > 12 ? '2 2' : 'none'}
                      />
                      <line
                        x1={ent.x2}
                        y1={ent.y2}
                        x2={dX2 + perpX * 3}
                        y2={dY2 + perpY * 3}
                        stroke="#64748b"
                        strokeWidth="0.8"
                        strokeDasharray={offset > 12 ? '2 2' : 'none'}
                      />

                      {/* Main Dimension Line */}
                      <line
                        x1={dX1}
                        y1={dY1}
                        x2={dX2}
                        y2={dY2}
                        stroke={color}
                        strokeWidth={isSelected ? 2.2 : isHovered ? 1.8 : 1.2}
                      />

                      {/* 45° Architectural Hash Ticks */}
                      <line
                        x1={dX1 - tDx}
                        y1={dY1 - tDy}
                        x2={dX1 + tDx}
                        y2={dY1 + tDy}
                        stroke={color}
                        strokeWidth={isSelected ? 2.4 : 1.8}
                      />
                      <line
                        x1={dX2 - tDx}
                        y1={dY2 - tDy}
                        x2={dX2 + tDx}
                        y2={dY2 + tDy}
                        stroke={color}
                        strokeWidth={isSelected ? 2.4 : 1.8}
                      />

                      {/* Origin point dots */}
                      <circle cx={ent.x1} cy={ent.y1} r="2" fill="#64748b" />
                      <circle cx={ent.x2} cy={ent.y2} r="2" fill="#64748b" />

                      {/* Dimension Text Badge */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-36"
                          y="-9"
                          width="72"
                          height="18"
                          rx="3"
                          fill="#020a14"
                          fillOpacity="0.94"
                          stroke={color}
                          strokeWidth={isSelected ? 1.5 : 0.8}
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill={color}
                          className="text-[11px] font-mono font-bold tracking-tight"
                          fontFamily="JetBrains Mono"
                        >
                          {ent.label}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* 7. LIVE DRAFTING GHOST RUBBER-BAND (Active tool drawing in progress) */}
                {draftStart && (
                  <g id="active-ghost-drawing" className="pointer-events-none">
                    {/* Start point anchor glyph */}
                    <circle cx={draftStart.x} cy={draftStart.y} r="4" fill="#4cd7f6" stroke="#051424" strokeWidth="1.5" />
                    
                    {/* Live rubber-band line */}
                    <line
                      x1={draftStart.x}
                      y1={draftStart.y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke={activeTool === 'dim' ? '#38bdf8' : activeTool === 'partition' ? '#4edea3' : '#4cd7f6'}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />

                    {/* Ghost Wall body preview (Sub-outils Mur : Droit, Continu, ou 4 Murs Rectangle) */}
                    {activeTool === 'wall' && wallSubTool === 'rect' && (() => {
                      const minX = Math.min(draftStart.x, cursorPos.x);
                      const minY = Math.min(draftStart.y, cursorPos.y);
                      const w = Math.max(10, Math.abs(cursorPos.x - draftStart.x));
                      const h = Math.max(10, Math.abs(cursorPos.y - draftStart.y));
                      const wt = wallThickness / 10;
                      // corps du mur selon la ligne de référence : Nu Gauche = vers l'intérieur, Droite = vers l'extérieur
                      const eo = wallJustif === 'Nu Droite' ? wt : wallJustif === 'Axe' ? wt / 2 : 0;
                      const ei = wt - eo;
                      const wMm = Math.round(w * 10);
                      const hMm = Math.round(h * 10);
                      const areaM2 = ((wMm * hMm) / 1000000).toFixed(2);
                      return (
                        <g>
                          <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="#4cd7f6" strokeWidth="2" strokeDasharray="4 3" />
                          <rect x={minX + ei} y={minY + ei} width={Math.max(0, w - ei * 2)} height={Math.max(0, h - ei * 2)} fill="none" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="2 2" />
                          <path
                            d={`M ${minX - eo} ${minY - eo} H ${minX + w + eo} V ${minY + h + eo} H ${minX - eo} Z M ${minX + ei} ${minY + ei} V ${minY + h - ei} H ${minX + w - ei} V ${minY + ei} Z`}
                            fill="url(#wall-concrete-hatch)"
                            fillRule="evenodd"
                            opacity="0.8"
                          />
                          <circle cx={minX} cy={minY} r="3" fill="#4cd7f6" />
                          <circle cx={minX + w} cy={minY} r="3" fill="#4cd7f6" />
                          <circle cx={minX + w} cy={minY + h} r="3" fill="#4cd7f6" />
                          <circle cx={minX} cy={minY + h} r="3" fill="#4cd7f6" />
                          <g transform={`translate(${minX + w / 2}, ${minY + h / 2})`}>
                            <rect x="-75" y="-18" width="150" height="36" rx="4" fill="#011020" fillOpacity="0.92" stroke="#4cd7f6" strokeWidth="1.2" />
                            <text x="0" y="-3" textAnchor="middle" fill="#4cd7f6" className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                              4 MURS : {wMm} × {hMm} mm
                            </text>
                            <text x="0" y="11" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono" fontFamily="JetBrains Mono">
                              Emprise : {areaM2} m² (Ép {wallThickness}mm)
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {activeTool === 'wall' && wallSubTool !== 'rect' && (() => {
                      const angle = Math.atan2(cursorPos.y - draftStart.y, cursorPos.x - draftStart.x);
                      const halfThick = wallThickness / 20;
                      const perpX = Math.sin(angle) * halfThick;
                      const perpY = -Math.cos(angle) * halfThick;
                      const c = placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, wallThickness);
                      const pts = [
                        `${c.x1 + perpX},${c.y1 + perpY}`,
                        `${c.x2 + perpX},${c.y2 + perpY}`,
                        `${c.x2 - perpX},${c.y2 - perpY}`,
                        `${c.x1 - perpX},${c.y1 - perpY}`,
                      ].join(' ');
                      return (
                        <g>
                          <polygon points={pts} fill="url(#wall-concrete-hatch)" stroke="#4cd7f6" strokeWidth="2" opacity="0.85" />
                          <line x1={draftStart.x} y1={draftStart.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#4cd7f6" strokeWidth="1" strokeDasharray="3 3" />
                        </g>
                      );
                    })()}

                    {/* Ghost Cloison / Partition body preview */}
                    {activeTool === 'partition' && partitionSubTool === 'rect' && (() => {
                      const minX = Math.min(draftStart.x, cursorPos.x);
                      const minY = Math.min(draftStart.y, cursorPos.y);
                      const w = Math.max(10, Math.abs(cursorPos.x - draftStart.x));
                      const h = Math.max(10, Math.abs(cursorPos.y - draftStart.y));
                      const pt = partitionThickness / 10;
                      const peo = wallJustif === 'Nu Droite' ? pt : wallJustif === 'Axe' ? pt / 2 : 0;
                      const pei = pt - peo;
                      const wMm = Math.round(w * 10);
                      const hMm = Math.round(h * 10);
                      const areaM2 = ((wMm * hMm) / 1000000).toFixed(2);
                      return (
                        <g>
                          <rect x={minX} y={minY} width={w} height={h} fill="none" stroke="#4edea3" strokeWidth="2" strokeDasharray="4 3" />
                          <rect x={minX + pei} y={minY + pei} width={Math.max(0, w - pei * 2)} height={Math.max(0, h - pei * 2)} fill="none" stroke="#4edea3" strokeWidth="1.5" strokeDasharray="2 2" />
                          <path
                            d={`M ${minX - peo} ${minY - peo} H ${minX + w + peo} V ${minY + h + peo} H ${minX - peo} Z M ${minX + pei} ${minY + pei} V ${minY + h - pei} H ${minX + w - pei} V ${minY + pei} Z`}
                            fill="#182736"
                            fillRule="evenodd"
                            opacity="0.9"
                          />
                          <g transform={`translate(${minX + w / 2}, ${minY + h / 2})`}>
                            <rect x="-75" y="-18" width="150" height="36" rx="4" fill="#011020" fillOpacity="0.92" stroke="#4edea3" strokeWidth="1.2" />
                            <text x="0" y="-3" textAnchor="middle" fill="#4edea3" className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                              4 CLOISONS : {wMm} × {hMm} mm
                            </text>
                            <text x="0" y="11" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono" fontFamily="JetBrains Mono">
                              Surface : {areaM2} m² (Ép {partitionThickness}mm)
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {activeTool === 'partition' && partitionSubTool !== 'rect' && (() => {
                      const angle = Math.atan2(cursorPos.y - draftStart.y, cursorPos.x - draftStart.x);
                      const halfThick = partitionThickness / 20;
                      const perpX = Math.sin(angle) * halfThick;
                      const perpY = -Math.cos(angle) * halfThick;
                      const c = placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, partitionThickness);
                      const pts = [
                        `${c.x1 + perpX},${c.y1 + perpY}`,
                        `${c.x2 + perpX},${c.y2 + perpY}`,
                        `${c.x2 - perpX},${c.y2 - perpY}`,
                        `${c.x1 - perpX},${c.y1 - perpY}`,
                      ].join(' ');
                      return (
                        <g>
                          <polygon points={pts} fill="#182736" stroke="#4edea3" strokeWidth="2" opacity="0.9" />
                          <line x1={draftStart.x} y1={draftStart.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#4edea3" strokeWidth="1" strokeDasharray="3 3" />
                        </g>
                      );
                    })()}

                    {/* Ghost Dimension preview (for tool dim) */}
                    {activeTool === 'dim' && (
                      <g>
                        {(() => {
                          const angle = Math.atan2(cursorPos.y - draftStart.y, cursorPos.x - draftStart.x);
                          const perpX = Math.sin(angle);
                          const perpY = -Math.cos(angle);
                          const offset = 16;
                          const dX1 = draftStart.x + perpX * offset;
                          const dY1 = draftStart.y + perpY * offset;
                          const dX2 = cursorPos.x + perpX * offset;
                          const dY2 = cursorPos.y + perpY * offset;
                          const tickLen = 6;
                          const tickAng = angle + Math.PI / 4;
                          const tDx = Math.cos(tickAng) * tickLen;
                          const tDy = Math.sin(tickAng) * tickLen;

                          return (
                            <>
                              <line x1={draftStart.x} y1={draftStart.y} x2={dX1 + perpX * 3} y2={dY1 + perpY * 3} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" />
                              <line x1={cursorPos.x} y1={cursorPos.y} x2={dX2 + perpX * 3} y2={dY2 + perpY * 3} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" />
                              <line x1={dX1} y1={dY1} x2={dX2} y2={dY2} stroke="#38bdf8" strokeWidth="2" />
                              <line x1={dX1 - tDx} y1={dY1 - tDy} x2={dX1 + tDx} y2={dY1 + tDy} stroke="#38bdf8" strokeWidth="2" />
                              <line x1={dX2 - tDx} y1={dY2 - tDy} x2={dX2 + tDx} y2={dY2 + tDy} stroke="#38bdf8" strokeWidth="2" />
                              <g transform={`translate(${(dX1 + dX2) / 2}, ${(dY1 + dY2) / 2})`}>
                                <rect x="-65" y="-12" width="130" height="24" rx="4" fill="#020a14" stroke="#38bdf8" strokeWidth="1.5" />
                                <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                                  📏 {currentDrawDist.toLocaleString('fr-FR')} mm ({(currentDrawDist / 1000).toFixed(2)}m)
                                </text>
                              </g>
                            </>
                          );
                        })()}
                      </g>
                    )}

                    {/* Ghost Forme preview (Rectangle ou Cercle selon shapeSubTool) */}
                    {activeTool === 'rect' && shapeSubTool === 'circle' && (() => {
                      const r = Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y);
                      const rMm = Math.round(r * 10);
                      const dMm = rMm * 2;
                      const areaM2 = (Math.PI * Math.pow(rMm / 1000, 2)).toFixed(2);
                      return (
                        <g>
                          <circle cx={draftStart.x} cy={draftStart.y} r={r} fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 3" />
                          <line x1={draftStart.x - 8} y1={draftStart.y} x2={draftStart.x + 8} y2={draftStart.y} stroke="#38bdf8" strokeWidth="1.2" />
                          <line x1={draftStart.x} y1={draftStart.y - 8} x2={draftStart.x} y2={draftStart.y + 8} stroke="#38bdf8" strokeWidth="1.2" />
                          <line x1={draftStart.x} y1={draftStart.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
                          <circle cx={cursorPos.x} cy={cursorPos.y} r="3.5" fill="#38bdf8" />
                          <g transform={`translate(${draftStart.x}, ${draftStart.y})`}>
                            <rect x="-65" y="-18" width="130" height="36" rx="4" fill="#011020" fillOpacity="0.92" stroke="#38bdf8" strokeWidth="1.2" />
                            <text x="0" y="-3" textAnchor="middle" fill="#38bdf8" className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                              ⌀ {dMm} mm (R: {rMm} mm)
                            </text>
                            <text x="0" y="11" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono" fontFamily="JetBrains Mono">
                              Surface : {areaM2} m²
                            </text>
                          </g>
                        </g>
                      );
                    })()}

                    {activeTool === 'rect' && shapeSubTool === 'rect' && (
                      <g>
                        <rect
                          x={Math.min(draftStart.x, cursorPos.x)}
                          y={Math.min(draftStart.y, cursorPos.y)}
                          width={Math.max(2, Math.abs(cursorPos.x - draftStart.x))}
                          height={Math.max(2, Math.abs(cursorPos.y - draftStart.y))}
                          fill="rgba(56, 189, 248, 0.12)"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="5 3"
                        />
                        {/* 4 Corner points */}
                        <circle cx={draftStart.x} cy={draftStart.y} r="3.5" fill="#38bdf8" />
                        <circle cx={cursorPos.x} cy={draftStart.y} r="3.5" fill="#38bdf8" />
                        <circle cx={cursorPos.x} cy={cursorPos.y} r="3.5" fill="#38bdf8" />
                        <circle cx={draftStart.x} cy={cursorPos.y} r="3.5" fill="#38bdf8" />

                        {/* Central Dimensions & Area Badge */}
                        {(() => {
                          const wMm = Math.round(Math.abs(cursorPos.x - draftStart.x) * 10);
                          const hMm = Math.round(Math.abs(cursorPos.y - draftStart.y) * 10);
                          const aM2 = ((wMm * hMm) / 1000000).toFixed(2);
                          const midX = (draftStart.x + cursorPos.x) / 2;
                          const midY = (draftStart.y + cursorPos.y) / 2;
                          return (
                            <g transform={`translate(${midX}, ${midY})`}>
                              <rect x="-70" y="-18" width="140" height="36" rx="4" fill="#011020" fillOpacity="0.92" stroke="#38bdf8" strokeWidth="1.2" />
                              <text x="0" y="-3" textAnchor="middle" fill="#38bdf8" className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                                {wMm} × {hMm} mm
                              </text>
                              <text x="0" y="11" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono" fontFamily="JetBrains Mono">
                                Surface : {aM2} m²
                              </text>
                            </g>
                          );
                        })()}
                      </g>
                    )}

                    {/* Dynamic dimension tag hovering above (for wall and partition) */}
                    {activeTool !== 'dim' && activeTool !== 'rect' && wallSubTool !== 'rect' && (
                      <g transform={`translate(${(draftStart.x + cursorPos.x) / 2}, ${(draftStart.y + cursorPos.y) / 2 - 18})`}>
                        <rect x="-35" y="-10" width="70" height="20" rx="3" fill="#010f1f" stroke={activeTool === 'partition' ? '#4edea3' : '#4cd7f6'} strokeWidth="1" />
                        <text x="0" y="4" textAnchor="middle" fill={activeTool === 'partition' ? '#4edea3' : '#4cd7f6'} className="text-[11px] font-mono font-bold" fontFamily="JetBrains Mono">
                          {currentDrawDist} mm
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* 7B. LIVE POLYGON & POLYLINE GHOST PREVIEW (Traits multiples) */}
                {activeTool === 'polyline' && polyPoints.length > 0 && (
                  <g id="active-ghost-polyline" className="pointer-events-none">
                    {/* Traits validés */}
                    {polyPoints.slice(0, -1).map((pt, i) => (
                      <line
                        key={i}
                        x1={pt.x}
                        y1={pt.y}
                        x2={polyPoints[i + 1].x}
                        y2={polyPoints[i + 1].y}
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                      />
                    ))}

                    {/* Trait élastique en cours vers le curseur */}
                    <line
                      x1={polyPoints[polyPoints.length - 1].x}
                      y1={polyPoints[polyPoints.length - 1].y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />

                    {/* Sommets déjà posés */}
                    {polyPoints.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#38bdf8" stroke="#020d18" strokeWidth="1.5" />
                        <text x={pt.x + 8} y={pt.y - 6} fill="#38bdf8" className="text-[9px] font-mono font-bold" fontFamily="JetBrains Mono">
                          P{i + 1}
                        </text>
                      </g>
                    ))}

                    {/* Indicateur de fermeture du polygone si proche du 1er sommet */}
                    {polyPoints.length >= 3 && Math.hypot(cursorPos.x - polyPoints[0].x, cursorPos.y - polyPoints[0].y) < 18 && (
                      <g>
                        <circle cx={polyPoints[0].x} cy={polyPoints[0].y} r="10" fill="none" stroke="#22c55e" strokeWidth="2.5" />
                        <g transform={`translate(${polyPoints[0].x}, ${polyPoints[0].y - 20})`}>
                          <rect x="-55" y="-10" width="110" height="20" rx="3" fill="#14532d" stroke="#22c55e" strokeWidth="1" />
                          <text x="0" y="4" textAnchor="middle" fill="#86efac" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                            ✓ Fermer polygone
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Longueur du trait actif en mm */}
                    {(() => {
                      const lastPt = polyPoints[polyPoints.length - 1];
                      const segDist = Math.round(Math.hypot(cursorPos.x - lastPt.x, cursorPos.y - lastPt.y) * 10);
                      const midX = (lastPt.x + cursorPos.x) / 2;
                      const midY = (lastPt.y + cursorPos.y) / 2;
                      return (
                        <g transform={`translate(${midX}, ${midY - 14})`}>
                          <rect x="-40" y="-9" width="80" height="18" rx="3" fill="#011020" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="1" />
                          <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                            {segDist} mm
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* 7B-2. LIVE FREEHAND TRACE PREVIEW (Sous-outil Tracé Libre) */}
                {activeTool === 'polyline' && polylineSubTool === 'freehand' && isDrawingFreehand && freehandPoints.length > 1 && (
                  <g id="active-ghost-freehand" className="pointer-events-none">
                    <polyline
                      points={freehandPoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx={freehandPoints[0].x} cy={freehandPoints[0].y} r="4" fill="#22c55e" stroke="#051424" strokeWidth="1" />
                    <circle cx={cursorPos.x} cy={cursorPos.y} r="4" fill="#38bdf8" stroke="#051424" strokeWidth="1" />
                    {freehandPoints.length > 10 && Math.hypot(cursorPos.x - freehandPoints[0].x, cursorPos.y - freehandPoints[0].y) < 24 && (
                      <circle cx={freehandPoints[0].x} cy={freehandPoints[0].y} r="12" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="3 3" />
                    )}
                  </g>
                )}

                {/* 7B-3. LIVE ARC / COURBE BÉZIER PREVIEW (Sous-outil Courbe) */}
                {activeTool === 'polyline' && polylineSubTool === 'curve' && (
                  <g id="active-ghost-curve" className="pointer-events-none">
                    {/* Étape 1 : P1 fixé, élastique vers cursorPos pour fixer P2 */}
                    {curveStep === 1 && curveP1 && (() => {
                      const chord = Math.round(Math.hypot(cursorPos.x - curveP1.x, cursorPos.y - curveP1.y) * 10);
                      const midX = (curveP1.x + cursorPos.x) / 2;
                      const midY = (curveP1.y + cursorPos.y) / 2;
                      return (
                        <>
                          <circle cx={curveP1.x} cy={curveP1.y} r="4.5" fill="#38bdf8" stroke="#051424" strokeWidth="1.5" />
                          <line x1={curveP1.x} y1={curveP1.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" />
                          <circle cx={cursorPos.x} cy={cursorPos.y} r="4" fill="#ffb95f" stroke="#051424" strokeWidth="1.5" />
                          <g transform={`translate(${midX}, ${midY - 14})`}>
                            <rect x="-45" y="-10" width="90" height="20" rx="3" fill="#011020" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="1" />
                            <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                              Corde : {chord} mm
                            </text>
                          </g>
                        </>
                      );
                    })()}

                    {/* Étape 2 : P1 et P2 fixés, modélisation de la courbure avec le curseur */}
                    {curveStep === 2 && curveP1 && curveP2 && (() => {
                      const chord = Math.round(Math.hypot(curveP2.x - curveP1.x, curveP2.y - curveP1.y) * 10);
                      const pathD = `M ${curveP1.x} ${curveP1.y} Q ${cursorPos.x} ${cursorPos.y} ${curveP2.x} ${curveP2.y}`;
                      return (
                        <>
                          <line x1={curveP1.x} y1={curveP1.y} x2={curveP2.x} y2={curveP2.y} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={curveP1.x} y1={curveP1.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#ffb95f" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={curveP2.x} y1={curveP2.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#ffb95f" strokeWidth="1" strokeDasharray="3 3" />
                          <path d={pathD} fill="none" stroke="#ffb95f" strokeWidth="2.5" />
                          <circle cx={curveP1.x} cy={curveP1.y} r="4.5" fill="#38bdf8" stroke="#051424" strokeWidth="1.5" />
                          <circle cx={curveP2.x} cy={curveP2.y} r="4.5" fill="#38bdf8" stroke="#051424" strokeWidth="1.5" />
                          <circle cx={cursorPos.x} cy={cursorPos.y} r="5" fill="#ffb95f" stroke="#051424" strokeWidth="1.5" />
                          <g transform={`translate(${cursorPos.x}, ${cursorPos.y - 16})`}>
                            <rect x="-65" y="-10" width="130" height="20" rx="3" fill="#011020" fillOpacity="0.95" stroke="#ffb95f" strokeWidth="1.2" />
                            <text x="0" y="4" textAnchor="middle" fill="#ffb95f" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                              ARC (Corde {chord} mm)
                            </text>
                          </g>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* 7C. LIVE OPENINGS GHOST PREVIEW (Portes et fenêtres toujours encastrées sur les murs) */}
                {(activeTool === 'door' || activeTool === 'window') && (() => {
                  const reqWidth = activeTool === 'door' ? (doorWidthSetting || 830) : (windowWidthSetting || 1200);
                  const snap = findWallSnap(cursorPos.x, cursorPos.y, reqWidth, 250);
                  const isDoor = activeTool === 'door';
                  const primaryColor = isDoor ? '#fbbf24' : '#38bdf8';

                  if (snap) {
                    const widthPx = reqWidth / 10;
                    const wallThick = snap.wallThickness / 10;
                    const halfW = widthPx / 2;
                    const halfThick = wallThick / 2;
                    const frameW = 3.5;
                    const leafLen = Math.max(10, widthPx - frameW * 2);
                    const swing = activeDoorSwing || 'right';
                    const flip = activeFlipSide ? -1 : 1;
                    const hx = swing === 'left' ? (-halfW + frameW) : (halfW - frameW);
                    const leafRot = swing === 'left' ? (flip * -90) : (180 + flip * 90);
                    const leafRad = leafRot * Math.PI / 180;
                    const tipX = hx + leafLen * Math.cos(leafRad);
                    const tipY = leafLen * Math.sin(leafRad);
                    const closedTipX = swing === 'left' ? (hx + leafLen) : (hx - leafLen);

                    return (
                      <g id="ghost-opening-snap" className="pointer-events-none">
                        {/* Rayon magnétique de projection vers le mur */}
                        {Math.hypot(cursorPos.x - snap.projX, cursorPos.y - snap.projY) > 5 && (
                          <line
                            x1={cursorPos.x}
                            y1={cursorPos.y}
                            x2={snap.projX}
                            y2={snap.projY}
                            stroke={primaryColor}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            opacity="0.8"
                          />
                        )}

                        {/* Surbrillance de la découpe le long de la maçonnerie */}
                        <line
                          x1={snap.p1X}
                          y1={snap.p1Y}
                          x2={snap.p2X}
                          y2={snap.p2Y}
                          stroke={primaryColor}
                          strokeWidth={wallThick + 4}
                          opacity="0.25"
                          strokeLinecap="butt"
                        />

                        {/* Rendu fantôme de l'ouverture encastrée orientée sur le mur */}
                        <g transform={`translate(${snap.projX}, ${snap.projY}) rotate(${snap.wallAngleDeg})`}>
                          {isDoor ? (
                            <>
                              {/* Bâti fantôme */}
                              <rect x={-halfW} y={-halfThick} width={frameW} height={wallThick} fill="#1e293b" stroke={primaryColor} strokeWidth={1.5} />
                              <rect x={halfW - frameW} y={-halfThick} width={frameW} height={wallThick} fill="#1e293b" stroke={primaryColor} strokeWidth={1.5} />
                              
                              {/* Seuil */}
                              <line x1={-halfW + frameW} y1={0} x2={halfW - frameW} y2={0} stroke={primaryColor} strokeWidth={1} strokeDasharray="2 2" />

                              {/* Arc fantôme */}
                              <path
                                d={`M ${closedTipX} 0 A ${leafLen} ${leafLen} 0 0 ${swing === 'left' ? (flip > 0 ? 0 : 1) : (flip > 0 ? 1 : 0)} ${tipX} ${tipY}`}
                                fill="none"
                                stroke={primaryColor}
                                strokeWidth={1.5}
                                strokeDasharray="3 2"
                              />

                              {/* Battant */}
                              <rect
                                x={0}
                                y={-1.8}
                                width={leafLen}
                                height={3.6}
                                rx={0.8}
                                fill={primaryColor}
                                fillOpacity={0.85}
                                stroke="#020914"
                                strokeWidth={0.8}
                                transform={`translate(${hx}, 0) rotate(${leafRot})`}
                              />

                              {/* Charnière */}
                              <circle cx={hx} cy={0} r={2.5} fill={primaryColor} />
                            </>
                          ) : (
                            <>
                              {/* Dormant fenêtre */}
                              <rect
                                x={-halfW}
                                y={-halfThick}
                                width={widthPx}
                                height={wallThick}
                                fill="#0b1b2b"
                                fillOpacity="0.8"
                                stroke={primaryColor}
                                strokeWidth={1.5}
                              />
                              {/* Appui */}
                              <line x1={-halfW - 3} y1={-halfThick - 1.5} x2={halfW + 3} y2={-halfThick - 1.5} stroke={primaryColor} strokeWidth={2} />
                              {/* Vitrage double */}
                              <line x1={-halfW + 4} y1={-2} x2={halfW - 4} y2={-2} stroke="#38bdf8" strokeWidth={1.4} />
                              <line x1={-halfW + 4} y1={2} x2={halfW - 4} y2={2} stroke="#38bdf8" strokeWidth={1.4} />
                            </>
                          )}
                        </g>

                        {/* Badge HUD d'information d'encastrement */}
                        <g transform={`translate(${snap.projX}, ${snap.projY - (wallThick / 2 + 28)})`}>
                          <rect x="-110" y="-14" width="220" height="28" rx="4" fill="#011020" fillOpacity="0.94" stroke={primaryColor} strokeWidth="1.2" />
                          <text x="0" y="-1" textAnchor="middle" fill={primaryColor} className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                            {isDoor ? `PORTE ${reqWidth}mm` : `FENÊTRE ${reqWidth}mm`} · ENCASTRÉE SUR MUR
                          </text>
                          <text x="0" y="9" textAnchor="middle" fill="#94a3b8" className="text-[8px] font-mono" fontFamily="JetBrains Mono">
                            {snap.wall.name} · Ép. {snap.wallThickness}mm · {snap.wallAngleDeg}° · [Espace] Inverser
                          </text>
                        </g>
                      </g>
                    );
                  }

                  // Si aucun mur à proximité
                  return (
                    <g transform={`translate(${cursorPos.x}, ${cursorPos.y - 25})`} className="pointer-events-none">
                      <rect x="-115" y="-12" width="230" height="24" rx="4" fill="#011020" fillOpacity="0.95" stroke="#f59e0b" strokeWidth="1" />
                      <text x="0" y="4" textAnchor="middle" fill="#fbbf24" className="text-[9px] font-mono font-bold" fontFamily="JetBrains Mono">
                        Approchez un mur pour encastrer l'ouverture
                      </text>
                    </g>
                  );
                })()}

                {/* 8. BOX SELECTION MARQUIS (Window / Crossing) */}
                {isBoxSelecting && boxStart && boxCurrent && (
                  <g className="pointer-events-none">
                    <rect
                      x={Math.min(boxStart.x, boxCurrent.x)}
                      y={Math.min(boxStart.y, boxCurrent.y)}
                      width={Math.abs(boxCurrent.x - boxStart.x)}
                      height={Math.abs(boxCurrent.y - boxStart.y)}
                      fill={boxCurrent.x > boxStart.x ? '#06b6d4' : '#4edea3'}
                      fillOpacity="0.15"
                      stroke={boxCurrent.x > boxStart.x ? '#06b6d4' : '#4edea3'}
                      strokeWidth="1.2"
                      strokeDasharray={boxCurrent.x > boxStart.x ? 'none' : '4 3'}
                    />
                  </g>
                )}

                {/* 9. OSNAP SNAP GLYPH INDICATOR */}
                {activeSnap && (
                  <g transform={`translate(${activeSnap.x}, ${activeSnap.y})`} className="pointer-events-none">
                    <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#4edea3" strokeWidth="2" />
                    <circle cx="0" cy="0" r="1.5" fill="#4edea3" />
                    <g transform="translate(10, -12)">
                      <rect x="0" y="0" width="105" height="18" rx="2" fill="#010f1f" stroke="#4edea3" strokeWidth="1" />
                      <text x="6" y="12" fill="#4edea3" className="text-[9px] font-mono font-semibold" fontFamily="JetBrains Mono">
                        {activeSnap.type}
                      </text>
                    </g>
                  </g>
                )}

                {/* 10. MAGNETIC GRID POINT TARGET */}
                {settings.snapToGrid && isOverCanvas && !activeSnap && (
                  <g transform={`translate(${cursorPos.x}, ${cursorPos.y})`} className="pointer-events-none">
                    <circle cx="0" cy="0" r="4" fill="none" stroke="#4edea3" strokeWidth="1" strokeDasharray="2 2" />
                    <rect x="-3" y="-3" width="6" height="6" transform="rotate(45)" fill="none" stroke="#4edea3" strokeWidth="1" />
                  </g>
                )}

                {/* 11. LIVE REAL-TIME DISTANCE MEASUREMENT (Active P1 -> Cursor) */}
                {activeTool === 'measure' && measureStart && (
                  <g id="active-measure-tool-live" className="pointer-events-none">
                    {/* Anchor Marker at P1 */}
                    <g transform={`translate(${measureStart.x}, ${measureStart.y})`}>
                      <circle cx="0" cy="0" r="12" fill="#f59e0b" fillOpacity="0.2" />
                      <circle cx="0" cy="0" r="5" fill="#f59e0b" stroke="#051424" strokeWidth="1.8" />
                      <line x1="-9" y1="0" x2="9" y2="0" stroke="#f59e0b" strokeWidth="1.5" />
                      <line x1="0" y1="-9" x2="0" y2="9" stroke="#f59e0b" strokeWidth="1.5" />
                      <rect x="7" y="-18" width="22" height="14" rx="2" fill="#020d1a" stroke="#f59e0b" strokeWidth="1" />
                      <text x="18" y="-7" textAnchor="middle" fill="#f59e0b" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                        P1
                      </text>
                    </g>

                    {/* Cursor Reticle at P2 */}
                    <g transform={`translate(${cursorPos.x}, ${cursorPos.y})`}>
                      <circle cx="0" cy="0" r="5" fill="#38bdf8" stroke="#051424" strokeWidth="1.5" />
                      <rect x="7" y="-18" width="22" height="14" rx="2" fill="#020d1a" stroke="#38bdf8" strokeWidth="1" />
                      <text x="18" y="-7" textAnchor="middle" fill="#38bdf8" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                        P2
                      </text>
                    </g>

                    {/* Cartesian Projection (ΔX Horizontal & ΔY Vertical Lines) */}
                    {Math.abs(cursorPos.x - measureStart.x) > 15 && Math.abs(cursorPos.y - measureStart.y) > 15 && (
                      <g className="opacity-80">
                        {/* Horizontal ΔX line */}
                        <line
                          x1={measureStart.x}
                          y1={measureStart.y}
                          x2={cursorPos.x}
                          y2={measureStart.y}
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                        {/* ΔX Tag */}
                        <g transform={`translate(${(measureStart.x + cursorPos.x) / 2}, ${measureStart.y + (cursorPos.y > measureStart.y ? -10 : 16)})`}>
                          <rect x="-38" y="-8" width="76" height="16" rx="2" fill="#020d1a" stroke="#38bdf8" strokeWidth="0.8" />
                          <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[9px] font-mono font-bold" fontFamily="JetBrains Mono">
                            ΔX: {liveMeasureDxMm} mm
                          </text>
                        </g>

                        {/* Vertical ΔY line */}
                        <line
                          x1={cursorPos.x}
                          y1={measureStart.y}
                          x2={cursorPos.x}
                          y2={cursorPos.y}
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                        {/* ΔY Tag */}
                        <g transform={`translate(${cursorPos.x + (cursorPos.x > measureStart.x ? 14 : -48)}, ${(measureStart.y + cursorPos.y) / 2})`}>
                          <rect x="-36" y="-8" width="72" height="16" rx="2" fill="#020d1a" stroke="#38bdf8" strokeWidth="0.8" />
                          <text x="0" y="4" textAnchor="middle" fill="#38bdf8" className="text-[9px] font-mono font-bold" fontFamily="JetBrains Mono">
                            ΔY: {liveMeasureDyMm} mm
                          </text>
                        </g>

                        {/* Right Angle Corner Square */}
                        <rect
                          x={cursorPos.x > measureStart.x ? cursorPos.x - 8 : cursorPos.x}
                          y={cursorPos.y > measureStart.y ? measureStart.y : measureStart.y - 8}
                          width="8"
                          height="8"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {/* Direct Measurement Laser Line */}
                    <line
                      x1={measureStart.x}
                      y1={measureStart.y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke="#f59e0b"
                      strokeWidth="5"
                      strokeOpacity="0.3"
                    />
                    <line
                      x1={measureStart.x}
                      y1={measureStart.y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke="#fbbf24"
                      strokeWidth="2.2"
                      strokeDasharray="5 3"
                    />

                    {/* Real-time Dynamic Midpoint Dimension Badge */}
                    <g transform={`translate(${(measureStart.x + cursorPos.x) / 2}, ${(measureStart.y + cursorPos.y) / 2})`}>
                      <rect
                        x="-110"
                        y="-26"
                        width="220"
                        height="46"
                        rx="6"
                        fill="#020d1a"
                        fillOpacity="0.95"
                        stroke="#f59e0b"
                        strokeWidth="1.6"
                      />
                      <text
                        x="0"
                        y="-7"
                        textAnchor="middle"
                        fill="#fbbf24"
                        className="text-[13px] font-mono font-bold"
                        fontFamily="JetBrains Mono"
                      >
                        📏 {liveMeasureDistMm.toLocaleString('fr-FR')} mm ({(liveMeasureDistMm / 1000).toFixed(3)} m)
                      </text>
                      <text
                        x="0"
                        y="11"
                        textAnchor="middle"
                        fill="#94a3b8"
                        className="text-[10px] font-mono"
                        fontFamily="JetBrains Mono"
                      >
                        ΔX: {liveMeasureDxMm} mm · ΔY: {liveMeasureDyMm} mm · ∠ {liveMeasureAngleDeg}°
                      </text>
                    </g>
                  </g>
                )}

                {/* 12. LOCKED MEASUREMENT RESULT (Persists until user starts a new measure or clears) */}
                {measureResult && (
                  <g id="locked-measure-result" className="pointer-events-none">
                    {/* End point ticks */}
                    <circle cx={measureResult.p1.x} cy={measureResult.p1.y} r="5" fill="#38bdf8" stroke="#051424" strokeWidth="2" />
                    <circle cx={measureResult.p2.x} cy={measureResult.p2.y} r="5" fill="#38bdf8" stroke="#051424" strokeWidth="2" />

                    {/* Solid Dimension Line */}
                    <line
                      x1={measureResult.p1.x}
                      y1={measureResult.p1.y}
                      x2={measureResult.p2.x}
                      y2={measureResult.p2.y}
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />

                    {/* Witness end tick crossbars */}
                    {(() => {
                      const ang = Math.atan2(measureResult.p2.y - measureResult.p1.y, measureResult.p2.x - measureResult.p1.x);
                      const perpX = Math.sin(ang) * 9;
                      const perpY = -Math.cos(ang) * 9;
                      return (
                        <>
                          <line
                            x1={measureResult.p1.x - perpX}
                            y1={measureResult.p1.y - perpY}
                            x2={measureResult.p1.x + perpX}
                            y2={measureResult.p1.y + perpY}
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <line
                            x1={measureResult.p2.x - perpX}
                            y1={measureResult.p2.y - perpY}
                            x2={measureResult.p2.x + perpX}
                            y2={measureResult.p2.y + perpY}
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                        </>
                      );
                    })()}

                    {/* Finalized Dimension Card Badge */}
                    <g transform={`translate(${(measureResult.p1.x + measureResult.p2.x) / 2}, ${(measureResult.p1.y + measureResult.p2.y) / 2})`}>
                      <rect
                        x="-115"
                        y="-28"
                        width="230"
                        height="50"
                        rx="8"
                        fill="#031628"
                        fillOpacity="0.96"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                      />
                      <text
                        x="0"
                        y="-10"
                        textAnchor="middle"
                        fill="#38bdf8"
                        className="text-[13px] font-mono font-bold tracking-tight"
                        fontFamily="JetBrains Mono"
                      >
                        📏 {measureResult.distanceMm.toLocaleString('fr-FR')} mm ({(measureResult.distanceMm / 1000).toFixed(3)} m)
                      </text>
                      <text
                        x="0"
                        y="6"
                        textAnchor="middle"
                        fill="#94a3b8"
                        className="text-[10px] font-mono"
                        fontFamily="JetBrains Mono"
                      >
                        ΔX = {measureResult.dxMm} mm · ΔY = {measureResult.dyMm} mm · {measureResult.angleDeg}°
                      </text>
                      <text
                        x="0"
                        y="18"
                        textAnchor="middle"
                        fill="#64748b"
                        className="text-[8px] font-mono"
                        fontFamily="JetBrains Mono"
                      >
                        [Cliquez pour nouvelle mesure · Barre d&apos;outils pour Cotation]
                      </text>
                    </g>
                  </g>
                )}

                {/* 10. INTERACTIVE CAD GRIP POINTS & MANIPULATION HANDLES LAYER */}
                {activeTool === 'select' && entities.filter(e => selectedIds.includes(e.id)).map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible || l.locked) return null;

                  // A. WALLS & PARTITIONS & LINES & DIMS
                  if (['wall', 'partition', 'line', 'dim'].includes(ent.type)) {
                    const midX = (ent.x1 + ent.x2) / 2;
                    const midY = (ent.y1 + ent.y2) / 2;
                    const lenMm = Math.round(Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1) * 10);
                    const angDeg = Math.round((Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1) * 180) / Math.PI);

                    return (
                      <g key={`interactive-grips-${ent.id}`} className="select-none pointer-events-auto">
                        {/* Grip P1 (Point de départ - étirement) */}
                        <g
                          className="cursor-crosshair group"
                          onMouseDown={(e) => handleGripMouseDown(ent, 'p1', e)}
                          onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: 'p1' })}
                          onMouseLeave={() => setHoveredGrip(null)}
                        >
                          <circle cx={ent.x1} cy={ent.y1} r="9" fill="transparent" />
                          <rect
                            x={ent.x1 - 4}
                            y={ent.y1 - 4}
                            width="8"
                            height="8"
                            fill={activeGrip?.entityId === ent.id && activeGrip?.gripType === 'p1' ? '#ffb95f' : '#4cd7f6'}
                            stroke="#051424"
                            strokeWidth="1.5"
                            className="transition-transform group-hover:scale-125"
                          />
                        </g>

                        {/* Grip P2 (Point d'arrivée - étirement) */}
                        <g
                          className="cursor-crosshair group"
                          onMouseDown={(e) => handleGripMouseDown(ent, 'p2', e)}
                          onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: 'p2' })}
                          onMouseLeave={() => setHoveredGrip(null)}
                        >
                          <circle cx={ent.x2} cy={ent.y2} r="9" fill="transparent" />
                          <rect
                            x={ent.x2 - 4}
                            y={ent.y2 - 4}
                            width="8"
                            height="8"
                            fill={activeGrip?.entityId === ent.id && activeGrip?.gripType === 'p2' ? '#ffb95f' : '#4cd7f6'}
                            stroke="#051424"
                            strokeWidth="1.5"
                            className="transition-transform group-hover:scale-125"
                          />
                        </g>

                        {/* Grip Mid (Milieu - déplacement complet de l'élément) */}
                        <g
                          className="cursor-move group"
                          onMouseDown={(e) => handleGripMouseDown(ent, 'mid', e)}
                          onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: 'mid' })}
                          onMouseLeave={() => setHoveredGrip(null)}
                        >
                          <circle cx={midX} cy={midY} r="9" fill="transparent" />
                          <rect
                            x={midX - 4}
                            y={midY - 4}
                            width="8"
                            height="8"
                            fill="#ffb95f"
                            stroke="#051424"
                            strokeWidth="1.5"
                            className="transition-transform group-hover:scale-125"
                          />
                        </g>

                        {/* Live HUD tooltip when dragging grip */}
                        {activeGrip?.entityId === ent.id && (
                          <g transform={`translate(${midX}, ${midY - 18})`} className="pointer-events-none">
                            <rect x="-65" y="-12" width="130" height="22" rx="4" fill="#031628" fillOpacity="0.95" stroke="#4cd7f6" strokeWidth="1" />
                            <text x="0" y="3" textAnchor="middle" fill="#4cd7f6" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                              L: {lenMm} mm · {angDeg}°
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  // B. ROOMS & RECTANGLES (Coins et arêtes étirables)
                  if (ent.type === 'room' || ent.type === 'rect') {
                    const minX = Math.min(ent.x1, ent.x2);
                    const maxX = Math.max(ent.x1, ent.x2);
                    const minY = Math.min(ent.y1, ent.y2);
                    const maxY = Math.max(ent.y1, ent.y2);
                    const midX = (minX + maxX) / 2;
                    const midY = (minY + maxY) / 2;

                    const handles = [
                      { id: 'corner-tl', x: minX, y: minY, cursor: 'cursor-nwse-resize' },
                      { id: 'corner-tr', x: maxX, y: minY, cursor: 'cursor-nesw-resize' },
                      { id: 'corner-br', x: maxX, y: maxY, cursor: 'cursor-nwse-resize' },
                      { id: 'corner-bl', x: minX, y: maxY, cursor: 'cursor-nesw-resize' },
                      { id: 'edge-top', x: midX, y: minY, cursor: 'cursor-ns-resize' },
                      { id: 'edge-right', x: maxX, y: midY, cursor: 'cursor-ew-resize' },
                      { id: 'edge-bottom', x: midX, y: maxY, cursor: 'cursor-ns-resize' },
                      { id: 'edge-left', x: minX, y: midY, cursor: 'cursor-ew-resize' },
                    ];

                    return (
                      <g key={`interactive-grips-room-${ent.id}`} className="select-none pointer-events-auto">
                        {handles.map(h => (
                          <g
                            key={h.id}
                            className={`${h.cursor} group`}
                            onMouseDown={(e) => handleGripMouseDown(ent, h.id, e)}
                            onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: h.id })}
                            onMouseLeave={() => setHoveredGrip(null)}
                          >
                            <circle cx={h.x} cy={h.y} r="9" fill="transparent" />
                            <rect
                              x={h.x - 4}
                              y={h.y - 4}
                              width="8"
                              height="8"
                              fill={activeGrip?.entityId === ent.id && activeGrip?.gripType === h.id ? '#ffb95f' : '#4cd7f6'}
                              stroke="#051424"
                              strokeWidth="1.5"
                              className="transition-transform group-hover:scale-125"
                            />
                          </g>
                        ))}

                        {/* Center Move Handle */}
                        <g
                          className="cursor-move group"
                          onMouseDown={(e) => handleGripMouseDown(ent, 'mid', e)}
                          onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: 'mid' })}
                          onMouseLeave={() => setHoveredGrip(null)}
                        >
                          <circle cx={midX} cy={midY} r="10" fill="transparent" />
                          <circle
                            cx={midX}
                            cy={midY}
                            r="5"
                            fill="#ffb95f"
                            stroke="#051424"
                            strokeWidth="1.5"
                            className="transition-transform group-hover:scale-125"
                          />
                        </g>
                      </g>
                    );
                  }

                  // C. POLYLINE / POLYGON
                  if (ent.type === 'polyline' && ent.points) {
                    return (
                      <g key={`interactive-grips-poly-${ent.id}`} className="select-none pointer-events-auto">
                        {ent.points.map((pt, idx) => (
                          <g
                            key={`poly-pt-${idx}`}
                            className="cursor-crosshair group"
                            onMouseDown={(e) => handleGripMouseDown(ent, `point-${idx}`, e)}
                            onMouseEnter={() => setHoveredGrip({ entityId: ent.id, gripType: `point-${idx}` })}
                            onMouseLeave={() => setHoveredGrip(null)}
                          >
                            <circle cx={pt.x} cy={pt.y} r="8" fill="transparent" />
                            <rect
                              x={pt.x - 3.5}
                              y={pt.y - 3.5}
                              width="7"
                              height="7"
                              fill={activeGrip?.entityId === ent.id && activeGrip?.gripType === `point-${idx}` ? '#ffb95f' : '#4cd7f6'}
                              stroke="#051424"
                              strokeWidth="1.5"
                              className="transition-transform group-hover:scale-125"
                            />
                          </g>
                        ))}
                      </g>
                    );
                  }

                  // D. BLOCS MOBILIERS
                  if (ent.type === 'furniture') {
                    const bx1 = ent.x1;
                    const by1 = ent.y1;
                    const bx2 = ent.x2 || (bx1 + 80);
                    const by2 = ent.y2 || (by1 + 60);
                    const midX = (bx1 + bx2) / 2;
                    const midY = (by1 + by2) / 2;

                    return (
                      <g key={`interactive-grips-furniture-${ent.id}`} className="select-none pointer-events-auto">
                        <g
                          className="cursor-move group"
                          onMouseDown={(e) => handleGripMouseDown(ent, 'mid', e)}
                        >
                          <circle cx={midX} cy={midY} r="10" fill="transparent" />
                          <circle cx={midX} cy={midY} r="5" fill="#ffb95f" stroke="#051424" strokeWidth="1.5" />
                        </g>
                      </g>
                    );
                  }

                  return null;
                })}
              </svg>

              {/* LIVE FULL CAD CROSSHAIR CURSOR BASE */}
              {isOverCanvas && !isPanning && !(isSpaceHeld || activeTool === 'pan') && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Full-screen crosshair axis lines */}
                  <div
                    className="absolute left-0 right-0 h-px bg-primary/45 pointer-events-none"
                    style={{ top: `${cursorPos.y}px` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/45 pointer-events-none"
                    style={{ left: `${cursorPos.x}px` }}
                  />

                  {/* Dynamic tag when moving entities */}
                  {isDraggingEntities && (
                    <div
                      className="absolute z-50 bg-[#031628]/95 px-2 py-1 rounded border border-primary/50 text-[10px] font-mono text-primary shadow-xl pointer-events-none flex items-center gap-1.5"
                      style={{ left: `${cursorPos.x + 14}px`, top: `${cursorPos.y + 14}px` }}
                    >
                      <span className="material-symbols-outlined text-[13px] text-primary">open_with</span>
                      <span>DÉPLACEMENT · ΔX: {Math.round(dragDelta.dx * 10)}mm · ΔY: {Math.round(dragDelta.dy * 10)}mm</span>
                    </div>
                  )}

                  {/* Dynamic tag when modifying grip */}
                  {activeGrip && (
                    <div
                      className="absolute z-50 bg-[#031628]/95 px-2 py-1 rounded border border-amber-400/60 text-[10px] font-mono text-amber-300 shadow-xl pointer-events-none flex items-center gap-1.5"
                      style={{ left: `${cursorPos.x + 14}px`, top: `${cursorPos.y + 14}px` }}
                    >
                      <span className="material-symbols-outlined text-[13px] text-amber-400">tune</span>
                      <span>ÉTIREMENT POIGNÉE [{activeGrip.gripType.toUpperCase()}]</span>
                    </div>
                  )}

                  {/* Cursor Center Base: Pickbox (Selection), Ruler (Measure) or Cross Aperture (Draw) */}
                  {activeTool === 'select' ? (
                    /* Pickbox Aperture Square exactly centered at (cursorPos.x, cursorPos.y) */
                    <div
                      className={`absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 border transition-all pointer-events-none flex items-center justify-center ${
                        hoveredEntityId
                          ? 'border-amber-400 bg-amber-400/30 ring-2 ring-amber-400/40 shadow-lg scale-110'
                          : 'border-primary bg-primary/20'
                      }`}
                      style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}
                    >
                      <div className={`w-1 h-1 rounded-full ${hoveredEntityId ? 'bg-amber-400' : 'bg-primary'}`}></div>
                    </div>
                  ) : activeTool === 'measure' ? (
                    /* Measure Reticle */
                    <div
                      className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 border border-amber-400/90 rounded-full flex items-center justify-center pointer-events-none bg-amber-400/10"
                      style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}
                    >
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                    </div>
                  ) : (
                    /* Drawing Center Reticle */
                    <div
                      className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 border border-primary/90 flex items-center justify-center pointer-events-none"
                      style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}
                    >
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    </div>
                  )}

                  {/* DYNAMIC HUD FLOATING BADGE (Anchored near cursor) */}
                  {settings.dynHud && (
                    <div
                      className="absolute pointer-events-none flex flex-col gap-1 -translate-y-16 translate-x-4 z-40 bg-surface-container-lowest/95 backdrop-blur-md px-2.5 py-1.5 rounded shadow-2xl border border-primary/40 font-mono"
                      style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-outline">
                          {activeTool === 'select' ? 'SÉLECT:' : activeTool === 'measure' ? 'MESURE:' : 'DIST:'}
                        </span>
                        <span className={`text-[12px] font-bold ${activeTool === 'measure' ? 'text-amber-400' : 'text-primary'}`}>
                          {activeTool === 'select' 
                            ? hoveredEntityId
                              ? `Cible: ${entities.find(e => e.id === hoveredEntityId)?.name || 'Élément'}`
                              : `${selectedIds.length} sélectionné${selectedIds.length > 1 ? 's' : ''}`
                            : activeTool === 'measure'
                            ? measureStart
                              ? `${liveMeasureDistMm} mm (${(liveMeasureDistMm / 1000).toFixed(2)} m)`
                              : 'P1 en attente'
                            : `${currentDrawDist} mm`
                          }
                        </span>
                        {settings.ortho && activeTool !== 'select' && (
                          <span className="px-1 py-0.2 rounded bg-tertiary/20 text-tertiary text-[9px] font-semibold">
                            ORTHO 0°
                          </span>
                        )}
                        {settings.snapToGrid && activeTool !== 'select' && (
                          <span className="px-1 py-0.2 rounded bg-tertiary-container/30 text-tertiary text-[9px] font-semibold flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-tertiary"></span>
                            GRILLE {settings.gridSnapSize}px
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-on-surface-variant flex items-center gap-1">
                        <span>
                          {activeTool === 'select'
                            ? hoveredEntityId
                              ? 'Point de sélection centré sur le curseur (Clic: sélection · Maj+Clic: cumul)'
                              : 'Glisser pour zone de sélection (Bleu/Vert)'
                            : activeTool === 'measure'
                            ? measureStart
                              ? `ΔX: ${liveMeasureDxMm} mm · ΔY: ${liveMeasureDyMm} mm · ∠ ${liveMeasureAngleDeg}° (Cliquez pour P2)`
                              : 'Cliquez sur le premier point (P1) pour mesurer'
                            : activeTool === 'partition'
                            ? draftStart
                              ? `Alignement sur grille 20px (${Math.round(currentDrawDist / (settings.gridSnapSize * 10))} pts)`
                              : 'Cliquez sur un point de grille 20px pour débuter'
                            : draftStart
                            ? 'Cliquez pour valider le 2ème point'
                            : 'Cliquez pour positionner le 1er point'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FLOATING CAD VIEWPORT & ZOOM NAVIGATION HUD WIDGET */}
          <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1.5 bg-surface-container-lowest/95 backdrop-blur border border-outline-variant/40 rounded-lg p-1.5 shadow-2xl font-mono text-xs pointer-events-auto select-none">
            {/* Tool Pan toggle */}
            <button
              onClick={() => setActiveTool(activeTool === 'pan' ? 'select' : 'pan')}
              className={`px-2 py-1 rounded transition-all flex items-center gap-1 text-[11px] ${
                activeTool === 'pan' || isSpaceHeld
                  ? 'bg-primary text-on-primary font-bold shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              title="Outil Panoramique (Maintenir Espace ou Clic Molette)"
            >
              <span className="material-symbols-outlined text-[15px]">pan_tool</span>
              <span className="hidden sm:inline">PAN</span>
            </button>

            <div className="h-4 w-px bg-outline-variant/40"></div>

            {/* Zoom Out */}
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Zoom Arrière (- ou Molette bas)"
            >
              <span className="material-symbols-outlined text-[17px]">remove</span>
            </button>

            {/* Zoom Percent display & reset */}
            <button
              onClick={handleZoomReset}
              className="px-2 py-0.5 rounded bg-surface-container-low hover:bg-surface-container text-primary font-bold font-mono text-[11px] border border-primary/25 transition-all hover:scale-105"
              title="Échelle de zoom actuelle (Cliquez pour 100%)"
            >
              {Math.round(canvasZoom * 100)}%
            </button>

            {/* Zoom In */}
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Zoom Avant (+ ou Molette haut)"
            >
              <span className="material-symbols-outlined text-[17px]">add</span>
            </button>

            <div className="h-4 w-px bg-outline-variant/40"></div>

            {/* Zoom Fit / Cadrer Tout */}
            <button
              onClick={handleZoomFit}
              className="px-2 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1 text-[11px]"
              title="Zoom Étendu / Cadrer tout le plan (Z E)"
            >
              <span className="material-symbols-outlined text-[15px]">fit_screen</span>
              <span className="hidden md:inline">CADRER</span>
            </button>
          </div>

          {/* VIEWPORT SCALE / METADATA WATERMARK */}
          <div className="absolute bottom-3 left-4 z-20 pointer-events-none flex flex-col gap-0.5">
            <div className="text-[13px] text-on-surface/90 font-semibold tracking-tight">
              PROJET : VILLA HORIZON
            </div>
            <div className="font-mono text-[10px] text-outline">
              PHASE : PERMIS DE CONSTRUIRE (PC) · ÉCHELLE 1:50 · RDC
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-16 bg-primary"></div>
              <div className="h-1.5 w-16 bg-surface-container-high"></div>
              <span className="font-mono text-[9px] text-on-surface-variant">0 — 2m — 4m</span>
            </div>
          </div>

          {/* VIEWPORT FLOATING CONTROLS & COMPASS */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-20 pointer-events-auto">
            {/* ViewCube */}
            <div className="w-14 h-14 bg-surface-container-lowest/90 backdrop-blur rounded flex flex-col items-center justify-center border border-outline-variant/30 shadow-md">
              <span className="font-mono text-[9px] text-primary font-bold">NORD</span>
              <div className="flex items-center justify-center my-0.5">
                <span className="material-symbols-outlined text-[16px] text-secondary rotate-45">explore</span>
              </div>
              <span className="font-mono text-[8px] text-outline">PLAN 2D</span>
            </div>

            {/* Zoom / Pan Action Bar */}
            <div className="flex flex-col bg-surface-container-lowest/90 backdrop-blur rounded border border-outline-variant/30 p-0.5 shadow-md">
              <button
                onClick={() => setCanvasZoom(z => Math.min(2.5, z + 0.15))}
                className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                title="Zoom Avant (+)"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
              <button
                onClick={() => setCanvasZoom(z => Math.max(0.5, z - 0.15))}
                className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                title="Zoom Arrière (-)"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <button
                onClick={() => {
                  setCanvasZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition-colors"
                title="Cadrer tout (Zoom Étendu Z+E)"
              >
                <span className="material-symbols-outlined text-[16px]">fit_screen</span>
              </button>
              <button
                onClick={() => setActiveRail(activeRail === 'views' ? 'plan' : 'views')}
                className="p-1 text-on-surface-variant hover:text-secondary hover:bg-surface-container rounded transition-colors"
                title="Vues : façades et coupes"
              >
                <span className="material-symbols-outlined text-[16px]">view_quilt</span>
              </button>
            </div>
          </div>
        </main>

        {/* 3. RIGHT MULTI-FUNCTIONAL DOCK (Tabbed: Propriétés, Bibliothèque, Calques, Archi AI Copilot) */}
        {isRightDockOpen ? (
          <aside className={`bg-surface-container-lowest border-l border-outline-variant/20 flex flex-col z-30 shadow-xl overflow-hidden flex-none transition-all ${rightDockTab === 'library' ? 'w-88' : 'w-80'}`}>
            {/* Dock Tab Headers */}
            <div className="h-9 bg-surface-container-low flex items-center px-1 border-b border-outline-variant/20 flex-none gap-0.5">
              <button
                onClick={() => setRightDockTab('props')}
                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-sm font-mono text-[10px] sm:text-[11px] transition-colors ${
                  rightDockTab === 'props'
                    ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">tune</span>
                <span>PROPRIÉTÉS</span>
              </button>

              <button
                onClick={() => setRightDockTab('library')}
                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-sm font-mono text-[10px] sm:text-[11px] transition-colors ${
                  rightDockTab === 'library'
                    ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">category</span>
                <span>BLOCS</span>
              </button>

              <button
                onClick={() => setRightDockTab('layers')}
                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-sm font-mono text-[10px] sm:text-[11px] transition-colors ${
                  rightDockTab === 'layers'
                    ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">layers</span>
                <span>CALQUES</span>
              </button>

              <button
                onClick={() => setRightDockTab('ai')}
                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-sm font-mono text-[10px] sm:text-[11px] transition-colors relative ${
                  rightDockTab === 'ai'
                    ? 'bg-surface-container-high text-tertiary font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[13px] text-tertiary">psychology</span>
                <span>COPILOT</span>
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
              </button>

              {/* Bouton pour activer/désactiver l'ouverture automatique de la fenêtre des paramètres */}
              <button
                onClick={() => setAutoOpenPropsOnSelect(prev => !prev)}
                className={`p-1 rounded transition-colors flex items-center justify-center ${
                  autoOpenPropsOnSelect
                    ? 'text-primary bg-primary/10'
                    : 'text-outline hover:text-on-surface hover:bg-surface-container'
                }`}
                title={`Ouverture auto paramètres au clic : ${autoOpenPropsOnSelect ? 'Activée' : 'Désactivée (inactif)'}`}
              >
                <span className="material-symbols-outlined text-[17px]">
                  {autoOpenPropsOnSelect ? 'toggle_on' : 'toggle_off'}
                </span>
              </button>

              {/* Bouton de fermeture de la fenêtre latérale */}
              <button
                onClick={() => setIsRightDockOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                title="Fermer la fenêtre latérale (Écran large)"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* TAB 1: PROPERTIES (Dynamic to Selection) */}
            {rightDockTab === 'props' && (
              primarySelectedEntity ? (
                <div className="w-full h-full">
                  <PropertiesSidebar
                    entity={primarySelectedEntity}
                    selectedCount={selectedIds.length}
                    layers={layers}
                    allEntities={entities}
                    onUpdate={handleUpdateSelectedFields}
                    onDelete={handleDeleteSelected}
                    onDuplicate={handleDuplicateSelected}
                    onDeselect={() => setSelectedIds([])}
                    isFloating={false}
                    onSnapOpeningToWall={handleSnapOpeningToWall}
                  />
                </div>
              ) : (
                <div className="p-3 flex flex-col gap-3">
                  {/* Empty Selection Placeholder */}
                  <div className="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant/20 flex flex-col items-center text-center gap-2 py-6">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-[22px]">tune</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-on-surface">AUCUN ÉLÉMENT SÉLECTIONNÉ</span>
                    <p className="text-[11px] text-on-surface-variant max-w-[200px] leading-tight">
                      Cliquez sur un mur, une cloison, une porte ou un meuble pour afficher et éditer ses attributs (Longueur, Angle, Matériau).
                    </p>
                    {entities.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedIds([entities[0].id]);
                        }}
                        className="mt-1 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-mono text-[10px] font-bold transition-colors"
                      >
                        Sélectionner {entities[0].name}
                      </button>
                    )}
                  </div>

                  {/* Default Global Parametric Inputs */}
                  <div className="bg-surface-container p-2.5 rounded flex flex-col gap-2 border border-outline-variant/20">
                    <span className="font-mono text-[10px] text-primary font-bold tracking-wider">
                      GÉOMÉTRIE PAR DÉFAUT
                    </span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant font-mono">Longueur mur</span>
                      <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/30">
                        <input
                          type="text"
                          value={wallLength}
                          onChange={(e) => setWallLength(Number(e.target.value) || 0)}
                          className="w-14 bg-transparent text-right font-mono text-[11px] text-on-surface outline-none"
                        />
                        <span className="font-mono text-[10px] text-outline">mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant font-mono">Épaisseur</span>
                      <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/30">
                        <input
                          type="text"
                          value={wallThickness}
                          onChange={(e) => setWallThickness(Number(e.target.value) || 0)}
                          className="w-14 bg-transparent text-right font-mono text-[11px] text-on-surface outline-none"
                        />
                        <span className="font-mono text-[10px] text-outline">mm</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 text-xs">
                      <span className="text-outline font-mono">Surface coffrage</span>
                      <span className="font-mono text-[11px] text-secondary font-bold">
                        {((wallLength * wallHeight) / 1000000).toFixed(2)} m²
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* TAB: LIBRARY (Bibliothèque de blocs de mobilier & menuiseries) */}
            {rightDockTab === 'library' && (
              <div className="w-full h-full flex flex-col">
                <CadLibraryPanel
                  onInsertBlock={(block, x, y) => handleInsertBlock(block, x, y)}
                  onClose={() => setRightDockTab('props')}
                />
              </div>
            )}

            {/* TAB 2: LAYERS IN DOCK */}
            {rightDockTab === 'layers' && (
              <div className="w-full h-full">
                <LayerManager
                  layers={layers}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleLock={handleToggleLock}
                  onChangeColor={handleChangeColor}
                  onAddLayer={handleAddLayer}
                  isCompact={true}
                />
              </div>
            )}

            {/* TAB 3: COPILOT INTEGRATION */}
            {rightDockTab === 'ai' && (
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">psychology</span>
                    <span className="text-[12px] text-on-surface font-semibold">ARCKI AI COPILOT</span>
                  </div>
                  <span className="font-mono text-[9px] text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded font-bold">
                    LIVE ASSIST
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {copilotMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        msg.sender === 'user'
                          ? 'bg-surface-container-lowest text-on-surface-variant italic'
                          : 'bg-primary/10 text-on-surface border border-primary/20'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>

                <div className="bg-primary/5 p-2 rounded flex flex-col gap-1.5 border border-primary/20">
                  <div className="flex items-center gap-1 text-primary">
                    <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                    <span className="font-mono text-[10px] font-bold">PROPOSITION DIFF GÉOMÉTRIQUE</span>
                  </div>
                  <p className="text-[11px] text-on-surface leading-tight">
                    1 mur porteur déplacé (+800mm Y), 2 cloisons étirées, 3 cotes et surfaces recalculées (Salon: 32.4 → {salonArea} m²).
                  </p>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => {
                        setIsAiDiffApplied(!isAiDiffApplied);
                        setIsAiDiffPreview(false);
                      }}
                      className={`px-2 py-1 rounded font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                        isAiDiffApplied
                          ? 'bg-tertiary text-on-tertiary'
                          : 'bg-primary text-on-primary hover:brightness-110'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {isAiDiffApplied ? 'check' : 'done'}
                      </span>
                      <span>{isAiDiffApplied ? 'Modifié' : 'Appliquer'}</span>
                    </button>
                    <button
                      onClick={() => setIsAiDiffPreview(!isAiDiffPreview)}
                      className={`px-2 py-1 rounded font-mono text-[10px] flex items-center justify-center gap-1 transition-colors ${
                        isAiDiffPreview
                          ? 'bg-tertiary-container/30 text-tertiary font-bold'
                          : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">visibility</span>
                      <span>Prévisualiser</span>
                    </button>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="flex flex-col gap-1 mt-1">
                  <span className="font-mono text-[9px] text-outline uppercase">SUGGESTIONS RAPIDES :</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        const snap = findWallSnap(420, 240, 900, 9999);
                        if (!snap) return;
                        const pmrDoor: CadEntity = {
                          id: `door-pmr-${Date.now()}`,
                          name: `Porte PMR 900mm encastrée (${snap.wall.name})`,
                          type: 'door',
                          layerId: 'ouvertures',
                          x1: snap.p1X,
                          y1: snap.p1Y,
                          x2: snap.p2X,
                          y2: snap.p2Y,
                          angle: snap.wallAngleDeg,
                          thickness: snap.wallThickness,
                          hostWallId: snap.wall.id,
                          openingWidth: 900,
                          doorSwing: 'left',
                          doorAngle: 90,
                          label: 'PORTE 900mm PMR',
                          materialIndex: 'MAT-07',
                        };
                        recordHistory();
                        setEntities(prev => [...prev, pmrDoor]);
                        setSelectedIds([pmrDoor.id]);
                        setCliHistory(prev => [
                          ...prev.slice(-3),
                          `_AGENT : Porte 900mm PMR encastrée sur "${snap.wall.name}" (ép. ${snap.wallThickness}mm, angle ${snap.wallAngleDeg}°)`,
                          'Commande: '
                        ]);
                      }}
                      className="px-1.5 py-0.5 bg-surface-container hover:bg-surface-container-high rounded font-mono text-[9px] text-primary transition-colors"
                    >
                      + Porte 90cm PMR
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedIds.length === 0}
                      className="px-1.5 py-0.5 bg-surface-container hover:bg-surface-container-high rounded font-mono text-[9px] text-error disabled:opacity-30 transition-colors"
                    >
                      Supprimer sélection
                    </button>
                    <button
                      onClick={async () => {
                        const res = await ArckiCadAgent.processRequest('audit métrique et RE2020', entities);
                        setCopilotMessages(prev => [...prev, { sender: 'assistant', text: res.reply }]);
                      }}
                      className="px-1.5 py-0.5 bg-surface-container hover:bg-surface-container-high rounded font-mono text-[9px] text-tertiary transition-colors"
                    >
                      Audit & RE2020
                    </button>
                  </div>
                </div>

                {/* AI Input Form */}
                <form onSubmit={handleSendAiPrompt} className="mt-2 flex items-center gap-1 bg-surface-container-lowest rounded p-1 border border-outline-variant/30">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Supprimer les éléments, agrandir..."
                    className="w-full bg-transparent px-2 text-xs text-on-surface placeholder:text-outline outline-none"
                  />
                  <button
                    type="submit"
                    className="p-1 rounded bg-primary text-on-primary hover:brightness-110 transition-all flex items-center justify-center flex-none"
                    title="Envoyer au Copilote IA"
                  >
                    <span className="material-symbols-outlined text-[15px]">send</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>
        ) : (
          /* Floating button to reopen properties and tools when dock is closed */
          <button
            onClick={() => setIsRightDockOpen(true)}
            className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/30 text-xs font-mono font-bold text-primary shadow-xl hover:bg-surface-container hover:text-primary transition-all pointer-events-auto"
            title="Ouvrir le panneau Propriétés / Outils"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>PROPRIÉTÉS</span>
            {selectedIds.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] flex items-center justify-center font-bold">
                {selectedIds.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* 4. BOTTOM COMMAND LINE (CLI) & TELEMETRY STATUS BAR */}
      <footer className="flex-none bg-surface-container-lowest flex flex-col z-30 shadow-inner">
        {/* AutoCAD Pro CLI Console */}
        <form onSubmit={handleCliSubmit} className="h-7 bg-[#020b14] px-3 flex items-center gap-2 border-t border-outline-variant/30">
          <span className="font-mono text-xs text-outline font-bold flex-none">ARCKI-CLI &gt;</span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden text-xs font-mono">
            <span className="text-outline-variant hidden sm:inline">{cliHistory[cliHistory.length - 2] || 'Commande: _WALL'}</span>
            <span className="text-outline hidden md:inline">·</span>
            <span className="text-on-surface truncate">{cliHistory[cliHistory.length - 1] || 'Spécifiez le point:'}</span>
            <input
              id="cad-cli-input"
              type="text"
              value={cliInput}
              onChange={(e) => setCliInput(e.target.value)}
              placeholder="Tapez une commande (ex: _WALL 4250, _DELETE, ZOOM)..."
              className="flex-1 bg-transparent text-primary font-bold outline-none border-b border-primary/20 text-xs px-1"
            />
            <span className="w-1.5 h-3.5 bg-primary animate-pulse inline-block flex-none"></span>
          </div>
          <button type="submit" className="flex items-center gap-1 text-outline font-mono text-[10px] hover:text-on-surface flex-none">
            <span className="material-symbols-outlined text-[13px]">keyboard</span>
            <span className="hidden lg:inline">ENTRÉE pour valider</span>
          </button>
        </form>

        {/* Telemetry Status Bar & CAD Toggles */}
        <div className="h-7 bg-surface-container-lowest px-3 flex items-center justify-between border-t border-outline-variant/20 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] text-on-surface">
              <span><strong className="text-outline">X:</strong> {cursorPos.x * 10}.0</span>
              <span className="text-outline-variant">|</span>
              <span><strong className="text-outline">Y:</strong> {cursorPos.y * 10}.0</span>
              <span className="text-outline-variant">|</span>
              <span><strong className="text-outline">Z:</strong> 0.0</span>
            </div>
            <div className="h-3 w-px bg-outline-variant/30 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-outline">
              <span>ENTITÉS: {entities.length}</span>
              <span>·</span>
              <span>SÉLECTION: {selectedIds.length}</span>
            </div>
          </div>

          {/* Functional CAD Toggle Buttons */}
          <div className="flex items-center gap-1.5">
            {/* BOUTON DÉSACTIVATION FENÊTRE PARAMÈTRES AUTO AU CLIC */}
            <button
              onClick={() => setAutoOpenPropsOnSelect(prev => !prev)}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1 transition-all ${
                autoOpenPropsOnSelect
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
              }`}
              title="Activer ou désactiver l'ouverture automatique de la fenêtre des paramètres lors de la sélection d'un élément"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoOpenPropsOnSelect ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></span>
              <span>FENÊTRE PARAMÈTRES : {autoOpenPropsOnSelect ? 'AUTO' : 'DÉSACTIVÉE'}</span>
            </button>
            {/* SNAP-TO-GRID 20px TOGGLE & STEP SELECTOR */}
            <div className="flex items-center rounded bg-surface-container-low border border-outline-variant/30 px-1 py-0.5">
              <button
                onClick={() => setSettings(s => ({ ...s, snapToGrid: !s.snapToGrid, snap: !s.snapToGrid }))}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1 transition-all ${
                  settings.snapToGrid
                    ? 'bg-tertiary-container/30 text-tertiary border border-tertiary/40 shadow-xs'
                    : 'text-outline-variant hover:text-on-surface'
                }`}
                title="Magnétisme à la grille 20px (F9) - Aligne cloisons et géométrie sur la grille de points"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${settings.snapToGrid ? 'bg-tertiary animate-pulse' : 'bg-outline-variant'}`}></span>
                <span>SNAP GRILLE</span>
                <span className="bg-surface-container-highest px-1 py-0.2 rounded text-[9px] text-tertiary font-mono">
                  {settings.gridSnapSize}px
                </span>
              </button>

              {/* Quick Step switcher */}
              <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-outline-variant/30 text-[9px] font-mono">
                {[10, 20, 40].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSettings(s => ({ ...s, gridSnapSize: sz, snapToGrid: true, snap: true }))}
                    className={`px-1 rounded transition-colors ${
                      settings.gridSnapSize === sz && settings.snapToGrid
                        ? 'bg-tertiary text-on-tertiary font-bold'
                        : 'text-outline hover:text-on-surface'
                    }`}
                    title={`Pas d'accrochage grille : ${sz}px (${sz * 10} mm)`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSettings(s => ({ ...s, ortho: !s.ortho }))}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                settings.ortho ? 'bg-tertiary-container/20 text-tertiary' : 'text-outline-variant hover:text-on-surface'
              }`}
              title="Mode Orthogonal (F8)"
            >
              {settings.ortho && <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>}
              <span>ORTHO</span>
            </button>

            <button
              onClick={() => setSettings(s => ({ ...s, osnap: !s.osnap }))}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                settings.osnap ? 'bg-tertiary-container/20 text-tertiary' : 'text-outline-variant hover:text-on-surface'
              }`}
              title="Accrochage Objets OSNAP (F3)"
            >
              {settings.osnap && <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>}
              <span>OSNAP</span>
            </button>

            <button
              onClick={() => setSettings(s => ({ ...s, grid: !s.grid }))}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                settings.grid ? 'bg-surface-container-high text-on-surface' : 'text-outline-variant hover:text-on-surface'
              }`}
              title="Affichage Grille (F7)"
            >
              <span>GRILLE</span>
            </button>

            <button
              onClick={() => setSettings(s => ({ ...s, dynHud: !s.dynHud }))}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                settings.dynHud ? 'bg-primary/10 text-primary' : 'text-outline-variant hover:text-on-surface'
              }`}
              title="Saisie Dynamique HUD (F12)"
            >
              {settings.dynHud && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
              <span>DYN</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
