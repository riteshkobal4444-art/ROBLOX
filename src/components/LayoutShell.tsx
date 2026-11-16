import React from 'react';
import { Clapperboard, FolderOpen, Home, Plus } from 'lucide-react';
import type { AppRoute } from '../types/story';

interface LayoutShellProps {
  activeRoute: AppRoute;
  onNavigate: (route: 'home' | 'create' | 'projects') => void;
  hasActiveSession: boolean;
  hasRenderedVideo: boolean;
  onResumeActive?: () => void;
  children: React.ReactNode;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  activeRoute,
  onNavigate,
  hasActiveSession,
  hasRenderedVideo,
  onResumeActive,
  children,
}) => {
  const isHome = activeRoute === 'home';
  const isProjects = activeRoute === 'projects';
  const isCreateFlow =
    activeRoute === 'create' ||
    activeRoute === 'review' ||
    activeRoute === 'production' ||
    activeRoute === 'preview';

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 h-14 bg-[#0f131c]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#f59e0b] rounded-lg py-1"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0e16] flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.35)]">
              <Clapperboard className="w-4 h-4 stroke-[2.4]" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-[#f8fafc]">
              StoryForge
            </span>
          </button>

          {/* Zone 2: Desktop Nav Links (exact 3 items) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isHome
                  ? 'border-[#f59e0b] text-[#f8fafc]'
                  : 'border-transparent text-[#94a3b8] hover:text-[#dfe2ee]'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCreateFlow
                  ? 'border-[#f59e0b] text-[#f8fafc]'
                  : 'border-transparent text-[#94a3b8] hover:text-[#dfe2ee]'
              }`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isProjects
                  ? 'border-[#f59e0b] text-[#f8fafc]'
                  : 'border-transparent text-[#94a3b8] hover:text-[#dfe2ee]'
              }`}
            >
              Projects
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {hasActiveSession && onResumeActive && !isCreateFlow ? (
              <button
                type="button"
                onClick={onResumeActive}
                className="px-4 py-2 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hasRenderedVideo ? 'View Video' : 'Resume Draft'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('create')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] text-xs font-bold hover:brightness-110 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_16px_rgba(245,158,11,0.25)]"
              >
                New Story
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area with Safe Bottom Margin on Mobile */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-28 md:pb-12">
        {children}
      </main>

      {/* Mobile Fixed Bottom Navigation — Exactly 3 items: Home (left) | Create (center) | Projects (right) */}
      <nav
        aria-label="Primary Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0e16]/95 backdrop-blur-md border-t border-white/[0.08] pb-safe"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 items-center h-[68px] px-4">
          {/* Left: Home */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isHome ? 'text-[#f59e0b]' : 'text-[#64748b] hover:text-[#cbd5e1]'
            }`}
          >
            <Home className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[11px] font-semibold tracking-tight leading-none">Home</span>
          </button>

          {/* Center: Create (slightly larger rounded-square button with Plus icon & primary accent) */}
          <div className="flex flex-col items-center justify-center -mt-3">
            <button
              type="button"
              onClick={() => onNavigate('create')}
              aria-label="Create Story"
              className={`w-12 h-11 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0e16] shadow-[0_6px_18px_rgba(245,158,11,0.35)] ${
                isCreateFlow ? 'ring-2 ring-[#ffc174]/70' : ''
              }`}
            >
              <Plus className="w-6 h-6 stroke-[2.6]" />
            </button>
            <span
              className={`mt-1 text-[11px] font-bold tracking-tight leading-none ${
                isCreateFlow ? 'text-[#ffc174]' : 'text-[#dfe2ee]'
              }`}
            >
              Create
            </span>
          </div>

          {/* Right: Projects */}
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              isProjects ? 'text-[#f59e0b]' : 'text-[#64748b] hover:text-[#cbd5e1]'
            }`}
          >
            <FolderOpen className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[11px] font-semibold tracking-tight leading-none">Projects</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
