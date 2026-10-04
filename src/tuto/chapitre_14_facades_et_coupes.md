# Chapitre 14 — Façades et coupes : projeter le plan en élévation

## 🎯 Objectifs
- Comprendre comment un plan 2D (x, y) devient une vue verticale (u, altitude).
- Maîtriser les 4 projections (Sud, Nord, Est, Ouest) et la convention de regard.
- Expliquer comment un mur est découpé par un plan de coupe, avec sa section hachurée.
- Comprendre le tri par profondeur (algorithme du peintre) et le calcul de la boîte englobante.
- Lire le dessin en mm réels (`Y = −altitude`) et l'interface de l'onglet « Vues ».

## 📋 Prérequis
- Chapitre 3 (géométrie) et chapitre 4 (SVG et coordonnées).
- Chapitre 8 (ouvertures encastrées, `hostWallId`) et chapitre 13 (murs et lignes de référence).
- Notion de niveaux (`CadLevel` : `elevation`, `height`) définie dans `src/types.ts`.

## 📁 Fichiers concernés
- [`src/viewsGeometry.ts`](../viewsGeometry.ts) : toute la géométrie des vues (aucun React).
- [`src/components/ElevationDrawing.tsx`](../components/ElevationDrawing.tsx) : dessin SVG d'un `ViewModel`.
- [`src/components/ViewsPanel.tsx`](../components/ViewsPanel.tsx) : interface (façades, coupes, curseur, niveaux).
- [`src/components/LayoutPanel.tsx`](../components/LayoutPanel.tsx) : réutilise le même dessin sur les planches (chapitre 15).

---

## 1. Idée générale : séparer le calcul du dessin

Une façade est un **plan vu de profil**. Notre éditeur ne stocke que des murs en plan ; il faut donc les « relever » à la verticale. L'architecture suit trois étapes :

```
 entités du plan ──► buildLevelData ──► buildViewModel ──► ElevationDrawing
 (par niveau)        (murs + baies)     (bandes, bornes)    (SVG en mm réels)
      viewsGeometry.ts ─────────────────────────────┘       composant React
```

Pourquoi ce choix ? La géométrie (`viewsGeometry.ts`) est une suite de fonctions pures, testables sans navigateur. Le même `ViewModel` alimente l'onglet Vues **et** les cadres de la mise en page : on ne code la projection qu'une fois.

---

## 2. Les 4 projections : `Dir` et `project`

Convention du plan (rappel) : 1 px = 10 mm, **Y vers le bas**, le Nord est en haut de l'écran. Un point du plan est projeté en `(u, d)` :
- `u` : abscisse sur l'écran de la façade (mm), de gauche à droite ;
- `d` : profondeur (mm), **croissante vers le fond**.

```ts
export type Dir = 'S' | 'N' | 'E' | 'O';

export const project = (dir: Dir, x: number, y: number) => {
  switch (dir) {
    case 'S': return { u: x * 10, d: -y * 10 };
    case 'N': return { u: -x * 10, d: y * 10 };
    case 'E': return { u: -y * 10, d: -x * 10 };
    case 'O': return { u: y * 10, d: x * 10 };
  }
};
```

Le `* 10` convertit les px du plan en mm réels. Le signe dépend de la position de l'observateur.

| Façade | Observateur placé au… | Regard vers | `u` | `d` | Plus proche de l'œil |
|---|---|---|---|---|---|
| `S` (Sud) | Sud | le Nord | `x·10` | `−y·10` | `y` grand |
| `N` (Nord) | Nord | le Sud | `−x·10` | `y·10` | `y` petit |
| `E` (Est) | Est | l'Ouest | `−y·10` | `−x·10` | `x` grand |
| `O` (Ouest) | Ouest | l'Est | `y·10` | `x·10` | `x` petit |

Les libellés lisibles vivent dans `DIR_LABEL` (« Façade Sud »…) et `LOOK_LABEL` (« regard vers le Nord »…).

### Schéma : du plan à la façade Sud

```
 PLAN (vu du dessus)                    FAÇADE SUD (vue de face)
      Nord (y petit)
   ┌─────────────────┐                  altitude
   │   mur arrière   │  d grand            ▲   ┌───────────────┐
   │                 │                     │   │ ▢   ▢   ▯     │
   │   mur avant ────┼─► regard            │   │               │
   └─────────────────┘  d petit            └───┴───────────────┴──► u
      Sud (y grand) ◄── observateur            u = x · 10 (gauche→droite)
```

Le mur le plus au sud (y grand) a un `d` faible : il est devant les autres.

---

## 3. Le plan de coupe : `Cut`, `makeCut`, `keepSide`

Une **coupe** est une façade dont on a retiré tout ce qui se trouve entre l'observateur et un plan.

```ts
export interface Cut {
  axis: 'x' | 'y'; // axe sur lequel la valeur est fixée
  value: number;   // px plan
  dir: Dir;
}

export const makeCut = (id: 'AA' | 'BB', value: number, flip: boolean): Cut =>
  id === 'AA' ? { axis: 'y', value, dir: flip ? 'N' : 'S' }
                : { axis: 'x', value, dir: flip ? 'O' : 'E' };
```

- **Coupe AA** : plan horizontal sur le plan (`y = value`), on regarde vers le Nord (`S`) ou le Sud (`N` si inversée).
- **Coupe BB** : plan vertical (`x = value`), on regarde vers l'Ouest (`E`) ou l'Est (`O` si inversée).

```
        Nord
   ┌───────────────────┐
   │  partie conservée │   keepSide > 0
   │  (devant le plan, │
   │  vue de l'œil)    │
 ──┼───────────────────┼── plan de coupe AA (y = value)  ◄─ traits mixtes
   │  partie enlevée   │   keepSide < 0 (derrière l'observateur)
   └───────────────────┘
        Sud   ● observateur (dir 'S', regarde vers le Nord)
```

`keepSide` renvoie un nombre **signé** : positif = côté conservé, négatif = côté supprimé.

```ts
export const keepSide = (cut: Cut, x: number, y: number) => {
  const v = cut.axis === 'y' ? y : x;
  const sign = cut.dir === 'S' || cut.dir === 'E' ? -1 : 1;
  return (v - cut.value) * sign;
};
```

Pourquoi un nombre signé et pas un booléen ? Parce que l'interpolation de l'intersection (§5) a besoin des deux valeurs `s1` et `s2`.

---

## 4. Niveaux et ouvertures

### 4.1 `buildLevelData`
Cette fonction trie les niveaux par `elevation`, retire les niveaux masqués (`hiddenLevels`) et, pour chacun, sépare **murs/cloisons** et **portes/fenêtres**, en respectant la visibilité des calques via `isLayerVisible`. Résultat : un tableau de `LevelData { level, walls, openings }`.

### 4.2 `openingZ` : la hauteur d'une baie
```ts
export const openingZ = (op: CadEntity) => {
  if (op.type === 'door') return { z0: 0, z1: 2040 };
  const m = (op.label || op.name || '').match(/x\s*(\d{3,4})/i);
  const h = m ? parseInt(m[1], 10) : 1250;
  const sill = op.sillHeight ?? (h >= 2000 ? 0 : 900);
  return { z0: sill, z1: sill + h };
};
```
Une porte fait 2,04 m. Pour une fenêtre, la hauteur est lue dans le libellé (ex. « 1200 x 1250 ») ou vaut 1250 mm par défaut ; l'allège (`sillHeight`) est de 900 mm, sauf pour une baie ≥ 2 m posée au sol. C'est une heuristique : la donnée « hauteur » n'existe pas encore sous forme de champ dédié.

---

## 5. Les bandes de murs : `buildStrips`

Chaque mur devient une ou deux **bandes** (`Strip`) : un rectangle vertical `[uMin, uMax] × [z0, z0+height]` avec ses trous (`holes`) pour les baies.

```ts
export interface Strip {
  id: string; wallId: string; levelId: string;
  z0: number;           // altitude de la base (mm)
  uMin: number; uMax: number;
  depth: number; height: number;
  holes: Array<{ u0; u1; z0; z1; kind: 'door' | 'window'; id }>;
  cut: boolean;         // true = section franche au plan de coupe
  thickness: number;
}
```
(Extrait simplifié du type : les types des champs de `holes` sont abrégés.)

Déroulé de `buildStrips(levelData, cut, viewDir)` pour chaque mur :

1. **Rejet** : si les deux extrémités sont du mauvais côté (`s1 < 0 && s2 < 0`), le mur est derrière l'observateur : ignoré.
2. **Découpe** : si une seule extrémité est du mauvais côté, on calcule le point d'intersection par interpolation linéaire et on raccourcit le segment.

```ts
const t = s1 / (s1 - s2);
const ix = w.x1 + (w.x2 - w.x1) * t;
const iy = w.y1 + (w.y2 - w.y1) * t;
```
`t` est la fraction du mur parcourue quand `keepSide` passe par zéro.

3. **Ouvertures** : pour chaque baie dont `hostWallId` est ce mur, on projette ses extrémités. Une baie coupée par le plan est mémorisée comme un trou de largeur nulle (`u0 === u1`) : elle évidera la section franche à l'étape 5.
4. **Largeur minimale** : un mur vu par la tranche (`uMax - uMin < thick`) est élargi à son épaisseur, sinon il disparaîtrait.
5. **Section franche** : au droit du plan de coupe, on ajoute une seconde bande `cut: true`, `depth: -1e9`, qui sera hachurée. Sa largeur apparente est `thick / n`, où `n` est la composante du mur perpendiculaire au plan ; un mur oblique est donc plus large dans la coupe. Garde-fous : `n >= 0.05` (un mur presque parallèle au plan n'a pas de section lisible) et `Math.min(thick / n, thick * 20)`.

### Schéma : un mur oblique tranché
```
  plan de coupe ─────┼──────────────────────
                    ╱│            n = |composante ⟂ au plan|
        mur oblique╱ │            largeur de section = épaisseur / n
                  ╱  │
   (partie gardée)   (partie enlevée)
```

---

## 6. L'algorithme du peintre : le tri par profondeur

Il n'y a pas de gestion de z-buffer en SVG : l'ordre d'écriture décide de ce qui est devant. On trie donc **du fond vers le premier plan**, comme un peintre qui commence par l'arrière-plan.

```ts
return result.sort((a, b) => b.depth - a.depth);
```

- `depth` d'un mur = moyenne des profondeurs de ses deux extrémités.
- `depth = -1e9` pour les sections franches : elles passent en dernier, donc par-dessus tout.

Limite à connaître : moyenner les profondeurs est une approximation. Deux murs qui se chevauchent en profondeur peuvent être mal ordonnés (voir pièges).

---

## 7. Boîte englobante et modèle de vue

```ts
export const computeBounds = (strips: Strip[]): ViewBounds => {
  if (!strips.length) return { minU: 0, maxU: 8000, maxZ: 2800, minZ: 0 };
  return {
    minU: Math.min(...strips.map(s => s.uMin)),
    maxU: Math.max(...strips.map(s => s.uMax)),
    maxZ: Math.max(...strips.map(s => s.z0 + s.height)),
    minZ: Math.min(0, ...strips.map(s => s.z0 - 200)),
  };
};
```
Une valeur par défaut évite `Math.min()` sur tableau vide (`Infinity`). `minZ` descend sous 0 pour laisser la place aux fondations.

`buildViewModel(levelData, spec)` assemble tout. `ViewSpec` décrit la demande (`type: 'elevation' | 'section'`, `dir`, `sectionId`, `cutValue`, `flip`) :

```ts
export function buildViewModel(levelData: LevelData[], spec: ViewSpec) {
  const cut = spec.type === 'section' ? makeCut(spec.sectionId, spec.cutValue, spec.flip) : null;
  const viewDir: Dir = cut ? cut.dir : spec.dir;
  const strips = buildStrips(levelData, cut, viewDir);
  return { cut, viewDir, strips, bounds: computeBounds(strips), levels: levelData.map(d => d.level) };
}
export type ViewModel = ReturnType<typeof buildViewModel>;
```
`ViewModel` est déduit du retour de la fonction (`ReturnType`) : on ne maintient pas deux déclarations qui pourraient diverger.

---

## 8. Le dessin : `ElevationDrawing`

Le composant dessine **en mm réels** dans un `<g>`, sans `viewBox` propre : c'est le parent qui fixe l'échelle. Règle d'axe : le SVG a Y vers le bas, l'altitude vers le haut, donc **`Y = −altitude`**.

Ordre de dessin :
1. **Terrain naturel** : rectangle hachuré sous `y = 0`, ligne de sol.
2. **Dalles** : une par niveau (`y={-z}`, épaisseur `slabT = 200`) plus une toiture-terrasse au sommet. En mode coupe elles reçoivent la hachure de section.
3. **Murs** : chaque bande est translatée par `translate(0 ${-s.z0})`, puis dessinée en `rect` de hauteur `s.height` vers le haut (`y={-s.height}`). Les `holes` sont repeints par-dessus avec la couleur de fond ; en façade, les fenêtres reçoivent un vitrage et un montant central, les portes un panneau.
4. **Cotes et niveaux** : traits pointillés par niveau (étiquette `RDC +0.00`), cote d'acrotère, cote de largeur totale.

Deux **palettes** coexistent via la prop `paper` : sombre pour l'écran, claire (traits noirs, fond blanc) pour l'impression. Les `id` des motifs (`views-cut-hatch-${id}`) dépendent de la palette (`screen` ou `paper`) pour que deux instances dans la même page n'entrent pas en collision.

Pourquoi des mm réels et pas des pixels ? Les hachures, épaisseurs de traits et textes s'expriment dans la même unité que la géométrie ; la mise en page n'a plus qu'à appliquer `scale(1/échelle)` (chapitre 15).

---

## 9. L'interface : `ViewsPanel`

Le panneau gère l'état local : `mode`, `dir`, `sectionId`, `cutY` (coupe AA, y plan), `cutX` (coupe BB, x plan), `flipSection`, `zoom`, `showDims`, `hiddenLevels`.

- **Façades** : quatre boutons (Face Sud, Arrière Nord, Droite Est, Gauche Ouest).
- **Coupes** : AA (longitudinale) et BB (transversale), un `<input type="range">` pour la position (bornes issues de la boîte englobante du plan), un bouton « Inverser le sens du regard ».
- **Mini-plan de situation** : un petit SVG qui montre les murs et, soit le trait mixte de la coupe avec sa flèche de regard, soit une flèche à l'extérieur du bâtiment pour la façade.
- **Niveaux affichés** : cases à cocher ; décocher un niveau le retire de `buildLevelData`.

Le `ViewModel` est mémoïsé :

```ts
const model = useMemo(
  () => buildViewModel(levelData, { type: mode, dir, sectionId,
        cutValue: sectionId === 'AA' ? cutY : cutX, flip: flipSection }),
  [levelData, mode, dir, sectionId, cutX, cutY, flipSection]
);
```
Déplacer le curseur recalcule la vue ; changer de zoom, non (le zoom ne touche que le `viewBox`). C'est le gain de `useMemo` vu au chapitre 11.

---

## ⚠️ Pièges classiques
- **Inverser un signe de `project`** : la façade apparaît en miroir. Test simple : le mur le plus à l'ouest doit apparaître à gauche en façade Sud.
- **Oublier que Y du plan est vers le bas** : « Nord en haut » implique que le Nord a des `y` petits.
- **Tri par profondeur moyenne** : un grand mur oblique devant un petit mur peut être mal classé. L'algorithme du peintre n'est exact que pour des cas simples.
- **Mélanger px plan et mm** : `project` multiplie par 10 ; `keepSide` et `Cut.value` restent en px plan.
- **Confondre `Y` écran et altitude** dans `ElevationDrawing` : toute altitude doit être passée avec un signe moins.
- **Toitures** : actuellement une simple dalle plate au sommet ; les pentes ne sont pas modélisées.

---

## ✍️ Exercices

### Exercice 1 — Nouveau libellé de regard
Dans quel cas `LOOK_LABEL` affiche-t-il « regard vers l'Est » ? Que vaut alors `cut.dir` ?

<details>
<summary>Indice</summary>
Cherchez la clé `O` dans `LOOK_LABEL` et la coupe BB inversée dans `makeCut`.
</details>

<details>
<summary>Solution</summary>
Pour la clé `O`. Une coupe BB avec `flip = true` donne `dir: 'O'` : l'observateur est à l'ouest du plan et regarde vers l'est.
</details>

### Exercice 2 — Ajouter une coupe CC oblique
Étendez `Cut` pour accepter un plan défini par un point et un angle.

<details>
<summary>Indices</summary>
- `keepSide` devient le produit scalaire `(P − P0) · n`, avec `n` la normale unitaire du plan.
- `project` doit utiliser la base orthonormée `(t, n)` au lieu des 4 cas figés ; `Dir` n'est plus suffisant.
- La section franche utilise déjà un `n` ; généralisez-le.
</details>

<details>
<summary>Solution succincte</summary>
Ajouter `axis: 'oblique'` avec `angle` et `px, py`. Calculer `n = (−sin a, cos a)` ; `keepSide = ((x−px)·nx + (y−py)·ny) × sign`. Projeter avec `u = x·cos a + y·sin a` (multiplié par 10) et `d = −(composante sur n)·10`. Le reste de `buildStrips` fonctionne inchangé car il ne dépend que de `keepSide` et `project`.
</details>

### Exercice 3 — Gérer une toiture à deux pentes
Comment dessiner un pignon triangulaire au-dessus des murs en façade ?

<details>
<summary>Indice</summary>
Ajoutez dans `ElevationDrawing` un `polygon` calé sur `bounds.maxZ` ; les murs pignons sont déjà dans `strips`.
</details>

<details>
<summary>Solution succincte</summary>
Après les dalles, dessiner un `polygon` à trois sommets : (`bounds.minU`, `-bounds.maxZ`), (milieu de `minU`/`maxU`, `-bounds.maxZ - hFaitage`) et (`bounds.maxU`, `-bounds.maxZ`). Pour une vraie donnée, ajouter `roof` (pente, sens du faîtage) dans `types.ts` et élargir `computeBounds` à `maxZ + hFaitage`.
</details>

---

## 📌 À retenir
- `project(dir, x, y)` ramène un point du plan à `(u, d)` ; `d` grandit vers le fond.
- Une coupe garde le côté où `keepSide > 0` ; les murs à cheval sont raccourcis par interpolation linéaire.
- La section franche est une bande à part (`cut: true`, `depth: -1e9`), hachurée au premier plan.
- Le tri `b.depth - a.depth` est l'algorithme du peintre : fond d'abord.
- `ElevationDrawing` dessine en mm réels avec `Y = −altitude` ; l'échelle appartient au parent.

---

⬅️ [Chapitre précédent](./chapitre_13_murs_ligne_reference_et_raccords.md) | [Sommaire](./README.md) | [Chapitre suivant ➡️](./chapitre_15_mise_en_page_et_texte.md)
