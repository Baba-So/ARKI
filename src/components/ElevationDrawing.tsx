import React from 'react';
import { ViewModel } from '../viewsGeometry.ts';
import { findBlock } from '../blockStore.ts';
import { slabOf } from '../levels.ts';
import { BlockSvg } from './BlockSvg.tsx';

interface ElevationDrawingProps {
  model: ViewModel;
  mode: 'elevation' | 'section';
  activeLevelId?: string;
  selectedIds?: string[];
  showDims?: boolean;
  /** palette claire pour l'impression */
  paper?: boolean;
}

/**
 * Dessin d'une façade / coupe en coordonnées réelles (mm, Y = −altitude).
 * Utilisé par l'onglet Vues et par les cadres de vue de la mise en page.
 */
export const ElevationDrawing: React.FC<ElevationDrawingProps> = ({ model, mode, activeLevelId, selectedIds = [], showDims = true, paper = false }) => {
  const { strips, bounds, levels } = model;
  const dimY = -bounds.minZ + 600;
  const c = paper
    ? { wall: '#ffffff', wallThin: '#f1f5f9', stroke: '#111827', cutStroke: '#111827', hole: '#ffffff', slab: '#ffffff', ground: '#64748b', glass: '#0ea5e9', door: '#a16207', dim: '#be185d', hatchBg: '#ffffff', hatchLine: '#111827' }
    : { wall: '#0d2438', wallThin: '#0f2a3f', stroke: '#4cd7f6', cutStroke: '#e6f6ff', hole: '#06101c', slab: '#0a1d30', ground: '#94a3b8', glass: '#38bdf8', door: '#fbbf24', dim: '#f472b6', hatchBg: '#10263b', hatchLine: '#4cd7f6' };
  const id = paper ? 'paper' : 'screen';

  return (
    <g>
      <defs>
        <pattern id={`views-cut-hatch-${id}`} width="160" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="160" height="160" fill={c.hatchBg} />
          <line x1="0" y1="0" x2="0" y2="160" stroke={c.hatchLine} strokeWidth={paper ? 14 : 26} opacity={paper ? 0.85 : 0.55} />
        </pattern>
        <pattern id={`views-ground-hatch-${id}`} width="240" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="240" stroke={c.ground} strokeWidth="18" opacity="0.5" />
        </pattern>
      </defs>

      {/* Terrain naturel */}
      <rect x={bounds.minU - 8000} y={0} width={bounds.maxU - bounds.minU + 16000} height={900 - Math.min(bounds.minZ, 0)} fill={`url(#views-ground-hatch-${id})`} />
      <line x1={bounds.minU - 8000} y1={0} x2={bounds.maxU + 8000} y2={0} stroke={c.ground} strokeWidth={22} />

      {/* Dalles : une sous chaque niveau (épaisseur propre au niveau) + dalle de toiture au-dessus du dernier niveau */}
      {[
        ...levels.map(l => ({ z: l.elevation, t: slabOf(l) })),
        ...(levels.length ? (() => { const top = [...levels].sort((a, b) => b.elevation - a.elevation)[0]; return [{ z: top.elevation + top.height + slabOf(top), t: slabOf(top) }]; })() : []),
      ].map((sl, i) => (
        <rect
          key={`slab-${i}`}
          x={bounds.minU - 300}
          y={-sl.z}
          width={bounds.maxU - bounds.minU + 600}
          height={sl.t}
          fill={mode === 'section' ? `url(#views-cut-hatch-${id})` : c.slab}
          stroke={c.stroke}
          strokeWidth={14}
        />
      ))}

      {/* Murs */}
      {strips.map(s => {
        const sel = s.levelId === activeLevelId && selectedIds.includes(s.wallId);
        const fill = s.cut ? `url(#views-cut-hatch-${id})` : s.thickness <= 100 ? c.wallThin : c.wall;
        const stroke = sel ? '#ffb95f' : s.cut ? c.cutStroke : c.stroke;
        const sw = s.cut ? 26 : 12;
        return (
          <g key={s.id} transform={`translate(0 ${-s.z0})`}>
            <rect x={s.uMin} y={-s.height} width={s.uMax - s.uMin} height={s.height} fill={fill} stroke={stroke} strokeWidth={sw} />
            {s.holes.map((hh, i) => {
              const hs = hh.u1 - hh.u0;
              return (
                <g key={`${s.id}-h${i}`}>
                  <rect x={hh.u0} y={-hh.z1} width={hs} height={hh.z1 - hh.z0} fill={c.hole} stroke={stroke} strokeWidth={10} />
                  {!s.cut && hs > 5 && findBlock(hh.blockId) && (
                    // vue de face du bloc d'ouverture (symbole paramétrique ou SVG importé), étirée dans la baie
                    <BlockSvg block={findBlock(hh.blockId)!} view="front" stretch color={paper ? '#111827' : hh.kind === 'door' ? c.door : c.glass} box={{ x: hh.u0, y: -hh.z1, width: hs, height: hh.z1 - hh.z0 }} />
                  )}
                  {hh.kind === 'window' && !s.cut && !findBlock(hh.blockId) && (
                    <>
                      <rect x={hh.u0 + 60} y={-hh.z1 + 60} width={Math.max(hs - 120, 0)} height={hh.z1 - hh.z0 - 120} fill={c.glass} fillOpacity={0.2} stroke={c.glass} strokeWidth={8} />
                      <line x1={(hh.u0 + hh.u1) / 2} y1={-hh.z1 + 60} x2={(hh.u0 + hh.u1) / 2} y2={-hh.z0 - 60} stroke={c.glass} strokeWidth={8} />
                    </>
                  )}
                  {hh.kind === 'door' && !s.cut && !findBlock(hh.blockId) && (
                    <rect x={hh.u0 + 50} y={-hh.z1 + 50} width={Math.max(hs - 100, 0)} height={hh.z1 - hh.z0 - 50} fill={c.door} fillOpacity={0.15} stroke={c.door} strokeWidth={8} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Cotations et niveaux */}
      {showDims && strips.length > 0 && (
        <g fontFamily="JetBrains Mono" fill={c.dim} stroke={c.dim}>
          <line x1={bounds.maxU + 400} y1={0} x2={bounds.maxU + 400} y2={-bounds.maxZ} strokeWidth={10} />
          {levels.map(l => (
            <g key={`lvl-${l.id}`}>
              <line x1={bounds.minU - 400} y1={-l.elevation} x2={bounds.maxU + 550} y2={-l.elevation} strokeWidth={6} strokeDasharray="60 40" opacity={l.id === activeLevelId ? 0.9 : 0.5} />
              <text x={bounds.maxU + 620} y={-l.elevation - 30} fontSize={110} stroke="none">
                {l.name} {l.elevation >= 0 ? '+' : '−'}{(Math.abs(l.elevation) / 1000).toFixed(2)}
              </text>
            </g>
          ))}
          <line x1={bounds.maxU + 250} y1={-bounds.maxZ} x2={bounds.maxU + 550} y2={-bounds.maxZ} strokeWidth={10} />
          <text x={bounds.maxU + 620} y={-bounds.maxZ - 30} fontSize={110} stroke="none">
            +{(bounds.maxZ / 1000).toFixed(2)} (acrotère)
          </text>
          <line x1={bounds.minU} y1={dimY} x2={bounds.maxU} y2={dimY} strokeWidth={10} />
          <line x1={bounds.minU} y1={dimY - 80} x2={bounds.minU} y2={dimY + 80} strokeWidth={10} />
          <line x1={bounds.maxU} y1={dimY - 80} x2={bounds.maxU} y2={dimY + 80} strokeWidth={10} />
          <text x={(bounds.minU + bounds.maxU) / 2} y={dimY - 20} fontSize={130} textAnchor="middle" stroke="none">
            {((bounds.maxU - bounds.minU) / 1000).toFixed(2)} m
          </text>
        </g>
      )}
    </g>
  );
};
