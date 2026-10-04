import React, { useState } from 'react';
import { CadLevel } from '../types.ts';

interface LevelManagerProps {
  levels: CadLevel[];
  activeLevelId: string;
  entityCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDuplicate: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CadLevel>) => void;
  onDelete: (id: string) => void;
}

const fmt = (mm: number) => `${mm >= 0 ? '+' : '−'}${(Math.abs(mm) / 1000).toFixed(2)} m`;

/** Sélecteur de niveau (HUD) + panneau de gestion des niveaux (RDC, R+1, sous-sol…). */
export const LevelManager: React.FC<LevelManagerProps> = ({
  levels, activeLevelId, entityCounts, onSelect, onAddAbove, onAddBelow, onDuplicate, onUpdate, onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const sorted = [...levels].sort((a, b) => b.elevation - a.elevation);
  const active = levels.find(l => l.id === activeLevelId) || levels[0];
  const input = 'bg-surface-container-low border border-outline-variant/30 rounded px-1.5 py-0.5 font-mono text-[11px] text-on-surface outline-none focus:border-primary/60';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
          open ? 'border-primary/60 bg-primary/10' : 'border-outline-variant/20 bg-surface-container-low'
        }`}
        title="Gestion des niveaux"
      >
        <span className="text-[10px] text-outline">NIVEAU:</span>
        <span className="text-primary font-semibold">{active.name} ({fmt(active.elevation)})</span>
        <span className="material-symbols-outlined text-[14px] text-outline">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[60] w-80 bg-surface-container-lowest border border-outline-variant/40 rounded-lg shadow-2xl p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-primary tracking-wide">NIVEAUX DU BÂTIMENT</span>
            <button onClick={() => setOpen(false)} className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {sorted.map(l => {
              const isActive = l.id === activeLevelId;
              return (
                <div
                  key={l.id}
                  className={`rounded border p-1.5 flex flex-col gap-1 ${
                    isActive ? 'border-primary/50 bg-primary/10' : 'border-outline-variant/20 hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSelect(l.id)}
                      className={`material-symbols-outlined text-[16px] ${isActive ? 'text-primary' : 'text-outline hover:text-primary'}`}
                      title="Travailler sur ce niveau"
                    >
                      {isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </button>
                    <input
                      value={l.name}
                      onChange={e => onUpdate(l.id, { name: e.target.value })}
                      className={`${input} w-20 font-bold`}
                    />
                    <span className="font-mono text-[9px] text-outline ml-auto">{entityCounts[l.id] ?? 0} obj.</span>
                    <button onClick={() => onDuplicate(l.id)} className="material-symbols-outlined text-[15px] text-outline hover:text-primary" title="Dupliquer ce niveau (copie du plan)">
                      content_copy
                    </button>
                    <button
                      onClick={() => levels.length > 1 && onDelete(l.id)}
                      disabled={levels.length <= 1}
                      className="material-symbols-outlined text-[15px] text-outline hover:text-error disabled:opacity-30"
                      title="Supprimer ce niveau"
                    >
                      delete
                    </button>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-outline">
                    <label className="flex items-center gap-1">
                      Alt.
                      <input
                        type="number"
                        step={100}
                        value={l.elevation}
                        onChange={e => onUpdate(l.id, { elevation: Number(e.target.value) })}
                        className={`${input} w-20`}
                      />
                      mm
                    </label>
                    <label className="flex items-center gap-1">
                      H.
                      <input
                        type="number"
                        step={100}
                        min={1800}
                        value={l.height}
                        onChange={e => onUpdate(l.id, { height: Math.max(1800, Number(e.target.value)) })}
                        className={`${input} w-16`}
                      />
                      mm
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-1">
            <button onClick={onAddAbove} className="flex-1 px-2 py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary-container font-mono text-[10px] font-semibold flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span> Étage
            </button>
            <button onClick={onAddBelow} className="flex-1 px-2 py-1.5 rounded border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high font-mono text-[10px] flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span> Sous-sol
            </button>
          </div>
          <p className="font-mono text-[9px] text-outline leading-snug">
            Le niveau situé juste en dessous est affiché en fond estompé. Les Vues empilent tous les niveaux.
          </p>
        </div>
      )}
    </div>
  );
};
