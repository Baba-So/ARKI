# 06 — Section d'inspecteur et panneau latéral

Deux besoins proches :
1. **Éditer un attribut** de l'objet sélectionné → ajouter une **section dans l'inspecteur** (`PropertiesSidebar`).
2. **Afficher un outil complet** (liste, gestionnaire, formulaire) → créer un **composant panneau** (comme `LayerManager`, `LevelManager`, `CadLibraryPanel`).

---

## 1. Ajouter une section à l'inspecteur

### Le contrat
```ts
// src/components/PropertiesSidebar.tsx
interface PropertiesSidebarProps {
  entity: CadEntity;                                  // l'entité sélectionnée (la « principale »)
  onUpdate: (updatedFields: Partial<CadEntity>) => void;   // fusionne des champs dans l'entité
  …
}
```
`CadEditor` branche `onUpdate={handleUpdateSelectedFields}` : l'inspecteur ne modifie **jamais** les données lui-même, il **demande** la modification (principe du *lifting state up*).

### Une section = un bloc conditionnel
```tsx
{['wall', 'partition'].includes(entity.type) && (                 // ① pour quels types ?
  <div className="bg-surface-container-low p-2 rounded border border-outline-variant/20 …">
    <span className="font-mono text-[9px] text-outline uppercase font-semibold">
      Ligne de référence (sens du tracé)
    </span>
    {([{ id: 'left', label: 'Nu gauche' }, { id: 'center', label: 'Axe' }, { id: 'right', label: 'Nu droite' }] as const)
      .map(opt => (
        <button key={opt.id}
                onClick={() => onUpdate({ refLine: opt.id })}        // ② on envoie des champs
                className={(entity.refLine || 'center') === opt.id ? 'actif' : 'inactif'}>  // ③ valeur par défaut
          {opt.label}
        </button>
      ))}
  </div>
)}
```

### ✅ Check-list
1. Le champ existe dans `CadEntity` ([guide 04](./04_creer_un_parametre.md)).
2. Bloc conditionnel placé **à la bonne place** dans l'ordre visuel (cherchez les commentaires `ATTRIBUTE 1`, `ATTRIBUTE 2B`, `ATTRIBUTE 3`…).
3. `onUpdate({ champ })` à chaque changement.
4. Valeur par défaut à l'affichage (`entity.champ ?? défaut`).
5. Si le champ demande un **recalcul** (déplacer d'autres objets, resynchroniser) → logique dans `handleUpdateSelectedFields` (`CadEditor`), **pas** dans le composant.

### Champ de saisie numérique : l'état local
Un `<input type="number">` relié directement à une donnée recalculée peut « sauter » pendant la frappe. Gardez un état local synchronisé quand l'entité change :
```tsx
const [localThickness, setLocalThickness] = useState((entity.thickness || 200).toString());
useEffect(() => setLocalThickness((entity.thickness || 200).toString()), [entity.id, entity.thickness]);
<input value={localThickness}
       onChange={e => { setLocalThickness(e.target.value); onUpdate({ thickness: Number(e.target.value) }); }} />
```

### Multi-sélection
L'inspecteur reçoit **une** entité (`primarySelectedEntity`) et `selectedCount`. Les modifications ne s'appliquent aujourd'hui qu'à elle seule ; pour étendre à toute la sélection, adaptez `handleUpdateSelectedFields` pour boucler sur `selectedIds`.

---

## 2. Créer un composant panneau

### Modèle de conception (celui de `LevelManager`)
```tsx
interface LevelManagerProps {
  levels: CadLevel[];
  activeLevelId: string;
  onSelect: (id: string) => void;
  onAddAbove: () => void;
  onUpdate: (id: string, patch: Partial<CadLevel>) => void;
  onDelete: (id: string) => void;
  …
}
export const LevelManager: React.FC<LevelManagerProps> = ({ levels, … }) => {
  const [open, setOpen] = useState(false);       // état d'interface UNIQUEMENT (ouvert/fermé)
  …
};
```

**Règle** : le composant panneau est **« bête »** — il affiche des props et appelle des callbacks. La logique métier (ajouter un niveau, dupliquer, supprimer) est dans `CadEditor` (`addLevel`, `duplicateLevel`, `deleteLevel`, `gotoLevel`).

| Responsabilité | Où |
|---|---|
| Données et règles métier | `CadEditor` (ou module pur `*Geometry.ts`) |
| Mise en forme, états d'UI (ouvert, filtre, saisie en cours) | le composant panneau |
| Communication | props descendantes + callbacks montantes |

### Intégration
1. Créer `src/components/MonPanneau.tsx`.
2. L'importer dans `CadEditor.tsx` et le placer : dans la barre du haut (popover, comme `LevelManager`), dans le dock de droite (onglet, [guide 05](./05_creer_un_onglet.md)) ou dans le rail.
3. Passer en props les **données** et les **callbacks**.

### Style : cohérence visuelle
Thème sombre technique : polices `Inter` (texte) et `JetBrains Mono` (valeurs, étiquettes `text-[10px] font-mono`), bordures nettes `border-outline-variant/20`, jetons de couleur Tailwind du projet (`bg-surface-container-low`, `text-primary`, `text-on-surface-variant`…). **Copiez les classes d'un composant voisin** plutôt que d'en inventer. Icônes : `<span className="material-symbols-outlined">nom</span>`.

### Popover (menu déroulant)
Voir `LevelManager` : conteneur `relative`, panneau `absolute right-0 top-full mt-1 z-[60]`, bouton ouvrant/fermant via `useState`. Pensez au `z-index` : la barre du haut et le dock ont leurs propres empilements.

---

## ⚠️ Pièges classiques
- **Modifier `entity` directement** dans l'inspecteur : toujours passer par `onUpdate`.
- **Section visible pour le mauvais type** : testez `entity.type`.
- **Logique métier dans le JSX** : difficile à tester et à réutiliser.
- **Props en cascade** (5+ niveaux) : si cela arrive, regroupez les callbacks dans un objet.
- **Panneau qui lit des données périmées** après un changement de niveau : recevez `entitiesByLevel`/`levels`, ne les copiez pas dans un état local.

## ✍️ Exercice
Ajoutez à l'inspecteur une section **« Matériau »** pour les murs avec une liste déroulante alimentée par `ARCHITECTURAL_MATERIALS` (`src/constants/materials.ts`) qui met à jour `material` **et** `materialIndex`.
<details><summary>Indice</summary>
`<select value={entity.materialIndex} onChange={e => { const m = ARCHITECTURAL_MATERIALS.find(x => x.index === e.target.value)!; onUpdate({ materialIndex: m.index, material: m.name }); }}>` — vérifiez d'abord si la section existe déjà (`Grep "materialIndex"` dans `PropertiesSidebar.tsx`).
</details>

⬅️ [05 — Créer un onglet](./05_creer_un_onglet.md) | [Index](./README.md) | [07 — Calques, matériaux, bibliothèque ➡️](./07_calques_materiaux_bibliotheque.md)
