# Chapitre 01 — Fondations : Vite, React 19 & TypeScript

## 🎯 Objectifs
- Comprendre le rôle de chaque outil de la chaîne : **Vite** (serveur de dev et build), **React 19** (interface), **TypeScript** (vérification des types), **Tailwind CSS v4** (styles).
- Savoir lire `package.json`, `tsconfig.json` et `vite.config.ts` du projet réel.
- Écrire et typer un composant React avec une `interface` de props.
- Repérer la différence entre ce qu'un cours conseille (`strict: true`) et ce que le projet configure vraiment.
- Lancer les trois commandes de travail : `npm run dev`, `npm run lint`, `npm run build`.

## 📋 Prérequis
- JavaScript moderne : `const`/`let`, fonctions fléchées, déstructuration, spread `...`.
- Node.js 18 ou plus récent, un terminal, un éditeur (VS Code recommandé).
- Aucune connaissance de React ni de CAO n'est nécessaire.

## 📁 Fichiers concernés
- [package.json](../../package.json) — dépendances et scripts
- [tsconfig.json](../../tsconfig.json) — options du compilateur TypeScript
- [vite.config.ts](../../vite.config.ts) — configuration de Vite
- [index.html](../../index.html) — page unique qui charge l'application
- [src/main.tsx](../main.tsx) — point d'entrée React
- [src/App.tsx](../App.tsx) — composant racine (navigation entre écrans)
- [src/index.css](../index.css) — Tailwind et thème sombre

---

## 1. La chaîne d'outils vue d'en haut

Un navigateur ne comprend ni TypeScript ni JSX. Il faut donc un « traducteur » entre ce que nous écrivons et ce qu'il exécute :

```
 fichiers .ts / .tsx          Vite (dev ou build)             navigateur
 ┌───────────────────┐       ┌───────────────────┐       ┌───────────────┐
 │ TypeScript + JSX  │ ───▶  │ retire les types, │ ───▶  │ JavaScript +  │
 │ + imports         │       │ transforme le JSX │       │ DOM / SVG     │
 └───────────────────┘       └───────────────────┘       └───────────────┘
          ▲
          │ vérification des types : `tsc --noEmit` (script "lint")
```

Point important : **Vite ne vérifie pas les types**. Il les supprime simplement. C'est `tsc --noEmit` qui les contrôle ; c'est pourquoi le projet possède un script dédié (section 3).

## 2. `package.json` : scripts et dépendances

Extrait réel (version abrégée, seules les lignes utiles à ce chapitre) :

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "@tailwindcss/vite": "^4.3.3",
    "lucide-react": "^0.546.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2"
  }
}
```

| Commande | Ce qu'elle fait | Quand l'utiliser |
|---|---|---|
| `npm run dev` | serveur local sur le port 3000 avec rechargement à chaud | pendant le développement |
| `npm run lint` | `tsc --noEmit` : vérifie les types sans produire de fichier | après chaque modification |
| `npm run build` | produit une version optimisée (dossier `dist`) | avant un déploiement |

> Le fichier contient aussi d'autres dépendances (`@google/genai`, `express`, `motion`…) qui ne servent pas à ce chapitre. Le « copilote IA » de l'éditeur repose, lui, sur le module local `src/agent.ts` (analyse par règles, vu au chapitre 02).

**Pourquoi ce choix ?** `"type": "module"` indique que les fichiers `.js` sont des modules ES (`import`/`export`), le même système que celui du navigateur. Vite en profite pour servir les fichiers presque tels quels en développement, d'où un démarrage très rapide.

## 3. TypeScript : `tsconfig.json` réel

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "types": ["vite/client"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "jsx": "react-jsx",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": { "@/*": ["./*"] }
  }
}
```
*(version simplifiée : on a omis `experimentalDecorators`, `useDefineForClassFields`, `moduleDetection` et `allowJs`, sans effet sur ce cours.)*

Ce qu'il faut en retenir :

- **`noEmit: true`** : TypeScript ne génère aucun fichier, il se contente de vérifier. La génération est confiée à Vite.
- **`jsx: "react-jsx"`** : on n'a pas besoin d'écrire `import React` dans chaque fichier pour utiliser le JSX.
- **`allowImportingTsExtensions: true`** : explique pourquoi le code importe avec l'extension, par exemple `import { CadEntity } from './types.ts'`.
- **`paths` et `@/*`** : alias d'import, doublé dans `vite.config.ts` (`'@'` pointe vers la racine du dépôt).
- **Il n'y a pas `"strict": true`** dans ce fichier. Beaucoup de tutoriels le recommandent (il active la vérification de `null`/`undefined`, entre autres). Ici, le projet est donc en mode « souple » : certaines erreurs, comme un `undefined` oublié, ne seront pas signalées. Voir l'exercice 3.

## 4. `vite.config.ts` réel

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```
*(version abrégée : les commentaires d'origine ont été retirés.)*

- `react()` : plugin qui comprend le JSX et active le « Fast Refresh » (le composant se met à jour sans perdre son état).
- `tailwindcss()` : plugin Tailwind v4, **sans fichier `tailwind.config`** : le thème se déclare dans le CSS.
- `hmr` / `watch` : réglages liés à l'environnement AI Studio qui peut désactiver le rechargement à chaud via la variable `DISABLE_HMR`. Le commentaire d'origine demande de ne pas les modifier.

## 5. De `index.html` au premier composant

Le navigateur charge `index.html`, qui contient un `<div id="root">` vide et une balise `<script type="module" src="/src/main.tsx">`. Voici `src/main.tsx` en entier :

```tsx
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

Le `!` après `getElementById(...)` dit à TypeScript : « je sais que cet élément existe ». Sans lui, le résultat pourrait être `null`.

Ensuite `App` choisit l'écran à montrer. Extrait de `src/App.tsx` (simplifié) :

```tsx
const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard');
// ScreenType = 'editor' | 'dashboard' | 'auth'   (défini dans src/types.ts)
```

`useState` est un **hook** : une fonction React qui donne au composant une mémoire. Il renvoie la valeur actuelle et la fonction pour la changer ; chaque changement relance le dessin du composant. Ici, la valeur ne peut valoir que `'editor'`, `'dashboard'` ou `'auth'` (nous reviendrons sur ces « unions » au chapitre 02).

## 6. Tailwind CSS v4 et le thème sombre

`src/index.css` commence par :

```css
@import "tailwindcss";

@theme {
  --color-background: #051424;
  --color-on-background: #d4e4fa;
  --color-primary: #4cd7f6;
  /* … d'autres couleurs … */
}
```

Chaque variable `--color-xxx` devient une classe utilisable dans le JSX (`bg-primary`, `text-on-surface`…). On style donc sans quitter le composant : `className="flex items-center gap-2 text-xs"`.

## 7. Anatomie d'un composant typé

Exemple pédagogique (il n'existe pas tel quel dans le dépôt) :

```tsx
interface WallLabelProps {
  name: string;
  thicknessMm: number;
  isLoadBearing?: boolean; // le « ? » rend la prop optionnelle
}

export const WallLabel: React.FC<WallLabelProps> = ({ name, thicknessMm, isLoadBearing = false }) => (
  <div className="text-xs font-mono">
    {name} · {thicknessMm} mm {isLoadBearing && '(porteur)'}
  </div>
);
```

- L'`interface` est un **contrat** : `<WallLabel name="M1" thicknessMm="200" />` est refusé, car `"200"` est du texte et non un nombre.
- `React.FC<...>` est la manière de typer un composant fonction. Le dépôt l'utilise par exemple dans `LayoutPanel` ([src/components/LayoutPanel.tsx](../components/LayoutPanel.tsx)).
- Le JSX est une description déclarative : on décrit **ce qu'on veut voir**, React se charge de mettre le DOM à jour.

## ⚠️ Pièges classiques
- **Croire que Vite vérifie les types** : l'application peut tourner avec des erreurs de type. Lancez `npm run lint` régulièrement.
- **Oublier l'extension dans un import** (`'./types'` au lieu de `'./types.ts'`) : le projet utilise l'extension partout, restez cohérent.
- **Modifier directement une variable d'état** (`entities.push(x)`) au lieu d'appeler la fonction de mise à jour : React ne voit pas le changement.
- **Copier un `tsconfig` de tutoriel** sans vérifier qu'il correspond à l'existant : ici, pas de `strict`.
- **Chercher un `tailwind.config.js`** : en v4 la configuration vit dans `index.css`.

## ✍️ Exercices

**Exercice 1 — Lire la chaîne (facile).** Sans lancer quoi que ce soit, dites dans quel fichier se trouve : (a) le port du serveur de développement, (b) l'alias `@`, (c) la couleur de fond `#051424`.
*Indice : deux de ces réponses sont dans des fichiers « config », une dans le CSS.*

<details><summary>Solution</summary>

(a) `package.json`, script `dev` (`--port=3000`). (b) `tsconfig.json` (`paths`) et `vite.config.ts` (`resolve.alias`). (c) `src/index.css` (`--color-background`) et aussi sur le `<body>` de `index.html`.
</details>

**Exercice 2 — Un composant typé (moyen).** Écrivez `ScaleBadge` qui reçoit `mmPerPx: number` et affiche `1 px = 10 mm`. Faites échouer volontairement la compilation en lui passant une chaîne, puis lisez le message.
*Indice : `interface` de props + `npm run lint`.*

<details><summary>Solution</summary>

```tsx
interface ScaleBadgeProps { mmPerPx: number }
export const ScaleBadge: React.FC<ScaleBadgeProps> = ({ mmPerPx }) => <span>1 px = {mmPerPx} mm</span>;
// <ScaleBadge mmPerPx="10" />  → erreur : le type 'string' n'est pas assignable au type 'number'
```
</details>

**Exercice 3 — Activer `strict` (avancé).** Ajoutez `"strict": true` dans une copie de `tsconfig.json`, lancez `npx tsc --noEmit` et notez le nombre d'erreurs. Quelles catégories reviennent ? *(Ne gardez pas la modification dans le dépôt.)*
*Indice : cherchez les messages « possibly 'undefined' » et « implicitly has an 'any' type ».*

<details><summary>Solution</summary>

Le résultat dépend de l'état du code. Les erreurs typiques viennent des propriétés optionnelles de `CadEntity` (`thickness?`, `hostWallId?`…) utilisées sans test, et des `any` implicites (par exemple `let bestSnap: any` dans `findWallSnap`). Corriger chaque cas consiste à tester la valeur (`if (e.thickness)`), ou à fournir une valeur par défaut (`e.thickness ?? 200`).
</details>

## 📌 À retenir
- Vite sert et assemble le code ; **`tsc --noEmit` (`npm run lint`) est le seul vrai contrôle de types**.
- `main.tsx` monte `<App />` dans `#root` ; `App` choisit l'écran grâce à un `useState<ScreenType>`.
- Le `tsconfig.json` du projet **n'active pas `strict`** : soyez donc plus prudent avec `undefined`.
- Tailwind v4 se configure dans `src/index.css` (`@theme`), sans fichier de config JS.
- Une `interface` de props est un contrat vérifié à la compilation.

---
⬅️ *(début du cours)* | [Sommaire](./README.md) | [Chapitre suivant ➡️](./chapitre_02_modelisation_donnees_typescript.md)
