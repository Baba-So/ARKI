# 🎓 ARCKI CAD — Cours & Guides

## Apprendre React & TypeScript en construisant un studio CAO d'architecture 2D

Ce dossier contient **deux parcours complémentaires** :

| Parcours | Question à laquelle il répond | Où |
|---|---|---|
| 📚 **Le cours** (15 chapitres) | *Comment ça marche ?* — concepts, algorithmes, code expliqué | ci-dessous |
| 🧩 **Les guides d'extension** (11 recettes) | *Comment j'ajoute un outil, un paramètre, un onglet… ?* | [`app/`](./app/README.md) |

Objectif double : **(1)** maîtriser React 19 et TypeScript sur un projet concret et graphique ; **(2)** comprendre un logiciel de CAO 2D vectoriel paramétrique (murs, ouvertures encastrées, niveaux, façades, coupes, mise en page).

---

## 🧭 Comment suivre ce cours ?

```
Débutant React/TS  → chapitres 01 → 15 dans l'ordre, exercices compris
Je connais React   → 02, 03, 05, puis 07 → 15
Je veux modifier l'app → 🧩 app/ directement, et les chapitres cités en renvoi
```

Chaque chapitre suit la même structure : **🎯 Objectifs → 📋 Prérequis → 📁 Fichiers concernés → sections expliquées → ⚠️ Pièges → ✍️ Exercices → 📌 À retenir**.

---

## 📚 Table des matières

### Partie A — Les fondations
| # | Chapitre | Notions clés |
|---|---|---|
| 01 | [Fondations : Vite, React 19 & TypeScript](./chapitre_01_fondations_react_ts_vite.md) | TSX, `tsconfig`, Vite, Tailwind v4, vérification de types (`npm run lint`) |
| 02 | [Modélisation des données](./chapitre_02_modelisation_donnees_typescript.md) | unions discriminées, `CadEntity`, `CadLevel`, `LayoutSheet`, immuabilité |
| 03 | [Moteur mathématique & géométrie 2D](./chapitre_03_moteur_geometrique_mathematiques.md) | fonctions pures, distance point-segment, Shoelace, `wallGeometry`, `viewsGeometry` |

### Partie B — Le plan interactif
| # | Chapitre | Notions clés |
|---|---|---|
| 04 | [Moteur SVG & coordonnées](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md) | monde vs écran, pan/zoom, grille, onglets du rail |
| 05 | [État, événements & cycle de tracé](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) | `useState`, `draftStart`, historique annuler/rétablir, niveaux |
| 06 | [Accrochage magnétique (OSNAP)](./chapitre_06_aimantation_intelligente_osnap.md) | grille, points d'accroche, orthogonalité |
| 07 | [Outils & sous-outils paramétriques](./chapitre_07_outils_et_sous_outils_parametriques.md) | murs, formes, tracés, texte, ligne de référence |
| 08 | [Encastrement des menuiseries](./chapitre_08_encastrement_des_menuiseries.md) | `findWallSnap`, masques SVG, glissement le long du mur |

### Partie C — Interface et organisation
| # | Chapitre | Notions clés |
|---|---|---|
| 09 | [Inspecteur, calques & niveaux (UI)](./chapitre_09_inspecteur_proprietes_et_calques.md) | *lifting state up*, formulaires contrôlés, `LayerManager`, `LevelManager` |
| 10 | [Export DXF & SVG](./chapitre_10_moteur_export_dxf_autocad_et_svg.md) | génération de texte, `Blob`, format DXF |
| 11 | [Performance & bonnes pratiques](./chapitre_11_performance_et_deploiement.md) | `memo`, `useMemo`, brouillon local, build Vite |

### Partie D — Fonctions avancées du studio
| # | Chapitre | Notions clés |
|---|---|---|
| 12 | [Gestion des niveaux](./chapitre_12_gestion_des_niveaux.md) | RDC / R+1 / sous-sol, échange d'état, duplication |
| 13 | [Murs : ligne de référence & raccords](./chapitre_13_murs_ligne_reference_et_raccords.md) | axe stocké, onglets, tés, rendu continu |
| 14 | [Façades & coupes](./chapitre_14_facades_et_coupes.md) | projection, plan de coupe, algorithme du peintre |
| 15 | [Mise en page & texte](./chapitre_15_mise_en_page_et_texte.md) | planches, échelle, cadres de vue, impression |

### 🧩 Guides d'extension — [`app/`](./app/README.md)
[Architecture](./app/01_architecture_de_l_application.md) · [Créer un outil](./app/02_creer_un_outil.md) · [Créer un type d'entité](./app/03_creer_un_type_d_entite.md) · [Créer un paramètre](./app/04_creer_un_parametre.md) · [Créer un onglet](./app/05_creer_un_onglet.md) · [Inspecteur & panneaux](./app/06_inspecteur_et_panneaux.md) · [Calques, matériaux, bibliothèque](./app/07_calques_materiaux_bibliotheque.md) · [Commandes, raccourcis, exports](./app/08_commandes_raccourcis_exports.md) · [Vérifier, tester, conventions](./app/09_verifier_tester_conventions.md) · [Blocs : vues, import, prompt IA](./app/10_blocs_vues_import_et_prompt_ia.md) · [Projets, tableau de bord, exports](./app/11_projets_dashboard_et_exports.md)

---

## 🛠️ Prérequis recommandés
- JavaScript moderne (ES6+ : `const`/`let`, fonctions fléchées, déstructuration, spread).
- Node.js 18+ et un éditeur avec TypeScript activé (VS Code, Cursor).
- Lancer le projet : `npm install` puis `npm run dev` (http://localhost:3000). Vérifier les types : `npm run lint`.

## 📐 Repères à connaître d'emblée
- **Échelle** : 1 px plan = 10 mm.
- **Règle d'or** : une porte ou fenêtre est toujours encastrée dans un mur hôte.
- **État** : `entities` = niveau actif uniquement.

---

👉 **Commencez par le [Chapitre 01](./chapitre_01_fondations_react_ts_vite.md)**, ou allez directement aux [guides d'extension](./app/README.md).
