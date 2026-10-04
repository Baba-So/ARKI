import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProjectMeta, ProjectSnapshot } from '../types.ts';
import { ExportFile, downloadFile, exportDxf, exportMetricsJson, exportPdf, exportProjectJson, exportSchedulesCsv, exportSvg, printSheets } from '../exporters.tsx';

type Format = 'json' | 'svg' | 'dxf' | 'pdf' | 'report' | 'csv';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  /** Projet à exporter (état courant de l'éditeur, ou projet enregistré). */
  snapshot: ProjectSnapshot | null;
  meta?: Pick<ProjectMeta, 'name' | 'phase' | 'category' | 'version' | 'location'>;
}

const FORMATS: Array<{ id: Format; label: string; desc: string; icon: string }> = [
  { id: 'json', label: 'Projet ARCKI', desc: 'Sauvegarde complète (.arcki.json), réimportable', icon: 'deployed_code' },
  { id: 'svg', label: 'SVG', desc: 'Plan vectoriel à l\'échelle', icon: 'image' },
  { id: 'dxf', label: 'DXF', desc: 'AutoCAD R12, calques et altitudes', icon: 'draw' },
  { id: 'pdf', label: 'PDF', desc: 'Planches de mise en page, fichier PDF', icon: 'picture_as_pdf' },
  { id: 'report', label: 'Rapport', desc: 'Métriques par niveau (JSON)', icon: 'analytics' },
  { id: 'csv', label: 'Métrés', desc: 'Pièces, murs, ouvertures (CSV Excel)', icon: 'table_view' },
];

const SCALES = [20, 50, 100, 200, 500];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, projectName = 'Projet', snapshot, meta }) => {
  const [format, setFormat] = useState<Format>('json');
  const [scale, setScale] = useState(100);
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const [layerIds, setLayerIds] = useState<string[]>([]);
  const [sheetIds, setSheetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dpi, setDpi] = useState(200);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // (ré)initialise les sélections à l'ouverture : tous les niveaux, calques visibles, toutes les planches
  useEffect(() => {
    if (!isOpen || !snapshot) return;
    setLevelIds(snapshot.levels.map(l => l.id));
    setLayerIds(snapshot.layers.filter(l => l.visible).map(l => l.id));
    setSheetIds(snapshot.sheets.map(s => s.id));
    setMessage(null);
  }, [isOpen, snapshot]);

  const counts = useMemo(() => {
    if (!snapshot) return { objects: 0 };
    const set = new Set(layerIds);
    return { objects: levelIds.reduce((n, id) => n + (snapshot.entitiesByLevel[id] || []).filter(e => set.has(e.layerId)).length, 0) };
  }, [snapshot, levelIds, layerIds]);

  if (!isOpen) return null;

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const usesLevels = format === 'svg' || format === 'dxf' || format === 'report' || format === 'csv';
  const usesLayers = usesLevels || format === 'pdf';
  const m = meta || { name: projectName, phase: '', category: 'esquisse' as const, version: 'v1.0', location: '' };

  const canExport =
    !!snapshot &&
    !busy &&
    (format === 'json' ||
      (format === 'pdf' ? sheetIds.length > 0 : usesLevels ? levelIds.length > 0 : true));

  const run = async () => {
    if (!snapshot) return;
    setBusy(true);
    setMessage(null);
    try {
      const opts = { levelIds, layerIds, scale };
      let file: ExportFile | null = null;
      if (format === 'json') file = exportProjectJson(m, snapshot);
      else if (format === 'svg') file = await exportSvg(snapshot, m.name, opts);
      else if (format === 'dxf') file = exportDxf(snapshot, opts);
      else if (format === 'report') file = exportMetricsJson(snapshot, m.name, opts);
      else if (format === 'csv') file = exportSchedulesCsv(snapshot, m.name, opts);
      else file = await exportPdf(snapshot, m.name, sheetIds, layerIds, dpi, (d, t) => setProgress(d < t ? `Page ${d + 1} / ${t}…` : ''));
      downloadFile(file);
      const size = typeof file.content === 'string' ? file.content.length : file.content.length;
      setMessage({ ok: true, text: `Fichier « ${file.filename} » téléchargé (${size > 1048576 ? `${(size / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`}).` });
    } catch (e) {
      setMessage({ ok: false, text: `Échec de l'export : ${e instanceof Error ? e.message : String(e)}` });
    }
    setBusy(false);
    setProgress('');
  };

  /** Secours : fenêtre d'impression du navigateur (vectoriel, « Enregistrer au format PDF »). */
  const runPrint = async () => {
    if (!snapshot) return;
    const ok = await printSheets(snapshot, sheetIds, layerIds);
    setMessage(ok ? { ok: true, text: 'Fenêtre d\'impression ouverte : choisissez « Enregistrer au format PDF ».' } : { ok: false, text: 'Impossible d\'ouvrir la fenêtre d\'impression (pop-up bloqué ?).' });
  };

  const chk = 'accent-[#4cd7f6]';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#010f1f]/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-xl max-h-[92vh] bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <header className="px-5 py-3.5 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between flex-none">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">file_download</span>
            <h2 className="text-sm font-bold text-on-surface">Exporter « {m.name} »</h2>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {!snapshot && (
            <div className="p-3 rounded border border-error/40 text-error font-mono text-[11px]">Aucun projet chargé : ouvrez un projet dans l'éditeur ou depuis le tableau de bord.</div>
          )}

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Format</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`flex flex-col items-start gap-0.5 p-2.5 rounded border text-left transition-colors ${
                    format === f.id ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold text-xs"><span className="material-symbols-outlined text-[16px]">{f.icon}</span>{f.label}</span>
                  <span className="font-mono text-[9px] opacity-80 leading-snug">{f.desc}</span>
                </button>
              ))}
            </div>
            <p className="font-mono text-[9px] text-outline">DWG et IFC ne sont pas générés : ouvrez le DXF dans votre logiciel CAO pour l'enregistrer dans le format voulu.</p>
          </div>

          {snapshot && usesLevels && (
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Niveaux</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {[...snapshot.levels].sort((a, b) => b.elevation - a.elevation).map(l => (
                  <label key={l.id} className="flex items-center gap-1.5 cursor-pointer text-on-surface">
                    <input type="checkbox" className={chk} checked={levelIds.includes(l.id)} onChange={() => toggle(levelIds, setLevelIds, l.id)} />
                    <span>{l.name}</span>
                    <span className="font-mono text-[9px] text-outline">{(snapshot.entitiesByLevel[l.id] || []).length} obj.</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {format === 'svg' && (
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Échelle du plan</label>
              <div className="flex gap-2">
                {SCALES.map(s => (
                  <button key={s} onClick={() => setScale(s)} className={`px-3 py-1.5 rounded border font-mono ${scale === s ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline'}`}>1:{s}</button>
                ))}
              </div>
            </div>
          )}

          {snapshot && format === 'pdf' && (
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Planches</label>
              <div className="flex flex-col gap-1">
                {snapshot.sheets.map(s => (
                  <label key={s.id} className="flex items-center gap-1.5 cursor-pointer text-on-surface">
                    <input type="checkbox" className={chk} checked={sheetIds.includes(s.id)} onChange={() => toggle(sheetIds, setSheetIds, s.id)} />
                    <span>{s.name}</span>
                    <span className="font-mono text-[9px] text-outline">{s.format} · {s.landscape ? 'paysage' : 'portrait'} · {s.items.length} élément(s)</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {snapshot && format === 'pdf' && (
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Résolution du fichier PDF</label>
              <div className="flex gap-2">
                {[150, 200, 300].map(d => (
                  <button key={d} onClick={() => setDpi(d)} className={`px-3 py-1.5 rounded border font-mono ${dpi === d ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline'}`}>{d} dpi</button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-outline">Le PDF contient les planches rendues en image haute résolution (une page par planche, au format papier). Pour un PDF vectoriel, utilisez « Imprimer… » puis « Enregistrer au format PDF ».</p>
            </div>
          )}

          {snapshot && usesLayers && (
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-outline uppercase tracking-wider">Calques inclus</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {snapshot.layers.map(l => (
                  <label key={l.id} className="flex items-center gap-1.5 cursor-pointer text-on-surface">
                    <input type="checkbox" className={chk} checked={layerIds.includes(l.id)} onChange={() => toggle(layerIds, setLayerIds, l.id)} />
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div className={`p-2.5 rounded border font-mono text-[11px] ${message.ok ? 'border-tertiary/50 text-tertiary' : 'border-error/50 text-error'}`}>{message.text}</div>
          )}
        </div>

        <footer className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between flex-none">
          <span className="font-mono text-[10px] text-outline">{busy && progress ? progress : snapshot && usesLevels ? `${counts.objects} objet(s) exporté(s)` : ' '}</span>
          <div className="flex gap-2">
            {format === 'pdf' && (
              <button onClick={runPrint} disabled={!canExport} className="px-3 py-2 rounded border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:bg-surface-container flex items-center gap-1.5 disabled:opacity-40">
                <span className="material-symbols-outlined text-[16px]">print</span>Imprimer…
              </button>
            )}
            <button onClick={onClose} className="px-3 py-2 rounded text-xs font-semibold text-on-surface-variant hover:bg-surface-container">Fermer</button>
            <button
              onClick={run}
              disabled={!canExport}
              className="px-4 py-2 rounded bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">{busy ? 'hourglass_top' : 'download'}</span>
              {busy ? 'Export…' : format === 'pdf' ? 'Exporter en PDF' : 'Exporter'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
