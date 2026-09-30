import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  variant?: 'full' | 'compact' | 'badge';
  proBadge?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  variant = 'full',
  proBadge = false,
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Precision CAD Logo Icon */}
      <div className={`relative ${iconSizes[size]} rounded-lg bg-[#0d1c2d] border border-[#3d494c]/40 flex items-center justify-center shadow-md overflow-hidden flex-none`}>
        <svg viewBox="0 0 32 32" className="w-full h-full p-1" fill="none">
          {/* Subtle grid background */}
          <path d="M4 16H28M16 4V28" stroke="#1c3a56" strokeWidth="0.5" strokeDasharray="1 1" />
          
          {/* Compass / Triangle "A" CAD Geometry */}
          <path
            d="M7 25L16 6L25 25"
            stroke="#4cd7f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Horizontal crossbar */}
          <path
            d="M10.5 19H21.5"
            stroke="#4cd7f6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Top orange orientation vector arrow */}
          <line x1="16" y1="6" x2="22" y2="2" stroke="#ffb95f" strokeWidth="2" strokeLinecap="round" />
          <polygon points="23,1 24,4 20,3" fill="#ffb95f" />
          
          {/* Green OSNAP Pivot point */}
          <circle cx="16" cy="6" r="2.2" fill="#4edea3" stroke="#051424" strokeWidth="0.8" />
        </svg>
      </div>

      {variant !== 'badge' && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-semibold text-on-surface tracking-tight text-[15px] font-sans">
              ARCKI <span className="text-primary font-bold">CAD</span>
            </span>
            {proBadge && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-primary font-bold tracking-wider">
                PRO 2025
              </span>
            )}
          </div>
          {showSubtitle && (
            <span className="font-mono text-[9px] text-tertiary tracking-widest uppercase font-semibold leading-tight mt-0.5">
              AI COPILOT
            </span>
          )}
        </div>
      )}
    </div>
  );
};
