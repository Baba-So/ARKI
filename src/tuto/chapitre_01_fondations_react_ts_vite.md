# Chapitre 01 — Fondations : Vite, React 19 & TypeScript Strict

Bienvenue dans le premier chapitre de la formation ! Nous allons poser les fondations techniques de notre studio de CAO architectural en comprenant précisément comment fonctionnent **React 19**, **TypeScript** et le bundler **Vite**.

---

## 1. Pourquoi TypeScript pour un logiciel de CAO ?

En JavaScript classique non typé, une simple erreur de nom de propriété comme `entity.thicknes` au lieu de `entity.thickness` passe inaperçue au moment de l'écriture du code, et ne plante qu'au moment de l'exécution, souvent chez l'utilisateur final.

Dans un logiciel de CAO manipulant des dizaines de coordonnées, d'angles, d'épaisseurs et de calculs de découpes de maçonnerie, **TypeScript est un garde-fou indispensable** :
1. **Détection des erreurs à la compilation** : Si vous tentez d'assigner une chaîne `"200"` là où un nombre en millimètres `number` est attendu, TypeScript refuse de compiler (`tsc --noEmit`).
2. **Autocomplétion & Refactorisation sécurisée** : Dès que vous tapez `entity.`, votre éditeur vous propose la liste exacte des attributs disponibles.
3. **Documentation vivante du code** : Les types décrivent la structure des données sans avoir besoin d'écrire des commentaires superflus.

---

## 2. Initialisation du Projet avec Vite

Ouvrez un terminal et exécutez la commande suivante :

```bash
npm create vite@latest arcki-cad -- --template react-ts
cd arcki-cad
npm install
```

### Pourquoi Vite ?
Contrairement à l'ancien Create-React-App basé sur Webpack, **Vite** utilise les modules ES natifs du navigateur (`<script type="module">`) et le compilateur ultra-rapide écrit en Go **esbuild**. Le serveur de développement démarre en moins de 300 millisecondes !

---

## 3. Configuration TypeScript Stricte (`tsconfig.json`)

Pour tirer le maximum de TypeScript, nous activons le mode strict :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Mode Bundler moderne */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Règles de Typage Strict */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

* **`"strict": true`** : Active toutes les vérifications strictes (vérification de `null` et `undefined`, typage strict des fonctions).
* **`"noUnusedLocals": true`** : Empêche l'accumulation de variables mortes dans le projet.

---

## 4. Configuration de Tailwind CSS v4

Dans le fichier `package.json`, installez le plugin Vite officiel de Tailwind :

```bash
npm install @tailwindcss/vite tailwindcss
```

Dans `vite.config.ts` :

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
```

Et dans votre fichier CSS principal `src/index.css` :

```css
@import "tailwindcss";

@layer base {
  body {
    background-color: #051424;
    color: #d4e4fa;
    font-family: 'Inter', sans-serif;
  }
}
```

---

## 5. Anatomie d'un Composant React Typé en TypeScript

En React avec TypeScript, un composant est une simple fonction JavaScript qui reçoit un objet de **propriétés (props)** et retourne un élément **JSX** (description déclarative de l'interface).

Voici comment déclarer un composant typé avec son interface de props :

```tsx
import React from 'react';

// 1. Définition de l'interface TypeScript des Props
interface HeaderTitleProps {
  projectName: string;
  version: string;
  isSaved?: boolean; // Le '?' signifie que la prop est optionnelle
}

// 2. Déclaration du composant fonctionnel
export const HeaderTitle: React.FC<HeaderTitleProps> = ({
  projectName,
  version,
  isSaved = true, // Valeur par défaut
}) => {
  return (
    <div className="flex flex-col">
      <h1 className="text-sm font-bold text-slate-100 font-sans tracking-wide">
        {projectName}
      </h1>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
        <span className={`w-1.5 h-1.5 rounded-full ${isSaved ? 'bg-cyan-400' : 'bg-amber-400 animate-ping'}`} />
        <span>{version} · {isSaved ? 'Enregistré' : 'Modifié...'}</span>
      </div>
    </div>
  );
};
```

### Points Clés à Retenir :
1. **`interface HeaderTitleProps`** : Définit le contrat strict que tout parent doit respecter pour utiliser ce composant.
2. Si vous essayez d'écrire `<HeaderTitle projectName={123} />` (un nombre au lieu d'une chaîne), TypeScript refuse immédiatement la compilation en soulignant l'erreur en rouge.

---

## Résumé du Chapitre 01
* Vous avez initialisé un environnement Vite moderne ultra-performant.
* Vous avez configuré TypeScript en mode strict pour garantir la robustesse de l'application.
* Vous comprenez la syntaxe d'un composant React typé via une `interface`.

👉 **Passons maintenant au [Chapitre 02 : Modélisation des Données & Typage Strict](./chapitre_02_modelisation_donnees_typescript.md) pour définir les structures de données CAO !**
