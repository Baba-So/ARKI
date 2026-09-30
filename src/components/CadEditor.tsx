import React, { useState, useRef, useEffect } from 'react';
import { CadTool, CadSettings, CadLayer, CadEntity, CadBlock } from '../types.ts';
import { LayerManager } from './LayerManager.tsx';
import { PropertiesSidebar } from './PropertiesSidebar.tsx';
import { CadLibraryPanel } from './CadLibraryPanel.tsx';

interface CadEditorProps {
  onOpenNewProject: () => void;
  onOpenExport: () => void;
}

export const CadEditor: React.FC<CadEditorProps> = ({
  onOpenExport,
}) => {
  // Navigation active tab in the left rail: 'plan' | '3d' | 'bim' | 'rendu' | 'config'
  const [activeRail, setActiveRail] = useState<'plan' | '3d' | 'bim' | 'rendu' | 'config'>('plan');
  
  // Active CAD tool on the left toolbar
  const [activeTool, setActiveTool] = useState<CadTool>('select');

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
  const [layers, setLayers] = useState<CadLayer[]>([
    {
      id: 'structures',
      name: 'Structures porteuses (A-MUR-EXT)',
      category: 'structures',
      color: '#4cd7f6',
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 4,
      lineweight: '0.50mm',
      description: 'Murs extérieurs béton banché et chaînage',
    },
    {
      id: 'cloisons',
      name: 'Cloisons légères (A-MUR-INT)',
      category: 'cloisons',
      color: '#869397',
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 3,
      lineweight: '0.25mm',
      description: 'Cloisons Placostil 72mm et séparations intérieures',
    },
    {
      id: 'mobilier',
      name: 'Mobilier & Agencement (A-MOB-AGENC)',
      category: 'mobilier',
      color: '#4edea3',
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 5,
      lineweight: '0.15mm',
      description: 'Îlot cuisine, lit king size, meuble vasque, canapé',
    },
    {
      id: 'ouvertures',
      name: 'Menuiseries & Baies (A-PORTE-FEN)',
      category: 'ouvertures',
      color: '#ffb95f',
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 3,
      lineweight: '0.20mm',
      description: 'Portes battantes et baie coulissante 2800x2150',
    },
    {
      id: 'cotations',
      name: 'Cotations & Surfaces (A-COTE-TEXT)',
      category: 'cotations',
      color: '#acedff',
      visible: true,
      locked: false,
      opacity: 1,
      entityCount: 6,
      lineweight: '0.18mm',
      description: 'Lignes de cotes associatives et étiquettes m²',
    },
  ]);

  // Initial Villa Horizon CAD Entities
  const [entities, setEntities] = useState<CadEntity[]>([
    // STRUCTURES (Murs Porteurs Extérieurs)
    {
      id: 'wall-north',
      name: 'Mur Porteur Nord',
      type: 'wall',
      layerId: 'structures',
      x1: 120,
      y1: 140,
      x2: 740,
      y2: 160,
      thickness: 200,
      height: 2800,
      material: 'Béton banché + ITE 140mm',
      materialIndex: 'MAT-01',
    },
    {
      id: 'wall-west',
      name: 'Mur Porteur Ouest',
      type: 'wall',
      layerId: 'structures',
      x1: 120,
      y1: 160,
      x2: 140,
      y2: 680,
      thickness: 200,
      height: 2800,
      material: 'Béton banché + ITE 140mm',
      materialIndex: 'MAT-01',
    },
    {
      id: 'wall-south',
      name: 'Mur Porteur Sud',
      type: 'wall',
      layerId: 'structures',
      x1: 120,
      y1: 680,
      x2: 560,
      y2: 700,
      thickness: 200,
      height: 2800,
      material: 'Béton banché + ITE 140mm',
      materialIndex: 'MAT-01',
    },
    {
      id: 'wall-east',
      name: 'Mur Porteur Est',
      type: 'wall',
      layerId: 'structures',
      x1: 720,
      y1: 140,
      x2: 740,
      y2: 340,
      thickness: 200,
      height: 2800,
      material: 'Béton banché + ITE 140mm',
      materialIndex: 'MAT-01',
    },

    // CLOISONS
    {
      id: 'partition-salon-suite',
      name: 'Cloison Séparation Salon / Suite',
      type: 'partition',
      layerId: 'cloisons',
      x1: 140,
      y1: 452,
      x2: 420,
      y2: 460,
      thickness: 72,
      height: 2800,
      material: 'Placostil 72mm',
      materialIndex: 'MAT-02',
    },
    {
      id: 'partition-suite-sde',
      name: 'Cloison Suite / SDE',
      type: 'partition',
      layerId: 'cloisons',
      x1: 416,
      y1: 460,
      x2: 424,
      y2: 680,
      thickness: 72,
      height: 2800,
      material: 'Placostil 72mm',
      materialIndex: 'MAT-02',
    },
    {
      id: 'partition-cuisine-hall',
      name: 'Cloison Cuisine / Couloir',
      type: 'partition',
      layerId: 'cloisons',
      x1: 496,
      y1: 160,
      x2: 504,
      y2: 340,
      thickness: 72,
      height: 2800,
      material: 'Placostil 72mm',
      materialIndex: 'MAT-02',
    },

    // OUVERTURES
    {
      id: 'door-suite',
      name: 'Porte Suite Parentale (830mm)',
      type: 'door',
      layerId: 'ouvertures',
      x1: 180,
      y1: 452,
      x2: 225,
      y2: 497,
      doorSwing: 'right',
      doorAngle: 45,
      materialIndex: 'MAT-07',
    },
    {
      id: 'door-sde',
      name: 'Porte Salle d\'eau (730mm)',
      type: 'door',
      layerId: 'ouvertures',
      x1: 424,
      y1: 480,
      x2: 459,
      y2: 515,
      doorSwing: 'left',
      doorAngle: 45,
      materialIndex: 'MAT-07',
    },
    {
      id: 'window-bay-salon',
      name: 'Baie Coulissante 2800x2150',
      type: 'window',
      layerId: 'ouvertures',
      x1: 117,
      y1: 240,
      x2: 126,
      y2: 380,
      label: 'BAIE COULISSANTE 2800x2150',
      materialIndex: 'MAT-06',
    },

    // MOBILIER
    {
      id: 'furniture-kitchen-island',
      name: 'Îlot Central Cuisine',
      type: 'furniture',
      layerId: 'mobilier',
      x1: 545,
      y1: 265,
      x2: 675,
      y2: 320,
      label: 'ÎLOT CENTRAL',
      materialIndex: 'MAT-07',
    },
    {
      id: 'furniture-sofa',
      name: 'Canapé d\'angle Salon',
      type: 'furniture',
      layerId: 'mobilier',
      x1: 170,
      y1: 190,
      x2: 280,
      y2: 290,
      label: 'CANAPÉ SALON',
    },
    {
      id: 'furniture-bed',
      name: 'Lit King Size 160x200',
      type: 'furniture',
      layerId: 'mobilier',
      x1: 180,
      y1: 520,
      x2: 280,
      y2: 640,
      label: 'LIT 160x200',
    },
    {
      id: 'furniture-vanity',
      name: 'Meuble Double Vasque',
      type: 'furniture',
      layerId: 'mobilier',
      x1: 430,
      y1: 470,
      x2: 530,
      y2: 500,
      label: 'DOUBLE VASQUE',
    },

    // COTATIONS & SURFACES
    {
      id: 'dim-north',
      name: 'Cote Totale Façade Nord',
      type: 'dim',
      layerId: 'cotations',
      x1: 120,
      y1: 102,
      x2: 740,
      y2: 102,
      label: '7 200',
    },
    {
      id: 'dim-salon',
      name: 'Cote Largeur Salon',
      type: 'dim',
      layerId: 'cotations',
      x1: 140,
      y1: 124,
      x2: 500,
      y2: 124,
      label: '4 800',
    },
    {
      id: 'room-salon',
      name: 'Zone Salon de Réception',
      type: 'room',
      layerId: 'cotations',
      x1: 140,
      y1: 160,
      x2: 500,
      y2: 460,
      label: 'SALON DE RÉCEPTION',
      subText: 'PARQUET CHÊNE MASSIF',
      area: 32.40,
      height: 2.80,
      hatchPattern: 'bois',
    },
    {
      id: 'room-cuisine',
      name: 'Zone Cuisine Ouverte',
      type: 'room',
      layerId: 'cotations',
      x1: 500,
      y1: 160,
      x2: 720,
      y2: 340,
      label: 'CUISINE OUVERTE',
      area: 14.20,
      height: 2.80,
      hatchPattern: 'carrelage',
    },
    {
      id: 'room-suite',
      name: 'Zone Suite Parentale',
      type: 'room',
      layerId: 'cotations',
      x1: 140,
      y1: 460,
      x2: 420,
      y2: 680,
      label: 'SUITE PARENTALE',
      area: 18.50,
      height: 2.80,
      hatchPattern: 'bois',
    },
    {
      id: 'room-sde',
      name: 'Zone Salle d\'eau',
      type: 'room',
      layerId: 'cotations',
      x1: 420,
      y1: 460,
      x2: 560,
      y2: 680,
      label: 'SDE',
      area: 6.20,
      height: 2.80,
      hatchPattern: 'carrelage',
    },
  ]);

  // Selected Entities IDs set
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

    const widthPx = Math.round(block.widthMm / 10);
    const heightPx = Math.round(block.heightMm / 10);

    const newEntity: CadEntity = {
      id: `${block.id}-${Date.now()}`,
      name: block.name,
      type: block.category === 'menuiserie' ? (block.renderType === 'window' ? 'window' : 'door') : 'furniture',
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
  const [wallHeight, setWallHeight] = useState(2800);
  const [wallLength, setWallLength] = useState(4250);
  const [wallJustif, setWallJustif] = useState<'Nu Extérieur' | 'Axe' | 'Nu Intérieur'>('Nu Extérieur');
  const [chaining, setChaining] = useState(true);

  // Partition (Cloisons) dedicated settings
  const [partitionType, setPartitionType] = useState('Placostil 72mm (BA13)');
  const [partitionThickness, setPartitionThickness] = useState(72);

  // Dynamic AI Diff state
  const [isAiDiffApplied, setIsAiDiffApplied] = useState(false);
  const [isAiDiffPreview, setIsAiDiffPreview] = useState(false);

  // Interactive CAD Drawing & P1 Anchor state
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);

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
    wallJustif: 'Nu Extérieur',
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

  // Canvas Ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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
      } else if (ent.type === 'door' || ent.type === 'window') {
        const d = distToSegment(px, py, ent.x1, ent.y1, ent.x2, ent.y2);
        if (d <= pickboxTolerance + 6) return ent;
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
    // 3. Check furniture, rects, and polygons
    for (const ent of entities) {
      const l = getLayer(ent.layerId);
      if (!l.visible || l.locked) continue;
      if (ent.type === 'furniture' || ent.type === 'rect') {
        const minX = Math.min(ent.x1, ent.x2) - pickboxTolerance;
        const maxX = Math.max(ent.x1, ent.x2) + pickboxTolerance;
        const minY = Math.min(ent.y1, ent.y2) - pickboxTolerance;
        const maxY = Math.max(ent.y1, ent.y2) + pickboxTolerance;
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) return ent;
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

    // Snap-to-grid: Magnétisme à la grille 20px (pour les outils de tracé et de mesure)
    const gridStep = settings.gridSnapSize || 20;
    const isDrawingOrMeasuring = ['partition', 'wall', 'dim', 'rect', 'line', 'measure', 'door', 'window', 'polyline'].includes(activeTool);
    const isGridSnapActive = (settings.snapToGrid || settings.snap) && isDrawingOrMeasuring;

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

    // Box selection update: alignée exactement sur le centre du curseur
    if (isBoxSelecting && boxStart) {
      setBoxCurrent({ x, y });
    }

    // Détection en direct sous le centre du curseur pour l'outil de sélection
    if (activeTool === 'select' && !isBoxSelecting) {
      const hit = getEntityAtPoint(x, y, 9);
      setHoveredEntityId(hit ? hit.id : null);
    } else if (hoveredEntityId) {
      setHoveredEntityId(null);
    }
  };

  // Handle Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (e.button !== 0) return; // Left click only

    // Si outil sélection : le point de sélection est précisément ajusté au centre du curseur
    if (activeTool === 'select') {
      const targetEntityId = (e.target as HTMLElement).closest('[data-entity-id]')?.getAttribute('data-entity-id');
      const clickedEntity = (targetEntityId ? entities.find(ent => ent.id === targetEntityId) : null) || getEntityAtPoint(cursorPos.x, cursorPos.y, 9);

      if (clickedEntity) {
        const l = getLayer(clickedEntity.layerId);
        if (!l.locked) {
          if (e.shiftKey) {
            setSelectedIds(prev =>
              prev.includes(clickedEntity.id)
                ? prev.filter(id => id !== clickedEntity.id)
                : [...prev, clickedEntity.id]
            );
          } else {
            setSelectedIds([clickedEntity.id]);
          }
          if (autoOpenPropsOnSelect) {
            setRightDockTab('props');
          }
        }
        setIsBoxSelecting(false);
        setBoxStart(null);
        setBoxCurrent(null);
      } else {
        // Clic dans le vide : début de rectangle de sélection centré sur le curseur
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setIsBoxSelecting(true);
        setBoxStart({ x: cursorPos.x, y: cursorPos.y });
        setBoxCurrent({ x: cursorPos.x, y: cursorPos.y });
      }
    }
  };

  // Handle Canvas Mouse Up (Ends box selection)
  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
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
      hatchPattern: activeHatchPattern !== 'none' ? activeHatchPattern : 'none',
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
    if (e.button !== 0 || isBoxSelecting) return;

    if (activeTool === 'select') {
      return; // Déjà géré précisément au centre du curseur dans handleCanvasMouseDown
    }

    // 1. WALL CREATION (W)
    if (activeTool === 'wall') {
      const l = getLayer('structures');
      if (l.locked) {
        alert("Le calque Structures est verrouillé. Déverrouillez-le pour dessiner un mur.");
        return;
      }

      if (!draftStart) {
        // Set Point 1
        setDraftStart({ x: cursorPos.x, y: cursorPos.y });
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_WALL P1: <${cursorPos.x * 10}, ${cursorPos.y * 10}>`,
          'Spécifiez le point suivant ou Entrée pour valider :',
        ]);
      } else {
        // Set Point 2 -> Create Wall Entity
        const newWall: CadEntity = {
          id: `wall-${Date.now()}`,
          name: `Mur Extérieur L=${Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10)}mm`,
          type: 'wall',
          layerId: 'structures',
          x1: draftStart.x,
          y1: draftStart.y,
          x2: cursorPos.x,
          y2: cursorPos.y,
          thickness: wallThickness,
          height: wallHeight,
          material: 'Béton banché + ITE 140mm',
          materialIndex: 'MAT-01',
        };
        recordHistory();
        setEntities(prev => [...prev, newWall]);
        setSelectedIds([newWall.id]);

        if (chaining) {
          setDraftStart({ x: cursorPos.x, y: cursorPos.y });
        } else {
          setDraftStart(null);
        }

        setCliHistory(prev => [
          ...prev.slice(-3),
          `_WALL créé : Longueur ${Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10)} mm`,
          'Spécifiez le point suivant ou Échap pour terminer :',
        ]);
      }
    }

    // 2. PARTITION CREATION (C)
    else if (activeTool === 'partition') {
      const l = getLayer('cloisons');
      if (l.locked) {
        alert("Le calque Cloisons est verrouillé. Déverrouillez-le pour implanter des cloisons.");
        return;
      }

      if (!draftStart) {
        setDraftStart({ x: cursorPos.x, y: cursorPos.y });
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_PARTITION P1 : <${cursorPos.x * 10}, ${cursorPos.y * 10}> [Snap Grille ${settings.gridSnapSize}px]`,
          'Spécifiez le 2ème point sur la grille de points ou Échap pour annuler :',
        ]);
      } else {
        const lengthMm = Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10);
        if (lengthMm < 40) return;

        const newPart: CadEntity = {
          id: `partition-${Date.now()}`,
          name: `Cloison ${partitionType} L=${lengthMm}mm`,
          type: 'partition',
          layerId: 'cloisons',
          x1: draftStart.x,
          y1: draftStart.y,
          x2: cursorPos.x,
          y2: cursorPos.y,
          thickness: partitionThickness,
          height: wallHeight,
          material: partitionType,
          materialIndex: partitionType.includes('98') ? 'MAT-03' : partitionType.includes('Vitrée') ? 'MAT-08' : 'MAT-02',
        };
        recordHistory();
        setEntities(prev => [...prev, newPart]);
        setSelectedIds([newPart.id]);
        setDraftStart(chaining ? { x: cursorPos.x, y: cursorPos.y } : null);
        setCliHistory(prev => [
          ...prev.slice(-3),
          `_PARTITION créée : ${lengthMm} mm (${Math.round(lengthMm / (settings.gridSnapSize * 10))} modules de ${settings.gridSnapSize}px sur grille)`,
          chaining ? 'Point suivant sur la grille ou Échap :' : 'Commande : ',
        ]);
      }
    }

    // 3. DOOR CREATION (P)
    else if (activeTool === 'door') {
      const l = getLayer('ouvertures');
      if (l.locked) {
        alert("Le calque Menuiseries est verrouillé.");
        return;
      }
      const newDoor: CadEntity = {
        id: `door-${Date.now()}`,
        name: 'Porte Battante 830mm',
        type: 'door',
        layerId: 'ouvertures',
        x1: cursorPos.x,
        y1: cursorPos.y,
        x2: cursorPos.x + 45,
        y2: cursorPos.y + 45,
        doorSwing: 'right',
        doorAngle: 45,
        materialIndex: 'MAT-07',
      };
      recordHistory();
      setEntities(prev => [...prev, newDoor]);
      setSelectedIds([newDoor.id]);
      setCliHistory(prev => [
        ...prev.slice(-3),
        `_DOOR insérée en <${cursorPos.x * 10}, ${cursorPos.y * 10}>.`,
        'Commande: ',
      ]);
    }

    // 4. WINDOW CREATION (F)
    else if (activeTool === 'window') {
      const l = getLayer('ouvertures');
      if (l.locked) return;
      const newWin: CadEntity = {
        id: `window-${Date.now()}`,
        name: 'Fenêtre 1400x1250',
        type: 'window',
        layerId: 'ouvertures',
        x1: cursorPos.x - 35,
        y1: cursorPos.y,
        x2: cursorPos.x + 35,
        y2: cursorPos.y,
        label: 'FENÊTRE 1400x1250',
        materialIndex: 'MAT-06',
      };
      recordHistory();
      setEntities(prev => [...prev, newWin]);
      setSelectedIds([newWin.id]);
      setCliHistory(prev => [...prev.slice(-3), `_WINDOW insérée.`, 'Commande: ']);
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

    // 6. RECTANGLE (R) - Création de formes rectangulaires
    else if (activeTool === 'rect') {
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
          hatchPattern: activeHatchPattern !== 'none' ? activeHatchPattern : 'none',
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

    // 6B. POLYGONE & TRAITS MULTIPLES (L / _POLY) - Tracer des formes diverses avec des traits
    else if (activeTool === 'polyline') {
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

  // Keyboard Shortcuts listener (Delete, Escape, Ctrl+Z, Ctrl+D, Tool shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Enter key: valider le polygone ou forme active
      if (e.key === 'Enter') {
        if (activeTool === 'polyline' && polyPoints.length >= 2) {
          e.preventDefault();
          finalizePolygon(polyPoints, polyPoints.length >= 3);
          return;
        }
      }

      // Escape key: annuler le tracé en cours ou désélectionner
      if (e.key === 'Escape') {
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
          setIsBoxSelecting(false);
          setSelectedIds([]);
          setActiveTool('select');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, entities, historyStack, redoStack, draftStart, measureStart, measureResult, isBoxSelecting]);

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
    } else if (cmd === 'ZOOM' || cmd === 'Z') {
      setCanvasZoom(1);
      setPanOffset({ x: 0, y: 0 });
      newHist.push('Vue recentrée à l\'échelle 1:50.');
    } else if (cmd === 'HELP') {
      newHist.push('Commandes: _WALL, _DOOR, _DELETE, LAYERS (LA), _EXTEND 800, ZOOM, HELP');
    } else {
      newHist.push(`Commande validée: ${cmd}.`);
    }

    setCliHistory(newHist.slice(-5));
    setCliInput('');
  };

  // Submit AI Prompt in Copilot tab
  const handleSendAiPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const userText = aiPrompt.trim();
    setCopilotMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiPrompt('');

    setTimeout(() => {
      let assistantReply = "Analyse géométrique terminée. Modifications appliquées au plan.";
      if (userText.toLowerCase().includes('salon') || userText.toLowerCase().includes('agrandir')) {
        setIsAiDiffApplied(true);
        assistantReply = "Façade Sud repoussée de 800mm. Surface du salon mise à jour à 36.10 m² (+3.70 m²).";
      } else if (userText.toLowerCase().includes('supprimer') || userText.toLowerCase().includes('effacer')) {
        handleDeleteSelected();
        assistantReply = "Éléments sélectionnés supprimés de la maquette.";
      } else if (userText.toLowerCase().includes('porte') || userText.toLowerCase().includes('pmr')) {
        const pmrDoor: CadEntity = {
          id: `door-pmr-${Date.now()}`,
          name: 'Porte PMR 900mm',
          type: 'door',
          layerId: 'ouvertures',
          x1: 420,
          y1: 240,
          x2: 465,
          y2: 285,
          doorSwing: 'left',
          doorAngle: 45,
        };
        setEntities(prev => [...prev, pmrDoor]);
        assistantReply = "Porte 900mm PMR insérée avec dégagement réglementaire de 1.40m.";
      } else if (userText.toLowerCase().includes('re2020') || userText.toLowerCase().includes('thermique')) {
        assistantReply = "Bilan bioclimatique : R=4.25 en ITE, ponts thermiques réduits, facteur de lumière FLJ = 2.4% (Conforme RE2020).";
      } else if (userText.toLowerCase().includes('calque') || userText.toLowerCase().includes('mobilier')) {
        setIsSidebarLayersOpen(true);
        assistantReply = "Gestionnaire de calques ouvert. Vous pouvez masquer ou verrouiller le mobilier.";
      }
      setCopilotMessages(prev => [...prev, { sender: 'assistant', text: assistantReply }]);
    }, 600);
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
          ) : (
            <>
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
                <span className="font-mono text-[10px] text-outline">JUSTIF:</span>
                <button
                  onClick={() => {
                    setWallJustif(prev => prev === 'Nu Extérieur' ? 'Axe' : prev === 'Axe' ? 'Nu Intérieur' : 'Nu Extérieur');
                  }}
                  className="flex items-center gap-1 text-on-surface hover:text-primary transition-colors"
                >
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
          <div className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/20">
            <span className="font-mono text-[10px] text-outline">NIVEAU:</span>
            <span className="font-mono text-[11px] text-primary font-semibold">RDC (+0.00m)</span>
          </div>
          <button
            onClick={() => setActiveRail(activeRail === '3d' ? 'plan' : '3d')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border border-outline-variant/20 text-[11px] font-mono transition-colors ${
              activeRail === '3d' ? 'bg-secondary/20 text-secondary font-bold' : 'bg-surface-container-low text-secondary'
            }`}
            title="Basculer entre Projection 2D et Rendu 3D Isométrique"
          >
            <span className="material-symbols-outlined text-[13px]">
              {activeRail === '3d' ? 'view_in_ar' : 'layers'}
            </span>
            <span>{activeRail === '3d' ? 'ISOMÉTRIQUE 3D' : 'ORTHOGONAL 2D'}</span>
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
              onClick={() => setActiveRail('3d')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
                activeRail === '3d' ? 'bg-surface-container-high text-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              title="Modèle Isométrique 3D"
            >
              <span className="material-symbols-outlined text-[19px]">view_in_ar</span>
              <span className="font-mono text-[9px] mt-0.5">3D</span>
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
        <aside className="w-11 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col items-center py-1 gap-1 z-30 shadow-md flex-none">
          {[
            { id: 'select', icon: 'near_me', key: 'V', title: 'Sélection & Manipulation (V)' },
            { id: 'measure', icon: 'square_foot', key: 'M', title: 'Mesure de distance en temps réel (M / _DIST)' },
            { id: 'dim', icon: 'straighten', key: 'D', title: 'Cotation Automatique (D / _DIM)' },
            { id: 'hatch', icon: 'texture', key: 'H', title: 'Hachures Paramétriques (H / _HATCH)' },
            { id: 'wall', icon: 'view_column', key: 'W', title: 'Mur Porteur Continu (W)' },
            { id: 'partition', icon: 'splitscreen', key: 'C', title: 'Cloison légère 72mm (C)' },
            { id: 'door', icon: 'meeting_room', key: 'P', title: 'Porte avec sens (P)' },
            { id: 'window', icon: 'window', key: 'F', title: 'Fenêtre / Baie vitrée (F)' },
            { id: 'room', icon: 'crop_free', key: 'A', title: 'Détecteur de surfaces / Pièces (A)' },
            { id: 'rect', icon: 'rectangle', key: 'R', title: 'Rectangle / Emprise (R)' },
            { id: 'polyline', icon: 'polyline', key: 'L', title: 'Ligne / Polyligne libre (L)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTool(t.id as CadTool);
                setDraftStart(null);
                setMeasureStart(null);
              }}
              className={`relative w-8 h-8 rounded flex items-center justify-center transition-colors group ${
                activeTool === t.id
                  ? 'bg-surface-container-high text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              title={t.title}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: activeTool === t.id ? "'FILL' 1" : "'FILL' 0" }}>
                {t.icon}
              </span>
              {activeTool === t.id && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              )}
              {t.key && (
                <span className={`absolute bottom-0 right-0.5 font-mono text-[8px] ${activeTool === t.id ? 'text-primary font-bold' : 'text-outline'}`}>
                  {t.key}
                </span>
              )}
            </button>
          ))}

          <div className="w-5 h-px bg-outline-variant/30 my-0.5"></div>

          {/* Quick Undo / Redo in toolstrip */}
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            title="Annuler dernière action (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[17px]">undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
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
          className="flex-1 relative overflow-hidden bg-[#06101c] cursor-none"
        >
          {activeRail === '3d' ? (
            /* 3D Wireframe / Isometric Model View */
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-6 select-none bg-radial from-[#0d2238] to-[#030a12]">
              <div className="relative w-full max-w-4xl h-full flex flex-col items-center justify-center">
                <div className="absolute top-4 left-4 z-20 bg-surface-container-lowest/90 px-3 py-1.5 rounded border border-primary/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">view_in_ar</span>
                  <span className="font-mono text-xs text-primary font-bold">VUE 3D ISOMÉTRIQUE TEMPS RÉEL</span>
                </div>

                <svg viewBox="0 0 800 500" className="w-full h-full drop-shadow-2xl">
                  {/* Foundation Slab */}
                  <polygon points="200,320 600,220 680,260 280,360" fill="#0a1d30" stroke="#4cd7f6" strokeWidth="1.5" />
                  <polygon points="200,320 280,360 280,375 200,335" fill="#051424" stroke="#4cd7f6" strokeWidth="1" />
                  <polygon points="280,360 680,260 680,275 280,375" fill="#030b14" stroke="#4cd7f6" strokeWidth="1" />

                  {/* Dynamic 3D extrusion of walls from reactive entities */}
                  {entities.filter(e => e.type === 'wall' && getLayer(e.layerId).visible).map((ent) => (
                    <polygon
                      key={ent.id}
                      points={`${ent.x1 * 0.5 + 140},${ent.y1 * 0.4 + 200} ${ent.x2 * 0.5 + 140},${ent.y2 * 0.4 + 200} ${ent.x2 * 0.5 + 140},${ent.y2 * 0.4 + 130} ${ent.x1 * 0.5 + 140},${ent.y1 * 0.4 + 130}`}
                      fill="#0d2438"
                      stroke={selectedIds.includes(ent.id) ? '#ffb95f' : getLayer(ent.layerId).color}
                      strokeWidth={selectedIds.includes(ent.id) ? '2.5' : '1.5'}
                    />
                  ))}
                </svg>

                <div className="absolute bottom-6 flex items-center gap-3">
                  <button
                    onClick={() => setActiveRail('plan')}
                    className="px-4 py-2 bg-primary-container hover:bg-primary text-on-primary-container rounded shadow-lg font-mono text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Revenir au Plan 2D d'exécution</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 2D Plan Viewport (Vector Canvas with Dynamic Entities) */
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${canvasZoom})`,
                transformOrigin: '0 0',
                transition: isPanning ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              {/* Millimeter / Meter CAD Grid Pattern with 20px Points Matrix */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
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
                <rect width="100%" height="100%" fill="url(#cad-major-grid)" />
              </svg>

              {/* Reactive Architectural Geometry Layer (1:1 CAD Coordinates) */}
              <svg className="absolute inset-0 w-full h-full">
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
                      <rect
                        x={Math.min(ent.x1, ent.x2)}
                        y={Math.min(ent.y1, ent.y2)}
                        width={w}
                        height={h}
                        fill="#0c1d2e"
                        fillOpacity="0.8"
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2 : isHovered ? 1.8 : 1.2}
                        strokeDasharray={isHovered ? '3 2' : '4 2'}
                      />
                      <text
                        x={(ent.x1 + ent.x2) / 2}
                        y={(ent.y1 + ent.y2) / 2 + 3}
                        textAnchor="middle"
                        fill={strokeColor}
                        className="text-[8px] font-mono select-none pointer-events-none"
                        fontFamily="JetBrains Mono"
                      >
                        {ent.label || ent.name}
                      </text>

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

                {/* 3. WALLS & PARTITIONS */}
                {entities.filter(e => ['wall', 'partition'].includes(e.type)).map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const strokeColor = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : ent.color || l.color;
                  const thick = ent.thickness ? (ent.thickness / 10) : 8;
                  const len = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
                  const angleRad = Math.atan2(ent.y2 - ent.y1, ent.x2 - ent.x1);
                  const angleDeg = (angleRad * 180) / Math.PI;
                  const isOrtho = Math.abs(ent.x2 - ent.x1) < 2 || Math.abs(ent.y2 - ent.y1) < 2;

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      {isOrtho ? (
                        <rect
                          x={Math.min(ent.x1, ent.x2)}
                          y={Math.min(ent.y1, ent.y2)}
                          width={Math.max(thick, Math.abs(ent.x2 - ent.x1))}
                          height={Math.max(thick, Math.abs(ent.y2 - ent.y1))}
                          fill={ent.type === 'wall' ? 'url(#wall-concrete-hatch)' : '#273647'}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2.5 : ent.type === 'wall' ? 2 : 1.5}
                        />
                      ) : (
                        <g transform={`translate(${ent.x1}, ${ent.y1}) rotate(${angleDeg})`}>
                          <rect
                            x={0}
                            y={-thick / 2}
                            width={len}
                            height={thick}
                            fill={ent.type === 'wall' ? 'url(#wall-concrete-hatch)' : '#273647'}
                            stroke={strokeColor}
                            strokeWidth={isSelected ? 2.5 : isHovered ? 2.5 : ent.type === 'wall' ? 2 : 1.5}
                          />
                        </g>
                      )}

                      {/* CAD Control Grips when selected */}
                      {isSelected && (
                        <g className="pointer-events-none">
                          <rect x={ent.x1 - 3.5} y={ent.y1 - 3.5} width="7" height="7" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={ent.x2 - 3.5} y={ent.y2 - 3.5} width="7" height="7" fill="#4cd7f6" stroke="#051424" strokeWidth="1" />
                          <rect x={(ent.x1 + ent.x2) / 2 - 3.5} y={(ent.y1 + ent.y2) / 2 - 3.5} width="7" height="7" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                        </g>
                      )}
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

                {/* 4. DOORS & SWINGS */}
                {entities.filter(e => e.type === 'door').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const color = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;
                  const rad = Math.abs(ent.x2 - ent.x1) || 40;

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      transform={`translate(${ent.x1}, ${ent.y1})`}
                      className="cursor-pointer"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      <line x1="0" y1="0" x2={rad} y2={rad} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
                      <path d={`M 0 0 A ${rad} ${rad} 0 0 1 ${rad} ${rad}`} fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" />
                      <circle cx="0" cy="0" r="2.5" fill={color} />
                      {isSelected && (
                        <rect x="-4" y="-4" width="8" height="8" fill="#ffb95f" stroke="#051424" strokeWidth="1" />
                      )}
                    </g>
                  );
                })}

                {/* 5. WINDOWS & BAIES */}
                {entities.filter(e => e.type === 'window').map(ent => {
                  const l = getLayer(ent.layerId);
                  if (!l.visible) return null;
                  const isSelected = selectedIds.includes(ent.id);
                  const isHovered = hoveredEntityId === ent.id && !isSelected;
                  const color = isSelected ? '#ffb95f' : isHovered ? '#38bdf8' : l.color;
                  const h = Math.abs(ent.y2 - ent.y1) || 100;

                  return (
                    <g 
                      key={ent.id} 
                      data-entity-id={ent.id} 
                      onClick={(e) => handleEntityClick(e, ent)}
                      className="cursor-pointer"
                      opacity={l.locked ? 0.6 : 1}
                    >
                      <rect x={ent.x1} y={ent.y1} width="8" height={h} fill={color} opacity="0.9" />
                      <line x1={ent.x1 + 8} y1={ent.y1} x2={ent.x1 + 8} y2={ent.y2} stroke={color} strokeWidth={isSelected ? 2 : isHovered ? 2 : 1.5} />
                      <text x={ent.x1 - 10} y={ent.y1 + h / 2} transform={`rotate(-90 ${ent.x1 - 10} ${ent.y1 + h / 2})`} textAnchor="middle" fill={color} className="text-[9px] font-mono" fontFamily="JetBrains Mono">
                        {ent.label || ent.name}
                      </text>
                      {(isSelected || isHovered) && (
                        <rect x={ent.x1 - 1} y={ent.y1 - 1} width="10" height={h + 2} fill="none" stroke={isSelected ? '#ffb95f' : '#38bdf8'} strokeWidth="1.5" strokeDasharray="3 2" />
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

                    {/* Ghost Wall body preview */}
                    {activeTool === 'wall' && (
                      <rect
                        x={Math.min(draftStart.x, cursorPos.x)}
                        y={Math.min(draftStart.y, cursorPos.y)}
                        width={Math.max(wallThickness / 10, Math.abs(cursorPos.x - draftStart.x))}
                        height={Math.max(wallThickness / 10, Math.abs(cursorPos.y - draftStart.y))}
                        fill="url(#wall-concrete-hatch)"
                        stroke="#4cd7f6"
                        strokeWidth="2"
                        opacity="0.7"
                      />
                    )}

                    {/* Ghost Cloison / Partition body preview */}
                    {activeTool === 'partition' && (
                      <g>
                        <rect
                          x={Math.min(draftStart.x, cursorPos.x)}
                          y={Math.min(draftStart.y, cursorPos.y)}
                          width={Math.max(partitionThickness / 10, Math.abs(cursorPos.x - draftStart.x))}
                          height={Math.max(partitionThickness / 10, Math.abs(cursorPos.y - draftStart.y))}
                          fill="#182736"
                          stroke="#4edea3"
                          strokeWidth="2"
                          opacity="0.85"
                        />
                        {/* Modules count badge */}
                        <g transform={`translate(${(draftStart.x + cursorPos.x) / 2}, ${(draftStart.y + cursorPos.y) / 2 + 18})`}>
                          <rect x="-65" y="-10" width="130" height="20" rx="3" fill="#010f1f" stroke="#4edea3" strokeWidth="1" />
                          <text x="0" y="4" textAnchor="middle" fill="#4edea3" className="text-[10px] font-mono font-bold" fontFamily="JetBrains Mono">
                            {Math.round(currentDrawDist / (settings.gridSnapSize * 10))} pts (grille {settings.gridSnapSize}px)
                          </text>
                        </g>
                      </g>
                    )}

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

                    {/* Ghost Rectangle Body preview */}
                    {activeTool === 'rect' && (
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
                    {activeTool !== 'dim' && activeTool !== 'rect' && (
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
              </svg>

              {/* LIVE FULL CAD CROSSHAIR CURSOR BASE */}
              {isOverCanvas && (
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
                onClick={() => setActiveRail(activeRail === '3d' ? 'plan' : '3d')}
                className="p-1 text-on-surface-variant hover:text-secondary hover:bg-surface-container rounded transition-colors"
                title="Orbite 3D rapide"
              >
                <span className="material-symbols-outlined text-[16px]">3d_rotation</span>
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
                    onUpdate={handleUpdateSelectedFields}
                    onDelete={handleDeleteSelected}
                    onDuplicate={handleDuplicateSelected}
                    onDeselect={() => setSelectedIds([])}
                    isFloating={false}
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
                        const pmrDoor: CadEntity = {
                          id: `door-pmr-${Date.now()}`,
                          name: 'Porte 900mm PMR',
                          type: 'door',
                          layerId: 'ouvertures',
                          x1: 420,
                          y1: 240,
                          x2: 465,
                          y2: 285,
                          doorSwing: 'left',
                          doorAngle: 45,
                        };
                        setEntities(prev => [...prev, pmrDoor]);
                        setSelectedIds([pmrDoor.id]);
                        alert("Porte 90cm PMR conforme insérée.");
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
                      onClick={() => alert("Bilan thermique RE2020 validé.")}
                      className="px-1.5 py-0.5 bg-surface-container hover:bg-surface-container-high rounded font-mono text-[9px] text-tertiary transition-colors"
                    >
                      Contrôle RE2020
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
