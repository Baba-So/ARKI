export type ScreenType = 'editor' | 'dashboard' | 'auth';

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
  | 'arc' 
  | 'cut' 
  | 'measure';

export type WallSubTool = 'single' | 'continuous' | 'rect';
export type ShapeSubTool = 'rect' | 'circle';
export type PolylineSubTool = 'straight' | 'freehand' | 'curve';

export interface CadLayer {
  id: string;
  name: string;
  category: 'structures' | 'cloisons' | 'mobilier' | 'ouvertures' | 'cotations';
  color: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  entityCount: number;
  lineweight?: string;
  description?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  phase: string;
  version: string;
  cadastralRef: string;
  modified: string;
  author: string;
  collaborators: string[];
  dimensions: { width: string; height: string };
  shon: string;
  category: 'esquisse' | 'pc' | 'exe' | 'renovation' | 'faisabilite';
  re2020Valid?: boolean;
}

export interface MaterialDefinition {
  index: string; // e.g. "MAT-01"
  name: string;
  category: 'structure' | 'cloisons' | 'menuiserie' | 'finition' | 'isolation';
  density: string;
  lambda: string;
  acoustic: string;
  carbonIndex: string;
  color: string;
  description: string;
}

export interface CadEntity {
  id: string;
  name: string;
  type: 'wall' | 'partition' | 'door' | 'window' | 'dim' | 'room' | 'furniture' | 'rect' | 'circle' | 'line' | 'polygon' | 'polyline' | 'curve';
  layerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius?: number; // Rayon en px pour les cercles
  curvePoint?: { x: number; y: number }; // Point de contrôle / courbure pour arc et courbe
  points?: Array<{ x: number; y: number }>; // Sommets multiples pour polygone / polyligne
  isClosed?: boolean; // Polygone fermé ou chaîne ouverte
  thickness?: number;
  height?: number;
  label?: string;
  subText?: string;
  area?: number;
  material?: string;
  materialIndex?: string; // Indice matière ex: MAT-01, MAT-02
  angle?: number; // Orientation en degrés
  selected?: boolean;
  color?: string;
  doorSwing?: 'left' | 'right';
  doorAngle?: number;
  hatchPattern?: 'briques' | 'beton' | 'bois' | 'isolation' | 'carrelage' | 'sable' | 'none';
  hatchScale?: number;
  hatchColor?: string;
  dimOffset?: number;
  dimOrientation?: 'aligned' | 'horizontal' | 'vertical';
  blockId?: string;
  hostWallId?: string; // ID du mur hôte dans lequel l'ouverture est encastrée
  openingWidth?: number; // Largeur de passage en mm (ex: 730, 830, 900, 1200, 1400)
  flipSwing?: boolean; // Inverser le sens d'ouverture intérieur/extérieur
  sillHeight?: number; // Hauteur d'allège en mm pour fenêtres
  openingType?: 'door_single' | 'door_double' | 'door_pocket' | 'window_casement' | 'window_sliding' | 'window_fixed';
  wallPositionRatio?: number; // Ratio 0..1 de position le long du mur hôte
}

export interface CadBlock {
  id: string;
  name: string;
  category: 'sejour' | 'cuisine' | 'chambre' | 'sanitaire' | 'menuiserie' | 'exterieur';
  widthMm: number;
  heightMm: number;
  defaultLayer: string;
  icon: string;
  description: string;
  renderType: 'table' | 'sofa' | 'bed' | 'bath' | 'shower' | 'sink' | 'wc' | 'island' | 'door' | 'window' | 'generic';
}

export interface CadWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  height: number;
  type: string;
  material: string;
  selected?: boolean;
}

export interface CadRoom {
  id: string;
  name: string;
  area: number; // in m²
  hsp: number; // in meters
  finish: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CadDoor {
  id: string;
  x: number;
  y: number;
  width: number;
  angle: number;
  direction: 'in-left' | 'in-right' | 'out-left' | 'out-right';
  label: string;
}

export interface CadWindow {
  id: string;
  x: number;
  y: number;
  length: number;
  label: string;
  orientation: 'horizontal' | 'vertical';
}

export interface CadDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  offset: number;
  orientation: 'horizontal' | 'vertical';
}

export interface CadSettings {
  snap: boolean;
  snapToGrid: boolean; // Magnétisme à la grille (Snap-to-grid)
  gridSnapSize: number; // Pas de magnétisme (ex: 20px)
  gridDisplayType: 'dots' | 'lines' | 'both';
  ortho: boolean;
  polar: boolean;
  osnap: boolean;
  grid: boolean;
  lineWeight: boolean;
  dynHud: boolean;
  units: 'mm' | 'cm' | 'm';
  precision: '0.1' | '1.0';
  wallThickness: number;
  wallHeight: number;
  wallJustif: 'Nu Extérieur' | 'Axe' | 'Nu Intérieur';
  wallMaterial: string;
  chaining: boolean;
  level: string;
  projection: 'ORTHOGONAL 2D' | 'ISOMETRIQUE 3D';
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  diffProposal?: {
    title: string;
    details: string;
    impact: string;
    applied: boolean;
  };
}
