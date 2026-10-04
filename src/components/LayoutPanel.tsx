import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CadEntity, CadLevel, CadTool, LayoutItem, LayoutSheet, LayoutText, LayoutView, LayoutViewport, SheetFormat,
} from '../types.ts';
import { computeWallPolygons, polyToPoints } from '../wallGeometry.ts';
import { buildLevelData, buildViewModel, DIR_LABEL, Dir, ViewModel, ViewSpec } from '../viewsGeometry.ts';
import { ElevationDrawing } from './ElevationDrawing.tsx';

/**
 * Onglet « Mise en page » : planches (A4…A0) composées de cadres de vue (plans, façades, coupes) à l'échelle,
 * de textes et d'un cartouche. Unités : millimètres papier.
 */

export const FORMATS: Record<SheetFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};
const SCALES = [20, 50, 75, 100, 125, 150, 200, 250, 500];
const MARGIN = 10;
const CART_H = 36;

export const sheetSize = (s: Pick<LayoutSheet, 'format' | 'landscape'>) => {
  const [pw, ph] = FORMATS[s.format];
  return s.landscape ? { W: ph, H: pw } : { W: pw, H: ph };
};

let uid = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}${(uid++).toString(36)}`;

/** Planche par défaut : un cadre de plan (niveau donné) occupant la zone de dessin. */
export const createSheet = (name: string, levelId: string, scale = 50): LayoutSheet => {
  const base: LayoutSheet = {
    id: newId('sheet'),
    name,
    format: 'A3',
    landscape: true,
    project: 'Villa Horizon',
    title: name,
    author: '',
    sheetNo: 'A-01',
    showFrame: true,
    items: [],
  };
  const { W, H } = sheetSize(base);
  base.items.push({
    kind: 'viewport',
    id: newId('vp'),
    x: MARGIN + 5,
    y: MARGIN + 5,
    w: W - MARGIN * 2 - 10,
    h: H - MARGIN * 2 - CART_H - 16,
    view: { type: 'plan', levelId },
    scale,
    title: name,
    showTitle: true,
    frame: false,
  });
  return base;
};

// ───────────────────────────── Dessin d'un plan ─────────────────────────────

const planBBox = (ents: CadEntity[]) => {
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

const PlanDrawing: React.FC<{ entities: CadEntity[]; k: number; scale: number; showRoomNames: boolean }> = ({ entities, k, scale, showRoomNames }) => {
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
      case 'furniture':
        return <rect key={e.id} x={Math.min(e.x1, e.x2)} y={Math.min(e.y1, e.y2)} width={Math.abs(e.x2 - e.x1)} height={Math.abs(e.y2 - e.y1)} fill="none" stroke="#7c3aed" strokeWidth={0.2 / k} />;
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

// ──────────────────────── Contenu d'un cadre de vue ────────────────────────

interface Ctx {
  levels: CadLevel[];
  entitiesByLevel: Record<string, CadEntity[]>;
  isLayerVisible: (layerId: string) => boolean;
}

const viewSpecOf = (v: LayoutView): ViewSpec =>
  v.type === 'section'
    ? { type: 'section', dir: 'S', sectionId: v.id, cutValue: v.pos, flip: v.flip }
    : { type: 'elevation', dir: v.type === 'elevation' ? v.dir : 'S', sectionId: 'AA', cutValue: 0, flip: false };

const elevBox = (m: ViewModel) => ({
  x0: m.bounds.minU - 600,
  x1: m.bounds.maxU + 3200,
  y0: -(m.bounds.maxZ + 400),
  y1: -m.bounds.minZ + 900,
});

/** Boîte englobante du contenu en mm RÉELS (pour choisir l'échelle). */
const contentBoxMm = (ctx: Ctx, view: LayoutView) => {
  if (view.type === 'plan') {
    const bb = planBBox((ctx.entitiesByLevel[view.levelId] || []).filter(e => ctx.isLayerVisible(e.layerId)));
    if (!bb) return { x0: 0, y0: 0, x1: 8000, y1: 6000 };
    return { x0: bb.minX * 10, y0: bb.minY * 10, x1: bb.maxX * 10, y1: bb.maxY * 10 };
  }
  const model = buildViewModel(buildLevelData(ctx.levels, ctx.entitiesByLevel, ctx.isLayerVisible), viewSpecOf(view));
  return elevBox(model);
};

export const fitScale = (ctx: Ctx, view: LayoutView, w: number, h: number) => {
  const b = contentBoxMm(ctx, view);
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  return SCALES.find(s => bw / s <= w - 6 && bh / s <= h - 6) ?? SCALES[SCALES.length - 1];
};

const ViewportContent = React.memo(
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

const viewLabel = (v: LayoutView, levels: CadLevel[]) =>
  v.type === 'plan'
    ? `Plan ${levels.find(l => l.id === v.levelId)?.name ?? ''}`
    : v.type === 'elevation'
      ? DIR_LABEL[v.dir]
      : `Coupe ${v.id}-${v.id}`;

// ─────────────────────────────── Panneau ────────────────────────────────

interface LayoutPanelProps extends Ctx {
  activeLevelId: string;
  sheets: LayoutSheet[];
  setSheets: React.Dispatch<React.SetStateAction<LayoutSheet[]>>;
  activeSheetId: string;
  setActiveSheetId: (id: string) => void;
  activeTool: CadTool;
  setActiveTool: (t: CadTool) => void;
  onBackToPlan: () => void;
}

const textBox = (t: LayoutText) => {
  const lines = t.text.split('\n');
  const w = Math.max(...lines.map(l => l.length), 1) * t.fontSize * 0.58;
  const h = lines.length * t.fontSize * 1.2;
  const x = t.align === 'middle' ? t.x - w / 2 : t.align === 'end' ? t.x - w : t.x;
  return { x, y: t.y, w, h };
};

export const LayoutPanel: React.FC<LayoutPanelProps> = ({
  levels, entitiesByLevel, isLayerVisible, activeLevelId, sheets, setSheets, activeSheetId, setActiveSheetId, activeTool, setActiveTool, onBackToPlan,
}) => {
  const sheet = sheets.find(s => s.id === activeSheetId) || sheets[0];
  const { W, H } = sheetSize(sheet);
  const ctx: Ctx = { levels, entitiesByLevel, isLayerVisible };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<null | { id: string; rect: { x: number; y: number; w: number; h: number } }>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const today = new Date().toLocaleDateString('fr-FR');
  const cartW = Math.min(180, W - MARGIN * 2);

  const patchSheet = (patch: Partial<LayoutSheet>) => setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, ...patch } : s)));
  const patchItem = (id: string, patch: Partial<LayoutViewport> | Partial<LayoutText>) =>
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: s.items.map(i => (i.id === id ? ({ ...i, ...patch } as LayoutItem) : i)) } : s)));
  const addItem = (item: LayoutItem) => {
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: [...s.items, item] } : s)));
    setSelectedId(item.id);
  };
  const removeItem = (id: string) => {
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: s.items.filter(i => i.id !== id) } : s)));
    setSelectedId(null);
  };

  useEffect(() => { setSelectedId(null); }, [activeSheetId]);

  // Suppression au clavier (hors champs de saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeItem(selectedId);
      }
      if (e.key === 'Escape') { setSelectedId(null); setActiveTool('select'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const items = sheet.items;
  const selected = items.find(i => i.id === selectedId) || null;
  const rectOf = (i: LayoutItem) => (drag && drag.id === i.id ? drag.rect : i.kind === 'viewport' ? { x: i.x, y: i.y, w: i.w, h: i.h } : textBox(i));

  const toPaper = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const snap = (v: number) => Math.round(v * 2) / 2;

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const p = toPaper(e);
    const target = e.target as Element;

    // Outil texte : pose d'un texte
    if (activeTool === 'text') {
      const t: LayoutText = { kind: 'text', id: newId('txt'), x: snap(p.x), y: snap(p.y), text: 'Texte', fontSize: 5, bold: false, align: 'start' };
      addItem(t);
      setActiveTool('select');
      return;
    }

    const handle = target.closest('[data-handle]');
    const hit = target.closest('[data-item-id]');
    if (!hit) { setSelectedId(null); return; }
    const id = hit.getAttribute('data-item-id')!;
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSelectedId(id);
    const start = rectOf(item);
    const mode = handle ? 'resize' : 'move';
    const onMove = (ev: MouseEvent) => {
      const q = toPaper(ev);
      const dx = q.x - p.x, dy = q.y - p.y;
      if (mode === 'move') setDrag({ id, rect: { ...start, x: snap(start.x + dx), y: snap(start.y + dy) } });
      else setDrag({ id, rect: { ...start, w: Math.max(20, snap(start.w + dx)), h: Math.max(15, snap(start.h + dy)) } });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const q = toPaper(ev);
      const dx = q.x - p.x, dy = q.y - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.2) {
        if (item.kind === 'viewport') {
          if (mode === 'move') patchItem(id, { x: snap(start.x + dx), y: snap(start.y + dy) });
          else patchItem(id, { w: Math.max(20, snap(start.w + dx)), h: Math.max(15, snap(start.h + dy)) });
        } else {
          patchItem(id, { x: snap(item.x + dx), y: snap(item.y + dy) });
        }
      }
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = (e.target as Element).closest('[data-item-id]');
    if (!hit) return;
    const item = items.find(i => i.id === hit.getAttribute('data-item-id'));
    if (item?.kind === 'text') {
      const v = window.prompt('Texte :', item.text);
      if (v !== null) patchItem(item.id, { text: v });
    }
  };

  // ── Ajout de cadres de vue ──
  const planBounds = useMemo(() => {
    const bb = planBBox(Object.values(entitiesByLevel).flat());
    return bb || { minX: 0, maxX: 800, minY: 0, maxY: 600 };
  }, [entitiesByLevel]);

  const addViewport = (view: LayoutView) => {
    const w = Math.min(160, W - MARGIN * 2 - 10), h = Math.min(100, H - MARGIN * 2 - CART_H - 20);
    const vp: LayoutViewport = {
      kind: 'viewport', id: newId('vp'), x: MARGIN + 8, y: MARGIN + 8, w, h, view, scale: 100,
      title: viewLabel(view, levels), showTitle: true, frame: true,
    };
    vp.scale = fitScale(ctx, view, w, h);
    addItem(vp);
  };

  const field = 'bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 font-mono text-[11px] text-on-surface w-full outline-none focus:border-primary/60';
  const lbl = 'font-mono text-[10px] text-outline flex flex-col gap-1';
  const btn = 'px-2 py-1.5 rounded border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-primary font-mono text-[10px] flex items-center justify-center gap-1';

  const printSheet = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-ui]').forEach(n => n.remove());
    clone.removeAttribute('style');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><head><title>${sheet.title}</title><style>@page{size:${W}mm ${H}mm;margin:0}body{margin:0}svg{width:${W}mm;height:${H}mm;display:block}</style></head><body>${clone.outerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const numField = (value: number, onChange: (v: number) => void, step = 1) => (
    <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))} className={field} />
  );

  return (
    <div className="absolute inset-0 flex select-none bg-[#0a141f]">
      <div className="w-72 flex-none border-r border-outline-variant/20 bg-surface-container-lowest/80 p-3 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[18px]">grid_view</span>
          <span className="font-mono text-xs font-bold tracking-wide">MISE EN PAGE</span>
        </div>

        {/* Planches */}
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[10px] text-outline flex items-center justify-between">
            PLANCHES
            <span className="flex gap-1">
              <button
                onClick={() => { const s = createSheet(`Planche ${sheets.length + 1}`, activeLevelId); s.items = []; setSheets(prev => [...prev, s]); setActiveSheetId(s.id); }}
                className="material-symbols-outlined text-[16px] hover:text-primary" title="Nouvelle planche vide"
              >add</button>
              <button
                onClick={() => {
                  const copy: LayoutSheet = { ...sheet, id: newId('sheet'), name: `${sheet.name} (copie)`, items: sheet.items.map(i => ({ ...i, id: newId('it') })) };
                  setSheets(prev => [...prev, copy]); setActiveSheetId(copy.id);
                }}
                className="material-symbols-outlined text-[15px] hover:text-primary" title="Dupliquer la planche"
              >content_copy</button>
              <button
                onClick={() => { if (sheets.length <= 1) return; const rest = sheets.filter(s => s.id !== sheet.id); setSheets(rest); setActiveSheetId(rest[0].id); }}
                disabled={sheets.length <= 1}
                className="material-symbols-outlined text-[15px] hover:text-error disabled:opacity-30" title="Supprimer la planche"
              >delete</button>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {sheets.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSheetId(s.id)}
                className={`px-2 py-1 rounded border font-mono text-[10px] text-left flex items-center gap-2 ${
                  s.id === sheet.id ? 'bg-primary/15 border-primary/50 text-primary font-bold' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">description</span>
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-outline">{s.format}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ajout */}
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[10px] text-outline">AJOUTER UN CADRE DE VUE</div>
          <div className="grid grid-cols-2 gap-1">
            <select value="" onChange={e => { if (e.target.value) addViewport({ type: 'plan', levelId: e.target.value }); }} className={field}>
              <option value="">+ Plan…</option>
              {[...levels].sort((a, b) => b.elevation - a.elevation).map(l => <option key={l.id} value={l.id}>Plan {l.name}</option>)}
            </select>
            <select value="" onChange={e => { if (e.target.value) addViewport({ type: 'elevation', dir: e.target.value as Dir }); }} className={field}>
              <option value="">+ Façade…</option>
              {(['S', 'N', 'E', 'O'] as Dir[]).map(d => <option key={d} value={d}>{DIR_LABEL[d]}</option>)}
            </select>
            <button onClick={() => addViewport({ type: 'section', id: 'AA', pos: (planBounds.minY + planBounds.maxY) / 2, flip: false })} className={btn}>
              <span className="material-symbols-outlined text-[14px]">content_cut</span> Coupe AA
            </button>
            <button onClick={() => addViewport({ type: 'section', id: 'BB', pos: (planBounds.minX + planBounds.maxX) / 2, flip: false })} className={btn}>
              <span className="material-symbols-outlined text-[14px]">content_cut</span> Coupe BB
            </button>
          </div>
          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
            className={`${btn} ${activeTool === 'text' ? '!bg-primary/20 !text-primary !border-primary/50' : ''}`}
          >
            <span className="material-symbols-outlined text-[14px]">title</span>
            {activeTool === 'text' ? 'Cliquez sur la planche…' : 'Ajouter un texte (T)'}
          </button>
        </div>

        {/* Propriétés de l'élément sélectionné */}
        {selected && selected.kind === 'viewport' && (
          <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-2">
            <div className="font-mono text-[10px] text-primary font-bold flex items-center justify-between">
              CADRE DE VUE
              <button onClick={() => removeItem(selected.id)} className="material-symbols-outlined text-[16px] text-outline hover:text-error" title="Supprimer (Suppr)">delete</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={lbl}>
                Type
                <select
                  value={selected.view.type}
                  onChange={e => {
                    const t = e.target.value;
                    const view: LayoutView =
                      t === 'plan' ? { type: 'plan', levelId: activeLevelId }
                      : t === 'elevation' ? { type: 'elevation', dir: 'S' }
                      : { type: 'section', id: 'AA', pos: (planBounds.minY + planBounds.maxY) / 2, flip: false };
                    patchItem(selected.id, { view, title: viewLabel(view, levels) });
                  }}
                  className={field}
                >
                  <option value="plan">Plan</option>
                  <option value="elevation">Façade</option>
                  <option value="section">Coupe</option>
                </select>
              </label>
              {selected.view.type === 'plan' && (
                <label className={lbl}>
                  Niveau
                  <select
                    value={selected.view.levelId}
                    onChange={e => { const view: LayoutView = { type: 'plan', levelId: e.target.value }; patchItem(selected.id, { view, title: viewLabel(view, levels) }); }}
                    className={field}
                  >
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
              )}
              {selected.view.type === 'elevation' && (
                <label className={lbl}>
                  Orientation
                  <select
                    value={selected.view.dir}
                    onChange={e => { const view: LayoutView = { type: 'elevation', dir: e.target.value as Dir }; patchItem(selected.id, { view, title: viewLabel(view, levels) }); }}
                    className={field}
                  >
                    {(['S', 'N', 'E', 'O'] as Dir[]).map(d => <option key={d} value={d}>{DIR_LABEL[d]}</option>)}
                  </select>
                </label>
              )}
              {selected.view.type === 'section' && (
                <label className={lbl}>
                  Coupe
                  <select
                    value={selected.view.id}
                    onChange={e => {
                      const id = e.target.value as 'AA' | 'BB';
                      const pos = id === 'AA' ? (planBounds.minY + planBounds.maxY) / 2 : (planBounds.minX + planBounds.maxX) / 2;
                      const view: LayoutView = { type: 'section', id, pos, flip: false };
                      patchItem(selected.id, { view, title: viewLabel(view, levels) });
                    }}
                    className={field}
                  >
                    <option value="AA">AA (longitudinale)</option>
                    <option value="BB">BB (transversale)</option>
                  </select>
                </label>
              )}
            </div>
            {selected.view.type === 'section' && (() => {
              const v = selected.view;
              const min = v.id === 'AA' ? planBounds.minY : planBounds.minX;
              const max = v.id === 'AA' ? planBounds.maxY : planBounds.maxX;
              return (
                <div className="flex flex-col gap-1">
                  <label className={lbl}>
                    Position : <span className="text-primary">{((v.pos * 10) / 1000).toFixed(2)} m</span>
                    <input type="range" min={min} max={max} step={5} value={v.pos} onChange={e => patchItem(selected.id, { view: { ...v, pos: Number(e.target.value) } })} className="w-full accent-[#ffb95f]" />
                  </label>
                  <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                    <input type="checkbox" checked={v.flip} onChange={e => patchItem(selected.id, { view: { ...v, flip: e.target.checked } })} className="accent-[#4cd7f6]" />
                    Inverser le sens du regard
                  </label>
                </div>
              );
            })()}
            <div className="flex gap-1 items-end">
              <label className={`${lbl} flex-1`}>
                Échelle
                <select value={selected.scale} onChange={e => patchItem(selected.id, { scale: Number(e.target.value) })} className={field}>
                  {(SCALES.includes(selected.scale) ? SCALES : [...SCALES, selected.scale].sort((a, b) => a - b)).map(s => <option key={s} value={s}>1:{s}</option>)}
                </select>
              </label>
              <button onClick={() => patchItem(selected.id, { scale: fitScale(ctx, selected.view, selected.w, selected.h) })} className={btn} title="Plus grande échelle qui tient dans le cadre">Auto</button>
            </div>
            <label className={lbl}>
              Titre
              <input value={selected.title} onChange={e => patchItem(selected.id, { title: e.target.value })} className={field} />
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={selected.showTitle} onChange={e => patchItem(selected.id, { showTitle: e.target.checked })} className="accent-[#4cd7f6]" /> Titre
              </label>
              <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={selected.frame} onChange={e => patchItem(selected.id, { frame: e.target.checked })} className="accent-[#4cd7f6]" /> Cadre
              </label>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <label className={lbl}>X{numField(selected.x, v => patchItem(selected.id, { x: v }))}</label>
              <label className={lbl}>Y{numField(selected.y, v => patchItem(selected.id, { y: v }))}</label>
              <label className={lbl}>L{numField(selected.w, v => patchItem(selected.id, { w: Math.max(20, v) }))}</label>
              <label className={lbl}>H{numField(selected.h, v => patchItem(selected.id, { h: Math.max(15, v) }))}</label>
            </div>
          </div>
        )}

        {selected && selected.kind === 'text' && (
          <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-2">
            <div className="font-mono text-[10px] text-primary font-bold flex items-center justify-between">
              TEXTE
              <button onClick={() => removeItem(selected.id)} className="material-symbols-outlined text-[16px] text-outline hover:text-error" title="Supprimer (Suppr)">delete</button>
            </div>
            <textarea value={selected.text} onChange={e => patchItem(selected.id, { text: e.target.value })} rows={3} className={`${field} resize-y`} />
            <div className="grid grid-cols-2 gap-2">
              <label className={lbl}>Hauteur (mm){numField(selected.fontSize, v => patchItem(selected.id, { fontSize: Math.max(1, v) }), 0.5)}</label>
              <div className={lbl}>
                Alignement
                <div className="flex gap-1">
                  {([['start', 'format_align_left'], ['middle', 'format_align_center'], ['end', 'format_align_right']] as const).map(([a, ic]) => (
                    <button key={a} onClick={() => patchItem(selected.id, { align: a })} className={`${btn} flex-1 ${selected.align === a ? '!bg-primary/20 !text-primary' : ''}`}>
                      <span className="material-symbols-outlined text-[14px]">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
              <input type="checkbox" checked={selected.bold} onChange={e => patchItem(selected.id, { bold: e.target.checked })} className="accent-[#4cd7f6]" /> Gras
            </label>
            <div className="grid grid-cols-2 gap-1">
              <label className={lbl}>X{numField(selected.x, v => patchItem(selected.id, { x: v }), 0.5)}</label>
              <label className={lbl}>Y{numField(selected.y, v => patchItem(selected.id, { y: v }), 0.5)}</label>
            </div>
          </div>
        )}

        {/* Réglages de la planche */}
        <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-2">
          <div className="font-mono text-[10px] text-outline">PLANCHE</div>
          <input value={sheet.name} onChange={e => patchSheet({ name: e.target.value })} placeholder="Nom de la planche" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl}>
              Format
              <select value={sheet.format} onChange={e => patchSheet({ format: e.target.value as SheetFormat })} className={field}>
                {(Object.keys(FORMATS) as SheetFormat[]).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className={lbl}>
              Orientation
              <select value={sheet.landscape ? 'p' : 'v'} onChange={e => patchSheet({ landscape: e.target.value === 'p' })} className={field}>
                <option value="p">Paysage</option>
                <option value="v">Portrait</option>
              </select>
            </label>
          </div>
          <div className="font-mono text-[10px] text-outline">CARTOUCHE</div>
          <input value={sheet.project} onChange={e => patchSheet({ project: e.target.value })} placeholder="Projet" className={field} />
          <input value={sheet.title} onChange={e => patchSheet({ title: e.target.value })} placeholder="Titre de la planche" className={field} />
          <input value={sheet.author} onChange={e => patchSheet({ author: e.target.value })} placeholder="Dessinateur / Architecte" className={field} />
          <input value={sheet.sheetNo} onChange={e => patchSheet({ sheetNo: e.target.value })} placeholder="N° de planche" className={field} />
          <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={sheet.showFrame} onChange={e => patchSheet({ showFrame: e.target.checked })} className="accent-[#4cd7f6]" /> Cadre &amp; cartouche
          </label>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <button onClick={printSheet} className="px-3 py-2 bg-primary-container hover:bg-primary text-on-primary-container rounded font-mono text-[11px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-95">
            <span className="material-symbols-outlined text-[15px]">print</span>
            Imprimer / PDF
          </button>
          <button onClick={onBackToPlan} className="px-3 py-2 border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high rounded font-mono text-[11px] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            Revenir au Plan 2D
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto p-6">
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-surface-container-lowest/90 rounded border border-outline-variant/30 p-0.5">
          <button onClick={() => setZoom(z => Math.max(0.4, z / 1.25))} className="px-2 text-on-surface-variant hover:text-primary font-mono">−</button>
          <span className="font-mono text-[10px] text-outline w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z * 1.25))} className="px-2 text-on-surface-variant hover:text-primary font-mono">+</button>
        </div>

        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: `${zoom * 100}%`, maxWidth: zoom * 1100, aspectRatio: `${W} / ${H}`, cursor: activeTool === 'text' ? 'text' : 'default' }}
          className="mx-auto bg-white shadow-2xl block"
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
        >
          <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
          {sheet.showFrame && <rect x={MARGIN} y={MARGIN} width={W - MARGIN * 2} height={H - MARGIN * 2} fill="none" stroke="#111827" strokeWidth={0.7} />}

          {items.map(it => {
            const r = rectOf(it);
            if (it.kind === 'viewport') {
              return (
                <g key={it.id} data-item-id={it.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#ffffff" />
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
            return (
              <g key={it.id} data-item-id={it.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="transparent" />
                <text x={it.x} y={it.y + it.fontSize} textAnchor={it.align} fontSize={it.fontSize} fontWeight={it.bold ? 'bold' : 'normal'} fontFamily="Inter, sans-serif" fill="#111827" style={{ pointerEvents: 'none' }}>
                  {it.text.split('\n').map((ln, i) => (
                    <tspan key={i} x={it.x} dy={i === 0 ? 0 : '1.2em'}>{ln}</tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* Sélection (non imprimée) */}
          {selected && (() => {
            const r = rectOf(selected);
            return (
              <g data-ui="1">
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#2563eb" strokeWidth={0.4} strokeDasharray="2 1.2" style={{ pointerEvents: 'none' }} />
                {selected.kind === 'viewport' && (
                  <g data-item-id={selected.id}>
                    <rect data-handle="se" x={r.x + r.w - 2} y={r.y + r.h - 2} width={4} height={4} fill="#2563eb" stroke="#ffffff" strokeWidth={0.4} style={{ cursor: 'nwse-resize' }} />
                  </g>
                )}
              </g>
            );
          })()}

          {sheet.showFrame && (
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
              <g transform={`translate(${W - MARGIN - 18} ${MARGIN + 22})`}>
                <circle r={7} fill="none" stroke="#111827" strokeWidth={0.3} />
                <polygon points="0,-6 2.5,3 0,1.5 -2.5,3" />
                <text y={-9} textAnchor="middle" fontSize={4} fontWeight="bold" stroke="none">N</text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
