# Chapitre 05 — Gestion d'État & Cycle de Dessin

Quand vous tracez un mur, trois choses se passent : un premier clic fixe le départ, un "fantôme" suit la souris, un second clic crée le mur. Ce chapitre explique cette **machine à états**, l'immuabilité qui la rend fiable, l'historique Annuler/Rétablir, et la gestion des **niveaux** (RDC, R+1…).

## 🎯 Objectifs

- Expliquer pourquoi React exige des mises à jour **immuables** de `entities`.
- Décrire le cycle de tracé en deux clics (`draftStart`, `cursorPos`, `handleCanvasClick`).
- Comprendre la ligne de référence des murs (`placeWall`) et le chaînage.
- Maîtriser l'historique (`recordHistory`, `handleUndo`, `handleRedo`) et sa règle d'or.
- Comprendre que `entities` ne contient que le niveau actif (`otherLevels`, `gotoLevel`).

## 📋 Prérequis

- Chapitre 02 (type `CadEntity`, `CadTool`).
- Chapitre 04 (`cursorPos` est exprimé en repère monde, 1 px = 10 mm).
- `useState` et mises à jour fonctionnelles (`setX(prev => …)`).

## 📁 Fichiers concernés

- [`src/components/CadEditor.tsx`](../components/CadEditor.tsx) : `entities`, `draftStart`, `cursorPos`, `activeTool`, `handleMouseMove`, `handleCanvasClick`, `placeWall`, `recordHistory`, `handleUndo`, `handleRedo`, `gotoLevel`.
- [`src/wallGeometry.ts`](../wallGeometry.ts) : `justifToRef`, `refToCenterline`, `refSign`.
- [`src/types.ts`](../types.ts) : `CadEntity`, `CadTool`, `CadLevel`.

---

## 1. L'immuabilité : règle d'or de React

React décide de redessiner en comparant les **références** des objets. Modifier un tableau en place ne change pas sa référence :

```ts
// ❌ React ne voit rien : même tableau, même référence
entities.push(newWall);

// ✅ Nouveau tableau : React redessine
setEntities(prev => [...prev, newWall]);
```

C'est exactement la forme utilisée partout dans `CadEditor` (ajout, suppression `prev.filter(...)`, modification `prev.map(...)`). Elle sert aussi à l'historique : conserver l'ancien tableau est gratuit, car on ne l'a jamais modifié.

## 2. La machine à états du tracé

L'état d'un tracé se résume à trois variables :

| État React | Rôle |
|---|---|
| `activeTool` (`CadTool`) | outil courant : `'select'`, `'wall'`, `'partition'`, `'door'`, `'text'`… |
| `draftStart` | point P1 déjà posé (`{x, y}`), ou `null` si rien n'est en cours |
| `cursorPos` | position monde (déjà accrochée) de la souris, mise à jour dans `handleMouseMove` |

```
draftStart === null ── clic ──► draftStart = P1
                                   │  handleMouseMove met à jour cursorPos
                                   │  → rendu fantôme P1 → cursorPos
                                   ▼
                     second clic ──► crée le mur, recordHistory()
                                   │
              chaînage actif ? ── oui ──► draftStart = P2 (on enchaîne)
                               └─ non ──► draftStart = null
```

`Entrée` (ou `Échap`) termine une chaîne : le gestionnaire clavier fait `setDraftStart(null)`.

### Code réel du second clic (outil mur, sous-outil `single`/`continuous`)

Extrait abrégé de `handleCanvasClick` :

```tsx
const lengthMm = Math.round(Math.hypot(cursorPos.x - draftStart.x, cursorPos.y - draftStart.y) * 10);
if (lengthMm < 30) return; // clic parasite : trait trop court ignoré

const newWall: CadEntity = {
  id: `wall-${Date.now()}`,
  name: `Mur Extérieur L=${lengthMm}mm`,
  type: 'wall',
  layerId: 'structures',
  ...placeWall(draftStart.x, draftStart.y, cursorPos.x, cursorPos.y, wallThickness),
  thickness: wallThickness,
  height: wallHeight,
};
recordHistory();                          // 1) on photographie l'état AVANT
setEntities(prev => [...prev, newWall]);  // 2) puis on modifie
setSelectedIds([newWall.id]);

if (wallSubTool === 'continuous' || chaining) setDraftStart({ x: cursorPos.x, y: cursorPos.y });
else setDraftStart(null);
```

L'ordre compte : `recordHistory()` **avant** `setEntities`. Le fantôme, lui, est simplement du JSX qui lit `draftStart` et `cursorPos` : pas de logique spéciale, il disparaît quand `draftStart` redevient `null`.

Autres outils sur le même schéma : `partition` (cloison), rectangle (`rect` : le second clic crée 4 murs d'un coup), cotation, mesure (`measureStart`). Le détail des sous-outils est au chapitre 07.

## 3. La ligne de référence des murs (`placeWall`)

Un mur est stocké par son **axe** (`x1,y1 → x2,y2`). Mais l'architecte trace souvent le **nu** d'un mur (la face visible) : l'axe est alors décalé d'une demi-épaisseur. La fonction `placeWall` fait cette conversion :

```tsx
const placeWall = (x1, y1, x2, y2, thicknessMm) => {
  const ref = justifToRef(wallJustif);                 // 'Nu Gauche' | 'Axe' | 'Nu Droite'
  const c = refToCenterline(x1, y1, x2, y2, thicknessMm, ref);
  return { ...c, refLine: ref };                       // on garde la ligne de référence choisie
};
```

(Signature simplifiée ; les types des paramètres sont `number`.) Exemple : un mur de 200 mm tracé en `Nu Gauche` décale l'axe de 100 mm = **10 px** sur la normale du tracé (`(refSign × épaisseur) / 20`, car 1 px = 10 mm). La ligne que vous avez cliquée reste fixe dans le plan ; seul le corps du mur se place d'un côté ou de l'autre. Le champ `refLine` de `CadEntity` permet de le retrouver dans l'inspecteur.

## 4. L'historique Annuler / Rétablir

ARCKI CAD garde deux piles de **photographies du tableau `entities`** (pas de JSON, pas de copie profonde, grâce à l'immuabilité) :

```tsx
const [historyStack, setHistoryStack] = useState<CadEntity[][]>([]);
const [redoStack,    setRedoStack]    = useState<CadEntity[][]>([]);

const recordHistory = () => {
  setHistoryStack(prev => [...prev.slice(-15), entities]); // 15 niveaux d'annulation max
  setRedoStack([]);                                        // une nouvelle action invalide le "rétablir"
};

const handleUndo = () => {
  if (historyStack.length === 0) return;
  const previous = historyStack[historyStack.length - 1];
  setRedoStack(prev => [...prev, entities]);
  setHistoryStack(prev => prev.slice(0, -1));
  setEntities(previous);
  setSelectedIds([]);
};
```

`handleRedo` est symétrique. Raccourcis dans le gestionnaire clavier : `Ctrl+Z` annule, `Ctrl+Shift+Z` rétablit (les boutons de la barre d'outils sont désactivés si la pile est vide **ou** si `activeRail !== 'plan'`).

> Note : `AGENTS.md` mentionne aussi `Ctrl+Y` ; dans le gestionnaire clavier actuel seul `Ctrl+Shift+Z` est géré. Vérifiez le code avant de l'affirmer à un utilisateur.

## 5. Les niveaux : `entities` ne contient que l'étage actif

Un bâtiment a plusieurs niveaux. Pour ne pas réécrire tout le code de dessin, l'éditeur applique une astuce :

- `entities` = **uniquement** les entités du niveau actif ;
- `otherLevels: Record<string, CadEntity[]>` = les entités de tous les **autres** niveaux ;
- `entitiesByLevel = { ...otherLevels, [activeLevelId]: entities }` reconstitue la vue complète (utilisée par `ViewsPanel`, `LayoutPanel`, les statistiques) ;
- le niveau situé juste en dessous (`belowLevel`) est affiché en fond estompé (`ghostEntities`, murs et cloisons à 22 % d'opacité) pour caler les murs d'un étage sur ceux du dessous.

Changer de niveau = **échange** entre `entities` et `otherLevels` :

```tsx
const gotoLevel = (id: string, data: Record<string, CadEntity[]>, lvls: CadLevel[]) => {
  const { [id]: target = [], ...rest } = data;
  setOtherLevels(rest);          // tous les autres niveaux
  setEntities(target);           // le niveau choisi devient "entities"
  setActiveLevelId(id);
  setSelectedIds([]);
  setHistoryStack([]);           // l'historique est remis à zéro !
  setRedoStack([]);
  …
};
```

**Pourquoi remettre l'historique à zéro ?** Les photographies contiennent des entités d'un autre étage : annuler après un changement de niveau remplacerait le R+1 par un plan de RDC. C'est un choix de sécurité ; en contrepartie, on perd les annulations en changeant d'étage.

---

## ⚠️ Pièges classiques

- **Muter l'état** (`entities.push`, `ent.x1 = …` sur un objet de l'état) : l'écran ne se met pas à jour, et l'historique est corrompu (les piles pointent vers le même objet).
- **Appeler `recordHistory()` après `setEntities`** : ce n'est pas faux en pratique (l'état lu est celui du rendu courant), mais c'est fragile ; gardez toujours l'ordre "photographie puis modification".
- **Oublier `recordHistory()` dans un nouvel outil** : l'action devient non annulable.
- **Lire `entities` hors du niveau actif** : `entities` ne contient que l'étage courant ; utilisez `entitiesByLevel` pour un calcul multi-niveaux.
- **Laisser `draftStart` non nul en changeant d'onglet** : le `useEffect` sur `activeRail` le remet à `null`, pensez-y si vous ajoutez un onglet.

## ✍️ Exercices

**Exercice 1.** Dans quel cas un second clic ne crée-t-il aucun mur ? Que devient `draftStart` ?
*Indice : cherchez `lengthMm < 30`.*

<details><summary>Solution</summary>

Si la longueur est inférieure à 30 mm, la fonction fait `return` : aucun mur n'est créé et `draftStart` reste inchangé (le tracé en cours continue).
</details>

**Exercice 2.** Vous dessinez 3 murs, annulez 2 fois, puis dessinez un 4e mur. Combien de murs voyez-vous, et que contient `redoStack` ?
*Indice : que fait `recordHistory` de `redoStack` ?*

<details><summary>Solution</summary>

2 murs (1er + nouveau) ; `redoStack` est vide car `recordHistory` le vide à chaque nouvelle action.
</details>

**Exercice 3.** Vous passez du RDC au R+1 avec `gotoLevel`, puis appuyez sur `Ctrl+Z`. Que se passe-t-il, et pourquoi ?
*Indice : regardez les `setHistoryStack([])` dans `gotoLevel`.*

<details><summary>Solution</summary>

Rien : `historyStack` est vide, `handleUndo` sort immédiatement. C'est voulu : l'historique ne traverse pas les niveaux.
</details>

## 📌 À retenir

- Toute modification de `entities` passe par `setEntities(prev => nouveau tableau)`.
- Le tracé = `activeTool` + `draftStart` + `cursorPos` ; le fantôme est du JSX qui lit ces états.
- `placeWall` convertit la ligne de référence choisie (nu gauche / axe / nu droit) en axe réel.
- `recordHistory()` d'abord, modification ensuite ; 15 annulations, redo vidé à chaque action.
- `entities` = niveau actif seulement ; `gotoLevel` échange avec `otherLevels` et vide l'historique.

---

⬅️ [Chapitre précédent](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md) | [Sommaire](./README.md) | [Chapitre suivant](./chapitre_06_aimantation_intelligente_osnap.md) ➡️
