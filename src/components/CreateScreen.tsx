import React, { useState } from 'react';
import { AlertCircle, Cpu, Loader2, Sparkles, Wand2 } from 'lucide-react';
import type {
  AspectRatioOption,
  GenreOption,
  LanguageOption,
  StoryFormInput,
} from '../types/story';

const GENRES: GenreOption[] = [
  'Adventure',
  'Comedy',
  'Mystery',
  'Sci-Fi',
  'Slice of Life',
  'Horror',
];

const DURATIONS: Array<{ value: StoryFormInput['targetDurationSec']; label: string }> = [
  { value: 15, label: '15s Short' },
  { value: 30, label: '30s Story' },
  { value: 45, label: '45s Mini-Film' },
  { value: 60, label: '60s Feature' },
];

const LANGUAGES: LanguageOption[] = [
  'English',
  'Spanish',
  'French',
  'Portuguese',
  'Japanese',
  'Hindi',
];

const ASPECT_RATIOS: Array<{ value: AspectRatioOption; label: string; hint: string }> = [
  { value: '9:16', label: '9:16', hint: 'Vertical Shorts' },
  { value: '16:9', label: '16:9', hint: 'Widescreen' },
  { value: '1:1', label: '1:1', hint: 'Square' },
];

const PROMPT_STARTERS = [
  'Two best friends find a glowing portal behind their neighborhood bakery after sunset.',
  'A nervous new student tries to return a lost robot puppy before the school bell rings.',
  'Three neighbors race across town square to catch a runaway pizza delivery drone.',
];

interface CreateScreenProps {
  initialInput: StoryFormInput;
  isGenerating: boolean;
  generationError: string | null;
  onGenerateAI: (input: StoryFormInput) => void;
  onGenerateLocalFallback: (input: StoryFormInput) => void;
}

export const CreateScreen: React.FC<CreateScreenProps> = ({
  initialInput,
  isGenerating,
  generationError,
  onGenerateAI,
  onGenerateLocalFallback,
}) => {
  const [form, setForm] = useState<StoryFormInput>(initialInput);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.prompt.trim();
    if (trimmed.length < 12) {
      setValidationError(
        'Please describe your story idea in at least 12 characters so we can build scenes and dialogue.'
      );
      return;
    }
    setValidationError(null);
    onGenerateAI({ ...form, prompt: trimmed, title: form.title?.trim() || undefined });
  };

  const handleLocalFallback = () => {
    const trimmed = form.prompt.trim();
    if (trimmed.length < 12) {
      setValidationError('Please enter a story idea of at least 12 characters first.');
      return;
    }
    setValidationError(null);
    onGenerateLocalFallback({ ...form, prompt: trimmed, title: form.title?.trim() || undefined });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f8fafc]">
          Create Your Story
        </h1>
        <p className="text-sm sm:text-base text-[#94a3b8]">
          Tell us what happens. StoryForge handles the characters, sets, camera angles, and sound.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-5 sm:p-7 space-y-6"
      >
        {/* Story Prompt */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="story-prompt" className="text-sm font-semibold text-[#f8fafc]">
              Story Idea
            </label>
            <span className="text-xs text-[#94a3b8] tabular-nums">
              {form.prompt.trim().length} / 500
            </span>
          </div>
          <textarea
            id="story-prompt"
            rows={4}
            maxLength={500}
            value={form.prompt}
            disabled={isGenerating}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, prompt: e.target.value }));
              if (validationError) setValidationError(null);
            }}
            placeholder="Example: Two blocky explorers discover a secret glowing arcade underneath their quiet town square..."
            className="w-full rounded-xl bg-[#0f131c] border border-white/10 px-4 py-3 text-sm sm:text-base text-[#f8fafc] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#06b6d4] transition-shadow resize-y"
          />

          {/* Quick-fill prompt ideas */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            <span className="text-xs text-[#64748b] whitespace-nowrap shrink-0">Try:</span>
            {PROMPT_STARTERS.map((starter, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  setForm((prev) => ({ ...prev, prompt: starter }));
                  setValidationError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] border border-white/[0.06] text-xs text-[#cbd5e1] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Idea {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Title */}
        <div className="space-y-2">
          <label htmlFor="story-title" className="text-sm font-semibold text-[#f8fafc]">
            Title <span className="text-xs font-normal text-[#64748b]">(optional)</span>
          </label>
          <input
            id="story-title"
            type="text"
            maxLength={60}
            value={form.title || ''}
            disabled={isGenerating}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Leave blank to auto-generate a title"
            className="w-full h-11 rounded-xl bg-[#0f131c] border border-white/10 px-4 text-sm text-[#f8fafc] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
          />
        </div>

        {/* Genre Selector */}
        <div className="space-y-2.5">
          <span className="block text-sm font-semibold text-[#f8fafc]">Genre</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {GENRES.map((genre) => {
              const selected = form.genre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setForm((prev) => ({ ...prev, genre }))}
                  className={`h-11 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                    selected
                      ? 'bg-[#06b6d4] text-[#0a0e16] border-[#4cd7f6]'
                      : 'bg-[#1c2028] text-[#cbd5e1] border-white/[0.06] hover:bg-[#262a33]'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration & Aspect Ratio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <span className="block text-sm font-semibold text-[#f8fafc]">Approximate Length</span>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((d) => {
                const selected = form.targetDurationSec === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    disabled={isGenerating}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, targetDurationSec: d.value }))
                    }
                    className={`h-11 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap tabular-nums ${
                      selected
                        ? 'bg-[#262a33] text-[#ffc174] border-[#f59e0b]'
                        : 'bg-[#1c2028] text-[#cbd5e1] border-white/[0.06] hover:bg-[#262a33]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="block text-sm font-semibold text-[#f8fafc]">Video Aspect Ratio</span>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ar) => {
                const selected = form.aspectRatio === ar.value;
                return (
                  <button
                    key={ar.value}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setForm((prev) => ({ ...prev, aspectRatio: ar.value }))}
                    className={`py-2 px-2 rounded-xl transition-all cursor-pointer border flex flex-col items-center justify-center ${
                      selected
                        ? 'bg-[#262a33] text-[#4cd7f6] border-[#06b6d4]'
                        : 'bg-[#1c2028] text-[#cbd5e1] border-white/[0.06] hover:bg-[#262a33]'
                    }`}
                  >
                    <span className="text-xs font-bold tabular-nums">{ar.label}</span>
                    <span className="text-[10px] opacity-75 whitespace-nowrap">{ar.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2.5">
          <label htmlFor="story-language" className="block text-sm font-semibold text-[#f8fafc]">
            Script &amp; Subtitle Language
          </label>
          <select
            id="story-language"
            value={form.language}
            disabled={isGenerating}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, language: e.target.value as LanguageOption }))
            }
            className="w-full h-11 rounded-xl bg-[#0f131c] border border-white/10 px-4 text-sm text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div
            role="alert"
            className="rounded-xl bg-[#93000a]/40 border border-[#ffb4ab]/30 px-4 py-3 text-sm text-[#ffdad6] flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Server Generation Error + Honest On-Device Fallback Option */}
        {generationError && (
          <div
            role="alert"
            className="rounded-xl bg-[#1c2028] border border-[#ffb4ab]/35 p-4 space-y-3"
          >
            <div className="flex items-start gap-2.5 text-sm text-[#ffb4ab]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">AI Story Generation Unavailable</p>
                <p className="text-xs text-[#cbd5e1] mt-1">{generationError}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                disabled={isGenerating}
                className="h-10 px-4 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] cursor-pointer"
              >
                Retry AI Generation
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleLocalFallback}
                className="h-10 px-4 rounded-lg bg-[#06b6d4] hover:brightness-110 text-xs font-bold text-[#0a0e16] flex items-center gap-1.5 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Use On-Device Story Builder</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Action */}
        <div className="pt-1 space-y-2.5">
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full h-12 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer shadow-[0_0_24px_rgba(245,158,11,0.28)]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Writing Story &amp; Directing Scenes...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate Story</span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-[#64748b]">
            Free browser production · Processing speed depends on your device GPU and memory
          </p>
        </div>
      </form>

      <div className="hidden" aria-hidden="true">
        <Sparkles />
      </div>
    </div>
  );
};
