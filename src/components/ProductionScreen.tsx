import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Music,
  RotateCcw,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  createInitialProductionStages,
  detectExportCapabilities,
  getRenderDimensions,
  produceStoryVideo,
  type BrowserCodecCapabilities,
} from '../engines/videoRenderEngine';
import type { TtsEnginePreference } from '../types/audio';
import type {
  ExportFormat,
  ProductionProgress,
  RenderedVideoResult,
  StoryProject,
} from '../types/story';

interface ProductionScreenProps {
  story: StoryProject;
  onComplete: (result: RenderedVideoResult) => void;
  onBackToReview: () => void;
}

export const ProductionScreen: React.FC<ProductionScreenProps> = ({
  story,
  onComplete,
  onBackToReview,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const [capabilities, setCapabilities] = useState<BrowserCodecCapabilities | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('webm');
  const [ttsPrefOverride, setTtsPrefOverride] = useState<TtsEnginePreference>(
    story.input.ttsPreference || 'auto'
  );
  const [runKey, setRunKey] = useState(0);
  const [progress, setProgress] = useState<ProductionProgress>(() => ({
    stages: createInitialProductionStages(),
    currentFrame: 0,
    totalFrames: 1,
    currentSceneTitle: 'Preparing Voices',
    elapsedMs: 0,
    isComplete: false,
  }));

  useEffect(() => {
    detectExportCapabilities().then((caps) => {
      setCapabilities(caps);
      setSelectedFormat(caps.preferredFormat);
    });
  }, []);

  useEffect(() => {
    if (!capabilities) return;
    if (startedRef.current && runKey === 0) return;
    startedRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    produceStoryVideo({
      story,
      requestedFormat: selectedFormat,
      ttsPreference: ttsPrefOverride,
      previewCanvas: previewCanvasRef.current,
      signal: controller.signal,
      onProgress: (next) => {
        setProgress(next);
      },
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          onComplete(result);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Production failed.';
        setProgress((prev) => ({ ...prev, error: message }));
      });

    return () => {
      controller.abort();
    };
    // Intentionally run per runKey and initial capability detection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, runKey]);

  const audioMixUrl = useMemo(() => {
    if (!progress.audioMixWavBlob) return null;
    return URL.createObjectURL(progress.audioMixWavBlob);
  }, [progress.audioMixWavBlob]);

  useEffect(() => {
    return () => {
      if (audioMixUrl) {
        URL.revokeObjectURL(audioMixUrl);
      }
    };
  }, [audioMixUrl]);

  const dims = getRenderDimensions(story.input.aspectRatio);
  const framePct =
    progress.totalFrames > 0
      ? Math.min(100, Math.round((progress.currentFrame / progress.totalFrames) * 100))
      : 0;

  const renderingStagePending =
    progress.stages.find((s) => s.id === 'rendering')?.status === 'pending';

  const voiceInitActive =
    progress.stages.find((s) => s.id === 'voice_init')?.status === 'active';

  const readyClipsCount =
    progress.audioSegments?.filter((seg) => seg.status === 'ready').length ?? 0;
  const totalClipsCount = progress.audioSegments?.length ?? 0;

  const handleCancel = () => {
    abortRef.current?.abort();
    onBackToReview();
  };

  const handleRetry = (nextPreference?: TtsEnginePreference) => {
    if (nextPreference) {
      setTtsPrefOverride(nextPreference);
    }
    startedRef.current = false;
    setProgress({
      stages: createInitialProductionStages(),
      currentFrame: 0,
      totalFrames: 1,
      currentSceneTitle: 'Retrying Production',
      elapsedMs: 0,
      isComplete: false,
    });
    setRunKey((k) => k + 1);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f8fafc]">
            Producing Your Video
          </h1>
          <p className="text-sm text-[#94a3b8]">
            {story.title} · {story.input.aspectRatio} ·{' '}
            {capabilities?.webCodecsAvailable ? 'WebCodecs Video+Audio' : 'WebM Stream Renderer'}
            {progress.ttsEngineLabel ? ` · ${progress.ttsEngineLabel}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="h-10 px-4 rounded-xl bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#dfe2ee] self-start sm:self-auto cursor-pointer"
        >
          Cancel Production
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Render Monitor + Mixed Audio Player */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#94a3b8]">
              <span className="font-semibold text-[#dfe2ee]">Live Render Monitor</span>
              <span className="font-mono tabular-nums">
                {progress.currentFrame} / {progress.totalFrames} frames
              </span>
            </div>

            <div className="w-full flex items-center justify-center bg-[#0a0e16] rounded-xl overflow-hidden border border-white/[0.06] p-2">
              <canvas
                ref={previewCanvasRef}
                width={dims.width}
                height={dims.height}
                className="max-h-[380px] w-auto h-auto rounded-lg object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-[#cbd5e1] truncate">{progress.currentSceneTitle}</span>
                <span className="font-mono text-[#ffc174] font-semibold">{framePct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#0a0e16] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#4cd7f6] transition-all duration-150"
                  style={{ width: `${framePct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#64748b] tabular-nums">
                <span>Elapsed: {(progress.elapsedMs / 1000).toFixed(1)}s</span>
                <span>Format: {selectedFormat.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Master Audio Verification Card */}
          <div className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#f8fafc]">
                <Music className="w-4 h-4 text-[#4cd7f6]" />
                <span>Master Audio Mix</span>
              </div>
              {totalClipsCount > 0 && (
                <span className="text-[11px] text-[#94a3b8] tabular-nums">
                  {readyClipsCount} / {totalClipsCount} clips ready
                </span>
              )}
            </div>

            {audioMixUrl ? (
              <div className="space-y-2">
                <audio controls src={audioMixUrl} className="w-full h-10" />
                <p className="text-[11px] text-emerald-300">
                  Real speech, background music, environmental ambience, and SFX mixed cleanly. Audition above while rendering completes.
                </p>
                {progress.audioBedSummary && (
                  <p className="text-[11px] text-[#94a3b8] leading-snug">
                    {progress.audioBedSummary}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#64748b]">
                Master stereo track (narrator + dialogue + ducked music + ambience + SFX) will appear here for verification as soon as audio mixing finishes.
              </p>
            )}

            {progress.audioSegments && progress.audioSegments.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] max-h-56 overflow-y-auto space-y-2 pr-1">
                {progress.audioSegments.map((seg) => (
                  <div
                    key={seg.id}
                    className="rounded-lg bg-[#0f131c] border border-white/[0.05] px-2.5 py-2 flex items-start gap-2 text-xs"
                  >
                    <div className="mt-0.5 shrink-0">
                      {seg.status === 'ready' ? (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : seg.status === 'generating' ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#f59e0b] animate-spin" />
                      ) : seg.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5 text-[#ffb4ab]" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-[#31353e]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-semibold truncate ${
                            seg.speakerType === 'narrator' ? 'text-[#ffc174]' : 'text-[#4cd7f6]'
                          }`}
                        >
                          {seg.speakerName} · {seg.voiceLabel}
                        </span>
                        <span className="text-[11px] font-mono text-[#94a3b8] tabular-nums shrink-0">
                          {seg.status === 'ready' ? `${seg.durationSec.toFixed(2)}s` : seg.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94a3b8] truncate">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real 9-Stage Pipeline Progress */}
        <div className="lg:col-span-7 bg-[#181c24] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#f8fafc]">
              Production Pipeline
            </h2>
            {capabilities?.mp4Supported && (
              <div className="flex items-center gap-1 bg-[#0f131c] p-1 rounded-lg border border-white/[0.08]">
                {(['webm', 'mp4'] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={!renderingStagePending}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-colors cursor-pointer disabled:opacity-60 ${
                      selectedFormat === fmt
                        ? 'bg-[#06b6d4] text-[#0a0e16]'
                        : 'text-[#94a3b8] hover:text-[#f8fafc]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {voiceInitActive && progress.modelLoadProgressPct !== undefined && (
            <div className="rounded-xl bg-[#0f131c] border border-[#06b6d4]/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#4cd7f6] font-semibold truncate">
                  {progress.modelLoadStatus || 'Preparing neural voice model...'}
                </span>
                <span className="font-mono text-[#f8fafc] tabular-nums">
                  {progress.modelLoadProgressPct}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#1c2028] overflow-hidden">
                <div
                  className="h-full bg-[#06b6d4] transition-all duration-150"
                  style={{ width: `${progress.modelLoadProgressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="divide-y divide-white/[0.06]">
            {progress.stages.map((stage) => (
              <div key={stage.id} className="py-3 first:pt-1 last:pb-1 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {stage.status === 'complete' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : stage.status === 'active' ? (
                    <Loader2 className="w-5 h-5 text-[#f59e0b] animate-spin" />
                  ) : stage.status === 'error' ? (
                    <XCircle className="w-5 h-5 text-[#ffb4ab]" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[#31353e]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        stage.status === 'pending' ? 'text-[#64748b]' : 'text-[#f8fafc]'
                      }`}
                    >
                      {stage.label}
                    </p>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                      {stage.status === 'complete'
                        ? 'Done'
                        : stage.status === 'active'
                          ? 'Running'
                          : stage.status === 'error'
                            ? 'Failed'
                            : 'Queued'}
                    </span>
                  </div>
                  <p className="text-xs text-[#94a3b8]">{stage.detail}</p>
                  {stage.errorMessage && (
                    <p className="text-xs text-[#ffb4ab] pt-1">{stage.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {progress.error && (
            <div
              role="alert"
              className="rounded-xl bg-[#93000a]/35 border border-[#ffb4ab]/30 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5 text-sm text-[#ffdad6]">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Production Interrupted</p>
                  <p className="text-xs mt-1 opacity-90">{progress.error}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleRetry()}
                  className="h-10 px-4 rounded-lg bg-[#f59e0b] text-[#0a0e16] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry (Reuses Cached Clips)</span>
                </button>
                {ttsPrefOverride !== 'gemini-tts' && (
                  <button
                    type="button"
                    onClick={() => handleRetry('gemini-tts')}
                    className="h-10 px-4 rounded-lg bg-[#06b6d4] text-[#0a0e16] text-xs font-bold cursor-pointer"
                  >
                    Switch to Gemini Speech
                  </button>
                )}
                {ttsPrefOverride !== 'kokoro-local' && story.input.language === 'English' && (
                  <button
                    type="button"
                    onClick={() => handleRetry('kokoro-local')}
                    className="h-10 px-4 rounded-lg bg-[#262a33] border border-white/10 text-[#f8fafc] text-xs font-semibold cursor-pointer"
                  >
                    Try Local Kokoro-82M
                  </button>
                )}
                <button
                  type="button"
                  onClick={onBackToReview}
                  className="h-10 px-4 rounded-lg bg-[#262a33] text-[#f8fafc] text-xs font-semibold cursor-pointer"
                >
                  Return to Script
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
