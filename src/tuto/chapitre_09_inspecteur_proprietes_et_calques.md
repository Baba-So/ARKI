# Chapitre 09 — Inspecteur de propriétés, calques et communication entre composants

Un plan CAO n'est utile que si l'on peut le corriger : changer l'épaisseur d'un mur, déplacer sa ligne de référence, masquer les cotes pour imprimer... Ce chapitre montre comment l'inspecteur (`PropertiesSidebar`) et le gestionnaire de calques (`LayerManager`) dialoguent avec `CadEditor`, qui reste le seul propriétaire des données.

## 🎯 Objectifs

- Comprendre la « remontée d'état » : les enfants ne modifient jamais les données, ils appellent des callbacks du parent.
- Utiliser `Partial<CadEntity>` pour envoyer des modifications ciblées.
- Lire `handleUpdateSelectedFields` et ses règles spéciales pour les murs (ligne de référence, épaisseur, ouvertures hébergées).
- Connaître les blocs de l'inspecteur (géométrie, ligne de référence, texte, ouvertures) et les trois onglets.
- Maîtriser les calques : visibilité, verrouillage, et leur effet réel sur le dessin et la sélection.

## 📋 Prérequis

- Chapitre 01 et 05 (props, état, `useState`).
- Chapitre 07 (murs, `refLine`) et chapitre 08 (ouvertures, `hostWallId`).

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : `handleUpdateSelectedFields`, `handleToggleVisibility`, `handleToggleLock`, `handleChangeColor`, `handleAddLayer`, `getLayer`, `handleEntityClick`.
- [`src/components/PropertiesSidebar.tsx`](../components/PropertiesSidebar.tsx) : l'inspecteur.
- [`src/components/LayerManager.tsx`](../components/LayerManager.tsx) : le gestionnaire de calques.
- [`src/components/LevelManager.tsx`](../components/LevelManager.tsx) : sélecteur de niveaux (même principe de props/callbacks).
- [`src/types.ts`](../types.ts) : `CadEntity`, `CadLayer`, `CadLevel`.

---

## 1. Remontée d'état : un seul propriétaire des données

**Concept.** Imaginez un chantier : le conducteur de travaux détient le plan. Les ouvriers (les composants enfants) ne gribouillent pas dessus ; ils lui disent « modifie la cloison 3 : épaisseur 98 mm ». En React, le plan est l'état `entities` de `CadEditor`, et chaque message est une *fonction passée en prop*.

```tsx
// CadEditor.tsx — rendu de l'inspecteur (extrait)
<PropertiesSidebar
  entity={primarySelectedEntity}
  selectedCount={selectedIds.length}
  layers={layers}
  allEntities={entities}
  onUpdate={handleUpdateSelectedFields}
  onDelete={handleDeleteSelected}
  onDuplicate={handleDuplicateSelected}
  onDeselect={() => setSelectedIds([])}
  onSnapOpeningToWall={handleSnapOpeningToWall}
/>
```

Les données descendent (`entity`, `layers`, `allEntities`), les ordres remontent (`onUpdate`, `onDelete`...). Pas de Redux : à cette taille, des props suffisent, et le flux est facile à suivre.

## 2. `Partial<CadEntity>` : ne dire que ce qui change

`Partial<T>` rend toutes les propriétés de `T` optionnelles. L'inspecteur envoie donc seulement le delta : `onUpdate({ thickness: 98 })`, `onUpdate({ refLine: 'left' })`, `onUpdate({ layerId: 'cloisons' })`. Le parent fusionne : `{ ...e, ...updatedFields }`.

L'interface réelle est `onUpdate: (updatedFields: Partial<CadEntity>) => void` : un seul callback pour tous les champs, au lieu de dix callbacks spécialisés.

---

## 3. `handleUpdateSelectedFields` : la fusion, et ses exceptions

Pour la plupart des champs, la fusion est triviale. Mais pour un mur ou une cloison, changer `refLine` ou `thickness` a des conséquences géométriques :

```tsx
// CadEditor.tsx
const handleUpdateSelectedFields = (updatedFields: Partial<CadEntity>) => {
  if (!primarySelectedEntity) return;
  recordHistory();                                   // annuler / rétablir
  const w = primarySelectedEntity;
  const isWallLike = w.type === 'wall' || w.type === 'partition';
  if (isWallLike && (updatedFields.refLine !== undefined || updatedFields.thickness !== undefined)) {
    const oldT = (w.thickness || (w.type === 'partition' ? 72 : 200)) / 10;
    const newT = (updatedFields.thickness ?? w.thickness ?? (w.type === 'partition' ? 72 : 200)) / 10;
    const delta = (refSign(updatedFields.refLine ?? w.refLine) * newT) / 2
                - (refSign(w.refLine) * oldT) / 2;
    // ... dx, dy = delta le long de la normale du mur
    setEntities(prev => prev.map(e => {
      if (e.id === w.id) return { ...e, ...updatedFields, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
      if (e.hostWallId === w.id) return { ...e, x1: e.x1 + dx, /* ... */ };
      return e;
    }));
    return;
  }
  setEntities(prev => prev.map(e => (e.id === w.id ? { ...e, ...updatedFields } : e)));
};
```

**Pourquoi cette logique ?** L'entité stocke l'*axe* du mur (chapitre 07). La **ligne de référence reste fixe dans le plan** : si vous passez de « Axe » à « Nu gauche », l'axe se décale de la moitié de l'épaisseur, et le corps du mur « glisse » autour de la ligne qui, elle, ne bouge pas. Les portes et fenêtres dont `hostWallId` pointe sur ce mur sont décalées du même vecteur ; sinon elles resteraient dans l'ancienne position, hors du mur. Changer l'épaisseur applique le même calcul (la face de référence ne bouge pas, l'autre face avance ou recule). Si l'épaisseur change, l'épaisseur des ouvertures hébergées est mise à jour aussi. Détails au [chapitre 13](./chapitre_13_murs_ligne_reference_et_raccords.md).

`recordHistory()` est appelé *avant* la modification : c'est lui qui empile l'état courant dans la pile d'annulation.

---

## 4. Anatomie de `PropertiesSidebar`

Le composant reçoit `entity: CadEntity | null`. L'inspecteur affiche **trois onglets** (`activeSubTab` : `'geom' | 'material' | 'position'`) :

| Onglet | Contenu |
|---|---|
| Géométrie (`geom`) | longueur, angle, ligne de référence, épaisseur/hauteur, hachures, texte, cotation, panneau des ouvertures |
| Matière (`material`) | choix dans `ARCHITECTURAL_MATERIALS` (index `MAT-xx`, lambda, carbone) |
| Position (`position`) | **calque assigné** (liste déroulante), coordonnées P1/P2, alignement sur la grille 20 px |

### Saisie fluide : états locaux synchronisés

```tsx
const [localLength, setLocalLength] = useState(lengthMm.toString());
useEffect(() => {
  setLocalLength(lengthMm.toString());
  /* ... */
}, [entity.id, lengthMm, rawAngleDeg, entity.thickness, entity.height]);
```

Un `<input type="number">` doit pouvoir contenir un texte intermédiaire (« 4 », « 42 », « 420 »...) : on garde donc une copie locale en chaîne, et on la resynchronise quand l'entité change. Longueur et angle recalculent `x2,y2` à partir de P1 (qui reste fixe) via `Math.cos/sin` ; la longueur est bornée entre 50 et 25 000 mm.

### Bloc « Ligne de référence (sens du tracé) »
Visible seulement pour `wall` et `partition`. Trois boutons (`left`, `center`, `right`, libellés *Nu gauche / Axe / Nu droite*) qui appellent `onUpdate({ refLine: opt.id })`. Le bouton actif se détermine avec `(entity.refLine || 'center') === opt.id` : un mur ancien sans `refLine` est considéré centré.

### Bloc « Texte »
Visible pour `entity.type === 'text'` : un `<textarea>` relié à `label` et un champ numérique pour `fontSize` (`Math.max(4, ...)`), avec une valeur affichée par défaut de 14 (la même que celle de la création, voir chapitre 07).

### Panneau d'ouverture
Pour `door` et `window` : largeur (presets 730…, 900 « PMR », baies ≥ 1800), sens du battant (`doorSwing`), inversion (`flipSwing`), angle d'ouverture (`doorAngle`), allège (`sillHeight`), type (`openingType`) et le bouton **réencastrer** (`onSnapOpeningToWall`). Il utilise `hostWall`, déduit de `hostWallId` ou, à défaut, de la proximité des centres.

---

## 5. Les calques : `LayerManager`

Les calques (`CadLayer` : `id`, `name`, `category`, `color`, `visible`, `locked`, `opacity`, `lineweight`...) vivent dans l'état `layers` de `CadEditor`. Le gestionnaire reçoit :

```tsx
interface LayerManagerProps {
  layers: CadLayer[];
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onChangeColor: (layerId: string, color: string) => void;
  onAddLayer?: (name: string, category: CadLayer['category'], color: string) => void;
  onClose?: () => void;
  isCompact?: boolean;
}
```

Côté parent, chaque callback est un `setLayers` fonctionnel qui renvoie un *nouveau* tableau :

```tsx
const handleToggleVisibility = (layerId: string) =>
  setLayers(prev => prev.map(l => (l.id === layerId ? { ...l, visible: !l.visible } : l)));
```

Fonctions du composant : filtre de recherche (`searchFilter`), actions de lot (**Tous**, **Aucun**, **Déverr. tout** qui bouclent sur `layers`), formulaire de création, palette de couleurs prédéfinies (`PRESET_COLORS`) et compteur « n obj. » par calque (`entityCount`).

### Que font vraiment visibilité et verrouillage ?

Le calque n'est pas qu'un affichage : il conditionne la **logique**.

- **Masqué** (`!l.visible`) : l'entité n'est pas dessinée (`if (!l.visible) return null` dans le rendu) et n'est ni sélectionnable ni candidate à `findWallSnap` ni à l'accrochage.
- **Verrouillé** (`l.locked`) : l'entité reste dessinée (opacité 0,6) mais `handleEntityClick` ignore le clic (`if (!l.visible || l.locked) return`). Les outils de création refusent d'écrire dans un calque verrouillé (`alert("Le calque Structures est verrouillé...")`), y compris l'outil Texte pour `cotations`. `findWallSnap` ne propose plus les murs verrouillés.

Les calques normalisés : `structures`, `cloisons`, `ouvertures`, `mobilier`, `cotations`. `getLayer(id)` renvoie le calque demandé, ou le premier par défaut.

### Les niveaux, cousin des calques
`LevelManager` suit la même recette : il reçoit `levels`, `activeLevelId` et des callbacks (`onSelect`, `onAddAbove`, `onAddBelow`, `onDuplicate`, `onUpdate`, `onDelete`), et ne possède aucune donnée. Un niveau regroupe un jeu complet d'entités ; un calque trie les objets *au sein* d'un niveau. Voir le [chapitre 12](./chapitre_12_gestion_des_niveaux.md).

---

## ⚠️ Pièges classiques

- **Modifier `entity` directement** dans l'inspecteur (`entity.thickness = 98`) : React ne détecte rien. Toujours `onUpdate({ ... })`.
- **Hooks après un `return` conditionnel** : dans `PropertiesSidebar`, `if (!entity) return null;` précède les `useState`. Cela marche parce que le parent ne monte le composant que si une entité est sélectionnée, mais cela enfreint la règle des hooks ; la bonne pratique est de placer le `return` après les hooks.
- **Oublier les ouvertures hébergées** quand on modifie la géométrie d'un mur : elles resteraient en l'air.
- **Confondre masqué et verrouillé** : masqué = invisible et inerte ; verrouillé = visible mais protégé.
- **Mutation de tableau** (`layers.push`) au lieu d'un nouveau tableau : l'interface ne se mettrait pas à jour.

## ✍️ Exercices

**Exercice 1 (facile).** Quelle valeur de `refLine` l'inspecteur affiche-t-il comme active pour un mur dessiné avant l'existence de cette fonctionnalité ?

<details><summary>Solution</summary><code>'center'</code> (« Axe »), à cause de <code>(entity.refLine || 'center')</code>.</details>

**Exercice 2 (moyen).** Un mur de 200 mm en « Axe » passe à « Nu gauche ». De combien l'axe est-il décalé, et que deviennent les portes ?

<details><summary>Indice</summary><code>delta = (refSign(new) × newT)/2 − (refSign(old) × oldT)/2</code> avec <code>T</code> en px.</details>
<details><summary>Solution</summary><code>newT = oldT = 20 px</code>, <code>refSign('left') = 1</code>, <code>refSign(center) = 0</code> : <code>delta = 10 px</code> (100 mm) le long de la normale. Les ouvertures avec <code>hostWallId</code> égal à l'id du mur reçoivent le même décalage.</details>

**Exercice 3 (avancé).** Ajoutez un bouton « Isoler ce calque » au `LayerManager` qui masque tous les autres. Quel callback utilisez-vous ?

<details><summary>Indice</summary>Réutilisez le motif des boutons « Tous » / « Aucun ».</details>
<details><summary>Solution</summary>Boucler sur <code>layers</code> : <code>onToggleVisibility(l.id)</code> pour chaque calque visible différent de la cible, et le rendre visible s'il ne l'est pas. Aucun nouveau callback n'est nécessaire dans <code>CadEditor</code>.</details>

## 📌 À retenir

- `CadEditor` possède `entities` et `layers` ; les composants enfants reçoivent des props et appellent des callbacks.
- `onUpdate(Partial<CadEntity>)` transporte seulement les champs modifiés.
- Pour un mur, `handleUpdateSelectedFields` garde la ligne de référence fixe et déplace axe et ouvertures hébergées.
- L'inspecteur a trois onglets (géométrie, matière, position) et des blocs dédiés : ligne de référence, texte, ouvertures.
- Masqué = ignoré partout ; verrouillé = visible mais non éditable ni accrochable.

⬅️ [Chapitre précédent](./chapitre_08_encastrement_des_menuiseries.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_10_moteur_export_dxf_autocad_et_svg.md) ➡️
