import React, { useState, useEffect } from 'react';
import { ScreenType, CadTool } from '../types.ts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
  onSelectTool?: (tool: CadTool) => void;
  onOpenNewProject: () => void;
  onOpenExport: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewProject,
  onOpenExport,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { id: 'proj-villa', title: 'Ouvrir Projet : Villa Horizon (RDC)', category: 'Projets', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'proj-pins', title: 'Ouvrir Projet : Résidence Les Pins (R+2)', category: 'Projets', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'proj-new', title: 'Créer un nouveau projet CAD (+)', category: 'Actions', action: () => { onOpenNewProject(); onClose(); } },
    { id: 'tool-wall', title: 'Activer Outil Mur Continu (_WALL)', category: 'Outils CAO', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'tool-partition', title: 'Dessiner Cloison Placostil avec Snap Grille 20px (_PARTITION / C)', category: 'Outils CAO', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'tool-measure', title: 'Mesurer la distance en temps réel (_DIST / M)', category: 'Outils CAO', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'snap-grid', title: 'Magnétisme Grille 20px (Snap-to-Grid / F9)', category: 'Modes CAO', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'view-props', title: 'Inspecteur des Propriétés (Longueur, Angle, Indice Matériau)', category: 'Propriétés', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'tool-layers', title: 'Gestionnaire de Calques (LAYERS / LA)', category: 'Calques BIM', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'tool-dim', title: 'Générer Cotation Automatique (_DIM)', category: 'Outils CAO', action: () => { onNavigate('editor'); onClose(); } },
    { id: 'view-export', title: 'Exporter le plan (DWG, DXF, PDF vectoriel)', category: 'Export', action: () => { onOpenExport(); onClose(); } },
    { id: 'nav-dash', title: 'Aller au Tableau de bord Projets', category: 'Navigation', action: () => { onNavigate('dashboard'); onClose(); } },
  ];

  const filtered = actions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#010f1f]/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-xl bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        <div className="flex items-center px-4 py-3 border-b border-outline-variant/20 gap-3 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-outline text-[20px]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une commande, un calque, un projet..."
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline outline-none"
            autoFocus
          />
          <kbd className="font-mono text-[10px] bg-surface-container text-outline px-1.5 py-0.5 rounded border border-outline-variant/30">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-outline font-mono">
              Aucune commande trouvée pour "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-surface-container-high transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></span>
                  <span className="text-xs text-on-surface font-medium">{item.title}</span>
                </div>
                <span className="font-mono text-[10px] text-outline bg-surface-container px-2 py-0.5 rounded">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
