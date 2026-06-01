import React from 'react';
import { UserStats } from '../types';

interface ShopTabProps {
  stats: UserStats;
  onUpdateStats: (newStats: UserStats) => void;
  setTab: (tab: 'home' | 'courses' | 'today' | 'settings' | 'community' | 'profile' | 'stats' | 'upgrade' | 'shop') => void;
  colorTheme: 'blue' | 'pink' | 'green' | 'orange';
  setColorTheme: (colorTheme: 'blue' | 'pink' | 'green' | 'orange') => void;
}

export default function ShopTab({ stats, onUpdateStats, setTab, colorTheme, setColorTheme }: ShopTabProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
      <h2 className="text-4xl font-black text-neutral-800 dark:text-neutral-100 uppercase tracking-tight">
        Coming Soon
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400">This feature is currently under development.</p>
      
      <div className="filter blur-md pointer-events-none opacity-50 space-y-8 max-w-4xl mx-auto p-4 md:p-6 font-sans">
        {/* Placeholder for future shop features */}
      </div>
    </div>
  );
}
