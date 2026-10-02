import React, { useState } from 'react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CourseModule {
  id: string;
  number: string;
  title: string;
  badge: string;
  description: string;
  content: React.ReactNode;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [activeModuleId, setActiveModuleId] = useState<string>('m1');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const modules: CourseModule[] = [
    {
      id: 'm1',
      number: 'Module 01',
      title: 'Philosophie, Stack & Architecture',
      badge: 'Architecture',
      description: 'Comprendre les fondations logicielles, le découpage modulaire et le choix du SVG.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-lg">
            <h4 className="font-bold text-sky-300 text-sm mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">architecture</span>
              Pourquoi concevoir un Studio CAO Web en SVG ?
            </h4>
            <p>
              Contrairement aux éditeurs basés sur Canvas 2D (HTML5 Canvas pixellisé) ou WebGL (complexe pour les tracés vectoriels fins), le <strong>SVG (Scalable Vector Graphics)</strong> offre :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li><strong>Résolution infinie</strong> : Aucun flou ni pixellisation, quelle que soit la valeur du zoom (de 10% à 2000%).</li>
              <li><strong>Arborescence DOM native</strong> : Chaque mur, porte, fenêtre et cotation est un élément SVG distinct (`&lt;line&gt;`, `&lt;rect&gt;`, `&lt;polygon&gt;`) doté de ses propres écouteurs d'événements.</li>
              <li><strong>Découpes géométriques matérielles</strong> : Possibilité d'utiliser les balises `&lt;mask&gt;` pour percer la maçonnerie des murs au passage des portes et fenêtres.</li>
            </ul>
          </div>

          <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Arborescence Modulaire</h4>
          <pre className="bg-[#020d18] p-3 rounded border border-outline-variant/30 font-mono text-[11px] text-sky-300 overflow-x-auto">
{`arcki-cad/
├── src/
│   ├── types.ts              # Dictionnaire unifié des entités CAO
│   ├── components/
│   │   ├── CadEditor.tsx     # Moteur SVG, événements, accrochage, dessin
│   │   ├── PropertiesSidebar.tsx # Inspecteur d'attributs de l'entité
│   │   ├── LayerManager.tsx  # Gestion des calques (structures, cloisons...)
│   │   ├── ExportModal.tsx   # Générateur DXF (AutoCAD R12) et SVG
│   │   └── CadLibraryPanel.tsx # Bibliothèque d'équipements & menuiseries`}
          </pre>
        </div>
      ),
    },
    {
      id: 'm2',
      number: 'Module 02',
      title: 'Modélisation des Données & Unités',
      badge: 'Types & Données',
      description: 'Système métrique millimétrique, échelle 1px = 10mm et interface CadEntity.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
              <span className="font-mono text-primary font-bold block mb-1">Échelle Canvas</span>
              <p className="font-mono text-[11px] text-slate-200">
                1 px SVG = 10 mm réels<br />
                10 px = 100 mm = 10 cm<br />
                100 px = 1000 mm = 1 m
              </p>
            </div>
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
              <span className="font-mono text-tertiary font-bold block mb-1">Épaisseurs Normalisées</span>
              <p className="font-mono text-[11px] text-slate-200">
                Mur porteur : 200 mm (20 px)<br />
                Cloison Placostil : 72 mm (7.2 px)<br />
                Cloison acoustique : 98 mm (9.8 px)
              </p>
            </div>
          </div>

          <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Modèle CadEntity dans `types.ts`</h4>
          <div className="relative">
            <pre className="bg-[#020d18] p-3 rounded border border-outline-variant/30 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`export interface CadEntity {
  id: string;
  name: string;
  type: 'wall' | 'partition' | 'door' | 'window' | 'dim' | 'room' | 'furniture' | 'rect' | 'circle' | 'line' | 'polygon' | 'polyline' | 'curve';
  layerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius?: number;                         // Rayon en px pour les cercles
  curvePoint?: { x: number; y: number };  // Point de contrôle Bézier
  points?: Array<{ x: number; y: number }>; // Sommets multiples
  thickness?: number;                      // Épaisseur en mm
  area?: number;                           // Surface en m²
  hostWallId?: string;                     // Mur hôte pour portes/fenêtres
  openingWidth?: number;                   // Largeur de passage en mm (ex: 830)
  doorSwing?: 'left' | 'right';            // Tirant Droit ou Gauche
}`}
            </pre>
            <button
              onClick={() => copyToClipboard(`export interface CadEntity { ... }`, 'm2_types')}
              className="absolute top-2 right-2 px-2 py-0.5 rounded bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary font-mono text-[10px] transition-colors"
            >
              {copiedSnippet === 'm2_types' ? '✓ Copié' : 'Copier'}
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'm3',
      number: 'Module 03',
      title: 'Moteur Mathématique & Géométrie 2D',
      badge: 'Maths & Géométrie',
      description: 'Distance euclidienne, orientations trigonométriques, produit scalaire et formule de Shoelace.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            Toutes les fonctions graphiques reposent sur des calculs analytiques fondamentaux :
          </p>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30 space-y-2">
            <span className="font-mono text-primary font-bold block">1. Formule du Lacet (Shoelace / Gauss) pour le calcul de surface</span>
            <p className="text-[11px]">
              Permet de calculer avec une précision absolue la surface d'un polygone fermé à $N$ sommets :
            </p>
            <pre className="bg-[#020d18] p-2 rounded font-mono text-[11px] text-sky-300">
{`const calcPolygonAreaM2 = (pts: Array<{ x: number; y: number }>) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const areaPx = Math.abs(sum) / 2;
  // Conversion en m² (1 px = 0.01 m => 1 px² = 0.0001 m²)
  return Math.round(areaPx * 0.0001 * 100) / 100;
};`}
            </pre>
          </div>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30 space-y-2">
            <span className="font-mono text-tertiary font-bold block">2. Vecteur Normal (Épaisseur d'un mur orienté)</span>
            <p className="text-[11px]">
              Pour donner de l'épaisseur à un mur orienté selon l'angle $\theta$ :
            </p>
            <pre className="bg-[#020d18] p-2 rounded font-mono text-[11px] text-tertiary">
{`const angle = Math.atan2(y2 - y1, x2 - x1);
const perpX = Math.sin(angle) * (thicknessPx / 2);
const perpY = -Math.cos(angle) * (thicknessPx / 2);
// 4 sommets du mur rectangulaire :
// P1(+perp), P2(+perp), P2(-perp), P1(-perp)`}
            </pre>
          </div>
        </div>
      ),
    },
    {
      id: 'm4',
      number: 'Module 04',
      title: 'Moteur d\'Accrochage Intelligent (OSNAP)',
      badge: 'OSNAP Magnetism',
      description: 'Accrochage aux extrémités, milieux, grille magnétique et projection sur maçonnerie.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            En CAO, l'utilisateur ne vise jamais à l'œil nu. Le moteur <strong>OSNAP (Object Snap)</strong> calcule en direct le point d'aimantation le plus opportun :
          </p>

          <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
            <div className="p-2 bg-sky-950/30 border border-sky-500/30 rounded">
              <span className="text-sky-300 font-bold block">Endpoint (Extrémité)</span>
              <span className="text-slate-400 text-[10px]">Aimante sur P1 et P2 des murs existants</span>
            </div>
            <div className="p-2 bg-emerald-950/30 border border-emerald-500/30 rounded">
              <span className="text-emerald-300 font-bold block">Midpoint (Milieu)</span>
              <span className="text-slate-400 text-[10px]">Aimante exactement au centre des segments</span>
            </div>
            <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded">
              <span className="text-amber-300 font-bold block">Grille (F9)</span>
              <span className="text-slate-400 text-[10px]">Alignement modulaire sur 20px (200mm)</span>
            </div>
          </div>

          <pre className="bg-[#020d18] p-3 rounded border border-outline-variant/30 font-mono text-[11px] text-amber-300 overflow-x-auto">
{`function findWallSnap(cursorX: number, cursorY: number, openingWidthMm: number, maxDist = 250) {
  // 1. Détection du mur hôte le plus proche
  // 2. Projection orthogonale du centre sur le segment du mur
  // 3. Calcul des points de tableau P1 et P2 le long du mur
  // 4. Héritage de l'épaisseur et de l'angle du mur hôte
}`}
          </pre>
        </div>
      ),
    },
    {
      id: 'm5',
      number: 'Module 05',
      title: 'Moteur de Rendu SVG & Calques',
      badge: 'Rendu Vectoriel',
      description: 'Organisation en calques normalisés, hachures paramétriques et masquage SVG dynamique.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            Chaque élément du plan est réparti sur un calque technique métier :
          </p>
          <ul className="space-y-1.5 font-mono text-[11px]">
            <li className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded">
              <span className="w-3 h-3 rounded-full bg-[#38bdf8]"></span>
              <strong className="text-sky-300">structures</strong> : Murs porteurs extérieurs et refends béton armé
            </li>
            <li className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded">
              <span className="w-3 h-3 rounded-full bg-[#4edea3]"></span>
              <strong className="text-emerald-300">cloisons</strong> : Cloisons distributives légères Placostil 72mm
            </li>
            <li className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded">
              <span className="w-3 h-3 rounded-full bg-[#fbbf24]"></span>
              <strong className="text-amber-300">ouvertures</strong> : Portes d'entrée, portes intérieures, fenêtres
            </li>
            <li className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded">
              <span className="w-3 h-3 rounded-full bg-[#a78bfa]"></span>
              <strong className="text-purple-300">mobilier</strong> : Blocs sanitaires, tables, lits et agencement
            </li>
            <li className="flex items-center gap-2 p-1.5 bg-surface-container-low rounded">
              <span className="w-3 h-3 rounded-full bg-[#f472b6]"></span>
              <strong className="text-pink-300">cotations</strong> : Cotes automatiques, étiquettes de surfaces
            </li>
          </ul>

          <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Masquage SVG des Découpes de Murs</h4>
          <pre className="bg-[#020d18] p-3 rounded border border-outline-variant/30 font-mono text-[11px] text-sky-300 overflow-x-auto">
{`<mask id={\`mask-\${wall.id}\`} maskUnits="userSpaceOnUse">
  {/* Rectangle blanc = matière de mur affichée */}
  <rect x="0" y="0" width="10000" height="10000" fill="white" />
  {/* Rectangles noirs = découpe nette au droit des baies */}
  {openings.map(op => (
    <rect x={op.minX} y={op.minY} width={op.w} height={op.h} fill="black" />
  ))}
</mask>`}
          </pre>
        </div>
      ),
    },
    {
      id: 'm6',
      number: 'Module 06',
      title: 'Machine à États & Événements',
      badge: 'Event Loop',
      description: 'Gestion du cycle de dessin en deux clics, du panoramique et de la pile d\'historique Undo/Redo.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            L'éditeur gère un automate d'états rigoureux pour garantir une expérience utilisateur fluide sans désynchronisation :
          </p>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30 font-mono text-[11px] space-y-2">
            <span className="text-primary font-bold">1. Conversion Coordonnées Écran ➔ Monde CAO</span>
            <pre className="bg-[#020d18] p-2 rounded text-slate-200">
{`const getCanvasCoords = (e: React.MouseEvent<SVGSVGElement>) => {
  const rect = svgRef.current.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom,
  };
};`}
            </pre>
          </div>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30 font-mono text-[11px] space-y-2">
            <span className="text-tertiary font-bold">2. Pile d'Historique avec États Immuables (Ctrl+Z / Ctrl+Y)</span>
            <pre className="bg-[#020d18] p-2 rounded text-slate-200">
{`const recordHistory = () => {
  setHistoryStack(prev => [...prev.slice(-30), JSON.stringify(entities)]);
  setRedoStack([]); // Réinitialise la pile de rétablissement
};`}
            </pre>
          </div>
        </div>
      ),
    },
    {
      id: 'm7',
      number: 'Module 07',
      title: 'Outils & Sous-Outils Paramétriques',
      badge: 'Outils CAO',
      description: 'Implémentation des sous-outils : Murs continus, 4 murs rectangle, cercles et courbes Bézier.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="space-y-2">
            <h4 className="font-bold text-sky-400 text-xs font-mono uppercase">1. Outil Mur [W] & Sous-outils</h4>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Mur Droit (`single`)</strong> : Deux clics définissent le segment maçonné.</li>
              <li><strong>Mur en Continu (`continuous`)</strong> : Chaque clic pose un angle et enchaîne le pan suivant (fermeture avec Entrée).</li>
              <li><strong>4 Murs Rectangle (`rect`)</strong> : En 2 clics (deux coins opposés), génère les 4 murs fermés d'une pièce avec raccords d'angles.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-amber-400 text-xs font-mono uppercase">2. Outil Forme [R] & Sous-outils</h4>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Rectangle</strong> : Calcul de l'emprise largeur × hauteur et surface en m².</li>
              <li><strong>Cercle</strong> : Clic 1 (Centre) ➔ Clic 2 (Rayon). Calcul du rayon, diamètre et surface $\pi R^2$.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-emerald-400 text-xs font-mono uppercase">3. Outil Tracé [L] & Sous-outils</h4>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Trait (`straight`)</strong> : Chaîne polygonale de segments droits fermables sur P1.</li>
              <li><strong>Libre (`freehand`)</strong> : Tracé fluide à main levée au glisser avec détection de boucle fermée.</li>
              <li><strong>Courbe Bézier (`curve`)</strong> : P1 (départ) ➔ P2 (arrivée) ➔ Clic 3 pour ajuster la flèche.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'm8',
      number: 'Module 08',
      title: 'Encastrement des Menuiseries (Portes & Fenêtres)',
      badge: 'Règle Métier DTU',
      description: 'Garantir que les portes et fenêtres sont scellées dans la maçonnerie sans flotter dans le vide.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg">
            <h4 className="font-bold text-amber-300 text-xs font-mono uppercase mb-1">Règle Métier Fondamentale</h4>
            <p>
              Aucune ouverture ne peut exister sans mur hôte. Lors du survol ou du dépôt d'une porte ou fenêtre, la fonction <code>findWallSnap</code> projette automatiquement la menuiserie sur le mur le plus proche, aligne son angle et son épaisseur, et perce la maçonnerie.
            </p>
          </div>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30 space-y-2">
            <span className="font-mono text-primary font-bold block">Débattement & Inversion de battant [Espace]</span>
            <p className="text-[11px]">
              La porte calcule son arc de débattement normalisé à 90° et son vantail mobile. Appuyer sur la touche <strong>Espace</strong> inverse instantanément le sens (Tirant Droit / Tirant Gauche).
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'm9',
      number: 'Module 09',
      title: 'Console de Commandes CLI & Raccourcis',
      badge: 'CLI AutoCAD',
      description: 'Ligne de commande interactive pour les architectes habitués aux raccourcis clavier AutoCAD.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px] border border-outline-variant/30">
              <thead className="bg-surface-container-high text-primary">
                <tr>
                  <th className="p-1.5 border-b border-outline-variant/30">Touche</th>
                  <th className="p-1.5 border-b border-outline-variant/30">Commande</th>
                  <th className="p-1.5 border-b border-outline-variant/30">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                <tr><td className="p-1.5 font-bold text-white">V</td><td>_SELECT</td><td>Sélectionner / Manipuler</td></tr>
                <tr><td className="p-1.5 font-bold text-white">W</td><td>_WALL</td><td>Mur porteur (Droit / Continu / 4 Murs)</td></tr>
                <tr><td className="p-1.5 font-bold text-white">C</td><td>_PARTITION</td><td>Cloison Placostil 72mm</td></tr>
                <tr><td className="p-1.5 font-bold text-white">P</td><td>_DOOR</td><td>Porte encastrée sur mur</td></tr>
                <tr><td className="p-1.5 font-bold text-white">F</td><td>_WINDOW</td><td>Fenêtre / Baie encastrée sur mur</td></tr>
                <tr><td className="p-1.5 font-bold text-white">R</td><td>_RECT</td><td>Forme (Rectangle / Cercle)</td></tr>
                <tr><td className="p-1.5 font-bold text-white">L</td><td>_POLY</td><td>Tracé (Trait / Libre / Courbe)</td></tr>
                <tr><td className="p-1.5 font-bold text-white">D</td><td>_DIM</td><td>Cotation automatique</td></tr>
                <tr><td className="p-1.5 font-bold text-white">Espace</td><td>_FLIP</td><td>Inverser le battant de porte</td></tr>
                <tr><td className="p-1.5 font-bold text-white">Entrée</td><td>_ENTER</td><td>Valider forme ou mur continu</td></tr>
                <tr><td className="p-1.5 font-bold text-white">Ctrl+Z</td><td>_UNDO</td><td>Annuler dernière action</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'm10',
      number: 'Module 10',
      title: 'Moteur d\'Export Vectoriel DXF & SVG',
      badge: 'Interopérabilité',
      description: 'Génération de fichiers DXF ASCII AutoCAD R12 et SVG sans dépendances externes.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <p>
            Pour garantir l'interopérabilité avec les logiciels tiers (AutoCAD, SketchUp, ArchiCAD), l'export génère un flux texte DXF conforme à la norme Autodesk :
          </p>

          <pre className="bg-[#020d18] p-3 rounded border border-outline-variant/30 font-mono text-[11px] text-amber-300 overflow-x-auto">
{`function exportDxf(entities: CadEntity[]) {
  let dxf = "0\\nSECTION\\n2\\nENTITIES\\n";
  for (const ent of entities) {
    if (ent.type === 'wall' || ent.type === 'partition') {
      dxf += \`0\\nLINE\\n8\\n\${ent.layerId.toUpperCase()}\\n\`;
      dxf += \`10\\n\${ent.x1 * 10}\\n20\\n\${-ent.y1 * 10}\\n\`; // Conversion mm + inversion Y
      dxf += \`11\\n\${ent.x2 * 10}\\n21\\n\${-ent.y2 * 10}\\n\`;
    }
  }
  dxf += "0\\nENDSEC\\n0\\nEOF";
  return dxf;
}`}
          </pre>
        </div>
      ),
    },
    {
      id: 'm11',
      number: 'Module 11',
      title: 'Guide de Reproduction Pas à Pas (A à Z)',
      badge: 'Tutoriel Pratique',
      description: 'Plan d\'implémentation étape par étape pour recréer l\'application de zéro.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <ol className="list-decimal list-inside space-y-2 text-[12px]">
            <li><strong>Étape 1</strong> : Initialiser le projet avec Vite + React + TypeScript + Tailwind CSS v4.</li>
            <li><strong>Étape 2</strong> : Écrire le fichier de typage strict <code>types.ts</code> avec l'interface unifiée <code>CadEntity</code>.</li>
            <li><strong>Étape 3</strong> : Créer le composant <code>CadEditor.tsx</code> avec le conteneur SVG, la grille technique et les écouteurs de souris.</li>
            <li><strong>Étape 4</strong> : Implémenter l'accrochage magnétique OSNAP et la projection orthogonale <code>findWallSnap</code>.</li>
            <li><strong>Étape 5</strong> : Coder les outils et sous-outils (Mur droit/continu/4 murs, Rectangle/Cercle, Trait/Libre/Courbe).</li>
            <li><strong>Étape 6</strong> : Ajouter la prévisualisation fantôme dynamique en temps réel (rubber-band, 4 murs, cercle, Bézier).</li>
            <li><strong>Étape 7</strong> : Intégrer l'inspecteur d'attributs <code>PropertiesSidebar.tsx</code> et la gestion des calques.</li>
            <li><strong>Étape 8</strong> : Coder l'export DXF et SVG haute fidélité dans <code>ExportModal.tsx</code>.</li>
          </ol>

          <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center justify-between">
            <span className="font-mono text-emerald-300 text-xs font-bold">Consultez également TUTORIAL.md à la racine du projet</span>
            <span className="material-symbols-outlined text-emerald-400">menu_book</span>
          </div>
        </div>
      ),
    },
  ];

  const filteredModules = modules.filter(
    (m) =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.badge.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeModule = modules.find((m) => m.id === activeModuleId) || modules[0];
  const activeIndex = modules.findIndex((m) => m.id === activeModule.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-[#051424] border border-primary/40 rounded-xl shadow-2xl flex flex-col overflow-hidden text-on-surface">
        {/* Header */}
        <div className="h-14 px-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between flex-none">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">school</span>
            <div>
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 font-mono">
                ARCKI CAD ACADÉMIE — Grand Cours de CAO 2D
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-semibold">
                  Guide A à Z
                </span>
              </h2>
              <p className="text-[10px] text-outline">
                Apprenez à concevoir, coder et recréer un studio d'architecture vectoriel paramétrique complet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Fermer le cours (Échap)"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Body Split: Sidebar Index + Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Index Sidebar */}
          <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col flex-none">
            {/* Search filter */}
            <div className="p-2.5 border-b border-outline-variant/20">
              <div className="flex items-center bg-surface-container-low px-2 py-1 rounded border border-outline-variant/20 text-xs">
                <span className="material-symbols-outlined text-[14px] text-outline mr-1.5">search</span>
                <input
                  type="text"
                  placeholder="Rechercher un module..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-transparent text-xs text-on-surface outline-none w-full"
                />
                {searchFilter && (
                  <button onClick={() => setSearchFilter('')} className="text-outline hover:text-on-surface text-xs">✕</button>
                )}
              </div>
            </div>

            {/* Modules List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredModules.map((mod) => {
                const isActive = mod.id === activeModule.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModuleId(mod.id)}
                    className={`w-full text-left p-2 rounded transition-all flex flex-col gap-0.5 border ${
                      isActive
                        ? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
                        : 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={isActive ? 'text-primary font-bold' : 'text-outline'}>{mod.number}</span>
                      <span className="px-1 rounded bg-surface-container text-[9px]">{mod.badge}</span>
                    </div>
                    <span className="font-semibold text-xs text-on-surface line-clamp-1">{mod.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom summary link */}
            <div className="p-3 border-t border-outline-variant/20 bg-surface-container-low text-[10px] font-mono text-outline">
              11 Modules · Architecture CAO complète
            </div>
          </aside>

          {/* Right Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[#030e1a]">
            {/* Module Title Banner */}
            <div className="p-4 bg-surface-container-low/60 border-b border-outline-variant/20 flex-none flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-primary">
                  <span>{activeModule.number}</span>
                  <span>·</span>
                  <span className="bg-primary/10 px-1.5 py-0.2 rounded text-[10px] font-bold">{activeModule.badge}</span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">{activeModule.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeModule.description}</p>
              </div>
            </div>

            {/* Scrollable Module Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeModule.content}
            </div>

            {/* Footer Navigation (Previous / Next Module) */}
            <div className="h-12 px-4 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between flex-none font-mono text-xs">
              <button
                disabled={activeIndex === 0}
                onClick={() => setActiveModuleId(modules[activeIndex - 1].id)}
                className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-30 disabled:hover:bg-surface-container flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Module précédent</span>
              </button>

              <span className="text-[11px] text-outline">
                {activeIndex + 1} / {modules.length}
              </span>

              <button
                disabled={activeIndex === modules.length - 1}
                onClick={() => setActiveModuleId(modules[activeIndex + 1].id)}
                className="px-3 py-1 rounded bg-primary/20 hover:bg-primary/30 disabled:opacity-30 disabled:hover:bg-primary/20 flex items-center gap-1 text-primary font-bold transition-colors border border-primary/30"
              >
                <span>Module suivant</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
