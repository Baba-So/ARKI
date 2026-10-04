import React, { useMemo, useState } from 'react';
import { ProjectData, ProjectMeta } from '../types.ts';
import { deleteProject, duplicateProject, importProjectFile, loadProject, storageUsage, updateProjectMeta, useProjects } from '../projectStore.ts';
import { useBlocks } from '../blockStore.ts';
import { PlanThumbnail } from './PlanThumbnail.tsx';

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onExportProject: (projectId: string) => void;
  searchQuery?: string;
}

const CATEGORIES: Array<{ id: 'all' | ProjectData['category']; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'esquisse', label: 'Esquisse' },
  { id: 'pc', label: 'Permis de construire' },
  { id: 'exe', label: 'Chantier / EXE' },
  { id: 'renovation', label: 'Rénovation' },
  { id: 'faisabilite', label: 'Faisabilité' },
];

/** « À l'instant », « Il y a 5 min », « Hier »… */
const relativeTime = (iso: string) => {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return '';
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'À l\'instant';
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const levelLabel = (n: number) => (n <= 1 ? 'RDC' : `R+${n - 1}`);

/** Vignette réelle d'un projet : plan du niveau le plus bas (RDC), relu quand le projet est modifié. */
const ProjectThumb: React.FC<{ id: string; modified: string; className?: string }> = ({ id, modified, className }) => {
  const entities = useMemo(() => {
    const snap = loadProject(id);
    if (!snap) return [];
    const ground = [...snap.levels].sort((a, b) => Math.abs(a.elevation) - Math.abs(b.elevation))[0];
    return snap.entitiesByLevel[ground.id] || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modified]);
  return <PlanThumbnail entities={entities} className={className} />;
};

export const Dashboard: React.FC<DashboardProps> = ({ onOpenProject, onOpenNewProject, onExportProject, searchQuery = '' }) => {
  const projects = useProjects();
  const customBlocks = useBlocks().filter(b => b.custom).length;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState<'all' | ProjectData['category']>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [isDragOver, setIsDragOver] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const countOf = (c: string) => (c === 'all' ? projects.length : projects.filter(p => p.category === c).length);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter(p => (activeCategory === 'all' || p.category === activeCategory) &&
      (!q || p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.phase.toLowerCase().includes(q)));
    const cmp: Record<string, (a: ProjectMeta, b: ProjectMeta) => number> = {
      date: (a, b) => b.modified.localeCompare(a.modified),
      name: (a, b) => a.name.localeCompare(b.name, 'fr'),
      phase: (a, b) => a.phase.localeCompare(b.phase, 'fr'),
      surface: (a, b) => b.stats.areaM2 - a.stats.areaM2,
    };
    return [...list].sort(cmp[sortBy] || cmp.date);
  }, [projects, activeCategory, searchQuery, sortBy]);

  const totals = useMemo(() => ({
    levels: projects.reduce((n, p) => n + p.stats.levels, 0),
    objects: projects.reduce((n, p) => n + p.stats.objects, 0),
    area: Math.round(projects.reduce((n, p) => n + p.stats.areaM2, 0) * 10) / 10,
  }), [projects]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usage = useMemo(() => storageUsage(), [projects, customBlocks]);
  const usagePct = Math.min(100, (usage.bytes / usage.limit) * 100);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    if (!/\.json$/i.test(f.name)) {
      setNotice({ ok: false, text: `« ${f.name} » : seuls les fichiers projet ARCKI (.arcki.json) peuvent être importés pour l'instant (DXF / DWG : à venir).` });
      return;
    }
    if (f.size > 20_000_000) { setNotice({ ok: false, text: 'Fichier trop volumineux (20 Mo max).' }); return; }
    const res = importProjectFile(await f.text());
    setNotice(res.ok ? { ok: true, text: `Projet « ${res.name} » importé.` } : { ok: false, text: res.error });
  };

  const rename = (p: ProjectMeta) => {
    const name = window.prompt('Nouveau nom du projet :', p.name);
    if (name && name.trim()) updateProjectMeta(p.id, { name: name.trim().slice(0, 80) });
  };
  const remove = (p: ProjectMeta) => {
    const msg = p.sample ? `Réinitialiser « ${p.name} » à son état d'exemple ? Vos modifications seront perdues.` : `Supprimer définitivement « ${p.name} » ?`;
    if (confirm(msg)) deleteProject(p.id);
  };

  const iconBtn = 'p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors';
  const actions = (p: ProjectMeta) => (
    <div className="flex items-center gap-0.5">
      <button onClick={() => rename(p)} className={iconBtn} title="Renommer"><span className="material-symbols-outlined text-[17px]">edit</span></button>
      <button onClick={() => duplicateProject(p.id)} className={iconBtn} title="Dupliquer"><span className="material-symbols-outlined text-[17px]">content_copy</span></button>
      <button onClick={() => onExportProject(p.id)} className={iconBtn} title="Exporter…"><span className="material-symbols-outlined text-[17px]">file_download</span></button>
      <button onClick={() => remove(p)} className={`${iconBtn} hover:!text-error`} title={p.sample ? 'Réinitialiser l\'exemple' : 'Supprimer'}>
        <span className="material-symbols-outlined text-[17px]">{p.sample ? 'restart_alt' : 'delete'}</span>
      </button>
    </div>
  );

  const stat = (label: string, value: React.ReactNode, sub: string, icon: string, tone = 'text-on-surface') => (
    <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-xl font-bold font-mono ${tone}`}>{value}</span>
        <span className="text-[10px] text-outline font-mono">{sub}</span>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-surface text-on-surface px-4 lg:px-8 py-6 space-y-6">
      {notice && (
        <div className={`p-3 rounded border flex items-center justify-between text-xs font-mono ${notice.ok ? 'bg-tertiary-container/30 border-tertiary text-on-surface' : 'bg-error-container/20 border-error text-on-surface'}`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${notice.ok ? 'text-tertiary' : 'text-error'}`}>{notice.ok ? 'check_circle' : 'error'}</span>
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-outline hover:text-on-surface"><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[10px] uppercase tracking-wider font-semibold">Workspace local</span>
            <span className="font-mono text-[10px] text-outline">Enregistrement automatique</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface font-sans">Projets d'architecture</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            Vos plans, niveaux, planches et blocs sont enregistrés dans ce navigateur. Exportez en JSON, SVG, DXF, PDF ou métrés à tout moment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-container-lowest p-1 rounded gap-1 border border-outline-variant/30 shadow-sm">
            {([['grid', 'grid_view', 'Vue grille'], ['list', 'view_list', 'Vue liste']] as const).map(([m, ic, t]) => (
              <button key={m} onClick={() => setViewMode(m)} title={t} type="button"
                className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${viewMode === m ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-[17px]">{ic}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="appearance-none bg-surface-container-low text-on-surface text-xs font-mono px-3 py-2 pr-8 rounded border border-outline-variant/30 focus:outline-none focus:bg-surface-container-high cursor-pointer shadow-sm">
              <option value="date">Trier : Dernière modification</option>
              <option value="name">Trier : Nom (A-Z)</option>
              <option value="phase">Trier : Phase</option>
              <option value="surface">Trier : Surface</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-2.5 text-[15px] text-on-surface-variant pointer-events-none">expand_more</span>
          </div>
          <button onClick={onOpenNewProject} type="button"
            className="flex items-center gap-2 bg-primary-container hover:bg-primary text-on-primary-container text-xs font-semibold px-4 py-2 rounded transition-all shadow-md active:scale-95">
            <span className="material-symbols-outlined text-[17px]">add_circle</span><span>Nouveau projet</span>
          </button>
        </div>
      </div>

      {/* Indicateurs calculés sur les projets réels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat('Projets', projects.length, `${customBlocks} bloc(s) importé(s)`, 'layers')}
        {stat('Niveaux & objets', totals.levels, `${totals.objects.toLocaleString('fr-FR')} objets dessinés`, 'stacks')}
        {stat('Surface de pièces', `${totals.area.toLocaleString('fr-FR')} m²`, 'tous projets', 'square_foot', 'text-tertiary')}
        <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Stockage local</span>
            <span className="text-[10px] font-mono text-secondary font-bold">Navigateur</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-on-surface">{(usage.bytes / 1024).toFixed(0)} Ko</span>
              <span className="text-outline">≈ 5 Mo ({usagePct.toFixed(1)} %)</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded overflow-hidden">
              <div className={`${usagePct > 80 ? 'bg-error' : 'bg-primary'} h-full rounded`} style={{ width: `${Math.max(usagePct, 1)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)} type="button"
            className={`px-3 py-1.5 rounded font-mono text-xs transition-colors whitespace-nowrap ${
              activeCategory === cat.id ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20'}`}>
            {cat.label} ({countOf(cat.id)})
          </button>
        ))}
      </div>

      {/* Projets */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(p => (
            <div key={p.id} className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="p-3.5 bg-surface-container-low flex items-start justify-between gap-2 border-b border-outline-variant/20">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-on-surface truncate">{p.name}</h3>
                    <span className="bg-secondary/15 text-secondary px-1.5 rounded font-mono text-[10px]">{levelLabel(p.stats.levels)}</span>
                    {p.sample && <span className="bg-tertiary-container/30 text-tertiary px-1.5 rounded font-mono text-[10px]">Exemple</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px]">
                    <span className="text-primary truncate">{p.phase}</span>
                    <span className="text-outline">{p.version}</span>
                  </div>
                  {p.location && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{p.location}</p>}
                </div>
              </div>

              <div onClick={() => onOpenProject(p.id)} className="relative w-full h-48 bg-[#020912] p-3 flex items-center justify-center overflow-hidden cursor-pointer group">
                <ProjectThumb id={p.id} modified={p.modified} className="w-full h-full transition-transform group-hover:scale-[1.03] duration-300" />
                <div className="absolute top-2 right-2 pointer-events-none">
                  <span className="bg-surface-container-lowest/90 px-2 py-1 rounded text-primary font-mono text-[10px] flex items-center gap-1 border border-primary/20">
                    <span className="material-symbols-outlined text-[13px]">square_foot</span>{p.stats.areaM2 ? `${p.stats.areaM2} m²` : '— m²'}
                  </span>
                </div>
                {p.stats.widthM > 0 && (
                  <div className="absolute bottom-2 left-2 pointer-events-none">
                    <span className="bg-surface-container-lowest/90 px-2 py-0.5 rounded text-outline font-mono text-[9px] border border-outline-variant/30">
                      {p.stats.widthM.toFixed(2)} × {p.stats.depthM.toFixed(2)} m
                    </span>
                  </div>
                )}
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between gap-2 font-mono text-[10px] text-outline border-t border-outline-variant/20">
                <span>{p.stats.levels} niveau(x)</span><span>{p.stats.objects} objets</span><span>{p.stats.sheets} planche(s)</span>
              </div>

              <div className="p-2.5 pl-3.5 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant/20">
                <span className="font-mono text-[10px] text-outline flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">update</span>{p.sample && p.modified.startsWith('2024-11-01') ? 'Exemple fourni' : relativeTime(p.modified)}</span>
                <div className="flex items-center gap-1">
                  {actions(p)}
                  <button onClick={() => onOpenProject(p.id)} className="ml-1 font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                    Ouvrir <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Import d'un projet */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`bg-surface-container-lowest rounded border border-dashed p-6 shadow-sm flex flex-col items-center justify-center text-center group transition-all min-h-[16rem] ${
              isDragOver ? 'border-primary bg-surface-container-high scale-[1.01]' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}
          >
            <input type="file" id="projectFileInput" accept=".json,application/json" className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
            <div className="w-12 h-12 rounded bg-surface-container-high group-hover:bg-primary/20 text-primary flex items-center justify-center transition-colors mb-3">
              <span className="material-symbols-outlined text-[28px]">upload_file</span>
            </div>
            <h3 className="text-sm font-semibold text-on-surface">Importer un projet</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
              Glissez-déposez un fichier <span className="text-primary font-mono font-semibold">.arcki.json</span> exporté depuis ARCKI CAD (niveaux, planches et blocs inclus).
            </p>
            <button onClick={() => document.getElementById('projectFileInput')?.click()} type="button"
              className="mt-4 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-xs text-on-surface font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[16px]">folder_open</span><span>Sélectionner sur le disque</span>
            </button>
            <span className="font-mono text-[10px] text-outline mt-2">Import DXF / DWG / IFC : non disponible</span>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden">
          <div className="hidden md:grid grid-cols-[3fr_1.4fr_0.7fr_0.7fr_0.8fr_1.1fr_auto] gap-3 px-4 py-2 bg-surface-container-low font-mono text-[10px] text-outline uppercase">
            <span>Projet</span><span>Phase</span><span>Niveaux</span><span>Objets</span><span>Surface</span><span>Modifié</span><span className="w-[116px]" />
          </div>
          {filtered.map(p => (
            <div key={p.id} className="grid grid-cols-2 md:grid-cols-[3fr_1.4fr_0.7fr_0.7fr_0.8fr_1.1fr_auto] gap-3 px-4 py-2.5 items-center border-t border-outline-variant/20 hover:bg-surface-container-low/60">
              <button onClick={() => onOpenProject(p.id)} className="flex items-center gap-3 text-left min-w-0">
                <div className="w-14 h-10 bg-[#020912] rounded border border-outline-variant/30 flex-none overflow-hidden"><ProjectThumb id={p.id} modified={p.modified} className="w-full h-full" /></div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-on-surface truncate">{p.name}{p.sample && <span className="ml-1.5 bg-tertiary-container/30 text-tertiary px-1.5 rounded font-mono text-[10px]">Exemple</span>}</div>
                  <div className="text-[10px] text-on-surface-variant truncate">{p.location || '—'}</div>
                </div>
              </button>
              <span className="font-mono text-[11px] text-primary truncate">{p.phase}</span>
              <span className="font-mono text-[11px] text-on-surface">{levelLabel(p.stats.levels)}</span>
              <span className="font-mono text-[11px] text-on-surface">{p.stats.objects}</span>
              <span className="font-mono text-[11px] text-on-surface">{p.stats.areaM2 ? `${p.stats.areaM2} m²` : '—'}</span>
              <span className="font-mono text-[10px] text-outline">{p.sample && p.modified.startsWith('2024-11-01') ? 'Exemple fourni' : relativeTime(p.modified)}</span>
              {actions(p)}
            </div>
          ))}
          <div className="border-t border-outline-variant/20 p-3 flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-mono text-[11px]">Importer un projet (.arcki.json)</span>
            <button onClick={() => document.getElementById('projectFileInput')?.click()} className="px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-xs font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">folder_open</span>Choisir un fichier
            </button>
            <input type="file" id="projectFileInput" accept=".json,application/json" className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
          </div>
        </div>
      )}

      {!filtered.length && (
        <div className="p-8 text-center text-on-surface-variant font-mono text-xs border border-dashed border-outline-variant/40 rounded">
          Aucun projet ne correspond à cette recherche ou à ce filtre.
        </div>
      )}

      <footer className="w-full bg-surface-container-lowest py-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-outline">
        <span>ARCKI CAD — données enregistrées localement dans ce navigateur (aucun envoi sur un serveur)</span>
        <span>Sauvegardez vos projets importants : Exporter → Projet ARCKI</span>
      </footer>
    </div>
  );
};
