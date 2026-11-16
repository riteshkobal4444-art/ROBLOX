import React, { useState } from 'react';
import { Clapperboard, Download, Film, Plus, Trash2 } from 'lucide-react';
import type { RenderedVideoResult, StoryProject } from '../types/story';

interface ProjectsScreenProps {
  story: StoryProject | null;
  video: RenderedVideoResult | null;
  onCreateNew: () => void;
  onResumeStory: () => void;
  onOpenVideo: () => void;
  onClearSession: () => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  story,
  video,
  onCreateNew,
  onResumeStory,
  onOpenVideo,
  onClearSession,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDirectDownload = () => {
    if (!video) return;
    const url = URL.createObjectURL(video.blob);
    const safeName =
      video.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'storyforge-video';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${video.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f8fafc]">
          Session Workspace
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Version 1 stores your active work temporarily in this browser session—no account or cloud
          storage needed.
        </p>
      </div>

      {!story && !video ? (
        <div className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#262a33] text-[#ffc174] flex items-center justify-center mx-auto">
            <Film className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="font-display text-lg font-bold text-[#f8fafc]">
              No active project in this session
            </h2>
            <p className="text-sm text-[#94a3b8]">
              Start a new story to generate a script, build 3D Roblox scenes, and download your
              finished video directly to your device.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="h-12 px-7 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm inline-flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.28)]"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Story</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#181c24] border border-white/[0.07] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[#4cd7f6] font-semibold">
                <span>Active Session</span>
                <span aria-hidden="true">·</span>
                <span>{video ? 'Rendered Video Ready' : 'Script Draft'}</span>
              </div>
              <h2 className="font-display text-xl font-bold text-[#f8fafc]">
                {video?.title || story?.title}
              </h2>
              {story && (
                <p className="text-sm text-[#cbd5e1] leading-relaxed">{story.summary}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#94a3b8] pt-1 tabular-nums">
                {story && (
                  <>
                    <span>{story.input.genre}</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.characters.length} characters</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.scenes.length} scenes</span>
                  </>
                )}
                {video && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{(video.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase">{video.format}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.06]">
            {video ? (
              <>
                <button
                  type="button"
                  onClick={onOpenVideo}
                  className="h-11 px-5 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>Open Video Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleDirectDownload}
                  className="h-11 px-4 rounded-xl bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onResumeStory}
                className="h-11 px-5 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Clapperboard className="w-4 h-4" />
                <span>Review &amp; Produce</span>
              </button>
            )}

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="h-11 px-4 rounded-xl bg-[#1c2028] hover:bg-[#262a33] border border-white/[0.06] text-xs font-semibold text-[#ffb4ab] inline-flex items-center gap-2 ml-auto cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Session</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearSession();
                  }}
                  className="h-10 px-3.5 rounded-lg bg-[#93000a] text-[#ffdad6] text-xs font-bold cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="h-10 px-3 rounded-lg bg-[#262a33] text-[#dfe2ee] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
