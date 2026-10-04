# 04 — Créer un paramètre

« Paramètre » recouvre **trois réalités différentes**. Choisir la bonne dès le départ évite 80 % des erreurs.

| Type de paramètre | Il vit dans… | Exemple réel | Portée |
|---|---|---|---|
| **A. Réglage d'outil** | un `useState` de `CadEditor` + champ dans la barre du haut | `wallThickness`, `wallHeight`, `wallJustif` | s'applique aux **prochains objets créés** |
| **B. Attribut d'objet** | un champ optionnel de `CadEntity` + inspecteur | `thickness`, `refLine`, `fontSize` | **un** objet précis |
| **C. Réglage global** | `settings` (`CadSettings`) | `grid`, `snapToGrid`, `ortho`, `units` | tout l'éditeur |
| *(D. Réglage de planche)* | un champ de `LayoutSheet` / `LayoutViewport` | `scale`, `format`, `showFrame` | une planche / un cadre |

```
Quel paramètre ?
 « change ce que je vais dessiner »    → A  (réglage d'outil)
 « change CET objet déjà dessiné »     → B  (attribut) (+ souvent A pour la valeur par défaut)
 « change le comportement de l'éditeur »→ C  (réglage global)
 « change la mise en page »             → D
```

> Très souvent un paramètre est **A + B** : l'outil porte la valeur par défaut, l'objet la mémorise, l'inspecteur la modifie. C'est le cas de la **ligne de référence** (étude de cas plus bas).

---

## A. Réglage d'outil

1. **État** (dans `CadEditor`) :
   ```ts
   const [wallThickness, setWallThickness] = useState(200);      // mm
   ```
2. **Champ** dans la barre contextuelle du haut (cherchez `TOP CONTEXTUAL SUB-TOOLBAR`) :
   ```tsx
   <input type="number" value={wallThickness}
          onChange={(e) => setWallThickness(Number(e.target.value))} />
   ```
   Un champ n'apparaît que pour certains outils : il est entouré d'une condition du type `activeTool === 'wall' || …`.
3. **Utilisation** à la création (`handleCanvasClick`) : `thickness: wallThickness`.
4. **Aperçu** : l'aperçu fantôme doit lire la même variable.

## B. Attribut d'objet

1. **Type** : ajouter le champ **optionnel** :
   ```ts
   export interface CadEntity { …; refLine?: 'left' | 'center' | 'right'; }
   ```
2. **Création** : le renseigner (ou laisser vide = valeur par défaut).
3. **Rendu / calcul** : lire avec une valeur de repli (`ent.refLine ?? 'center'`).
4. **Inspecteur** : un contrôle qui appelle `onUpdate({ champ: valeur })` ([guide 06](./06_inspecteur_et_panneaux.md)).
5. **Effets de bord** : si changer la valeur doit déplacer/recalculer autre chose, le code va dans `handleUpdateSelectedFields` (voir l'étude de cas).

## C. Réglage global

1. **Type** : ajouter le champ dans `CadSettings` (`types.ts`) — par exemple `lineWeight: boolean`.
2. **Valeur initiale** : dans le `useState<CadSettings>({ … })` de `CadEditor` (cherchez `const [settings`).
3. **Interrupteur** : `setSettings(s => ({ ...s, grid: !s.grid }))` (barre d'état, raccourci, CLI).
4. **Lecture** : `settings.grid` partout où c'est utile.

⚠️ Plusieurs champs de `settings` sont **doublonnés** par des états à part (`wallJustif` existe dans `settings` *et* comme `useState`). Le code utilise l'état à part ; le champ `settings.wallJustif` n'est qu'un reliquat. Ne créez pas de nouveau doublon : choisissez **une seule** source de vérité.

## D. Réglage de planche
Ajoutez le champ au type (`LayoutSheet` ou `LayoutViewport`), une valeur dans `createSheet`/`addViewport` (`LayoutPanel.tsx`), et un contrôle dans le panneau de gauche qui appelle `patchSheet({...})` ou `patchItem(id, {...})`.

---

## 🔬 Étude de cas : la « ligne de référence » des murs (A + B)

Objectif : choisir si les points cliqués désignent l'**axe** du mur, sa **face gauche** ou sa **face droite**.

| Étape | Où | Ce qu'on a fait |
|---|---|---|
| Donnée par objet | `types.ts` | `CadEntity.refLine?: 'left' \| 'center' \| 'right'` |
| Réglage d'outil | `CadEditor` | `wallJustif: 'Nu Gauche' \| 'Axe' \| 'Nu Droite'` (+ bouton dans la barre du haut) |
| Calcul pur | `wallGeometry.ts` | `justifToRef`, `refToCenterline`, `refSign` |
| Application | `CadEditor` | `placeWall(x1,y1,x2,y2,épaisseur)` appelée par **les 10 sites de création** d'un mur/cloison |
| Aperçu | `CadEditor` | l'aperçu appelle la même `placeWall` (rectangle : décalage intérieur/extérieur selon la justification) |
| Inspecteur | `PropertiesSidebar` | bloc « Ligne de référence » → `onUpdate({ refLine })` |
| Effet de bord | `handleUpdateSelectedFields` | la ligne reste **fixe** : l'axe et les ouvertures hébergées sont décalés de `refSign(new)·t/2 − refSign(old)·t/2` |

Leçons :
- **Mettre la logique dans un module pur** (`wallGeometry.ts`) permet de l'appeler depuis la création, l'aperçu *et* l'inspecteur sans la dupliquer.
- Quand un paramètre est modifiable après coup, **dites précisément ce qui reste fixe** (ici : la ligne de référence) et propagez aux objets dépendants (les portes/fenêtres : `hostWallId`).

## ⚠️ Pièges classiques
- **Valeur par défaut manquante** pour les anciens objets (ils n'ont pas le nouveau champ) → toujours `?? défaut`.
- **Champ contrôlé qui « saute »** : un `<input type="number">` relié à une valeur recalculée peut réécrire ce que l'utilisateur tape ; gardez un état local (`localThickness` dans l'inspecteur) si besoin.
- **Unités** : documentez-les dans le commentaire du champ (`// mm`, `// px plan`).
- **Paramètre qui ne s'applique pas à l'aperçu** : l'utilisateur voit une chose, obtient une autre.

## ✍️ Exercice
Ajoutez le paramètre **« Hauteur d'allège par défaut »** (mm) pour l'outil Fenêtre : un champ dans la barre quand `activeTool === 'window'`, stocké dans l'entité (`sillHeight` existe déjà dans `CadEntity`), pris en compte par `openingZ` (`viewsGeometry.ts`).
<details><summary>Indice</summary>
État `windowSill` (A) ; dans la création de fenêtre ajouter `sillHeight: windowSill` (B) ; `openingZ` lit déjà `op.sillHeight ?? …`, donc les façades l'utilisent sans autre modification.
</details>

⬅️ [03 — Créer un type d'entité](./03_creer_un_type_d_entite.md) | [Index](./README.md) | [05 — Créer un onglet ➡️](./05_creer_un_onglet.md)
