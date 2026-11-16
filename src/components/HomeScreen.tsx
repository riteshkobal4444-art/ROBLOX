import React from 'react';
import { ArrowRight, Clapperboard, Film, Layers, Sparkles, Volume2 } from 'lucide-react';
import { StagePreviewCanvas } from './StagePreviewCanvas';
import type { CharacterSpec, RenderedVideoResult, StoryProject } from '../types/story';

const SHOWCASE_CHARACTERS: CharacterSpec[] = [
  {
    id: 'demo_1',
    name: 'Kai',
    role: 'Explorer',
    personality: 'Bold',
    appearance: {
      skinColor: '#f3cfb3',
      shirtColor: '#f59e0b',
      pantsColor: '#1e293b',
      hairStyle: 'spiky',
      hairColor: '#2d1b0e',
      faceExpression: 'happy',
      accessory: 'backpack',
      bodyScale: 1,
    },
    voiceProfile: { pitchHz: 185, speed: 1, timbre: 'energetic' },
  },
  {
    id: 'demo_2',
    name: 'Maya',
    role: 'Inventor',
    personality: 'Sharp',
    appearance: {
      skinColor: '#e0ac82',
      shirtColor: '#06b6d4',
      pantsColor: '#0f172a',
      hairStyle: 'ponytail',
      hairColor: '#1f2937',
      faceExpression: 'determined',
      accessory: 'headphones',
      bodyScale: 0.98,
    },
    voiceProfile: { pitchHz: 245, speed: 1, timbre: 'bright' },
  },
];

interface HomeScreenProps {
  onStartCreate: () => void;
  activeStory: StoryProject | null;
  activeVideo: RenderedVideoResult | null;
  onResumeSession: () => void;
  onOpenAssetLab?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartCreate,
  activeStory,
  activeVideo,
  onResumeSession,
  onOpenAssetLab,
}) => {
  return (
    <div className="space-y-8">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#181c24] border border-white/[0.07] rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#f59e0b]/10 blur-3xl"
          />
          <div className="space-y-4 relative">
            <p className="text-xs font-bold tracking-wider uppercase text-[#4cd7f6]">
              Browser-Based 3D Machinima Studio
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-[1.15] text-[#f8fafc] text-balance">
              Turn any story idea into an animated Roblox video.
            </h1>
            <p className="text-base text-[#cbd5e1] leading-relaxed max-w-xl">
              Describe what happens in plain words. StoryForge writes the script, builds blocky
              3D characters and sets, animates camera shots, mixes voice and music, and exports
              a video straight to your device.
            </p>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative">
            <button
              type="button"
              onClick={onStartCreate}
              className="h-12 px-7 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-[0_0_24px_rgba(245,158,11,0.28)]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create a Story</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {activeStory && (
              <button
                type="button"
                onClick={onResumeSession}
                className="h-12 px-5 rounded-full bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-sm font-semibold text-[#f8fafc] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{activeVideo ? 'Open Finished Video' : 'Resume Current Story'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live 3D Engine Preview */}
        <div className="lg:col-span-5 bg-[#181c24] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col min-h-[260px] lg:min-h-[340px]">
          <StagePreviewCanvas
            characters={SHOWCASE_CHARACTERS}
            environmentType="town_square"
            timeOfDay="sunset"
            className="flex-1 min-h-[220px]"
          />
          <div className="px-4 py-3 bg-[#1c2028] border-t border-white/[0.06] flex items-center justify-between text-xs text-[#94a3b8]">
            <span className="font-semibold text-[#dfe2ee]">Live 3D Stage Engine</span>
            <span>Real-time WebGL characters &amp; lighting</span>
          </div>
        </div>
      </section>

      {/* Active Temporary Session Card — Only rendered when real session data exists */}
      {activeStory ? (
        <section className="bg-[#1c2028] border border-[#f59e0b]/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#ffc174] font-semibold">
              <span>Current Session</span>
              <span aria-hidden="true">·</span>
              <span>{activeVideo ? 'Video Ready to Download' : 'Story Draft Ready'}</span>
            </div>
            <h2 className="font-display text-lg font-bold text-[#f8fafc]">{activeStory.title}</h2>
            <p className="text-sm text-[#cbd5e1] line-clamp-1">
              {activeStory.input.genre} · {activeStory.scenes.length} scenes ·{' '}
              {activeStory.input.aspectRatio}
            </p>
          </div>
          <button
            type="button"
            onClick={onResumeSession}
            className="h-11 px-5 rounded-xl bg-[#f59e0b] text-[#0a0e16] font-bold text-sm whitespace-nowrap shrink-0 hover:brightness-110 transition-all cursor-pointer"
          >
            {activeVideo ? 'Preview & Download' : 'Continue Session'}
          </button>
        </section>
      ) : (
        <section className="bg-[#181c24]/70 border border-white/[0.06] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="font-display text-sm font-bold text-[#dfe2ee]">
              No active session project yet
            </h2>
            <p className="text-sm text-[#94a3b8]">
              Everything runs directly in your browser with no sign-up required. Start a story to
              render and download your video.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartCreate}
            className="h-10 px-4 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Start Creating
          </button>
        </section>
      )}

      {/* 4-Step Automatic Filmmaking Pipeline */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-[#f8fafc]">
            How Automatic Filmmaking Works
          </h2>
          <span className="text-xs text-[#94a3b8]">No 3D or editing skills needed</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#181c24] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-[#f59e0b]/15 text-[#ffc174] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#f8fafc]">01. Story &amp; Script</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Enter your idea and choose genre, length, and format. Review the cast and scenes
              before production.
            </p>
          </div>

          <div className="bg-[#181c24] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-[#06b6d4]/15 text-[#4cd7f6] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#f8fafc]">02. Cast &amp; Worlds</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Consistent blocky characters and full 3D towns, streets, parks, or interiors are built
              automatically.
            </p>
          </div>

          <div className="bg-[#181c24] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-[#6366f1]/20 text-[#c7c8ff] flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#f8fafc]">03. Motion &amp; Audio</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Characters walk, gesture, and react while camera shots, music, SFX, and subtitles
              sync cleanly.
            </p>
          </div>

          <div className="bg-[#181c24] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-[#10b981]/15 text-emerald-300 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#f8fafc]">04. Render &amp; Save</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Your browser encodes a playable WebM or MP4 video file you can preview and download
              instantly.
            </p>
          </div>
        </div>
      </section>

      {onOpenAssetLab && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onOpenAssetLab}
            className="h-9 px-3.5 rounded-lg bg-[#181c24] hover:bg-[#222733] border border-white/[0.08] text-xs font-semibold text-[#94a3b8] hover:text-[#dfe2ee] transition-colors cursor-pointer"
          >
            3D Asset Import Lab (Test)
          </button>
        </div>
      )}

      <div className="hidden" aria-hidden="true">
        <Clapperboard />
      </div>
    </div>
  );
};
