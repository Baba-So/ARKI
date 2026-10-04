import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CadEntity, CadLevel, CadTool, LayoutItem, LayoutSheet, LayoutShape, LayoutText, LayoutView, LayoutViewport, PolylineSubTool, SheetFormat, ShapeSubTool,
} from '../types.ts';
import { computeWallPolygons, polyToPoints } from '../wallGeometry.ts';
import { buildLevelData, buildViewModel, DIR_LABEL, Dir, ViewModel, ViewSpec } from '../viewsGeometry.ts';
import { ElevationDrawing } from './ElevationDrawing.tsx';
import { FORMATS, SCALES, MARGIN, CART_H, sheetSize, createSheet, newId } from '../layoutModel.ts';
import { Ctx, FONT_STACK, Pt, SheetSvg, ViewportContent, dashOf, elevBox, itemBox, planBBox, polyPath, textBox, viewSpecOf } from './sheetRender.tsx';

/**
 * Onglet « Mise en page » : planches (A4…A0) composées de cadres de vue (plans, façades, coupes) à l'échelle,
 * de textes et d'un cartouche. Unités : millimètres papier.
 */

export { FORMATS, sheetSize, createSheet };

// ──────────────────────── Contenu d'un cadre de vue ────────────────────────

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
  shapeSubTool: ShapeSubTool;
  setShapeSubTool: (t: ShapeSubTool) => void;
  polylineSubTool: PolylineSubTool;
  setPolylineSubTool: (t: PolylineSubTool) => void;
  onBackToPlan: () => void;
}

const SWATCHES = ['#111827', '#ffffff', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0284c7', '#7c3aed', '#64748b'];
type Draft =
  | { kind: 'box'; shape: 'rect' | 'ellipse'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'poly'; points: Pt[]; smooth: boolean }
  | { kind: 'free'; points: Pt[] };

export const LayoutPanel: React.FC<LayoutPanelProps> = ({
  levels, entitiesByLevel, isLayerVisible, activeLevelId, sheets, setSheets, activeSheetId, setActiveSheetId, activeTool, setActiveTool,
  shapeSubTool, setShapeSubTool, polylineSubTool, setPolylineSubTool, onBackToPlan,
}) => {
  const sheet = sheets.find(s => s.id === activeSheetId) || sheets[0];
  const { W, H } = sheetSize(sheet);
  const ctx: Ctx = { levels, entitiesByLevel, isLayerVisible };
  // Personnalisation de la planche (valeurs par défaut si non renseignées)
  const MARGIN = sheet.margin ?? 10;
  const frameWidth = sheet.frameWidth ?? 0.7;
  const showCartouche = sheet.showCartouche ?? sheet.showFrame;
  const showNorth = sheet.showNorth ?? sheet.showFrame;
  const paperColor = sheet.paperColor ?? '#ffffff';
  const gridMm = sheet.gridMm ?? 0.5;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<null | { id: string; patch: Partial<LayoutItem> }>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [polygonMode, setPolygonMode] = useState(false);
  const [defStyle, setDefStyle] = useState<Pick<LayoutShape, 'stroke' | 'strokeWidth' | 'fill' | 'opacity' | 'dash'>>({
    stroke: '#111827', strokeWidth: 0.35, fill: 'none', opacity: 1, dash: 'solid',
  });
  const svgRef = useRef<SVGSVGElement>(null);

  const today = new Date().toLocaleDateString('fr-FR');
  const cartW = Math.min(180, W - MARGIN * 2);

  const patchSheet = (patch: Partial<LayoutSheet>) => setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, ...patch } : s)));
  const patchItem = (id: string, patch: Partial<LayoutViewport> | Partial<LayoutText> | Partial<LayoutShape>) =>
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: s.items.map(i => (i.id === id ? ({ ...i, ...patch } as LayoutItem) : i)) } : s)));
  const addItem = (item: LayoutItem) => {
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: [...s.items, item] } : s)));
    setSelectedId(item.id);
  };
  const removeItem = (id: string) => {
    setSheets(prev => prev.map(s => (s.id === sheet.id ? { ...s, items: s.items.filter(i => i.id !== id) } : s)));
    setSelectedId(null);
  };
  /** Ordre d'empilement : +1 = vers le premier plan, −1 = vers l'arrière-plan. */
  const reorderItem = (id: string, dir: 1 | -1) =>
    setSheets(prev => prev.map(s => {
      if (s.id !== sheet.id) return s;
      const i = s.items.findIndex(x => x.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= s.items.length) return s;
      const items = [...s.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...s, items };
    }));
  const duplicateItem = (it: LayoutItem) => {
    const c = { ...it, id: newId('it') } as LayoutItem;
    if (c.kind === 'shape' && c.points) {
      c.points = c.points.map(p => ({ x: p.x + 5, y: p.y + 5 }));
    } else {
      c.x += 5;
      c.y += 5;
    }
    addItem(c);
  };

  useEffect(() => { setSelectedId(null); setDraft(null); }, [activeSheetId]);
  useEffect(() => { if (activeTool !== 'rect' && activeTool !== 'polyline') setDraft(null); }, [activeTool]);

  const items = sheet.items;
  const eff = (i: LayoutItem) => (drag && drag.id === i.id ? ({ ...i, ...drag.patch } as LayoutItem) : i);
  const selectedRaw = items.find(i => i.id === selectedId) || null;
  const selected = selectedRaw ? eff(selectedRaw) : null;

  const toPaper = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const snap = (v: number) => Math.round(v / gridMm) * gridMm;
  const snapPt = (p: Pt): Pt => ({ x: snap(p.x), y: snap(p.y) });

  const newShape = (partial: Partial<LayoutShape> & Pick<LayoutShape, 'shape'>): LayoutShape => ({
    kind: 'shape', id: newId('sh'), x: 0, y: 0, w: 0, h: 0, ...defStyle, ...partial,
  });

  /** Termine une ligne brisée en cours : fermée = polygone. */
  const finishPoly = (close: boolean) => {
    if (!draft || draft.kind !== 'poly') return;
    const pts = draft.points.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 0.4);
    setDraft(null);
    if (pts.length < 2) return;
    const closed = close && pts.length >= 3;
    addItem(newShape({ shape: 'polyline', points: pts, closed, smooth: draft.smooth, fill: closed ? defStyle.fill : 'none' }));
    setActiveTool('select');
  };

  // Clavier : Suppr, Échap, Entrée (hors champs de saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !draft) {
        e.preventDefault();
        removeItem(selectedId);
      }
      if (e.key === 'Enter' && draft?.kind === 'poly') { e.preventDefault(); finishPoly(polygonMode); }
      if (e.key === 'Escape') {
        if (draft) setDraft(null);
        else { setSelectedId(null); setActiveTool('select'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onMouseMove = (e: React.MouseEvent) => {
    if (draft?.kind === 'poly') setCursor(snapPt(toPaper(e)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const p = toPaper(e);
    const sp = snapPt(p);
    const target = e.target as Element;

    // ── Outil texte
    if (activeTool === 'text') {
      addItem({ kind: 'text', id: newId('txt'), x: sp.x, y: sp.y, text: 'Texte', fontSize: 5, bold: false, align: 'start' });
      setActiveTool('select');
      return;
    }

    // ── Outil forme : rectangle / ellipse (glisser)
    if (activeTool === 'rect') {
      const shape = shapeSubTool === 'circle' ? 'ellipse' : 'rect';
      setDraft({ kind: 'box', shape, x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y });
      const onMove = (ev: MouseEvent) => {
        const q = snapPt(toPaper(ev));
        setDraft(d => (d && d.kind === 'box' ? { ...d, x1: q.x, y1: q.y } : d));
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const q = snapPt(toPaper(ev));
        const w = Math.abs(q.x - sp.x), h = Math.abs(q.y - sp.y);
        setDraft(null);
        if (w >= 1 && h >= 1) {
          addItem(newShape({ shape, x: Math.min(sp.x, q.x), y: Math.min(sp.y, q.y), w, h }));
          setActiveTool('select');
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    // ── Outil tracé : main levée (glisser) ou ligne brisée / polygone / courbe (clics)
    if (activeTool === 'polyline') {
      if (polylineSubTool === 'freehand') {
        setDraft({ kind: 'free', points: [sp] });
        const onMove = (ev: MouseEvent) => {
          const q = toPaper(ev);
          setDraft(d => {
            if (!d || d.kind !== 'free') return d;
            const last = d.points[d.points.length - 1];
            return Math.hypot(q.x - last.x, q.y - last.y) >= 0.8 ? { ...d, points: [...d.points, { x: q.x, y: q.y }] } : d;
          });
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          setDraft(d => {
            if (d && d.kind === 'free' && d.points.length >= 2) {
              addItem(newShape({ shape: 'polyline', points: d.points, smooth: true, fill: 'none' }));
              setActiveTool('select');
            }
            return null;
          });
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return;
      }
      if (draft?.kind === 'poly') {
        const first = draft.points[0];
        if (draft.points.length >= 3 && Math.hypot(sp.x - first.x, sp.y - first.y) < 2.5) {
          finishPoly(true); // clic sur le premier point : on ferme
          return;
        }
        setDraft({ ...draft, points: [...draft.points, sp] });
      } else {
        setDraft({ kind: 'poly', points: [sp], smooth: polylineSubTool === 'curve' });
        setCursor(sp);
      }
      return;
    }

    // ── Sélection / déplacement / redimensionnement / sommets
    const handle = target.closest('[data-handle]');
    const hit = target.closest('[data-item-id]');
    if (!hit) { setSelectedId(null); return; }
    const id = hit.getAttribute('data-item-id')!;
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSelectedId(id);
    const hv = handle?.getAttribute('data-handle') || '';
    const mode: 'move' | 'resize' | 'vertex' = hv === 'se' ? 'resize' : hv.startsWith('v') ? 'vertex' : 'move';
    const vIdx = hv.startsWith('v') ? Number(hv.slice(1)) : -1;
    const minW = item.kind === 'viewport' ? 20 : 1, minH = item.kind === 'viewport' ? 15 : 1;

    const patchFor = (dx: number, dy: number): Partial<LayoutItem> => {
      if (mode === 'resize' && item.kind !== 'text') return { w: Math.max(minW, snap(item.w + dx)), h: Math.max(minH, snap(item.h + dy)) } as Partial<LayoutItem>;
      if (mode === 'vertex' && item.kind === 'shape' && item.points) {
        return { points: item.points.map((pt, i) => (i === vIdx ? { x: snap(pt.x + dx), y: snap(pt.y + dy) } : pt)) } as Partial<LayoutItem>;
      }
      if (item.kind === 'shape' && item.shape === 'polyline' && item.points) {
        return { points: item.points.map(pt => ({ x: snap(pt.x + dx), y: snap(pt.y + dy) })) } as Partial<LayoutItem>;
      }
      return { x: snap(item.x + dx), y: snap(item.y + dy) } as Partial<LayoutItem>;
    };

    const onMove = (ev: MouseEvent) => {
      const q = toPaper(ev);
      setDrag({ id, patch: patchFor(q.x - p.x, q.y - p.y) });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const q = toPaper(ev);
      const dx = q.x - p.x, dy = q.y - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.2) patchItem(id, patchFor(dx, dy) as Partial<LayoutShape>);
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (draft?.kind === 'poly') { finishPoly(polygonMode); return; }
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

  /** Contrôles de style (trait, remplissage, opacité, pointillé) partagés par les formes et le style par défaut. */
  type ShapeStyle = Pick<LayoutShape, 'stroke' | 'strokeWidth' | 'fill' | 'opacity' | 'dash'>;
  const styleControls = (st: ShapeStyle, onChange: (patch: Partial<ShapeStyle>) => void) => (
    <div className="flex flex-col gap-2">
      <label className={lbl}>
        Trait
        <div className="flex items-center gap-1 flex-wrap">
          {SWATCHES.map(c => (
            <button key={c} onClick={() => onChange({ stroke: c })} className={`w-4 h-4 rounded border ${st.stroke === c ? 'border-primary ring-1 ring-primary' : 'border-outline-variant/40'}`} style={{ background: c }} title={c} />
          ))}
          <input type="color" value={st.stroke} onChange={e => onChange({ stroke: e.target.value })} className="w-6 h-6 bg-transparent cursor-pointer" />
        </div>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={lbl}>Épaisseur (mm){numField(st.strokeWidth, v => onChange({ strokeWidth: Math.min(5, Math.max(0.05, v)) }), 0.05)}</label>
        <label className={lbl}>
          Style de trait
          <select value={st.dash} onChange={e => onChange({ dash: e.target.value as ShapeStyle['dash'] })} className={field}>
            <option value="solid">Continu</option>
            <option value="dashed">Tirets</option>
            <option value="dotted">Pointillés</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={st.fill !== 'none'} onChange={e => onChange({ fill: e.target.checked ? '#cbd5e1' : 'none' })} className="accent-[#4cd7f6]" /> Remplissage
        </label>
        {st.fill !== 'none' && <input type="color" value={st.fill} onChange={e => onChange({ fill: e.target.value })} className="w-6 h-6 bg-transparent cursor-pointer" />}
      </div>
      <label className={lbl}>
        Opacité : {Math.round(st.opacity * 100)} %
        <input type="range" min={0.1} max={1} step={0.05} value={st.opacity} onChange={e => onChange({ opacity: Number(e.target.value) })} className="w-full accent-[#4cd7f6]" />
      </label>
    </div>
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
          <div className="font-mono text-[10px] text-outline mt-1">OUTILS DE DESSIN</div>
          <div className="grid grid-cols-4 gap-1">
            {([
              { label: 'Sélection', icon: 'near_me', on: activeTool === 'select', go: () => setActiveTool('select') },
              { label: 'Texte (T)', icon: 'title', on: activeTool === 'text', go: () => setActiveTool(activeTool === 'text' ? 'select' : 'text') },
              { label: 'Rectangle (R)', icon: 'rectangle', on: activeTool === 'rect' && shapeSubTool === 'rect', go: () => { setShapeSubTool('rect'); setActiveTool('rect'); } },
              { label: 'Ellipse', icon: 'circle', on: activeTool === 'rect' && shapeSubTool === 'circle', go: () => { setShapeSubTool('circle'); setActiveTool('rect'); } },
              { label: 'Ligne brisée (L)', icon: 'polyline', on: activeTool === 'polyline' && polylineSubTool === 'straight' && !polygonMode, go: () => { setPolylineSubTool('straight'); setPolygonMode(false); setActiveTool('polyline'); } },
              { label: 'Polygone', icon: 'pentagon', on: activeTool === 'polyline' && polylineSubTool === 'straight' && polygonMode, go: () => { setPolylineSubTool('straight'); setPolygonMode(true); setActiveTool('polyline'); } },
              { label: 'Courbe', icon: 'gesture_select', on: activeTool === 'polyline' && polylineSubTool === 'curve', go: () => { setPolylineSubTool('curve'); setPolygonMode(false); setActiveTool('polyline'); } },
              { label: 'Main levée', icon: 'gesture', on: activeTool === 'polyline' && polylineSubTool === 'freehand', go: () => { setPolylineSubTool('freehand'); setActiveTool('polyline'); } },
            ]).map(t => (
              <button
                key={t.label}
                onClick={t.go}
                title={t.label}
                className={`${btn} !px-0 !py-2 ${t.on ? '!bg-primary/20 !text-primary !border-primary/50' : ''}`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              </button>
            ))}
          </div>
          <p className="font-mono text-[9px] text-outline leading-snug">
            {activeTool === 'rect' ? 'Glissez sur la planche pour tracer la forme.'
              : activeTool === 'polyline' && polylineSubTool === 'freehand' ? 'Maintenez et dessinez à main levée.'
              : activeTool === 'polyline' ? 'Cliquez les sommets ; double-clic ou Entrée pour terminer, clic sur le 1er point pour fermer. Échap annule.'
              : activeTool === 'text' ? 'Cliquez sur la planche pour poser le texte.'
              : 'Choisissez un outil pour dessiner sur la planche.'}
          </p>

          {(activeTool === 'rect' || activeTool === 'polyline') && (
            <div className="flex flex-col gap-1 border border-outline-variant/20 rounded p-2">
              <div className="font-mono text-[10px] text-outline">STYLE DES NOUVELLES FORMES</div>
              {styleControls(defStyle, patch => setDefStyle(s => ({ ...s, ...patch })))}
            </div>
          )}
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
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={selected.bold} onChange={e => patchItem(selected.id, { bold: e.target.checked })} className="accent-[#4cd7f6]" /> Gras
              </label>
              <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={!!selected.italic} onChange={e => patchItem(selected.id, { italic: e.target.checked })} className="accent-[#4cd7f6]" /> Italique
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={lbl}>
                Police
                <select value={selected.fontFamily || 'sans'} onChange={e => patchItem(selected.id, { fontFamily: e.target.value as LayoutText['fontFamily'] })} className={field}>
                  <option value="sans">Inter</option>
                  <option value="mono">JetBrains Mono</option>
                  <option value="serif">Serif</option>
                </select>
              </label>
              <label className={lbl}>
                Couleur
                <div className="flex items-center gap-1">
                  <input type="color" value={selected.color || '#111827'} onChange={e => patchItem(selected.id, { color: e.target.value })} className="w-8 h-7 bg-transparent cursor-pointer" />
                  <button onClick={() => patchItem(selected.id, { color: undefined })} className={btn} title="Noir par défaut">↺</button>
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <label className={lbl}>X{numField(selected.x, v => patchItem(selected.id, { x: v }), 0.5)}</label>
              <label className={lbl}>Y{numField(selected.y, v => patchItem(selected.id, { y: v }), 0.5)}</label>
            </div>
          </div>
        )}

        {selected && selected.kind === 'shape' && (
          <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-2">
            <div className="font-mono text-[10px] text-primary font-bold flex items-center justify-between">
              {selected.shape === 'rect' ? 'RECTANGLE' : selected.shape === 'ellipse' ? 'ELLIPSE' : selected.closed ? 'POLYGONE' : selected.smooth ? 'COURBE' : 'LIGNE BRISÉE'}
              <span className="flex gap-1">
                <button onClick={() => reorderItem(selected.id, 1)} className="material-symbols-outlined text-[16px] text-outline hover:text-primary" title="Avancer d'un plan">flip_to_front</button>
                <button onClick={() => reorderItem(selected.id, -1)} className="material-symbols-outlined text-[16px] text-outline hover:text-primary" title="Reculer d'un plan">flip_to_back</button>
                <button onClick={() => duplicateItem(selected)} className="material-symbols-outlined text-[15px] text-outline hover:text-primary" title="Dupliquer">content_copy</button>
                <button onClick={() => removeItem(selected.id)} className="material-symbols-outlined text-[16px] text-outline hover:text-error" title="Supprimer (Suppr)">delete</button>
              </span>
            </div>
            {styleControls(selected, patch => patchItem(selected.id, patch))}
            {selected.shape === 'rect' && (
              <label className={lbl}>Coins arrondis (mm){numField(selected.radius ?? 0, v => patchItem(selected.id, { radius: Math.max(0, v) }), 0.5)}</label>
            )}
            {selected.shape === 'polyline' && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={!!selected.closed} onChange={e => patchItem(selected.id, { closed: e.target.checked })} className="accent-[#4cd7f6]" /> Fermée
                </label>
                <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={!!selected.smooth} onChange={e => patchItem(selected.id, { smooth: e.target.checked })} className="accent-[#4cd7f6]" /> Lissée
                </label>
              </div>
            )}
            {selected.shape !== 'polyline' && (
              <div className="grid grid-cols-4 gap-1">
                <label className={lbl}>X{numField(selected.x, v => patchItem(selected.id, { x: v }), 0.5)}</label>
                <label className={lbl}>Y{numField(selected.y, v => patchItem(selected.id, { y: v }), 0.5)}</label>
                <label className={lbl}>L{numField(selected.w, v => patchItem(selected.id, { w: Math.max(1, v) }), 0.5)}</label>
                <label className={lbl}>H{numField(selected.h, v => patchItem(selected.id, { h: Math.max(1, v) }), 0.5)}</label>
              </div>
            )}
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
            <input type="checkbox" checked={sheet.showFrame} onChange={e => patchSheet({ showFrame: e.target.checked })} className="accent-[#4cd7f6]" /> Cadre
          </label>
          <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={showCartouche} onChange={e => patchSheet({ showCartouche: e.target.checked })} className="accent-[#4cd7f6]" /> Cartouche
          </label>
          <label className="flex items-center gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={showNorth} onChange={e => patchSheet({ showNorth: e.target.checked })} className="accent-[#4cd7f6]" /> Flèche Nord
          </label>

          <div className="font-mono text-[10px] text-outline mt-1">PERSONNALISATION</div>
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl}>Marge (mm){numField(MARGIN, v => patchSheet({ margin: Math.min(30, Math.max(0, v)) }), 1)}</label>
            <label className={lbl}>Épaisseur cadre (mm){numField(frameWidth, v => patchSheet({ frameWidth: Math.min(3, Math.max(0.1, v)) }), 0.1)}</label>
          </div>
          <label className={lbl}>
            Couleur du papier
            <div className="flex items-center gap-1">
              {['#ffffff', '#fffbeb', '#f1f5f9', '#ecfeff', '#f0fdf4'].map(c => (
                <button
                  key={c}
                  onClick={() => patchSheet({ paperColor: c })}
                  className={`w-5 h-5 rounded border ${paperColor === c ? 'border-primary ring-1 ring-primary' : 'border-outline-variant/40'}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              <input type="color" value={paperColor} onChange={e => patchSheet({ paperColor: e.target.value })} className="w-6 h-6 bg-transparent cursor-pointer" />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl}>
              Accrochage (mm)
              <select value={gridMm} onChange={e => patchSheet({ gridMm: Number(e.target.value) })} className={field}>
                {[0.5, 1, 2, 5, 10].map(g => <option key={g} value={g}>{g} mm</option>)}
              </select>
            </label>
            <label className="flex items-end gap-2 font-mono text-[10px] text-on-surface-variant cursor-pointer pb-1">
              <input type="checkbox" checked={!!sheet.showGrid} onChange={e => patchSheet({ showGrid: e.target.checked })} className="accent-[#4cd7f6]" /> Grille visible
            </label>
          </div>
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

        <SheetSvg
          ref={svgRef}
          sheet={sheet}
          ctx={ctx}
          eff={eff}
          style={{ width: `${zoom * 100}%`, maxWidth: zoom * 1100, aspectRatio: `${W} / ${H}`, cursor: activeTool === 'text' ? 'text' : activeTool === 'rect' || activeTool === 'polyline' ? 'crosshair' : 'default' }}
          className="mx-auto shadow-2xl block"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onDoubleClick={onDoubleClick}
          underlay={sheet.showGrid && (
            <g data-ui="1" style={{ pointerEvents: 'none' }}>
              <defs>
                <pattern id="layout-grid" width={Math.max(gridMm, 1)} height={Math.max(gridMm, 1)} patternUnits="userSpaceOnUse">
                  <circle cx={0} cy={0} r={0.12} fill="#94a3b8" />
                </pattern>
              </defs>
              <rect x={0} y={0} width={W} height={H} fill="url(#layout-grid)" />
            </g>
          )}
          overlay={
            <>
          {/* Tracé en cours (non imprimé) */}
          {draft && (
            <g data-ui="1" style={{ pointerEvents: 'none' }} fill="none" stroke="#2563eb" strokeWidth={0.35} strokeDasharray="2 1.2">
              {draft.kind === 'box' && (draft.shape === 'rect'
                ? <rect x={Math.min(draft.x0, draft.x1)} y={Math.min(draft.y0, draft.y1)} width={Math.abs(draft.x1 - draft.x0)} height={Math.abs(draft.y1 - draft.y0)} />
                : <ellipse cx={(draft.x0 + draft.x1) / 2} cy={(draft.y0 + draft.y1) / 2} rx={Math.abs(draft.x1 - draft.x0) / 2} ry={Math.abs(draft.y1 - draft.y0) / 2} />)}
              {draft.kind === 'poly' && (
                <>
                  <path d={polyPath(cursor ? [...draft.points, cursor] : draft.points, draft.smooth, false)} />
                  {draft.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === 0 && draft.points.length >= 3 ? 1.6 : 0.8} fill="#2563eb" stroke="none" />)}
                </>
              )}
              {draft.kind === 'free' && <path d={polyPath(draft.points, true, false)} />}
            </g>
          )}

          {/* Sélection (non imprimée) */}
          {selected && (() => {
            const r = itemBox(selected);
            return (
              <g data-ui="1">
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#2563eb" strokeWidth={0.4} strokeDasharray="2 1.2" style={{ pointerEvents: 'none' }} />
                {(selected.kind === 'viewport' || (selected.kind === 'shape' && selected.shape !== 'polyline')) && (
                  <g data-item-id={selected.id}>
                    <rect data-handle="se" x={r.x + r.w - 2} y={r.y + r.h - 2} width={4} height={4} fill="#2563eb" stroke="#ffffff" strokeWidth={0.4} style={{ cursor: 'nwse-resize' }} />
                  </g>
                )}
                {selected.kind === 'shape' && selected.shape === 'polyline' && (
                  <g data-item-id={selected.id}>
                    {(selected.points || []).map((p, i) => (
                      <rect key={i} data-handle={`v${i}`} x={p.x - 1.4} y={p.y - 1.4} width={2.8} height={2.8} fill="#ffffff" stroke="#2563eb" strokeWidth={0.4} style={{ cursor: 'move' }} />
                    ))}
                  </g>
                )}
              </g>
            );
          })()}

            </>
          }
        />
      </div>
    </div>
  );
};
