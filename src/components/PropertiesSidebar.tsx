import React, { useState, useEffect } from 'react';
import { CadEntity, CadLayer, MaterialDefinition } from '../types.ts';
import { ARCHITECTURAL_MATERIALS } from '../constants/materials.ts';

interface PropertiesSidebarProps {
  entity: CadEntity | null;
  selectedCount?: number;
  layers: CadLayer[];
  allEntities?: CadEntity[];
  onUpdate: (updatedFields: Partial<CadEntity>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDeselect: () => void;
  onClose?: () => void;
  isFloating?: boolean;
  onSnapOpeningToWall?: (entityId: string) => void;
}

export const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  entity,
  selectedCount = 1,
  layers,
  allEntities = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onDeselect,
  onClose,
  isFloating = false,
  onSnapOpeningToWall,
}) => {
  if (!entity) return null;

  // Active layer for entity
  const currentLayer = layers.find(l => l.id === entity.layerId) || layers[0];

  // Host wall detection if entity is an opening
  const hostWall = allEntities.find(
    e => e.id === entity.hostWallId || (['wall', 'partition'].includes(e.type) && Math.hypot((entity.x1 + entity.x2)/2 - (e.x1 + e.x2)/2, (entity.y1 + entity.y2)/2 - (e.y1 + e.y2)/2) < 60)
  );

  // Derived Geometric Calculations
  const dx = entity.x2 - entity.x1;
  const dy = entity.y2 - entity.y1;
  const lengthPx = Math.hypot(dx, dy);
  const lengthMm = Math.round(lengthPx * 10);
  const rawAngleDeg = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);

  // Local state for smooth typing
  const [localLength, setLocalLength] = useState(lengthMm.toString());
  const [localAngle, setLocalAngle] = useState(rawAngleDeg.toString());
  const [localThickness, setLocalThickness] = useState((entity.thickness || 200).toString());
  const [localHeight, setLocalHeight] = useState((entity.height || 2800).toString());
  const [activeSubTab, setActiveSubTab] = useState<'geom' | 'material' | 'position'>('geom');

  // Sync local state when selected entity changes
  useEffect(() => {
    setLocalLength(lengthMm.toString());
    setLocalAngle(rawAngleDeg.toString());
    setLocalThickness((entity.thickness || 200).toString());
    setLocalHeight((entity.height || 2800).toString());
  }, [entity.id, lengthMm, rawAngleDeg, entity.thickness, entity.height]);

  // Current Material Index Definition
  const currentMaterial = ARCHITECTURAL_MATERIALS.find(
    m => m.index === entity.materialIndex || m.name === entity.material
  ) || (
    entity.type === 'partition' ? ARCHITECTURAL_MATERIALS[1] : ARCHITECTURAL_MATERIALS[0]
  );

  // Handle Length Change (maintains P1 origin and current angle)
  const handleLengthChange = (newLenMm: number) => {
    const validLen = Math.max(50, Math.min(25000, newLenMm));
    setLocalLength(validLen.toString());
    const angleRad = Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1);
    const newLenPx = validLen / 10;
    const newX2 = Math.round(entity.x1 + newLenPx * Math.cos(angleRad));
    const newY2 = Math.round(entity.y1 + newLenPx * Math.sin(angleRad));

    onUpdate({
      x2: newX2,
      y2: newY2,
      name: entity.name.includes('L=') 
        ? entity.name.replace(/L=\d+mm/, `L=${validLen}mm`) 
        : `${entity.name} (L=${validLen}mm)`
    });
  };

  // Handle Angle Change (rotates P2 around P1, maintaining length)
  const handleAngleChange = (newAngleDeg: number) => {
    const normAngle = ((newAngleDeg % 360) + 360) % 360;
    setLocalAngle(normAngle.toString());
    const curLenPx = Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
    const angleRad = (normAngle * Math.PI) / 180;
    const newX2 = Math.round(entity.x1 + curLenPx * Math.cos(angleRad));
    const newY2 = Math.round(entity.y1 + curLenPx * Math.sin(angleRad));

    onUpdate({
      x2: newX2,
      y2: newY2,
      angle: normAngle,
    });
  };

  // Handle Material Index Change
  const handleMaterialSelect = (mat: MaterialDefinition) => {
    onUpdate({
      materialIndex: mat.index,
      material: mat.name,
      color: mat.color,
    });
  };

  // Align element to nearest 20px grid points
  const handleAlignTo20pxGrid = () => {
    const step = 20;
    const newX1 = Math.round(entity.x1 / step) * step;
    const newY1 = Math.round(entity.y1 / step) * step;
    const newX2 = Math.round(entity.x2 / step) * step;
    const newY2 = Math.round(entity.y2 / step) * step;
    onUpdate({
      x1: newX1,
      y1: newY1,
      x2: newX2,
      y2: newY2,
    });
  };

  return (
    <div
      className={`flex flex-col bg-[#051424] text-on-surface border border-primary/30 shadow-2xl overflow-hidden font-sans select-none ${
        isFloating
          ? 'w-84 max-h-[85vh] rounded-xl backdrop-blur-xl bg-opacity-95 z-40 transition-all animate-in fade-in slide-in-from-right-4 duration-200'
          : 'w-full h-full'
      }`}
    >
      {/* 1. SIDEBAR HEADER */}
      <div className="h-11 px-3 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30 flex-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <span 
            className="w-2.5 h-2.5 rounded-full flex-none" 
            style={{ backgroundColor: currentMaterial.color || currentLayer.color }}
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-primary truncate max-w-[150px]">
                {entity.name}
              </span>
              <span className="bg-primary/10 text-primary font-mono text-[9px] px-1 rounded uppercase font-semibold">
                {entity.type}
              </span>
            </div>
            <span className="font-mono text-[9px] text-outline truncate">
              ID: {entity.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-none">
          <button
            onClick={onDuplicate}
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            title="Dupliquer l'élément (Ctrl+D)"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-error hover:bg-error/20 transition-colors"
            title="Supprimer l'élément (Suppr)"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
          <button
            onClick={onClose || onDeselect}
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors ml-1"
            title="Fermer la sélection (Échap)"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-TABS SWITCHER */}
      <div className="grid grid-cols-3 h-8 bg-surface-container-lowest border-b border-outline-variant/20 font-mono text-[10px] text-center flex-none">
        <button
          onClick={() => setActiveSubTab('geom')}
          className={`flex items-center justify-center gap-1 transition-colors ${
            activeSubTab === 'geom'
              ? 'text-primary font-bold border-b-2 border-primary bg-primary/5'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[13px]">straighten</span>
          <span>GÉOMÉTRIE</span>
        </button>
        <button
          onClick={() => setActiveSubTab('material')}
          className={`flex items-center justify-center gap-1 transition-colors ${
            activeSubTab === 'material'
              ? 'text-tertiary font-bold border-b-2 border-tertiary bg-tertiary/5'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[13px]">texture</span>
          <span>MATÉRIAU</span>
        </button>
        <button
          onClick={() => setActiveSubTab('position')}
          className={`flex items-center justify-center gap-1 transition-colors ${
            activeSubTab === 'position'
              ? 'text-secondary font-bold border-b-2 border-secondary bg-secondary/5'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[13px]">location_searching</span>
          <span>REPÈRE</span>
        </button>
      </div>

      {/* 3. SCROLLABLE ATTRIBUTE INSPECTOR */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-xs">
        {/* SUBTAB 1: GEOMETRY & ANGLES */}
        {activeSubTab === 'geom' && (
          <>
            {/* ATTRIBUTE CERCLE : RAYON, DIAMÈTRE & SURFACE */}
            {entity.type === 'circle' && (() => {
              const curR = entity.radius ?? Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
              const rMm = Math.round(curR * 10);
              const dMm = rMm * 2;
              const areaM2 = (Math.PI * Math.pow(rMm / 1000, 2)).toFixed(2);

              const handleRadiusChange = (newR_mm: number) => {
                const validR_mm = Math.max(50, Math.min(25000, newR_mm));
                const newRPx = validR_mm / 10;
                onUpdate({
                  radius: newRPx,
                  x2: entity.x1 + newRPx,
                  y2: entity.y1,
                  area: Math.round(Math.PI * Math.pow(validR_mm / 1000, 2) * 100) / 100,
                  name: `Cercle (R=${validR_mm}mm)`
                });
              };

              return (
                <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-sky-400 font-bold tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">radio_button_unchecked</span>
                      <span>PARAMÈTRES DU CERCLE</span>
                    </span>
                    <span className="font-mono text-[10px] text-sky-300 font-bold">
                      {areaM2} m²
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-container-lowest p-1.5 rounded border border-outline-variant/30">
                      <span className="text-[9px] font-mono text-outline block">RAYON (R)</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          value={rMm}
                          onChange={(e) => handleRadiusChange(Number(e.target.value))}
                          className="w-full bg-transparent font-mono text-xs font-bold text-on-surface outline-none text-right"
                          step="50"
                        />
                        <span className="text-[9px] font-mono text-outline">mm</span>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest p-1.5 rounded border border-outline-variant/30">
                      <span className="text-[9px] font-mono text-outline block">DIAMÈTRE (⌀)</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          value={dMm}
                          onChange={(e) => handleRadiusChange(Number(e.target.value) / 2)}
                          className="w-full bg-transparent font-mono text-xs font-bold text-on-surface outline-none text-right"
                          step="100"
                        />
                        <span className="text-[9px] font-mono text-outline">mm</span>
                      </div>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="100"
                    max="6000"
                    step="50"
                    value={rMm}
                    onChange={(e) => handleRadiusChange(Number(e.target.value))}
                    className="w-full accent-sky-400 h-1.5 bg-surface-container rounded cursor-pointer"
                  />

                  <div className="grid grid-cols-4 gap-1">
                    {[300, 500, 1000, 1500].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleRadiusChange(preset)}
                        className={`py-0.5 rounded font-mono text-[9px] transition-colors border ${
                          rMm === preset
                            ? 'bg-sky-500 text-white font-bold border-sky-400'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                        }`}
                      >
                        R {preset}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ATTRIBUTE 1: LENGTH (LONGUEUR) */}
            {entity.type !== 'circle' && (
            <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-primary font-bold tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">straighten</span>
                  <span>LONGUEUR (LENGTH)</span>
                </span>
                <span className="font-mono text-[11px] text-primary font-bold">
                  {lengthMm} mm
                </span>
              </div>

              {/* Number Input + Quick Steppers */}
              <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded border border-outline-variant/30">
                <button
                  onClick={() => handleLengthChange(lengthMm - 100)}
                  className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-mono text-[10px]"
                  title="-100 mm"
                >
                  -100
                </button>
                <input
                  type="number"
                  value={localLength}
                  onChange={(e) => {
                    setLocalLength(e.target.value);
                    const n = Number(e.target.value);
                    if (!isNaN(n) && n > 0) handleLengthChange(n);
                  }}
                  className="flex-1 bg-transparent text-center font-mono text-xs font-bold text-on-surface outline-none"
                  min="50"
                  step="20"
                />
                <span className="text-[10px] text-outline font-mono pr-1">mm</span>
                <button
                  onClick={() => handleLengthChange(lengthMm + 100)}
                  className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-mono text-[10px]"
                  title="+100 mm"
                >
                  +100
                </button>
              </div>

              {/* Interactive Length Slider */}
              <input
                type="range"
                min="200"
                max="10000"
                step="200"
                value={Math.min(10000, Math.max(200, lengthMm))}
                onChange={(e) => handleLengthChange(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-surface-container rounded cursor-pointer"
              />

              {/* Quick Presets based on 20px grid (200mm modules) */}
              <div className="grid grid-cols-4 gap-1">
                {[1200, 2400, 3600, 4800].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleLengthChange(preset)}
                    className={`py-0.5 rounded font-mono text-[9px] transition-colors border ${
                      lengthMm === preset
                        ? 'bg-primary text-on-primary font-bold border-primary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* ATTRIBUTE 2: ANGLE & ORIENTATION */}
            {entity.type !== 'circle' && (
            <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-tertiary font-bold tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">rotate_right</span>
                  <span>ANGLE & ORIENTATION</span>
                </span>
                <span className="font-mono text-[11px] text-tertiary font-bold">
                  {rawAngleDeg}°
                </span>
              </div>

              {/* Angle Dial & Number Input */}
              <div className="flex items-center gap-3 bg-surface-container-lowest p-2 rounded border border-outline-variant/30">
                {/* Visual Compass Reticle */}
                <div className="relative w-12 h-12 rounded-full border border-tertiary/40 flex items-center justify-center flex-none bg-[#020b14]">
                  <div
                    className="absolute w-5 h-0.5 bg-tertiary rounded-full origin-left left-1/2"
                    style={{ transform: `rotate(${rawAngleDeg}deg)` }}
                  />
                  <div className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                  <span className="absolute top-0.5 font-mono text-[7px] text-outline">N</span>
                  <span className="absolute right-0.5 font-mono text-[7px] text-outline">E</span>
                  <span className="absolute bottom-0.5 font-mono text-[7px] text-outline">S</span>
                  <span className="absolute left-0.5 font-mono text-[7px] text-outline">O</span>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={localAngle}
                      onChange={(e) => {
                        setLocalAngle(e.target.value);
                        const n = Number(e.target.value);
                        if (!isNaN(n)) handleAngleChange(n);
                      }}
                      className="w-16 bg-surface-container px-2 py-1 rounded text-center font-mono text-xs font-bold text-tertiary outline-none border border-outline-variant/30"
                      min="0"
                      max="360"
                      step="5"
                    />
                    <span className="font-mono text-xs text-outline">degrés</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={rawAngleDeg}
                    onChange={(e) => handleAngleChange(Number(e.target.value))}
                    className="w-full accent-tertiary h-1.5 bg-surface-container rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Cardinal Angles (0°, 45°, 90°, 180°, 270°) */}
              <div className="grid grid-cols-5 gap-1 font-mono text-[9px]">
                {[
                  { deg: 0, label: '0° Est' },
                  { deg: 45, label: '45°' },
                  { deg: 90, label: '90° Sud' },
                  { deg: 180, label: '180° O.' },
                  { deg: 270, label: '270° N.' },
                ].map(({ deg, label }) => (
                  <button
                    key={deg}
                    onClick={() => handleAngleChange(deg)}
                    className={`py-1 rounded text-center transition-colors border ${
                      rawAngleDeg === deg
                        ? 'bg-tertiary text-on-tertiary font-bold border-tertiary'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* ATTRIBUTE 3: THICKNESS & HEIGHT */}
            {['wall', 'partition', 'rect'].includes(entity.type) && (
              <div className="grid grid-cols-2 gap-2">
                {/* Thickness */}
                <div className="bg-surface-container-low p-2 rounded border border-outline-variant/20 flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                    Épaisseur
                  </span>
                  <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30">
                    <input
                      type="number"
                      value={localThickness}
                      onChange={(e) => {
                        setLocalThickness(e.target.value);
                        onUpdate({ thickness: Number(e.target.value) });
                      }}
                      className="w-full bg-transparent font-mono text-xs text-on-surface font-bold outline-none text-right"
                    />
                    <span className="font-mono text-[10px] text-outline">mm</span>
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    {[72, 98, 200].map(th => (
                      <button
                        key={th}
                        onClick={() => {
                          setLocalThickness(th.toString());
                          onUpdate({ thickness: th });
                        }}
                        className={`flex-1 py-0.5 rounded font-mono text-[8px] border ${
                          (entity.thickness || 200) === th
                            ? 'bg-primary/20 text-primary border-primary/50 font-bold'
                            : 'bg-surface-container text-outline border-outline-variant/20'
                        }`}
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height */}
                <div className="bg-surface-container-low p-2 rounded border border-outline-variant/20 flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                    Hauteur libre
                  </span>
                  <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30">
                    <input
                      type="number"
                      value={localHeight}
                      onChange={(e) => {
                        setLocalHeight(e.target.value);
                        onUpdate({ height: Number(e.target.value) });
                      }}
                      className="w-full bg-transparent font-mono text-xs text-on-surface font-bold outline-none text-right"
                    />
                    <span className="font-mono text-[10px] text-outline">mm</span>
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    {[2500, 2800, 3000].map(ht => (
                      <button
                        key={ht}
                        onClick={() => {
                          setLocalHeight(ht.toString());
                          onUpdate({ height: ht });
                        }}
                        className={`flex-1 py-0.5 rounded font-mono text-[8px] border ${
                          (entity.height || 2800) === ht
                            ? 'bg-primary/20 text-primary border-primary/50 font-bold'
                            : 'bg-surface-container text-outline border-outline-variant/20'
                        }`}
                      >
                        {ht / 1000}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ATTRIBUTE 4: HACHURES PARAMÉTRIQUES (Pour pièces, rectangles, cercles, polygones et zones) */}
            {['room', 'rect', 'circle', 'wall', 'polygon'].includes(entity.type) && (
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-tertiary font-bold tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">texture</span>
                    <span>HACHURES PARAMÉTRIQUES</span>
                  </span>
                  <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-tertiary/20 text-tertiary font-semibold">
                    {entity.hatchPattern || 'Aucune'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'none', label: 'Aucune', icon: 'block' },
                    { id: 'briques', label: 'Briques', icon: 'grid_view' },
                    { id: 'beton', label: 'Béton', icon: 'grain' },
                    { id: 'bois', label: 'Bois', icon: 'align_horizontal_left' },
                    { id: 'isolation', label: 'Isolation', icon: 'waves' },
                    { id: 'carrelage', label: 'Carrelage', icon: 'grid_on' },
                    { id: 'sable', label: 'Sable', icon: 'scatter_plot' },
                  ].map((pat) => {
                    const isSelected = (entity.hatchPattern || 'none') === pat.id;
                    return (
                      <button
                        key={pat.id}
                        onClick={() => onUpdate({ hatchPattern: pat.id as any })}
                        className={`p-1.5 rounded flex flex-col items-center justify-center gap-0.5 text-center border transition-all ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs'
                            : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{pat.icon}</span>
                        <span className="font-mono text-[8px] leading-tight">{pat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ATTRIBUTE 5: PROPRIÉTÉS COTATION (Pour type dim) */}
            {entity.type === 'dim' && (
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20 flex flex-col gap-2">
                <span className="font-mono text-[10px] text-primary font-bold tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">straighten</span>
                  <span>PARAMÈTRES DE COTATION</span>
                </span>

                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-outline">Libellé de cote</span>
                  <input
                    type="text"
                    value={entity.label || ''}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    className="bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30 text-xs font-mono text-on-surface outline-none"
                    placeholder="Ex: 3 600 mm"
                  />
                </div>

                <div className="flex items-center justify-between bg-surface-container-lowest p-1.5 rounded border border-outline-variant/30">
                  <span className="font-mono text-[10px] text-outline">Décalage ligne de rappel</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdate({ dimOffset: Math.max(5, (entity.dimOffset || 16) - 4) })}
                      className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-bright font-mono text-[10px]"
                    >
                      -
                    </button>
                    <span className="font-mono text-[11px] font-bold text-primary w-8 text-center">
                      {entity.dimOffset || 16}
                    </span>
                    <button
                      onClick={() => onUpdate({ dimOffset: Math.min(60, (entity.dimOffset || 16) + 4) })}
                      className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-bright font-mono text-[10px]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* SUBTAB 2: MATERIAL INDEX (INDICE MATÉRIAU) */}
        {activeSubTab === 'material' && (
          <div className="flex flex-col gap-2.5">
            {/* Active Material Summary Card */}
            <div 
              className="p-3 rounded-lg border bg-surface-container-low flex flex-col gap-1.5 shadow-sm"
              style={{ borderColor: `${currentMaterial.color}60` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="px-2 py-0.5 rounded font-mono text-[10px] font-bold text-black"
                    style={{ backgroundColor: currentMaterial.color }}
                  >
                    {currentMaterial.index}
                  </span>
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {currentMaterial.name}
                  </span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary font-bold uppercase">
                  {currentMaterial.category}
                </span>
              </div>

              <p className="text-[11px] text-on-surface-variant leading-tight">
                {currentMaterial.description}
              </p>

              {/* Physical CAD Specs Grid */}
              <div className="grid grid-cols-3 gap-1.5 mt-1 pt-2 border-t border-outline-variant/20 font-mono text-[10px]">
                <div className="flex flex-col bg-surface-container-lowest p-1 rounded">
                  <span className="text-outline text-[8px]">MASSE VOL.</span>
                  <span className="text-on-surface font-semibold truncate">{currentMaterial.density}</span>
                </div>
                <div className="flex flex-col bg-surface-container-lowest p-1 rounded">
                  <span className="text-outline text-[8px]">COND. LAMBDA</span>
                  <span className="text-primary font-semibold truncate">{currentMaterial.lambda}</span>
                </div>
                <div className="flex flex-col bg-surface-container-lowest p-1 rounded">
                  <span className="text-outline text-[8px]">INDICE PHONIQUE</span>
                  <span className="text-tertiary font-semibold truncate">{currentMaterial.acoustic}</span>
                </div>
              </div>
            </div>

            {/* Material Catalog Selector List */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-outline uppercase font-semibold">
                CATALOGUE DES MATÉRIAUX NORMALISÉS :
              </span>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {ARCHITECTURAL_MATERIALS.map((mat) => {
                  const isSelected = currentMaterial.index === mat.index;
                  return (
                    <button
                      key={mat.index}
                      onClick={() => handleMaterialSelect(mat)}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-surface-container-high border-primary shadow-xs'
                          : 'bg-surface-container-lowest border-outline-variant/20 hover:border-outline-variant/60 hover:bg-surface-container'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-none"
                          style={{ backgroundColor: mat.color }}
                        />
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-bold text-on-surface">
                            {mat.index} · {mat.name}
                          </span>
                          <span className="font-mono text-[9px] text-outline">
                            {mat.acoustic} · {mat.lambda}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: COORDINATES, GRID ALIGNMENT & LAYER */}
        {activeSubTab === 'position' && (
          <div className="flex flex-col gap-2.5">
            {/* Calque CAD */}
            <div className="bg-surface-container-low p-2 rounded border border-outline-variant/20 flex flex-col gap-1">
              <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                CALQUE CAD ASSIGNÉ
              </span>
              <select
                value={entity.layerId}
                onChange={(e) => onUpdate({ layerId: e.target.value })}
                className="bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30 text-xs font-mono text-on-surface outline-none cursor-pointer"
              >
                {layers.map(l => (
                  <option key={l.id} value={l.id} className="bg-surface-container">
                    {l.name} ({l.category})
                  </option>
                ))}
              </select>
            </div>

            {/* P1 and P2 Absolute Coordinates */}
            <div className="bg-surface-container-low p-2 rounded border border-outline-variant/20 flex flex-col gap-1.5 font-mono text-xs">
              <span className="text-[9px] text-outline uppercase font-semibold">
                COORDONNÉES ABSOLUES (ECHELLE 1:50)
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-lowest p-1.5 rounded border border-outline-variant/30 flex flex-col">
                  <span className="text-[9px] text-outline">ORIGINE P1</span>
                  <span className="font-bold text-primary">
                    X: {entity.x1 * 10} mm
                  </span>
                  <span className="font-bold text-primary">
                    Y: {entity.y1 * 10} mm
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-1.5 rounded border border-outline-variant/30 flex flex-col">
                  <span className="text-[9px] text-outline">EXTRÉMITÉ P2</span>
                  <span className="font-bold text-tertiary">
                    X: {entity.x2 * 10} mm
                  </span>
                  <span className="font-bold text-tertiary">
                    Y: {entity.y2 * 10} mm
                  </span>
                </div>
              </div>

              {/* Align to 20px Grid button */}
              <button
                onClick={handleAlignTo20pxGrid}
                className="mt-1 w-full py-1.5 rounded bg-tertiary-container/30 hover:bg-tertiary-container/50 text-tertiary font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 border border-tertiary/40 transition-colors"
                title="Repositionne P1 et P2 sur les points de la grille 20px"
              >
                <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
                <span>Magnétiser sur la Grille 20px</span>
              </button>
            </div>

            {/* OUVERTURES ENCASTRÉES (PORTES & FENÊTRES) */}
            {(entity.type === 'door' || entity.type === 'window') && (
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-amber-500/30 flex flex-col gap-2.5 shadow-xs">
                {/* Header Encastrement Status */}
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-[17px] ${entity.type === 'door' ? 'text-amber-400' : 'text-sky-400'}`}>
                      {entity.type === 'door' ? 'meeting_room' : 'window'}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-on-surface uppercase">
                      OUVERTURE TOUJOURS ENCASTRÉE
                    </span>
                  </div>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>SUR MUR</span>
                  </span>
                </div>

                {/* Host Wall Information Pill */}
                <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-outline text-[10px]">
                    <span>MUR HÔTE :</span>
                    <span className="text-on-surface font-semibold truncate max-w-[150px]">
                      {hostWall ? hostWall.name : (entity.thickness === 72 ? 'Cloison Placostil' : 'Mur porteur')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-outline text-[10px]">
                    <span>ÉPAISSEUR MAÇONNERIE :</span>
                    <span className="text-primary font-bold">
                      {entity.thickness || (hostWall?.thickness || 200)} mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-outline text-[10px]">
                    <span>ORIENTATION SEGMENT :</span>
                    <span className="text-on-surface-variant font-semibold">
                      {entity.angle || 0}°
                    </span>
                  </div>
                  {onSnapOpeningToWall && (
                    <button
                      onClick={() => onSnapOpeningToWall(entity.id)}
                      className="mt-1 w-full py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Recale et réaligne précisément l'ouverture dans l'axe du mur le plus proche"
                    >
                      <span className="material-symbols-outlined text-[13px]">tune</span>
                      <span>Ré-encastrer sur le mur le plus proche</span>
                    </button>
                  )}
                </div>

                {/* Preset Widths (Largeur de passage / baie) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-outline uppercase font-semibold">
                      LARGEUR DE {entity.type === 'door' ? 'PASSAGE' : 'BAIE'} :
                    </span>
                    <span className="text-on-surface font-bold">
                      {entity.openingWidth || Math.round(lengthPx * 10)} mm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(entity.type === 'door'
                      ? [600, 730, 830, 900, 1000, 1400]
                      : [600, 900, 1200, 1400, 1800, 2400]
                    ).map(w => {
                      const curW = entity.openingWidth || Math.round(lengthPx * 10);
                      const isAct = curW === w;
                      return (
                        <button
                          key={w}
                          onClick={() => {
                            const curDx = entity.x2 - entity.x1;
                            const curDy = entity.y2 - entity.y1;
                            const curLen = Math.hypot(curDx, curDy) || 1;
                            const ux = curDx / curLen;
                            const uy = curDy / curLen;
                            const midX = (entity.x1 + entity.x2) / 2;
                            const midY = (entity.y1 + entity.y2) / 2;
                            const halfLenPx = (w / 10) / 2;
                            onUpdate({
                              x1: Math.round((midX - ux * halfLenPx) * 10) / 10,
                              y1: Math.round((midY - uy * halfLenPx) * 10) / 10,
                              x2: Math.round((midX + ux * halfLenPx) * 10) / 10,
                              y2: Math.round((midY + uy * halfLenPx) * 10) / 10,
                              openingWidth: w,
                              label: entity.type === 'door' ? `PORTE ${w}mm` : `FENÊTRE ${w}x${entity.height || 1250}`,
                            });
                          }}
                          className={`py-1 rounded font-mono text-[10px] font-semibold border transition-all ${
                            isAct
                              ? entity.type === 'door'
                                ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-xs'
                                : 'bg-sky-500/25 text-sky-300 border-sky-500/50 shadow-xs'
                              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                          }`}
                        >
                          {w}mm {w === 900 && entity.type === 'door' ? 'PMR' : w >= 1800 ? 'Baie' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Glissière / Déplacement le long du mur */}
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                    POSITION LE LONG DU MUR :
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        const curDx = entity.x2 - entity.x1;
                        const curDy = entity.y2 - entity.y1;
                        const curLen = Math.hypot(curDx, curDy) || 1;
                        const ux = curDx / curLen;
                        const uy = curDy / curLen;
                        const shiftPx = 10; // -100mm
                        onUpdate({
                          x1: Math.round((entity.x1 - ux * shiftPx) * 10) / 10,
                          y1: Math.round((entity.y1 - uy * shiftPx) * 10) / 10,
                          x2: Math.round((entity.x2 - ux * shiftPx) * 10) / 10,
                          y2: Math.round((entity.y2 - uy * shiftPx) * 10) / 10,
                        });
                      }}
                      className="py-1 rounded bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 text-xs font-mono flex items-center justify-center gap-1 text-on-surface-variant"
                      title="Glisser de 100mm vers l'extrémité P1 du mur"
                    >
                      <span>◀ -100mm</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!hostWall) return;
                        const wallDx = hostWall.x2 - hostWall.x1;
                        const wallDy = hostWall.y2 - hostWall.y1;
                        const wallLen = Math.hypot(wallDx, wallDy);
                        if (wallLen < 10) return;
                        const ux = wallDx / wallLen;
                        const uy = wallDy / wallLen;
                        const wallMidX = (hostWall.x1 + hostWall.x2) / 2;
                        const wallMidY = (hostWall.y1 + hostWall.y2) / 2;
                        const opWidth = entity.openingWidth || Math.round(lengthPx * 10) || 830;
                        const halfLenPx = (opWidth / 10) / 2;
                        onUpdate({
                          x1: Math.round((wallMidX - ux * halfLenPx) * 10) / 10,
                          y1: Math.round((wallMidY - uy * halfLenPx) * 10) / 10,
                          x2: Math.round((wallMidX + ux * halfLenPx) * 10) / 10,
                          y2: Math.round((wallMidY + uy * halfLenPx) * 10) / 10,
                          angle: hostWall.angle || Math.round((Math.atan2(wallDy, wallDx) * 180 / Math.PI + 360) % 360),
                          thickness: hostWall.thickness || 200,
                        });
                      }}
                      className="py-1 rounded bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 text-xs font-mono font-semibold flex items-center justify-center text-primary"
                      title="Centrer exactement l'ouverture sur le mur"
                    >
                      <span>Centrer</span>
                    </button>
                    <button
                      onClick={() => {
                        const curDx = entity.x2 - entity.x1;
                        const curDy = entity.y2 - entity.y1;
                        const curLen = Math.hypot(curDx, curDy) || 1;
                        const ux = curDx / curLen;
                        const uy = curDy / curLen;
                        const shiftPx = 10; // +100mm
                        onUpdate({
                          x1: Math.round((entity.x1 + ux * shiftPx) * 10) / 10,
                          y1: Math.round((entity.y1 + uy * shiftPx) * 10) / 10,
                          x2: Math.round((entity.x2 + ux * shiftPx) * 10) / 10,
                          y2: Math.round((entity.y2 + uy * shiftPx) * 10) / 10,
                        });
                      }}
                      className="py-1 rounded bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 text-xs font-mono flex items-center justify-center gap-1 text-on-surface-variant"
                      title="Glisser de 100mm vers l'extrémité P2 du mur"
                    >
                      <span>+100mm ▶</span>
                    </button>
                  </div>
                </div>

                {/* Spécifique aux Portes : Sens, Inversion, Angle */}
                {entity.type === 'door' && (
                  <div className="flex flex-col gap-1.5 border-t border-outline-variant/20 pt-2">
                    <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                      DÉBATTEMENT & SENS DU BATTANT :
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onUpdate({ doorSwing: entity.doorSwing === 'left' ? 'right' : 'left' })}
                        className="py-1 rounded bg-surface-container-lowest border border-outline-variant/30 text-[11px] font-mono flex items-center justify-center gap-1 hover:border-amber-400"
                      >
                        <span className="material-symbols-outlined text-[13px] text-amber-400">sync_alt</span>
                        <span>Sens : {entity.doorSwing === 'left' ? 'Gauche' : 'Droit'}</span>
                      </button>
                      <button
                        onClick={() => onUpdate({ flipSwing: !entity.flipSwing })}
                        className={`py-1 rounded border text-[11px] font-mono flex items-center justify-center gap-1 ${
                          entity.flipSwing
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface hover:border-amber-400'
                        }`}
                        title="Inverser le sens d'ouverture intérieur / extérieur"
                      >
                        <span className="material-symbols-outlined text-[13px]">swap_vert</span>
                        <span>Côté : {entity.flipSwing ? 'Extérieur' : 'Intérieur'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 mt-0.5">
                      {[90, 45, 0].map(ang => (
                        <button
                          key={ang}
                          onClick={() => onUpdate({ doorAngle: ang })}
                          className={`py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            (entity.doorAngle !== undefined ? entity.doorAngle : 90) === ang
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-surface-container-lowest text-outline hover:text-on-surface border-outline-variant/20'
                          }`}
                        >
                          {ang === 0 ? 'Fermée (0°)' : `${ang}°`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spécifique aux Fenêtres : Allège & Type */}
                {entity.type === 'window' && (
                  <div className="flex flex-col gap-1.5 border-t border-outline-variant/20 pt-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-outline uppercase font-semibold">HAUTEUR D'ALLÈGE :</span>
                      <span className="text-sky-300 font-bold">{entity.sillHeight !== undefined ? entity.sillHeight : 900} mm</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { label: '0mm (Baie)', val: 0 },
                        { label: '450mm', val: 450 },
                        { label: '900mm (Std)', val: 900 },
                      ].map(item => (
                        <button
                          key={item.val}
                          onClick={() => onUpdate({ sillHeight: item.val })}
                          className={`py-1 rounded text-[10px] font-mono font-semibold border ${
                            (entity.sillHeight !== undefined ? entity.sillHeight : 900) === item.val
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-surface-container-lowest text-outline hover:text-on-surface border-outline-variant/20'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                      <span className="text-outline uppercase font-semibold">TYPE MENUISERIE :</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onUpdate({ openingType: 'window_casement' })}
                        className={`py-1 rounded text-[10px] font-mono font-semibold border ${
                          entity.openingType !== 'window_sliding' && entity.openingType !== 'window_fixed'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-surface-container-lowest text-outline border-outline-variant/20'
                        }`}
                      >
                        Battante (Frappe)
                      </button>
                      <button
                        onClick={() => onUpdate({ openingType: 'window_sliding' })}
                        className={`py-1 rounded text-[10px] font-mono font-semibold border ${
                          entity.openingType === 'window_sliding'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-surface-container-lowest text-outline border-outline-variant/20'
                        }`}
                      >
                        Coulissante (Baie)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. FOOTER QUICK ACTION BAR */}
      <div className="p-2.5 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center justify-between gap-2 flex-none">
        <button
          onClick={onDeselect}
          className="px-2 py-1 rounded bg-surface-container text-on-surface-variant hover:text-on-surface font-mono text-[10px] transition-colors"
          title="Désélectionner (Échap)"
        >
          Désélectionner
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onDuplicate}
            className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">content_copy</span>
            <span>Dupliquer</span>
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1 rounded bg-error/20 hover:bg-error text-on-error font-mono text-[10px] font-bold flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[13px]">delete</span>
            <span>Supprimer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
