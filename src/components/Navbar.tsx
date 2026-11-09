import React from 'react';
import { Camera, ShieldCheck, Activity, Settings, FileText, CheckCircle2, PlayCircle } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'analysis' | 'reference' | 'config' | 'events' | 'report' | 'benchmark';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasReference: boolean;
  isProcessing: boolean;
  totalAnalyzed: number;
  onRunQuickDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  hasReference,
  isProcessing,
  totalAnalyzed,
  onRunQuickDemo,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analysis', label: 'Live Analysis' },
    { id: 'reference', label: 'Reference Scene' },
    { id: 'benchmark', label: 'Validation Suite' },
    { id: 'events', label: 'Events & History' },
    { id: 'report', label: 'Scene Report' },
    { id: 'config', label: 'Configuration' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single Wordmark Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Camera className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
            CCTV Viewpoint & Consistency
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono tabular-nums text-slate-300">{totalAnalyzed}</span>
            <span>frames</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className={hasReference ? 'text-emerald-400' : 'text-amber-400'}>
              {hasReference ? 'Ref Active' : 'No Reference'}
            </span>
          </div>

          <button
            onClick={onRunQuickDemo}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors whitespace-nowrap shrink-0 font-sans"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Quick Test Suite</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Substrip */}
      <div className="lg:hidden flex overflow-x-auto border-t border-slate-900 px-4 py-1.5 gap-1 bg-slate-950/80">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`px-2.5 py-1 text-xs whitespace-nowrap rounded ${
              activeTab === item.id
                ? 'bg-slate-800 text-sky-400 font-medium'
                : 'text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
