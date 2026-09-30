import React, { useState } from 'react';
import { CadLayer } from '../types.ts';

interface LayerManagerProps {
  layers: CadLayer[];
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onChangeColor: (layerId: string, color: string) => void;
  onAddLayer?: (name: string, category: CadLayer['category'], color: string) => void;
  onClose?: () => void;
  isCompact?: boolean;
}

const PRESET_COLORS = [
  '#4cd7f6', // Cyan standard CAO
  '#4edea3', // Vert menthe
  '#ffb95f', // Ambre / Orange
  '#ff7b72', // Rouge corail
  '#d4e4fa', // Blanc glacier
  '#869397', // Gris neutre
  '#bc8cff', // Violet lavande
  '#06b6d4', // Cyan profond
];

export const LayerManager: React.FC<LayerManagerProps> = ({
  layers,
  onToggleVisibility,
  onToggleLock,
  onChangeColor,
  onAddLayer,
  onClose,
  isCompact = false,
}) => {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerCategory, setNewLayerCategory] = useState<CadLayer['category']>('structures');
  const [newLayerColor, setNewLayerColor] = useState('#4cd7f6');

  // Filter layers by search
  const filteredLayers = layers.filter(l =>
    l.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    l.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCreateLayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayerName.trim()) return;
    onAddLayer?.(newLayerName.trim(), newLayerCategory, newLayerColor);
    setNewLayerName('');
    setShowAddForm(false);
  };

  const visibleCount = layers.filter(l => l.visible).length;
  const lockedCount = layers.filter(l => l.locked).length;

  return (
    <div className={`bg-surface-container-lowest text-on-surface flex flex-col font-sans select-none ${
      isCompact ? 'w-full h-full' : 'w-80 h-full border-r border-outline-variant/30 shadow-2xl z-30'
    }`}>
      {/* Header Bar */}
      <div className="p-3 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between flex-none">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            layers
          </span>
          <div className="flex flex-col">
            <h3 className="font-semibold text-xs leading-tight text-on-surface tracking-wide">
              GESTIONNAIRE DE CALQUES
            </h3>
            <span className="font-mono text-[9px] text-outline">
              {visibleCount}/{layers.length} visibles · {lockedCount} verrouillés
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 rounded bg-surface-container hover:bg-surface-container-high text-primary transition-colors"
            title="Créer un nouveau calque"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
              title="Fermer la palette des calques"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Quick Action Strip & Search */}
      <div className="p-2 bg-surface-container border-b border-outline-variant/20 flex flex-col gap-2 flex-none">
        {/* Search Input */}
        <div className="flex items-center bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30">
          <span className="material-symbols-outlined text-[14px] text-outline mr-1.5">search</span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrer structures, cloisons, mobilier..."
            className="w-full bg-transparent text-[11px] text-on-surface placeholder:text-outline outline-none"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined text-[12px]">cancel</span>
            </button>
          )}
        </div>

        {/* Global Batch Controls */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                layers.forEach(l => {
                  if (!l.visible) onToggleVisibility(l.id);
                });
              }}
              className="px-1.5 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors flex items-center gap-1"
              title="Afficher tous les calques"
            >
              <span className="material-symbols-outlined text-[12px] text-tertiary">visibility</span>
              <span>Tous</span>
            </button>
            <button
              onClick={() => {
                layers.forEach(l => {
                  if (l.visible) onToggleVisibility(l.id);
                });
              }}
              className="px-1.5 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors flex items-center gap-1"
              title="Masquer tous les calques"
            >
              <span className="material-symbols-outlined text-[12px] text-error">visibility_off</span>
              <span>Aucun</span>
            </button>
          </div>

          <button
            onClick={() => {
              layers.forEach(l => {
                if (l.locked) onToggleLock(l.id);
              });
            }}
            className="px-1.5 py-0.5 rounded bg-surface-container-high hover:bg-surface-bright text-outline hover:text-on-surface transition-colors flex items-center gap-1"
            title="Déverrouiller tous les calques"
          >
            <span className="material-symbols-outlined text-[12px]">lock_open</span>
            <span>Déverr. tout</span>
          </button>
        </div>
      </div>

      {/* Add New Layer inline Form */}
      {showAddForm && (
        <form onSubmit={handleCreateLayer} className="p-2.5 bg-surface-container-low border-b border-outline-variant/30 flex flex-col gap-2">
          <span className="font-mono text-[10px] text-primary font-bold">CRÉER UN CALQUE</span>
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="Nom (ex: A-RESEAU-ELEC)"
            className="px-2 py-1 bg-surface-container-lowest text-xs rounded border border-outline-variant/30 outline-none focus:border-primary"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={newLayerCategory}
              onChange={(e) => setNewLayerCategory(e.target.value as any)}
              className="bg-surface-container-lowest text-[10px] font-mono px-1.5 py-1 rounded border border-outline-variant/30 text-on-surface outline-none"
            >
              <option value="structures">Structures</option>
              <option value="cloisons">Cloisons</option>
              <option value="mobilier">Mobilier</option>
              <option value="ouvertures">Menuiseries</option>
              <option value="cotations">Cotations</option>
            </select>
            <div className="flex items-center gap-1 bg-surface-container-lowest px-1.5 py-1 rounded border border-outline-variant/30">
              <span className="w-3.5 h-3.5 rounded-full flex-none" style={{ backgroundColor: newLayerColor }}></span>
              <input
                type="color"
                value={newLayerColor}
                onChange={(e) => setNewLayerColor(e.target.value)}
                className="w-full h-4 bg-transparent cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2 py-0.5 text-[10px] text-outline hover:text-on-surface"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-2.5 py-0.5 bg-primary text-on-primary font-mono text-[10px] font-bold rounded"
            >
              Ajouter
            </button>
          </div>
        </form>
      )}

      {/* Layer List Table */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredLayers.map((layer) => {
          const isPickerOpen = activeColorPicker === layer.id;

          return (
            <div
              key={layer.id}
              className={`p-2 rounded border transition-all ${
                layer.locked
                  ? 'bg-surface-container-low/60 border-outline-variant/20 opacity-80'
                  : layer.visible
                  ? 'bg-surface-container border-outline-variant/30 hover:border-primary/40'
                  : 'bg-surface-container-lowest border-outline-variant/10 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Left: Color swatch & Layer Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Interactive Color Swatch button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveColorPicker(isPickerOpen ? null : layer.id)}
                      className="w-4 h-4 rounded-full border border-black/40 shadow-xs flex-none hover:scale-110 transition-transform relative group"
                      style={{ backgroundColor: layer.color }}
                      title="Changer la couleur du calque"
                    >
                      <span className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center text-[9px] text-black font-bold">
                        •
                      </span>
                    </button>

                    {/* Color Picker Popover */}
                    {isPickerOpen && (
                      <div 
                        className="absolute left-6 top-0 z-50 p-2 bg-surface-container-low border border-outline-variant/40 rounded-lg shadow-2xl flex flex-col gap-2 w-48"
                        onMouseLeave={() => setActiveColorPicker(null)}
                      >
                        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-1">
                          <span className="font-mono text-[9px] text-outline uppercase font-semibold">
                            Palette CAO
                          </span>
                          <span className="font-mono text-[9px] text-primary">{layer.color}</span>
                        </div>
                        {/* Preset Swatches */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                onChangeColor(layer.id, c);
                                setActiveColorPicker(null);
                              }}
                              className={`w-6 h-6 rounded border transition-transform ${
                                layer.color.toLowerCase() === c.toLowerCase()
                                  ? 'ring-2 ring-primary scale-110'
                                  : 'border-outline-variant/30 hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        {/* Custom HTML Color input */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-outline-variant/20">
                          <span className="text-[10px] text-outline font-mono">Personnalisé:</span>
                          <input
                            type="color"
                            value={layer.color}
                            onChange={(e) => onChangeColor(layer.id, e.target.value)}
                            className="w-6 h-5 bg-transparent cursor-pointer rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Layer Name & Tag */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-on-surface truncate">
                        {layer.name}
                      </span>
                      {layer.locked && (
                        <span className="font-mono text-[8px] text-secondary bg-secondary/10 px-1 rounded">
                          GELÉ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-outline truncate">
                      <span className="uppercase">{layer.category}</span>
                      <span>·</span>
                      <span>{layer.entityCount} obj.</span>
                      {layer.lineweight && (
                        <>
                          <span>·</span>
                          <span>{layer.lineweight}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Visibility Eye & Lock Padlock) */}
                <div className="flex items-center gap-0.5 flex-none">
                  {/* Eye Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(layer.id)}
                    className={`p-1 rounded transition-colors ${
                      layer.visible
                        ? 'text-primary hover:bg-surface-container-high'
                        : 'text-outline hover:text-on-surface bg-surface-container-lowest'
                    }`}
                    title={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {layer.visible ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>

                  {/* Lock Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleLock(layer.id)}
                    className={`p-1 rounded transition-colors ${
                      layer.locked
                        ? 'text-secondary bg-secondary/10 font-bold'
                        : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
                    }`}
                    title={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque (empêcher modification)'}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {layer.locked ? 'lock' : 'lock_open'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Tips */}
      <div className="p-2.5 bg-surface-container-low border-t border-outline-variant/20 flex flex-col gap-1 text-[10px] text-outline font-mono flex-none">
        <div className="flex items-center justify-between">
          <span>Norme IFC4 : Couleurs RVB d'exécution</span>
          <span className="text-tertiary">ISO 13567</span>
        </div>
        <p className="text-[9px] text-outline-variant leading-tight">
          Les calques masqués sont automatiquement exclus du métré et de la détection de collisions BIM.
        </p>
      </div>
    </div>
  );
};
