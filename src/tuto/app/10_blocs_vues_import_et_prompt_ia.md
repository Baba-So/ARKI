# 10 — Blocs : vues multiples, import et prompt IA

Un **bloc** est un objet prêt à poser. Chaque bloc possède **plusieurs vues** SVG :

| Type de bloc | Vues | Utilisation |
|---|---|---|
| **Mobilier** (`kind: 'furniture'`) | **3** : `top` (dessus), `front` (face), `side` (latérale) | `top` = symbole sur le plan ; les trois sont visibles dans la fiche du bloc |
| **Ouverture** (`kind: 'opening'`, porte/fenêtre) | **2** : `top` (**coupe horizontale** du mur), `front` (face) | `front` = dessin de la baie dans les façades et coupes ; `top` dans la fiche |

---

## 1. Où est quoi

| Fichier | Rôle |
|---|---|
| `src/types.ts` | `CadBlock` (+ `kind`, `openingKind`, `zMm`, `views`, `custom`) et `BlockViews` |
| `src/constants/blocks.ts` | Blocs prédéfinis (`PREDEFINED_CAD_BLOCKS`) |
| `src/blockSymbols.ts` | **Symboles paramétriques** : `blockViews(block)` → vues dessus/face/côté générées d'après `renderType` et les dimensions ; `blockZ`, `isOpeningBlock`, `inferRenderType` |
| `src/blockSchema.ts` | Import : `sanitizeSvgFragment`, `parseBlocksJson`, `parseSpecLines`, **`buildBlockPrompt`** |
| `src/blockStore.ts` | Registre partagé (prédéfinis + importés, persistés dans `localStorage`), `useBlocks()`, `findBlock(id)` |
| `src/components/BlockSvg.tsx` | Dessine une vue (taille libre, ou `box` pour l'imbriquer dans un SVG) |
| `src/components/BlockImportDialog.tsx` | Fenêtre « Importer » + « Prompt IA » |
| `src/components/BlockDetailDialog.tsx` | Fiche d'un bloc (ses 3 ou 2 vues, export JSON, suppression) |

## 2. Le repère des vues (à respecter pour tout bloc)

Unités : **millimètres**, origine en haut à gauche, y vers le bas.

```
widthMm  = largeur  (X)
heightMm = profondeur au plan (Y)   — pour une ouverture : épaisseur du mur
zMm      = hauteur verticale (Z)

top   : viewBox 0 0 widthMm  heightMm   dos de l'objet en haut (y = 0), face d'usage en bas
front : viewBox 0 0 widthMm  zMm        sol en bas (y = zMm)
side  : viewBox 0 0 heightMm zMm        arrière à gauche, face à droite
```
Les dessins utilisent `currentColor` : la couleur vient du conteneur (ambre = mobilier, cyan = sanitaire, vert = ouverture, gris à l'impression).

## 3. Où les vues sont utilisées

- **Plan** (`CadEditor`, bloc `3A…furniture`) : la vue `top` est **étirée** dans l'emprise de l'entité (`BlockSvg stretch box=…`) — redimensionner l'entité déforme le symbole. Les meubles posés sans bloc d'origine reçoivent un symbole déduit de leur nom (`inferRenderType`).
- **Mise en page** (`PlanDrawing` dans `LayoutPanel`) : même symbole, en gris.
- **Façades et coupes** (`ElevationDrawing`) : la vue `front` du bloc d'une ouverture (`hole.blockId`) est dessinée dans la baie ; sans bloc, l'ancien dessin générique est conservé.
- **Bibliothèque** : vignette = vue `top` ; œil = fiche avec toutes les vues.

## 4. Importer des blocs

Bibliothèque → icône d'import → onglet **Importer** : coller le JSON (un bloc, un tableau, ou `{ "blocks": [...] }`, y compris dans un bloc de code ```json) ou charger un fichier `.json`. L'aperçu montre les 3 / 2 vues avant ajout, avec **erreurs** (bloc refusé) et **avertissements** (vue absente → symbole générique).

Format d'un bloc :

```json
{
  "name": "Banc design", "kind": "furniture", "category": "sejour",
  "widthMm": 1500, "heightMm": 450, "zMm": 450, "description": "…",
  "views": { "top": "<rect …/>", "front": "<rect …/>", "side": "<rect …/>" }
}
```
Ouverture : `"kind": "opening"`, `"openingKind": "door" | "window"`, `heightMm` = épaisseur de mur, vues `top` et `front` seulement.

### Sécurité : le SVG importé n'est jamais fait confiance
`sanitizeSvgFragment` (DOMParser) ne garde que `g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan`, une liste blanche d'attributs, et refuse `url(…)`, `javascript:`, `data:`. Scripts, `<image>`, `onclick`… sont supprimés. Les blocs sont **re-nettoyés au chargement** depuis `localStorage`. Comme les vues sont injectées par `dangerouslySetInnerHTML`, **ne jamais contourner ce filtre**.

## 5. Générer les blocs avec une IA

Onglet **Prompt IA** : choisir le type (mobilier 3 vues / ouverture 2 vues), la catégorie, des dimensions par défaut, puis lister les blocs (une ligne par bloc, dimensions facultatives `Banc design 1500 x 450 x 450` = largeur x profondeur x hauteur) et d'éventuelles consignes de style. `buildBlockPrompt` produit un prompt qui contient :

1. la **liste des blocs** avec leurs dimensions (les données saisies) ;
2. le **schéma JSON** attendu ;
3. le **repère de chaque vue** (3 vues pour le mobilier, 2 pour l'ouverture) ;
4. les **règles de dessin SVG** (éléments autorisés, `currentColor`, épaisseurs en mm, guillemets simples, une ligne par vue) ;
5. un **exemple valide** (mobilier et/ou ouverture) ;
6. une demande de réponse **uniquement en JSON**.

Flux : *Prompt IA → copier → coller dans l'IA → copier sa réponse → Importer → vérifier l'aperçu → Ajouter*.

## 6. Ajouter un symbole paramétrique (nouveau `renderType`)

1. Étendre `renderType` dans `CadBlock` (`types.ts`).
2. Ajouter un `case` dans `topView`, `frontView` et `sideView` de `blockSymbols.ts` (primitives `rect`, `ellipse`, `circle`, `line`, `path` ; tout en mm ; `currentColor`).
3. Ajouter une hauteur typique dans `blockZ` si besoin, et un mot-clé dans `inferRenderType`.
4. Créer le bloc dans `src/constants/blocks.ts`.

## ⚠️ Pièges
- Une vue qui ne remplit pas sa boîte (`viewBox`) paraît décalée ou écrasée sur le plan (elle est étirée).
- Épaisseurs de trait en **mm** : 12 mm ≈ 1,2 px au plan, ≈ 0,24 mm à l'impression 1:50.
- Un bloc `custom` n'existe que dans le navigateur de l'utilisateur (`localStorage`) : exporter le JSON (fiche → « Copier le JSON ») pour le partager.
- La fenêtre d'import est rendue dans `document.body` (portail) : sinon un parent transformé la confine dans le panneau.

## ✍️ Exercice
Ajoutez le `renderType` **`'desk'`** (bureau) : plateau + tiroirs en dessus, face avec caisson, latérale avec pieds, et un bloc « Bureau 1400 × 700 ».

⬅️ [09 — Vérifier, tester, conventions](./09_verifier_tester_conventions.md) | [Index](./README.md) | [11 — Projets, tableau de bord, exports ➡️](./11_projets_dashboard_et_exports.md)
