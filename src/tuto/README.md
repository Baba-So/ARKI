# 🎓 ARCKI CAD — Sommaire du Cours & Parcours d'Apprentissage
## Apprendre React & TypeScript en Créant un Studio CAO d'Architecture 2D de A à Z

Bienvenue dans ce cours complet d'ingénierie web. L'objectif pédagogique est double :
1. **Maîtriser React 19 et TypeScript moderne** sur un projet concret, exigeant et hautement graphique.
2. **Construire pas à pas un logiciel de CAO (Conception Assistée par Ordinateur) d'architecture 2D vectoriel paramétrique** dans le navigateur, doté des fonctionnalités majeures des outils professionnels (AutoCAD, Revit, ArchiCAD).

---

## 🧭 Pourquoi ce projet est le meilleur moyen d'apprendre React & TypeScript ?

Beaucoup de tutoriels se limitent à de simples TodoLists ou des formulaires CRUD basiques qui n'expliquent pas comment gérer :
* Des **types de données complexes et polymorphes** (murs, portes, cercles, arcs Bézier, calques).
* Des **états réactifs temps réel** cadencés à 60 images par seconde (suivi de curseur, pan, zoom, dessin fantôme élastique).
* La manipulation déclarative du **SVG natif** avec masquage géométrique et hachures paramétriques.
* La séparation nette entre **logique mathématique pure** (fonctions sans effets de bord) et **composants d'interface utilisateur**.

---

## 📚 Table des Matières des Chapitres

| Chapitre | Titre | Notions Clés React & TypeScript |
|---|---|---|
| [**Chapitre 01**](./chapitre_01_fondations_react_ts_vite.md) | **Fondations : Vite, React 19 & TypeScript Strict** | JSX/TSX, `tsconfig.json`, `strict: true`, Virtual DOM vs SVG, Tailwind CSS v4 |
| [**Chapitre 02**](./chapitre_02_modelisation_donnees_typescript.md) | **Modélisation des Données & Typage Strict** | `type` vs `interface`, Unions discriminées, Type Narrowing, immuabilité |
| [**Chapitre 03**](./chapitre_03_moteur_geometrique_mathematiques.md) | **Moteur Mathématique & Géométrie 2D Pure** | Fonctions pures, typage strict d'arguments, trigonométrie, formule de Shoelace (Gauss) |
| [**Chapitre 04**](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md) | **Moteur SVG & Coordonnées Monde vs Écran** | `useRef`, `getBoundingClientRect`, matrice de transformation `(screen - pan) / zoom` |
| [**Chapitre 05**](./chapitre_05_gestion_etat_et_cycle_de_dessin.md) | **Machine à États, Événements & Cycle de Tracé** | `useState`, mise à jour fonctionnelle `prev => ...`, cycle en deux clics, pile Undo/Redo |
| [**Chapitre 06**](./chapitre_06_aimantation_intelligente_osnap.md) | **Moteur d'Accrochage Magnétique (OSNAP)** | Algorithmes d'aimantation, projection de points, snap grille F9, orthogonalité F8 |
| [**Chapitre 07**](./chapitre_07_outils_et_sous_outils_parametriques.md) | **Outils & Sous-Outils Paramétriques** | Murs (droit, continu, 4 murs rect), Formes (rectangle, cercle), Tracé (libre, Bézier) |
| [**Chapitre 08**](./chapitre_08_encastrement_des_menuiseries.md) | **Encastrement des Menuiseries & Masquage SVG** | Règle DTU mur hôte, balise `<mask maskUnits="userSpaceOnUse">`, arc de débattement |
| [**Chapitre 09**](./chapitre_09_communication_composants_inspecteur.md) | **Inspecteur d'Attributs & Gestionnaire de Calques** | "Lifting state up", communication parent-enfant via props, formulaires contrôlés |
| [**Chapitre 10**](./chapitre_10_moteur_export_dxf_autocad_et_svg.md) | **Générateur d'Export DXF AutoCAD R12 & SVG** | Manipulation de flux de texte, Web API (`Blob`, `URL.createObjectURL`), format DXF |
| [**Chapitre 11**](./chapitre_11_performance_et_deploiement.md) | **Optimisations de Performance & Bonnes Pratiques** | `useCallback`, `useMemo`, `React.memo`, isolation des re-renders et build Vite |

---

## 🛠️ Prérequis Recommandés
* Notions de base en JavaScript moderne (ES6+ : `const`, `let`, arrow functions, destructuring, spread operator).
* Node.js version 18 ou supérieure installé sur votre machine.
* Un éditeur de code moderne (VS Code ou Cursor recommandé) avec l'extension TypeScript activée.

---

👉 **Pour commencer, ouvrez le [Chapitre 01 : Fondations : Vite, React 19 & TypeScript Strict](./chapitre_01_fondations_react_ts_vite.md) !**
