import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo.tsx';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('architecte@agence.fr');
  const [password, setPassword] = useState('PrecisionCAD2025!');
  const [showPassword, setShowPassword] = useState(false);
  const [stayConnected, setStayConnected] = useState(true);
  const [firstName, setFirstName] = useState('Thomas');
  const [agencyName, setAgencyName] = useState('Atelier Arcki Studio');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess();
  };

  return (
    <div className="w-full min-h-screen bg-surface flex flex-col lg:flex-row text-on-surface">
      {/* LEFT PANEL: Technical Engine Showcase & Brand Statement */}
      <div className="lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-surface-container-lowest relative overflow-hidden border-b lg:border-b-0 lg:border-r border-outline-variant/30">
        {/* Decorative Grid Matrix Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-tertiary/10 blur-3xl pointer-events-none" />

        {/* Top Header Identity */}
        <div className="relative z-10 flex flex-col space-y-4">
          <BrandLogo size="lg" proBadge={true} showSubtitle={true} />

          <div className="inline-flex items-center self-start px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-mono text-[10px] tracking-wide border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
            CAO ARCHITECTURALE AI-NATIVE · V2.4 SOVEREIGN
          </div>

          <div className="space-y-3 pt-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface leading-snug">
              La précision de la CAO.<br />
              <span className="text-primary">La vitesse du langage naturel.</span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl leading-relaxed">
              Concevez vos projets en 2D exacte avec un moteur géométrique souverain et un copilote IA qui manipule de véritables entités architecturales, pas de simples pixels.
            </p>
          </div>
        </div>

        {/* Middle: Simulated Interactive Precision CAD Blueprint Viewport */}
        <div className="relative z-10 my-8 flex flex-col space-y-2">
          {/* Floating Terminal/CAD Command Strip */}
          <div className="rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-xl p-4 flex flex-col space-y-3">
            {/* Command Prompt Header */}
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-secondary/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary/70"></span>
                <span className="font-mono text-[10px] text-outline ml-2">CONSOLE // COORDONNÉES RÉELLES [EPSG:3946]</span>
              </div>
              <span className="font-mono text-[10px] text-tertiary bg-tertiary-container/20 px-2 py-0.5 rounded font-bold border border-tertiary/20">
                AUTO-SNAP : ACTIF
              </span>
            </div>

            {/* Command Typing Line */}
            <div className="flex items-center space-x-2 bg-surface-container-lowest px-3 py-2 rounded-lg font-mono text-xs border border-outline-variant/30">
              <span className="text-primary font-bold">ARCKI&gt;</span>
              <span className="text-on-surface">_WALL 4250mm --type="ITE-Beton200" --align=EXTERIEUR</span>
              <span className="inline-block w-2 h-3.5 bg-primary animate-ping"></span>
            </div>

            {/* Vector Blueprint Graphic Canvas Simulation */}
            <div className="relative h-44 w-full bg-surface-container-lowest rounded-lg overflow-hidden flex items-center justify-center p-2 border border-outline-variant/20">
              {/* CAD Grid lines SVG */}
              <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="authGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4cd7f6" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#authGrid)" />
              </svg>

              {/* Vector Blueprint entities */}
              <svg viewBox="0 0 320 140" className="relative w-full h-full max-w-sm" fill="none">
                {/* Wall base filled polygon */}
                <polygon points="30,40 270,40 270,68 30,68" className="fill-surface-container-high" />
                {/* Diagonal hatch lines */}
                <line x1="35" y1="68" x2="63" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="65" y1="68" x2="93" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="95" y1="68" x2="123" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="125" y1="68" x2="153" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="155" y1="68" x2="183" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="185" y1="68" x2="213" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="215" y1="68" x2="243" y2="40" stroke="#3d494c" strokeWidth="1.5" />
                <line x1="245" y1="68" x2="268" y2="45" stroke="#3d494c" strokeWidth="1.5" />

                {/* Outer Boundary Lines (Cyan CAD Pen) */}
                <line x1="30" y1="40" x2="270" y2="40" stroke="#4cd7f6" strokeWidth="2" />
                <line x1="30" y1="68" x2="270" y2="68" stroke="#4cd7f6" strokeWidth="2" />
                <line x1="30" y1="40" x2="30" y2="68" stroke="#4cd7f6" strokeWidth="2" />
                <line x1="270" y1="40" x2="270" y2="68" stroke="#4cd7f6" strokeWidth="2" />

                {/* Snapping Markers */}
                <rect x="27" y="37" width="6" height="6" fill="#4edea3" />
                <rect x="267" y="37" width="6" height="6" fill="#4edea3" />
                <polygon points="150,36 154,44 146,44" fill="#4edea3" />

                {/* Dimension Extension Lines */}
                <line x1="30" y1="36" x2="30" y2="18" stroke="#869397" strokeWidth="1" />
                <line x1="270" y1="36" x2="270" y2="18" stroke="#869397" strokeWidth="1" />
                <line x1="30" y1="22" x2="270" y2="22" stroke="#4cd7f6" strokeWidth="1" />
                <line x1="27" y1="25" x2="33" y2="19" stroke="#4cd7f6" strokeWidth="2" />
                <line x1="267" y1="25" x2="273" y2="19" stroke="#4cd7f6" strokeWidth="2" />

                {/* Dimension Text Bubble */}
                <rect x="120" y="12" width="60" height="18" rx="2" fill="#010f1f" stroke="#4cd7f6" strokeWidth="0.5" />
                <text x="150" y="25" fill="#4cd7f6" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" textAnchor="middle">
                  4 250 mm
                </text>

                {/* Perpendicular Snap Annotation */}
                <path d="M 30,85 L 30,105 L 50,105" stroke="#869397" strokeWidth="1" strokeDasharray="2 2" />
                <path d="M 30,95 L 40,95 L 40,105" fill="none" stroke="#4edea3" strokeWidth="1" />
                <text x="56" y="99" fill="#869397" fontFamily="JetBrains Mono" fontSize="9">
                  ORTHO 90.00°
                </text>
              </svg>

              {/* Badges */}
              <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 bg-surface-container-high/90 px-2 py-1 rounded text-primary font-mono text-[9px] border border-primary/20">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                <span>NORME RE2020 & IFC4 EXPORT VALIDE</span>
              </div>
              <div className="absolute bottom-2 right-2 text-outline font-mono text-[10px]">
                R = 5.82 m²·K/W
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Architect Testimonial */}
        <div className="relative z-10 flex flex-col space-y-2 pt-2">
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-start space-x-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex-shrink-0 flex items-center justify-center text-primary font-mono text-xs font-bold border border-primary/20">
              MV
            </div>
            <div className="flex flex-col space-y-0.5">
              <p className="text-xs text-on-surface italic leading-relaxed">
                « ARCKI nous fait gagner 4 heures par phase d'avant-projet sans jamais dénaturer la rigueur technique de nos plans d'exécution. »
              </p>
              <div className="flex items-center space-x-2 text-outline text-[11px] pt-0.5">
                <span className="text-on-surface font-semibold">Marc V.</span>
                <span>·</span>
                <span>Architecte DPLG — Atelier MV Architecture, Lyon</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Terminal Interface */}
      <div className="lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 bg-surface relative">
        <div className="w-full max-w-md flex flex-col space-y-6">
          {/* Top Switcher: Login vs Register Tabs */}
          <div className="p-1 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center space-x-1">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-center rounded text-xs font-semibold transition-all ${
                authMode === 'login'
                  ? 'bg-surface-container-high text-primary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Se connecter
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-center rounded text-xs font-semibold transition-all ${
                authMode === 'register'
                  ? 'bg-surface-container-high text-primary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* Section Title & Subheading */}
          <div className="flex flex-col space-y-1">
            <h2 className="text-xl font-bold text-on-surface">
              {authMode === 'login' ? 'Accès au Studio CAO' : 'Créer un poste Studio'}
            </h2>
            <p className="text-xs text-outline">
              {authMode === 'login'
                ? 'Connectez votre poste de travail pour reprendre vos fichiers de projet synchronisés.'
                : 'Rejoignez plus de 1 200 agences d\'architecture et bureaux d\'études.'}
            </p>
          </div>

          {/* Priority Social Auth: Google Workspace */}
          <button
            onClick={onLoginSuccess}
            type="button"
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-all text-on-surface text-xs font-medium border border-outline-variant/30 shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span className="tracking-wide">Continuer avec Google Workspace</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full h-px bg-outline-variant/30"></div>
            <span className="absolute px-3 bg-surface text-[10px] font-mono text-outline tracking-wider uppercase">
              ou par email professionnel
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            {authMode === 'register' && (
              <div className="flex space-x-2">
                <div className="flex-1 flex flex-col space-y-1">
                  <label className="text-[10px] font-mono text-outline">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sophie"
                    className="w-full px-3 py-2 bg-surface-container-lowest text-on-surface rounded-lg text-xs border border-outline-variant/30 focus:border-primary outline-none"
                    required
                  />
                </div>
                <div className="flex-1 flex flex-col space-y-1">
                  <label className="text-[10px] font-mono text-outline">Nom & Agence</label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Lambert (Atelier L.)"
                    className="w-full px-3 py-2 bg-surface-container-lowest text-on-surface rounded-lg text-xs border border-outline-variant/30 focus:border-primary outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email input */}
            <div className="flex flex-col space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-mono text-outline tracking-wide">EMAIL PROFESSIONNEL</label>
                <span className="text-[10px] font-mono text-primary font-bold">SSO Pris en charge</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-base">alternate_email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@agence-architecture.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-container-lowest text-on-surface rounded-lg font-mono text-xs border border-outline-variant/30 focus:border-primary outline-none"
                  required
                />
              </div>
            </div>

            {/* Password input */}
            <div className="flex flex-col space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-mono text-outline tracking-wide">MOT DE PASSE SÉCURISÉ</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => alert("Un lien de réinitialisation sécurisé a été envoyé à votre adresse email professionnelle.")}
                    className="text-[10px] font-mono text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-base">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-surface-container-lowest text-on-surface rounded-lg font-mono text-xs border border-outline-variant/30 focus:border-primary outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Checkbox: Stay Logged In */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                id="persist-session"
                type="checkbox"
                checked={stayConnected}
                onChange={(e) => setStayConnected(e.target.checked)}
                className="w-4 h-4 rounded bg-surface-container-lowest accent-primary cursor-pointer"
              />
              <label htmlFor="persist-session" className="text-xs text-on-surface-variant cursor-pointer select-none">
                Rester connecté sur ce poste de travail CAO
              </label>
            </div>

            {/* Main CTA */}
            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-md group active:scale-95"
            >
              <span>
                {authMode === 'login' ? 'Accéder au Studio ARCKI' : 'Démarrer l\'essai 14 jours (Sans CB)'}
              </span>
              <span className="material-symbols-outlined text-[17px] transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </button>
          </form>

          {/* Trust & Security Badges */}
          <div className="pt-4 flex flex-col space-y-2 text-center text-outline">
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col space-y-1.5">
              <div className="flex items-center justify-center space-x-1.5 text-tertiary font-mono text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">shield</span>
                <span>SOUVERAINETÉ ET CONFIDENTIALITÉ ARCHITECTURALE</span>
              </div>
              <p className="text-[10px] text-outline-variant leading-relaxed">
                Chiffrement AES-256 de bout en bout · Données hébergées en France · Modèles IA privés non réentraînés sur vos plans & maquettes BIM.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-4 pt-1 font-mono text-[10px] text-outline">
              <span className="hover:text-on-surface cursor-pointer">Conditions Générales</span>
              <span>·</span>
              <span className="hover:text-on-surface cursor-pointer">Conformité RGPD</span>
              <span>·</span>
              <span className="hover:text-on-surface cursor-pointer">Statut Réseau (99.98%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
