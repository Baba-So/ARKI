import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CadLevel } from '../types.ts';
import { DEFAULT_LEVEL_HEIGHT, DEFAULT_SLAB, buildingExtent, defaultLevelName, levelKind, restackLevels, slabOf } from '../levels.ts';

export interface LevelsConfigResult {
  levels: CadLevel[];
  autoStack: boolean;
  updateWalls: boolean;
}

interface LevelsConfigDialogProps {
  levels: CadLevel[];
  entityCounts: Record<string, number>;
  autoStack: boolean;
  onApply: (r: LevelsConfigResult) => void;
  onClose: () => void;
}

const inp = 'bg-[#020a12] border border-outline-variant/40 rounded px-1.5 py-1 font-mono text-[11px] text-on-surface outline-none focus:border-primary disabled:opacity-50';
const fmt = (mm: number) => `${mm >= 0 ? '+' : '−'}${(Math.abs(mm) / 1000).toFixed(2)}`;
const newId = () => `lvl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Configuration des étages : hauteurs, dalles, altitudes automatiques, génération de R+N. */
export const LevelsConfigDialog: React.FC<LevelsConfigDialogProps> = ({ levels, entityCounts, autoStack, onApply, onClose }) => {
  const [draft, setDraft] = useState<CadLevel[]>(() => [...levels].sort((a, b) => a.elevation - b.elevation).map(l => ({ ...l })));
  const [auto, setAuto] = useState(autoStack);
  const [updateWalls, setUpdateWalls] = useState(true);
  const [floorsAbove, setFloorsAbove] = useState(() => levels.filter(l => l.elevation > 0).length);
  const [allHeight, setAllHeight] = useState(() => levels.find(l => l.elevation === 0)?.height ?? DEFAULT_LEVEL_HEIGHT);

  // Liste affichée : altitudes recalculées si le mode automatique est actif
  const shown = useMemo(() => (auto ? restackLevels(draft) : [...draft].sort((a, b) => a.elevation - b.elevation)), [draft, auto]);
  const ext = buildingExtent(shown);
  const removed = levels.filter(l => !draft.some(d => d.id === l.id));
  const lostObjects = removed.reduce((n, l) => n + (entityCounts[l.id] || 0), 0);

  // en mode automatique, éditer une ligne part des altitudes recalculées (sinon l'ordre pourrait changer)
  const patchShown = (id: string, p: Partial<CadLevel>) => setDraft(shown.map(l => (l.id === id ? { ...l, ...p } : { ...l })));

  const addAbove = () => setDraft(() => {
    const base = shown;
    const top = base[base.length - 1];
    const nl: CadLevel = { id: newId(), name: defaultLevelName(base, 'above'), elevation: top ? top.elevation + top.height + DEFAULT_SLAB : 0, height: top?.height ?? DEFAULT_LEVEL_HEIGHT };
    return [...base, nl];
  });
  const addBelow = () => setDraft(() => {
    const base = shown;
    const bot = base[0];
    const h = bot?.height ?? DEFAULT_LEVEL_HEIGHT;
    const nl: CadLevel = { id: newId(), name: defaultLevelName(base, 'below'), elevation: bot ? bot.elevation - slabOf(bot) - h : 0, height: h };
    return [nl, ...base];
  });
  const remove = (id: string) => { if (draft.length > 1) setDraft(prev => prev.filter(l => l.id !== id)); };

  /** Ajuste le nombre d'étages au-dessus du RDC (ajoute ou retire des niveaux en tête). */
  const applyFloors = () => {
    const n = Math.max(0, Math.min(30, Math.round(floorsAbove)));
    let base = [...shown];
    const above = () => base.filter(l => l.elevation > 0);
    while (above().length > n) {
      const top = above().sort((a, b) => b.elevation - a.elevation)[0];
      base = base.filter(l => l.id !== top.id);
    }
    while (above().length < n) {
      const top = [...base].sort((a, b) => b.elevation - a.elevation)[0];
      base = [...base, { id: newId(), name: defaultLevelName(base, 'above'), elevation: top.elevation + top.height + DEFAULT_SLAB, height: top.height }];
    }
    setDraft(base);
  };

  const applyAllHeights = () => setDraft(shown.map(l => ({ ...l, height: Math.max(1800, allHeight) })));

  const submit = () => {
    if (lostObjects > 0 && !confirm(`${removed.length} niveau(x) supprimé(s) contenant ${lostObjects} objet(s) : ils seront perdus. Continuer ?`)) return;
    onApply({ levels: shown, autoStack: auto, updateWalls });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] bg-[#051424] border border-primary/40 rounded-xl shadow-2xl flex flex-col font-sans">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-outline-variant/30 flex-none">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">stacks</span>
            <span className="font-mono text-xs font-bold text-primary">CONFIGURATION DES ÉTAGES</span>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Générateurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="border border-outline-variant/30 rounded-lg p-2 flex flex-col gap-1">
              <span className="font-mono text-[10px] text-outline">NOMBRE D'ÉTAGES AU-DESSUS DU RDC</span>
              <div className="flex gap-1">
                <input type="number" min={0} max={30} value={floorsAbove} onChange={e => setFloorsAbove(Number(e.target.value))} className={`${inp} w-16`} />
                <button onClick={applyFloors} className="px-2 rounded border border-outline-variant/40 text-[11px] font-mono text-primary hover:bg-surface-container">Générer R+{Math.max(0, Math.round(floorsAbove))}</button>
              </div>
            </div>
            <div className="border border-outline-variant/30 rounded-lg p-2 flex flex-col gap-1">
              <span className="font-mono text-[10px] text-outline">HAUTEUR SOUS PLAFOND POUR TOUS (mm)</span>
              <div className="flex gap-1">
                <input type="number" step={50} min={1800} value={allHeight} onChange={e => setAllHeight(Number(e.target.value))} className={`${inp} w-20`} />
                <button onClick={applyAllHeights} className="px-2 rounded border border-outline-variant/40 text-[11px] font-mono text-primary hover:bg-surface-container">Appliquer à tous</button>
              </div>
            </div>
          </div>

          {/* Tableau des niveaux */}
          <div className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_auto] gap-2 px-2 py-1 bg-surface-container-low font-mono text-[9px] text-outline">
              <span>NIVEAU</span><span>HAUTEUR (mm)</span><span>DALLE (mm)</span><span>ALTITUDE (mm)</span><span />
            </div>
            {[...shown].reverse().map(l => (
              <div key={l.id} className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_auto] gap-2 px-2 py-1.5 items-center border-t border-outline-variant/20">
                <div className="flex flex-col">
                  <input value={l.name} onChange={e => patchShown(l.id, { name: e.target.value })} className={`${inp} font-bold`} />
                  <span className="font-mono text-[8px] text-outline mt-0.5">{levelKind(l)}{entityCounts[l.id] ? ` · ${entityCounts[l.id]} obj.` : ''}</span>
                </div>
                <input type="number" step={50} min={1800} value={l.height} onChange={e => patchShown(l.id, { height: Math.max(1800, Number(e.target.value)) })} className={inp} />
                <input type="number" step={10} min={0} value={slabOf(l)} onChange={e => patchShown(l.id, { slabMm: Math.max(0, Number(e.target.value)) })} className={inp} />
                <div className="flex items-center gap-1">
                  <input type="number" step={50} value={l.elevation} disabled={auto} onChange={e => patchShown(l.id, { elevation: Number(e.target.value) })} className={`${inp} w-full`} />
                  <span className="font-mono text-[9px] text-outline whitespace-nowrap">{fmt(l.elevation)} m</span>
                </div>
                <button onClick={() => remove(l.id)} disabled={draft.length <= 1} className="material-symbols-outlined text-[16px] text-outline hover:text-error disabled:opacity-30" title="Supprimer ce niveau">delete</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={addAbove} className="px-3 py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary-container font-mono text-[11px] font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">add</span>Étage au-dessus</button>
            <button onClick={addBelow} className="px-3 py-1.5 rounded border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container font-mono text-[11px] flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">add</span>Sous-sol</button>
          </div>

          <div className="flex flex-col gap-1.5 font-mono text-[11px] text-on-surface-variant">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-[#4cd7f6]" />
              Altitudes automatiques (altitude = niveau précédent + hauteur + dalle ; le RDC reste à 0)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={updateWalls} onChange={e => setUpdateWalls(e.target.checked)} className="accent-[#4cd7f6]" />
              Mettre à jour la hauteur des murs et cloisons existants quand la hauteur d'un niveau change
            </label>
          </div>

          <div className="font-mono text-[10px] text-outline border border-outline-variant/20 rounded p-2">
            {shown.length} niveau(x) · hauteur hors tout <span className="text-primary font-bold">{(ext.total / 1000).toFixed(2)} m</span>
            {' '}(de {fmt(ext.bottom)} à {fmt(ext.top)} m, toiture incluse)
            {lostObjects > 0 && <span className="text-error"> · ⚠ {lostObjects} objet(s) seront supprimés</span>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-outline-variant/30 flex-none">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs font-mono text-on-surface-variant hover:bg-surface-container">Annuler</button>
          <button onClick={submit} className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-mono font-bold">Appliquer</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
