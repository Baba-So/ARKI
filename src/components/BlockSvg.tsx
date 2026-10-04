import React from 'react';
import { CadBlock } from '../types.ts';
import { blockViews, isOpeningBlock } from '../blockSymbols.ts';

/** Couleur d'affichage d'un bloc selon sa famille (la vue SVG est dessinée en currentColor). */
export const blockColor = (b: CadBlock): string =>
  isOpeningBlock(b) ? '#4edea3' : b.category === 'sanitaire' ? '#4cd7f6' : '#ffb95f';

interface BlockSvgProps {
  block: CadBlock;
  view: 'top' | 'front' | 'side';
  color?: string;
  className?: string;
  /** Étire la vue pour remplir exactement la boîte (plan) au lieu de conserver les proportions (fiche, vignette). */
  stretch?: boolean;
  /** Position/taille en coordonnées parentes : permet d'imbriquer le bloc dans un SVG (plan, façade, planche). */
  box?: { x: number; y: number; width: number; height: number };
}

/** Dessine une vue (dessus / face / côté) d'un bloc : symbole paramétrique ou SVG importé. */
export const BlockSvg: React.FC<BlockSvgProps> = ({ block, view, color, className, stretch, box }) => {
  const v = blockViews(block);
  const markup = view === 'top' ? v.top : view === 'front' ? v.front : v.side || '';
  const vbW = view === 'side' ? v.d : v.w;
  const vbH = view === 'top' ? v.d : v.z;
  return (
    <svg
      {...(box ? { x: box.x, y: box.y, width: box.width, height: box.height } : {})}
      viewBox={box ? `0 0 ${vbW} ${vbH}` : `-10 -10 ${vbW + 20} ${vbH + 20}`}
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
      className={className}
      style={{ color: color || blockColor(block), overflow: 'visible', pointerEvents: box ? 'none' : undefined }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};
