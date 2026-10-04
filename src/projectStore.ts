import { useSyncExternalStore } from 'react';
import { CadBlock, CadEntity, ProjectData, ProjectMeta, ProjectSnapshot, ProjectStats } from './types.ts';
import { DEFAULT_LAYERS, SAMPLE_ENTITIES } from './constants/sampleProject.ts';
import { createSheet } from './layoutModel.ts';
import { addCustomBlocks, getAllBlocks, getCustomBlocks } from './blockStore.ts';

/**
 * Projets : enregistrement automatique dans le navigateur (localStorage), liste pour le tableau de bord,
 * import / export du fichier projet (.arcki.json).
 *
 * Stockage : un index (fiches + statistiques) et un document par projet.
 */

const INDEX_KEY = 'arcki.projects.v1';
const DOC_KEY = (id: string) => `arcki.project.${id}`;
export const PROJECT_FILE_FORMAT = 'arcki-project';
export const SAMPLE_ID = 'villa-horizon';

// ───────────────────────────── Instantanés de base ─────────────────────────────

export const sampleSnapshot = (): ProjectSnapshot => ({
  levels: [{ id: 'lvl-rdc', name: 'RDC', elevation: 0, height: 2800 }],
  activeLevelId: 'lvl-rdc',
  levelAutoStack: true,
  entitiesByLevel: { 'lvl-rdc': SAMPLE_ENTITIES },
  layers: DEFAULT_LAYERS,
  sheets: [createSheet('Plan RDC', 'lvl-rdc', 50)],
});

export const emptySnapshot = (name: string, heightMm = 2800): ProjectSnapshot => ({
  levels: [{ id: 'lvl-rdc', name: 'RDC', elevation: 0, height: heightMm }],
  activeLevelId: 'lvl-rdc',
  levelAutoStack: true,
  entitiesByLevel: { 'lvl-rdc': [] },
  layers: DEFAULT_LAYERS.map(l => ({ ...l, entityCount: 0 })),
  sheets: [{ ...createSheet(`Plan RDC`, 'lvl-rdc', 50), project: name }],
});

// ───────────────────────────── Statistiques ─────────────────────────────

export function computeStats(s: ProjectSnapshot): ProjectStats {
  const all: CadEntity[] = Object.values(s.entitiesByLevel).flat();
  const rooms = all.filter(e => e.type === 'room' || (e.type === 'polygon' && e.isClosed));
  const walls = all.filter(e => e.type === 'wall');
  const xs = walls.flatMap(w => [w.x1, w.x2]);
  const ys = walls.flatMap(w => [w.y1, w.y2]);
  return {
    levels: s.levels.length,
    objects: all.length,
    areaM2: Math.round(rooms.reduce((a, r) => a + (r.area || 0), 0) * 10) / 10,
    sheets: s.sheets.length,
    widthM: xs.length ? Math.round(((Math.max(...xs) - Math.min(...xs)) * 10) / 10) / 100 : 0,
    depthM: ys.length ? Math.round(((Math.max(...ys) - Math.min(...ys)) * 10) / 10) / 100 : 0,
  };
}

// ───────────────────────────── Index ─────────────────────────────

const SAMPLE_META: ProjectMeta = {
  id: SAMPLE_ID,
  name: 'Villa Horizon',
  phase: 'Permis de construire (PC)',
  category: 'pc',
  version: 'v1.4',
  location: 'Parcelle cadastrale #402-A // Biarritz Côte Basque',
  createdAt: '2024-11-01T09:00:00.000Z',
  modified: '2024-11-01T09:00:00.000Z',
  stats: computeStats(sampleSnapshot()),
  sample: true,
};

const loadIndex = (): ProjectMeta[] => {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
  } catch {
    return [];
  }
};

let index: ProjectMeta[] = loadIndex();
const listeners = new Set<() => void>();
let cached: ProjectMeta[] = [];

const rebuild = () => {
  const hasSample = index.some(m => m.id === SAMPLE_ID);
  cached = (hasSample ? index.map(m => (m.id === SAMPLE_ID ? { ...m, sample: true } : m)) : [SAMPLE_META, ...index]).slice();
};
rebuild();

const persistIndex = () => {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch { /* quota atteint : le projet reste en mémoire */ }
  rebuild();
  listeners.forEach(l => l());
};

export const subscribeProjects = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const getProjects = () => cached;
export const useProjects = (): ProjectMeta[] => useSyncExternalStore(subscribeProjects, getProjects);
export const getProjectMeta = (id: string) => cached.find(m => m.id === id);

// ───────────────────────────── Lecture / écriture ─────────────────────────────

/** Charge le projet enregistré, sinon l'exemple (pour « Villa Horizon »), sinon null. */
export function loadProject(id: string): ProjectSnapshot | null {
  try {
    const raw = localStorage.getItem(DOC_KEY(id));
    if (raw) {
      const s = JSON.parse(raw) as ProjectSnapshot;
      if (s && Array.isArray(s.levels) && s.entitiesByLevel) return s;
    }
  } catch { /* document illisible */ }
  return id === SAMPLE_ID ? sampleSnapshot() : null;
}

/** Enregistre le projet (document + fiche du tableau de bord). Renvoie false si le stockage est plein. */
export function saveProject(id: string, snapshot: ProjectSnapshot, patch: Partial<ProjectMeta> = {}): boolean {
  const prev = cached.find(m => m.id === id);
  const now = new Date().toISOString();
  const meta: ProjectMeta = {
    id,
    name: prev?.name ?? 'Projet sans nom',
    phase: prev?.phase ?? 'Esquisse',
    category: prev?.category ?? 'esquisse',
    version: prev?.version ?? 'v1.0',
    location: prev?.location ?? '',
    createdAt: prev?.createdAt ?? now,
    ...patch,
    modified: now,
    stats: computeStats(snapshot),
    sample: undefined,
  };
  try {
    localStorage.setItem(DOC_KEY(id), JSON.stringify(snapshot));
  } catch {
    return false;
  }
  index = [...index.filter(m => m.id !== id), meta];
  persistIndex();
  return true;
}

export function updateProjectMeta(id: string, patch: Partial<ProjectMeta>) {
  const cur = cached.find(m => m.id === id);
  if (!cur) return;
  const next = { ...cur, ...patch, sample: undefined };
  index = [...index.filter(m => m.id !== id), next];
  persistIndex();
}

export function deleteProject(id: string) {
  try { localStorage.removeItem(DOC_KEY(id)); } catch { /* ignore */ }
  index = index.filter(m => m.id !== id);
  persistIndex();
}

const categoryOf = (phase: string): ProjectData['category'] =>
  /exe|dce|chantier/i.test(phase) ? 'exe' : /pc|permis/i.test(phase) ? 'pc' : /rénov|renov/i.test(phase) ? 'renovation' : /faisab/i.test(phase) ? 'faisabilite' : 'esquisse';

const PHASE_LABEL: Record<string, string> = {
  ESQ: 'Esquisse / Faisabilité', PC: 'Permis de construire (PC)', PRO: 'Conception générale (PRO)', EXE: 'DCE / Exécution (EXE)',
};

/** Crée un projet vierge (niveau RDC, calques normalisés) et l'enregistre. */
export function createProject(info: { name: string; location: string; phase: string; hspMm?: number }): ProjectMeta {
  const id = `proj-${Date.now().toString(36)}`;
  const name = info.name.trim() || 'Nouveau projet CAD';
  const phase = PHASE_LABEL[info.phase] ?? info.phase;
  saveProject(id, emptySnapshot(name, info.hspMm), { name, phase, category: categoryOf(phase), location: info.location, version: 'v1.0' });
  return getProjectMeta(id)!;
}

export function duplicateProject(id: string): string | null {
  const snap = loadProject(id);
  const meta = getProjectMeta(id);
  if (!snap || !meta) return null;
  const newId = `proj-${Date.now().toString(36)}`;
  saveProject(newId, snap, { name: `${meta.name} (copie)`, phase: meta.phase, category: meta.category, location: meta.location, version: 'v1.0' });
  return newId;
}

// ───────────────────────────── Fichier projet (.arcki.json) ─────────────────────────────

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  version: 1;
  exportedAt: string;
  meta: Pick<ProjectMeta, 'name' | 'phase' | 'category' | 'version' | 'location'>;
  snapshot: ProjectSnapshot;
  blocks: CadBlock[]; // blocs importés utilisés par le projet
}

export function buildProjectFile(meta: Pick<ProjectMeta, 'name' | 'phase' | 'category' | 'version' | 'location'>, snapshot: ProjectSnapshot): ProjectFile {
  const usedIds = new Set(Object.values(snapshot.entitiesByLevel).flat().map(e => e.blockId).filter(Boolean));
  return {
    format: PROJECT_FILE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: { name: meta.name, phase: meta.phase, category: meta.category, version: meta.version, location: meta.location },
    snapshot,
    blocks: getCustomBlocks().filter(b => usedIds.has(b.id)),
  };
}

/** Importe un fichier projet : valide la structure, ajoute les blocs manquants, crée un nouveau projet. */
export function importProjectFile(text: string): { ok: true; id: string; name: string } | { ok: false; error: string } {
  let data: ProjectFile;
  try { data = JSON.parse(text) as ProjectFile; } catch { return { ok: false, error: 'Fichier illisible : JSON invalide.' }; }
  if (!data || data.format !== PROJECT_FILE_FORMAT) return { ok: false, error: 'Ce fichier n\'est pas un projet ARCKI CAD (format attendu : arcki-project).' };
  const s = data.snapshot;
  if (!s || !Array.isArray(s.levels) || !s.levels.length || typeof s.entitiesByLevel !== 'object' || !Array.isArray(s.layers)) {
    return { ok: false, error: 'Structure de projet incomplète (niveaux, entités ou calques manquants).' };
  }
  for (const lvl of s.levels) {
    if (typeof lvl.id !== 'string' || !Number.isFinite(lvl.elevation) || !Number.isFinite(lvl.height)) return { ok: false, error: 'Un niveau du fichier est invalide.' };
    if (!Array.isArray(s.entitiesByLevel[lvl.id])) s.entitiesByLevel[lvl.id] = [];
  }
  if (!s.levels.some(l => l.id === s.activeLevelId)) s.activeLevelId = s.levels[0].id;
  if (!Array.isArray(s.sheets) || !s.sheets.length) s.sheets = [createSheet('Plan', s.activeLevelId, 50)];
  if (Array.isArray(data.blocks) && data.blocks.length) {
    const known = new Set(getAllBlocks().map(b => b.id));
    const fresh = data.blocks.filter(b => b && typeof b.id === 'string' && !known.has(b.id));
    if (fresh.length) addCustomBlocks(fresh); // les vues SVG sont re-nettoyées au prochain chargement
  }
  const id = `proj-${Date.now().toString(36)}`;
  const meta = data.meta || ({} as ProjectFile['meta']);
  const ok = saveProject(id, s, {
    name: (meta.name || 'Projet importé').slice(0, 80),
    phase: meta.phase || 'Importé',
    category: meta.category || 'esquisse',
    location: meta.location || '',
    version: meta.version || 'v1.0',
  });
  return ok ? { ok: true, id, name: meta.name || 'Projet importé' } : { ok: false, error: 'Stockage du navigateur plein : supprimez des projets puis réessayez.' };
}

// ───────────────────────────── Stockage ─────────────────────────────

/** Espace occupé par les données ARCKI dans le navigateur (octets approximatifs) et limite typique (≈ 5 Mo). */
export function storageUsage() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('arcki.')) bytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch { /* indisponible */ }
  return { bytes, limit: 5 * 1024 * 1024 };
}
