import React from 'react';
import { CadEntity, CadLayer, LayoutSheet, ProjectMeta, ProjectSnapshot } from './types.ts';
import { computeWallPolygons } from './wallGeometry.ts';
import { PlanDrawing, SheetSvg, planBBox } from './components/sheetRender.tsx';
import { sheetSize } from './layoutModel.ts';
import { analyzePlanMetrics } from './agent.ts';
import { buildProjectFile } from './projectStore.ts';

/**
 * Exports réels : projet (JSON), plan (SVG), DXF R12, planches (PDF via impression), métrés (JSON / CSV).
 * Convention : 1 px plan = 10 mm ; le DXF est en millimètres, axe Y inversé (le plan a Y vers le bas).
 */

export interface ExportFile { filename: string; mime: string; content: string | Uint8Array }

export interface ExportOptions {
  levelIds: string[]; // niveaux exportés
  layerIds: string[]; // calques inclus
  scale: number; // dénominateur d'échelle pour le SVG (1:scale)
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Entités d'un niveau limitées aux calques inclus. */
const levelEntities = (snap: ProjectSnapshot, levelId: string, layerIds: Set<string>): CadEntity[] =>
  (snap.entitiesByLevel[levelId] || []).filter(e => layerIds.has(e.layerId));

const sortedLevels = (snap: ProjectSnapshot, ids: string[]) => [...snap.levels].filter(l => ids.includes(l.id)).sort((a, b) => a.elevation - b.elevation);

// ───────────────────────────── Projet (JSON) ─────────────────────────────

export function exportProjectJson(meta: Pick<ProjectMeta, 'name' | 'phase' | 'category' | 'version' | 'location'>, snap: ProjectSnapshot): ExportFile {
  return {
    filename: `${slugify(meta.name)}.arcki.json`,
    mime: 'application/json',
    content: JSON.stringify(buildProjectFile(meta, snap), null, 2),
  };
}

// ───────────────────────────── SVG ─────────────────────────────

/** Plan(s) en SVG : un bloc par niveau, empilés verticalement, noir sur blanc, à l'échelle demandée (1 mm papier = scale mm réels). */
export async function exportSvg(snap: ProjectSnapshot, name: string, o: ExportOptions): Promise<ExportFile> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const layerIds = new Set(o.layerIds);
  const levels = sortedLevels(snap, o.levelIds).reverse(); // étage le plus haut en premier
  const pad = 80; // px plan de marge autour de chaque plan (800 mm)
  const k = 10 / o.scale; // mm papier par px plan
  const titleH = 60;
  let y = 0;
  let maxW = 0;
  const blocks: string[] = [];

  for (const lvl of levels) {
    const ents = levelEntities(snap, lvl.id, layerIds);
    const bb = planBBox(ents) || { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    const w = bb.maxX - bb.minX + pad * 2;
    const h = bb.maxY - bb.minY + pad * 2;
    const markup = renderToStaticMarkup(<PlanDrawing entities={ents} k={k} scale={o.scale} showRoomNames />);
    const titleSize = 5 / k; // 5 mm de hauteur de texte sur le papier
    blocks.push(
      `<g id="niveau-${esc(slugify(lvl.name))}" transform="translate(${pad - bb.minX} ${y + titleH + pad - bb.minY})">${markup}</g>` +
      `<text x="${pad}" y="${y + titleH - 10}" font-family="JetBrains Mono, monospace" font-size="${titleSize.toFixed(2)}" font-weight="bold" fill="#111827">${esc(name)} — ${esc(lvl.name)} (${lvl.elevation >= 0 ? '+' : '−'}${(Math.abs(lvl.elevation) / 1000).toFixed(2)} m) — 1:${o.scale}</text>`
    );
    y += titleH + h + 40;
    maxW = Math.max(maxW, w);
  }
  const widthMm = (maxW * 10) / o.scale, heightMm = (y * 10) / o.scale;
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(1)}mm" height="${heightMm.toFixed(1)}mm" viewBox="0 0 ${maxW.toFixed(1)} ${y.toFixed(1)}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>${blocks.join('')}</svg>`;
  return { filename: `${slugify(name)}-plan-1-${o.scale}.svg`, mime: 'image/svg+xml', content: svg };
}

// ───────────────────────────── DXF R12 ─────────────────────────────

const ACI: Array<[number, string]> = [[1, '#ff0000'], [2, '#ffff00'], [3, '#00ff00'], [4, '#00ffff'], [5, '#0000ff'], [6, '#ff00ff'], [7, '#ffffff'], [8, '#808080']];
const aciOf = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 7;
  const v = parseInt(m[1], 16), r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  let best = 7, bd = Infinity;
  for (const [i, h] of ACI) {
    const c = parseInt(h.slice(1), 16);
    const d = (((c >> 16) & 255) - r) ** 2 + (((c >> 8) & 255) - g) ** 2 + ((c & 255) - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};
const dxfName = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9_$-]/g, '_').slice(0, 31) || '0';
const num = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** DXF R12 (AC1009) ASCII : un jeu de calques par calque ARCKI (suffixé du niveau si plusieurs), Z = altitude du niveau. */
export function exportDxf(snap: ProjectSnapshot, o: ExportOptions): ExportFile {
  const layerIds = new Set(o.layerIds);
  const levels = sortedLevels(snap, o.levelIds);
  const multi = levels.length > 1;
  const layerName = (layer: CadLayer | undefined, lvlName: string) => dxfName(`${layer?.name?.split(' (')[0] ?? 'CALQUE'}${multi ? `_${lvlName}` : ''}`);

  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));
  const usedLayers = new Map<string, number>();
  const body: string[] = [];
  const emit = (arr: Array<[number, string | number]>) => arr.forEach(([c, v]) => body.push(String(c), String(v)));

  const X = (x: number) => num(x * 10), Y = (y: number) => num(-y * 10);

  for (const lvl of levels) {
    const z = num(lvl.elevation);
    const ents = levelEntities(snap, lvl.id, layerIds);
    const polys = computeWallPolygons(ents.filter(e => e.type === 'wall' || e.type === 'partition'));
    const layers = new Map(snap.layers.map(l => [l.id, l]));

    for (const e of ents) {
      const ly = layers.get(e.layerId);
      const L = layerName(ly, lvl.name);
      if (!usedLayers.has(L)) usedLayers.set(L, aciOf(ly?.color || '#ffffff'));

      const line = (x1: number, y1: number, x2: number, y2: number) =>
        emit([[0, 'LINE'], [8, L], [10, X(x1)], [20, Y(y1)], [30, z], [11, X(x2)], [21, Y(y2)], [31, z]]);
      const poly = (pts: Array<{ x: number; y: number }>, closed: boolean) => {
        if (pts.length < 2) return;
        emit([[0, 'POLYLINE'], [8, L], [66, 1], [70, closed ? 1 : 0], [10, 0], [20, 0], [30, z]]);
        pts.forEach(p => emit([[0, 'VERTEX'], [8, L], [10, X(p.x)], [20, Y(p.y)], [30, z]]));
        emit([[0, 'SEQEND'], [8, L]]);
      };
      const text = (x: number, y: number, hMm: number, t: string, rot = 0) =>
        emit([[0, 'TEXT'], [8, L], [10, X(x)], [20, Y(y)], [30, z], [40, num(hMm)], [1, t.replace(/[\r\n]+/g, ' ')], [50, num(rot)]]);

      switch (e.type) {
        case 'wall':
        case 'partition':
          if (polys[e.id]) poly(polys[e.id], true);
          break;
        case 'window': {
          const dx = e.x2 - e.x1, dy = e.y2 - e.y1, len = Math.hypot(dx, dy) || 1;
          const nx = (-dy / len) * ((e.thickness || 200) / 20), ny = (dx / len) * ((e.thickness || 200) / 20);
          line(e.x1 - nx, e.y1 - ny, e.x1 + nx, e.y1 + ny);
          line(e.x2 - nx, e.y2 - ny, e.x2 + nx, e.y2 + ny);
          line(e.x1, e.y1, e.x2, e.y2);
          break;
        }
        case 'door': {
          const dx = e.x2 - e.x1, dy = e.y2 - e.y1, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len, ht = (e.thickness || 200) / 20;
          line(e.x1 - nx * ht, e.y1 - ny * ht, e.x1 + nx * ht, e.y1 + ny * ht);
          line(e.x2 - nx * ht, e.y2 - ny * ht, e.x2 + nx * ht, e.y2 + ny * ht);
          line(e.x1, e.y1, e.x1 + nx * len, e.y1 + ny * len); // vantail ouvert à 90°
          const arc: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= 12; i++) {
            const a = (Math.PI / 2) * (i / 12);
            arc.push({ x: e.x1 + (dx * Math.cos(a) + nx * len * Math.sin(a)), y: e.y1 + (dy * Math.cos(a) + ny * len * Math.sin(a)) });
          }
          poly(arc, false); // débattement
          break;
        }
        case 'room': {
          const x1 = Math.min(e.x1, e.x2), x2 = Math.max(e.x1, e.x2), y1 = Math.min(e.y1, e.y2), y2 = Math.max(e.y1, e.y2);
          poly([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], true);
          text((x1 + x2) / 2 - 40, (y1 + y2) / 2, 180, `${e.label || e.name}${e.area ? ` ${e.area.toFixed(1)} m2` : ''}`);
          break;
        }
        case 'rect':
        case 'furniture': {
          const x1 = Math.min(e.x1, e.x2), x2 = Math.max(e.x1, e.x2), y1 = Math.min(e.y1, e.y2), y2 = Math.max(e.y1, e.y2);
          poly([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], true);
          break;
        }
        case 'circle':
          emit([[0, 'CIRCLE'], [8, L], [10, X(e.x1)], [20, Y(e.y1)], [30, z], [40, num((e.radius || Math.hypot(e.x2 - e.x1, e.y2 - e.y1)) * 10)]]);
          break;
        case 'line':
          line(e.x1, e.y1, e.x2, e.y2);
          break;
        case 'polygon':
        case 'polyline':
          poly(e.points && e.points.length ? e.points : [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }], !!e.isClosed);
          break;
        case 'dim': {
          line(e.x1, e.y1, e.x2, e.y2);
          const rot = (Math.atan2(-(e.y2 - e.y1), e.x2 - e.x1) * 180) / Math.PI;
          text((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, 150, e.label || `${Math.round(Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * 10)}`, rot);
          break;
        }
        case 'text':
          text(e.x1, e.y1, (e.fontSize || 14) * 10 * 0.7, e.label || '');
          break;
        default:
          break; // courbes : non exportées
      }
    }
  }

  // En-tête + tables + entités
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1); g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0); g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, usedLayers.size + 1);
  g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
  usedLayers.forEach((color, name) => { g(0, 'LAYER'); g(2, name); g(70, 0); g(62, color); g(6, 'CONTINUOUS'); });
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const head = out.join('\n');
  const content = `${head}\n${body.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
  return { filename: `${slugify(levels.length === 1 ? levels[0].name : 'projet')}.dxf`, mime: 'application/dxf', content };
}

// ───────────────────────────── Métrés ─────────────────────────────

const lengthM = (e: CadEntity) => (Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * 10) / 1000;

export function exportMetricsJson(snap: ProjectSnapshot, name: string, o: ExportOptions): ExportFile {
  const layerIds = new Set(o.layerIds);
  const levels = sortedLevels(snap, o.levelIds);
  const perLevel = levels.map(l => {
    const ents = levelEntities(snap, l.id, layerIds);
    return { niveau: l.name, altitudeMm: l.elevation, hauteurMm: l.height, objets: ents.length, ...analyzePlanMetrics(ents) };
  });
  const total = {
    niveaux: perLevel.length,
    surfaceHabitableM2: Math.round(perLevel.reduce((a, l) => a + l.totalFloorAreaM2, 0) * 100) / 100,
    longueurMursM: Math.round(perLevel.reduce((a, l) => a + l.wallLengthM, 0) * 100) / 100,
    longueurCloisonsM: Math.round(perLevel.reduce((a, l) => a + l.partitionLengthM, 0) * 100) / 100,
    portes: perLevel.reduce((a, l) => a + l.doorCount, 0),
    fenetres: perLevel.reduce((a, l) => a + l.windowCount, 0),
  };
  return { filename: `${slugify(name)}-rapport.json`, mime: 'application/json', content: JSON.stringify({ projet: name, genereLe: new Date().toISOString(), total, niveaux: perLevel }, null, 2) };
}

/** Métrés CSV (séparateur « ; », UTF-8 avec BOM : s'ouvre directement dans Excel) : pièces, murs, ouvertures. */
export function exportSchedulesCsv(snap: ProjectSnapshot, name: string, o: ExportOptions): ExportFile {
  const layerIds = new Set(o.layerIds);
  const levels = sortedLevels(snap, o.levelIds);
  const cell = (v: string | number) => { const t = String(v).replace(/"/g, '""'); return /[;"\n]/.test(t) ? `"${t}"` : t; };
  const rows: string[] = [];
  const row = (...c: Array<string | number>) => rows.push(c.map(cell).join(';'));
  const fr = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

  row('PIÈCES'); row('Niveau', 'Nom', 'Surface (m²)');
  levels.forEach(l => levelEntities(snap, l.id, layerIds).filter(e => e.type === 'room').forEach(e => row(l.name, e.label || e.name, fr(e.area || 0))));
  row();
  row('MURS ET CLOISONS'); row('Niveau', 'Type', 'Nom', 'Longueur (m)', 'Épaisseur (mm)', 'Hauteur (mm)', 'Surface brute (m²)', 'Matériau');
  levels.forEach(l => levelEntities(snap, l.id, layerIds).filter(e => e.type === 'wall' || e.type === 'partition').forEach(e => {
    const len = lengthM(e), h = e.height || l.height;
    row(l.name, e.type === 'wall' ? 'Mur' : 'Cloison', e.name, fr(len), e.thickness || 200, h, fr((len * h) / 1000), e.material || '');
  }));
  row();
  row('OUVERTURES'); row('Niveau', 'Type', 'Nom', 'Largeur (mm)', 'Mur hôte');
  levels.forEach(l => {
    const ents = levelEntities(snap, l.id, layerIds);
    ents.filter(e => e.type === 'door' || e.type === 'window').forEach(e => {
      const host = ents.find(h => h.id === e.hostWallId);
      row(l.name, e.type === 'door' ? 'Porte' : 'Fenêtre', e.name, e.openingWidth || Math.round(lengthM(e) * 1000), host ? host.name : '');
    });
  });
  return { filename: `${slugify(name)}-metres.csv`, mime: 'text/csv;charset=utf-8', content: '﻿' + rows.join('\r\n') + '\r\n' };
}

// ───────────────────────────── Planches (PDF) ─────────────────────────────

/** Ouvre une fenêtre d'impression contenant les planches (une page par planche, au format papier) : « Enregistrer au format PDF ». */
export async function printSheets(snap: ProjectSnapshot, sheetIds: string[], layerIds: string[]): Promise<boolean> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const sheets = snap.sheets.filter(s => sheetIds.includes(s.id));
  if (!sheets.length) return false;
  const visible = new Set(layerIds);
  const ctx = { levels: snap.levels, entitiesByLevel: snap.entitiesByLevel, isLayerVisible: (id: string) => visible.has(id) };
  const w = window.open('', '_blank');
  if (!w) return false;
  const pages = sheets.map((s: LayoutSheet, i) => {
    const { W, H } = sheetSize(s);
    return {
      css: `@page p${i}{size:${W}mm ${H}mm;margin:0}.p${i}{page:p${i};width:${W}mm;height:${H}mm;overflow:hidden;break-after:page}`,
      html: `<div class="p${i}">${renderToStaticMarkup(<SheetSvg sheet={s} ctx={ctx} style={{ width: `${W}mm`, height: `${H}mm`, display: 'block' }} />)}</div>`,
    };
  });
  w.document.write(`<html><head><title>Planches</title><style>body{margin:0}${pages.map(p => p.css).join('')}</style></head><body>${pages.map(p => p.html).join('')}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}


// ───────────────────────────── PDF (fichier) ─────────────────────────────

const enc = new TextEncoder();

/** Chaîne PDF : ASCII entre parenthèses, sinon UTF-16BE en hexadécimal (accents). */
const pdfString = (t: string) => {
  if (/^[\x20-\x7e]*$/.test(t)) return `(${t.replace(/([()\\])/g, '\\$1')})`;
  let hex = 'FEFF';
  for (let i = 0; i < t.length; i++) hex += t.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
};

interface PdfPage { wPt: number; hPt: number; w: number; h: number; data: Uint8Array; filter: 'FlateDecode' | 'DCTDecode' }

/** Assemble un PDF 1.4 : une page par image, à la taille exacte du papier. */
function buildPdf(pages: PdfPage[], title: string): Uint8Array {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (u: Uint8Array) => { parts.push(u); pos += u.length; };
  const text = (t: string) => push(enc.encode(t));
  const beginObj = (n: number) => { offsets[n] = pos; text(`${n} 0 obj\n`); };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + commentaire binaire
  beginObj(1); text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  beginObj(2); text(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>\nendobj\n`);
  beginObj(3); text(`<< /Title ${pdfString(title)} /Producer (ARCKI CAD) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>\nendobj\n`);
  pages.forEach((p, i) => {
    const pg = 4 + i * 3, ct = 5 + i * 3, im = 6 + i * 3;
    const w = p.wPt.toFixed(2), h = p.hPt.toFixed(2);
    beginObj(pg);
    text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    const stream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    beginObj(ct);
    text(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    beginObj(im);
    text(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${p.filter} /Length ${p.data.length} >>\nstream\n`);
    push(p.data);
    text('\nendstream\nendobj\n');
  });
  const total = 4 + pages.length * 3;
  const xref = pos;
  text(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) text(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  parts.forEach(u => { out.set(u, o); o += u.length; });
  return out;
}

/** Compression zlib native (CompressionStream) ; null si le navigateur ne la fournit pas. */
async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Rastérise un SVG (dimensions en pixels fixées dans le balisage) vers un canevas blanc. */
async function svgToCanvas(svgMarkup: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('rendu de la planche impossible'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canevas indisponible');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface PdfProgress { (done: number, total: number): void }

/**
 * Génère un vrai fichier PDF des planches : une page par planche, à la taille exacte du papier (A4…A0),
 * contenu rendu à la résolution demandée (dpi) puis compressé sans perte (Flate), ou en JPEG si la compression n'est pas disponible.
 * Le rendu est le même que celui de l'écran (mêmes composants SVG que la mise en page).
 */
export async function exportPdf(snap: ProjectSnapshot, name: string, sheetIds: string[], layerIds: string[], dpi = 200, onProgress?: PdfProgress): Promise<ExportFile> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const sheets = snap.sheets.filter(s => sheetIds.includes(s.id));
  if (!sheets.length) throw new Error('aucune planche sélectionnée');
  const visible = new Set(layerIds);
  const ctx = { levels: snap.levels, entitiesByLevel: snap.entitiesByLevel, isLayerVisible: (id: string) => visible.has(id) };
  const pages: PdfPage[] = [];

  for (let i = 0; i < sheets.length; i++) {
    onProgress?.(i, sheets.length);
    const sheet = sheets[i];
    const { W, H } = sheetSize(sheet);
    // résolution limitée pour garder un canevas raisonnable (≈ 40 millions de pixels au maximum, ex. A0 à ~100 dpi)
    const maxDpi = Math.sqrt(40_000_000 / ((W / 25.4) * (H / 25.4)));
    const d = Math.max(50, Math.min(dpi, maxDpi));
    const wPx = Math.round((W / 25.4) * d), hPx = Math.round((H / 25.4) * d);
    const markup = renderToStaticMarkup(<SheetSvg sheet={sheet} ctx={ctx} width={wPx} height={hPx} />);
    const canvas = await svgToCanvas(markup, wPx, hPx);

    let page: PdfPage | null = null;
    const rgba = canvas.getContext('2d')!.getImageData(0, 0, wPx, hPx).data;
    const rgb = new Uint8Array(wPx * hPx * 3);
    for (let p = 0, q = 0; p < rgba.length; p += 4, q += 3) { rgb[q] = rgba[p]; rgb[q + 1] = rgba[p + 1]; rgb[q + 2] = rgba[p + 2]; }
    const z = await deflate(rgb);
    if (z) page = { wPt: (W * 72) / 25.4, hPt: (H * 72) / 25.4, w: wPx, h: hPx, data: z, filter: 'FlateDecode' };
    else {
      const jpg = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (!jpg) throw new Error('compression d\'image indisponible');
      page = { wPt: (W * 72) / 25.4, hPt: (H * 72) / 25.4, w: wPx, h: hPx, data: new Uint8Array(await jpg.arrayBuffer()), filter: 'DCTDecode' };
    }
    pages.push(page);
  }
  onProgress?.(sheets.length, sheets.length);
  return { filename: `${slugify(name)}-planches.pdf`, mime: 'application/pdf', content: buildPdf(pages, `${name} — planches`) };
}

// ───────────────────────────── Téléchargement ─────────────────────────────

export function downloadFile(f: ExportFile) {
  const blob = new Blob([f.content as BlobPart], { type: f.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
