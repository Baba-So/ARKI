import React, { useState } from 'react';
import { CadBlock } from '../types.ts';
import { PREDEFINED_CAD_BLOCKS } from '../constants/blocks.ts';
import { useBlocks } from '../blockStore.ts';
import { BlockSvg } from './BlockSvg.tsx';
import { BlockImportDialog } from './BlockImportDialog.tsx';
import { BlockDetailDialog } from './BlockDetailDialog.tsx';
import { isOpeningBlock } from '../blockSymbols.ts';

export { PREDEFINED_CAD_BLOCKS };

interface CadLibraryPanelProps {
  onInsertBlock: (block: CadBlock, x?: number, y?: number) => void;
  onClose?: () => void;
}

export const CadLibraryPanel: React.FC<CadLibraryPanelProps> = ({
  onInsertBlock,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [detailBlock, setDetailBlock] = useState<CadBlock | null>(null);

  // Blocs prédéfinis + blocs importés (registre partagé, persisté)
  const allBlocks = useBlocks();

  const filteredBlocks = allBlocks.filter(block => {
    const matchesCat = selectedCategory === 'all' || block.category === selectedCategory;
    const matchesSearch = 
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'Tout', icon: 'apps' },
    { id: 'sejour', label: 'Séjour', icon: 'weekend' },
    { id: 'cuisine', label: 'Cuisine', icon: 'countertops' },
    { id: 'chambre', label: 'Chambre', icon: 'bed' },
    { id: 'sanitaire', label: 'Bains', icon: 'bathtub' },
    { id: 'menuiserie', label: 'Ouvertures', icon: 'meeting_room' },
    { id: 'exterieur', label: 'Extérieur', icon: 'deck' },
  ];

  const handleDragStart = (e: React.DragEvent, block: CadBlock) => {
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full bg-[#051424] text-on-surface select-none font-sans overflow-hidden">
      {/* HEADER */}
      <div className="h-12 px-3 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/30 flex-none">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">category</span>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-on-surface tracking-tight">BIBLIOTHÈQUE DE BLOCS</span>
            <span className="font-mono text-[9px] text-outline">Glisser-déposer sur le canevas</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowImportDialog(true)}
            className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded transition-colors"
            title="Importer des blocs / générer le prompt IA"
          >
            <span className="material-symbols-outlined text-[17px]">file_upload</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded transition-colors"
              title="Fermer le panneau"
            >
              <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="p-2 border-b border-outline-variant/20 bg-surface-container-lowest/80">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-2 text-[16px] text-outline pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un bloc (lit, table, porte...)"
            className="w-full h-7 pl-7 pr-2 bg-surface-container text-xs rounded border border-outline-variant/30 focus:border-primary focus:outline-hidden font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[14px]">cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* CATEGORY FILTER CHIPS */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar border-b border-outline-variant/20 bg-surface-container-low/50 flex-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* BLOCKS GRID / LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {filteredBlocks.map((block) => {
            return (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
                className="group relative flex flex-col bg-surface-container-lowest/90 hover:bg-surface-container-high/90 border border-outline-variant/30 hover:border-primary/60 rounded-lg p-2 cursor-grab active:cursor-grabbing transition-all shadow-xs hover:shadow-md"
              >
                {/* Visual Architectural CAD Thumbnail */}
                <div className="w-full h-20 bg-[#06121f] rounded border border-outline-variant/20 flex items-center justify-center p-1 overflow-hidden relative">
                  <BlockSvg block={block} view="top" className="w-full h-full max-h-16" />

                  {/* Drag Handle Indicator */}
                  <span className="material-symbols-outlined absolute top-1 right-1 text-[13px] text-outline group-hover:text-primary transition-colors">
                    drag_indicator
                  </span>
                </div>

                {/* Metadata */}
                <div className="mt-1.5 flex flex-col min-w-0">
                  <span className="font-mono text-[11px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                    {block.name}
                  </span>
                  <div className="flex items-center justify-between text-[9px] font-mono text-outline mt-0.5">
                    <span>{block.widthMm} x {block.heightMm} mm</span>
                    <span className="uppercase text-[8px] px-1 rounded bg-surface-container">
                      {block.custom ? 'importé' : block.category}
                    </span>
                  </div>
                </div>

                {/* Quick Insert Button */}
                <button
                  onClick={() => setDetailBlock(block)}
                  className="absolute top-1 left-1 p-0.5 rounded text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
                  title={isOpeningBlock(block) ? 'Voir les 2 vues (coupe, face)' : 'Voir les 3 vues (dessus, face, côté)'}
                >
                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                </button>
                <button
                  onClick={() => onInsertBlock(block)}
                  className="mt-1.5 w-full py-1 bg-surface-container hover:bg-primary text-on-surface-variant hover:text-on-primary rounded text-[10px] font-mono font-semibold flex items-center justify-center gap-1 transition-colors active:scale-95"
                  title="Insérer au centre de l'espace de travail"
                >
                  <span className="material-symbols-outlined text-[13px]">add_circle</span>
                  <span>Insérer</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER TIP */}
      <div className="p-2 border-t border-outline-variant/20 bg-surface-container-low/70 flex items-center gap-2 text-[10px] font-mono text-outline flex-none">
        <span className="material-symbols-outlined text-primary text-[15px]">tips_and_updates</span>
        <span>Glissez un bloc sur le plan ou cliquez sur &quot;Insérer&quot;.</span>
      </div>

      {showImportDialog && <BlockImportDialog onClose={() => setShowImportDialog(false)} />}
      {detailBlock && <BlockDetailDialog block={detailBlock} onClose={() => setDetailBlock(null)} onInsert={onInsertBlock} />}
    </div>
  );
};
