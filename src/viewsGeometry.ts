import { CadEntity, CadLevel } from './types.ts';
import { slabOf } from './levels.ts';

/**
 * Projection des plans en façades (élévations) et coupes.
 * Conventions : 1 px plan = 10 mm, plan Y vers le bas (Nord en haut).
 * Un point du plan est projeté en (u, d) : u = abscisse écran (mm), d = profondeur (mm, croissante vers le fond).
 */

export type Dir = 'S' | 'N' | 'E' | 'O';

export const DIR_LABEL: Record<Dir, string> = {
  S: 'Façade Sud',
  N: 'Façade Nord',
  E: 'Façade Est',
  O: 'Façade Ouest',
};

export const LOOK_LABEL: Record<Dir, string> = {
  S: 'regard vers le Nord',
  N: 'regard vers le Sud',
  E: 'regard vers l’Ouest',
  O: 'regard vers l’Est',
};

export const project = (dir: Dir, x: number, y: number) => {
  switch (dir) {
    case 'S': return { u: x * 10, d: -y * 10 };
    case 'N': return { u: -x * 10, d: y * 10 };
    case 'E': return { u: -y * 10, d: -x * 10 };
    case 'O': return { u: y * 10, d: x * 10 };
  }
};

export interface Cut {
  axis: 'x' | 'y'; // axe sur lequel la valeur est fixée
  value: number; // px plan
  dir: Dir;
}

/** Définition d'une coupe AA (horizontale, y plan) ou BB (verticale, x plan). */
export const makeCut = (id: 'AA' | 'BB', value: number, flip: boolean): Cut =>
  id === 'AA' ? { axis: 'y', value, dir: flip ? 'N' : 'S' } : { axis: 'x', value, dir: flip ? 'O' : 'E' };

// Côté conservé (partie du bâtiment située devant le plan de coupe, vue depuis l'observateur)
export const keepSide = (cut: Cut, x: number, y: number) => {
  const v = cut.axis === 'y' ? y : x;
  const sign = cut.dir === 'S' || cut.dir === 'E' ? -1 : 1; // S regarde vers y décroissant, E vers x décroissant
  return (v - cut.value) * sign;
};

export const openingZ = (op: CadEntity) => {
  if (op.type === 'door') return { z0: 0, z1: 2040 };
  const m = (op.label || op.name || '').match(/x\s*(\d{3,4})/i);
  const h = m ? parseInt(m[1], 10) : 1250;
  const sill = op.sillHeight ?? (h >= 2000 ? 0 : 900);
  return { z0: sill, z1: sill + h };
};

export interface Strip {
  id: string;
  wallId: string;
  levelId: string;
  z0: number; // altitude de la base du mur (mm)
  slab: number; // épaisseur de la dalle sous ce niveau (mm)
  uMin: number;
  uMax: number;
  depth: number;
  height: number;
  holes: Array<{ u0: number; u1: number; z0: number; z1: number; kind: 'door' | 'window'; id: string; blockId?: string }>;
  cut: boolean;
  thickness: number;
}

export interface LevelData {
  level: CadLevel;
  walls: CadEntity[];
  openings: CadEntity[];
}

export const buildLevelData = (
  levels: CadLevel[],
  entitiesByLevel: Record<string, CadEntity[]>,
  isLayerVisible: (layerId: string) => boolean,
  hiddenLevels: string[] = []
): LevelData[] =>
  [...levels]
    .sort((a, b) => a.elevation - b.elevation)
    .filter(l => !hiddenLevels.includes(l.id))
    .map(l => {
      const ents = entitiesByLevel[l.id] || [];
      return {
        level: l,
        walls: ents.filter(e => (e.type === 'wall' || e.type === 'partition') && isLayerVisible(e.layerId)),
        openings: ents.filter(e => (e.type === 'door' || e.type === 'window') && isLayerVisible(e.layerId)),
      };
    });

/** Bandes de murs projetées (façade ou coupe), triées du fond vers le premier plan. */
export function buildStrips(levelData: LevelData[], cut: Cut | null, viewDir: Dir): Strip[] {
  const result: Strip[] = [];
  const sideOf = (x: number, y: number) => (cut ? keepSide(cut, x, y) : 1);

  levelData.forEach(({ level, walls: lvWalls, openings }) =>
    lvWalls.forEach(w => {
      const thick = w.thickness || 200;
      const h = w.height || level.height;
      const lz = level.elevation;
      const s1 = sideOf(w.x1, w.y1);
      const s2 = sideOf(w.x2, w.y2);
      if (s1 < 0 && s2 < 0) return; // entièrement derrière l'observateur : supprimé

      // Segment conservé (clip) + éventuelle coupe
      let ax = w.x1, ay = w.y1, bx = w.x2, by = w.y2;
      let crossing: { x: number; y: number; t: number } | null = null;
      if (cut && (s1 < 0 || s2 < 0)) {
        const t = s1 / (s1 - s2);
        const ix = w.x1 + (w.x2 - w.x1) * t;
        const iy = w.y1 + (w.y2 - w.y1) * t;
        crossing = { x: ix, y: iy, t };
        if (s1 < 0) { ax = ix; ay = iy; } else { bx = ix; by = iy; }
      }
      const holes: Strip['holes'] = [];
      const wdx = w.x2 - w.x1, wdy = w.y2 - w.y1;

      openings.filter(o => o.hostWallId === w.id).forEach(o => {
        const { z0, z1 } = openingZ(o);
        const o1 = sideOf(o.x1, o.y1), o2 = sideOf(o.x2, o.y2);
        const p1 = project(viewDir, o.x1, o.y1), p2 = project(viewDir, o.x2, o.y2);
        const u0 = Math.min(p1.u, p2.u), u1 = Math.max(p1.u, p2.u);
        if (cut && o1 < 0 && o2 < 0) return;
        // ouverture à cheval sur le plan de coupe : réservation visible dans la section
        if (cut && o1 * o2 < 0) {
          const t = o1 / (o1 - o2);
          const pu = p1.u + (p2.u - p1.u) * t;
          holes.push({ u0: pu, u1: pu, z0, z1, kind: o.type as 'door' | 'window', id: o.id, blockId: o.blockId });
          return;
        }
        if (u1 - u0 < 5) return;
        holes.push({ u0, u1, z0, z1, kind: o.type as 'door' | 'window', id: o.id, blockId: o.blockId });
      });

      const pa = project(viewDir, ax, ay), pb = project(viewDir, bx, by);
      let uMin = Math.min(pa.u, pb.u), uMax = Math.max(pa.u, pb.u);
      if (uMax - uMin < thick) {
        const c = (uMin + uMax) / 2;
        uMin = c - thick / 2; uMax = c + thick / 2;
      }
      result.push({
        id: `${level.id}:${w.id}`, wallId: w.id, levelId: level.id, z0: lz, slab: slabOf(level),
        uMin, uMax, depth: (pa.d + pb.d) / 2, height: h, holes, cut: false, thickness: thick,
      });

      // Section franche du mur au droit du plan
      if (cut && crossing) {
        const len = Math.hypot(wdx, wdy) || 1;
        // composante du vecteur directeur perpendiculaire au plan
        const n = cut.axis === 'y' ? Math.abs(wdy / len) : Math.abs(wdx / len);
        if (n >= 0.05) {
          const width = Math.min(thick / n, thick * 20);
          const c = project(viewDir, crossing.x, crossing.y);
          result.push({
            id: `${level.id}:${w.id}-cut`,
            wallId: w.id,
            levelId: level.id,
            z0: lz,
            slab: slabOf(level),
            uMin: c.u - width / 2,
            uMax: c.u + width / 2,
            depth: -1e9, // la coupe est toujours au premier plan
            height: h,
            // l'ouverture traversée par le plan de coupe évide toute la largeur de la section du mur
            holes: holes.filter(hh => hh.u0 === hh.u1).map(hh => ({ ...hh, u0: c.u - width / 2, u1: c.u + width / 2 })),
            cut: true,
            thickness: thick,
          });
        }
      }
    })
  );

  return result.sort((a, b) => b.depth - a.depth);
}

export interface ViewBounds {
  minU: number;
  maxU: number;
  minZ: number;
  maxZ: number;
}

export const computeBounds = (strips: Strip[]): ViewBounds => {
  if (!strips.length) return { minU: 0, maxU: 8000, maxZ: 2800, minZ: 0 };
  return {
    minU: Math.min(...strips.map(s => s.uMin)),
    maxU: Math.max(...strips.map(s => s.uMax)),
    maxZ: Math.max(...strips.map(s => s.z0 + s.height)),
    minZ: Math.min(0, ...strips.map(s => s.z0 - s.slab)),
  };
};

export interface ViewSpec {
  type: 'elevation' | 'section';
  dir: Dir;
  sectionId: 'AA' | 'BB';
  cutValue: number;
  flip: boolean;
}

/** Modèle complet d'une vue (façade ou coupe) prêt à être dessiné. */
export function buildViewModel(levelData: LevelData[], spec: ViewSpec) {
  const cut = spec.type === 'section' ? makeCut(spec.sectionId, spec.cutValue, spec.flip) : null;
  const viewDir: Dir = cut ? cut.dir : spec.dir;
  const strips = buildStrips(levelData, cut, viewDir);
  return { cut, viewDir, strips, bounds: computeBounds(strips), levels: levelData.map(d => d.level) };
}

export type ViewModel = ReturnType<typeof buildViewModel>;
