# Chapitre 10 — Moteur d'Export DXF AutoCAD R12 & SVG en TypeScript

Pour qu'un logiciel de CAO soit utilisable dans un cabinet d'architecture ou un bureau d'études, il doit être capable d'exporter ses plans dans les formats universels de l'industrie : **AutoCAD DXF** et **SVG vectoriel**.

Dans ce chapitre, nous allons concevoir notre propre générateur de fichier **DXF ASCII sans aucune bibliothèque externe**, en utilisant uniquement TypeScript et les API Web natives (`Blob`).

---

## 1. Comprendre la Structure du Format DXF (Drawing eXchange Format)

Créé par Autodesk, le format DXF est un format texte structuré en **paires de lignes** :
* **Ligne impaire (Code groupe)** : Un entier indiquant le type de donnée (ex: `0` pour le nom d'entité, `8` pour le calque, `10` pour la coordonnée X, `20` pour la coordonnée Y).
* **Ligne paire (Valeur)** : La valeur textuelle ou numérique associée.

```
0          <-- Code groupe 0 : début d'entité
LINE       <-- Type : segment de droite
8          <-- Code groupe 8 : nom du calque
STRUCTURES <-- Valeur : calque
10         <-- Coordonnée X de départ
1000.0     <-- Valeur en mm
20         <-- Coordonnée Y de départ
2500.0     <-- Valeur en mm
11         <-- Coordonnée X d'arrivée
5000.0     <-- Valeur en mm
21         <-- Coordonnée Y d'arrivée
2500.0     <-- Valeur en mm
```

---

## 2. Le Piège de l'Axe Y : Inversion SVG vs Cartésien

Attention à une différence fondamentale :
* **En SVG / Web** : L'axe $Y$ est orienté vers le **BAS** ($Y=0$ est tout en haut de l'écran).
* **En CAO / Mathématiques** : L'axe $Y$ est orienté vers le **HAUT** ($Y>0$ monte vers le Nord).

Pour que le plan n'apparaisse pas à l'envers lorsqu'un architecte l'ouvre dans AutoCAD, **nous devons inverser le signe de la coordonnée Y** :
$$Y_{\text{dxf}} = -Y_{\text{svg}} \times 10$$

---

## 3. Implémentation du Générateur DXF en TypeScript

Voici la fonction pure qui convertit nos entités en fichier DXF complet :

```typescript
import { CadEntity } from '../types.ts';

export function generateDxfString(entities: CadEntity[]): string {
  let out = '';

  // 1. SECTION EN-TÊTE
  out += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';

  // 2. SECTION DES ENTITÉS DU PLAN
  out += '0\nSECTION\n2\nENTITIES\n';

  for (const ent of entities) {
    const layer = (ent.layerId || '0').toUpperCase();

    // Cas A : Lignes, Murs et Cloisons
    if (['wall', 'partition', 'line', 'dim'].includes(ent.type)) {
      out += '0\nLINE\n';
      out += `8\n${layer}\n`;
      out += `10\n${(ent.x1 * 10).toFixed(2)}\n`;   // X1 en mm
      out += `20\n${(-ent.y1 * 10).toFixed(2)}\n`;  // Y1 inversé en mm
      out += '30\n0.0\n';                            // Z1 (2D = 0)
      out += `11\n${(ent.x2 * 10).toFixed(2)}\n`;   // X2 en mm
      out += `21\n${(-ent.y2 * 10).toFixed(2)}\n`;  // Y2 inversé en mm
      out += '31\n0.0\n';                            // Z2 (2D = 0)
    }

    // Cas B : Cercles
    else if (ent.type === 'circle') {
      const radiusMm = (ent.radius ? ent.radius : Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1)) * 10;
      out += '0\nCIRCLE\n';
      out += `8\n${layer}\n`;
      out += `10\n${(ent.x1 * 10).toFixed(2)}\n`;
      out += `20\n${(-ent.y1 * 10).toFixed(2)}\n`;
      out += '30\n0.0\n';
      out += `40\n${radiusMm.toFixed(2)}\n`; // Code 40 = Rayon
    }

    // Cas C : Polygones fermés
    else if (ent.points && ent.points.length >= 2) {
      for (let i = 0; i < ent.points.length; i++) {
        const next = (i + 1) % ent.points.length;
        if (!ent.isClosed && next === 0) continue; // Si non fermé, on ne reboucle pas
        
        const p1 = ent.points[i];
        const p2 = ent.points[next];

        out += '0\nLINE\n';
        out += `8\n${layer}\n`;
        out += `10\n${(p1.x * 10).toFixed(2)}\n`;
        out += `20\n${(-p1.y * 10).toFixed(2)}\n`;
        out += '30\n0.0\n';
        out += `11\n${(p2.x * 10).toFixed(2)}\n`;
        out += `21\n${(-p2.y * 10).toFixed(2)}\n`;
        out += '31\n0.0\n';
      }
    }
  }

  // 3. FIN DU FICHIER
  out += '0\nENDSEC\n0\nEOF\n';

  return out;
}
```

---

## 4. Déclencher le Téléchargement dans le Navigateur avec `Blob`

Pour permettre à l'utilisateur de télécharger le fichier `.dxf` sur son disque sans serveur backend :

```typescript
export function downloadFile(content: string, filename: string, mimeType: string) {
  // 1. Création d'un Blob binaire en mémoire
  const blob = new Blob([content], { type: mimeType });

  // 2. Génération d'une URL locale temporaire
  const url = URL.createObjectURL(blob);

  // 3. Création d'une balise <a> fantôme et simulation de clic
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // 4. Nettoyage de la mémoire
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

Pour télécharger le DXF généré :
```typescript
const handleExportDxf = () => {
  const dxfContent = generateDxfString(entities);
  downloadFile(dxfContent, 'plan-architectural.dxf', 'application/dxf');
};
```

---

## Résumé du Chapitre 10
* Vous savez formater un fichier DXF conforme au standard universel Autodesk R12.
* Vous maîtrisez la correction de l'inversion géométrique de l'axe Y entre SVG et CAO.
* Vous utilisez les API Web natives (`Blob`, `URL.createObjectURL`) pour télécharger des fichiers sans dépendances superflues.

👉 **Passons au [Chapitre 11 : Optimisations de Performance & Bonnes Pratiques](./chapitre_11_performance_et_deploiement.md) pour finaliser et polir votre application comme un ingénieur senior !**
