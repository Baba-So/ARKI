import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo.tsx';
import { ScreenType } from '../types.ts';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onOpenNewProject: () => void;
  onOpenExport?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenTutorial?: () => void;
  projectName?: string;
  projectVersion?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  onResetView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenNewProject,
  onOpenExport,
  onOpenCommandPalette,
  onOpenTutorial,
  projectName = 'Villa Horizon',
  projectVersion = 'v1.4',
  onUndo,
  onRedo,
  onResetView,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface-container-lowest border-b border-outline-variant/30 select-none shadow-[0_1px_8px_rgba(0,0,0,0.4)] px-4 flex items-center justify-between gap-4">
      {/* Left section: Brand & Context Navigation */}
      <div className="flex items-center gap-4 min-w-max">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className="hover:opacity-90 transition-opacity text-left focus:outline-none"
          title="Retour au tableau de bord"
        >
          <BrandLogo size="md" proBadge={currentScreen === 'editor'} showSubtitle={currentScreen !== 'editor'} />
        </button>

        <div className="h-6 w-px bg-outline-variant/30 mx-1 hidden sm:block"></div>

        {currentScreen === 'editor' ? (
          /* Editor Mode Project Title & Desktop Menu */
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-semibold text-on-surface text-[13px] leading-tight truncate max-w-[150px]">
                {projectName}
              </span>
              <span className="text-[10px] text-tertiary flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                {projectVersion} · Enregistré
              </span>
            </div>

            <nav className="hidden xl:flex items-center gap-0.5 text-xs text-on-surface-variant font-medium ml-2">
              {['Fichier', 'Édition', 'Affichage', 'Outils', 'Cotation', 'Rendu', 'Aide'].map((item) => (
                <div key={item} className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === item ? null : item)}
                    className={`px-2 py-1 rounded transition-colors ${
                      activeMenu === item ? 'bg-surface-container-high text-primary' : 'hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {item}
                  </button>
                  {activeMenu === item && (
                    <div 
                      className="absolute top-full left-0 mt-1 w-56 bg-surface-container-low border border-outline-variant/30 rounded-lg shadow-2xl py-1.5 z-50 text-xs flex flex-col font-sans animate-in fade-in zoom-in-95 duration-100"
                      onMouseLeave={() => setActiveMenu(null)}
                    >
                      {item === 'Aide' ? (
                        <>
                          <button 
                            onClick={() => { onOpenTutorial?.(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high text-primary font-semibold flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px]">school</span>
                              <span>Grand Cours CAO (A à Z)</span>
                            </span>
                            <span className="font-mono text-[9px] bg-primary/20 text-primary px-1 rounded">11 modules</span>
                          </button>
                          <button 
                            onClick={() => { onOpenTutorial?.(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px]">description</span>
                              <span>Documentation TUTORIAL.md</span>
                            </span>
                          </button>
                          <div className="h-px bg-outline-variant/20 my-1"></div>
                          <button 
                            onClick={() => { onOpenCommandPalette?.(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span>Palette de commandes</span>
                            <span className="font-mono text-[10px] text-outline">⌘K</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => { onOpenNewProject(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span>Nouveau projet</span>
                            <span className="font-mono text-[10px] text-outline">Ctrl+N</span>
                          </button>
                          <button 
                            onClick={() => { onNavigate('dashboard'); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span>Ouvrir projet...</span>
                            <span className="font-mono text-[10px] text-outline">Ctrl+O</span>
                          </button>
                          <button 
                            onClick={() => { onOpenExport?.(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span>Exporter (DXF/SVG)</span>
                            <span className="font-mono text-[10px] text-outline">Ctrl+E</span>
                          </button>
                          <div className="h-px bg-outline-variant/20 my-1"></div>
                          <button 
                            onClick={() => { onResetView?.(); setActiveMenu(null); }}
                            className="px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center justify-between"
                          >
                            <span>Recadrer tout</span>
                            <span className="font-mono text-[10px] text-outline">Z+E</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        ) : (
          /* Dashboard Mode Studio Dropdown & Main Nav */
          <div className="flex items-center gap-3">
            <button 
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-xs transition-colors"
              title="Changer d'espace de travail"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">domain</span>
              <span className="font-medium text-on-surface">Atelier Arcki Studio</span>
              <span className="material-symbols-outlined text-[13px] text-outline">arrow_drop_down</span>
            </button>

            <nav className="hidden lg:flex items-center gap-1 text-xs">
              <button
                onClick={() => onNavigate('dashboard')}
                className={`px-3 py-1.5 rounded transition-colors font-medium ${
                  currentScreen === 'dashboard'
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                Projets
              </button>
              <button
                onClick={() => onNavigate('editor')}
                className="px-3 py-1.5 rounded transition-colors font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              >
                Éditeur CAO
              </button>
              <button
                onClick={() => alert("Module Équipe : 4 architectes connectés au serveur BIM.")}
                className="px-3 py-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors font-medium"
              >
                Équipe
              </button>
              <button
                onClick={() => alert("Documentation ARCKI CAD : Guide des commandes géométriques, IFC4, et Copilot IA.")}
                className="px-3 py-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors font-medium"
              >
                Documentation
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Center Section: Quick CAD Controls (in editor mode) or Search Bar (in dashboard mode) */}
      {currentScreen === 'editor' ? (
        <div className="hidden md:flex items-center gap-1 bg-surface-container-low px-1.5 py-1 rounded border border-outline-variant/20">
          <button 
            onClick={onUndo} 
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" 
            title="Annuler (Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[17px]">undo</span>
          </button>
          <button 
            onClick={onRedo} 
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" 
            title="Rétablir (Ctrl+Y)"
          >
            <span className="material-symbols-outlined text-[17px]">redo</span>
          </button>
          <div className="h-4 w-px bg-outline-variant/20 mx-0.5"></div>
          <button 
            onClick={onResetView}
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" 
            title="Zoom Étendu (Z+E)"
          >
            <span className="material-symbols-outlined text-[17px]">zoom_in_map</span>
          </button>
          <button 
            onClick={() => alert("Gestionnaire des calques BIM : A-MUR-EXT, A-MUR-INT, A-PORTE, A-COTE, A-HATCH")}
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors" 
            title="Gestionnaire de Calques (LA)"
          >
            <span className="material-symbols-outlined text-[17px]">layers</span>
          </button>
          <div className="h-4 w-px bg-outline-variant/20 mx-0.5"></div>
          <button 
            onClick={onOpenExport} 
            className="px-2 py-0.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors flex items-center gap-1 text-xs" 
            title="Exporter DWG/PDF"
          >
            <span className="material-symbols-outlined text-[15px]">file_download</span>
            <span className="hidden lg:inline">Export</span>
          </button>
          <button 
            onClick={() => alert("Lien de collaboration en direct copié dans le presse-papier !")}
            className="px-2 py-0.5 bg-surface-container-high text-primary hover:bg-primary-container hover:text-on-primary-container rounded transition-colors flex items-center gap-1 text-xs" 
            title="Partager le projet"
          >
            <span className="material-symbols-outlined text-[15px]">share</span>
            <span className="hidden lg:inline">Partager</span>
          </button>
        </div>
      ) : (
        <div 
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center bg-surface-container-low hover:bg-surface-container rounded px-3 py-1.5 gap-2 cursor-pointer border border-outline-variant/20 transition-colors w-64 lg:w-80"
        >
          <span className="material-symbols-outlined text-[16px] text-outline">search</span>
          <span className="text-xs text-outline flex-1 truncate">Recherche commande, calque, mesh...</span>
          <kbd className="font-mono text-[10px] bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded border border-outline-variant/30">
            ⌘K
          </kbd>
        </div>
      )}

      {/* Right Section: Live Sync Status, + Project Button, Notification, Profile */}
      <div className="flex items-center gap-3">
        {/* Sync telemetry badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="font-mono text-[10px] text-tertiary font-semibold">
            {currentScreen === 'editor' ? '2 en ligne' : 'SYNC CLOUD 24ms'}
          </span>
        </div>

        {/* Action: Grand Cours & Tuto CAO */}
        <button
          onClick={onOpenTutorial}
          className="flex items-center gap-1.5 bg-sky-950/70 hover:bg-sky-900 border border-sky-400/40 text-sky-300 hover:text-sky-200 px-2.5 py-1.5 rounded transition-all shadow-xs text-xs font-mono font-semibold active:scale-95"
          type="button"
          title="Ouvrir le Grand Cours & Tutoriel CAO de A à Z (11 modules)"
        >
          <span className="material-symbols-outlined text-[16px] text-sky-400 animate-pulse">school</span>
          <span className="hidden md:inline">Cours & Tuto</span>
        </button>

        {/* Global Action: New Project */}
        <button
          onClick={onOpenNewProject}
          className="flex items-center gap-1.5 bg-primary-container hover:bg-primary text-on-primary-container px-3 py-1.5 rounded transition-all shadow-sm text-xs font-semibold active:scale-95"
          type="button"
          title="Créer un nouveau projet CAD"
        >
          <span className="material-symbols-outlined text-[16px]">add_box</span>
          <span className="hidden sm:inline">+ Nouveau projet</span>
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs ring-2 ring-primary/30 hover:ring-primary transition-all focus:outline-none"
            title="Menu utilisateur & poste de travail"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>

          {profileOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-56 bg-surface-container-low border border-outline-variant/30 rounded-lg shadow-2xl py-1.5 z-50 text-xs"
              onMouseLeave={() => setProfileOpen(false)}
            >
              <div className="px-3 py-2 border-b border-outline-variant/20">
                <p className="font-semibold text-on-surface">Architecte DPLG</p>
                <p className="text-[11px] text-outline font-mono truncate">architecte@agence.fr</p>
              </div>
              
              <button
                onClick={() => { onNavigate('dashboard'); setProfileOpen(false); }}
                className="w-full px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                <span>Tableau de bord Projets</span>
              </button>

              <button
                onClick={() => { onNavigate('editor'); setProfileOpen(false); }}
                className="w-full px-3 py-1.5 text-left hover:bg-surface-container-high hover:text-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">architecture</span>
                <span>Éditeur CAO actif</span>
              </button>

              <button
                onClick={() => { onOpenTutorial?.(); setProfileOpen(false); }}
                className="w-full px-3 py-1.5 text-left hover:bg-surface-container-high text-primary font-semibold flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">school</span>
                <span>Grand Cours CAO (De A à Z)</span>
              </button>

              <div className="h-px bg-outline-variant/20 my-1"></div>

              <button
                onClick={() => { onNavigate('auth'); setProfileOpen(false); }}
                className="w-full px-3 py-1.5 text-left hover:bg-surface-container-high text-secondary flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Changer de compte / Écran Login</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
