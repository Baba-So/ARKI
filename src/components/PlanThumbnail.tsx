import React, { useMemo } from 'react';
import { CadEntity } from '../types.ts';
import { computeWallPolygons, polyToPoints } from '../wallGeometry.ts';

/** Vignette technique d'un plan (niveau donné) pour le tableau de bord : murs, cloisons, ouvertures, pièces. */
export const PlanThumbnail: React.FC<{ entities: CadEntity[]; className?: string }> = ({ entities, className }) => {
  const data = useMemo(() => {
    const geo = entities.filter(e => !['dim', 'text'].includes(e.type));
    if (!geo.length) return null;
    const polys = computeWallPolygons(entities.filter(e => e.type === 'wall' || e.type === 'partition'));
    const pts: Array<{ x: number; y: number }> = [];
    Object.values(polys).forEach(p => pts.push(...p));
    geo.filter(e => e.type !== 'wall' && e.type !== 'partition').forEach(e => pts.push({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = Math.max(maxX - minX, maxY - minY) * 0.06 + 6;
    return { polys, vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`, size: Math.max(maxX - minX, maxY - minY) };
  }, [entities]);

  if (!data) {
    return (
      <div className={`flex flex-col items-center justify-center text-outline font-mono text-[10px] gap-1 ${className || ''}`}>
        <span className="material-symbols-outlined text-[28px] opacity-50">architecture</span>
        Plan vide
      </div>
    );
  }
  const sw = data.size / 220; // épaisseur de trait relative à la taille du plan

  return (
    <svg viewBox={data.vb} className={className} preserveAspectRatio="xMidYMid meet">
      {entities.filter(e => e.type === 'room').map(e => (
        <rect key={e.id} x={Math.min(e.x1, e.x2)} y={Math.min(e.y1, e.y2)} width={Math.abs(e.x2 - e.x1)} height={Math.abs(e.y2 - e.y1)} fill="#0b2437" fillOpacity={0.55} stroke="#173048" strokeWidth={sw} />
      ))}
      {entities.filter(e => e.type === 'furniture').map(e => (
        <rect key={e.id} x={Math.min(e.x1, e.x2)} y={Math.min(e.y1, e.y2)} width={Math.abs(e.x2 - e.x1)} height={Math.abs(e.y2 - e.y1)} fill="none" stroke="#ffb95f" strokeOpacity={0.55} strokeWidth={sw * 0.8} />
      ))}
      {entities.filter(e => e.type === 'wall' || e.type === 'partition').map(e =>
        data.polys[e.id] ? (
          <polygon key={e.id} points={polyToPoints(data.polys[e.id])} fill={e.type === 'wall' ? '#0e3550' : '#13293b'} stroke="#4cd7f6" strokeWidth={e.type === 'wall' ? sw * 1.3 : sw} strokeLinejoin="round" />
        ) : null
      )}
      {entities.filter(e => e.type === 'door' || e.type === 'window').map(e => (
        <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.type === 'door' ? '#ffb95f' : '#4edea3'} strokeWidth={sw * 2.4} strokeLinecap="butt" />
      ))}
      {entities.filter(e => e.type === 'rect' || e.type === 'circle' || e.type === 'polygon' || e.type === 'polyline' || e.type === 'line').map(e => {
        if (e.type === 'circle') return <circle key={e.id} cx={e.x1} cy={e.y1} r={e.radius || 0} fill="none" stroke="#869397" strokeWidth={sw} />;
        if (e.type === 'rect') return <rect key={e.id} x={Math.min(e.x1, e.x2)} y={Math.min(e.y1, e.y2)} width={Math.abs(e.x2 - e.x1)} height={Math.abs(e.y2 - e.y1)} fill="none" stroke="#869397" strokeWidth={sw} />;
        const p = e.points && e.points.length ? e.points : [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
        return <polyline key={e.id} points={p.map(q => `${q.x},${q.y}`).join(' ') + (e.isClosed ? ` ${p[0].x},${p[0].y}` : '')} fill="none" stroke="#869397" strokeWidth={sw} />;
      })}
    </svg>
  );
};
