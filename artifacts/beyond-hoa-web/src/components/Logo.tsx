import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "h-9 w-auto", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Dark Indigo Matching Logo Icon */}
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main branding deep indigo gradient matching indigo-900 / indigo-950 vibes */}
          <linearGradient id="indigoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" /> {/* Indigo 600 for highlight */}
            <stop offset="50%" stopColor="#3730a3" /> {/* Indigo 800 */}
            <stop offset="100%" stopColor="#1e1b4b" /> {/* Indigo 950 for deep shadows */}
          </linearGradient>
          
          {/* Bright accent lavender-indigo for the overlapping ribbon highlight */}
          <linearGradient id="lightIndigoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" /> {/* Indigo 400 */}
            <stop offset="100%" stopColor="#4f46e5" /> {/* Indigo 600 */}
          </linearGradient>
        </defs>

        {/* Outer Ribbon Track */}
        <path
          d="M 50 8 C 22 8, 8 22, 8 50 C 8 78, 22 92, 50 92 C 78 92, 92 78, 92 50 C 92 22, 78 8, 50 8 Z"
          fill="url(#indigoGradient)"
        />

        {/* Overlapping Ribbon Highlight (Creates the 3D folded look) */}
        <path
          d="M 50 8 C 68 8, 84 18, 90 38 C 92 44, 92 56, 88 64 C 80 80, 64 92, 50 92 C 55 84, 58 74, 58 64 C 58 44, 40 24, 20 16 C 30 10, 40 8, 50 8 Z"
          fill="url(#lightIndigoGradient)"
          opacity="0.9"
        />

        {/* Inner House Silhouette */}
        <path
          d="M 50 25 L 22 48 L 22 75 L 78 75 L 78 48 Z"
          fill="#FFFFFF"
        />

        {/* 4-Pane Window recolored to Indigo-900 */}
        <rect x="41" y="48" width="8" height="8" fill="#312e81" rx="1" />
        <rect x="51" y="48" width="8" height="8" fill="#312e81" rx="1" />
        <rect x="41" y="58" width="8" height="8" fill="#312e81" rx="1" />
        <rect x="51" y="58" width="8" height="8" fill="#312e81" rx="1" />
      </svg>

      {/* Matching Text */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-white font-bold text-base leading-tight tracking-wider uppercase">
            Beyond HOA
          </span>
          <span className="text-indigo-200 text-[10px] tracking-wide uppercase">
            Community Portal
          </span>
        </div>
      )}
    </div>
  );
}
