import { useSyncExternalStore } from 'react';
import { CadBlock } from './types.ts';
import { PREDEFINED_CAD_BLOCKS } from './constants/blocks.ts';
import { sanitizeSvgFragment } from './blockSchema.ts';

/**
 * Registre des blocs : blocs prédéfinis + blocs importés par l'utilisateur (persistés dans localStorage).
 * Module partagé : la bibliothèque (panneau gauche ET dock droit), le plan, les vues et la mise en page
 * lisent tous la même liste.
 */

const KEY = 'arcki.customBlocks.v1';
const listeners = new Set<() => void>();

const load = (): CadBlock[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as CadBlock[];
    // On re-nettoie les SVG au chargement : le stockage local n'est pas une source de confiance
    return list
      .filter(b => b && typeof b.id === 'string' && typeof b.name === 'string' && b.widthMm > 0 && b.heightMm > 0)
      .map(b => {
        const views = b.views ? { ...b.views } : undefined;
        if (views) {
          (['top', 'front', 'side'] as const).forEach(k => {
            if (views[k]) {
              const c = sanitizeSvgFragment(views[k] as string);
              if (c) views[k] = c; else delete views[k];
            }
          });
        }
        return { ...b, views, custom: true };
      });
  } catch {
    return [];
  }
};

let custom: CadBlock[] = load();
let all: CadBlock[] = [...PREDEFINED_CAD_BLOCKS, ...custom];

const emit = () => {
  all = [...PREDEFINED_CAD_BLOCKS, ...custom];
  try { localStorage.setItem(KEY, JSON.stringify(custom)); } catch { /* stockage indisponible : blocs conservés en mémoire */ }
  listeners.forEach(l => l());
};

export const subscribeBlocks = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export const getAllBlocks = (): CadBlock[] => all;
export const getCustomBlocks = (): CadBlock[] => custom;
export const findBlock = (id?: string): CadBlock | undefined => (id ? all.find(b => b.id === id) : undefined);

export const addCustomBlocks = (blocks: CadBlock[]) => {
  custom = [...custom, ...blocks.map(b => ({ ...b, custom: true }))];
  emit();
};

export const removeCustomBlock = (id: string) => {
  custom = custom.filter(b => b.id !== id);
  emit();
};

/** Abonne un composant React à la liste des blocs (se re-rend à chaque import / suppression). */
export const useBlocks = (): CadBlock[] => useSyncExternalStore(subscribeBlocks, getAllBlocks);
