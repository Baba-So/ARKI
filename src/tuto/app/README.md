# 🧩 Guide d'extension de l'application ARCKI CAD

Les chapitres du dossier parent (`../README.md`) expliquent **comment le moteur fonctionne**.
Ce dossier `app/` répond à une autre question : **« Je veux ajouter X à l'application, par où commencer ? »**

Chaque guide est une **recette pas à pas** : fichiers à toucher, ordre des modifications, extraits de code réels, check-list de vérification et pièges à éviter.

---

## 🗺️ Je veux… → je lis…

| Je veux ajouter… | Guide |
|---|---|
| Comprendre où est quoi avant de toucher au code | [01 — Architecture de l'application](./01_architecture_de_l_application.md) |
| Un **outil** de dessin (bouton, raccourci, clics, aperçu) | [02 — Créer un outil](./02_creer_un_outil.md) |
| Un **nouveau type d'objet** (un élément dessiné avec ses propres règles) | [03 — Créer un type d'entité](./03_creer_un_type_d_entite.md) |
| Un **paramètre** (réglage d'outil, attribut d'objet, réglage global) | [04 — Créer un paramètre](./04_creer_un_parametre.md) |
| Un **onglet** (rail de gauche, dock de droite, nouvel écran) | [05 — Créer un onglet](./05_creer_un_onglet.md) |
| Une **section d'inspecteur** ou un **panneau** latéral | [06 — Inspecteur et panneaux](./06_inspecteur_et_panneaux.md) |
| Un **calque**, un **matériau**, un **bloc de bibliothèque** | [07 — Calques, matériaux, bibliothèque](./07_calques_materiaux_bibliotheque.md) |
| Une **commande CLI**, un **raccourci**, un **export** | [08 — Commandes, raccourcis, exports](./08_commandes_raccourcis_exports.md) |
| Vérifier mon travail, respecter les conventions | [09 — Vérifier, tester, conventions](./09_verifier_tester_conventions.md) |

---

## 🧠 Les 5 idées à garder en tête

1. **Un seul composant orchestre l'éditeur** : `src/components/CadEditor.tsx` (≈ 6 700 lignes). Il possède l'état (entités, outil actif, onglet actif, niveaux, planches…) et passe des *props* aux panneaux. On y cherche avec **Grep** (nom de fonction ou de variable), on ne le lit jamais en entier.
2. **Les données sont des objets simples** (`CadEntity` dans `src/types.ts`) ; le rendu SVG et les calculs sont **dérivés** de ces données. Ajouter une fonctionnalité = presque toujours *un type/champ de donnée* + *un rendu* + *une manière de le créer*.
3. **`entities` ne contient que le niveau actif.** Les autres niveaux sont dans `otherLevels` ; `entitiesByLevel` les regroupe tous (utile pour les Vues et la Mise en page).
4. **Unités** : le plan est en **pixels plan** (1 px = 10 mm). Les épaisseurs, hauteurs et largeurs d'ouverture sont stockées en **mm**. Les planches de mise en page sont en **mm papier**.
5. **Règle d'or métier** : une porte ou une fenêtre est **toujours** encastrée dans un mur hôte (`findWallSnap`). Aucune fonctionnalité ne doit créer d'ouverture « flottante ».

---

## ✅ Le cycle de travail recommandé

```
1. Lire le guide correspondant         (5 min)
2. Modifier les types (types.ts)       → le compilateur liste ce qu'il reste à faire
3. Implémenter, fichier par fichier    (voir la check-list du guide)
4. npm run lint                         → doit afficher 0 erreur
5. npm run dev  → tester à la main      → voir guide 09
```

⬅️ [Retour au sommaire du cours](../README.md)
