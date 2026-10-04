import { CadLevel } from './types.ts';

export const DEFAULT_SLAB = 200; // épaisseur de dalle par défaut (mm)
export const DEFAULT_LEVEL_HEIGHT = 2800; // hauteur par défaut (mm)

/** Épaisseur de la dalle située SOUS le plancher fini du niveau (mm). */
export const slabOf = (l: Pick<CadLevel, 'slabMm'>) => l.slabMm ?? DEFAULT_SLAB;

/**
 * Recalcule les altitudes pour que les niveaux s'empilent exactement :
 *   altitude(n) = altitude(n−1) + hauteur(n−1) + dalle(n)        (au-dessus du niveau d'ancrage)
 *   altitude(n) = altitude(n+1) − dalle(n+1) − hauteur(n)        (en dessous : sous-sols)
 * Le niveau d'ancrage est celui dont l'altitude est la plus proche de 0 (le RDC) : il ne bouge pas.
 */
export function restackLevels(levels: CadLevel[]): CadLevel[] {
  const sorted = [...levels].sort((a, b) => a.elevation - b.elevation).map(l => ({ ...l }));
  if (!sorted.length) return sorted;
  let anchor = 0;
  sorted.forEach((l, i) => { if (Math.abs(l.elevation) < Math.abs(sorted[anchor].elevation)) anchor = i; });
  for (let i = anchor + 1; i < sorted.length; i++) sorted[i].elevation = sorted[i - 1].elevation + sorted[i - 1].height + slabOf(sorted[i]);
  for (let i = anchor - 1; i >= 0; i--) sorted[i].elevation = sorted[i + 1].elevation - slabOf(sorted[i + 1]) - sorted[i].height;
  return sorted;
}

/** Hauteur hors tout du bâtiment : du dessous de la dalle la plus basse au-dessus de la toiture (mm). */
export function buildingExtent(levels: CadLevel[]) {
  if (!levels.length) return { bottom: 0, top: 0, total: 0 };
  const sorted = [...levels].sort((a, b) => a.elevation - b.elevation);
  const bottom = sorted[0].elevation - slabOf(sorted[0]);
  const last = sorted[sorted.length - 1];
  const top = last.elevation + last.height + slabOf(last); // dalle de toiture de même épaisseur que celle du dernier niveau
  return { bottom, top, total: top - bottom };
}

/** Nom suggéré pour un étage ajouté : R+1, R+2… ou SS-1, SS-2… */
export const defaultLevelName = (levels: CadLevel[], where: 'above' | 'below') =>
  where === 'above' ? `R+${levels.filter(l => l.elevation > 0).length + 1}` : `SS-${levels.filter(l => l.elevation < 0).length + 1}`;

/** Famille d'un niveau d'après son altitude. */
export const levelKind = (l: CadLevel) => (l.elevation < 0 ? 'Sous-sol' : l.elevation === 0 ? 'Rez-de-chaussée' : 'Étage');
