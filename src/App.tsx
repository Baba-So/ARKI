/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState } from 'react';
import { ProjectMeta, ProjectSnapshot, ScreenType } from './types.ts';
import { Header } from './components/Header.tsx';
import { CadEditor } from './components/CadEditor.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { NewProjectModal } from './components/NewProjectModal.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { createProject, getProjectMeta, loadProject, saveProject, SAMPLE_ID } from './projectStore.ts';

type ProjectRef = Pick<ProjectMeta, 'id' | 'name' | 'version'>;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard');
  const [currentProject, setCurrentProject] = useState<ProjectRef>({ id: SAMPLE_ID, name: 'Villa Horizon', version: 'v1.4' });
  // Projet chargé dans l'éditeur (la clé force un rechargement complet de l'éditeur à chaque ouverture)
  const [editorProject, setEditorProject] = useState<{ key: number; snapshot: ProjectSnapshot | undefined }>({ key: 0, snapshot: undefined });

  // Modals state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ snapshot: ProjectSnapshot | null; meta: ProjectMeta | undefined } | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // État courant de l'éditeur (fourni par CadEditor) et projet ouvert, lisibles depuis les callbacks sans les recréer
  const getSnapshotRef = useRef<(() => ProjectSnapshot) | null>(null);
  const currentIdRef = useRef(currentProject.id);
  currentIdRef.current = currentProject.id;

  /** Enregistrement automatique du projet ouvert (appelé par l'éditeur après chaque modification). */
  const handleSnapshot = useCallback((snap: ProjectSnapshot) => {
    saveProject(currentIdRef.current, snap);
  }, []);

  const handleOpenProject = (projectId: string) => {
    const meta = getProjectMeta(projectId);
    const snap = loadProject(projectId);
    if (!meta || !snap) {
      alert('Projet introuvable : il a peut-être été supprimé.');
      return;
    }
    setCurrentProject({ id: meta.id, name: meta.name, version: meta.version });
    setEditorProject(p => ({ key: p.key + 1, snapshot: snap }));
    setCurrentScreen('editor');
  };

  // Création d'un projet depuis la fenêtre « Nouveau projet » : projet vierge (RDC, calques normalisés)
  const handleCreateProject = (info: {
    name: string;
    location: string;
    phase: string;
    units: string;
    hsp: number;
    template: string;
    orientation: number;
  }) => {
    const meta = createProject({ name: info.name, location: info.location, phase: info.phase, hspMm: info.hsp > 0 ? Math.round(info.hsp * 1000) : undefined });
    handleOpenProject(meta.id);
  };

  /** Ouvre l'export du projet de l'éditeur (état exact en cours) ou d'un projet enregistré (depuis le tableau de bord). */
  const openExport = (projectId?: string) => {
    if (!projectId && currentScreen === 'editor' && getSnapshotRef.current) {
      setExportTarget({ snapshot: getSnapshotRef.current(), meta: getProjectMeta(currentProject.id) ?? undefined });
      return;
    }
    const id = projectId ?? currentProject.id;
    setExportTarget({ snapshot: loadProject(id), meta: getProjectMeta(id) });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans select-none overflow-x-hidden">
      {/* Global Top Navigation Bar (Hidden on Auth screen for immersion, with quick toggle option) */}
      {currentScreen !== 'auth' && (
        <Header
          currentScreen={currentScreen}
          onNavigate={(screen) => setCurrentScreen(screen)}
          onOpenNewProject={() => setIsNewProjectModalOpen(true)}
          onOpenExport={() => openExport()}
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
            onExportProject={openExport}
            searchQuery={searchQuery}
          />
        )}

        {currentScreen === 'editor' && (
          <CadEditor
            key={editorProject.key}
            initialProject={editorProject.snapshot}
            onSnapshot={handleSnapshot}
            getSnapshotRef={getSnapshotRef}
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            onOpenExport={() => openExport()}
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

      {/* Export Modal (projet, SVG, DXF, PDF, rapport, métrés) */}
      <ExportModal
        isOpen={!!exportTarget}
        onClose={() => setExportTarget(null)}
        projectName={exportTarget?.meta?.name ?? currentProject.name}
        snapshot={exportTarget?.snapshot ?? null}
        meta={exportTarget?.meta}
      />

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        onOpenExport={() => openExport()}
      />
    </div>
  );
}
