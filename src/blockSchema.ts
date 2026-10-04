import { CadBlock } from './types.ts';

/**
 * Import de blocs : validation, assainissement du SVG et génération du prompt IA.
 *
 * Format d'échange (JSON) : un bloc, un tableau de blocs, ou { "blocks": [...] }.
 * Les vues sont des fragments SVG en millimètres (voir `BlockViews` dans types.ts).
 */

// ───────────────────────────── Assainissement SVG ─────────────────────────────

const ALLOWED_TAGS = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan']);
const ALLOWED_ATTRS = new Set([
  'd', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'fill-opacity', 'opacity', 'fill-rule', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dy', 'dx',
]);
const MAX_SVG_CHARS = 30000;
const MAX_NODES = 600;
const BAD_VALUE = /url\s*\(|javascript:|data:|expression|@import|<|&#/i;

/**
 * Ne conserve que des primitives graphiques SVG inoffensives (pas de script, de style, d'image, de lien externe).
 * Renvoie le fragment nettoyé, ou null si le SVG est invalide.
 */
export function sanitizeSvgFragment(markup: string): string | null {
  if (typeof markup !== 'string' || !markup.trim() || markup.length > MAX_SVG_CHARS) return null;
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  const root = doc.documentElement;
  let count = 0;
  const clean = (src: Element, dst: Element) => {
    for (const child of Array.from(src.childNodes)) {
      if (child.nodeType === 3) {
        if (src.localName === 'text' || src.localName === 'tspan') dst.appendChild(doc.createTextNode(child.textContent || ''));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      if (!ALLOWED_TAGS.has(el.localName)) continue; // élément interdit : ignoré avec ses enfants
      if (++count > MAX_NODES) return;
      const out = doc.createElementNS('http://www.w3.org/2000/svg', el.localName);
      for (const a of Array.from(el.attributes)) {
        if (ALLOWED_ATTRS.has(a.name) && !BAD_VALUE.test(a.value)) out.setAttribute(a.name, a.value);
      }
      clean(el, out);
      dst.appendChild(out);
    }
  };
  const holder = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  clean(root, holder);
  if (!holder.childNodes.length) return null;
  return Array.from(holder.childNodes).map(n => new XMLSerializer().serializeToString(n).replace(/ xmlns="[^"]*"/g, '')).join('');
}

// ───────────────────────────── Validation / import ─────────────────────────────

const CATEGORIES = ['sejour', 'cuisine', 'chambre', 'sanitaire', 'menuiserie', 'exterieur'] as const;
const RENDER_TYPES = ['table', 'sofa', 'bed', 'bath', 'shower', 'sink', 'wc', 'island', 'door', 'window', 'generic'] as const;

export interface ParsedBlocks {
  blocks: CadBlock[];
  warnings: string[];
  errors: string[];
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'bloc';
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN);

/** Analyse un texte JSON (un bloc, un tableau ou { blocks }) et le convertit en blocs valides. */
export function parseBlocksJson(text: string, existingIds: Set<string> = new Set()): ParsedBlocks {
  const res: ParsedBlocks = { blocks: [], warnings: [], errors: [] };
  let data: unknown;
  try {
    // tolère un bloc de code Markdown ```json … ``` collé depuis une IA
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    data = JSON.parse((m ? m[1] : text).trim());
  } catch {
    res.errors.push('JSON invalide : vérifiez les guillemets, virgules et accolades.');
    return res;
  }
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray((data as { blocks?: unknown[] })?.blocks) ? (data as { blocks: unknown[] }).blocks : [data];
  const used = new Set(existingIds);

  list.forEach((raw, i) => {
    const tag = `Bloc ${i + 1}`;
    if (!raw || typeof raw !== 'object') { res.errors.push(`${tag} : objet attendu.`); return; }
    const b = raw as Record<string, unknown>;
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 80) : '';
    if (!name) { res.errors.push(`${tag} : "name" est obligatoire.`); return; }
    const label = `« ${name} »`;

    const cat = CATEGORIES.includes(b.category as never) ? (b.category as CadBlock['category']) : undefined;
    let kind: 'furniture' | 'opening' = b.kind === 'opening' || cat === 'menuiserie' ? 'opening' : 'furniture';
    if (b.kind === 'furniture') kind = 'furniture';
    const category: CadBlock['category'] = kind === 'opening' ? 'menuiserie' : cat && cat !== 'menuiserie' ? cat : 'sejour';

    const w = num(b.widthMm), d = num(b.heightMm ?? b.depthMm), z = num(b.zMm ?? b.heightZMm);
    if (!(w >= 50 && w <= 10000)) { res.errors.push(`${label} : "widthMm" doit être compris entre 50 et 10000 (mm).`); return; }
    if (!(d >= 20 && d <= 10000)) { res.errors.push(`${label} : "heightMm" (profondeur, ou épaisseur de mur pour une ouverture) doit être compris entre 20 et 10000 (mm).`); return; }
    if (b.zMm !== undefined && !(z >= 20 && z <= 5000)) { res.errors.push(`${label} : "zMm" (hauteur) doit être compris entre 20 et 5000 (mm).`); return; }

    const openingKind: 'door' | 'window' | undefined =
      kind === 'opening' ? (b.openingKind === 'window' || (b.openingKind !== 'door' && /fen[eê]tre|baie|window|vitr/i.test(name)) ? 'window' : 'door') : undefined;

    // vues : top et front obligatoires pour une ouverture (2 vues) ; top, front et side pour un meuble (3 vues)
    const views: NonNullable<CadBlock['views']> = {};
    const rawViews = (b.views && typeof b.views === 'object' ? b.views : {}) as Record<string, unknown>;
    const needed: Array<'top' | 'front' | 'side'> = kind === 'opening' ? ['top', 'front'] : ['top', 'front', 'side'];
    for (const key of needed) {
      const v = rawViews[key];
      if (v === undefined || v === null || v === '') {
        res.warnings.push(`${label} : vue "${key}" absente — un symbole générique sera utilisé.`);
        continue;
      }
      const clean = typeof v === 'string' ? sanitizeSvgFragment(v) : null;
      if (!clean) res.warnings.push(`${label} : vue "${key}" invalide ou vide après nettoyage — symbole générique utilisé.`);
      else views[key] = clean;
    }

    let id = typeof b.id === 'string' && /^[\w-]{3,60}$/.test(b.id) ? b.id : `block-custom-${slug(name)}`;
    while (used.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    used.add(id);

    const renderType: CadBlock['renderType'] =
      kind === 'opening' ? (openingKind === 'window' ? 'window' : 'door') : RENDER_TYPES.includes(b.renderType as never) && b.renderType !== 'door' && b.renderType !== 'window' ? (b.renderType as CadBlock['renderType']) : 'generic';

    res.blocks.push({
      id,
      name,
      category,
      kind,
      openingKind,
      widthMm: Math.round(w),
      heightMm: Math.round(d),
      zMm: Number.isFinite(z) ? Math.round(z) : undefined,
      defaultLayer: kind === 'opening' ? 'ouvertures' : 'mobilier',
      icon: 'extension',
      description: typeof b.description === 'string' ? b.description.slice(0, 200) : 'Bloc importé',
      renderType,
      views: Object.keys(views).length ? views : undefined,
      custom: true,
    });
  });
  if (!res.blocks.length && !res.errors.length) res.errors.push('Aucun bloc trouvé dans le JSON.');
  return res;
}

// ───────────────────────────── Génération du prompt IA ─────────────────────────────

export interface BlockSpec {
  name: string;
  kind: 'furniture' | 'opening';
  category: string; // sejour | cuisine | chambre | sanitaire | exterieur (mobilier)
  openingKind?: 'door' | 'window';
  widthMm: number;
  depthMm: number; // profondeur, ou épaisseur de mur pour une ouverture
  zMm: number;
  notes?: string;
}

/** Lit des lignes « Nom — 1800 x 900 x 750 » (dimensions facultatives) et les convertit en spécifications. */
export function parseSpecLines(text: string, defaults: Omit<BlockSpec, 'name'>): BlockSpec[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const m = l.match(/(\d{2,5})\s*[x×*]\s*(\d{2,5})(?:\s*[x×*]\s*(\d{2,5}))?/);
      const name = l.replace(/[—–:-]?\s*\d{2,5}\s*[x×*].*$/, '').replace(/[—–:\-\s]+$/, '').trim() || l;
      return {
        ...defaults,
        name,
        widthMm: m ? Number(m[1]) : defaults.widthMm,
        depthMm: m ? Number(m[2]) : defaults.depthMm,
        zMm: m && m[3] ? Number(m[3]) : defaults.zMm,
      };
    });
}

const EXAMPLE_FURNITURE = {
  name: 'Table basse ronde',
  kind: 'furniture',
  category: 'sejour',
  widthMm: 900,
  heightMm: 900,
  zMm: 400,
  description: 'Table basse ronde, plateau bois sur 4 pieds',
  views: {
    top: "<circle cx='450' cy='450' r='440' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><circle cx='450' cy='450' r='340' fill='none' stroke='currentColor' stroke-width='8' stroke-opacity='0.5'/>",
    front: "<rect x='0' y='0' width='900' height='45' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><rect x='80' y='45' width='50' height='355' fill='none' stroke='currentColor' stroke-width='12'/><rect x='770' y='45' width='50' height='355' fill='none' stroke='currentColor' stroke-width='12'/>",
    side: "<rect x='0' y='0' width='900' height='45' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><rect x='80' y='45' width='50' height='355' fill='none' stroke='currentColor' stroke-width='12'/><rect x='770' y='45' width='50' height='355' fill='none' stroke='currentColor' stroke-width='12'/>",
  },
};

const EXAMPLE_OPENING = {
  name: 'Fenêtre 1 vantail 800x1250',
  kind: 'opening',
  category: 'menuiserie',
  openingKind: 'window',
  widthMm: 800,
  heightMm: 200,
  zMm: 1250,
  description: 'Fenêtre à la française 1 vantail, double vitrage',
  views: {
    top: "<rect x='0' y='0' width='60' height='200' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><rect x='740' y='0' width='60' height='200' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><rect x='60' y='60' width='680' height='24' fill='none' stroke='currentColor' stroke-width='10'/><rect x='60' y='130' width='680' height='24' fill='none' stroke='currentColor' stroke-width='10'/>",
    front: "<rect x='0' y='0' width='800' height='1250' fill='none' stroke='currentColor' stroke-width='18'/><rect x='60' y='60' width='680' height='1130' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/><rect x='0' y='1190' width='800' height='60' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='12'/>",
  },
};

/**
 * Prompt prêt à coller dans une IA : explique le format JSON, le repère des vues et les règles de dessin SVG,
 * et liste les blocs à créer (nom, type, dimensions) à partir des données saisies.
 */
export function buildBlockPrompt(specs: BlockSpec[]): string {
  const hasF = specs.some(s => s.kind === 'furniture');
  const hasO = specs.some(s => s.kind === 'opening');
  const lines = specs.map((s, i) => {
    const dims = s.kind === 'opening'
      ? `largeur de passage ${s.widthMm} mm, épaisseur de mur ${s.depthMm} mm, hauteur ${s.zMm} mm`
      : `largeur ${s.widthMm} mm, profondeur ${s.depthMm} mm, hauteur ${s.zMm} mm`;
    const type = s.kind === 'opening' ? `ouverture (${s.openingKind === 'window' ? 'fenêtre / baie' : 'porte'})` : `mobilier (catégorie "${s.category}")`;
    return `${i + 1}. « ${s.name} » — ${type} — ${dims}${s.notes ? ` — ${s.notes}` : ''}`;
  });

  return `Tu es un dessinateur CAO d'architecture. Tu génères des blocs 2D pour un logiciel de plans (ARCKI CAD) sous forme de JSON contenant des fragments SVG. Respecte STRICTEMENT le format ci-dessous : le JSON sera importé automatiquement.

## BLOCS À CRÉER
${lines.join('\n')}

## FORMAT DE SORTIE
Réponds UNIQUEMENT avec un bloc de code \`\`\`json contenant un objet { "blocks": [ ... ] } (un élément par bloc demandé, dans l'ordre). Aucun texte avant ou après.

Chaque bloc :
{
  "name": string,                       // nom du bloc
  "kind": "furniture" | "opening",      // mobilier ou ouverture
  "category": "sejour" | "cuisine" | "chambre" | "sanitaire" | "exterieur" | "menuiserie",   // "menuiserie" pour kind "opening"
  "openingKind": "door" | "window",     // uniquement si kind = "opening"
  "widthMm": number,                    // largeur X (mm)
  "heightMm": number,                   // PROFONDEUR Y au plan (mm) ; pour une ouverture : épaisseur du mur (mm)
  "zMm": number,                        // hauteur verticale Z (mm)
  "description": string,                // une phrase
  "views": { "top": string, "front": string, "side": string }   // fragments SVG (voir ci-dessous)
}

## LES VUES (fragments SVG sans balise <svg>)
Repère commun : MILLIMÈTRES, origine en haut à gauche, x vers la droite, y vers le bas. Les coordonnées doivent remplir la boîte exactement.
${hasF ? `
### Mobilier : 3 vues obligatoires ("top", "front", "side")
- "top"   = vue de DESSUS (plan). Boîte : x de 0 à widthMm, y de 0 à heightMm. Le DOS / l'arrière de l'objet est en haut (y = 0), la FACE d'usage est en bas (y = heightMm).
- "front" = vue de FACE (élévation, vue depuis l'avant). Boîte : x de 0 à widthMm, y de 0 à zMm. Le SOL est en bas (y = zMm), le dessus de l'objet en haut (y = 0).
- "side"  = vue LATÉRALE gauche. Boîte : x de 0 à heightMm (arrière à gauche, face à droite), y de 0 à zMm (sol en bas).
Les trois vues doivent représenter le MÊME objet avec des cotes cohérentes (un pied visible en dessus se retrouve en face et de côté).` : ''}${hasO ? `
### Ouvertures (portes, fenêtres, baies) : 2 vues obligatoires ("top", "front") — pas de "side"
- "top"   = COUPE HORIZONTALE du mur à hauteur d'allège. Boîte : x de 0 à widthMm (passage), y de 0 à heightMm (épaisseur du mur). Dessine les tableaux/jambages (extrémités), le dormant, les vantaux et vitrages, l'appui. Intérieur du logement en bas (y = heightMm).
- "front" = vue de FACE de la menuiserie (élévation, côté intérieur). Boîte : x de 0 à widthMm, y de 0 à zMm, sol / bas de la baie en bas. Dessine dormant, ouvrant(s), vitrage, poignée, appui.` : ''}

## RÈGLES DE DESSIN SVG (le fragment est vérifié et nettoyé à l'import)
- Éléments autorisés UNIQUEMENT : g, path, rect, circle, ellipse, line, polyline, polygon, text. Rien d'autre (pas de style, script, image, use, defs, dégradé, filtre).
- Couleurs : uniquement currentColor. Traits : stroke='currentColor' fill='none' ; surfaces : fill='currentColor' fill-opacity='0.16' (léger) ou '0.55' (plein).
- Épaisseur de trait en millimètres : stroke-width entre 8 et 20 (contours), 6 à 10 (détails fins). Pointillés possibles avec stroke-dasharray.
- Utilise des guillemets SIMPLES pour les attributs SVG (le SVG est dans une chaîne JSON) et écris chaque vue sur UNE seule ligne, sans retour à la ligne.
- Pas de valeurs url(...), pas de liens, pas d'attributs d'événement.
- Reste lisible à petite taille : formes simples, pas plus de ~40 éléments par vue.

## EXEMPLE VALIDE
\`\`\`json
${JSON.stringify({ blocks: [hasF || !hasO ? EXAMPLE_FURNITURE : EXAMPLE_OPENING] }, null, 2)}
\`\`\`
${hasF && hasO ? `
Exemple d'ouverture :
\`\`\`json
${JSON.stringify(EXAMPLE_OPENING, null, 2)}
\`\`\`
` : ''}
Vérifie avant de répondre : JSON valide, toutes les vues demandées présentes, dimensions en mm identiques à celles de la liste, SVG limité aux éléments autorisés.`;
}
