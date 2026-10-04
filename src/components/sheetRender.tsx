import React, { useMemo } from 'react';
import { CadEntity, CadLevel, LayoutItem, LayoutSheet, LayoutShape, LayoutText, LayoutView, LayoutViewport } from '../types.ts';
import { computeWallPolygons, polyToPoints } from '../wallGeometry.ts';
import { buildLevelData, buildViewModel, ViewModel, ViewSpec } from '../viewsGeometry.ts';
import { ElevationDrawing } from './ElevationDrawing.tsx';
import { BlockSvg } from './BlockSvg.tsx';
import { findBlock } from '../blockStore.ts';
import { inferRenderType } from '../blockSymbols.ts';
import { CART_H, MARGIN as DEFAULT_MARGIN, sheetSize } from '../layoutModel.ts';

/**
 * Rendu des planches : dessin d'un plan à l'échelle, cadres de vue (plan / façade / coupe), formes, textes, cartouche.
 * Composants purs, sans interaction : utilisés par l'éditeur de mise en page ET par l'export PDF (rendu statique).
 */

// ───────────────────────────── Dessin d'un plan ─────────────────────────────

export const planBBox = (ents: CadEntity[]) => {
  const xs: number[] = [];
  const ys: number[] = [];
  ents.forEach(e => {
    if (e.type === 'dim' || e.type === 'text') return;
    xs.push(e.x1, e.x2);
    ys.push(e.y1, e.y2);
  });
  if (!xs.length) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

export const PlanDrawing: React.FC<{ entities: CadEntity[]; k: number; scale: number; showRoomNames: boolean }> = ({ entities, k, scale, showRoomNames }) => {
  const wallPolys = useMemo(() => computeWallPolygons(entities.filter(e => e.type === 'wall' || e.type === 'partition')), [entities]);
  const mmPaper = (realMm: number) => realMm / scale;

  const renderEntity = (e: CadEntity) => {
    switch (e.type) {
      case 'room': {
        const x = Math.min(e.x1, e.x2), y = Math.min(e.y1, e.y2);
        const w = Math.abs(e.x2 - e.x1), h = Math.abs(e.y2 - e.y1);
        return (
          <g key={e.id}>
            <rect x={x} y={y} width={w} height={h} fill="#f1f5f9" stroke="none" />
            {showRoomNames && (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize={3.2 / k} fontFamily="JetBrains Mono, monospace" fill="#334155">
                {(e.label || e.name || '').slice(0, 24)}
                {e.area ? ` – ${e.area.toFixed(1)} m²` : ''}
              </text>
            )}
          </g>
        );
      }
      case 'wall':
      case 'partition':
        return wallPolys[e.id] ? (
          <polygon key={e.id} points={polyToPoints(wallPolys[e.id])} fill={e.type === 'wall' ? '#111827' : '#475569'} stroke="none" />
        ) : null;
      case 'door':
      case 'window': {
        const t = mmPaper(e.thickness || 200) / k;
        const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const sweep = (e.doorSwing === 'left') !== !!e.flipSwing ? 0 : 1;
        return (
          <g key={e.id}>
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#ffffff" strokeWidth={t + 0.02 / k} />
            {e.type === 'window' ? (
              <>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#111827" strokeWidth={t * 0.35} />
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#ffffff" strokeWidth={t * 0.15} />
              </>
            ) : (
              <>
                <line x1={e.x1} y1={e.y1} x2={e.x1 + nx * len} y2={e.y1 + ny * len} stroke="#111827" strokeWidth={0.25 / k} />
                <path
                  d={`M ${e.x2} ${e.y2} A ${len} ${len} 0 0 ${sweep} ${e.x1 + nx * len} ${e.y1 + ny * len}`}
                  fill="none"
                  stroke="#111827"
                  strokeWidth={0.15 / k}
                  strokeDasharray={`${1 / k} ${0.8 / k}`}
                />
              </>
            )}
          </g>
        );
      }
      case 'dim':
        return (
          <g key={e.id} stroke="#be185d" strokeWidth={0.18 / k} fill="#be185d">
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
            <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 1 / k} textAnchor="middle" fontSize={2.8 / k} fontFamily="JetBrains Mono, monospace" stroke="none">
              {e.label || `${(Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * 10).toFixed(0)}`}
            </text>
          </g>
        );
      case 'text':
        return (
          <text key={e.id} x={e.x1} y={e.y1} fontSize={e.fontSize || 14} fontFamily="Inter, sans-serif" fill="#111827">
            {(e.label || '').split('\n').map((ln, i) => (
              <tspan key={i} x={e.x1} dy={i === 0 ? 0 : '1.2em'}>{ln}</tspan>
            ))}
          </text>
        );
      case 'rect':
        return <rect key={e.id} x={Math.min(e.x1, e.x2)} y={Math.min(e.y1, e.y2)} width={Math.abs(e.x2 - e.x1)} height={Math.abs(e.y2 - e.y1)} fill="none" stroke="#64748b" strokeWidth={0.2 / k} />;
      case 'circle':
        return <circle key={e.id} cx={e.x1} cy={e.y1} r={e.radius || 0} fill="none" stroke="#64748b" strokeWidth={0.2 / k} />;
      case 'furniture': {
        // symbole du bloc (vue de dessus), en gris pour l'impression
        const w = Math.abs(e.x2 - e.x1), h = Math.abs(e.y2 - e.y1);
        const blk = findBlock(e.blockId) || {
          id: `inferred-${e.id}`, name: e.name, category: 'sejour' as const, widthMm: Math.max(w, 1) * 10, heightMm: Math.max(h, 1) * 10,
          defaultLayer: e.layerId, icon: 'chair', description: '', renderType: inferRenderType(e.name),
        };
        return <BlockSvg key={e.id} block={blk} view="top" stretch color="#475569" box={{ x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), width: w, height: h }} />;
      }
      case 'polygon':
      case 'polyline':
      case 'line': {
        const pts = e.points && e.points.length ? e.points : [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
        const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + (e.isClosed ? ' Z' : '');
        return <path key={e.id} d={d} fill="none" stroke="#64748b" strokeWidth={0.2 / k} />;
      }
      default:
        return null;
    }
  };

  const order = ['room', 'furniture', 'rect', 'circle', 'line', 'polygon', 'polyline', 'curve', 'partition', 'wall', 'window', 'door', 'dim', 'text'];
  const sorted = [...entities].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return <g>{sorted.map(renderEntity)}</g>;
};

export interface Ctx {
  levels: CadLevel[];
  entitiesByLevel: Record<string, CadEntity[]>;
  isLayerVisible: (layerId: string) => boolean;
}

export const viewSpecOf = (v: LayoutView): ViewSpec =>
  v.type === 'section'
    ? { type: 'section', dir: 'S', sectionId: v.id, cutValue: v.pos, flip: v.flip }
    : { type: 'elevation', dir: v.type === 'elevation' ? v.dir : 'S', sectionId: 'AA', cutValue: 0, flip: false };

export const elevBox = (m: ViewModel) => ({
  x0: m.bounds.minU - 600,
  x1: m.bounds.maxU + 3200,
  y0: -(m.bounds.maxZ + 400),
  y1: -m.bounds.minZ + 900,
});

export const ViewportContent = React.memo(
  ({ vp, w, h, ctx }: { vp: Pick<LayoutViewport, 'view' | 'scale'>; w: number; h: number; ctx: Ctx }) => {
    const { view, scale } = vp;
    if (view.type === 'plan') {
      const ents = (ctx.entitiesByLevel[view.levelId] || []).filter(e => ctx.isLayerVisible(e.layerId));
      const bb = planBBox(ents);
      const k = 10 / scale; // mm papier par px plan
      const cx = bb ? (bb.minX + bb.maxX) / 2 : 0;
      const cy = bb ? (bb.minY + bb.maxY) / 2 : 0;
      return (
        <g transform={`translate(${w / 2 - cx * k} ${h / 2 - cy * k}) scale(${k})`}>
          <PlanDrawing entities={ents} k={k} scale={scale} showRoomNames />
        </g>
      );
    }
    const model = buildViewModel(buildLevelData(ctx.levels, ctx.entitiesByLevel, ctx.isLayerVisible), viewSpecOf(view));
    const b = elevBox(model);
    const cu = (b.x0 + b.x1) / 2;
    const cyy = (b.y0 + b.y1) / 2;
    const f = 1 / scale;
    return (
      <g transform={`translate(${w / 2 - cu * f} ${h / 2 - cyy * f}) scale(${f})`}>
        <ElevationDrawing model={model} mode={view.type === 'section' ? 'section' : 'elevation'} paper showDims />
      </g>
    );
  },
  (a, b) =>
    a.vp.view === b.vp.view && a.vp.scale === b.vp.scale && a.w === b.w && a.h === b.h &&
    a.ctx.entitiesByLevel === b.ctx.entitiesByLevel && a.ctx.levels === b.ctx.levels
);

export type Pt = { x: number; y: number };

export const textBox = (t: LayoutText) => {
  const lines = t.text.split('\n');
  const w = Math.max(...lines.map(l => l.length), 1) * t.fontSize * 0.58;
  const h = lines.length * t.fontSize * 1.2;
  const x = t.align === 'middle' ? t.x - w / 2 : t.align === 'end' ? t.x - w : t.x;
  return { x, y: t.y, w, h };
};

export const pointsBox = (pts: Pt[]) => {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(Math.max(...xs) - x, 0.5), h: Math.max(Math.max(...ys) - y, 0.5) };
};

export const itemBox = (i: LayoutItem) =>
  i.kind === 'text' ? textBox(i)
  : i.kind === 'shape' && i.shape === 'polyline' && i.points?.length ? pointsBox(i.points)
  : { x: i.x, y: i.y, w: i.w, h: i.h };

export const dashOf = (d: LayoutShape['dash'], w: number) => (d === 'dashed' ? `${w * 6} ${w * 3}` : d === 'dotted' ? `${w} ${w * 2.5}` : undefined);

/** Tracé SVG d'une ligne brisée, droite ou lissée (courbe passant par les milieux des segments). */
export const polyPath = (pts: Pt[], smooth: boolean, closed: boolean) => {
  if (pts.length < 2) return '';
  if (!smooth || pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '');
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M ${pts[0].x} ${pts[0].y} L ${mid(pts[0], pts[1]).x} ${mid(pts[0], pts[1]).y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += ` Q ${pts[i].x} ${pts[i].y} ${m.x} ${m.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d + (closed ? ' Z' : '');
};

export const FONT_STACK = { sans: 'Inter, sans-serif', mono: 'JetBrains Mono, monospace', serif: 'Georgia, serif' } as const;


// ─────────────────────────────── Planche complète ───────────────────────────────

interface SheetSvgProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  sheet: LayoutSheet;
  ctx: Ctx;
  /** Objet « effectif » (brouillon de glisser-déposer fusionné) ; identité par défaut. */
  eff?: (i: LayoutItem) => LayoutItem;
  /** Éléments d'interface sous le cadre (grille d'aide) et au-dessus des objets (tracé en cours, sélection). */
  underlay?: React.ReactNode;
  overlay?: React.ReactNode;
}

export const SheetSvg = React.forwardRef<SVGSVGElement, SheetSvgProps>(({ sheet, ctx, eff = i => i, underlay, overlay, ...svgProps }, ref) => {
  const { W, H } = sheetSize(sheet);
  const MARGIN = sheet.margin ?? DEFAULT_MARGIN;
  const frameWidth = sheet.frameWidth ?? 0.7;
  const showCartouche = sheet.showCartouche ?? sheet.showFrame;
  const showNorth = sheet.showNorth ?? sheet.showFrame;
  const paperColor = sheet.paperColor ?? '#ffffff';
  const items = sheet.items;
  const cartW = Math.min(180, W - MARGIN * 2);
  const today = new Date().toLocaleDateString('fr-FR');

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} {...svgProps}>
      <rect x={0} y={0} width={W} height={H} fill={paperColor} />
      {underlay}
      {sheet.showFrame && <rect x={MARGIN} y={MARGIN} width={W - MARGIN * 2} height={H - MARGIN * 2} fill="none" stroke="#111827" strokeWidth={frameWidth} />}

          {items.map(raw => {
            const it = eff(raw);
            const r = itemBox(it);
            if (it.kind === 'viewport') {
              return (
                <g key={it.id} data-item-id={it.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={paperColor} />
                  <svg x={r.x} y={r.y} width={r.w} height={r.h} viewBox={`0 0 ${r.w} ${r.h}`} overflow="hidden" style={{ pointerEvents: 'none' }}>
                    <ViewportContent vp={it} w={r.w} h={r.h} ctx={ctx} />
                  </svg>
                  {it.frame && <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#111827" strokeWidth={0.25} style={{ pointerEvents: 'none' }} />}
                  {it.showTitle && (
                    <text x={r.x + r.w / 2} y={r.y + r.h + 5} textAnchor="middle" fontSize={4} fontWeight="bold" fontFamily="JetBrains Mono, monospace" fill="#111827" style={{ pointerEvents: 'none' }}>
                      {it.title}  —  1:{it.scale}
                    </text>
                  )}
                  {/* zone de saisie du cadre entier (le contenu imbriqué ignore la souris) */}
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="transparent" />
                </g>
              );
            }
            if (it.kind === 'shape') {
              const common = {
                stroke: it.stroke, strokeWidth: it.strokeWidth, fill: it.fill, opacity: it.opacity,
                strokeDasharray: dashOf(it.dash, it.strokeWidth), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
              };
              const pts = it.points || [];
              return (
                <g key={it.id} data-item-id={it.id}>
                  {it.shape === 'rect' && <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={it.radius || 0} {...common} />}
                  {it.shape === 'ellipse' && <ellipse cx={it.x + it.w / 2} cy={it.y + it.h / 2} rx={it.w / 2} ry={it.h / 2} {...common} />}
                  {it.shape === 'polyline' && <path d={polyPath(pts, !!it.smooth, !!it.closed)} {...common} fill={it.closed ? it.fill : 'none'} />}
                  {/* zone de saisie élargie (traits fins, formes sans remplissage) */}
                  {it.shape === 'polyline'
                    ? <path d={polyPath(pts, !!it.smooth, !!it.closed)} fill={it.closed ? 'transparent' : 'none'} stroke="transparent" strokeWidth={Math.max(3, it.strokeWidth + 2)} />
                    : <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={it.fill === 'none' ? 'none' : 'transparent'} stroke="transparent" strokeWidth={Math.max(3, it.strokeWidth + 2)} pointerEvents={it.fill === 'none' ? 'stroke' : 'all'} />}
                </g>
              );
            }
            return (
              <g key={it.id} data-item-id={it.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="transparent" />
                <text
                  x={it.x} y={it.y + it.fontSize} textAnchor={it.align} fontSize={it.fontSize}
                  fontWeight={it.bold ? 'bold' : 'normal'} fontStyle={it.italic ? 'italic' : 'normal'}
                  fontFamily={FONT_STACK[it.fontFamily || 'sans']} fill={it.color || '#111827'} style={{ pointerEvents: 'none' }}
                >
                  {it.text.split('\n').map((ln, i) => (
                    <tspan key={i} x={it.x} dy={i === 0 ? 0 : '1.2em'}>{ln}</tspan>
                  ))}
                </text>
              </g>
            );
          })}

      {overlay}

          {showCartouche && (
            <g fontFamily="JetBrains Mono, monospace" stroke="#111827" strokeWidth={0.4} fill="#111827" style={{ pointerEvents: 'none' }}>
              <g transform={`translate(${W - MARGIN - cartW} ${H - MARGIN - CART_H})`}>
                <rect width={cartW} height={CART_H} fill="#ffffff" />
                <line x1={0} y1={CART_H * 0.5} x2={cartW} y2={CART_H * 0.5} />
                <line x1={cartW * 0.62} y1={0} x2={cartW * 0.62} y2={CART_H} />
                <line x1={cartW * 0.62} y1={CART_H * 0.5} x2={cartW} y2={CART_H * 0.5} />
                <g stroke="none">
                  <text x={3} y={5} fontSize={2.6} fill="#64748b">PROJET</text>
                  <text x={3} y={13} fontSize={5} fontWeight="bold">{sheet.project}</text>
                  <text x={3} y={CART_H * 0.5 + 5} fontSize={2.6} fill="#64748b">PLANCHE</text>
                  <text x={3} y={CART_H * 0.5 + 13} fontSize={4} fontWeight="bold">{sheet.title}</text>
                  <text x={cartW * 0.62 + 3} y={5} fontSize={2.6} fill="#64748b">FORMAT · DATE</text>
                  <text x={cartW * 0.62 + 3} y={13} fontSize={4} fontWeight="bold">{sheet.format} · {today}</text>
                  <text x={cartW * 0.62 + 3} y={CART_H * 0.5 + 5} fontSize={2.6} fill="#64748b">N°</text>
                  <text x={cartW * 0.62 + 3} y={CART_H * 0.5 + 12} fontSize={4} fontWeight="bold">{sheet.sheetNo}</text>
                  <text x={cartW * 0.62 + 3} y={CART_H - 2} fontSize={2.4} fill="#64748b">{sheet.author}</text>
                </g>
              </g>
            </g>
          )}
          {showNorth && (
            <g fontFamily="JetBrains Mono, monospace" stroke="#111827" strokeWidth={0.4} fill="#111827" style={{ pointerEvents: 'none' }}>
              <g transform={`translate(${W - MARGIN - 18} ${MARGIN + 22})`}>
                <circle r={7} fill="none" stroke="#111827" strokeWidth={0.3} />
                <polygon points="0,-6 2.5,3 0,1.5 -2.5,3" />
                <text y={-9} textAnchor="middle" fontSize={4} fontWeight="bold" stroke="none">N</text>
              </g>
            </g>
          )}

    </svg>
  );
});
