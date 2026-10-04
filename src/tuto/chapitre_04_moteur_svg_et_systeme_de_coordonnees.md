# Chapitre 04 — Moteur SVG & Système de Coordonnées (Écran vs Monde)

Un plan d'architecte est "infini" : on peut s'éloigner pour voir tout un lotissement ou s'approcher pour vérifier une feuillure de menuiserie. Dans ce chapitre, vous comprenez comment ARCKI CAD fabrique ce **canvas infini** (panoramique + zoom) et, surtout, comment il retrouve **quel point du plan** se trouve sous la souris.

## 🎯 Objectifs

- Distinguer le **repère écran** (pixels du navigateur) du **repère monde** (le plan, 1 px = 10 mm).
- Appliquer la formule de conversion écran → monde, avec Pan et Zoom.
- Comprendre pourquoi le zoom doit être "centré sur le curseur" et comment le Pan est recalculé.
- Savoir comment la grille 20 px / 100 px est dessinée avec des `<pattern>` SVG.
- Comprendre ce qui change quand on quitte l'onglet **Plan** (rail `activeRail`).

## 📋 Prérequis

- Chapitre 01 (React, `useState`, `useRef`, `useEffect`).
- Chapitre 03 (distances, vecteurs ; notion d'échelle).
- Savoir qu'une balise SVG (`<line>`, `<g>`, `<pattern>`) dessine des formes vectorielles dans le DOM.

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : états `canvasZoom`, `panOffset`, `canvasContainerRef`, `handleMouseMove`, `handleCanvasMouseDown`, zoom molette (dans un `useEffect`), `handleZoomIn` / `handleZoomOut` / `handleZoomReset`, grille `<pattern>`.
- [`src/types.ts`](../types.ts) : `CadEntity` (coordonnées `x1, y1, x2, y2` exprimées dans le repère monde).

---

## 1. Deux repères à ne jamais confondre

| Repère | Unité | Qui le fournit ? | Exemple |
|---|---|---|---|
| **Écran** | pixels du navigateur | `e.clientX`, `e.clientY` (moins le coin du canvas) | souris à (640, 380) |
| **Monde** (plan) | px CAO : **1 px = 10 mm** | calculé par nous | mur de 400 px = 4 000 mm = 4 m |

Échelle du projet : `10 px = 100 mm`, `100 px = 1 000 mm = 1 m`. Un mur de 4 m s'enregistre donc avec `x2 - x1 = 400` dans `CadEntity`, quel que soit le zoom d'affichage.

```
 Écran (0,0) ─────────────────────────────────────────────┐
   │   panOffset = (px, py)                               │
   │      ╲                                               │
   │       ● Origine du plan (0,0 monde)                  │
   │         │   zoom = 2  →  1 px monde = 2 px écran     │
   │         │       ┌──────────── mur 400 px ───┐        │
   │         │       ■━━━━━━━━━━━━━━━━━━━━━━━━━━━■        │
   └─────────────────────────────────────────────────────┘
```

Le **Pan** (`panOffset`) dit où se trouve l'origine du plan sur l'écran ; le **Zoom** (`canvasZoom`) dit combien de pixels écran vaut un pixel du plan.

### La formule (écran → monde)

$$\text{monde}_X = \frac{\text{écran}_X - \text{pan}_X}{\text{zoom}}\qquad \text{monde}_Y = \frac{\text{écran}_Y - \text{pan}_Y}{\text{zoom}}$$

où `écran` est mesuré **par rapport au coin haut-gauche du canvas** (`e.clientX - rect.left`), pas de la fenêtre.

## 2. Le code réel : états et conversion

Les états de la vue sont de simples `useState` dans `CadEditor` :

```tsx
const [canvasZoom, setCanvasZoom] = useState(1);
const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
const canvasContainerRef = useRef<HTMLDivElement>(null); // le <main> du canvas
```

La conversion se fait au début de `handleMouseMove` (extrait réel, légèrement abrégé) :

```tsx
const rect = canvasContainerRef.current.getBoundingClientRect();
const rawX = (e.clientX - rect.left - panOffset.x) / canvasZoom;
const rawY = (e.clientY - rect.top  - panOffset.y) / canvasZoom;
let x = Math.round(rawX);
let y = Math.round(rawY);
```

`rawX / rawY` sont les coordonnées **brutes** en repère monde. L'accrochage (chapitre 06) les transformera ensuite en `x, y` définitifs, stockés dans `cursorPos`.

**Pourquoi `useRef` ?** Le `ref` donne accès à l'élément DOM (pour `getBoundingClientRect`) sans provoquer de nouveau rendu quand il change. On n'utilise jamais `document.getElementById` : le composant reste autonome et testable.

## 3. Pan et Zoom appliqués : une seule transformation CSS

Plutôt que de recalculer les coordonnées de chaque mur à chaque zoom, ARCKI CAD applique **une transformation globale** sur le conteneur du plan (dans `CadEditor`, rendu du `<main>`) :

```tsx
<div
  className="absolute inset-0 overflow-visible"
  style={{
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${canvasZoom})`,
    transformOrigin: '0 0',
  }}
>
  <svg className="absolute inset-0 w-full h-full overflow-visible"> … grille, entités, curseur … </svg>
</div>
```

Les entités gardent donc **toujours leurs coordonnées monde** : c'est le navigateur qui les déplace/agrandit. Remarquez que la transformation est portée par un `<div>` HTML (pas par un `<g>` SVG) ; `transformOrigin: '0 0'` est indispensable pour que la formule du §1 soit exacte.

**Pourquoi ce choix ?** Une seule ligne de CSS suffit pour le zoom de 500 entités ; le modèle de données n'est jamais "pollué" par l'état de la vue.

### Panoramique (Pan)

Trois façons de déplacer la vue, toutes dans `handleCanvasMouseDown` / `handleMouseMove` :

- clic molette (`e.button === 1`), `Alt`+clic, ou touche `Espace` maintenue (`isSpaceHeld`), ou outil `pan` ;
- on mémorise `panStart = clic - panOffset` ;
- à chaque mouvement : `setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })`.

## 4. Zoom centré sur le curseur

Zoomer autour de l'origine ferait "fuir" le plan hors de l'écran. On veut que **le point du plan sous la souris reste immobile**. Principe :

1. calculer le point monde sous la souris **avant** le zoom ;
2. changer le zoom ;
3. recalculer `pan` pour que ce même point monde retombe sous la souris.

Extrait réel du gestionnaire `wheel` (un `useEffect` qui attache l'écouteur au conteneur) :

```tsx
const factor  = Math.exp(-e.deltaY * sensitivity);       // zoom exponentiel, plus fluide
const newZoom = Math.min(Math.max(currentZoom * factor, 0.1), 10);

const cadX = (mouseScreenX - currentPan.x) / currentZoom; // point monde sous la souris
const cadY = (mouseScreenY - currentPan.y) / currentZoom;

setCanvasZoom(newZoom);
setPanOffset({
  x: mouseScreenX - cadX * newZoom,   // le même point monde ...
  y: mouseScreenY - cadY * newZoom,   // ... retombe sous la souris
});
```

Détails professionnels du code réel :

- `sensitivity` vaut `0.0018` (molette) ou `0.015` (pincement, `e.ctrlKey` sur trackpad) ;
- un défilement horizontal pur est interprété comme **pan** au trackpad ;
- zoom borné entre `0.1` et `10` ;
- l'écouteur est ajouté avec `{ passive: false }` pour pouvoir appeler `e.preventDefault()` (sinon le navigateur fait défiler la page) ;
- l'écouteur étant monté **une seule fois** (`useEffect` avec `[]`), il lit le zoom et le pan via `canvasZoomRef` / `panOffsetRef`, des refs resynchronisées à chaque rendu. Sinon il verrait toujours les valeurs initiales (fermeture périmée, ou *stale closure*).

Les boutons `handleZoomIn` / `handleZoomOut` (facteur 1,25) appliquent la même idée, mais centrée sur le milieu du canvas ; `handleZoomReset` remet `zoom = 1` et `pan = (0,0)`.

## 5. La grille technique avec `<pattern>`

La grille est un motif SVG qui se répète à l'infini (coût quasi nul) :

- `cad-minor-grid` : 20 px (= 200 mm), pas d'accrochage par défaut ;
- `cad-major-grid` : 100 px (= 1 m), qui inclut le motif mineur ;
- les points sont verts quand l'accrochage grille (`settings.snapToGrid`) est actif, cyan sinon ; `settings.grid` règle l'opacité.

Version simplifiée de ce que contient `<defs>` :

```tsx
<pattern id="cad-minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0e2338" strokeWidth="0.5" />
  <circle cx="0" cy="0" r="1.15" fill="#4edea3" />
</pattern>
<pattern id="cad-major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
  <rect width="100" height="100" fill="url(#cad-minor-grid)" />
  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#163450" strokeWidth="1" />
</pattern>
```

`patternUnits="userSpaceOnUse"` fait vivre le motif **dans le repère monde** : la grille suit donc automatiquement Pan et Zoom, sans aucun calcul supplémentaire. C'est le même mécanisme que `wall-concrete-hatch` pour les hachures de béton (AGENTS.md, §2).

## 6. L'onglet du rail : le canvas n'est pas toujours le plan

L'état `activeRail` (`'plan' | 'views' | 'bim' | 'layout' | 'rendu' | 'config'`) décide **ce qui est rendu dans le `<main>`** :

| `activeRail` | Contenu du canvas | Outils actifs |
|---|---|---|
| `plan` | Plan 2D (transformation pan/zoom + SVG) | tous |
| `views` | composant `ViewsPanel` (élévations, coupes) | `select` seulement |
| `layout` | composant `LayoutPanel` (planches, échelle d'impression) | `select`, `text` |

Un `useEffect` surveille `activeRail` : si l'outil courant n'est pas autorisé dans le nouvel onglet, il retombe sur `select` et `draftStart` est remis à `null`. De même, le gestionnaire clavier ignore W/C/P/F… hors de l'onglet Plan (seuls `V`, et `T` en mise en page, restent actifs).

**Pourquoi ?** Les vues et la mise en page ont leur propre système de coordonnées (une planche A3 à l'échelle 1/50, par exemple) : laisser le dessin actif y corromprait le plan.

---

## ⚠️ Pièges classiques

- **Oublier `rect.left` / `rect.top`** : si la barre d'outils fait 64 px de large, tous les clics sont décalés de 64 px.
- **Appliquer le zoom sans ajuster le Pan** : le plan "glisse" sous la souris pendant le zoom.
- **Lire `canvasZoom` dans un écouteur natif attaché une seule fois** : valeur périmée. Utilisez une ref (`canvasZoomRef`).
- **Oublier `transformOrigin: '0 0'`** : le CSS zoome autour du centre, et la formule du §1 devient fausse.
- **Mélanger px écran et mm** : l'affichage multiplie par 10 (`x * 10`) pour obtenir des millimètres, jamais l'inverse dans les données.

## ✍️ Exercices

**Exercice 1 (calcul).** Avec `panOffset = (100, 50)` et `canvasZoom = 2`, la souris est à l'écran à (500, 250) par rapport au canvas. Quelle est la position monde, et à quelle distance réelle (mm) de l'origine ?
*Indice : appliquez la formule du §1 puis multipliez par 10.*

<details><summary>Solution</summary>

monde = ((500 − 100)/2, (250 − 50)/2) = (200, 100) px, soit (2 000 mm ; 1 000 mm), donc distance = √(2000² + 1000²) ≈ 2 236 mm.
</details>

**Exercice 2 (raisonnement).** Vous zoomez de 1 à 2 avec la souris à l'écran (300, 200) et `pan = (0, 0)`. Quel est le nouveau `pan` pour que le point sous la souris ne bouge pas ?
*Indice : calculez d'abord `cadX`, `cadY`.*

<details><summary>Solution</summary>

cad = (300, 200). nouveau pan = (300 − 300×2, 200 − 200×2) = (−300, −200).
</details>

**Exercice 3 (code).** Ajoutez un bouton "Zoom 1:1" qui centre l'origine du plan au milieu du canvas. 
*Indice : reprenez `handleZoomReset` et `canvasContainerRef.current.getBoundingClientRect()`.*

<details><summary>Solution</summary>

```tsx
const rect = canvasContainerRef.current!.getBoundingClientRect();
setCanvasZoom(1);
setPanOffset({ x: rect.width / 2, y: rect.height / 2 });
```
</details>

## 📌 À retenir

- Le plan est stocké en **repère monde** (1 px = 10 mm) ; l'écran n'est qu'une fenêtre dessus.
- `monde = (écran − pan) / zoom`, avec `écran` mesuré depuis le coin du canvas.
- Une seule transformation CSS (`translate` + `scale`, origine `0 0`) déplace tout le plan.
- Le zoom centré sur le curseur recalcule le Pan ; les refs évitent les valeurs périmées dans l'écouteur `wheel`.
- `activeRail` choisit ce qui est rendu et désactive les outils de dessin hors de l'onglet Plan.

---

⬅️ [Chapitre précédent](./chapitre_03_moteur_geometrique_mathematiques.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) ➡️
