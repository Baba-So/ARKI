# Chapitre 10 — Moteur d'export DXF (AutoCAD R12) et SVG

Un logiciel de CAO n'a de valeur que s'il sait échanger ses plans avec le reste de la chaîne : AutoCAD, Revit, un traceur, un PDF. Ce chapitre explique **comment on génère un fichier DXF à la main** et pourquoi les détails du modèle de données d'ARCKI CAD (axe des murs, unités, axe Y) décident de la justesse du résultat.

> **État réel du projet.** Dans le code actuel, la fenêtre d'export (`ExportModal.tsx`) est une **maquette d'interface** : elle propose DWG / DXF / IFC / PDF / SVG, une échelle et des calques, mais le bouton « Exporter » ne fait qu'afficher un chargement simulé (`setTimeout`) puis « Téléchargé ! ». **Aucun fichier n'est produit** et le composant ne reçoit même pas les entités (ses props sont `isOpen`, `onClose`, `projectName`). Ce chapitre décrit donc la **méthode à implémenter**, avec des extraits **simplifiés et à écrire par vous**, et vous guide pour brancher la maquette sur un vrai générateur.

## 🎯 Objectifs

- Lire et écrire le format texte DXF (paires « code groupe / valeur »).
- Convertir correctement les unités (1 px = 10 mm) et l'axe Y (écran vers le bas → CAO vers le haut).
- Exporter des murs à partir du modèle « axe stocké » en utilisant les polygones de `computeWallPolygons`.
- Déclencher un téléchargement sans serveur avec `Blob` et `URL.createObjectURL`.
- Savoir ce que la maquette actuelle fait (et ne fait pas).

## 📋 Prérequis

- [Chapitre 04](./chapitre_04_moteur_svg_et_systeme_de_coordonnees.md) : repère écran, Y vers le bas.
- [Chapitre 09](./chapitre_09_inspecteur_proprietes_et_calques.md) : calques et `CadEntity`.
- Le [chapitre 13](./chapitre_13_murs_ligne_reference_et_raccords.md) est utile pour la section 4 (polygones de murs).

## 📁 Fichiers concernés

- [src/components/ExportModal.tsx](../components/ExportModal.tsx) — maquette de la fenêtre d'export (aucune génération).
- [src/App.tsx](../App.tsx) — ouvre la fenêtre (`isExportModalOpen`) ; [src/components/Header.tsx](../components/Header.tsx) (menu « Exporter (DXF/SVG) ») et [src/components/CommandPalette.tsx](../components/CommandPalette.tsx) déclenchent `onOpenExport`.
- [src/wallGeometry.ts](../wallGeometry.ts) — `computeWallPolygons`, à réutiliser pour exporter les murs.
- [src/types.ts](../types.ts) — `CadEntity`, `CadLevel`.

---

## 1. Le format DXF en langage simple

Un DXF est un fichier texte fait de **paires de lignes** : une ligne « code groupe » (un entier qui dit *quelle information va suivre*), puis une ligne « valeur ».

| Code | Signification |
|---|---|
| `0` | début d'une entité ou d'une section (`SECTION`, `LINE`, `CIRCLE`, `ENDSEC`, `EOF`) |
| `2` | nom (de section) |
| `8` | nom du calque |
| `10`, `20`, `30` | point de départ X, Y, Z |
| `11`, `21`, `31` | point d'arrivée X, Y, Z |
| `40` | rayon (cercle) |

```
0
LINE
8
STRUCTURES
10
1000.00
20
-2500.00
30
0.0
11
5000.00
21
-2500.00
31
0.0
```

Un fichier minimal en R12 (`$ACADVER` = `AC1009`) contient une section `HEADER`, une section `ENTITIES` et `0 / EOF`. Certains lecteurs exigent en plus une section `TABLES` déclarant les calques : à vérifier avec le logiciel cible.

**Pourquoi R12 ?** C'est la plus ancienne version encore lue partout. Moins de fonctionnalités (pas de polylignes légères, pas de textes riches), mais une compatibilité maximale.

## 2. Deux conversions obligatoires : unités et axe Y

Les coordonnées stockées dans `CadEntity` sont en **pixels du plan** (1 px = 10 mm) et l'axe Y du SVG pointe **vers le bas**. Un DXF attend des millimètres et un Y **vers le haut** :

$$X_{\text{dxf}} = X_{\text{px}} \times 10 \qquad Y_{\text{dxf}} = -\,Y_{\text{px}} \times 10$$

Sans l'inversion du signe de Y, le plan s'ouvre en miroir vertical dans AutoCAD. Isolez ces deux règles dans une fonction unique pour ne jamais les dupliquer :

```typescript
// Extrait SIMPLIFIÉ à écrire (n'existe pas encore dans le dépôt)
const toDxf = (p: { x: number; y: number }) => ({
  x: (p.x * 10).toFixed(2),
  y: (-p.y * 10).toFixed(2),
});
```

## 3. Générer des LINE et des CIRCLE

L'idée : un générateur est une **fonction pure** `(entités) → chaîne`. Aucun état React, donc testable seul (voir exercice 1).

```typescript
// Extrait SIMPLIFIÉ à écrire
import { CadEntity } from '../types.ts';

const line = (layer: string, a: {x:number;y:number}, b: {x:number;y:number}) => {
  const p = toDxf(a), q = toDxf(b);
  return `0\nLINE\n8\n${layer}\n10\n${p.x}\n20\n${p.y}\n30\n0.0\n11\n${q.x}\n21\n${q.y}\n31\n0.0\n`;
};

export function generateDxfString(entities: CadEntity[]): string {
  let out = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';
  out += '0\nSECTION\n2\nENTITIES\n';
  for (const e of entities) {
    const layer = e.layerId.toUpperCase();
    if (e.type === 'line') out += line(layer, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
    else if (e.type === 'circle') {
      const r = (e.radius ?? Math.hypot(e.x2 - e.x1, e.y2 - e.y1)) * 10;
      const c = toDxf({ x: e.x1, y: e.y1 });
      out += `0\nCIRCLE\n8\n${layer}\n10\n${c.x}\n20\n${c.y}\n30\n0.0\n40\n${r.toFixed(2)}\n`;
    }
    // murs, ouvertures, cotes : voir sections 4 et 5
  }
  return out + '0\nENDSEC\n0\nEOF\n';
}
```

Pourquoi `toUpperCase()` ? Les calques DXF sont conventionnellement en majuscules ; les identifiants ARCKI (`structures`, `cloisons`, `ouvertures`, `mobilier`, `cotations`) deviennent `STRUCTURES`, etc.

## 4. Les murs : exporter les polygones, pas l'axe

Piège majeur : pour un mur, `(x1,y1)→(x2,y2)` est l'**axe** (ligne centrale), pas une face (voir chapitre 13). Exporter ce segment donnerait un trait unique au milieu du mur. Pour un export fidèle, on exporte le **contour** calculé par `computeWallPolygons`, qui tient aussi compte des raccords en L et en T :

```typescript
// Extrait SIMPLIFIÉ à écrire
import { computeWallPolygons } from '../wallGeometry.ts';

const walls = entities.filter(e => e.type === 'wall' || e.type === 'partition');
const polys = computeWallPolygons(walls); // { [id]: [A+, B+, B-, A-] }
for (const w of walls) {
  const pts = polys[w.id];
  if (!pts) continue;
  const layer = w.layerId.toUpperCase();
  pts.forEach((p, i) => { out += line(layer, p, pts[(i + 1) % pts.length]); });
}
```

Limite connue : les contours de deux murs raccordés se chevauchent aux jonctions (côté écran, la technique « contours puis remplissages » masque ce détail ; en DXF il resterait des traits internes). Une version aboutie fusionnerait les polygones ou n'exporterait que les contours visibles.

## 5. Ouvertures, cotes, pièces

Les portes et fenêtres sont portées par un mur hôte (`hostWallId`) et ses extrémités `(x1,y1)`–`(x2,y2)` sont celles de la baie. Un export correct dessine la réservation (coupure dans les deux faces du mur) puis le symbole. C'est une **vraie extension** à concevoir ; ne vous contentez pas de réexporter un `LINE` unique. De même, les entités `polygon` / `polyline` utilisent `points` et `isClosed` (bouclez si `isClosed`).

## 6. Télécharger un fichier sans serveur

`Blob` crée un fichier en mémoire, `URL.createObjectURL` lui donne une adresse locale, un lien `<a download>` provoque l'enregistrement :

```typescript
// Extrait SIMPLIFIÉ à écrire
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // libère la mémoire
}
```

## 7. Brancher la maquette `ExportModal`

Aujourd'hui `handleExport` simule un délai. Pour le rendre réel :

1. Ajouter des props (`entities`, ou mieux `entitiesByLevel` et `levels`) à `ExportModalProps` et les passer depuis `App.tsx` (qui ne les possède pas : elles vivent dans `CadEditor.tsx`).
2. Remplacer le `setTimeout` par `generateDxfString(...)` puis `downloadFile(...)`.
3. Honorer les cases « Calques à intégrer » (`includeLayers`), aujourd'hui ignorées, et ne pas proposer DWG/IFC/PDF tant qu'ils ne sont pas implémentés.

**Export SVG** : le plan est déjà du SVG dans le DOM. Une approche simple consiste à cloner l'élément `<svg>` et à le sérialiser avec `XMLSerializer` puis `downloadFile`. Attention aux `<mask>` et motifs (`#wall-concrete-hatch`) définis dans `<defs>` : ils doivent être conservés dans le clone, sinon les hachures disparaissent.

## ⚠️ Pièges classiques

- **Documenter ce qui n'existe pas** : l'export actuel est simulé, ne le présentez pas comme fonctionnel.
- **Oublier `-y`** : plan en miroir dans AutoCAD.
- **Exporter l'axe des murs** au lieu de leurs contours.
- **Niveaux** : l'éditeur ne garde dans `entities` que le niveau actif (chapitre 12). Un export branché sur `entities` ne verrait qu'un étage ; utilisez `entitiesByLevel`.
- **Décimales** : `toFixed(2)` suffit en mm ; évitez la notation scientifique (`1e-7`) que certains lecteurs refusent.

## ✍️ Exercices

1. **Test pur.** Écrivez `generateDxfString` pour une seule `line` de `(0,0)` à `(100,0)` en calque `structures` et vérifiez que la sortie contient `10\n0.00`, `20\n-0.00`... Que pensez-vous de `-0.00` ? *Indice : `-0 * 10`.*
2. **Murs.** Exportez un mur horizontal de 200 mm d'épaisseur : combien de `LINE` produit votre code ? *Indice : 4 (polygone à 4 points).*
3. **Branchement.** Reliez `ExportModal` à votre générateur pour le format DXF uniquement.

<details>
<summary>Solutions succinctes</summary>

1. `-0 * 10` donne `-0` et `toFixed` affiche `-0.00`. Normalisez avec `|| 0` (`(-p.y * 10 || 0).toFixed(2)`).
2. 4 lignes (`[A+,B+,B-,A-]` bouclé), ou 8 si vous exportez aussi l'axe.
3. Ajouter `entities` aux props, appeler `downloadFile(generateDxfString(entities), \`${projectName}.dxf\`, 'application/dxf')` si `format === 'dxf'`.
</details>

## 📌 À retenir

- Le DXF est du texte en paires `code / valeur`.
- px → mm : ×10 ; Y SVG → Y CAO : signe inversé.
- Dans ARCKI CAD, `ExportModal` est aujourd'hui une maquette sans génération de fichier.
- Un mur stocke son axe : l'export fidèle utilise les polygones de `computeWallPolygons`.
- `Blob` + `URL.createObjectURL` suffisent pour télécharger sans backend.

---

⬅️ [Chapitre précédent (09)](./chapitre_09_inspecteur_proprietes_et_calques.md) | [Sommaire](./README.md) | [Chapitre suivant (11) ➡️](./chapitre_11_performance_et_deploiement.md)
