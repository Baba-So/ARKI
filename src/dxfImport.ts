import { CadEntity } from './types.ts';
import { emptySnapshot, saveProject } from './projectStore.ts';

/**
 * Import DXF (ASCII) : LINE, LWPOLYLINE, POLYLINE/VERTEX, CIRCLE, ARC, TEXT, MTEXT.
 * Les unités sont déduites de $INSUNITS (mm par défaut) ; le plan est converti en px plan (1 px = 10 mm), Y inversé,
 * puis recalé près de l'origine. Les calques DXF sont rangés dans les calques normalisés d'après leur nom.
 */

interface Pair { code: number; value: string }

const parsePairs = (text: string): Pair[] => {
  const lines = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    out.push({ code, value: lines[i + 1].trim() });
  }
  return out;
};

const layerFor = (name: string): string => {
  const n = name.toLowerCase();
  if (/cloison|partition|part\b|doublage/.test(n)) return 'cloisons';
  if (/porte|door|fen|window|ouv|baie|menuis/.test(n)) return 'ouvertures';
  if (/mob|furn|equip|sanit|cuisine/.test(n)) return 'mobilier';
  if (/cot|dim|text|txt|anno|niveau/.test(n)) return 'cotations';
  return 'structures';
};

const UNIT_TO_MM: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 7: 1_000_000 };

export interface DxfImportResult {
  entities: CadEntity[];
  skipped: Record<string, number>;
  unitFactor: number;
  truncated: boolean;
}

const MAX_ENTITIES = 20000;

export function parseDxf(text: string): DxfImportResult {
  const pairs = parsePairs(text);
  // unités
  let unitFactor = 1;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i].code === 9 && pairs[i].value === '$INSUNITS') { unitFactor = UNIT_TO_MM[parseInt(pairs[i + 1].value, 10)] ?? 1; break; }
  }
  // section ENTITIES
  let start = pairs.findIndex((p, i) => p.code === 2 && p.value === 'ENTITIES' && pairs[i - 1]?.value === 'SECTION');
  if (start < 0) start = 0;
  const skipped: Record<string, number> = {};
  const raw: Array<{ type: string; layer: string; p: Pair[] }> = [];
  let cur: { type: string; layer: string; p: Pair[] } | null = null;
  for (let i = start; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 0) {
      if (value === 'ENDSEC') break;
      cur = { type: value, layer: '0', p: [] };
      raw.push(cur);
    } else if (cur) {
      if (code === 8) cur.layer = value;
      cur.p.push(pairs[i]);
    }
  }

  const k = unitFactor / 10; // unité DXF → px plan
  const X = (v: number) => v * k, Y = (v: number) => -v * k;
  const num = (p: Pair[], code: number, d = 0) => { const f = p.find(q => q.code === code); return f ? parseFloat(f.value) : d; };
  const entities: CadEntity[] = [];
  let id = 0;
  let truncated = false;
  const base = (layer: string, type: CadEntity['type'], name: string) => ({ id: `dxf-${Date.now().toString(36)}-${id++}`, name, type, layerId: layerFor(layer) });
  const bbox = (pts: Array<{ x: number; y: number }>) => ({
    x1: Math.min(...pts.map(q => q.x)), y1: Math.min(...pts.map(q => q.y)), x2: Math.max(...pts.map(q => q.x)), y2: Math.max(...pts.map(q => q.y)),
  });
  const addPoly = (layer: string, pts: Array<{ x: number; y: number }>, closed: boolean, name = 'Polyligne DXF') => {
    if (pts.length < 2) return;
    entities.push({ ...base(layer, closed ? 'polygon' : 'polyline', name), ...bbox(pts), points: pts, isClosed: closed });
  };

  for (let i = 0; i < raw.length; i++) {
    if (entities.length >= MAX_ENTITIES) { truncated = true; break; }
    const r = raw[i];
    switch (r.type) {
      case 'LINE': {
        const x1 = X(num(r.p, 10)), y1 = Y(num(r.p, 20)), x2 = X(num(r.p, 11)), y2 = Y(num(r.p, 21));
        entities.push({ ...base(r.layer, 'line', 'Ligne DXF'), x1, y1, x2, y2 });
        break;
      }
      case 'LWPOLYLINE': {
        const pts: Array<{ x: number; y: number }> = [];
        let x: number | null = null;
        for (const q of r.p) {
          if (q.code === 10) x = parseFloat(q.value);
          else if (q.code === 20 && x !== null) { pts.push({ x: X(x), y: Y(parseFloat(q.value)) }); x = null; }
        }
        addPoly(r.layer, pts, (num(r.p, 70) & 1) === 1);
        break;
      }
      case 'POLYLINE': {
        const closed = (num(r.p, 70) & 1) === 1;
        const pts: Array<{ x: number; y: number }> = [];
        let j = i + 1;
        while (j < raw.length && raw[j].type === 'VERTEX') { pts.push({ x: X(num(raw[j].p, 10)), y: Y(num(raw[j].p, 20)) }); j++; }
        if (j < raw.length && raw[j].type === 'SEQEND') j++;
        i = j - 1;
        addPoly(r.layer, pts, closed);
        break;
      }
      case 'CIRCLE': {
        const cx = X(num(r.p, 10)), cy = Y(num(r.p, 20)), rad = num(r.p, 40) * k;
        entities.push({ ...base(r.layer, 'circle', 'Cercle DXF'), x1: cx, y1: cy, x2: cx + rad, y2: cy, radius: rad });
        break;
      }
      case 'ARC': {
        const cx = num(r.p, 10), cy = num(r.p, 20), rad = num(r.p, 40);
        let a0 = num(r.p, 50), a1 = num(r.p, 51);
        if (a1 <= a0) a1 += 360;
        const n = Math.max(6, Math.ceil((a1 - a0) / 7.5));
        const pts = Array.from({ length: n + 1 }, (_, t) => {
          const a = ((a0 + ((a1 - a0) * t) / n) * Math.PI) / 180;
          return { x: X(cx + rad * Math.cos(a)), y: Y(cy + rad * Math.sin(a)) };
        });
        addPoly(r.layer, pts, false, 'Arc DXF');
        break;
      }
      case 'TEXT':
      case 'MTEXT': {
        const t = r.p.filter(q => q.code === 1 || q.code === 3).map(q => q.value).join('').replace(/\\P/g, '\n').replace(/\{?\\[A-Za-z][^;]*;|[{}]/g, '');
        if (!t.trim()) break;
        const h = num(r.p, 40, 200) * k;
        const x = X(num(r.p, 10)), y = Y(num(r.p, 20));
        entities.push({ ...base(r.layer, 'text', 'Texte DXF'), x1: x, y1: y, x2: x + t.length * h * 0.6, y2: y + h, label: t, fontSize: Math.max(4, h) });
        break;
      }
      case 'VERTEX':
      case 'SEQEND':
        break;
      default:
        skipped[r.type] = (skipped[r.type] || 0) + 1;
    }
  }

  // Recalage : coin haut-gauche du dessin à (100, 100) px
  if (entities.length) {
    const minX = Math.min(...entities.map(e => Math.min(e.x1, e.x2))), minY = Math.min(...entities.map(e => Math.min(e.y1, e.y2)));
    const dx = 100 - minX, dy = 100 - minY;
    entities.forEach(e => {
      e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy;
      if (e.points) e.points = e.points.map(q => ({ x: q.x + dx, y: q.y + dy }));
    });
  }
  return { entities, skipped, unitFactor, truncated };
}

/** Importe un fichier DXF comme nouveau projet (un niveau RDC contenant le dessin). */
export function importDxfAsProject(text: string, fileName: string): { ok: true; id: string; name: string; summary: string } | { ok: false; error: string } {
  if (!/SECTION/.test(text.slice(0, 2000))) return { ok: false, error: 'Fichier illisible : ce n\'est pas un DXF ASCII (les DXF binaires et les DWG ne sont pas pris en charge).' };
  const res = parseDxf(text);
  if (!res.entities.length) return { ok: false, error: 'Aucune entité importable trouvée (LINE, POLYLINE, CIRCLE, ARC, TEXT).' };
  const name = fileName.replace(/\.dxf$/i, '') || 'Plan importé';
  const snap = emptySnapshot(name);
  snap.entitiesByLevel[snap.activeLevelId] = res.entities;
  const id = `proj-${Date.now().toString(36)}`;
  if (!saveProject(id, snap, { name, phase: 'Import DXF', category: 'esquisse', location: fileName, version: 'v1.0' })) {
    return { ok: false, error: 'Stockage du navigateur plein : le plan importé est trop volumineux.' };
  }
  const skippedTxt = Object.entries(res.skipped).map(([k, v]) => `${v} ${k}`).join(', ');
  return {
    ok: true, id, name,
    summary: `${res.entities.length} entité(s) importée(s)${res.truncated ? ' (limitées à 20 000)' : ''}${skippedTxt ? ` ; ignorées : ${skippedTxt}` : ''}`,
  };
}
