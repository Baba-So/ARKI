import './setup.ts';
import assert from 'node:assert/strict';
import { computeWallPolygons, refToCenterline } from '../wallGeometry.ts';
import { buildingExtent, restackLevels, slabOf } from '../levels.ts';
import { buildLevelData, buildViewModel, project } from '../viewsGeometry.ts';
import { exportDxf, exportSchedulesCsv, exportMetricsJson } from '../exporters.tsx';
import { parseBlocksJson, parseSpecLines, buildBlockPrompt } from '../blockSchema.ts';
import { parseDxf } from '../dxfImport.ts';
import { computeStats, emptySnapshot, importProjectFile, sampleSnapshot, buildProjectFile, buildWorkspaceFile, saveProject, getProjects } from '../projectStore.ts';
import { CadEntity } from '../types.ts';

let passed = 0;
const failures: string[] = [];
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failures.push(name); console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
};
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const wall = (id: string, x1: number, y1: number, x2: number, y2: number, t = 200, type: CadEntity['type'] = 'wall'): CadEntity =>
  ({ id, name: id, type, layerId: 'structures', x1, y1, x2, y2, thickness: t, height: 2800 });

console.log('wallGeometry');
test('angle de deux murs : onglet (4 murs → rectangle extérieur 6200 × 5500)', () => {
  const polys = computeWallPolygons([wall('n', 140, 160, 740, 160), wall('e', 740, 160, 740, 690), wall('s', 740, 690, 140, 690), wall('w', 140, 690, 140, 160)]);
  const xs = Object.values(polys).flat().map(p => p.x), ys = Object.values(polys).flat().map(p => p.y);
  near(Math.min(...xs), 130); near(Math.max(...xs), 750); near(Math.min(...ys), 150); near(Math.max(...ys), 700);
});
test('té : la cloison s\'arrête à la face du mur', () => {
  const polys = computeWallPolygons([wall('n', 140, 160, 740, 160), wall('p', 500, 160, 500, 340, 72, 'partition')]);
  const ys = polys.p.map(p => p.y);
  near(Math.min(...ys), 170); // face intérieure du mur (axe 160 + 10)
});
test('murs alignés bout à bout : le jeu est comblé', () => {
  const polys = computeWallPolygons([wall('a', 100, 100, 300, 100), wall('b', 310, 100, 500, 100)]);
  const aMaxX = Math.max(...polys.a.map(p => p.x)), bMinX = Math.min(...polys.b.map(p => p.x));
  near(aMaxX, 305); near(bMinX, 305);
});
test('ligne de référence : Nu Gauche décale l\'axe d\'une demi-épaisseur', () => {
  const c = refToCenterline(0, 0, 100, 0, 200, 'left');
  near(c.y1, 10); near(c.y2, 10);
});

console.log('levels');
test('empilement automatique (RDC ancré à 0, dalles de 200)', () => {
  const l = restackLevels([
    { id: 'b', name: 'R+1', elevation: 999, height: 2800 },
    { id: 'a', name: 'RDC', elevation: 0, height: 2800 },
    { id: 'c', name: 'R+2', elevation: 5000, height: 2500, slabMm: 300 },
  ]);
  assert.deepEqual(l.map(x => x.name), ['RDC', 'R+1', 'R+2']);
  assert.deepEqual(l.map(x => x.elevation), [0, 3000, 5800 + 300]);
});
test('sous-sol calculé vers le bas', () => {
  const l = restackLevels([{ id: 'r', name: 'RDC', elevation: 0, height: 2800 }, { id: 's', name: 'SS-1', elevation: -1, height: 2500 }]);
  assert.equal(l[0].elevation, -2700); // 0 − dalle(200) − 2500
});
test('hauteur hors tout', () => {
  const e = buildingExtent([{ id: 'r', name: 'RDC', elevation: 0, height: 2800 }]);
  assert.equal(e.total, 200 + 2800 + 200);
  assert.equal(slabOf({}), 200);
});

console.log('viewsGeometry');
test('projection des 4 façades', () => {
  assert.deepEqual(project('S', 10, 20), { u: 100, d: -200 });
  assert.deepEqual(project('N', 10, 20), { u: -100, d: 200 });
  assert.deepEqual(project('E', 10, 20), { u: -200, d: -100 });
  assert.deepEqual(project('O', 10, 20), { u: 200, d: 100 });
});
test('façade sud : l\'emprise inclut l\'épaisseur des angles (6200 mm)', () => {
  const s = sampleSnapshot();
  const ld = buildLevelData(s.levels, s.entitiesByLevel, () => true);
  const m = buildViewModel(ld, { type: 'elevation', dir: 'S', sectionId: 'AA', cutValue: 0, flip: false });
  near(m.bounds.maxU - m.bounds.minU, 6300 - 100 + 0, 400); // ≈ 6200 (dalle exclue)
  assert.ok(m.strips.length >= 4);
});

console.log('exports');
test('DXF : paires valides, sections et fin de fichier', () => {
  const s = sampleSnapshot();
  const f = exportDxf(s, { levelIds: s.levels.map(l => l.id), layerIds: s.layers.map(l => l.id), scale: 100 });
  const lines = String(f.content).split('\n'); lines.pop();
  assert.equal(lines.length % 2, 0);
  for (let i = 0; i < lines.length; i += 2) assert.match(lines[i], /^\s*\d+$/);
  assert.equal(lines.slice(-4).join('|'), '0|ENDSEC|0|EOF');
  assert.ok(String(f.content).includes('POLYLINE'));
});
test('métrés CSV : séparateur ; et BOM', () => {
  const s = sampleSnapshot();
  const f = exportSchedulesCsv(s, 'Test', { levelIds: s.levels.map(l => l.id), layerIds: s.layers.map(l => l.id), scale: 100 });
  assert.ok(String(f.content).startsWith('﻿PIÈCES'));
  assert.ok(String(f.content).includes('Niveau;Nom;Surface (m²)'));
});
test('rapport JSON : surface habitable cohérente', () => {
  const s = sampleSnapshot();
  const f = exportMetricsJson(s, 'Test', { levelIds: s.levels.map(l => l.id), layerIds: s.layers.map(l => l.id), scale: 100 });
  const j = JSON.parse(String(f.content));
  near(j.total.surfaceHabitableM2, computeStats(s).areaM2, 0.05);
});

console.log('blocs');
test('JSON invalide, champs obligatoires et bornes', () => {
  assert.equal(parseBlocksJson('{oups').errors.length, 1);
  assert.match(parseBlocksJson('{"widthMm":1000,"heightMm":500}').errors[0], /name/);
  assert.match(parseBlocksJson('{"name":"x","widthMm":5,"heightMm":500}').errors[0], /widthMm/);
});
test('ouverture : 2 vues attendues, catégorie menuiserie, calque ouvertures', () => {
  const r = parseBlocksJson('```json\n{"name":"Fenêtre test","kind":"opening","widthMm":900,"heightMm":200,"zMm":1250}\n```');
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0].category, 'menuiserie');
  assert.equal(r.blocks[0].openingKind, 'window');
  assert.equal(r.blocks[0].defaultLayer, 'ouvertures');
  assert.equal(r.warnings.length, 2); // top + front absents
});
test('prompt IA : liste, schéma et règles', () => {
  const specs = parseSpecLines('Banc design 1500 x 450 x 450\nTable 1200x700', { kind: 'furniture', category: 'sejour', widthMm: 1000, depthMm: 600, zMm: 750 });
  assert.equal(specs.length, 2);
  assert.deepEqual([specs[0].name, specs[0].widthMm, specs[0].depthMm, specs[0].zMm], ['Banc design', 1500, 450, 450]);
  const p = buildBlockPrompt(specs);
  for (const k of ['Banc design', '"views"', 'currentColor', '"top"', '"side"']) assert.ok(p.includes(k), k);
});

console.log('import DXF');
test('LINE, CIRCLE, LWPOLYLINE, unités (m) et recalage', () => {
  const dxf = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', 'MURS', '10', '0', '20', '0', '11', '5', '21', '0',
    '0', 'CIRCLE', '8', 'MOB', '10', '1', '20', '1', '40', '0.5',
    '0', 'LWPOLYLINE', '8', 'CLOISONS', '70', '1', '10', '0', '20', '0', '10', '2', '20', '0', '10', '2', '20', '2',
    '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const r = parseDxf(dxf);
  assert.equal(r.unitFactor, 1000);
  assert.equal(r.entities.length, 3);
  const line = r.entities.find(e => e.type === 'line')!;
  near(Math.abs(line.x2 - line.x1), 500); // 5 m = 500 px
  assert.equal(line.layerId, 'structures');
  assert.equal(r.entities.find(e => e.type === 'polygon')!.layerId, 'cloisons');
  assert.equal(r.entities.find(e => e.type === 'circle')!.layerId, 'mobilier');
  near(Math.min(...r.entities.map(e => Math.min(e.x1, e.x2))), 100);
});

console.log('projets');
test('statistiques de l\'exemple et projet vierge', () => {
  const st = computeStats(sampleSnapshot());
  assert.equal(st.levels, 1);
  assert.ok(st.objects >= 20 && st.areaM2 > 60);
  assert.equal(computeStats(emptySnapshot('Vide')).objects, 0);
});
test('aller-retour fichier projet et sauvegarde complète', () => {
  const snap = sampleSnapshot();
  saveProject('t1', snap, { name: 'Alpha' });
  const file = buildProjectFile({ name: 'Alpha', phase: 'PC', category: 'pc', version: 'v1.0', location: '' }, snap);
  const before = getProjects().length;
  const r = importProjectFile(JSON.stringify(file));
  assert.ok(r.ok);
  assert.equal(getProjects().length, before + 1);
  const ws = buildWorkspaceFile();
  assert.ok(ws.projects.length >= 2);
  const r2 = importProjectFile(JSON.stringify(ws));
  assert.ok(r2.ok);
  assert.equal(importProjectFile('{"format":"autre"}').ok, false);
  assert.equal(importProjectFile('pas du json').ok, false);
});

console.log(`\n${passed} réussi(s), ${failures.length} échec(s)`);
if (failures.length) process.exit(1);
