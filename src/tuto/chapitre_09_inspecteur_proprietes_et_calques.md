# Chapitre 09 — Communication Entre Composants : Inspecteur d'Attributs & Calques

En React, les données circulent de haut en bas (**Top-Down Data Flow**) via les **props**, et les modifications remontent vers le haut via des **fonctions de rappel (callbacks)**.

Dans ce chapitre, nous allons concevoir :
1. **L'Inspecteur d'Attributs (`PropertiesSidebar.tsx`)** : Permet de modifier en direct la longueur, l'angle, l'épaisseur ou les hachures de l'élément sélectionné.
2. **Le Gestionnaire de Calques (`LayerManager.tsx`)** : Permet d'isoler ou masquer les corps d'état du bâtiment.

---

## 1. Le Concept de "Lifting State Up" (Remontée d'État)

L'inspecteur a besoin de modifier l'entité sélectionnée, mais la liste `entities` réside dans `CadEditor.tsx`.  
Plutôt que d'utiliser des bibliothèques externes lourdes comme Redux, la méthode idiomatique React consiste à **remonter l'état au parent commun**, et à passer une fonction `onUpdate` :

```typescript
// Définition de la fonction de modification partielle dans le parent :
const handleUpdateEntity = (id: string, updates: Partial<CadEntity>) => {
  setEntities(prev =>
    prev.map(ent => (ent.id === id ? { ...ent, ...updates } : ent))
  );
};
```

---

## 2. L'Utilisation du Type TypeScript `Partial<T>`

Le mot-clé générique standard **`Partial<T>`** rend toutes les propriétés d'un type optionnelles.  
Cela permet à l'inspecteur d'envoyer uniquement les champs qui ont changé (par exemple `{ thickness: 98 }` ou `{ length: 4200 }`) sans avoir à renvoyer l'objet complet !

---

## 3. Implémentation de `PropertiesSidebar.tsx`

Voici l'architecture du composant inspecteur :

```tsx
import React, { useState, useEffect } from 'react';
import { CadEntity } from '../types.ts';

interface PropertiesSidebarProps {
  entity: CadEntity;
  onUpdate: (updates: Partial<CadEntity>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  entity,
  onUpdate,
  onDelete,
  onClose,
}) => {
  // Calcul de la longueur réelle en mm
  const lengthMm = Math.round(Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1) * 10);
  
  // État local synchronisé pour la saisie clavier
  const [localLength, setLocalLength] = useState(lengthMm.toString());

  useEffect(() => {
    setLocalLength(lengthMm.toString());
  }, [entity.id, lengthMm]);

  // Modification géométrique : allonge ou raccourcit le mur selon son orientation
  const handleLengthChange = (newLenMm: number) => {
    const validLen = Math.max(50, newLenMm);
    setLocalLength(validLen.toString());

    const angleRad = Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1);
    const newLenPx = validLen / 10;

    // P1 reste fixe, on déplace P2 dans la direction de l'angle
    const newX2 = Math.round(entity.x1 + newLenPx * Math.cos(angleRad));
    const newY2 = Math.round(entity.y1 + newLenPx * Math.sin(angleRad));

    onUpdate({ x2: newX2, y2: newY2 });
  };

  return (
    <div className="w-80 bg-[#051424] border-l border-outline-variant/30 flex flex-col h-full font-sans select-none">
      {/* 1. En-tête avec type et bouton de fermeture */}
      <div className="p-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-primary uppercase">
          {entity.type} · {entity.name}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>

      {/* 2. Formulaire contrôlé de la Longueur */}
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase">Longueur (mm)</label>
          <div className="flex items-center gap-1 bg-[#020d18] px-2 py-1 rounded border border-outline-variant/30">
            <input
              type="number"
              value={localLength}
              onChange={(e) => {
                setLocalLength(e.target.value);
                const val = Number(e.target.value);
                if (!isNaN(val) && val > 0) handleLengthChange(val);
              }}
              className="w-full bg-transparent font-mono text-xs font-bold text-cyan-400 outline-none"
            />
            <span className="text-[10px] font-mono text-slate-500">mm</span>
          </div>

          {/* Boutons de presets rapides */}
          <div className="grid grid-cols-4 gap-1 pt-1 font-mono text-[9px]">
            {[1200, 2400, 3600, 4800].map(preset => (
              <button
                key={preset}
                onClick={() => handleLengthChange(preset)}
                className="py-0.5 rounded bg-surface-container hover:bg-cyan-500 hover:text-slate-900 border border-outline-variant/20 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Sélecteur d'épaisseur */}
        {entity.thickness !== undefined && (
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Épaisseur</label>
            <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
              {[72, 98, 200].map(th => (
                <button
                  key={th}
                  onClick={() => onUpdate({ thickness: th })}
                  className={`py-1 rounded border transition-all ${
                    entity.thickness === th
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                      : 'bg-surface-container text-slate-400 border-outline-variant/20'
                  }`}
                >
                  {th} mm
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Bouton de suppression */}
        <button
          onClick={onDelete}
          className="w-full py-1.5 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-mono text-xs font-bold transition-colors"
        >
          Supprimer l'élément (Suppr)
        </button>
      </div>
    </div>
  );
};
```

---

## 4. Implémentation de `LayerManager.tsx`

Le gestionnaire de calques contrôle la visibilité et le verrouillage de chaque calque :

```tsx
export const LayerManager: React.FC<{
  layers: CadLayer[];
  onToggleVisible: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
}> = ({ layers, onToggleVisible, onToggleLock }) => {
  return (
    <div className="p-3 space-y-2 font-mono text-xs">
      <h3 className="font-bold text-slate-300 uppercase text-[10px]">Calques BIM</h3>
      <div className="space-y-1">
        {layers.map(l => (
          <div key={l.id} className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span className={l.visible ? 'text-slate-200' : 'text-slate-500 line-through'}>{l.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Oeil Visibilité */}
              <button onClick={() => onToggleVisible(l.id)} className="p-1 text-slate-400 hover:text-white">
                {l.visible ? '👁️' : '🙈'}
              </button>
              {/* Cadenas Verrouillage */}
              <button onClick={() => onToggleLock(l.id)} className="p-1 text-slate-400 hover:text-white">
                {l.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Résumé du Chapitre 09
* Vous maîtrisez le principe de **remontée d'état** et les formulaires contrôlés en React.
* Vous utilisez `Partial<T>` pour réaliser des mises à jour géométriques ciblées et performantes.
* Vos composants d'interface communiquent proprement sans couplage rigide.

👉 **Passons au [Chapitre 10 : Moteur d'Export DXF AutoCAD & SVG](./chapitre_10_moteur_export_dxf_autocad_et_svg.md) pour exporter vos plans dans les standards industriels !**
