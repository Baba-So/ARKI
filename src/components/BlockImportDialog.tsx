import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CadBlock } from '../types.ts';
import { addCustomBlocks, getAllBlocks } from '../blockStore.ts';
import { BlockSpec, buildBlockPrompt, parseBlocksJson, parseSpecLines } from '../blockSchema.ts';
import { viewLabels } from '../blockSymbols.ts';
import { BlockSvg } from './BlockSvg.tsx';

interface BlockImportDialogProps {
  onClose: () => void;
}

const field = 'w-full bg-[#020a12] text-xs font-mono rounded border border-outline-variant/40 focus:border-primary focus:outline-hidden px-2 py-1.5 text-on-surface';
const lbl = 'font-mono text-[10px] text-outline flex flex-col gap-1';

/** Aperçu 2 ou 3 vues d'un bloc en cours d'import. */
const Preview: React.FC<{ block: CadBlock }> = ({ block }) => {
  const labels = viewLabels(block);
  const views: Array<'top' | 'front' | 'side'> = block.kind === 'opening' ? ['top', 'front'] : ['top', 'front', 'side'];
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}>
      {views.map(v => (
        <div key={v} className="bg-[#06121f] border border-outline-variant/20 rounded p-1 flex flex-col items-center">
          <BlockSvg block={block} view={v} className="w-full h-14" />
          <span className="font-mono text-[8px] text-outline">{labels[v]}</span>
        </div>
      ))}
    </div>
  );
};

/** Import de blocs (JSON collé ou fichier) et générateur de prompt IA pour les créer. */
export const BlockImportDialog: React.FC<BlockImportDialogProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'import' | 'prompt'>('import');

  // ── Import ──
  const [json, setJson] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(
    () => (json.trim() ? parseBlocksJson(json, new Set(getAllBlocks().map(b => b.id))) : null),
    [json]
  );

  const onFile = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 2_000_000) { alert('Fichier trop volumineux (2 Mo max).'); return; }
    setJson(await f.text());
  };

  const confirmImport = () => {
    if (!parsed || !parsed.blocks.length) return;
    addCustomBlocks(parsed.blocks);
    onClose();
  };

  // ── Prompt ──
  const [kind, setKind] = useState<'furniture' | 'opening'>('furniture');
  const [category, setCategory] = useState('sejour');
  const [openingKind, setOpeningKind] = useState<'door' | 'window'>('door');
  const [w, setW] = useState(1000);
  const [d, setD] = useState(600);
  const [z, setZ] = useState(750);
  const [list, setList] = useState('Banc design 1500 x 450 x 450\nBibliothèque basse 1200 x 350 x 800');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const specs: BlockSpec[] = useMemo(
    () =>
      parseSpecLines(list, { kind, category: kind === 'opening' ? 'menuiserie' : category, openingKind: kind === 'opening' ? openingKind : undefined, widthMm: w, depthMm: d, zMm: z, notes: notes.trim() || undefined }),
    [list, kind, category, openingKind, w, d, z, notes]
  );
  const prompt = useMemo(() => buildBlockPrompt(specs), [specs]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert('Copie impossible : sélectionnez le texte et copiez-le manuellement.');
    }
  };

  const setKindAndDefaults = (k: 'furniture' | 'opening') => {
    setKind(k);
    if (k === 'opening') { setW(900); setD(200); setZ(2100); setList("Porte d'entrée vitrée 900 x 200 x 2150\nFenêtre 2 vantaux 1200 x 200 x 1250"); }
    else { setW(1000); setD(600); setZ(750); setList('Banc design 1500 x 450 x 450\nBibliothèque basse 1200 x 350 x 800'); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] bg-[#051424] border border-primary/40 rounded-xl shadow-2xl flex flex-col font-sans">
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 pt-3 pb-2 flex-none">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">extension</span>
            <span className="font-mono text-xs font-bold text-primary">BLOCS PERSONNALISÉS</span>
          </div>
          <div className="flex items-center gap-1">
            {([['import', 'Importer', 'file_upload'], ['prompt', 'Prompt IA', 'auto_awesome']] as const).map(([id, label, ic]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1 rounded font-mono text-[11px] flex items-center gap-1 ${tab === id ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container'}`}
              >
                <span className="material-symbols-outlined text-[14px]">{ic}</span>{label}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-outline hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {tab === 'import' && (
            <>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Collez le JSON d'un ou plusieurs blocs (ou chargez un fichier <code>.json</code>). <b>Mobilier</b> : 3 vues (dessus, face, latérale).
                <b> Ouverture</b> (porte, fenêtre) : 2 vues (coupe de dessus, face). Pas de JSON ? Utilisez l'onglet <b>Prompt IA</b> pour le faire générer.
              </p>
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded border border-outline-variant/40 text-xs font-mono text-on-surface-variant hover:bg-surface-container flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">upload_file</span> Charger un fichier…
                </button>
                <input ref={fileRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                {json && <button onClick={() => setJson('')} className="px-3 py-1.5 rounded text-xs font-mono text-outline hover:text-on-surface">Effacer</button>}
              </div>
              <textarea
                value={json}
                onChange={e => setJson(e.target.value)}
                placeholder={'{\n  "blocks": [ { "name": "Banc design", "kind": "furniture", "category": "sejour",\n    "widthMm": 1500, "heightMm": 450, "zMm": 450,\n    "views": { "top": "<rect …/>", "front": "…", "side": "…" } } ]\n}'}
                className={`${field} h-40 resize-y`}
                spellCheck={false}
              />

              {parsed && (
                <div className="flex flex-col gap-2">
                  {parsed.errors.map((e, i) => (
                    <div key={i} className="text-[11px] text-error font-mono flex gap-1"><span className="material-symbols-outlined text-[14px]">error</span>{e}</div>
                  ))}
                  {parsed.warnings.map((e, i) => (
                    <div key={i} className="text-[11px] text-[#ffb95f] font-mono flex gap-1"><span className="material-symbols-outlined text-[14px]">warning</span>{e}</div>
                  ))}
                  {parsed.blocks.map(b => (
                    <div key={b.id} className="border border-outline-variant/30 rounded-lg p-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-bold text-on-surface">{b.name}</span>
                        <span className="text-outline">
                          {b.kind === 'opening' ? `Ouverture ${b.openingKind === 'window' ? '(fenêtre)' : '(porte)'}` : `Mobilier · ${b.category}`} · {b.widthMm} × {b.heightMm}{b.zMm ? ` × ${b.zMm}` : ''} mm
                        </span>
                      </div>
                      <Preview block={b} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'prompt' && (
            <>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Décrivez les blocs voulus : le prompt généré contient le format JSON, le repère de chaque vue et les règles de dessin SVG.
                Collez-le dans votre IA, puis importez sa réponse dans l'onglet <b>Importer</b>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className={lbl}>
                  Type
                  <select value={kind} onChange={e => setKindAndDefaults(e.target.value as 'furniture' | 'opening')} className={field}>
                    <option value="furniture">Mobilier (3 vues)</option>
                    <option value="opening">Ouverture (2 vues)</option>
                  </select>
                </label>
                {kind === 'furniture' ? (
                  <label className={lbl}>
                    Catégorie
                    <select value={category} onChange={e => setCategory(e.target.value)} className={field}>
                      <option value="sejour">Séjour</option><option value="cuisine">Cuisine</option><option value="chambre">Chambre</option>
                      <option value="sanitaire">Sanitaire</option><option value="exterieur">Extérieur</option>
                    </select>
                  </label>
                ) : (
                  <label className={lbl}>
                    Ouverture
                    <select value={openingKind} onChange={e => setOpeningKind(e.target.value as 'door' | 'window')} className={field}>
                      <option value="door">Porte</option><option value="window">Fenêtre / baie</option>
                    </select>
                  </label>
                )}
                <label className={lbl}>Largeur par défaut (mm)<input type="number" value={w} onChange={e => setW(Number(e.target.value))} className={field} /></label>
                <label className={lbl}>{kind === 'opening' ? 'Épaisseur mur (mm)' : 'Profondeur (mm)'}<input type="number" value={d} onChange={e => setD(Number(e.target.value))} className={field} /></label>
                <label className={lbl}>Hauteur (mm)<input type="number" value={z} onChange={e => setZ(Number(e.target.value))} className={field} /></label>
              </div>
              <label className={lbl}>
                Blocs à créer — un par ligne, dimensions facultatives « Nom 1500 x 450 x 450 » (largeur x profondeur x hauteur)
                <textarea value={list} onChange={e => setList(e.target.value)} rows={4} className={`${field} resize-y`} />
              </label>
              <label className={lbl}>
                Consignes de style (facultatif)
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex. style scandinave, pieds fuselés, 4 chaises" className={field} />
              </label>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-outline">{specs.length} bloc(s) · {prompt.length.toLocaleString('fr-FR')} caractères</span>
                <button onClick={copy} className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-mono font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>{copied ? 'Copié !' : 'Copier le prompt'}
                </button>
              </div>
              <textarea readOnly value={prompt} className={`${field} h-56 resize-y`} spellCheck={false} onFocus={e => e.currentTarget.select()} />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-outline-variant/30 flex-none">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-xs font-mono text-on-surface-variant hover:bg-surface-container">Fermer</button>
          {tab === 'import' && (
            <button
              onClick={confirmImport}
              disabled={!parsed || !parsed.blocks.length}
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-mono font-bold disabled:opacity-40"
            >
              Ajouter {parsed && parsed.blocks.length ? `${parsed.blocks.length} bloc(s)` : ''} à la bibliothèque
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
