import React, { useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectName = 'Villa Horizon',
}) => {
  const [format, setFormat] = useState<'dwg' | 'dxf' | 'ifc' | 'pdf' | 'svg'>('dwg');
  const [scale, setScale] = useState('1:50');
  const [includeLayers, setIncludeLayers] = useState({
    walls: true,
    partitions: true,
    doors: true,
    dimensions: true,
    hatches: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#010f1f]/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        <header className="px-5 py-3.5 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">file_download</span>
            <h2 className="text-sm font-bold text-on-surface">Exporter le plan CAO</h2>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <div className="p-5 space-y-4 text-xs">
          {/* Format selection */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-outline uppercase tracking-wider">
              FORMAT DE FICHIER CAD
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dwg', label: 'DWG', desc: 'AutoCAD 2024' },
                { id: 'dxf', label: 'DXF', desc: 'Vectoriel ASCII' },
                { id: 'ifc', label: 'IFC 4', desc: 'BIM Standard' },
                { id: 'pdf', label: 'PDF Plan', desc: 'Échelle 1:50' },
                { id: 'svg', label: 'SVG', desc: 'Vectoriel pur' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id as any)}
                  className={`p-2 rounded border text-left transition-all ${
                    format === f.id
                      ? 'bg-surface-container-highest border-primary text-primary font-bold shadow-xs'
                      : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="font-mono text-xs">{f.label}</div>
                  <div className="text-[9px] text-outline font-normal">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Scale selection */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-outline uppercase tracking-wider">
              ÉCHELLE D'IMPRESSION / CARTEL
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['1:50', '1:100', '1:200'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`py-1.5 px-3 rounded border font-mono text-xs transition-colors ${
                    scale === s
                      ? 'bg-surface-container-high border-primary text-primary font-bold'
                      : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Layers to include */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-outline uppercase tracking-wider">
              CALQUES BIM À INTÉGRER
            </label>
            <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest p-2.5 rounded border border-outline-variant/20">
              {[
                { id: 'walls', label: 'Murs porteurs (A-MUR-EXT)' },
                { id: 'partitions', label: 'Cloisons (A-MUR-INT)' },
                { id: 'doors', label: 'Menuiseries (A-PORTE)' },
                { id: 'dimensions', label: 'Cotations associatives' },
                { id: 'hatches', label: 'Hachures béton & isolant' },
              ].map((layer) => (
                <label key={layer.id} className="flex items-center gap-2 cursor-pointer select-none text-on-surface-variant hover:text-on-surface">
                  <input
                    type="checkbox"
                    checked={(includeLayers as any)[layer.id]}
                    onChange={(e) =>
                      setIncludeLayers(prev => ({ ...prev, [layer.id]: e.target.checked }))
                    }
                    className="accent-primary rounded"
                  />
                  <span className="text-[11px]">{layer.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <footer className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between">
          <span className="font-mono text-[10px] text-outline">
            {projectName}.{format}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant font-medium transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-1.5 rounded bg-primary-container hover:bg-primary text-on-primary-container text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              {downloadSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Téléchargé !</span>
                </>
              ) : isExporting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Génération...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Exporter ({format.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
