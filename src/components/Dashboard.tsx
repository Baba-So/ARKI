import React, { useState } from 'react';
import { ProjectData } from '../types.ts';

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  searchQuery?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenProject,
  onOpenNewProject,
  searchQuery = '',
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [isDragOver, setIsDragOver] = useState(false);
  const [importedFileNotice, setImportedFileNotice] = useState<string | null>(null);

  // Projects sample list
  const projects: ProjectData[] = [
    {
      id: 'villa-horizon',
      name: 'Villa Horizon',
      phase: 'Permis de construire (PC)',
      version: 'v1.4',
      cadastralRef: 'Parcelle cadastrale #402-A // Biarritz Côte Basque',
      modified: 'Il y a 23 min',
      author: 'Thomas D.',
      collaborators: ['AL', 'MV', '+1'],
      dimensions: { width: '18.40 m', height: '7.80 m' },
      shon: '168.4 m²',
      category: 'pc',
      re2020Valid: true,
    },
    {
      id: 'residence-les-pins',
      name: 'Résidence Les Pins',
      phase: 'R+2 · Esquisse V2',
      version: 'v2.1',
      cadastralRef: 'ZAC des Oliviers // Bordeaux Sud',
      modified: 'Hier',
      author: 'Amélie L.',
      collaborators: ['AL'],
      dimensions: { width: '24.50 m', height: '14.20 m' },
      shon: '340.0 m²',
      category: 'esquisse',
      re2020Valid: true,
    },
    {
      id: 'loft-marais',
      name: 'Extension Loft Marais',
      phase: 'EXE · Rénovation lourde',
      version: 'v1.0',
      cadastralRef: 'Rue de Turenne // Paris 3e',
      modified: '14 nov.',
      author: 'Marc V.',
      collaborators: ['MV', 'TD'],
      dimensions: { width: '12.00 m', height: '9.50 m' },
      shon: '95.2 m²',
      category: 'exe',
      re2020Valid: false,
    },
    {
      id: 'pavillon-solaire',
      name: 'Pavillon Solaire Bioclimatique',
      phase: 'Faisabilité IA',
      version: 'v0.9',
      cadastralRef: 'Éco-quartier Camargue // Arles',
      modified: 'Il y a 3 jours',
      author: 'Thomas D.',
      collaborators: ['TD'],
      dimensions: { width: '16.80 m', height: '11.00 m' },
      shon: '142.0 m²',
      category: 'faisabilite',
      re2020Valid: true,
    },
  ];

  // Filtering
  const filteredProjects = projects.filter((p) => {
    const matchesCat =
      activeCategory === 'all' ||
      (activeCategory === 'pc' && p.category === 'pc') ||
      (activeCategory === 'esquisse' && p.category === 'esquisse') ||
      (activeCategory === 'exe' && p.category === 'exe') ||
      (activeCategory === 'renovation' && (p.category === 'exe' || p.category === 'esquisse'));

    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cadastralRef.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setImportedFileNotice(`Fichier "${file.name}" importé ! Vectorisation IA en cours...`);
    setTimeout(() => {
      onOpenProject('villa-horizon');
    }, 1200);
  };

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-surface text-on-surface px-4 lg:px-8 py-6 space-y-6">
      {/* Upload Notification Alert */}
      {importedFileNotice && (
        <div className="p-3 bg-tertiary-container/30 border border-tertiary rounded flex items-center justify-between text-xs text-on-surface font-mono animate-bounce">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">check_circle</span>
            <span>{importedFileNotice}</span>
          </div>
          <button onClick={() => setImportedFileNotice(null)} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[10px] uppercase tracking-wider font-semibold">
              Workspace Principal
            </span>
            <span className="font-mono text-[10px] text-outline">REV. 2024.11</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface font-sans">
            Projets d'architecture
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            Gérez vos plans CAO, versions paramétriques et modèles d'exécution optimisés par le copilote IA spatial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Grid / List switch */}
          <div className="flex items-center bg-surface-container-lowest p-1 rounded gap-1 border border-outline-variant/30 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Vue grille"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                viewMode === 'list' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Vue liste"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">view_list</span>
            </button>
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-surface-container-low text-on-surface text-xs font-mono px-3 py-2 pr-8 rounded border border-outline-variant/30 focus:outline-none focus:bg-surface-container-high cursor-pointer shadow-sm"
            >
              <option value="date">Trier : Dernière modification</option>
              <option value="name">Trier : Nom de projet (A-Z)</option>
              <option value="phase">Trier : Phase réglementaire</option>
              <option value="re2020">Trier : Statut calcul RE2020</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-2.5 text-[15px] text-on-surface-variant pointer-events-none">
              expand_more
            </span>
          </div>

          {/* New Project CTA */}
          <button
            onClick={onOpenNewProject}
            className="flex items-center gap-2 bg-primary-container hover:bg-primary text-on-primary-container text-xs font-semibold px-4 py-2 rounded transition-all shadow-md active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>Nouveau projet</span>
          </button>
        </div>
      </div>

      {/* Telemetry & Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Projets Actifs</span>
            <span className="material-symbols-outlined text-primary text-[18px]">layers</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-on-surface font-mono">12</span>
            <span className="text-[10px] text-tertiary font-mono flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[12px]">trending_up</span> +2 ce mois
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Versions CAO</span>
            <span className="material-symbols-outlined text-primary text-[18px]">history</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-on-surface font-mono">38</span>
            <span className="text-[10px] text-outline font-mono">Sauvegarde IFC4</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Suggestions IA</span>
            <span className="material-symbols-outlined text-tertiary text-[18px]">auto_awesome</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-tertiary font-mono">142</span>
            <span className="text-[10px] text-tertiary font-mono">98.4% acceptées</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-3.5 rounded border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Stockage Cloud</span>
            <span className="text-[10px] font-mono text-secondary font-bold">Plan Pro</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-on-surface">4.2 Go</span>
              <span className="text-outline">50 Go (8.4%)</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded overflow-hidden">
              <div className="bg-primary h-full rounded" style={{ width: '8.4%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'Tous les projets (12)' },
            { id: 'esquisse', label: 'Esquisse (3)' },
            { id: 'pc', label: 'Permis de construire (4)' },
            { id: 'exe', label: 'Chantier / EXE (3)' },
            { id: 'renovation', label: 'Rénovation (2)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded font-mono text-xs transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
              }`}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="hidden xl:flex items-center gap-3 font-mono text-[10px] text-outline">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary"></span> Moteur DXF v2024
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span> Détection thermique IA
          </span>
        </div>
      </div>

      {/* Main Projects Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* 1. VILLA HORIZON (Featured Project Card spanning 2 columns) */}
        <div className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden shadow-lg flex flex-col justify-between group transition-all md:col-span-2 xl:col-span-2">
          {/* Card Header */}
          <div className="p-4 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-tertiary animate-ping"></span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-on-surface">Villa Horizon</h2>
                  <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase">
                    Permis de construire (PC)
                  </span>
                  <span className="bg-surface-container text-on-surface-variant font-mono text-[10px] px-1.5 py-0.5 rounded">
                    v1.4
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Parcelle cadastrale #402-A // Biarritz Côte Basque
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => alert("Historique des versions IFC : v1.4, v1.3, v1.2 avec audit de conformité.")}
                className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant"
                title="Historique des versions"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
              </button>
              <button
                onClick={() => onOpenProject('villa-horizon')}
                className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant"
                title="Options"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
            </div>
          </div>

          {/* Technical CAD Blueprint Canvas */}
          <div 
            onClick={() => onOpenProject('villa-horizon')}
            className="relative w-full h-64 bg-[#030b14] overflow-hidden flex items-center justify-center p-4 cursor-pointer group"
          >
            {/* Background Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dashGridLarge" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4cd7f6" strokeWidth="0.5" />
                </pattern>
                <pattern id="dashGridSmall" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M 8 0 L 0 0 0 8" fill="none" opacity="0.4" stroke="#4cd7f6" strokeWidth="0.2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dashGridSmall)" />
              <rect width="100%" height="100%" fill="url(#dashGridLarge)" />
            </svg>

            {/* Floorplan Vector Overlay */}
            <svg className="w-full h-full max-w-2xl relative z-10 transition-transform group-hover:scale-[1.02] duration-300" viewBox="0 0 700 240" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Exterior load-bearing walls */}
              <path d="M40 30 H660 V210 H40 Z" fill="#062233" fillOpacity="0.4" stroke="#4cd7f6" strokeWidth="2.5" />
              {/* Interior partition walls */}
              <path d="M260 30 V210" stroke="#4cd7f6" strokeWidth="1.75" />
              <path d="M460 30 V130 H660" stroke="#4cd7f6" strokeWidth="1.75" />
              <path d="M460 130 V210" stroke="#4cd7f6" strokeWidth="1.75" />
              <path d="M40 120 H180 V210" stroke="#4cd7f6" strokeWidth="1.5" />

              {/* Door swings & openings */}
              <path d="M180 60 A 30 30 0 0 1 210 90" fill="none" stroke="#ffb95f" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="180" y1="60" x2="180" y2="90" stroke="#ffb95f" strokeWidth="1.5" />
              <path d="M460 60 A 28 28 0 0 0 432 88" fill="none" stroke="#ffb95f" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="460" y1="60" x2="460" y2="88" stroke="#ffb95f" strokeWidth="1.5" />

              {/* Dimensioning Lines */}
              <g stroke="#869397" strokeWidth="0.8">
                <line x1="40" y1="16" x2="660" y2="16" />
                <line x1="40" y1="12" x2="40" y2="20" />
                <line x1="660" y1="12" x2="660" y2="20" />
                <line x1="260" y1="12" x2="260" y2="20" />
                <line x1="24" y1="30" x2="24" y2="210" />
                <line x1="20" y1="30" x2="28" y2="30" />
                <line x1="20" y1="210" x2="28" y2="210" />
              </g>

              {/* Room Labels */}
              <text x="350" y="14" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="9" textAnchor="middle">18.40 m</text>
              <text x="18" y="125" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="9" textAnchor="middle" transform="rotate(-90 18 125)">7.80 m</text>
              <g fontFamily="Inter" fontSize="10" fontWeight="600">
                <text x="110" y="80" fill="#d4e4fa">CUISINE & CELLIER</text>
                <text x="110" y="94" fill="#869397" fontFamily="JetBrains Mono" fontSize="9">24.6 m² // HSP 2.70m</text>
                <text x="350" y="115" fill="#d4e4fa">GRAND SÉJOUR & SALON</text>
                <text x="350" y="129" fill="#869397" fontFamily="JetBrains Mono" fontSize="9">54.2 m² // Chappe isolée</text>
                <text x="550" y="75" fill="#d4e4fa">SUITE PARENTALE</text>
                <text x="550" y="89" fill="#869397" fontFamily="JetBrains Mono" fontSize="9">22.8 m² // Parquet chêne</text>
                <text x="550" y="170" fill="#d4e4fa">BUREAU / WORKSPACE</text>
                <text x="550" y="184" fill="#869397" fontFamily="JetBrains Mono" fontSize="9">14.1 m²</text>
              </g>

              {/* AI Copilot Live Annotation Badge */}
              <rect x="290" y="160" width="130" height="26" rx="3" fill="#010f1f" stroke="#4edea3" strokeWidth="1" />
              <circle cx="304" cy="173" r="3.5" fill="#4edea3" />
              <text x="315" y="177" fill="#4edea3" fontFamily="JetBrains Mono" fontSize="8.5" fontWeight="600">
                IA: Optim. Baie vitrée
              </text>
            </svg>

            {/* Viewport badges */}
            <div className="absolute bottom-2 left-3 flex items-center gap-2 pointer-events-none">
              <span className="bg-surface-container-lowest/90 px-2 py-0.5 rounded text-outline font-mono text-[9px] border border-outline-variant/30">
                SCALE 1:50
              </span>
              <span className="bg-surface-container-lowest/90 px-2 py-0.5 rounded text-outline font-mono text-[9px] border border-outline-variant/30">
                CALQUE: A-WALL-CORE
              </span>
            </div>
            <div className="absolute top-2 right-3 pointer-events-none">
              <span className="bg-surface-container-lowest/90 px-2 py-1 rounded text-primary font-mono text-[10px] flex items-center gap-1 border border-primary/20">
                <span className="material-symbols-outlined text-[13px]">bolt</span> SHON: 168.4 m²
              </span>
            </div>
          </div>

          {/* Footer & Actions */}
          <div className="p-4 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center font-mono text-[10px] font-bold text-primary">
                  TD
                </div>
                <span className="text-xs text-on-surface">Thomas D.</span>
              </div>
              <div className="h-3 w-px bg-surface-container-high"></div>
              <span className="font-mono text-[10px] text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">update</span> Modifié il y a 23 min
              </span>
              <div className="hidden sm:flex items-center -space-x-1.5" title="3 collaborateurs actifs">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-[8px] font-bold">AL</span>
                <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-mono text-[8px] font-bold">MV</span>
                <span className="w-5 h-5 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center font-mono text-[8px] font-bold">+1</span>
              </div>
            </div>

            <button
              onClick={() => onOpenProject('villa-horizon')}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface font-semibold text-xs transition-all shadow-sm active:scale-95"
            >
              <span>Ouvrir dans l'éditeur CAO</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* 2. RÉSIDENCE LES PINS */}
        <div className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-on-surface">Résidence Les Pins</h3>
                <span className="bg-secondary/15 text-secondary px-1.5 py-0.2 rounded font-mono text-[10px]">R+2</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[10px] text-secondary">Esquisse V2</span>
                <span className="font-mono text-[10px] text-outline">v2.1</span>
              </div>
            </div>
            <button onClick={() => onOpenProject('residence-les-pins')} className="text-on-surface-variant hover:text-on-surface p-1">
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>

          {/* Blueprint Thumbnail */}
          <div 
            onClick={() => onOpenProject('residence-les-pins')}
            className="relative w-full h-44 bg-[#020912] p-3 flex items-center justify-center overflow-hidden cursor-pointer"
          >
            <svg viewBox="0 0 280 150" className="w-full h-full max-w-xs" fill="none">
              {/* Central Core & Stairs */}
              <rect x="110" y="35" width="60" height="70" fill="#091b2c" stroke="#4cd7f6" strokeWidth="1.5" />
              {[45, 55, 65, 75, 85, 95].map(y => (
                <line key={y} x1="110" y1={y} x2="140" y2={y} stroke="#4cd7f6" strokeWidth="0.8" />
              ))}
              <rect x="145" y="45" width="20" height="50" stroke="#ffb95f" strokeWidth="1" />
              <line x1="145" y1="45" x2="165" y2="95" stroke="#ffb95f" strokeWidth="0.8" />
              <line x1="165" y1="45" x2="145" y2="95" stroke="#ffb95f" strokeWidth="0.8" />

              {/* Apartment Wings */}
              <rect x="20" y="20" width="85" height="100" stroke="#4cd7f6" strokeWidth="1.2" />
              <rect x="175" y="20" width="85" height="100" stroke="#4cd7f6" strokeWidth="1.2" />

              {/* Balconies */}
              <path d="M5 45 H20 V95 H5 Z" fill="#04221a" fillOpacity="0.2" stroke="#4edea3" strokeWidth="1" strokeDasharray="2 2" />
              <path d="M260 45 H275 V95 H260 Z" fill="#04221a" fillOpacity="0.2" stroke="#4edea3" strokeWidth="1" strokeDasharray="2 2" />

              <text x="55" y="75" fill="#869397" fontFamily="JetBrains Mono" fontSize="8" textAnchor="middle">LOGEMENT T3</text>
              <text x="220" y="75" fill="#869397" fontFamily="JetBrains Mono" fontSize="8" textAnchor="middle">LOGEMENT T2</text>
              <text x="140" y="125" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="7" textAnchor="middle">PALIER COMMUN</text>
            </svg>
            <div className="absolute bottom-2 right-2">
              <span className="inline-flex items-center gap-1 bg-surface-container-highest/90 px-1.5 py-0.5 rounded font-mono text-[9px] text-tertiary border border-tertiary/20">
                <span className="material-symbols-outlined text-[11px]">verified</span> RE2020 Validé
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant/20">
            <span className="font-mono text-[10px] text-outline">Modifié hier</span>
            <button
              onClick={() => onOpenProject('residence-les-pins')}
              className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              Charger plan <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
            </button>
          </div>
        </div>

        {/* 3. EXTENSION LOFT MARAIS */}
        <div className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-on-surface">Extension Loft Marais</h3>
                <span className="bg-tertiary-container/30 text-tertiary px-1.5 py-0.2 rounded font-mono text-[10px]">EXE</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-on-surface-variant font-mono">Rénovation lourde</span>
                <span className="font-mono text-[10px] text-outline">v1.0</span>
              </div>
            </div>
            <button onClick={() => onOpenProject('loft-marais')} className="text-on-surface-variant hover:text-on-surface p-1">
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>

          <div 
            onClick={() => onOpenProject('loft-marais')}
            className="relative w-full h-44 bg-[#020912] p-3 flex items-center justify-center overflow-hidden cursor-pointer"
          >
            <svg viewBox="0 0 280 150" className="w-full h-full max-w-xs" fill="none">
              {/* Existing stone masonry */}
              <rect x="25" y="20" width="230" height="110" stroke="#869397" strokeWidth="2" strokeDasharray="1 1" />
              {/* Demolished walls (red dashed) */}
              <line x1="90" y1="20" x2="90" y2="100" stroke="#ffb4ab" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="25" y1="80" x2="90" y2="80" stroke="#ffb4ab" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="60" y="55" fill="#ffb4ab" fontFamily="JetBrains Mono" fontSize="7" opacity="0.8">DÉMOLITION</text>

              {/* Structural IPN steel beams */}
              <rect x="90" y="20" width="10" height="110" fill="#06b6d4" />
              <rect x="170" y="20" width="8" height="110" fill="#06b6d4" />
              <line x1="90" y1="25" x2="170" y2="25" stroke="#4cd7f6" strokeWidth="3" />
              <text x="130" y="20" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="6.5" textAnchor="middle">IPN 240 RENFORT</text>

              {/* Mezzanine */}
              <rect x="175" y="30" width="75" height="90" fill="#ffb95f" fillOpacity="0.08" stroke="#ffb95f" strokeWidth="1" strokeDasharray="4 2" />
              <text x="210" y="78" fill="#ffb95f" fontFamily="JetBrains Mono" fontSize="7.5" textAnchor="middle">MEZZANINE</text>
            </svg>
            <div className="absolute bottom-2 left-2">
              <span className="inline-flex items-center gap-1 bg-surface-container-highest/90 px-1.5 py-0.5 rounded font-mono text-[9px] text-error border border-error/20">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Démolition validée
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant/20">
            <span className="font-mono text-[10px] text-outline">Modifié le 14 nov.</span>
            <button
              onClick={() => onOpenProject('loft-marais')}
              className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              Charger plan <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
            </button>
          </div>
        </div>

        {/* 4. PAVILLON SOLAIRE BIOCLIMATIQUE */}
        <div className="bg-surface-container-lowest rounded border border-outline-variant/30 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="p-3.5 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-on-surface">Pavillon Solaire Bioclimatique</h3>
                <span className="bg-primary-container/20 text-primary px-1.5 py-0.2 rounded font-mono text-[10px]">Faisabilité IA</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-tertiary font-mono">Gain passif +34%</span>
                <span className="font-mono text-[10px] text-outline">v0.9</span>
              </div>
            </div>
            <button onClick={() => onOpenProject('pavillon-solaire')} className="text-on-surface-variant hover:text-on-surface p-1">
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>

          <div 
            onClick={() => onOpenProject('pavillon-solaire')}
            className="relative w-full h-44 bg-[#020912] p-3 flex items-center justify-center overflow-hidden cursor-pointer"
          >
            <svg viewBox="0 0 280 150" className="w-full h-full max-w-xs" fill="none">
              {/* Trapezoidal solar footprint */}
              <polygon points="50,110 230,110 200,35 80,35" fill="#0c2332" fillOpacity="0.4" stroke="#4cd7f6" strokeWidth="1.8" />
              {/* South Glass Facade */}
              <line x1="50" y1="110" x2="230" y2="110" stroke="#ffb95f" strokeWidth="3" strokeLinecap="round" />
              <path d="M50 110 L60 125 M100 110 L110 125 M140 110 L150 125 M180 110 L190 125 M225 110 L235 125" stroke="#ffb95f" strokeWidth="1" />
              {/* Sun Angle Vector */}
              <line x1="140" y1="145" x2="140" y2="115" stroke="#ffb95f" strokeWidth="1" strokeDasharray="2 2" />
              <polygon points="140,110 137,117 143,117" fill="#ffb95f" />
              <text x="140" y="142" fill="#ffb95f" fontFamily="JetBrains Mono" fontSize="7" textAnchor="middle">SUD SOLAIRE 62°</text>

              {/* North Trombe wall */}
              <rect x="90" y="32" width="100" height="6" fill="#4edea3" />
              <text x="140" y="26" fill="#4edea3" fontFamily="JetBrains Mono" fontSize="7" textAnchor="middle">NORD // MUR INERTIE</text>

              {/* Compass */}
              <circle cx="250" cy="30" r="14" stroke="#869397" strokeWidth="0.8" />
              <line x1="250" y1="18" x2="250" y2="42" stroke="#869397" strokeWidth="0.8" />
              <line x1="238" y1="30" x2="262" y2="30" stroke="#869397" strokeWidth="0.8" />
              <text x="250" y="16" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="7" fontWeight="700" textAnchor="middle">N</text>
            </svg>
            <div className="absolute bottom-2 right-2">
              <span className="inline-flex items-center gap-1 bg-surface-container-highest/90 px-1.5 py-0.5 rounded font-mono text-[9px] text-primary border border-primary/20">
                <span className="material-symbols-outlined text-[11px]">solar_power</span> Simulation active
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant/20">
            <span className="font-mono text-[10px] text-outline">Modifié il y a 3 jours</span>
            <button
              onClick={() => onOpenProject('pavillon-solaire')}
              className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              Charger plan <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
            </button>
          </div>
        </div>

        {/* 5. INTERACTIVE DRAG & DROP IMPORT CARD */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          className={`bg-surface-container-lowest rounded border border-dashed p-6 shadow-sm flex flex-col items-center justify-center text-center group cursor-pointer transition-all ${
            isDragOver ? 'border-primary bg-surface-container-high scale-[1.01]' : 'border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          <input
            type="file"
            id="fileInput"
            accept=".dwg,.dxf,.pdf,.ifc"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className="w-12 h-12 rounded bg-surface-container-high group-hover:bg-primary/20 text-primary flex items-center justify-center transition-colors mb-3">
            <span className="material-symbols-outlined text-[28px]">upload_file</span>
          </div>
          <h3 className="text-sm font-semibold text-on-surface">Importer un plan existant</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
            Glissez-déposez vos fichiers <span className="text-primary font-mono font-semibold">DWG</span>, <span className="text-primary font-mono font-semibold">DXF</span> ou <span className="text-primary font-mono font-semibold">PDF vectoriel</span>.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <span className="bg-surface-container px-2 py-0.5 rounded font-mono text-[10px] text-outline border border-outline-variant/30">
              IFC 4.3
            </span>
            <span className="bg-surface-container px-2 py-0.5 rounded font-mono text-[10px] text-outline border border-outline-variant/30">
              AutoCAD R14-2024
            </span>
            <span className="bg-surface-container px-2 py-0.5 rounded font-mono text-[10px] text-outline border border-outline-variant/30">
              PDF multi-pages
            </span>
          </div>
          <button
            onClick={() => document.getElementById('fileInput')?.click()}
            className="mt-4 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-xs text-on-surface font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">folder_open</span>
            <span>Sélectionner sur le disque</span>
          </button>
          <span className="font-mono text-[10px] text-tertiary mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">auto_fix_high</span> Vectorisation par IA instantanée
          </span>
        </div>
      </div>

      {/* Active Drafting Sessions Console Bar */}
      <div className="bg-surface-container-low rounded p-3 flex flex-wrap items-center justify-between gap-4 border border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-on-surface">CONSOLE CAO :</span>
            <span className="font-mono text-[11px] text-on-surface-variant truncate">
              Liaison BIM Cloud établie (Paris-DC2). 4 modèles compilés sans collisions géométriques.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-tertiary flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> 0 Erreur IFC
          </span>
          <span className="text-outline">SNAP: POLAIRE 15°</span>
        </div>
      </div>

      {/* Footer engine telemetry */}
      <footer className="w-full bg-surface-container-lowest py-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-outline">
        <div className="flex items-center gap-4">
          <span>ARCKI CAD ENGINE v4.8.2 // PARAMETRIC CORE</span>
          <span className="text-primary font-bold">GPU ACCEL: ACTIVE (Vulkan)</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-on-surface-variant">© 2024 Arcki Technologies. Tous droits réservés.</span>
          <span className="text-outline">Normes BIM IFC4</span>
          <span className="text-outline">Statut Réseau (99.98%)</span>
        </div>
      </footer>
    </div>
  );
};
