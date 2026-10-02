# Chapitre 11 — Optimisations de Performance, Bonnes Pratiques & Déploiement

Félicitations pour être arrivé au dernier chapitre !  
Dans ce chapitre, nous allons aborder les **optimisations de performance avancées en React et TypeScript** pour garantir que notre studio CAO reste d'une fluidité irréprochable ($60 \text{ FPS}$ constants), même avec des centaines d'entités architecturales.

---

## 1. Le Piège des Re-Rendus en Informatique Graphique

En React, chaque appel à `setState` déclenche le ré-ordonnancement du composant.  
Lors d'un mouvement de souris (`mousemove`), l'événement peut être déclenché **plus de 60 fois par seconde**.

Si chaque mouvement de souris force le re-calcul et le re-rendu de 500 murs avec leurs hachures et leurs cotations, le processeur s'engorge et l'application saccade.

---

## 2. Techniques d'Optimisation Clés en React

### 2.1 Mémorisation des Calculs Lourds avec `useMemo`
Pour éviter de recalculer la surface totale de la maison à chaque pixel parcouru par la souris :

```typescript
import { useMemo } from 'react';

// Ne recalcule la surface totale QUE si la liste des entités change réellement
const totalSurfaceM2 = useMemo(() => {
  return entities
    .filter(e => e.type === 'room' && e.area)
    .reduce((sum, e) => sum + (e.area || 0), 0);
}, [entities]);
```

### 2.2 Stabilisation des Fonctions de Rappel avec `useCallback`
Si vous passez une fonction en prop à un sous-composant, React en crée une nouvelle instance à chaque re-rendu, ce qui casse l'optimisation des composants enfants :

```typescript
import { useCallback } from 'react';

const handleSelectEntity = useCallback((id: string) => {
  setSelectedIds([id]);
}, []); // Référence mémoire stable
```

### 2.3 Nettoyage des Écouteurs d'Événements dans `useEffect`
Toujours retourner une fonction de nettoyage (**cleanup function**) pour éviter les fuites de mémoire (Memory Leaks) :

```typescript
useEffect(() => {
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDraftStart(null);
    }
  };

  window.addEventListener('keydown', handleGlobalKeyDown);

  // RÈGLE D'OR : Nettoyer l'écouteur au démontage du composant !
  return () => {
    window.removeEventListener('keydown', handleGlobalKeyDown);
  };
}, []);
```

---

## 3. Validation de la Qualité du Code

Avant tout déploiement en production, deux vérifications obligatoires doivent être exécutées :

### 1. La Compilation TypeScript Stricte
```bash
npm run lint # Exécute tsc --noEmit
```
Si cette commande se termine sans aucun message, cela garantit qu'il n'existe **aucune incohérence de type** dans toute votre base de code.

### 2. La Construction du Bundle de Production
```bash
npm run build # Exécute vite build
```
Vite et `esbuild` vont regrouper, minifier et optimiser votre code JavaScript, CSS et SVG dans le dossier `dist/`, prêt à être servi sur n'importe quel CDN ou hébergeur Web (Cloud Run, Vercel, Netlify).

---

## 4. Bilan des Compétences Acquises

En réalisant ce projet de A à Z, vous avez acquis des compétences de niveau ingénieur senior :

| Domaine | Ce que vous avez appris et appliqué |
|---|---|
| **TypeScript** | Typage strict, interfaces extensibles, unions discriminées de littéraux, `Partial<T>`, typage d'événements SVG natifs, zéro `any`. |
| **React** | Cycle de vie des hooks (`useState`, `useRef`, `useCallback`, `useMemo`, `useEffect`), immuabilité, machine à états, gestion d'événements canvas. |
| **Mathématiques & Géométrie** | Trigonométrie (`Math.atan2`), vecteurs normaux, calcul de surfaces Shoelace, projections orthogonales, conversion d'échelles. |
| **Informatique Graphique** | Rendu vectoriel SVG, motifs paramétriques `<pattern>`, masques de perçage `<mask maskUnits="userSpaceOnUse">`, pan/zoom matriciel. |
| **Génie Logiciel** | Architecture modulaire, séparation des responsabilités, gestion de pile d'historique Undo/Redo, interopérabilité industrielle DXF. |

---

## 🏆 Conclusion
Vous possédez désormais toutes les clés techniques et méthodologiques pour créer, maintenir et étendre n'importe quelle application web complexe et interactive en React et TypeScript !

*Bonne programmation avec ARCKI CAD !*
