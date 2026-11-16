import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Clapperboard,
  Loader2,
  Mic,
  RefreshCw,
  Users,
  Volume2,
} from 'lucide-react';
import { assignProjectVoices } from '../engines/audio/voiceAssignment';
import { previewVoiceLine } from '../engines/audio/ttsEngine';
import type { TtsEnginePreference } from '../types/audio';
import { StagePreviewCanvas } from './StagePreviewCanvas';
import type { StoryProject } from '../types/story';

const ENV_LABELS: Record<string, string> = {
  town_square: 'Village & Town Square',
  suburban_street: 'Suburban Street',
  city_street: 'City Commercial Street',
  cozy_house_interior: 'Cozy House Interior',
  modern_house_interior: 'Modern House Interior',
  forest_park: 'Forest & Stream Park',
  sci_fi_plaza: 'Sci-Fi Plaza',
  school_hallway: 'School Hallway',
  school_classroom: 'School Classroom',
};

const SHOT_LABELS: Record<string, string> = {
  wide_establishing: 'Wide Establishing',
  medium_two_shot: 'Medium Two-Shot',
  close_up_speaker: 'Close-Up Speaker',
  tracking_follow: 'Tracking Follow',
  slow_pan: 'Slow Pan',
  dramatic_push: 'Dramatic Push',
};

const TTS_ENGINE_OPTIONS: Array<{
  value: TtsEnginePreference;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto (Recommended)',
    description: 'Local browser Kokoro-82M for English, multilingual Gemini Speech otherwise',
  },
  {
    value: 'kokoro-local',
    label: 'Local Browser (Kokoro-82M)',
    description: '100% on-device neural voices (~86MB cached in browser, English)',
  },
  {
    value: 'gemini-tts',
    label: 'Gemini Speech (Server)',
    description: 'Cloud neural voices supporting all story languages',
  },
];

interface StoryReviewScreenProps {
  story: StoryProject;
  onUpdateStory: (updated: StoryProject) => void;
  onBackToCreate: () => void;
  onRegenerate: () => void;
  onApproveAndProduce: () => void;
  isRegenerating: boolean;
}

export const StoryReviewScreen: React.FC<StoryReviewScreenProps> = ({
  story,
  onUpdateStory,
  onBackToCreate,
  onRegenerate,
  onApproveAndProduce,
  isRegenerating,
}) => {
  const totalSec = story.scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const firstScene = story.scenes[0];
  const ttsPreference: TtsEnginePreference = story.input.ttsPreference || 'auto';

  const voiceAssignments = useMemo(() => assignProjectVoices(story), [story]);
  const narratorVoice = voiceAssignments.narrator;

  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    onUpdateStory({ ...story, title });
  };

  const handleTtsPreferenceChange = (pref: TtsEnginePreference) => {
    setPreviewError(null);
    onUpdateStory({
      ...story,
      input: {
        ...story.input,
        ttsPreference: pref,
      },
    });
  };

  const handleLineTextChange = (sceneId: string, lineId: string, newText: string) => {
    onUpdateStory({
      ...story,
      scenes: story.scenes.map((scene) =>
        scene.id !== sceneId
          ? scene
          : {
              ...scene,
              lines: scene.lines.map((line) =>
                line.id !== lineId ? line : { ...line, text: newText }
              ),
            }
      ),
    });
  };

  const handlePreviewSpeaker = async (speakerId: string, sampleText: string) => {
    const assignment = voiceAssignments[speakerId];
    if (!assignment) return;

    setPreviewError(null);
    setPreviewLoadingId(speakerId);
    setPreviewPlayingId(null);

    try {
      const result = await previewVoiceLine(
        sampleText,
        assignment,
        story.input.language,
        ttsPreference
      );
      setPreviewLoadingId(null);
      setPreviewPlayingId(speakerId);
      window.setTimeout(() => {
        setPreviewPlayingId((current) => (current === speakerId ? null : current));
      }, Math.max(800, Math.round(result.durationSec * 1000)));
    } catch (err: unknown) {
      setPreviewLoadingId(null);
      setPreviewPlayingId(null);
      setPreviewError(
        err instanceof Error ? err.message : 'Unable to preview voice audio.'
      );
    }
  };

  const getSampleLineForSpeaker = (speakerId: string, fallback: string): string => {
    for (const scene of story.scenes) {
      for (const line of scene.lines) {
        if (speakerId === 'narrator' && line.type === 'narration' && line.text.trim()) {
          return line.text.trim();
        }
        if (
          speakerId !== 'narrator' &&
          line.type === 'dialogue' &&
          line.speakerId === speakerId &&
          line.text.trim()
        ) {
          return line.text.trim();
        }
      }
    }
    return fallback;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackToCreate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8] hover:text-[#f8fafc] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Story Idea</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f8fafc]">
            Review Story &amp; Voices
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8] tabular-nums">
            <span>{story.input.genre}</span>
            <span aria-hidden="true">·</span>
            <span>{story.scenes.length} Scenes</span>
            <span aria-hidden="true">·</span>
            <span>{Math.round(totalSec)}s Est.</span>
            <span aria-hidden="true">·</span>
            <span>{story.input.language}</span>
            <span aria-hidden="true">·</span>
            <span>{story.input.aspectRatio}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#4cd7f6]">
              {story.source === 'gemini-ai' ? 'AI Generated' : 'On-Device Builder'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-11 px-4 rounded-xl bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] inline-flex items-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <button
            type="button"
            onClick={onApproveAndProduce}
            disabled={isRegenerating}
            className="h-11 px-5 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm inline-flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.28)]"
          >
            <Clapperboard className="w-4 h-4" />
            <span>Approve &amp; Produce</span>
          </button>
        </div>
      </div>

      {/* Overview + 3D Cast Preview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-[#181c24] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="review-title" className="text-xs font-semibold text-[#94a3b8]">
              Video Title
            </label>
            <input
              id="review-title"
              type="text"
              value={story.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#0f131c] border border-white/10 px-3.5 font-display font-bold text-base text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
            />
          </div>

          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-[#94a3b8]">Story Summary</h2>
            <p className="text-sm text-[#dfe2ee] leading-relaxed">{story.summary}</p>
          </div>

          {/* Voice Cast & Narrator Assignment */}
          <div className="pt-2 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94a3b8]">
                <Users className="w-3.5 h-3.5 text-[#4cd7f6]" />
                <span>Voice Cast &amp; Characters ({story.characters.length + 1})</span>
              </div>
              <span className="text-[11px] text-[#64748b]">
                Locked per character across all scenes
              </span>
            </div>

            {previewError && (
              <div
                role="alert"
                className="rounded-xl bg-[#93000a]/35 border border-[#ffb4ab]/30 px-3 py-2 text-xs text-[#ffdad6] flex items-center gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{previewError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Narrator Card */}
              <div className="bg-[#1c2028] border border-[#f59e0b]/25 rounded-xl p-3 flex items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg shrink-0 bg-[#262a33] border border-[#f59e0b]/30 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-[#ffc174]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#f8fafc] truncate">Story Narrator</p>
                    <p className="text-xs text-[#ffc174] truncate">{narratorVoice.voiceLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={previewLoadingId !== null}
                  onClick={() =>
                    handlePreviewSpeaker(
                      'narrator',
                      getSampleLineForSpeaker('narrator', story.summary)
                    )
                  }
                  className="h-8 px-2.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-[11px] font-semibold text-[#f8fafc] inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {previewLoadingId === 'narrator' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ffc174]" />
                  ) : (
                    <Volume2
                      className={`w-3.5 h-3.5 ${
                        previewPlayingId === 'narrator' ? 'text-[#4cd7f6]' : 'text-[#ffc174]'
                      }`}
                    />
                  )}
                  <span>{previewPlayingId === 'narrator' ? 'Playing' : 'Preview'}</span>
                </button>
              </div>

              {/* Character Voice Cards */}
              {story.characters.map((ch) => {
                const voice = voiceAssignments[ch.id];
                const isLoading = previewLoadingId === ch.id;
                const isPlaying = previewPlayingId === ch.id;
                return (
                  <div
                    key={ch.id}
                    className="bg-[#1c2028] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg shrink-0 border border-white/15 flex flex-col overflow-hidden">
                        <div
                          className="h-3.5 w-full"
                          style={{ backgroundColor: ch.appearance.skinColor }}
                        />
                        <div
                          className="flex-1 w-full"
                          style={{ backgroundColor: ch.appearance.shirtColor }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#f8fafc] truncate">{ch.name}</p>
                        <p className="text-xs text-[#94a3b8] truncate">
                          {ch.role} · {voice ? voice.voiceLabel : ch.appearance.hairStyle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={previewLoadingId !== null}
                      onClick={() =>
                        handlePreviewSpeaker(
                          ch.id,
                          getSampleLineForSpeaker(
                            ch.id,
                            `Hi, I'm ${ch.name}, and I'm ready for what happens next!`
                          )
                        )
                      }
                      className="h-8 px-2.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-[11px] font-semibold text-[#f8fafc] inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4cd7f6]" />
                      ) : (
                        <Volume2
                          className={`w-3.5 h-3.5 ${
                            isPlaying ? 'text-emerald-400' : 'text-[#4cd7f6]'
                          }`}
                        />
                      )}
                      <span>{isPlaying ? 'Playing' : 'Preview'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Speech Engine Selector */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#94a3b8]">Speech Voice Engine</span>
              <span className="text-[11px] text-[#64748b]">Free neural TTS · Embedded into video</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TTS_ENGINE_OPTIONS.map((opt) => {
                const selected = ttsPreference === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTtsPreferenceChange(opt.value)}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#262a33] border-[#06b6d4] text-[#f8fafc]'
                        : 'bg-[#0f131c] border-white/[0.06] text-[#94a3b8] hover:bg-[#1c2028]'
                    }`}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{opt.description}</p>
                  </button>
                );
              })}
            </div>
            {story.input.language !== 'English' && ttsPreference === 'kokoro-local' && (
              <p className="text-xs text-[#ffc174]">
                Note: Local Kokoro-82M voices are English-trained. Switch to Auto or Gemini Speech for {story.input.language}.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#181c24] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col min-h-[240px]">
          <StagePreviewCanvas
            characters={story.characters}
            environmentType={firstScene?.environmentType || 'town_square'}
            timeOfDay={firstScene?.timeOfDay || 'day'}
            className="flex-1 min-h-[210px]"
          />
          <div className="px-4 py-3 bg-[#1c2028] border-t border-white/[0.06] flex items-center justify-between text-xs text-[#94a3b8]">
            <span className="font-semibold text-[#dfe2ee]">3D Cast &amp; Opening Set</span>
            <span>{ENV_LABELS[firstScene?.environmentType || 'town_square']}</span>
          </div>
        </div>
      </div>

      {/* Scene-by-Scene Script */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-[#f8fafc]">
            Scene-by-Scene Script
          </h2>
          <span className="text-xs text-[#94a3b8]">
            Scene timings will automatically sync to spoken audio duration
          </span>
        </div>

        <div className="space-y-4">
          {story.scenes.map((scene) => (
            <div
              key={scene.id}
              className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-4 sm:p-5 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
                <h3 className="font-display text-base font-bold text-[#f8fafc]">
                  {String(scene.index).padStart(2, '0')}. {scene.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8] tabular-nums">
                  <span>{ENV_LABELS[scene.environmentType] || scene.environmentType}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{scene.timeOfDay}</span>
                  <span aria-hidden="true">·</span>
                  <span>{SHOT_LABELS[scene.cameraShot] || scene.cameraShot}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#ffc174] font-semibold">~{scene.durationSec}s</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {scene.lines.map((line) => {
                  const isNarration = line.type === 'narration';
                  const assigned = isNarration
                    ? narratorVoice
                    : line.speakerId
                      ? voiceAssignments[line.speakerId]
                      : undefined;

                  return (
                    <div key={line.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span
                          className={`font-bold truncate ${
                            isNarration ? 'text-[#ffc174]' : 'text-[#4cd7f6]'
                          }`}
                        >
                          {isNarration ? 'Narration' : `${line.speakerName} (Dialogue)`}
                          {assigned ? ` · ${assigned.voiceLabel}` : ''}
                        </span>
                        <span className="text-[#64748b] tabular-nums shrink-0">
                          {line.startOffsetSec.toFixed(1)}s · {line.emotion}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={line.text}
                        onChange={(e) =>
                          handleLineTextChange(scene.id, line.id, e.target.value)
                        }
                        className="w-full rounded-lg bg-[#0f131c] border border-white/[0.08] px-3 py-2 text-sm text-[#dfe2ee] focus:outline-none focus:ring-2 focus:ring-[#06b6d4]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onApproveAndProduce}
          disabled={isRegenerating}
          className="w-full sm:w-auto h-12 px-8 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-[0_0_24px_rgba(245,158,11,0.3)]"
        >
          <Clapperboard className="w-4 h-4" />
          <span>Approve &amp; Produce Video</span>
        </button>
      </div>
    </div>
  );
};
