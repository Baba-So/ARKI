import React, { useMemo, useState } from 'react';
import { CadEntity, CadLevel } from '../types.ts';
import { Dir, DIR_LABEL, LOOK_LABEL, buildLevelData, buildViewModel } from '../viewsGeometry.ts';
import { ElevationDrawing } from './ElevationDrawing.tsx';

/**
 * Onglet « Vues » : façades (élévations) et coupes générées à partir du plan.
 * Conventions : 1 px plan = 10 mm, plan Y vers le bas (Nord en haut).
 * Un point du plan est projeté en (u, d) : u = abscisse écran (mm), d = profondeur (mm, croissante vers le fond).
 */

interface ViewsPanelProps {
  levels: CadLevel[];
  entitiesByLevel: Record<string, CadEntity[]>;
  activeLevelId: string;
  isLayerVisible: (layerId: string) => boolean;
  selectedIds: string[];
  onBackToPlan: () => void;
}

export const ViewsPanel: React.FC<ViewsPanelProps> = ({ levels, entitiesByLevel, activeLevelId, isLayerVisible, selectedIds, onBackToPlan }) => {
  const [mode, setMode] = useState<'elevation' | 'section'>('elevation');
  const [dir, setDir] = useState<Dir>('S');
  const [sectionId, setSectionId] = useState<'AA' | 'BB'>('AA');
  const [cutY, setCutY] = useState(400); // coupe AA : horizontale (y plan)
  const [cutX, setCutX] = useState(430); // coupe BB : verticale (x plan)
  const [flipSection, setFlipSection] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showDims, setShowDims] = useState(true);

  const [hiddenLevels, setHiddenLevels] = useState<string[]>([]);

  const sortedLevels = useMemo(() => [...levels].sort((a, b) => a.elevation - b.elevation), [levels]);
  const shownLevels = useMemo(() => sortedLevels.filter(l => !hiddenLevels.includes(l.id)), [sortedLevels, hiddenLevels]);

  const levelData = useMemo(
    () => buildLevelData(levels, entitiesByLevel, isLayerVisible, hiddenLevels),
    [levels, entitiesByLevel, isLayerVisible, hiddenLevels]
  );

  const walls = useMemo(() => levelData.flatMap(d => d.walls), [levelData]);

  const plan = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    walls.forEach(w => { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); });
    if (!xs.length) return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [walls]);

  const model = useMemo(
    () =>
      buildViewModel(levelData, {
        type: mode,
        dir,
        sectionId,
        cutValue: sectionId === 'AA' ? cutY : cutX,
        flip: flipSection,
      }),
    [levelData, mode, dir, sectionId, cutX, cutY, flipSection]
  );
  const { cut, viewDir, strips, bounds } = model;

  const margin = 900;
  const vbW = (bounds.maxU - bounds.minU + margin * 2) / zoom;
  const vbH = (bounds.maxZ - bounds.minZ + 2000) / zoom;
  const vbX = (bounds.minU + bounds.maxU) / 2 - vbW / 2;
  const vbCy = (-bounds.maxZ - 800 + (-bounds.minZ + 1200)) / 2;
  const vbY = vbCy - vbH / 2;
  const dimY = -bounds.minZ + 600;

  const title = mode === 'elevation'
    ? DIR_LABEL[dir]
    : `Coupe ${sectionId}-${sectionId} (${LOOK_LABEL[viewDir]})`;

  // Mini-plan avec repère de la vue / coupe
  const planPad = 40;
  const planW = plan.maxX - plan.minX + planPad * 2;
  const planH = plan.maxY - plan.minY + planPad * 2;

  return (
    <div className="absolute inset-0 flex select-none bg-radial from-[#0d2238] to-[#030a12]">
      {/* Panneau de sélection des vues */}
      <div className="w-60 flex-none border-r border-outline-variant/20 bg-surface-container-lowest/80 p-3 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[18px]">view_quilt</span>
          <span className="font-mono text-xs font-bold tracking-wide">VUES &amp; COUPES</span>
        </div>

        <div>
          <div className="font-mono text-[10px] text-outline mb-1">FAÇADES</div>
          <div className="grid grid-cols-2 gap-1">
            {(['S', 'N', 'E', 'O'] as Dir[]).map(d => (
              <button
                key={d}
                onClick={() => { setMode('elevation'); setDir(d); }}
                className={`px-2 py-1.5 rounded border font-mono text-[10px] transition-colors ${
                  mode === 'elevation' && dir === d
                    ? 'bg-primary/20 border-primary/50 text-primary font-bold'
                    : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {d === 'S' ? 'Face (Sud)' : d === 'N' ? 'Arrière (Nord)' : d === 'E' ? 'Droite (Est)' : 'Gauche (Ouest)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] text-outline mb-1">COUPES</div>
          <div className="grid grid-cols-2 gap-1">
            {(['AA', 'BB'] as const).map(id => (
              <button
                key={id}
                onClick={() => { setMode('section'); setSectionId(id); }}
                className={`px-2 py-1.5 rounded border font-mono text-[10px] transition-colors ${
                  mode === 'section' && sectionId === id
                    ? 'bg-secondary/20 border-secondary/50 text-secondary font-bold'
                    : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {id === 'AA' ? 'Coupe AA (long.)' : 'Coupe BB (transv.)'}
              </button>
            ))}
          </div>

          {mode === 'section' && (
            <div className="mt-2 flex flex-col gap-2">
              <label className="font-mono text-[10px] text-on-surface-variant flex flex-col gap-1">
                <span>
                  Position {sectionId === 'AA' ? 'Y' : 'X'} :{' '}
                  <span className="text-primary">{((sectionId === 'AA' ? cutY : cutX) * 10 / 1000).toFixed(2)} m</span>
                </span>
                <input
                  type="range"
                  min={sectionId === 'AA' ? plan.minY : plan.minX}
                  max={sectionId === 'AA' ? plan.maxY : plan.maxX}
                  step={5}
                  value={sectionId === 'AA' ? cutY : cutX}
                  onChange={e => (sectionId === 'AA' ? setCutY : setCutX)(Number(e.target.value))}
                  className="w-full accent-[#ffb95f]"
                />
              </label>
              <button
                onClick={() => setFlipSection(f => !f)}
                className="px-2 py-1 rounded border border-outline-variant/20 font-mono text-[10px] text-on-surface-variant hover:bg-surface-container-high flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">flip</span>
                Inverser le sens du regard
              </button>
            </div>
          )}
        </div>

        {/* Mini-plan de situation */}
        <div>
          <div className="font-mono text-[10px] text-outline mb-1">SITUATION</div>
          <svg
            viewBox={`${plan.minX - planPad} ${plan.minY - planPad} ${planW} ${planH}`}
            className="w-full bg-[#06101c] border border-outline-variant/20 rounded"
          >
            {walls.map(w => (
              <line
                key={w.id}
                x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke={w.type === 'wall' ? '#38bdf8' : '#4edea3'}
                strokeWidth={Math.max((w.thickness || 100) / 10, 3)}
                strokeLinecap="butt"
                opacity={0.8}
              />
            ))}
            {cut ? (
              <g stroke="#ffb95f" strokeWidth={3} fill="#ffb95f">
                {cut.axis === 'y' ? (
                  <line x1={plan.minX - 30} y1={cut.value} x2={plan.maxX + 30} y2={cut.value} strokeDasharray="14 5 3 5" />
                ) : (
                  <line x1={cut.value} y1={plan.minY - 30} x2={cut.value} y2={plan.maxY + 30} strokeDasharray="14 5 3 5" />
                )}
                {(() => {
                  const dx = cut.dir === 'E' ? -1 : cut.dir === 'O' ? 1 : 0;
                  const dy = cut.dir === 'S' ? -1 : cut.dir === 'N' ? 1 : 0;
                  const cx = cut.axis === 'y' ? (plan.minX + plan.maxX) / 2 : cut.value;
                  const cy = cut.axis === 'y' ? cut.value : (plan.minY + plan.maxY) / 2;
                  return (
                    <polygon
                      points={`${cx + dx * 40},${cy + dy * 40} ${cx - dy * 12},${cy + dx * 12} ${cx + dy * 12},${cy - dx * 12}`}
                      stroke="none"
                    />
                  );
                })()}
                <text x={cut.axis === 'y' ? plan.minX - 30 : cut.value + 6} y={cut.axis === 'y' ? cut.value - 6 : plan.minY - 30} fontSize={22} stroke="none" fontFamily="JetBrains Mono">
                  {sectionId}
                </text>
              </g>
            ) : (
              <g fill="#4edea3">
                {(() => {
                  const cx = (plan.minX + plan.maxX) / 2;
                  const cy = (plan.minY + plan.maxY) / 2;
                  const pos: Record<Dir, [number, number, number, number]> = {
                    S: [cx, plan.maxY + 28, 0, -1],
                    N: [cx, plan.minY - 28, 0, 1],
                    E: [plan.maxX + 28, cy, -1, 0],
                    O: [plan.minX - 28, cy, 1, 0],
                  };
                  const [px, py, dx, dy] = pos[dir];
                  return (
                    <polygon points={`${px + dx * 22},${py + dy * 22} ${px - dy * 14},${py + dx * 14} ${px + dy * 14},${py - dx * 14}`} />
                  );
                })()}
              </g>
            )}
          </svg>
        </div>

        <div>
          <div className="font-mono text-[10px] text-outline mb-1">NIVEAUX AFFICHÉS</div>
          <div className="flex flex-col gap-0.5">
            {[...sortedLevels].reverse().map(l => (
              <label key={l.id} className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hiddenLevels.includes(l.id)}
                  onChange={() => setHiddenLevels(h => (h.includes(l.id) ? h.filter(x => x !== l.id) : [...h, l.id]))}
                  className="accent-[#4cd7f6]"
                />
                <span className={l.id === activeLevelId ? 'text-primary font-bold' : ''}>{l.name}</span>
                <span className="text-outline ml-auto">{l.elevation >= 0 ? '+' : '−'}{(Math.abs(l.elevation) / 1000).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={showDims} onChange={e => setShowDims(e.target.checked)} className="accent-[#4cd7f6]" />
          Cotations &amp; niveaux
        </label>

        <button
          onClick={onBackToPlan}
          className="mt-auto px-3 py-2 bg-primary-container hover:bg-primary text-on-primary-container rounded font-mono text-[11px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          Revenir au Plan 2D
        </button>
      </div>

      {/* Zone de rendu */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-3 left-3 z-20 bg-surface-container-lowest/90 px-3 py-1.5 rounded border border-primary/30 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">
            {mode === 'section' ? 'content_cut' : 'home'}
          </span>
          <span className="font-mono text-xs text-primary font-bold">{title.toUpperCase()}</span>
          <span className="font-mono text-[10px] text-outline">Éch. 1:100</span>
        </div>
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-surface-container-lowest/90 rounded border border-outline-variant/30 p-0.5">
          <button onClick={() => setZoom(z => Math.max(0.4, z / 1.25))} className="px-2 text-on-surface-variant hover:text-primary font-mono">−</button>
          <span className="font-mono text-[10px] text-outline w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z * 1.25))} className="px-2 text-on-surface-variant hover:text-primary font-mono">+</button>
        </div>

        <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <ElevationDrawing model={model} mode={mode} activeLevelId={activeLevelId} selectedIds={selectedIds} showDims={showDims} />
        </svg>

        {!strips.length && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-outline">
            Aucun mur visible : dessinez des murs ou activez le calque « structures ».
          </div>
        )}
      </div>
    </div>
  );
};
