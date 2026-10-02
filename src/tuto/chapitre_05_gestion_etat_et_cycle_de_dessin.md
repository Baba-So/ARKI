# Chapitre 05 — Machine à États & Cycle de Tracé en React

Dans ce chapitre, nous abordons l'un des piliers centraux de React : **la gestion immuable de l'état (State Management)** et la boucle d'événements utilisateur.

---

## 1. La Règle d'Or de React : L'Immuabilité

En JavaScript classique, pour ajouter un élément à une liste, on écrit souvent :
```javascript
// ❌ INTERDIT EN REACT !
entities.push(newWall);
```
**Pourquoi est-ce une erreur fatale en React ?**  
React compare les références des objets pour savoir s'il doit redessiner l'écran. Si vous modifiez directement le tableau `entities` avec `.push()`, la référence mémoire reste identique, et **React ne détectera aucun changement**, laissant l'écran figé.

### La Bonne Pratique : La Mise à Jour Fonctionnelle Immuable
Pour ajouter un élément, nous créons un **nouveau tableau** contenant tous les anciens éléments plus le nouveau grâce à l'opérateur spread `...` :

```typescript
// ✅ PARFAIT : Nouvelle référence créée, React re-render immédiatement
setEntities(prev => [...prev, newEntity]);
```

---

## 2. Le Cycle de Tracé en Deux Clics ($P_1 \to P_2$)

La quasi-totalité des outils de CAO (murs, rectangles, lignes de cotes) suivent une machine à deux états :

```
État 0 : En attente
draftStart === null
         │
         ▼  [ Premier Clic : handleCanvasClick ]
État 1 : Ancrage P1 fixé
draftStart = { x: 100, y: 150 }
         │
         ▼  [ Déplacement Souris : handleMouseMove ]
Rendu d'un tracé "fantôme" (Ghost Drawing) en pointillés
reliant draftStart au curseur actuel cursorPos
         │
         ▼  [ Deuxième Clic : handleCanvasClick ]
Création de l'entité permanente CadEntity { x1, y1, x2, y2 }
draftStart = null (retour à l'état 0 ou enchaînement)
```

---

## 3. Implémentation du Composant de Dessin

Voici le code complet du cycle de tracé :

```tsx
import React, { useState } from 'react';
import { CadEntity } from '../types.ts';

export const CadDraftingEngine: React.FC = () => {
  // Liste de toutes les entités du plan
  const [entities, setEntities] = useState<CadEntity[]>([]);

  // Point d'ancrage P1 du dessin en cours
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);

  // Position instantanée de la souris sur le plan
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Suivi continu du curseur pour le fantôme élastique
  const handleMouseMove = (coords: { x: number; y: number }) => {
    setCursorPos(coords);
  };

  // 2. Gestion du clic de dessin
  const handleCanvasClick = (coords: { x: number; y: number }) => {
    if (!draftStart) {
      // PREMIER CLIC : On ancre P1
      setDraftStart(coords);
    } else {
      // DEUXIÈME CLIC : On crée l'entité finale
      const newWall: CadEntity = {
        id: `wall-${Date.now()}`,
        name: `Mur L=${Math.round(Math.hypot(coords.x - draftStart.x, coords.y - draftStart.y) * 10)}mm`,
        type: 'wall',
        layerId: 'structures',
        x1: draftStart.x,
        y1: draftStart.y,
        x2: coords.x,
        y2: coords.y,
        thickness: 200, // 200 mm
      };

      // Ajout immuable à la liste
      setEntities(prev => [...prev, newWall]);

      // Réinitialisation du point d'ancrage
      setDraftStart(null);
    }
  };

  return (
    <svg className="w-full h-full">
      {/* 1. Rendu des entités permanentes validées */}
      {entities.map(ent => (
        <line
          key={ent.id}
          x1={ent.x1}
          y1={ent.y1}
          x2={ent.x2}
          y2={ent.y2}
          stroke="#4cd7f6"
          strokeWidth="6"
          strokeLinecap="square"
        />
      ))}

      {/* 2. Rendu du fantôme élastique (Rubber-band) pendant le dessin */}
      {draftStart && (
        <g className="pointer-events-none">
          {/* Ligne élastique en pointillés */}
          <line
            x1={draftStart.x}
            y1={draftStart.y}
            x2={cursorPos.x}
            y2={cursorPos.y}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          {/* Poignée d'ancrage P1 */}
          <circle cx={draftStart.x} cy={draftStart.y} r="4" fill="#38bdf8" />
        </g>
      )}
    </svg>
  );
};
```

---

## 4. Pile d'Historique Annuler / Rétablir (Undo / Redo)

Les professionnels ont besoin de `Ctrl+Z` et `Ctrl+Y` à chaque instant.  
Voici un gestionnaire d'historique robuste basé sur des clichés JSON immuables :

```typescript
const [historyStack, setHistoryStack] = useState<string[]>([]);
const [redoStack, setRedoStack] = useState<string[]>([]);

// Enregistrer l'état avant toute modification
const recordHistory = () => {
  setHistoryStack(prev => [...prev.slice(-30), JSON.stringify(entities)]);
  setRedoStack([]); // Efface la pile de rétablissement
};

// Annuler (Ctrl+Z)
const handleUndo = () => {
  if (historyStack.length === 0) return;
  const previousState = historyStack[historyStack.length - 1];
  
  setRedoStack(prev => [...prev, JSON.stringify(entities)]);
  setEntities(JSON.parse(previousState));
  setHistoryStack(prev => prev.slice(0, -1));
};

// Rétablir (Ctrl+Y)
const handleRedo = () => {
  if (redoStack.length === 0) return;
  const nextState = redoStack[redoStack.length - 1];
  
  setHistoryStack(prev => [...prev, JSON.stringify(entities)]);
  setEntities(JSON.parse(nextState));
  setRedoStack(prev => prev.slice(0, -1));
};
```

---

## Résumé du Chapitre 05
* Vous appliquez rigoureusement le principe d'**immuabilité** de React.
* Vous maîtrisez le **cycle de dessin en deux clics** avec retour élastique temps réel.
* Vous avez mis en place une pile d'historique **Undo/Redo** complète.

👉 **Passons au [Chapitre 06 : Moteur d'Accrochage Intelligent (OSNAP)](./chapitre_06_aimantation_intelligente_osnap.md) pour donner une précision chirurgicale à vos tracés !**
