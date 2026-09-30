import React, { useState } from 'react';
import { CadBlock } from '../types.ts';

export const PREDEFINED_CAD_BLOCKS: CadBlock[] = [
  // SÉJOUR & REPAS
  {
    id: 'block-table-dining-6p',
    name: 'Table Repas 6 Places',
    category: 'sejour',
    widthMm: 1800,
    heightMm: 900,
    defaultLayer: 'mobilier',
    icon: 'table_restaurant',
    description: 'Table rectangulaire 1.80m x 0.90m avec 6 chaises disposées',
    renderType: 'table',
  },
  {
    id: 'block-sofa-corner-3p',
    name: 'Canapé d\'Angle 4 Places',
    category: 'sejour',
    widthMm: 2400,
    heightMm: 1600,
    defaultLayer: 'mobilier',
    icon: 'weekend',
    description: 'Canapé panoramique avec méridienne réversible',
    renderType: 'sofa',
  },
  {
    id: 'block-coffee-table',
    name: 'Table Basse Salon',
    category: 'sejour',
    widthMm: 1100,
    heightMm: 600,
    defaultLayer: 'mobilier',
    icon: 'table_view',
    description: 'Table basse design en bois massif et verre',
    renderType: 'table',
  },
  {
    id: 'block-tv-unit',
    name: 'Meuble TV & Média',
    category: 'sejour',
    widthMm: 2000,
    heightMm: 450,
    defaultLayer: 'mobilier',
    icon: 'tv',
    description: 'Banc média suspendu 2.00m',
    renderType: 'generic',
  },

  // CUISINE & ÉLECTROMÉNAGER
  {
    id: 'block-kitchen-island',
    name: 'Îlot Central Cuisine + Évier',
    category: 'cuisine',
    widthMm: 2400,
    heightMm: 1000,
    defaultLayer: 'mobilier',
    icon: 'countertops',
    description: 'Îlot bar avec cuve sous plan et espace tabourets',
    renderType: 'island',
  },
  {
    id: 'block-sink-double',
    name: 'Évier Inox Double Bac',
    category: 'cuisine',
    widthMm: 1160,
    heightMm: 500,
    defaultLayer: 'mobilier',
    icon: 'faucet',
    description: 'Évier 2 bacs avec égouttoir rainuré',
    renderType: 'sink',
  },
  {
    id: 'block-cooktop-induction',
    name: 'Plaque Induction 4 Feux',
    category: 'cuisine',
    widthMm: 800,
    heightMm: 520,
    defaultLayer: 'mobilier',
    icon: 'outdoor_grill',
    description: 'Table induction affleurante avec zone flexible',
    renderType: 'generic',
  },

  // CHAMBRE & SUITE
  {
    id: 'block-bed-king',
    name: 'Lit King Size (180x200)',
    category: 'chambre',
    widthMm: 1900,
    heightMm: 2100,
    defaultLayer: 'mobilier',
    icon: 'bed',
    description: 'Lit double 180x200 avec tête de lit et chevets intégrés',
    renderType: 'bed',
  },
  {
    id: 'block-bed-queen',
    name: 'Lit Queen Size (160x200)',
    category: 'chambre',
    widthMm: 1700,
    heightMm: 2100,
    defaultLayer: 'mobilier',
    icon: 'single_bed',
    description: 'Couchage 160x200 avec 2 oreillers ergonomiques',
    renderType: 'bed',
  },
  {
    id: 'block-wardrobe',
    name: 'Dressing Coulissant 3 Portes',
    category: 'chambre',
    widthMm: 2500,
    heightMm: 650,
    defaultLayer: 'mobilier',
    icon: 'shelves',
    description: 'Armoire dressing pleine hauteur 2.50m',
    renderType: 'generic',
  },

  // SALLE DE BAIN & SANITAIRE
  {
    id: 'block-bath-island',
    name: 'Baignoire Îlot Ovale',
    category: 'sanitaire',
    widthMm: 1700,
    heightMm: 800,
    defaultLayer: 'mobilier',
    icon: 'bathtub',
    description: 'Baignoire monobloc acrylique blanc mat',
    renderType: 'bath',
  },
  {
    id: 'block-walkin-shower',
    name: 'Douche Italienne 120x90',
    category: 'sanitaire',
    widthMm: 1200,
    heightMm: 900,
    defaultLayer: 'mobilier',
    icon: 'shower',
    description: 'Receveur extra-plat avec paroi verre et caniveau',
    renderType: 'shower',
  },
  {
    id: 'block-double-vanity',
    name: 'Meuble Double Vasque',
    category: 'sanitaire',
    widthMm: 1400,
    heightMm: 550,
    defaultLayer: 'mobilier',
    icon: 'wash',
    description: 'Plan vasque céramique 2 robinetteries mitigeurs',
    renderType: 'sink',
  },
  {
    id: 'block-toilet-wallhung',
    name: 'WC Suspendu avec Bâti-Support',
    category: 'sanitaire',
    widthMm: 560,
    heightMm: 700,
    defaultLayer: 'mobilier',
    icon: 'wc',
    description: 'Cuvette sans bride avec coffrage technique',
    renderType: 'wc',
  },

  // MENUISERIES & OUVERTURES
  {
    id: 'block-door-interior-83',
    name: 'Porte Battante 830mm',
    category: 'menuiserie',
    widthMm: 830,
    heightMm: 830,
    defaultLayer: 'ouvertures',
    icon: 'meeting_room',
    description: 'Bloc-porte intérieur avec sens d\'ouverture à 90°',
    renderType: 'door',
  },
  {
    id: 'block-door-double-140',
    name: 'Double Porte Battante 1400mm',
    category: 'menuiserie',
    widthMm: 1400,
    heightMm: 700,
    defaultLayer: 'ouvertures',
    icon: 'door_sliding',
    description: 'Porte à deux vantaux égaux avec débattement double',
    renderType: 'door',
  },
  {
    id: 'block-sliding-bay-240',
    name: 'Baie Vitrée Coulissante 2.40m',
    category: 'menuiserie',
    widthMm: 2400,
    heightMm: 200,
    defaultLayer: 'ouvertures',
    icon: 'window',
    description: 'Baie alu 2 vantaux 2 rails rupture pont thermique',
    renderType: 'window',
  },

  // EXTÉRIEUR & TERRASSE
  {
    id: 'block-terrace-table',
    name: 'Table Extérieure & Fauteuils',
    category: 'exterieur',
    widthMm: 2000,
    heightMm: 1000,
    defaultLayer: 'mobilier',
    icon: 'deck',
    description: 'Mobilier de jardin teck et aluminium',
    renderType: 'table',
  },
  {
    id: 'block-sunbed',
    name: 'Bain de Soleil / Transat',
    category: 'exterieur',
    widthMm: 1950,
    heightMm: 650,
    defaultLayer: 'mobilier',
    icon: 'chair',
    description: 'Transat inclinable avec matelas étanche',
    renderType: 'generic',
  },
];

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
  const [importedBlocks, setImportedBlocks] = useState<CadBlock[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [customJsonInput, setCustomJsonInput] = useState('');

  const allBlocks = [...PREDEFINED_CAD_BLOCKS, ...importedBlocks];

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

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      const newBlock: CadBlock = {
        id: `block-custom-${Date.now()}`,
        name: parsed.name || 'Bloc Importé',
        category: parsed.category || 'sejour',
        widthMm: Number(parsed.widthMm) || 1200,
        heightMm: Number(parsed.heightMm) || 800,
        defaultLayer: parsed.defaultLayer || 'mobilier',
        icon: 'extension',
        description: parsed.description || 'Bloc importé par utilisateur',
        renderType: parsed.renderType || 'generic',
      };
      setImportedBlocks(prev => [...prev, newBlock]);
      setShowImportDialog(false);
      setCustomJsonInput('');
    } catch {
      alert("Erreur de format JSON. Veuillez vérifier la structure du bloc.");
    }
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
            title="Importer un bloc (JSON / DXF)"
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
            const widthPx = Math.round(block.widthMm / 10);
            const heightPx = Math.round(block.heightMm / 10);

            return (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
                className="group relative flex flex-col bg-surface-container-lowest/90 hover:bg-surface-container-high/90 border border-outline-variant/30 hover:border-primary/60 rounded-lg p-2 cursor-grab active:cursor-grabbing transition-all shadow-xs hover:shadow-md"
              >
                {/* Visual Architectural CAD Thumbnail */}
                <div className="w-full h-20 bg-[#06121f] rounded border border-outline-variant/20 flex items-center justify-center p-1 overflow-hidden relative">
                  <svg
                    viewBox={`0 0 ${Math.max(widthPx, 60)} ${Math.max(heightPx, 45)}`}
                    className="w-full h-full max-h-16"
                  >
                    {block.renderType === 'table' && (
                      <g stroke="#ffb95f" strokeWidth="1.2" fill="none">
                        <rect x="5" y="5" width={widthPx - 10} height={heightPx - 10} rx="2" fill="#142638" />
                        {/* Chairs around table */}
                        <circle cx="15" cy="2" r="2.5" fill="#ffb95f" />
                        <circle cx={widthPx / 2} cy="2" r="2.5" fill="#ffb95f" />
                        <circle cx={widthPx - 15} cy="2" r="2.5" fill="#ffb95f" />
                        <circle cx="15" cy={heightPx - 2} r="2.5" fill="#ffb95f" />
                        <circle cx={widthPx / 2} cy={heightPx - 2} r="2.5" fill="#ffb95f" />
                        <circle cx={widthPx - 15} cy={heightPx - 2} r="2.5" fill="#ffb95f" />
                      </g>
                    )}

                    {block.renderType === 'sofa' && (
                      <g stroke="#ffb95f" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} rx="3" fill="#142638" />
                        <rect x="2" y="2" width={widthPx - 4} height="8" rx="2" fill="#ffb95f" fillOpacity="0.3" />
                        <line x1={widthPx / 2} y1="10" x2={widthPx / 2} y2={heightPx - 4} strokeDasharray="2 2" />
                      </g>
                    )}

                    {block.renderType === 'bed' && (
                      <g stroke="#ffb95f" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} rx="2" fill="#142638" />
                        {/* Headboard */}
                        <rect x="2" y="2" width={widthPx - 4} height="6" fill="#ffb95f" fillOpacity="0.4" />
                        {/* Pillows */}
                        <rect x="8" y="10" width={widthPx / 2 - 12} height="12" rx="2" stroke="#ffb95f" strokeWidth="0.8" />
                        <rect x={widthPx / 2 + 4} y="10" width={widthPx / 2 - 12} height="12" rx="2" stroke="#ffb95f" strokeWidth="0.8" />
                        {/* Blanket line */}
                        <line x1="2" y1="28" x2={widthPx - 2} y2="28" strokeDasharray="3 2" />
                      </g>
                    )}

                    {block.renderType === 'bath' && (
                      <g stroke="#4cd7f6" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} rx="12" fill="#0d2538" />
                        <ellipse cx={widthPx / 2} cy={heightPx / 2} rx={widthPx / 2 - 8} ry={heightPx / 2 - 8} stroke="#4cd7f6" />
                        <circle cx={widthPx / 2} cy={heightPx / 2} r="2" fill="#4cd7f6" />
                      </g>
                    )}

                    {block.renderType === 'shower' && (
                      <g stroke="#4cd7f6" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} fill="#0d2538" />
                        <line x1="2" y1="2" x2={widthPx - 2} y2={heightPx - 2} stroke="#4cd7f6" strokeOpacity="0.4" />
                        <circle cx={widthPx / 2} cy={heightPx / 2} r="3" fill="#4cd7f6" />
                      </g>
                    )}

                    {block.renderType === 'sink' && (
                      <g stroke="#4cd7f6" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} rx="2" fill="#0d2538" />
                        <ellipse cx={widthPx / 2} cy={heightPx / 2} rx="14" ry="10" stroke="#4cd7f6" />
                        <circle cx={widthPx / 2} cy="6" r="1.5" fill="#4cd7f6" />
                      </g>
                    )}

                    {block.renderType === 'wc' && (
                      <g stroke="#4cd7f6" strokeWidth="1.2" fill="none">
                        <rect x="4" y="2" width={widthPx - 8} height="10" fill="#0d2538" />
                        <path d={`M 8 12 Q ${widthPx / 2} ${heightPx - 2} ${widthPx - 8} 12`} stroke="#4cd7f6" />
                        <ellipse cx={widthPx / 2} cy="20" rx="8" ry="12" stroke="#4cd7f6" />
                      </g>
                    )}

                    {block.renderType === 'door' && (
                      <g stroke="#4edea3" strokeWidth="1.5" fill="none">
                        <line x1="4" y1="4" x2={widthPx - 4} y2="4" strokeWidth="2.5" />
                        <path d={`M 4 4 A ${widthPx - 8} ${widthPx - 8} 0 0 1 ${widthPx - 4} ${widthPx - 4}`} strokeDasharray="2 2" />
                      </g>
                    )}

                    {block.renderType === 'window' && (
                      <g stroke="#4edea3" strokeWidth="1.5" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} fill="#0d2538" />
                        <line x1="2" y1={heightPx / 2} x2={widthPx - 2} y2={heightPx / 2} />
                      </g>
                    )}

                    {block.renderType === 'generic' || block.renderType === 'island' ? (
                      <g stroke="#ffb95f" strokeWidth="1.2" fill="none">
                        <rect x="2" y="2" width={widthPx - 4} height={heightPx - 4} rx="2" fill="#142638" />
                        <line x1="2" y1="2" x2={widthPx - 2} y2={heightPx - 2} strokeOpacity="0.2" />
                        <line x1={widthPx - 2} y1="2" x2="2" y2={heightPx - 2} strokeOpacity="0.2" />
                      </g>
                    ) : null}
                  </svg>

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
                      {block.category}
                    </span>
                  </div>
                </div>

                {/* Quick Insert Button */}
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

      {/* IMPORT CUSTOM BLOCK MODAL */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#051424] border border-primary/40 rounded-xl shadow-2xl p-4 flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">file_upload</span>
                <span className="font-mono text-xs font-bold text-primary">IMPORTER UN BLOC MOBILIER</span>
              </div>
              <button onClick={() => setShowImportDialog(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-[11px] text-on-surface-variant">
              Collez la définition JSON d&apos;un bloc CAO (dimensions en mm, catégorie, type de rendu) :
            </p>

            <textarea
              value={customJsonInput}
              onChange={(e) => setCustomJsonInput(e.target.value)}
              placeholder={`{\n  "name": "Banc Design 1.50m",\n  "category": "sejour",\n  "widthMm": 1500,\n  "heightMm": 450,\n  "renderType": "generic"\n}`}
              className="w-full h-32 p-2 bg-[#020a12] text-xs font-mono rounded border border-outline-variant/40 focus:border-primary focus:outline-hidden"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/30">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-3 py-1.5 rounded text-xs font-mono text-on-surface-variant hover:bg-surface-container"
              >
                Annuler
              </button>
              <button
                onClick={handleImportJson}
                disabled={!customJsonInput.trim()}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-mono font-bold disabled:opacity-40 transition-colors"
              >
                Ajouter à la bibliothèque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
