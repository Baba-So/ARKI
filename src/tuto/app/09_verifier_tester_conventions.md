# 09 — Vérifier, tester, conventions

## 1. Les commandes

| Commande | À quoi ça sert |
|---|---|
| `npm run dev` | Serveur de développement (http://localhost:3000, rechargement à chaud) |
| `npm run lint` | `tsc --noEmit` : **vérification TypeScript**, la seule vérification automatique du projet |
| `npm run build` | Build de production (`vite build`) — détecte aussi les erreurs d'import |

Il n'y a **pas de tests automatisés** : la vérification repose sur `lint` + un **test manuel systématique**.

## 2. La check-list de test manuel (à adapter)

**Toute fonctionnalité de dessin**
- [ ] Création, aperçu fantôme identique au résultat.
- [ ] Sélection (clic, rectangle), déplacement, suppression.
- [ ] Annuler / rétablir (`Ctrl+Z` / `Ctrl+Maj+Z`).
- [ ] Calque masqué → invisible ; calque verrouillé → non modifiable.
- [ ] Changement de **niveau** puis retour : l'objet est toujours là, et absent de l'autre niveau.
- [ ] Apparition correcte dans **Vues** (si pertinent) et **Mise en page** (cadre de plan).
- [ ] `Échap` annule un tracé en cours.

**Toute fonctionnalité d'interface**
- [ ] Les boutons sont **grisés** dans les onglets où ils n'ont pas de sens.
- [ ] Les raccourcis ne se déclenchent pas pendant la saisie dans un champ.
- [ ] Changer d'onglet puis revenir conserve l'état important (planches, niveaux).
- [ ] Aucune erreur dans la console du navigateur.

**Règle d'encastrement** (si vous touchez aux menuiseries ou aux murs)
- [ ] Une porte/fenêtre posée **suit** son mur ; déplacer le mur ne la laisse pas flotter.
- [ ] Changer l'épaisseur ou la ligne de référence d'un mur déplace aussi ses ouvertures.

## 3. Déboguer

| Symptôme | Piste |
|---|---|
| Le raccourci/outil réagit « avec retard » ou garde une ancienne valeur | Variable manquante dans le tableau de dépendances du `useEffect` du clavier |
| Un objet se crée mais disparaît au changement de niveau | Il a été ajouté hors de `entities` (le niveau actif) |
| Le rendu est faux seulement à l'impression | Dimension non divisée par `k` (mm papier par px plan) dans `PlanDrawing` |
| Murs qui ne se raccordent pas | Angle < ~10° (parallèles), ou extrémités trop éloignées (voir `computeWallPolygons`) |
| Façade vide | Calque `structures` masqué, ou murs sans `height` (défaut = hauteur du niveau) |
| Ctrl+Z ne défait rien | `recordHistory()` oublié avant `setEntities` |
| Lag pendant un glisser | État partagé mis à jour à chaque `mousemove` → brouillon local |

Outils : onglet *Console* du navigateur, *React DevTools*, et l'inspecteur SVG (l'attribut `data-entity-id` identifie chaque entité).

## 4. Conventions du projet

### Code
- **Typage rigoureux** : le `tsconfig.json` n'active pas `"strict": true` (voir chapitre 01), donc le compilateur est indulgent — évitez quand même `any` et `!` gratuits ; unions discriminées pour les types d'entité.
- Imports **avec extension** (`'./types.ts'`) — exigé par `allowImportingTsExtensions`.
- **Immutabilité** : `setEntities(prev => prev.map(…))`, jamais de mutation.
- **Fonctions pures** dans `src/*Geometry.ts` pour tout calcul géométrique réutilisable ; pas de JSX dedans.
- Commentaires en **français**, courts, qui expliquent le *pourquoi*.
- Unités documentées à côté du champ (`// mm`, `// px plan`).

### Interface
- Thème sombre technique ; typographies `Inter` et `JetBrains Mono`.
- Réutiliser les classes d'un composant voisin ; icônes **Material Symbols**.
- Un contrôle indisponible est **grisé** (jamais masqué sans raison) avec une infobulle.

### Règles métier (non négociables)
1. Une ouverture est **toujours** encastrée dans un mur hôte (`findWallSnap`, `hostWallId`).
2. Échelle : **1 px = 10 mm**.
3. Les cinq calques normalisés (`structures`, `cloisons`, `ouvertures`, `mobilier`, `cotations`).
4. `entities` = niveau actif uniquement.

## 5. Avant de dire « c'est fini »
```
□ npm run lint            → 0 erreur
□ npm run build           → OK
□ test manuel (§2)        → fait
□ doc mise à jour         → AGENTS.md / README / CLAUDE.md / ce dossier si le comportement change
□ commit atomique         → un sujet par commit, message clair
```

## 6. Où mettre à jour la documentation ?
| Si vous avez changé… | Mettez à jour |
|---|---|
| Un raccourci | tableau de `AGENTS.md` et du `README.md` racine |
| L'architecture / un état global | `CLAUDE.md`, [01](./01_architecture_de_l_application.md) |
| Un concept expliqué dans un chapitre | le chapitre concerné (`../chapitre_*.md`) |
| Une recette d'extension | le guide correspondant de ce dossier |

⬅️ [08 — Commandes, raccourcis, exports](./08_commandes_raccourcis_exports.md) | [Index](./README.md)

➡️ Suite : [10 — Blocs : vues, import et prompt IA](./10_blocs_vues_import_et_prompt_ia.md)
