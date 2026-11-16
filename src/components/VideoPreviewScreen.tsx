import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import type { RenderedVideoResult } from '../types/story';

interface VideoPreviewScreenProps {
  video: RenderedVideoResult;
  onStartNewProject: () => void;
  onReRender: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const VideoPreviewScreen: React.FC<VideoPreviewScreenProps> = ({
  video,
  onStartNewProject,
  onReRender,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const objectUrl = useMemo(() => URL.createObjectURL(video.blob), [video.blob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (el.paused) {
        await el.play();
        setIsPlaying(true);
      } else {
        el.pause();
        setIsPlaying(false);
      }
    } catch {
      setPlaybackError('Browser could not start playback. You can still download the file below.');
    }
  };

  const handleDownload = () => {
    const safeName =
      video.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'storyforge-video';
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${safeName}.${video.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Video Rendered &amp; Ready
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f8fafc]">
          {video.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8] tabular-nums">
          <span>{video.durationSec.toFixed(1)}s</span>
          <span aria-hidden="true">·</span>
          <span>
            {video.width}×{video.height} ({video.aspectRatio})
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(video.fileSizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <span className="uppercase">{video.format}</span>
          <span aria-hidden="true">·</span>
          <span>{video.codecSummary}</span>
          {video.ttsSummary && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#4cd7f6]">{video.ttsSummary}</span>
            </>
          )}
        </div>
        {video.audioBedSummary && (
          <p className="text-xs text-[#94a3b8]">{video.audioBedSummary}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Video Player */}
        <div className="lg:col-span-7 bg-[#0a0e16] border border-white/[0.08] rounded-2xl p-3 flex flex-col items-center">
          <video
            ref={videoRef}
            src={objectUrl}
            controls
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() =>
              setPlaybackError(
                'Preview playback encountered a codec issue in this browser, though the file was generated.'
              )
            }
            className="w-full max-h-[520px] rounded-xl bg-black object-contain"
          />

          {playbackError && (
            <div
              role="alert"
              className="w-full mt-3 rounded-xl bg-[#93000a]/35 border border-[#ffb4ab]/30 px-3.5 py-2.5 text-xs text-[#ffdad6] flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{playbackError}</span>
            </div>
          )}
        </div>

        {/* Export & Actions Panel */}
        <div className="lg:col-span-5 bg-[#181c24] border border-white/[0.07] rounded-2xl p-5 space-y-5">
          <div className="space-y-1.5">
            <h2 className="font-display text-base font-bold text-[#f8fafc]">
              Preview &amp; Download
            </h2>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              This video was rendered directly in your browser. Save it to your device before
              starting a new story.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full h-12 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-[0_0_24px_rgba(245,158,11,0.3)]"
            >
              <Download className="w-4 h-4" />
              <span>Download {video.format.toUpperCase()} Video</span>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-full h-11 rounded-xl bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-sm font-semibold text-[#f8fafc] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause Video' : 'Play Video'}</span>
            </button>
          </div>

          {downloaded && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Download started! Check your device Downloads folder.</span>
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
            <button
              type="button"
              onClick={onReRender}
              className="w-full h-10 rounded-xl bg-[#1c2028] hover:bg-[#262a33] border border-white/[0.06] text-xs font-semibold text-[#cbd5e1] flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-render Video</span>
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  if (downloaded) {
                    onStartNewProject();
                  } else {
                    setConfirmReset(true);
                  }
                }}
                className="w-full h-10 rounded-xl bg-[#1c2028] hover:bg-[#262a33] border border-white/[0.06] text-xs font-semibold text-[#cbd5e1] flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Start New Story</span>
              </button>
            ) : (
              <div className="rounded-xl bg-[#0f131c] border border-[#f59e0b]/40 p-3 space-y-2.5">
                <p className="text-xs text-[#dfe2ee]">
                  You have not downloaded this video yet. Starting a new story clears the current
                  session video.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onStartNewProject}
                    className="flex-1 h-9 rounded-lg bg-[#f59e0b] text-[#0a0e16] text-xs font-bold cursor-pointer"
                  >
                    Clear &amp; Start New
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 h-9 rounded-lg bg-[#262a33] text-[#dfe2ee] text-xs font-semibold cursor-pointer"
                  >
                    Keep Video
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
