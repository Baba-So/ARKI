# 02 — Créer un outil

Un **outil** est un mode d'interaction : tant qu'il est actif, les clics sur le plan ont un sens particulier (poser un mur, mesurer, écrire un texte…).
Ce guide suit l'outil **Texte** (`'text'`, touche `T`), réellement présent dans le code, comme exemple fil rouge.

> 🧭 Anatomie d'un outil : **un identifiant** (`CadTool`) + **un bouton** + **un raccourci** + **un comportement au clic** + *(optionnel)* **un aperçu fantôme** + **une disponibilité par onglet**.

---

## ✅ Check-list

| # | Étape | Fichier | Recherche (Grep) |
|---|---|---|---|
| 1 | Déclarer l'identifiant | `src/types.ts` | `export type CadTool` |
| 2 | Ajouter le bouton | `CadEditor.tsx` | `Compact CAD Drafting Tools Strip` |
| 3 | Dire dans quels onglets il est actif | `CadEditor.tsx` | `const enabled =` et `allowed` |
| 4 | Ajouter le raccourci clavier | `CadEditor.tsx` | `// Tool keys` |
| 5 | Ajouter la commande CLI *(facultatif)* | `CadEditor.tsx` | `handleCliSubmit` |
| 6 | Écrire le comportement au clic | `CadEditor.tsx` | `handleCanvasClick` |
| 7 | Ajouter l'aperçu fantôme *(facultatif)* | `CadEditor.tsx` | `LIVE DRAFTING GHOST` |
| 8 | Barre de paramètres contextuelle *(facultatif)* | `CadEditor.tsx` | `TOP CONTEXTUAL SUB-TOOLBAR` |
| 9 | `npm run lint` + test manuel | — | — |

---

## Étape 1 — Déclarer l'identifiant

```ts
// src/types.ts
export type CadTool =
  | 'select' | 'pan' | 'wall' | 'partition' | 'door' | 'window'
  | 'dim' | 'hatch' | 'room' | 'polyline' | 'rect' | 'circle'
  | 'arc' | 'cut' | 'measure'
  | 'text';              // ← NOUVEAU
```

Dès cette ligne, TypeScript signale partout où un `CadTool` est traité exhaustivement. Suivez les erreurs.

## Étape 2 — Le bouton dans la bande d'outils

La bande est un **tableau d'objets** parcouru par un `.map` :

```tsx
{ id: 'text', icon: 'title', key: 'T',
  title: activeRail === 'layout' ? 'Texte sur la planche (T)' : 'Texte / annotation sur le plan (T)' },
```

| Champ | Signification |
|---|---|
| `id` | Doit être un `CadTool` |
| `icon` | Nom d'une icône **Material Symbols** (https://fonts.google.com/icons) |
| `key` | Lettre affichée dans le coin du bouton (informatif) |
| `title` | Infobulle |
| `hasSub: true` | Ajoute un menu de sous-outils (clic droit / flèche ▾), voir « Sous-outils » plus bas |

## Étape 3 — Disponibilité selon l'onglet

Un outil n'a de sens que dans certains onglets. Deux endroits à tenir synchronisés :

```tsx
// (a) grisage du bouton, dans le .map de la bande d'outils
const enabled = activeRail === 'plan'
  || (activeRail === 'layout' ? ['select', 'text'] : ['select']).includes(t.id);
// <button disabled={!enabled} …>

// (b) repli automatique sur « Sélection » quand on change d'onglet
useEffect(() => {
  const allowed = activeRail === 'plan' ? null
                : activeRail === 'layout' ? ['select', 'text'] : ['select'];
  if (allowed && !allowed.includes(activeTool)) { setActiveTool('select'); setDraftStart(null); }
}, [activeRail]);
```

| Onglet | Outils disponibles |
|---|---|
| Plan | tous |
| Vues | `select` |
| Mise en page | `select`, `text` |

> Si votre outil doit aussi exister dans « Mise en page » ou « Vues », ajoutez son `id` dans **les deux** listes (a) et (b), et dans la garde clavier de l'étape 4.

## Étape 4 — Le raccourci clavier

Dans l'écouteur `handleKeyDown` :

```ts
// Hors onglet Plan : seuls V et T restent actifs
if (activeRail !== 'plan') {
  const k = e.key.toLowerCase();
  if (k === 'v' && !e.ctrlKey && !e.metaKey) setActiveTool('select');
  else if (k === 't' && activeRail === 'layout') setActiveTool('text');
  return;                       // ← on ignore tout le reste (Suppr, Ctrl+D…)
}
…
switch (e.key.toLowerCase()) {
  …
  case 't': setActiveTool('text'); setDraftStart(null); break;
}
```

⚠️ Cet écouteur est enregistré dans un `useEffect` avec un **tableau de dépendances** : toute variable lue dans le handler (ici `activeRail`) doit y figurer, sinon le handler lit une **valeur périmée**.

## Étape 5 — Commande CLI (facultatif)

Dans `handleCliSubmit`, ajouter une branche :

```ts
} else if (cmd.startsWith('_TEXT') || cmd === 'T') {
  setActiveTool('text');
  newHist.push('Outil TEXTE activé (T). Cliquez sur le plan.');
}
```
Voir aussi le guide [08](./08_commandes_raccourcis_exports.md).

## Étape 6 — Le comportement au clic

Dans `handleCanvasClick`, **avant** les autres outils :

```ts
if (activeTool === 'text') {
  const l = getLayer('cotations');
  if (l.locked) { alert('Le calque Cotations est verrouillé.'); return; }   // ① respecter le verrouillage
  const content = window.prompt('Texte à insérer sur le plan :', 'Texte');
  if (content === null || content.trim() === '') return;                    // ② annulation propre
  const newText: CadEntity = {
    id: `text-${Date.now()}`, name: `Texte « ${content.slice(0, 24)} »`,
    type: 'text', layerId: 'cotations',
    x1: cursorPos.x, y1: cursorPos.y,                                       // ③ coordonnées PLAN (déjà snappées)
    x2: …, y2: …, label: content, fontSize: 14,
  };
  recordHistory();                                                          // ④ annulable
  setEntities(prev => [...prev, newText]);                                  // ⑤ immutabilité
  setSelectedIds([newText.id]);
  setActiveTool('select');                                                  // ⑥ outil « one-shot »
  if (autoOpenPropsOnSelect) setRightDockTab('props');
  return;
}
```

Les six réflexes à avoir pour **tout** outil créateur : ① calque verrouillé ? ② entrée invalide ? ③ utiliser `cursorPos` (déjà converti écran→plan et aimanté, voir chapitres 04 et 06) ④ `recordHistory()` ⑤ `setEntities(prev => …)` ⑥ décider si l'outil reste actif (mur continu) ou retombe sur la sélection.

### Outils en deux clics (ou plus)
Le motif standard est **`draftStart`** :

```ts
if (!draftStart) { setDraftStart({ x: cursorPos.x, y: cursorPos.y }); return; }   // 1er clic
… créer l'entité de draftStart → cursorPos …                                       // 2e clic
setDraftStart(null);
```
Annuler avec `Échap` est déjà géré globalement (`setDraftStart(null)`).

## Étape 7 — L'aperçu fantôme

Pendant le tracé, le SVG affiche un élément **non interactif** (`pointer-events-none`) calculé depuis `draftStart` et `cursorPos`, dans le bloc `LIVE DRAFTING GHOST RUBBER-BAND` :

```tsx
{draftStart && activeTool === 'monOutil' && (
  <line x1={draftStart.x} y1={draftStart.y} x2={cursorPos.x} y2={cursorPos.y}
        stroke="#4cd7f6" strokeDasharray="4 3" />
)}
```
Astuce : l'aperçu doit utiliser **exactement la même fonction de calcul** que la création (ex. `placeWall(...)` pour les murs), sinon l'aperçu « ment » sur le résultat.

## Étape 8 — Paramètres contextuels de l'outil
La barre du haut (`TOP CONTEXTUAL SUB-TOOLBAR`) affiche, selon `activeTool`, des champs (épaisseur, hauteur, ligne de référence…). Voir le guide [04 — Créer un paramètre](./04_creer_un_parametre.md).

---

## 🔽 Sous-outils (menu ▾)
Un outil peut avoir des variantes (Mur : droit / continu / 4 murs) :
1. Un état `monSubTool` (`useState<'a' | 'b'>`), et un type `…SubTool` dans `types.ts`.
2. `hasSub: true` dans l'entrée du tableau d'outils + l'icône dépend du sous-outil.
3. Une entrée dans le menu `Subtools Flyout Menu`.
4. `handleCanvasClick` lit `monSubTool` pour choisir le comportement.

## ⚠️ Pièges classiques
- **Oublier `recordHistory()`** → Ctrl+Z n'annule pas l'ajout.
- **Lire `activeTool` dans un `useEffect`/handler sans le mettre dans les dépendances** → comportement figé.
- **Créer une ouverture (porte/fenêtre) sans `findWallSnap`** → viole la règle d'encastrement.
- **Utiliser les coordonnées de la souris brutes** au lieu de `cursorPos`.
- **Ne pas penser aux autres onglets** : l'outil doit être grisé là où il n'a pas de sens.

## ✍️ Exercice
Ajoutez un outil **« Repère de niveau »** (`'levelmark'`, touche `N`) : un clic pose un petit texte `+0.00` (ou l'altitude du niveau actif) sur le calque `cotations`.
<details><summary>Indice</summary>

Réutilisez le type d'entité `'text'` (aucun nouveau type nécessaire) : même code que l'outil Texte, mais `label` = `` `${activeLevel.elevation >= 0 ? '+' : '−'}${(Math.abs(activeLevel.elevation) / 1000).toFixed(2)}` `` sans `window.prompt`.
</details>

⬅️ [01 — Architecture](./01_architecture_de_l_application.md) | [Index](./README.md) | [03 — Créer un type d'entité ➡️](./03_creer_un_type_d_entite.md)
