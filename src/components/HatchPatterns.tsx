import React from 'react';

export type HatchKind = 'briques' | 'beton' | 'bois' | 'isolation' | 'carrelage' | 'sable';
export const HATCH_KINDS: HatchKind[] = ['briques', 'beton', 'bois', 'isolation', 'carrelage', 'sable'];

interface HatchPatternDefProps {
  id: string;
  kind: HatchKind;
  /** Échelle du motif (1 = taille d'origine). */
  scale?: number;
  /** Couleur imposée (remplace les couleurs d'origine des traits). */
  color?: string;
}

/**
 * Motif de hachure SVG (à placer dans <defs>). Les motifs standard (échelle 1, couleurs d'origine) et les variantes
 * personnalisées d'une entité (échelle / couleur) partagent la même définition.
 */
export const HatchPatternDef: React.FC<HatchPatternDefProps> = ({ id, kind, scale = 1, color }) => {
  const t = scale !== 1 ? `scale(${scale})` : undefined;
  switch (kind) {
    case 'briques': {
      const c = color || '#f97316';
      return (
        <pattern id={id} width="28" height="14" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="28" height="14" fill="#0d1b2a" fillOpacity="0.6" />
          <line x1="0" y1="0" x2="28" y2="0" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
          <line x1="0" y1="7" x2="28" y2="7" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
          <line x1="0" y1="14" x2="28" y2="14" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="7" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
          <line x1="14" y1="7" x2="14" y2="14" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
          <line x1="28" y1="0" x2="28" y2="7" stroke={c} strokeWidth="1" strokeOpacity="0.6" />
        </pattern>
      );
    }
    case 'beton': {
      const c = color || '#94a3b8';
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="22" height="22" fill="#0c1d2e" fillOpacity="0.6" />
          <polygon points="4,5 8,11 3,10" fill="none" stroke={c} strokeWidth="0.8" strokeOpacity="0.75" />
          <polygon points="15,15 18,18 13,19" fill="none" stroke={c} strokeWidth="0.8" strokeOpacity="0.75" />
          <circle cx="13" cy="7" r="0.9" fill={c} fillOpacity="0.75" />
          <circle cx="6" cy="18" r="0.9" fill={c} fillOpacity="0.75" />
          <circle cx="19" cy="11" r="0.7" fill={c} fillOpacity="0.6" />
        </pattern>
      );
    }
    case 'bois': {
      const c = color || '#f59e0b';
      const v = color || '#d97706';
      return (
        <pattern id={id} width="32" height="16" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="32" height="16" fill="#141923" fillOpacity="0.6" />
          <line x1="0" y1="0" x2="32" y2="0" stroke={c} strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="0" y1="8" x2="32" y2="8" stroke={c} strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="0" y1="16" x2="32" y2="16" stroke={c} strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="16" y1="8" x2="16" y2="16" stroke={c} strokeWidth="0.9" strokeOpacity="0.6" />
          <path d="M 4,4 Q 16,2 26,5" fill="none" stroke={v} strokeWidth="0.6" strokeOpacity="0.35" />
          <path d="M 2,12 Q 14,10 28,13" fill="none" stroke={v} strokeWidth="0.6" strokeOpacity="0.35" />
        </pattern>
      );
    }
    case 'isolation': {
      const c = color || '#eab308';
      const d = color || '#ca8a04';
      return (
        <pattern id={id} width="20" height="16" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="20" height="16" fill="#101c28" fillOpacity="0.6" />
          <path d="M 0,8 Q 5,0 10,8 T 20,8" fill="none" stroke={c} strokeWidth="1" strokeOpacity="0.65" />
          <line x1="0" y1="0" x2="20" y2="0" stroke={d} strokeWidth="0.6" strokeDasharray="2 2" strokeOpacity="0.4" />
          <line x1="0" y1="16" x2="20" y2="16" stroke={d} strokeWidth="0.6" strokeDasharray="2 2" strokeOpacity="0.4" />
        </pattern>
      );
    }
    case 'carrelage': {
      const c = color || '#38bdf8';
      return (
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="18" height="18" fill="#0d2438" fillOpacity="0.6" />
          <line x1="0" y1="0" x2="18" y2="0" stroke={c} strokeWidth="0.8" strokeOpacity="0.55" />
          <line x1="0" y1="0" x2="0" y2="18" stroke={c} strokeWidth="0.8" strokeOpacity="0.55" />
        </pattern>
      );
    }
    default: {
      const c = color || '#94a3b8';
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform={t}>
          <rect width="14" height="14" fill="#151e28" fillOpacity="0.6" />
          <circle cx="3" cy="3" r="0.75" fill={c} fillOpacity="0.65" />
          <circle cx="10" cy="4" r="0.6" fill={c} fillOpacity="0.55" />
          <circle cx="6" cy="10" r="0.8" fill={c} fillOpacity="0.65" />
          <circle cx="12" cy="11" r="0.6" fill={c} fillOpacity="0.55" />
        </pattern>
      );
    }
  }
};

/** Identifiant du motif à utiliser pour une entité : standard, ou variante personnalisée (échelle / couleur). */
export const hatchPatternId = (e: { id: string; hatchPattern?: string; hatchScale?: number; hatchColor?: string }) =>
  (e.hatchScale && e.hatchScale !== 1) || e.hatchColor ? `hatchx-${e.id}` : `hatch-${e.hatchPattern}`;
