# 08 — Commandes CLI, raccourcis clavier, exports

---

## 1. Ajouter une commande CLI

La barre de commande en bas (`ARCKI-CLI`) est un champ de texte traité par `handleCliSubmit` dans `CadEditor.tsx`.

```ts
const cmd = cliInput.trim().toUpperCase();          // ← la commande est en MAJUSCULES
const newHist = [...cliHistory, `ARCKI-CLI > ${cliInput}`];

if (cmd.startsWith('_WALL') || cmd === 'W') {
  setActiveTool('wall');
  setDraftStart(null);
  const parts = cmd.split(' ');
  if (parts[1] && !isNaN(Number(parts[1]))) setWallLength(Number(parts[1]));   // argument numérique
} else if (cmd === 'GRID' || cmd === '_GRID') {
  setSettings(s => ({ ...s, grid: !s.grid }));
  newHist.push(`Affichage grille ${…}`);
} …
else { newHist.push(`Commande validée: ${cmd}.`); }       // commande inconnue
```

### Recette
1. Ajouter une branche `else if (…)` **avant** le `else` final. Convention de nommage : `_NOM` (style AutoCAD) + alias court (`W`) + éventuellement le mot français.
2. Faire **la même action** que le bouton/raccourci correspondant (ne pas dupliquer la logique : appeler le même `setActiveTool`/handler).
3. Pousser un message explicite dans `newHist` (l'historique garde les 5 dernières lignes).
4. Mettre à jour le message de la commande `HELP`.

Les arguments se lisent avec `cmd.split(' ')` ; validez avec `Number()` / `isNaN`.

---

## 2. Ajouter un raccourci clavier

L'écouteur `handleKeyDown` est enregistré par un `useEffect` dont le tableau de dépendances **doit contenir** toutes les variables lues (dont `activeRail`).

### Ordre de traitement (haut → bas)
```
1. Focus dans INPUT / TEXTAREA / SELECT  → ignorer
2. activeRail !== 'plan'                 → seulement V (sélection) et T (texte en mise en page), puis return
3. Espace (sens de porte / panoramique)
4. + − 0 (zoom)       5. Entrée (valider)     6. Échap (annuler)
7. Suppr / Retour     8. Ctrl+D, Ctrl+Z (Maj = rétablir)
9. switch (touche) : V W C P F D H B A L R M T G F8 F9 …
```

### Recette
```ts
case 'n':                       // 1. minuscule
  setActiveTool('monOutil');    // 2. même action que le bouton
  setDraftStart(null);          // 3. réinitialiser les tracés en cours
  break;
```
Puis : afficher la lettre sur le bouton (`key: 'N'` dans le tableau d'outils), et mettre à jour le tableau des raccourcis dans `AGENTS.md` et le README.

⚠️ **Conflits** : vérifiez qu'une lettre n'est pas déjà prise (`Grep "case 'n'"`). `Ctrl+Y` n'est **pas** câblé pour rétablir (seulement `Ctrl+Maj+Z`) alors que la doc le mentionne : à corriger si vous touchez à ce bloc.

---

## 3. Les exports

Les exports sont **réels** (projet JSON, SVG, DXF R12, PDF par impression, rapport JSON, métrés CSV) : tout est décrit, avec la recette pour ajouter un format, dans le guide [11 — Projets, tableau de bord et exports](./11_projets_dashboard_et_exports.md).

Rappels communs à tout export : échelle 1 px = 10 mm ; DXF/DWG ont l'axe **Y inversé** ; respecter les calques visibles et les niveaux ; exporter les polygones de murs raccordés (`computeWallPolygons`) plutôt que de simples segments.

## ⚠️ Pièges classiques
- **Commande CLI qui duplique la logique du bouton** : elles divergent à la première évolution.
- **Raccourci actif dans la mise en page** : la garde `activeRail !== 'plan'` doit rester en tête de handler.
- **Export en px au lieu de mm**, ou avec Y non inversé (voir guide 11).

## ✍️ Exercice
Ajoutez la commande CLI `_EXPORT DXF` qui ouvre la fenêtre d'export déjà positionnée sur le format DXF (indice : un état `initialFormat` passé à `ExportModal`, et la branche correspondante dans `handleCliSubmit`).

⬅️ [07 — Calques, matériaux, bibliothèque](./07_calques_materiaux_bibliotheque.md) | [Index](./README.md) | [09 — Vérifier, tester, conventions ➡️](./09_verifier_tester_conventions.md)
