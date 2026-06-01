import React from 'react';

interface TestLogoProps {
  className?: string;
}

export default function TestLogo({ className = "w-12 h-12" }: TestLogoProps) {
  return (
    <svg 
      className={`${className} transform hover:scale-105 transition-all cursor-pointer hover:rotate-6 active:translate-y-0.5`}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Dynamic theme-aware gradients */}
        <linearGradient id="logo-back-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--theme-primary)" />
          <stop offset="100%" stopColor="var(--theme-secondary)" />
        </linearGradient>
        <filter id="logo-depth-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* 3D Isometric Base with Border and Shadow */}
      <rect 
        x="6" 
        y="12" 
        width="88" 
        height="76" 
        rx="26" 
        fill="var(--theme-secondary)" 
      />
      <rect 
        x="6" 
        y="6" 
        width="88" 
        height="76" 
        rx="26" 
        fill="url(#logo-back-grad)" 
        filter="url(#logo-depth-shadow)"
      />

      {/* Shimmer / Highlight arc at the top edge */}
      <path 
        d="M14 12 C30 8, 70 8, 86 12" 
        stroke="#FFFFFF" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        opacity="0.25" 
      />

      {/* Academic Cap / Learning Pathway inside */}
      {/* Cap Top Diamond */}
      <path 
        d="M50 24 L80 35 L50 46 L20 35 Z" 
        fill="#FFFFFF" 
        stroke="#FFFFFF" 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
      />
      
      {/* Cap Capstone Accent */}
      <path 
        d="M50 28 L72 35 L50 42 L28 35 Z" 
        fill="var(--theme-primary)" 
        opacity="0.3"
      />

      {/* Cap Skull Crest */}
      <path 
        d="M32 40 V54 C32 60, 50 64, 50 64 C50 64, 68 60, 68 54 V40" 
        stroke="#FFFFFF" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />

      {/* Graduation Tassel */}
      <path 
        d="M80 35 V56" 
        stroke="#FFFFFF" 
        strokeWidth="4.5" 
        strokeLinecap="round" 
      />
      
      {/* Tassel Circle */}
      <circle 
        cx="80" 
        cy="56" 
        r="4.5" 
        fill="#FFFFFF" 
      />
    </svg>
  );
}
