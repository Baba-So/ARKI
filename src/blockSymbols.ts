import { BlockViews, CadBlock } from './types.ts';

/**
 * Symboles SVG des blocs : vue de dessus, vue de face et vue latérale, générées de façon paramétrique
 * à partir des dimensions réelles du bloc (mm) et de son `renderType`.
 *
 * Tous les dessins sont des fragments SVG dans un repère en MILLIMÈTRES, origine en haut à gauche,
 * dessinés avec `currentColor` (la couleur est fournie par le conteneur : ambre, cyan, vert, noir à l'impression).
 *
 * Les blocs importés peuvent fournir leurs propres vues (`block.views`) ; elles remplacent alors ces symboles.
 */

type RT = CadBlock['renderType'];

const f = (v: number) => Math.round(v * 10) / 10;
const SW = 12; // épaisseur de trait par défaut (mm)

type Fill = 'none' | 'soft' | 'solid';
interface Opt { rx?: number; fill?: Fill; dash?: boolean; sw?: number; op?: number }

const fillAttr = (fill: Fill = 'none') =>
  fill === 'soft' ? 'fill="currentColor" fill-opacity="0.16"' : fill === 'solid' ? 'fill="currentColor" fill-opacity="0.55"' : 'fill="none"';
const common = (o: Opt) =>
  `${fillAttr(o.fill)} stroke="currentColor" stroke-width="${o.sw ?? SW}" stroke-linejoin="round" stroke-linecap="round"` +
  `${o.dash ? ` stroke-dasharray="${(o.sw ?? SW) * 3} ${(o.sw ?? SW) * 2}"` : ''}${o.op ? ` stroke-opacity="${o.op}"` : ''}`;

const rect = (x: number, y: number, w: number, h: number, o: Opt = {}) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(w, 0))}" height="${f(Math.max(h, 0))}"${o.rx ? ` rx="${f(o.rx)}"` : ''} ${common(o)}/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, o: Opt = {}) =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(Math.max(rx, 0))}" ry="${f(Math.max(ry, 0))}" ${common(o)}/>`;
const circle = (cx: number, cy: number, r: number, o: Opt = {}) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${common(o)}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, o: Opt = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${common(o)}/>`;
const path = (d: string, o: Opt = {}) => `<path d="${d}" ${common(o)}/>`;

/** Hauteur verticale (Z) du bloc : valeur fournie, sinon valeur typique du type d'objet. */
export const blockZ = (b: CadBlock): number => {
  if (b.zMm && b.zMm > 0) return b.zMm;
  const n = b.name.toLowerCase();
  if (/tv|média|media/.test(n)) return 500;
  if (/dressing|armoire|penderie/.test(n)) return 2300;
  if (/plaque|cuisson|induction/.test(n)) return 60;
  if (/baie/.test(n)) return 2150;
  if (/transat|bain de soleil/.test(n)) return 350;
  if (/table basse/.test(n)) return 400;
  const base: Record<RT, number> = { table: 750, sofa: 850, bed: 1000, bath: 580, shower: 2000, sink: 850, wc: 420, island: 900, door: 2100, window: 1250, generic: 800 };
  return base[b.renderType] ?? 800;
};

export const isOpeningBlock = (b: CadBlock) => b.kind === 'opening' || (b.kind === undefined && (b.category === 'menuiserie' || b.renderType === 'door' || b.renderType === 'window'));
export const openingKindOf = (b: CadBlock): 'door' | 'window' => b.openingKind ?? (b.renderType === 'window' ? 'window' : 'door');

/** Déduit le type de symbole d'après le nom d'un meuble (entités posées sans bloc d'origine). */
export const inferRenderType = (name: string): RT => {
  const n = name.toLowerCase();
  if (/canap|sofa|fauteuil/.test(n)) return 'sofa';
  if (/\blit\b|lit /.test(n)) return 'bed';
  if (/baignoire/.test(n)) return 'bath';
  if (/douche/.test(n)) return 'shower';
  if (/évier|vasque|lavabo/.test(n)) return 'sink';
  if (/\bwc\b|toilet/.test(n)) return 'wc';
  if (/îlot|ilot/.test(n)) return 'island';
  if (/table/.test(n)) return 'table';
  return 'generic';
};

// ───────────────────────────── Vue de dessus ─────────────────────────────

const topView = (rt: RT, w: number, d: number): string => {
  switch (rt) {
    case 'table': {
      if (d < 700) return rect(0, 0, w, d, { rx: 40, fill: 'soft' }) + rect(w * 0.06, d * 0.12, w * 0.88, d * 0.76, { rx: 20, op: 0.5, sw: 8 });
      const n = Math.max(2, Math.round(w / 600));
      const cd = Math.min(380, d * 0.2), cw = Math.min(420, (w / n) * 0.7);
      let s = rect(w * 0.03, cd * 0.7, w * 0.94, d - cd * 1.4, { rx: 30, fill: 'soft' });
      for (let i = 0; i < n; i++) {
        const cx = ((i + 0.5) * w) / n;
        s += rect(cx - cw / 2, 0, cw, cd * 0.85, { rx: 45 }) + rect(cx - cw / 2, d - cd * 0.85, cw, cd * 0.85, { rx: 45 });
      }
      return s;
    }
    case 'sofa': {
      const k = Math.max(2, Math.round(w / 700));
      let s = rect(0, 0, w, d, { rx: 80, fill: 'soft' }) + rect(0, 0, w, d * 0.22, { rx: 80 }) + rect(0, d * 0.22, w * 0.07, d * 0.78, { rx: 50 }) + rect(w * 0.93, d * 0.22, w * 0.07, d * 0.78, { rx: 50 });
      for (let i = 1; i < k; i++) s += line(w * 0.07 + (w * 0.86 * i) / k, d * 0.22, w * 0.07 + (w * 0.86 * i) / k, d, { sw: 8, op: 0.6 });
      return s;
    }
    case 'bed': {
      const m = w > 1300 ? 2 : 1, pw = (w / m) * 0.72;
      let s = rect(0, 0, w, d, { rx: 40, fill: 'soft' }) + rect(0, 0, w, 110, { fill: 'solid' });
      for (let i = 0; i < m; i++) s += rect(((i + 0.5) * w) / m - pw / 2, 170, pw, 380, { rx: 70 });
      s += line(0, d * 0.4, w, d * 0.4, { dash: true, sw: 8 }) + rect(50, d * 0.4, w - 100, d * 0.6 - 50, { rx: 40, op: 0.45, sw: 8 });
      return s;
    }
    case 'bath':
      return rect(0, 0, w, d, { rx: Math.min(d / 2, 420), fill: 'soft' }) + ellipse(w / 2, d / 2, w / 2 - 110, d / 2 - 90) + circle(w * 0.14, d / 2, 32) + rect(w * 0.02, d / 2 - 40, 60, 80, { rx: 20 });
    case 'shower':
      return rect(0, 0, w, d, { fill: 'soft' }) + rect(70, 70, w - 140, d - 140, { op: 0.5, sw: 8 }) + circle(w / 2, d / 2, 45) +
        line(w / 2 - 120, d / 2, w / 2 + 120, d / 2, { sw: 8, op: 0.6 }) + line(0, d - 18, w, d - 18, { dash: true, sw: 10 });
    case 'sink': {
      const m = w > 1000 ? 2 : 1, bw = (w / m) * 0.7;
      let s = rect(0, 0, w, d, { rx: 20, fill: 'soft' });
      for (let i = 0; i < m; i++) {
        const cx = ((i + 0.5) * w) / m;
        s += rect(cx - bw / 2, d * 0.28, bw, d * 0.58, { rx: 70 }) + circle(cx, d * 0.5, 22, { sw: 8 }) + circle(cx, d * 0.13, 26, { fill: 'solid' });
      }
      return s;
    }
    case 'wc':
      return rect(w * 0.1, 0, w * 0.8, d * 0.26, { rx: 30, fill: 'soft' }) + ellipse(w / 2, d * 0.26 + (d * 0.74) / 2, w * 0.42, d * 0.37) + ellipse(w / 2, d * 0.26 + (d * 0.74) / 2, w * 0.31, d * 0.28, { sw: 8, op: 0.6 });
    case 'island': {
      let s = rect(0, 0, w, d, { rx: 20, fill: 'soft' }) + rect(w * 0.06, d * 0.2, w * 0.3, d * 0.5, { rx: 40 }) + circle(w * 0.21, d * 0.45, 30, { sw: 8 }) + circle(w * 0.21, d * 0.12, 24, { fill: 'solid' });
      for (const [cx, cy] of [[0.62, 0.32], [0.78, 0.32], [0.62, 0.62], [0.78, 0.62]]) s += circle(w * cx, d * cy, Math.min(d, w) * 0.07, { sw: 8 });
      return s;
    }
    case 'door': {
      const jw = Math.min(80, w * 0.06);
      let s = rect(0, 0, jw, d, { fill: 'soft' }) + rect(w - jw, 0, jw, d, { fill: 'soft' }) + rect(jw, d / 2 - 20, w - 2 * jw, 40, { fill: 'soft' });
      if (w > 1200) s += line(w / 2, d / 2 - 20, w / 2, d / 2 + 20, { sw: 8 });
      return s;
    }
    case 'window': {
      const jw = Math.min(80, w * 0.05);
      let s = rect(0, 0, jw, d, { fill: 'soft' }) + rect(w - jw, 0, jw, d, { fill: 'soft' }) + rect(jw, d * 0.75, w - 2 * jw, d * 0.25, { fill: 'soft' });
      if (w > 2000) s += rect(jw, d * 0.3, (w - 2 * jw) / 2 + 25, 24) + rect(w / 2 - 25, d * 0.3 + 70, (w - 2 * jw) / 2 + 25, 24);
      else s += rect(jw, d * 0.3, w - 2 * jw, 24) + rect(jw, d * 0.3 + 70, w - 2 * jw, 24);
      return s;
    }
    default:
      return rect(0, 0, w, d, { rx: 30, fill: 'soft' }) + rect(w * 0.05, d * 0.12, w * 0.9, d * 0.76, { rx: 15, sw: 8, op: 0.5 }) +
        line(0, 0, w, d, { sw: 6, op: 0.18 }) + line(w, 0, 0, d, { sw: 6, op: 0.18 });
  }
};

// ───────────────────────────── Vue de face ─────────────────────────────

const frontView = (rt: RT, w: number, z: number): string => {
  switch (rt) {
    case 'table':
      return rect(0, 0, w, 45, { fill: 'soft' }) + rect(w * 0.04, 45, 60, z - 45) + rect(w * 0.96 - 60, 45, 60, z - 45) + line(w * 0.04 + 60, 130, w * 0.96 - 60, 130, { sw: 8, op: 0.5 });
    case 'sofa':
      return rect(w * 0.07, 0, w * 0.86, z * 0.55, { rx: 60, fill: 'soft' }) + rect(w * 0.07, z * 0.5, w * 0.86, z * 0.28, { rx: 40, fill: 'soft' }) +
        rect(0, z * 0.35, w * 0.09, z * 0.55, { rx: 50, fill: 'soft' }) + rect(w * 0.91, z * 0.35, w * 0.09, z * 0.55, { rx: 50, fill: 'soft' }) +
        rect(w * 0.05, z * 0.9, 50, z * 0.1) + rect(w * 0.95 - 50, z * 0.9, 50, z * 0.1);
    case 'bed':
      return rect(0, 0, w, z * 0.78, { rx: 40 }) + rect(w * 0.02, z * 0.45, w * 0.96, z * 0.28, { rx: 40, fill: 'soft' }) + rect(0, z * 0.7, w, z * 0.14, { fill: 'soft' }) +
        rect(w * 0.03, z * 0.84, 60, z * 0.16) + rect(w * 0.97 - 60, z * 0.84, 60, z * 0.16);
    case 'bath':
      return path(`M0 0 L${f(w)} 0 L${f(w * 0.94)} ${f(z)} L${f(w * 0.06)} ${f(z)} Z`, { fill: 'soft' }) + line(0, 70, w, 70, { sw: 8, op: 0.5 });
    case 'shower':
      return rect(0, z - 70, w, 70, { fill: 'soft' }) + rect(w * 0.05, 0, w * 0.9, z - 70, { op: 0.8 }) + line(w * 0.2, 0, w * 0.35, z - 70, { sw: 6, op: 0.3 }) + line(w * 0.88, z * 0.45, w * 0.88, z * 0.6, { sw: 18 });
    case 'sink': {
      const m = w > 1000 ? 2 : 1;
      let s = rect(0, 0, w, 40, { fill: 'soft' }) + rect(w * 0.02, 40, w * 0.96, z - 140, { fill: 'soft' }) + rect(w * 0.05, z - 100, w * 0.9, 100);
      for (let i = 1; i < m; i++) s += line((w * i) / m, 40, (w * i) / m, z - 100, { sw: 8 });
      return s;
    }
    case 'wc':
      return rect(w * 0.15, 0, w * 0.7, z * 0.55, { rx: 30, fill: 'soft' }) + rect(w * 0.4, z * 0.1, w * 0.2, z * 0.07, { rx: 15, sw: 8 }) + rect(w * 0.1, z * 0.55, w * 0.8, z * 0.45, { rx: 110, fill: 'soft' });
    case 'island': {
      const n = Math.max(1, Math.round(w / 600));
      let s = rect(0, 0, w, 50, { fill: 'soft' }) + rect(w * 0.04, 50, w * 0.92, z - 130, { fill: 'soft' }) + rect(w * 0.06, z - 80, w * 0.88, 80);
      for (let i = 1; i < n; i++) s += line(w * 0.04 + (w * 0.92 * i) / n, 50, w * 0.04 + (w * 0.92 * i) / n, z - 80, { sw: 8 });
      return s;
    }
    case 'door': {
      const jw = Math.min(70, w * 0.06);
      let s = rect(0, 0, w, z, { sw: SW + 6 }) + rect(jw, jw, w - 2 * jw, z - jw, { fill: 'soft' }) +
        rect(jw + 70, jw + 90, w - 2 * jw - 140, (z - jw) * 0.38, { sw: 8, op: 0.55 }) + rect(jw + 70, jw + 90 + (z - jw) * 0.38 + 90, w - 2 * jw - 140, (z - jw) * 0.38, { sw: 8, op: 0.55 }) +
        circle(w - jw - 90, z * 0.5, 28, { fill: 'solid' });
      if (w > 1200) s += line(w / 2, jw, w / 2, z, { sw: 10 });
      return s;
    }
    case 'window': {
      const jw = Math.min(70, w * 0.05);
      let s = rect(0, 0, w, z, { sw: SW + 6 }) + rect(w * 0.0, z - 60, w, 60, { fill: 'soft' });
      if (w > 2000) s += rect(jw, jw, (w - 2 * jw) / 2 + 30, z - 60 - 2 * jw, { fill: 'soft' }) + rect(w / 2 - 30, jw, (w - 2 * jw) / 2 + 30, z - 60 - 2 * jw, { fill: 'soft' });
      else {
        const n = w > 1300 ? 2 : 1;
        for (let i = 0; i < n; i++) s += rect(jw + ((w - 2 * jw) * i) / n, jw, (w - 2 * jw) / n, z - 60 - 2 * jw, { fill: 'soft' });
      }
      return s;
    }
    default:
      return rect(0, 0, w, z, { rx: 30, fill: 'soft' }) + rect(w * 0.05, z * 0.1, w * 0.9, z * 0.8, { rx: 15, sw: 8, op: 0.5 }) + line(w / 2, z * 0.1, w / 2, z * 0.9, { sw: 8, op: 0.5 });
  }
};

// ───────────────────────────── Vue latérale ─────────────────────────────

const sideView = (rt: RT, d: number, z: number): string => {
  switch (rt) {
    case 'table':
      return rect(0, 0, d, 45, { fill: 'soft' }) + rect(d * 0.06, 45, 60, z - 45) + rect(d * 0.94 - 60, 45, 60, z - 45);
    case 'sofa':
      return rect(0, 0, d * 0.22, z * 0.9, { rx: 60, fill: 'soft' }) + rect(0, z * 0.5, d, z * 0.28, { rx: 40, fill: 'soft' }) + rect(d * 0.1, z * 0.36, d * 0.9, z * 0.14, { rx: 40, sw: 8, op: 0.6 }) +
        rect(d * 0.06, z * 0.9, 50, z * 0.1) + rect(d * 0.94 - 50, z * 0.9, 50, z * 0.1);
    case 'bed':
      return rect(0, 0, 100, z, { fill: 'soft' }) + rect(100, z * 0.45, d - 100, z * 0.28, { rx: 40, fill: 'soft' }) + rect(100, z * 0.7, d - 100, z * 0.14, { fill: 'soft' }) +
        rect(d - 80, z * 0.55, 80, z * 0.45, { fill: 'soft' }) + rect(120, z * 0.84, 60, z * 0.16) + rect(d - 180, z * 0.84, 60, z * 0.16);
    case 'bath':
      return rect(0, 0, d, z, { rx: 160, fill: 'soft' }) + line(60, 90, d - 60, 90, { sw: 8, op: 0.5 });
    case 'shower':
      return rect(0, z - 70, d, 70, { fill: 'soft' }) + line(0, 0, 0, z - 70, { sw: 20 }) + line(d - 10, 0, d - 10, z - 70, { dash: true });
    case 'sink':
      return rect(0, 0, d, 40, { fill: 'soft' }) + rect(0, 40, d * 0.96, z - 140, { fill: 'soft' }) + rect(d * 0.05, z - 100, d * 0.8, 100) + path(`M${f(d * 0.25)} 40 Q${f(d * 0.5)} 190 ${f(d * 0.75)} 40`, { sw: 8 });
    case 'wc':
      return rect(0, 0, d * 0.28, z * 0.9, { rx: 30, fill: 'soft' }) + path(`M${f(d * 0.28)} ${f(z * 0.5)} L${f(d * 0.95)} ${f(z * 0.5)} Q${f(d)} ${f(z * 0.75)} ${f(d * 0.8)} ${f(z * 0.96)} L${f(d * 0.28)} ${f(z * 0.96)} Z`, { fill: 'soft' });
    case 'island':
      return rect(0, 0, d + 0, 50, { fill: 'soft' }) + rect(d * 0.06, 50, d * 0.88, z - 130, { fill: 'soft' }) + rect(d * 0.1, z - 80, d * 0.8, 80);
    default:
      return rect(0, 0, d, z, { rx: 30, fill: 'soft' }) + rect(d * 0.08, z * 0.1, d * 0.84, z * 0.8, { rx: 15, sw: 8, op: 0.5 });
  }
};

export interface ResolvedViews { top: string; front: string; side?: string; w: number; d: number; z: number }

/** Vues effectives d'un bloc : celles fournies (importées) sinon les symboles paramétriques. */
export const blockViews = (b: CadBlock): ResolvedViews => {
  const w = b.widthMm, d = b.heightMm, z = blockZ(b);
  const v: BlockViews = b.views || {};
  const rt = b.renderType;
  const opening = isOpeningBlock(b);
  const orender: RT = opening ? (openingKindOf(b) === 'window' ? 'window' : 'door') : rt;
  return {
    top: v.top || topView(orender, w, d),
    front: v.front || frontView(orender, w, z),
    side: opening ? undefined : v.side || sideView(rt, d, z),
    w, d, z,
  };
};

/** Libellés des vues selon le type de bloc. */
export const viewLabels = (b: CadBlock) =>
  isOpeningBlock(b)
    ? { top: 'Coupe (dessus)', front: 'Face', side: '' }
    : { top: 'Dessus', front: 'Face', side: 'Latérale' };
