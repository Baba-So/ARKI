import { LayoutSheet, SheetFormat } from './types.ts';

/** Modèle des planches de mise en page : formats papier, marges, création d'une planche par défaut (unités : mm papier). */

export const FORMATS: Record<SheetFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};
export const SCALES = [20, 50, 75, 100, 125, 150, 200, 250, 500];
export const MARGIN = 10;
export const CART_H = 36;

export const sheetSize = (s: Pick<LayoutSheet, 'format' | 'landscape'>) => {
  const [pw, ph] = FORMATS[s.format];
  return s.landscape ? { W: ph, H: pw } : { W: pw, H: ph };
};

let uid = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${(uid++).toString(36)}`;

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

