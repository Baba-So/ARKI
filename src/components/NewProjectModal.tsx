import React, { useState } from 'react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectInfo: {
    name: string;
    location: string;
    phase: string;
    units: string;
    hsp: number;
    template: string;
    orientation: number;
  }) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [projectName, setProjectName] = useState('Villa Horizon - Lot 4');
  const [projectLocation, setProjectLocation] = useState('Biarritz, France · Zone sismique 2');
  const [selectedPhase, setSelectedPhase] = useState<'ESQ' | 'PC' | 'PRO' | 'EXE'>('PC');
  const [selectedUnit, setSelectedUnit] = useState<'mm' | 'cm' | 'm'>('mm');
  const [precision, setPrecision] = useState<'0.1' | '1.0'>('0.1');
  const [wallExt, setWallExt] = useState(200);
  const [wallInt, setWallInt] = useState(70);
  const [hsp, setHsp] = useState(2800);
  const [orientationNord, setOrientationNord] = useState(15);
  const [selectedTemplate, setSelectedTemplate] = useState<'vierge' | 'maison' | 'renov' | 'ai'>('vierge');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateProject({
      name: projectName,
      location: projectLocation,
      phase: selectedPhase,
      units: selectedUnit,
      hsp,
      template: selectedTemplate,
      orientation: orientationNord,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Background Dimmed Scrim with Simulated CAD Matrix */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#010f1f]/85 backdrop-blur-md transition-opacity" 
      />

      {/* Main Modal Card */}
      <div className="relative z-10 w-full max-w-5xl bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-5 py-3 bg-surface-container-low border-b border-outline-variant/20 flex-none">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors text-xs font-mono"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Projets</span>
            </button>
            <div className="h-3 w-px bg-outline-variant/30"></div>
            <nav className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-on-surface-variant">
              <span>ATELIER ARCKI</span>
              <span className="text-outline">/</span>
              <span>PARAMÉTRAGE INITIAL</span>
              <span className="text-outline">/</span>
              <span className="text-primary font-bold">NOUVEAU DESSIN CAD</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-tertiary flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded border border-tertiary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              IFC4 STANDARD · PRESET ARCHI-FR
            </span>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container-high transition-colors"
              title="Fermer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* STEP 01: Informations Générales */}
          <section className="bg-surface-container-low rounded-lg border border-outline-variant/20 p-4 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded font-bold">
                  01
                </span>
                <h2 className="text-sm sm:text-base font-bold text-on-surface">Informations Générales</h2>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                Métadonnées du dossier BIM
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Project Name */}
              <div className="md:col-span-7 flex flex-col gap-1">
                <label className="text-[10px] font-mono text-on-surface-variant flex items-center justify-between">
                  <span>NOM TECHNIQUE DU PROJET *</span>
                  <span className="text-outline font-mono">TAG: PRJ-2024-LOT</span>
                </label>
                <div className="relative flex items-center bg-surface-container-lowest rounded px-2.5 py-2 border border-outline-variant/30 focus-within:border-primary">
                  <span className="material-symbols-outlined text-[16px] text-outline mr-2">apartment</span>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="ex: Villa Horizon - Lot 4"
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-tertiary font-mono uppercase font-bold">Valide</span>
                </div>
              </div>

              {/* Geo Location */}
              <div className="md:col-span-5 flex flex-col gap-1">
                <label className="text-[10px] font-mono text-on-surface-variant flex items-center justify-between">
                  <span>LOCALISATION GÉORÉFÉRENCÉE</span>
                  <span className="text-secondary font-mono">SISMIQUE 2</span>
                </label>
                <div className="relative flex items-center bg-surface-container-lowest rounded px-2.5 py-2 border border-outline-variant/30 focus-within:border-primary">
                  <span className="material-symbols-outlined text-[16px] text-outline mr-2">location_on</span>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              {/* Architectural Phase */}
              <div className="md:col-span-12 flex flex-col gap-1.5 mt-1">
                <span className="text-[10px] font-mono text-on-surface-variant">
                  PHASE ARCHITECTURALE INITIALE (LOI MOP / BIM PHASE)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ESQ', title: 'ESQ / DIA', subtitle: 'Esquisse & Faisabilité' },
                    { id: 'PC', title: 'PC', subtitle: 'Permis de Construire' },
                    { id: 'PRO', title: 'PRO', subtitle: 'Conception Générale' },
                    { id: 'EXE', title: 'DCE / EXE', subtitle: 'Dossier de Consultation' },
                  ].map((phase) => (
                    <button
                      key={phase.id}
                      type="button"
                      onClick={() => setSelectedPhase(phase.id as any)}
                      className={`flex flex-col items-start p-2.5 rounded border text-left transition-all ${
                        selectedPhase === phase.id
                          ? 'bg-surface-container-highest border-primary text-primary shadow-sm ring-1 ring-primary'
                          : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{phase.title}</span>
                        {selectedPhase === phase.id && (
                          <span className="material-symbols-outlined text-[15px] text-primary">check_circle</span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">{phase.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* STEP 02: Paramètres Géométriques & Normes CAO */}
          <section className="bg-surface-container-low rounded-lg border border-outline-variant/20 p-4 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded font-bold">
                  02
                </span>
                <h2 className="text-sm sm:text-base font-bold text-on-surface">Paramètres Géométriques & Normes CAO</h2>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                Précision vectorielle & Cotations
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Sub-column: Units & Default Thickness */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                {/* Units */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-on-surface-variant">SYSTÈME D'UNITÉS DU DESSIN</label>
                  <div className="grid grid-cols-3 gap-1 bg-surface-container-lowest p-1 rounded border border-outline-variant/20">
                    {[
                      { id: 'mm', label: 'mm', desc: 'Recommandé' },
                      { id: 'cm', label: 'cm', desc: 'Métré bât.' },
                      { id: 'm', label: 'm', desc: 'Urbanisme' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUnit(u.id as any)}
                        className={`py-1 px-1 rounded font-mono text-xs text-center transition-all ${
                          selectedUnit === u.id
                            ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {u.label} <span className="text-[9px] block text-outline font-normal">{u.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Snapping Precision */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-on-surface-variant">PRÉCISION D'ACCROCHAGE & COTES</label>
                  <div className="flex items-center gap-2">
                    {['0.1', '1.0'].map((p) => (
                      <label
                        key={p}
                        onClick={() => setPrecision(p as any)}
                        className={`flex-1 flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                          precision === p
                            ? 'bg-surface-container border-primary text-primary'
                            : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface'
                        }`}
                      >
                        <span className="font-mono text-xs font-semibold">{p} mm</span>
                        <input
                          type="radio"
                          name="precision"
                          checked={precision === p}
                          onChange={() => setPrecision(p as any)}
                          className="accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Default Thicknesses */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-on-surface-variant">ÉPAISSEURS PAR DÉFAUT (CALQUES)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-surface-container-lowest rounded border border-outline-variant/20 flex flex-col gap-1">
                      <span className="text-[10px] text-on-surface-variant font-mono">Mur porteur ext.</span>
                      <div className="flex items-center justify-between">
                        <input
                          type="number"
                          value={wallExt}
                          onChange={(e) => setWallExt(Number(e.target.value))}
                          className="w-12 bg-transparent font-mono text-xs text-primary font-bold outline-none"
                        />
                        <span className="font-mono text-[10px] text-outline">mm</span>
                      </div>
                    </div>
                    <div className="p-2 bg-surface-container-lowest rounded border border-outline-variant/20 flex flex-col gap-1">
                      <span className="text-[10px] text-on-surface-variant font-mono">Cloison distrib.</span>
                      <div className="flex items-center justify-between">
                        <input
                          type="number"
                          value={wallInt}
                          onChange={(e) => setWallInt(Number(e.target.value))}
                          className="w-12 bg-transparent font-mono text-xs text-primary font-bold outline-none"
                        />
                        <span className="font-mono text-[10px] text-outline">mm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Sub-column: HSP & Section Visual Diagram */}
              <div className="lg:col-span-5 bg-surface-container-lowest rounded-lg border border-outline-variant/20 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    HAUTEUR SOUS PLAFOND (HSP STANDARD)
                  </span>
                  <span className="font-mono text-[10px] text-tertiary bg-surface-container px-1.5 py-0.5 rounded">
                    RDC TYPE
                  </span>
                </div>

                {/* Visual Parametric Section SVG */}
                <div className="my-2 relative flex items-center justify-center bg-surface-container-low rounded p-2 overflow-hidden border border-outline-variant/20">
                  <svg className="w-full h-24 text-on-surface" viewBox="0 0 280 110">
                    {/* Dalle Supérieure */}
                    <rect x="30" y="8" width="220" height="12" rx="1" fill="#273647" />
                    <line x1="30" y1="20" x2="250" y2="20" stroke="#4cd7f6" strokeWidth="1" />
                    <text x="140" y="16" fill="#bcc9cd" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                      DALLE BÉTON SUP. (+{(hsp / 1000 + 0.2).toFixed(2)}m)
                    </text>

                    {/* Murs latéraux en coupe hachurée */}
                    <rect x="30" y="20" width="22" height="70" fill="#1c2b3c" />
                    <path d="M 30 35 L 45 20 M 30 55 L 52 33 M 30 75 L 52 53 M 30 90 L 52 68" stroke="#3d494c" strokeWidth="1" />
                    <rect x="228" y="20" width="22" height="70" fill="#1c2b3c" />
                    <path d="M 228 35 L 243 20 M 228 55 L 250 33 M 228 75 L 250 53 M 228 90 L 250 68" stroke="#3d494c" strokeWidth="1" />

                    {/* Dalle Inférieure (Sol fini) */}
                    <rect x="30" y="90" width="220" height="14" rx="1" fill="#273647" />
                    <line x1="30" y1="90" x2="250" y2="90" stroke="#4edea3" strokeWidth="1.5" />
                    <text x="140" y="100" fill="#bcc9cd" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">
                      SOL FINI ±0.00m
                    </text>

                    {/* Cote Verticale interactive */}
                    <line x1="85" y1="23" x2="85" y2="87" stroke="#06b6d4" strokeWidth="1.5" />
                    <polygon points="85,21 82,26 88,26" fill="#06b6d4" />
                    <polygon points="85,89 82,84 88,84" fill="#06b6d4" />
                    <rect x="92" y="46" width="70" height="18" rx="2" fill="#051424" stroke="#06b6d4" strokeWidth="0.5" />
                    <text x="127" y="59" fill="#4cd7f6" fontSize="10" fontWeight="600" fontFamily="JetBrains Mono" textAnchor="middle">
                      {hsp} mm
                    </text>
                  </svg>
                </div>

                {/* Scrubber Numeric Field */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-on-surface-variant">VALEUR HSP :</span>
                  <div className="flex-1 flex items-center bg-surface-container rounded px-2 py-1 border border-outline-variant/20">
                    <input
                      type="number"
                      value={hsp}
                      onChange={(e) => setHsp(Number(e.target.value))}
                      className="w-full bg-transparent font-mono text-xs text-primary font-bold focus:outline-none"
                    />
                    <span className="font-mono text-[10px] text-outline">mm</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setHsp(h => Math.max(2200, h - 50))}
                      className="px-2 py-1 bg-surface-container hover:bg-surface-container-high rounded text-xs font-mono"
                    >
                      -50
                    </button>
                    <button
                      type="button"
                      onClick={() => setHsp(h => Math.min(4500, h + 50))}
                      className="px-2 py-1 bg-surface-container hover:bg-surface-container-high rounded text-xs font-mono"
                    >
                      +50
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Sub-column: Orientation Nord Compass */}
              <div className="lg:col-span-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 p-3 flex flex-col items-center justify-between">
                <div className="w-full flex items-center justify-between">
                  <span className="text-[10px] font-mono text-on-surface-variant">ORIENTATION NORD</span>
                  <span className="font-mono text-xs text-secondary font-bold">
                    {orientationNord.toFixed(1)}° NE
                  </span>
                </div>

                {/* Interactive Compass Dial */}
                <div
                  onClick={() => setOrientationNord(deg => (deg + 15) % 360)}
                  className="relative w-24 h-24 my-2 flex items-center justify-center cursor-pointer group"
                  title="Cliquer pour ajuster l'angle du Nord (+15°)"
                >
                  <div className="absolute inset-0 rounded-full border border-dashed border-outline-variant/40 group-hover:border-primary transition-colors"></div>
                  <div className="absolute inset-1 rounded-full border border-surface-container-high"></div>
                  <span className="absolute top-0 text-[10px] font-mono font-bold text-secondary">N</span>
                  <span className="absolute right-1 text-[9px] font-mono text-outline">E</span>
                  <span className="absolute bottom-0 text-[9px] font-mono text-outline">S</span>
                  <span className="absolute left-1 text-[9px] font-mono text-outline">O</span>

                  {/* Compass needle rotated */}
                  <div
                    className="relative w-full h-full flex items-center justify-center transition-transform duration-300"
                    style={{ transform: `rotate(${orientationNord}deg)` }}
                  >
                    <svg viewBox="0 0 24 74" width="24" height="74" fill="none">
                      <polygon points="12,0 18,37 6,37" fill="#ee9800" />
                      <polygon points="12,74 18,37 6,37" fill="#869397" />
                      <circle cx="12" cy="37" r="2.5" fill="#051424" />
                    </svg>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                  <span>Géoréférencement :</span>
                  <span className="text-tertiary font-bold">Lambert 93</span>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 03: Choix du Gabarit de Démarrage */}
          <section className="bg-surface-container-low rounded-lg border border-outline-variant/20 p-4 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded font-bold">
                  03
                </span>
                <h2 className="text-sm sm:text-base font-bold text-on-surface">
                  Choix du Gabarit de Démarrage (CAD Templates)
                </h2>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                Configuration des calques & blocs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'vierge',
                  title: 'Projet Vierge',
                  desc: 'Canvas vide avec grille millimétrique native, calques standards A-MUR, A-PORTE, A-COTE.',
                  footer: ['0 ENTITÉS', 'PUR DESSIN'],
                  icon: 'crop_free',
                },
                {
                  id: 'maison',
                  title: 'Maison Individuelle RDC',
                  desc: 'Emprise parcellaire pré-dessinée, salon traversant, suite parentale et gaines normalisées.',
                  footer: ['124 m² SHAB', '14 CALQUES'],
                  icon: 'home',
                },
                {
                  id: 'renov',
                  title: 'Rénovation & Relevé',
                  desc: 'Préréglage dynamique de tri-phasage : Existant, Démoli, et Projeté avec cartouches CERFA.',
                  footer: ['CODE COULEUR IFC', '3 PHASES'],
                  icon: 'architecture',
                },
                {
                  id: 'ai',
                  title: 'Générer avec Arcki AI',
                  desc: 'Saisie libre en langage naturel pour orchestrer le zonage volumétrique et l\'organigramme spatial.',
                  footer: ['GÉNÉRATIF', 'COPILOT v4.8'],
                  icon: 'smart_toy',
                },
              ].map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id as any)}
                  className={`flex flex-col justify-between p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate === tpl.id
                      ? 'bg-surface-container-highest border-primary shadow-md ring-1 ring-primary'
                      : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">{tpl.icon}</span>
                    </div>
                    {selectedTemplate === tpl.id ? (
                      <span className="flex items-center gap-1 font-mono text-[9px] text-primary font-bold bg-surface-container-lowest px-1.5 py-0.5 rounded border border-primary/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> SÉLECTIONNÉ
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-outline">GABARIT</span>
                    )}
                  </div>
                  <div className="mt-2.5">
                    <h3 className="text-xs sm:text-sm font-bold text-on-surface">{tpl.title}</h3>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">{tpl.desc}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-outline-variant/10 flex items-center justify-between font-mono text-[9px] text-outline">
                    <span>{tpl.footer[0]}</span>
                    <span className="text-tertiary font-semibold">{tpl.footer[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </form>

        {/* Modal Action Footer */}
        <footer className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 flex-none">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="text-xs font-mono text-on-surface-variant">
              FORMAT NATIF : <strong className="text-on-surface">.ARKCAD / IFC4-ADD2</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 rounded bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-xs transition-all shadow-md active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">bolt</span>
              <span>Créer le projet et ouvrir l'éditeur CAO</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
