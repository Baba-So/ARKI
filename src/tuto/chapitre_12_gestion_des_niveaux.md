# Chapitre 12 — Gestion des niveaux (RDC, R+1, sous-sol)

Un bâtiment a plusieurs étages. Plutôt que de réécrire tout l'éditeur pour qu'il manipule « une liste de listes d'entités », ARCKI CAD adopte une astuce simple : **`entities` contient toujours uniquement le niveau actif**. Ce chapitre explique ce choix, son fonctionnement et ses limites.

## 🎯 Objectifs

- Comprendre le type `CadLevel` (altitude et hauteur en millimètres).
- Expliquer le principe « `entities` = niveau actif » et le rôle de `otherLevels` et `entitiesByLevel`.
- Suivre le cycle de vie d'un niveau : changer, ajouter, dupliquer, modifier, supprimer.
- Comprendre pourquoi l'historique est réinitialisé et comment la duplication régénère les identifiants.
- Savoir comment les niveaux alimentent les Vues et quelles sont les limites actuelles (export).

## 📋 Prérequis

- [Chapitre 02](./chapitre_02_modelisation_donnees_typescript.md) : `CadEntity` et interfaces.
- [Chapitre 05](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) : `useState` et historique Undo/Redo.
- [Chapitre 08](./chapitre_08_encastrement_des_menuiseries.md) : `hostWallId` (mur hôte d'une ouverture).

## 📁 Fichiers concernés

- [src/types.ts](../types.ts) — interface `CadLevel`.
- [src/components/CadEditor.tsx](../components/CadEditor.tsx) — états `levels`, `activeLevelId`, `otherLevels` ; fonctions `gotoLevel`, `handleSelectLevel`, `addLevel`, `duplicateLevel`, `updateLevel`, `deleteLevel`.
- [src/components/LevelManager.tsx](../components/LevelManager.tsx) — sélecteur et panneau de gestion.
- [src/viewsGeometry.ts](../viewsGeometry.ts) — `buildLevelData`.
- [src/components/ExportModal.tsx](../components/ExportModal.tsx) — maquette d'export (voir limites).

---

## 1. Le modèle de données : `CadLevel`

```typescript
// src/types.ts
export interface CadLevel {
  id: string;
  name: string;      // ex. "RDC", "R+1"
  elevation: number; // altitude du plancher fini en mm (RDC = 0)
  height: number;    // hauteur sous plafond / hauteur de mur par défaut en mm
}
```

Un niveau ne **contient pas** ses entités : il décrit seulement un étage (nom, altitude, hauteur). L'initialisation dans `CadEditor` donne un seul niveau :

```typescript
const [levels, setLevels] = useState<CadLevel[]>([{ id: 'lvl-rdc', name: 'RDC', elevation: 0, height: 2800 }]);
const [activeLevelId, setActiveLevelId] = useState('lvl-rdc');
const [otherLevels, setOtherLevels] = useState<Record<string, CadEntity[]>>({});
```

## 2. Le principe : `entities` = niveau actif seulement

Imaginons trois niveaux. Un seul est « chargé » dans `entities` ; les autres attendent dans `otherLevels` :

```
levels          : [ RDC , R+1 , R+2 ]
activeLevelId   : 'R+1'

entities        = entités de R+1                (le « niveau courant »)
otherLevels     = { RDC: [...], R+2: [...] }    (les autres, en réserve)

entitiesByLevel = { ...otherLevels, [activeLevelId]: entities }   ← reconstitué à chaque rendu
```

`entitiesByLevel` est la **vue complète** (tous les niveaux) : elle sert à ceux qui ont besoin de plusieurs étages (Vues, mise en page, compteurs de la liste de niveaux).

**Pourquoi ce choix ?** Les 6 900 lignes de `CadEditor` (dessin, accrochage, sélection, inspecteur, historique) lisent et écrivent `entities`. En gardant la même variable pour « ce que je dessine maintenant », **aucun outil de dessin n'a dû changer** : ajouter un niveau est devenu un problème de *rangement* et non de réécriture. Contrepartie : il faut échanger les contenus à chaque changement de niveau (section 3).

## 3. Changer de niveau : `gotoLevel`

```typescript
const gotoLevel = (id: string, data: Record<string, CadEntity[]>, lvls: CadLevel[]) => {
  const { [id]: target = [], ...rest } = data;  // on sépare le niveau cible du reste
  setOtherLevels(rest);                         // le reste part en réserve
  setEntities(target);                          // la cible devient `entities`
  setActiveLevelId(id);
  setSelectedIds([]);
  setHistoryStack([]);                          // historique réinitialisé
  setRedoStack([]);
  const lv = lvls.find(l => l.id === id);
  if (lv) setWallHeight(lv.height);             // hauteur de mur par défaut = hauteur du niveau
};
```

C'est la seule porte d'entrée : `handleSelectLevel`, `addLevel`, `duplicateLevel` et `deleteLevel` l'utilisent tous. Elle reçoit la **table complète** `data` en paramètre (et non l'état courant) car, juste après un `setLevels`, l'état React n'est pas encore à jour : on passe donc explicitement les nouvelles valeurs.

**Pourquoi réinitialiser l'historique ?** `historyStack` contient des états de `entities`. Après un changement de niveau, un « Annuler » ramènerait les entités de **l'ancien** niveau à l'intérieur du nouveau : mélange catastrophique. Réinitialiser (`setHistoryStack([])`) est la solution la plus simple ; le prix est qu'on ne peut plus annuler une action faite sur un autre niveau.

## 4. Ajouter un niveau : l'altitude et la dalle

```typescript
// Extrait simplifié de addLevel
const top = Math.max(...levels.map(l => l.elevation + l.height));
const bottom = Math.min(...levels.map(l => l.elevation));
const height = activeLevel.height;
const nl: CadLevel = where === 'above'
  ? { id: `lvl-${Date.now()}`, name: `R+${...}`, elevation: top + 200, height }
  : { id: `lvl-${Date.now()}`, name: `SS-${...}`, elevation: bottom - height - 200, height };
```

- **Au-dessus** : altitude = sommet du niveau le plus haut (`elevation + height`) **+ 200 mm** d'épaisseur de dalle.
- **En dessous** : altitude = plancher le plus bas − hauteur − 200 mm (valeur négative : sous-sol).
- Un nouveau niveau démarre vide, et reprend la hauteur du niveau actif.

```
 +5,80 m  ───────────  R+1 (plancher)
          dalle 200 mm
 +2,80 m  ─ ─ ─ ─ ─ ─  sommet du RDC (0 + 2800)
  0,00 m  ───────────  RDC (plancher)
```

Exemple : RDC (`elevation` 0, `height` 2800) → R+1 à `2800 + 200 = 3000 mm`.

## 5. Dupliquer un niveau : régénérer les identifiants

Dupliquer un étage courant est un geste fréquent (étages types). Mais copier telles quelles les entités créerait des **identifiants en double**, et les ouvertures pointent vers leur mur par `hostWallId` : il faut remapper.

```typescript
const suffix = `-${nl.id.slice(-4)}`;
const copy = (entitiesByLevel[id] || []).map(e => ({
  ...e,
  id: `${e.id}${suffix}`,
  hostWallId: e.hostWallId ? `${e.hostWallId}${suffix}` : e.hostWallId,
}));
```

Le **même suffixe** est appliqué à `id` et à `hostWallId` : chaque porte copiée reste attachée au mur copié correspondant, et non au mur du niveau d'origine (règle d'encastrement du chapitre 08). Le nouvel étage est placé au-dessus de tout le bâtiment (`top + 200`).

## 6. Modifier et supprimer

```typescript
const updateLevel = (id: string, patch: Partial<CadLevel>) => {
  setLevels(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  if (id === activeLevelId && patch.height) setWallHeight(patch.height);
};
```

`Partial<CadLevel>` (chapitre 09) permet de ne changer qu'un champ (nom, altitude, hauteur). `deleteLevel` refuse de supprimer le dernier niveau (`levels.length <= 1`). Si le niveau supprimé est le niveau actif, l'éditeur bascule sur le niveau le plus bas restant (`gotoLevel`) ; sinon il retire simplement l'entrée de `otherLevels`.

## 7. Le niveau inférieur en fond estompé

Pour caler les murs d'un étage sur ceux de l'étage du dessous, `CadEditor` cherche le niveau **juste en dessous** (altitude strictement inférieure, la plus haute des inférieures) :

```typescript
const belowLevel = [...levels]
  .filter(l => l.elevation < activeLevel.elevation)
  .sort((a, b) => b.elevation - a.elevation)[0];
const ghostEntities = belowLevel
  ? (entitiesByLevel[belowLevel.id] || []).filter(e => e.type === 'wall' || e.type === 'partition')
  : [];
```

Ils sont dessinés en premier (section « 0. NIVEAU INFÉRIEUR EN FOND ESTOMPÉ ») : un `<g opacity={0.22}>` de `<line>` grises, avec `pointer-events-none` pour ne pas gêner la sélection. Ce sont de simples segments d'axe, pas de polygones raccordés.

## 8. L'interface : `LevelManager`

[`LevelManager.tsx`](../components/LevelManager.tsx) est un composant **sans logique métier** : il reçoit `levels`, `activeLevelId`, `entityCounts` et des callbacks (`onSelect`, `onAddAbove`, `onAddBelow`, `onDuplicate`, `onUpdate`, `onDelete`). Le bouton du HUD affiche `NIVEAU: <nom> (<altitude>)` ; le panneau liste les niveaux **triés par altitude décroissante** (`b.elevation - a.elevation`), avec leurs boutons Travailler / Dupliquer / Supprimer. C'est l'illustration du « lifting state up » du chapitre 09 : l'état vit dans `CadEditor`, le composant ne fait qu'afficher et appeler.

## 9. Impact sur les Vues

`ViewsPanel` et `LayoutPanel` reçoivent `levels` et `entitiesByLevel`. La fonction `buildLevelData` de `viewsGeometry.ts` transforme ces données en une structure par niveau :

```typescript
// src/viewsGeometry.ts (signature)
export const buildLevelData = (
  levels: CadLevel[],
  entitiesByLevel: Record<string, CadEntity[]>,
  isLayerVisible: (layerId: string) => boolean,
  hiddenLevels: string[] = []
): LevelData[]
```

Elle trie par altitude croissante, écarte les niveaux masqués, et ne garde que les murs/cloisons et les portes/fenêtres des calques visibles. Les façades et coupes utilisent ensuite `level.elevation` comme base verticale et `w.height || level.height` comme hauteur de mur : c'est donc ici que l'altitude `elevation` prend tout son sens (chapitre 14).

## 10. Limites actuelles

- **Export** : la fenêtre d'export est aujourd'hui une maquette (chapitre 10) et ne reçoit pas les entités ; un export branché naïvement sur `entities` ne verrait **que le niveau actif**. Il faudrait lui passer `entitiesByLevel`.
- **Historique** : réinitialisé à chaque changement de niveau.
- **Un seul niveau fantôme** (celui du dessous), et seulement les murs/cloisons.
- **Pas de lien entre niveaux** : modifier un mur du RDC ne met pas l'étage à jour.
- **Pas de ré-ordonnancement automatique** : un niveau est ordonné par son altitude ; modifier l'altitude à la main peut produire des chevauchements.

## ⚠️ Pièges classiques

- Lire `entities` en croyant y trouver tous les niveaux.
- Passer l'état `levels` fraîchement mis à jour à `gotoLevel` : il est périmé, passez la nouvelle liste.
- Dupliquer les entités sans remapper `hostWallId` : les portes pointeraient vers l'ancien étage.
- Oublier de vider la sélection au changement de niveau (`selectedIds` contiendrait des identifiants inexistants).
- Supprimer le dernier niveau : la garde `levels.length <= 1` existe pour l'empêcher.

## ✍️ Exercices

1. **Altitude.** Le RDC (`elevation` 0) fait 2800 mm et est le niveau actif. Quelle `elevation` reçoit le premier sous-sol créé avec `addLevel('below')` ? *Indice : formule `bottom - height - 200`.*
2. **Identifiants.** Pourquoi `duplicateLevel` ne peut-il pas simplement copier les entités sans changer leurs `id` ?
3. **Niveau fantôme.** Comment afficher aussi le niveau situé *au-dessus* (en pointillés) ? *Indice : filtre sur `elevation >`.*

<details>
<summary>Solutions succinctes</summary>

1. `bottom = 0`, `height` = hauteur du niveau actif (2800) : `0 − 2800 − 200 = −3000 mm`.
2. Les `id` sont les clés de sélection, de rendu React (`key`) et de `hostWallId` ; des doublons entre niveaux casseraient la cohérence, et les ouvertures resteraient rattachées aux murs d'origine.
3. Calculer `aboveLevel` avec `l.elevation > activeLevel.elevation` et trier par altitude croissante (`a.elevation - b.elevation`)[0] ; dessiner son contenu dans un second `<g>` à faible opacité.
</details>

## 📌 À retenir

- `CadLevel` = nom + altitude + hauteur (en mm), sans entités.
- `entities` = niveau actif seulement ; les autres sont dans `otherLevels` ; `entitiesByLevel` les réunit.
- Ce choix évite de modifier tout le code de dessin, mais impose `gotoLevel` et une réinitialisation de l'historique.
- Dupliquer = nouveaux `id` + remap de `hostWallId`.
- Un nouvel étage = sommet du bâtiment + 200 mm de dalle ; les Vues utilisent `entitiesByLevel` via `buildLevelData`.

---

⬅️ [Chapitre précédent (11)](./chapitre_11_performance_et_deploiement.md) | [Sommaire](./README.md) | [Chapitre suivant (13) ➡️](./chapitre_13_murs_ligne_reference_et_raccords.md)
