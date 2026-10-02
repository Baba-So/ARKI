/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ScreenType } from './types.ts';
import { Header } from './components/Header.tsx';
import { CadEditor } from './components/CadEditor.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { NewProjectModal } from './components/NewProjectModal.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { ExportModal } from './components/ExportModal.tsx';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard');
  const [currentProject, setCurrentProject] = useState({
    id: 'villa-horizon',
    name: 'Villa Horizon',
    version: 'v1.4',
  });

  // Modals state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle project opening from dashboard
  const handleOpenProject = (projectId: string) => {
    if (projectId === 'villa-horizon') {
      setCurrentProject({
        id: 'villa-horizon',
        name: 'Villa Horizon',
        version: 'v1.4',
      });
    } else if (projectId === 'residence-les-pins') {
      setCurrentProject({
        id: 'residence-les-pins',
        name: 'Résidence Les Pins',
        version: 'v2.1',
      });
    } else if (projectId === 'loft-marais') {
      setCurrentProject({
        id: 'loft-marais',
        name: 'Extension Loft Marais',
        version: 'v1.0',
      });
    } else {
      setCurrentProject({
        id: 'pavillon-solaire',
        name: 'Pavillon Solaire Bioclimatique',
        version: 'v0.9',
      });
    }
    setCurrentScreen('editor');
  };

  // Handle new project creation from modal
  const handleCreateProject = (info: {
    name: string;
    location: string;
    phase: string;
    units: string;
    hsp: number;
    template: string;
    orientation: number;
  }) => {
    setCurrentProject({
      id: `proj-${Date.now()}`,
      name: info.name || 'Nouveau Projet CAD',
      version: 'v1.0',
    });
    setCurrentScreen('editor');
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans select-none overflow-x-hidden">
      {/* Global Top Navigation Bar (Hidden on Auth screen for immersion, with quick toggle option) */}
      {currentScreen !== 'auth' && (
        <Header
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          onOpenNewProject={() => setIsNewProjectModalOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          projectName={currentProject.name}
          projectVersion={currentProject.version}
          onResetView={() => {
            alert("Vue recadrée au centre du plan.");
          }}
          onUndo={() => {
            alert("Annulation de la dernière commande CAO (Ctrl+Z).");
          }}
          onRedo={() => {
            alert("Rétablissement de la commande CAO (Ctrl+Y).");
          }}
        />
      )}

      {/* Screen Viewport with Top padding when Header is visible */}
      <main className={`flex-1 w-full ${currentScreen !== 'auth' ? 'pt-14' : ''}`}>
        {currentScreen === 'dashboard' && (
          <Dashboard
            onOpenProject={handleOpenProject}
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            searchQuery={searchQuery}
          />
        )}

        {currentScreen === 'editor' && (
          <CadEditor
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            onOpenExport={() => setIsExportModalOpen(true)}
          />
        )}

        {currentScreen === 'auth' && (
          <div className="relative">
            {/* Quick switcher to return to dashboard */}
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-lg bg-surface-container-high/90 hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-mono text-primary flex items-center gap-1.5 shadow-lg backdrop-blur"
              title="Retourner aux écrans de l'application"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Voir le Studio CAO</span>
            </button>
            <AuthScreen
              onLoginSuccess={() => setCurrentScreen('dashboard')}
            />
          </div>
        )}
      </main>

      {/* New Project Setup Modal (Step 01, 02, 03) */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Export Modal (DWG, DXF, IFC, PDF) */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={currentProject.name}
      />

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />
    </div>
  );
}
