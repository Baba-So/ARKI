import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CadBlock } from '../types.ts';
import { blockViews, isOpeningBlock, openingKindOf, viewLabels } from '../blockSymbols.ts';
import { removeCustomBlock } from '../blockStore.ts';
import { BlockSvg } from './BlockSvg.tsx';

interface BlockDetailDialogProps {
  block: CadBlock;
  onClose: () => void;
  onInsert: (b: CadBlock) => void;
}

/** Fiche d'un bloc : toutes ses vues (3 pour le mobilier, 2 pour une ouverture), ses cotes et l'export JSON. */
export const BlockDetailDialog: React.FC<BlockDetailDialogProps> = ({ block, onClose, onInsert }) => {
  const [copied, setCopied] = useState(false);
  const opening = isOpeningBlock(block);
  const v = blockViews(block);
  const labels = viewLabels(block);
  const views: Array<'top' | 'front' | 'side'> = opening ? ['top', 'front'] : ['top', 'front', 'side'];
  const dims: Record<'top' | 'front' | 'side', string> = {
    top: `${v.w} × ${v.d} mm`,
    front: `${v.w} × ${v.z} mm`,
    side: `${v.d} × ${v.z} mm`,
  };

  const exportJson = async () => {
    // Export au format d'import : les vues effectives (symboles inclus) sont embarquées
    const out = {
      blocks: [{
        name: block.name, kind: opening ? 'opening' : 'furniture', category: block.category,
        ...(opening ? { openingKind: openingKindOf(block) } : {}),
        widthMm: v.w, heightMm: v.d, zMm: v.z, description: block.description,
        views: { top: v.top, front: v.front, ...(opening ? {} : { side: v.side }) },
      }],
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert('Copie impossible.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#051424] border border-primary/40 rounded-xl shadow-2xl p-4 flex flex-col gap-3 font-sans" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-outline-variant/30 pb-2">
          <div className="min-w-0">
            <div className="font-mono text-sm font-bold text-primary truncate">{block.name}</div>
            <div className="font-mono text-[10px] text-outline">
              {opening ? `Ouverture (${openingKindOf(block) === 'window' ? 'fenêtre' : 'porte'}) · largeur ${v.w} · épaisseur de mur ${v.d} · hauteur ${v.z} mm`
                : `${block.category} · ${v.w} × ${v.d} × ${v.z} mm (L × P × H)`}
              {block.custom && <span className="ml-2 px-1 rounded bg-primary/20 text-primary">importé</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}>
          {views.map(k => (
            <div key={k} className="bg-[#06121f] border border-outline-variant/20 rounded-lg p-2 flex flex-col items-center gap-1">
              <BlockSvg block={block} view={k} className="w-full h-36" />
              <span className="font-mono text-[10px] font-bold text-on-surface">{labels[k]}</span>
              <span className="font-mono text-[9px] text-outline">{dims[k]}</span>
            </div>
          ))}
        </div>
        {opening && <p className="text-[10px] text-outline font-mono">La coupe de dessus est la section horizontale du mur ; la vue de face est utilisée dans les façades et coupes.</p>}
        {block.description && <p className="text-[11px] text-on-surface-variant">{block.description}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
          <div className="flex gap-2">
            <button onClick={exportJson} className="px-3 py-1.5 rounded border border-outline-variant/40 text-xs font-mono text-on-surface-variant hover:bg-surface-container flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'data_object'}</span>{copied ? 'JSON copié' : 'Copier le JSON'}
            </button>
            {block.custom && (
              <button
                onClick={() => { if (confirm(`Supprimer le bloc « ${block.name} » de la bibliothèque ?`)) { removeCustomBlock(block.id); onClose(); } }}
                className="px-3 py-1.5 rounded border border-error/40 text-xs font-mono text-error hover:bg-error/10 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>Supprimer
              </button>
            )}
          </div>
          <button onClick={() => { onInsert(block); onClose(); }} className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-mono font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">add_circle</span>Insérer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
