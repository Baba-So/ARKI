import { CadEntity } from './types.ts';

/**
 * Géométrie des murs et cloisons.
 *
 * Convention : (x1,y1)→(x2,y2) est l'AXE du mur (ligne centrale), 1 px = 10 mm.
 * La « ligne de référence » (gauche / axe / droite, relative au sens du tracé) sert à positionner
 * l'axe au moment du tracé ou lorsqu'on la change dans l'inspecteur : la ligne de référence reste
 * fixe dans le plan et le corps du mur se place d'un côté ou de l'autre.
 */

export type RefLine = 'left' | 'center' | 'right';
export type Pt = { x: number; y: number };

/** Signe du décalage de l'axe par rapport à la ligne de référence, le long de la normale droite du tracé. */
export const refSign = (r?: RefLine): number => (r === 'left' ? 1 : r === 'right' ? -1 : 0);

export const justifToRef = (j: string): RefLine => (j === 'Nu Gauche' ? 'left' : j === 'Nu Droite' ? 'right' : 'center');

/** Décale un segment le long de sa normale droite (écran, Y vers le bas) de `d` px. */
export const shiftSegment = (x1: number, y1: number, x2: number, y2: number, d: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return { x1: x1 + nx * d, y1: y1 + ny * d, x2: x2 + nx * d, y2: y2 + ny * d };
};

/** Segment défini par ses points de ligne de référence → axe réel du mur. */
export const refToCenterline = (x1: number, y1: number, x2: number, y2: number, thicknessMm: number, ref: RefLine) =>
  shiftSegment(x1, y1, x2, y2, (refSign(ref) * thicknessMm) / 20);

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

const lineInt = (p: Pt, d: Pt, q: Pt, e: Pt): Pt | null => {
  const den = cross(d.x, d.y, e.x, e.y);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(q.x - p.x, q.y - p.y, e.x, e.y) / den;
  return { x: p.x + d.x * s, y: p.y + d.y * s };
};

interface Seg {
  id: string;
  type: CadEntity['type'];
  a: Pt;
  b: Pt;
  u: Pt;
  n: Pt;
  len: number;
  h: number; // demi-épaisseur (px)
}

const MIN_SIN = 0.17; // ~10° : en dessous les murs sont considérés parallèles (pas de raccord)

/**
 * Calcule le polygone (4 points) de chaque mur en résolvant les raccords :
 *  - angle (L)  : onglet (miter) entre les deux murs de même nature ;
 *  - té (T)     : le mur / la cloison qui arrive est prolongé ou raccourci jusqu'à la face du mur porteur.
 * Dessinés avec la technique « contours puis remplissages », les murs raccordés forment une seule maçonnerie continue.
 */
export function computeWallPolygons(walls: CadEntity[]): Record<string, Pt[]> {
  const segs: Seg[] = walls
    .map(w => {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (len < 1e-6) return null;
      const u = { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len };
      return {
        id: w.id,
        type: w.type,
        a: { x: w.x1, y: w.y1 },
        b: { x: w.x2, y: w.y2 },
        u,
        n: { x: -u.y, y: u.x },
        len,
        h: (w.thickness || (w.type === 'partition' ? 72 : 200)) / 20,
      } as Seg;
    })
    .filter((s): s is Seg => !!s);

  const result: Record<string, Pt[]> = {};

  const endPoints = (w: Seg, end: 0 | 1): { plus: Pt; minus: Pt } => {
    const E = end === 0 ? w.a : w.b;
    const dw = end === 0 ? w.u : { x: -w.u.x, y: -w.u.y };
    const nw = { x: -dw.y, y: dw.x }; // normale de dw ; côté « σ=+1 »
    const square = {
      plus: { x: E.x + w.n.x * w.h, y: E.y + w.n.y * w.h },
      minus: { x: E.x - w.n.x * w.h, y: E.y - w.n.y * w.h },
    };

    // Recherche du meilleur raccord
    let best: { o: Seg; X: Pt; to: number; score: number } | null = null;
    for (const o of segs) {
      if (o.id === w.id) continue;
      // une cloison peut se raccorder sur un mur ; un mur ne se raccorde jamais sur une cloison
      if (!(w.type === o.type || (w.type === 'partition' && o.type === 'wall'))) continue;
      const c = cross(w.u.x, w.u.y, o.u.x, o.u.y);
      if (Math.abs(c) < MIN_SIN) continue;
      const X = lineInt(w.a, w.u, o.a, o.u);
      if (!X) continue;
      const sE = end === 0 ? 0 : w.len;
      const sX = (X.x - w.a.x) * w.u.x + (X.y - w.a.y) * w.u.y;
      const tol = w.h + o.h + 2;
      if (Math.abs(sX - sE) > tol) continue;
      const to = (X.x - o.a.x) * o.u.x + (X.y - o.a.y) * o.u.y;
      if (to < -tol || to > o.len + tol) continue;
      const score = Math.abs(sX - sE);
      if (!best || score < best.score) best = { o, X, to, score };
    }
    if (!best) return square;

    const { o, X, to } = best;
    const tolEnd = w.h + o.h + 2;
    const atOEnd = to <= tolEnd || to >= o.len - tolEnd;
    const edge = (center: Pt, d: Pt, nrm: Pt, hh: number, sigma: number) => ({
      p: { x: center.x + nrm.x * sigma * hh, y: center.y + nrm.y * sigma * hh },
      d,
    });

    let P: { sPlus: Pt | null; sMinus: Pt | null } = { sPlus: null, sMinus: null }; // par σ_dw = +1 / −1

    if (atOEnd && w.type === o.type) {
      // Angle : onglet
      const dO = to <= tolEnd && to < o.len / 2 ? o.u : { x: -o.u.x, y: -o.u.y };
      const nO = { x: -dO.y, y: dO.x };
      const sgn = Math.sign(cross(dw.x, dw.y, dO.x, dO.y)) || 1;
      const wEdge = (sg: number) => edge(X, dw, nw, w.h, sg);
      const oEdge = (sg: number) => edge(X, dO, nO, o.h, sg);
      const I = lineInt(wEdge(sgn).p, dw, oEdge(-sgn).p, dO);
      const O = lineInt(wEdge(-sgn).p, dw, oEdge(sgn).p, dO);
      if (!I || !O) return square;
      if (sgn > 0) P = { sPlus: I, sMinus: O };
      else P = { sPlus: O, sMinus: I };
    } else {
      // Té : jusqu'à la face du mur hôte tournée vers le mur qui arrive
      const sigma = Math.sign(dw.x * o.n.x + dw.y * o.n.y) || 1;
      const face = edge(X, o.u, o.n, o.h, sigma);
      const pPlus = lineInt(edge(X, dw, nw, w.h, 1).p, dw, face.p, face.d);
      const pMinus = lineInt(edge(X, dw, nw, w.h, -1).p, dw, face.p, face.d);
      if (!pPlus || !pMinus) return square;
      P = { sPlus: pPlus, sMinus: pMinus };
    }

    // σ_dw → côté « + » du mur (normale n = (−u.y, u.x))
    const plusIsDwPlus = end === 0;
    const plus = plusIsDwPlus ? P.sPlus! : P.sMinus!;
    const minus = plusIsDwPlus ? P.sMinus! : P.sPlus!;

    // Garde-fou : un raccord aberrant retombe sur l'extrémité droite
    const maxD = w.h * 2 + o.h * 2 + 12 + w.len;
    const far = (p: Pt) => Math.hypot(p.x - E.x, p.y - E.y) > maxD;
    if (far(plus) || far(minus)) return square;
    return { plus, minus };
  };

  segs.forEach(w => {
    const A = endPoints(w, 0);
    const B = endPoints(w, 1);
    result[w.id] = [A.plus, B.plus, B.minus, A.minus];
  });
  return result;
}

export const polyToPoints = (pts: Pt[]) => pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
