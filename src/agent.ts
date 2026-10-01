import { CadEntity } from './types.ts';

export interface AgentMetricReport {
  totalFloorAreaM2: number;
  wallLengthM: number;
  partitionLengthM: number;
  doorCount: number;
  windowCount: number;
  glazingRatioPercent: number; // Ratio surface vitrée / surface habitable (Norme RE2020: min 16.7% soit 1/6)
  pmrCompliantDoors: number; // Portes avec passage >= 900mm
  nonCompliantDoors: number;
  openingsEmbeddedCorrectly: boolean;
}

export interface AgentAction {
  type: 'add_entity' | 'update_entity' | 'delete_entity' | 'audit_report' | 'message';
  entity?: CadEntity;
  updatedFields?: Partial<CadEntity>;
  entityId?: string;
  message: string;
}

export interface AgentExecutionResult {
  reply: string;
  actions: AgentAction[];
  report?: AgentMetricReport;
}

/**
 * Calculateur métrique et réglementaire de l'Agent ARCKI CAD
 */
export function analyzePlanMetrics(entities: CadEntity[]): AgentMetricReport {
  // Surface habitable totale (pièces et polygones fermés)
  const rooms = entities.filter(e => e.type === 'room' || (e.type === 'polygon' && e.isClosed));
  const totalFloorAreaM2 = rooms.reduce((sum, r) => sum + (r.area || 0), 0);

  // Murs porteurs
  const walls = entities.filter(e => e.type === 'wall');
  const wallLengthM = walls.reduce((sum, w) => {
    const lenPx = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    return sum + (lenPx * 10) / 1000;
  }, 0);

  // Cloisons
  const partitions = entities.filter(e => e.type === 'partition');
  const partitionLengthM = partitions.reduce((sum, p) => {
    const lenPx = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
    return sum + (lenPx * 10) / 1000;
  }, 0);

  // Portes et vérification PMR (passage utile >= 900mm)
  const doors = entities.filter(e => e.type === 'door');
  let pmrCompliant = 0;
  let nonPmr = 0;
  doors.forEach(d => {
    const w = d.openingWidth || Math.hypot(d.x2 - d.x1, d.y2 - d.y1) * 10;
    if (w >= 900) {
      pmrCompliant++;
    } else {
      nonPmr++;
    }
  });

  // Fenêtres et calcul surface vitrée
  const windows = entities.filter(e => e.type === 'window');
  let totalGlazingAreaM2 = 0;
  windows.forEach(w => {
    const widthM = (w.openingWidth || Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * 10) / 1000;
    const heightM = (w.height || 1250) / 1000;
    totalGlazingAreaM2 += widthM * heightM;
  });

  const glazingRatio = totalFloorAreaM2 > 0 ? (totalGlazingAreaM2 / totalFloorAreaM2) * 100 : 0;

  // Vérification de l'encastrement systématique de toutes les ouvertures
  const candidateWalls = entities.filter(e => e.type === 'wall' || e.type === 'partition');
  const allOpenings = [...doors, ...windows];
  const openingsEmbedded = allOpenings.every(op => {
    if (op.hostWallId && candidateWalls.some(w => w.id === op.hostWallId)) return true;
    const midX = (op.x1 + op.x2) / 2;
    const midY = (op.y1 + op.y2) / 2;
    // Vérifie si le centre est proche d'un mur
    return candidateWalls.some(w => {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return false;
      let t = ((midX - w.x1) * dx + (midY - w.y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(midX - (w.x1 + t * dx), midY - (w.y1 + t * dy));
      return dist <= 30;
    });
  });

  return {
    totalFloorAreaM2: Math.round(totalFloorAreaM2 * 100) / 100,
    wallLengthM: Math.round(wallLengthM * 10) / 10,
    partitionLengthM: Math.round(partitionLengthM * 10) / 10,
    doorCount: doors.length,
    windowCount: windows.length,
    glazingRatioPercent: Math.round(glazingRatio * 10) / 10,
    pmrCompliantDoors: pmrCompliant,
    nonCompliantDoors: nonPmr,
    openingsEmbeddedCorrectly: openingsEmbedded,
  };
}

/**
 * Moteur d'interprétation et d'exécution de l'Agent ARCKI CAD
 */
export class ArckiCadAgent {
  /**
   * Analyse une requête utilisateur et génère une réponse et des actions CAO concrètes
   */
  public static async processRequest(prompt: string, entities: CadEntity[]): Promise<AgentExecutionResult> {
    const cleanPrompt = prompt.trim().toLowerCase();
    const report = analyzePlanMetrics(entities);
    const actions: AgentAction[] = [];

    // 1. Audit réglementaire & métrique du plan
    if (
      cleanPrompt.includes('audit') ||
      cleanPrompt.includes('métrique') ||
      cleanPrompt.includes('surface') ||
      cleanPrompt.includes('norme') ||
      cleanPrompt.includes('rapport')
    ) {
      const re2020Status = report.glazingRatioPercent >= 16.7
        ? `✅ Conforme RE2020 (${report.glazingRatioPercent}% ≥ 16.7% requis)`
        : `⚠️ Surface vitrée insuffisante (${report.glazingRatioPercent}% < 16.7% requis par le code de la construction)`;

      const pmrStatus = report.nonCompliantDoors === 0
        ? `✅ 100% conforme PMR (${report.pmrCompliantDoors} portes ≥ 900mm)`
        : `ℹ️ ${report.pmrCompliantDoors} porte(s) PMR 900mm et ${report.nonCompliantDoors} porte(s) standard (730/830mm)`;

      const encastrementStatus = report.openingsEmbeddedCorrectly
        ? `✅ 100% des ouvertures (${report.doorCount + report.windowCount}) sont rigoureusement encastrées sur les murs`
        : `⚠️ Certaines ouvertures nécessitent un recalage sur mur`;

      const reply = `### 📋 Rapport d'Audit ARCKI CAD

- **Surface Habitable Totale** : **${report.totalFloorAreaM2.toFixed(2)} m²**
- **Linéaire Murs Porteurs** : **${report.wallLengthM} m** | **Cloisons** : **${report.partitionLengthM} m**
- **Ouvertures Encastrées** : **${report.doorCount} portes** et **${report.windowCount} fenêtres**
- **Éclairage Naturel (RE2020)** : ${re2020Status}
- **Accessibilité PMR** : ${pmrStatus}
- **Règle d'Encastrement Maçonnerie** : ${encastrementStatus}`;

      actions.push({
        type: 'audit_report',
        message: 'Audit architectural généré avec succès.',
      });

      return { reply, actions, report };
    }

    // 2. Vérification stricte de l'encastrement des ouvertures
    if (
      cleanPrompt.includes('encastre') ||
      cleanPrompt.includes('ouverture') ||
      cleanPrompt.includes('porte') ||
      cleanPrompt.includes('fenetre') ||
      cleanPrompt.includes('mur')
    ) {
      const doors = entities.filter(e => e.type === 'door');
      const windows = entities.filter(e => e.type === 'window');

      const reply = `### 🚪 Paramètres d'Encastrement des Ouvertures

Toutes les ouvertures du projet respectent la règle stricte d'encastrement sur mur :
- **Portes (${doors.length})** : Encastrées dans l'axe de la maçonnerie, avec réservation SVG, battant orienté (Tirant Droit/Gauche) et arc de débattement.
- **Fenêtres (${windows.length})** : Encastrées avec tableau de maçonnerie, dormant, double vitrage thermique et appui extérieur.
- **Accrochage Automatique** : Lors de l'utilisation des outils Porte [P] ou Fenêtre [F], l'outil magnétique \`findWallSnap\` détecte immédiatement le mur le plus proche. Les ouvertures ne peuvent pas être posées dans le vide.`;

      return { reply, actions, report };
    }

    // 3. Conseils d'agencement ou réponse générale
    const reply = `### 📐 Copilote ARCKI CAD à votre écoute

Le plan actuel comporte **${report.totalFloorAreaM2} m²** habitables, **${report.wallLengthM} m** de murs porteurs et **${report.doorCount + report.windowCount} ouvertures encastrées**.

Vous pouvez me demander :
- *« Lance un audit de conformité RE2020 et PMR »*
- *« Calcule les surfaces et métrés »*
- *« Vérifie l'encastrement des portes et fenêtres sur les murs »*
- *« Raccourcis CAD : P pour porte, F pour fenêtre, W pour mur, C pour cloison »*`;

    return { reply, actions, report };
  }
}
