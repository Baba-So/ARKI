# 05 — Créer un onglet

Il existe **trois niveaux d'« onglet »** dans ARCKI CAD. Identifiez celui qu'il vous faut :

| Niveau | Variable | Effet | Exemples |
|---|---|---|---|
| **Écran** | `currentScreen` (`ScreenType`, dans `App.tsx`) | Remplace toute l'application | Dashboard, Éditeur, Authentification |
| **Onglet du rail** (gauche) | `activeRail` (dans `CadEditor`) | Remplace la **zone centrale** de l'éditeur | Plan, **Vues**, **Mise en page** |
| **Onglet du dock** (droite) | `rightDockTab` (dans `CadEditor`) | Change le **contenu du panneau de droite** | Propriétés, Calques, Bibliothèque, Copilote |

---

## 1. Un onglet du rail (zone centrale) — le cas « Vues » / « Mise en page »

### ✅ Check-list

| # | Étape | Où |
|---|---|---|
| 1 | Ajouter la valeur à l'union `activeRail` | `CadEditor.tsx` → `useState<'plan' \| 'views' \| … >` |
| 2 | Créer le composant de l'onglet | `src/components/MonOnglet.tsx` |
| 3 | Ajouter le bouton dans le rail | `Extreme Left CAD Mode Rail` |
| 4 | Brancher le rendu dans la zone centrale | chaîne `activeRail === 'layout' ? … : activeRail === 'views' ? … : (plan)` |
| 5 | Définir les **outils disponibles** dans l'onglet | tableaux `enabled` et `allowed` ([guide 02](./02_creer_un_outil.md#étape-3--disponibilité-selon-longlet)) |
| 6 | Garder les **raccourcis clavier** cohérents | garde `if (activeRail !== 'plan')` du `handleKeyDown` |
| 7 | Remonter l'état à conserver | `useState` dans `CadEditor` (voir §3) |
| 8 | `npm run lint` + test manuel | — |

### Étape 1 — L'union

```ts
const [activeRail, setActiveRail] =
  useState<'plan' | 'views' | 'bim' | 'layout' | 'rendu' | 'config'>('plan');
```

### Étape 2 — Le composant

Un onglet est un composant qui **remplit son parent** (`absolute inset-0`) et reçoit en props **ce dont il a besoin, rien de plus** :

```tsx
// src/components/MonOnglet.tsx
interface MonOngletProps {
  levels: CadLevel[];
  entitiesByLevel: Record<string, CadEntity[]>;
  isLayerVisible: (layerId: string) => boolean;
  onBackToPlan: () => void;
}
export const MonOnglet: React.FC<MonOngletProps> = (props) => (
  <div className="absolute inset-0 flex bg-[#0a141f]">
    <aside className="w-64 …">{/* réglages */}</aside>
    <div className="flex-1 relative overflow-auto">{/* rendu */}</div>
  </div>
);
```

### Étape 3 — Le bouton

Copiez un bouton existant du rail (`Mise en page` est le plus simple) :

```tsx
<button
  onClick={() => setActiveRail(activeRail === 'mononglet' ? 'plan' : 'mononglet')}
  className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
    activeRail === 'mononglet' ? 'bg-surface-container-high text-secondary font-semibold'
                               : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
  title="Mon onglet"
>
  <span className="material-symbols-outlined text-[19px]">grid_view</span>
  <span className="font-mono text-[9px] mt-0.5">Mon onglet</span>
</button>
```

### Étape 4 — Le rendu dans la zone centrale

```tsx
{activeRail === 'mononglet' ? (
  <MonOnglet … />
) : activeRail === 'layout' ? (
  <LayoutPanel … />
) : activeRail === 'views' ? (
  <ViewsPanel … />
) : (
  /* 2D Plan Viewport */
)}
```

### Étape 5 et 6 — Outils et clavier
Hors de l'onglet **Plan**, les outils de dessin sont grisés et les raccourcis ignorés : ainsi, `Suppr` dans la mise en page ne supprime pas des murs du plan. Si votre onglet a ses propres touches, **gérez-les dans le composant** (écouteur `keydown` local, en ignorant `INPUT`/`TEXTAREA`/`SELECT`) comme le fait `LayoutPanel`.

### §3 — Où mettre l'état ? (règle de décision)

| L'état doit… | Alors il va… |
|---|---|
| survivre à un changement d'onglet (planches, niveaux) | dans **`CadEditor`**, passé en props (`sheets`, `setSheets`) |
| être éphémère (sélection, zoom, glissé en cours) | **local** au composant (`useState` dans l'onglet) |
| être calculé à partir des données | **dérivé** (`useMemo`), pas stocké |

Pendant un glisser-déposer, ne mettez **pas** la position à jour dans l'état partagé à chaque `mousemove` (re-rendu de tout `CadEditor`) : gardez un **brouillon local** et validez au `mouseup`, comme `LayoutPanel` (`drag`).

---

## 2. Un onglet du dock de droite

1. Étendre l'union : `useState<'props' | 'layers' | 'library' | 'ai' | 'monpanneau'>`.
2. Ajouter l'**en-tête d'onglet** dans `RIGHT MULTI-FUNCTIONAL DOCK` (copier un bouton qui fait `setRightDockTab('…')`).
3. Ajouter le **contenu** conditionnel `rightDockTab === 'monpanneau' && <MonPanneau … />`.
4. (Facultatif) une commande CLI qui l'ouvre (`PROPS`, `LAYERS`…).

Le dock existe en deux emplacements (volet ancré et volet flottant) : cherchez `rightDockTab ===` pour tous les voir.

## 3. Un nouvel écran

1. `ScreenType` dans `src/types.ts` : ajouter `'monecran'`.
2. `App.tsx` : rendre le composant quand `currentScreen === 'monecran'`.
3. Fournir `onNavigate={(s) => setCurrentScreen(s)}` aux écrans qui y mènent.

---

## ⚠️ Pièges classiques
- **Oublier de réinitialiser l'outil** en changeant d'onglet → un outil de dessin resterait actif dans un onglet où il n'a pas de sens (le `useEffect([activeRail])` s'en charge).
- **Fermeture périmée** : un écouteur clavier global qui lit `activeRail` doit l'avoir dans ses dépendances.
- **Dupliquer l'état** déjà présent dans `CadEditor` au lieu de le recevoir en props.
- **Rendre un composant lourd à chaque `mousemove`** : `React.memo` + props stables (voir `ViewportContent`).
- **Oublier `overflow`** : la zone centrale doit rester scrollable ou rognée, sinon le layout casse.

## ✍️ Exercice
Créez un onglet **« Quantitatifs »** (rail) : un tableau listant, par niveau, la longueur totale des murs (m), la longueur des cloisons, le nombre de portes et de fenêtres. Réutilisez `entitiesByLevel` ; aucun nouvel état global n'est nécessaire.
<details><summary>Indice</summary>
Composant pur : `Object.entries(entitiesByLevel).map(([levelId, ents]) => …)`, longueur d'un mur = `Math.hypot(x2−x1, y2−y1) * 10 / 1000` (px→mm→m). Outils disponibles : `select` seulement.
</details>

⬅️ [04 — Créer un paramètre](./04_creer_un_parametre.md) | [Index](./README.md) | [06 — Inspecteur et panneaux ➡️](./06_inspecteur_et_panneaux.md)
