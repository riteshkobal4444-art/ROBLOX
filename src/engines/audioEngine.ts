import type {
  GeneratedAudioPlan,
  SpeechAudioSegment,
  TtsEnginePreference,
  TtsEngineUsed,
  TtsInitProgress,
} from '../types/audio';
import type { ProductionTimeline, StoryProject } from '../types/story';
import { prepareSceneDialogueSegments } from './audio/textPrep';
import { assignProjectVoices } from './audio/voiceAssignment';
import { initializeSpeechEngine, synthesizeSpeechSegmentBuffer } from './audio/ttsEngine';
import { buildAudioSyncedTimeline } from './audio/audioTiming';
import { audioBufferToWavBlob, mixMasterAudioTrack } from './audio/audioMixer';
import { extractSpeechMouthEnvelope, LIP_SYNC_HZ } from './audio/lipSyncAnalyzer';
import {
  buildStorySoundscapePlan,
  preloadStoryAudioAssets,
  type StorySoundscapePlan,
} from './audio/musicAndSfx';

export interface BuildAudioPlanHooks {
  preference: TtsEnginePreference;
  signal?: AbortSignal;
  onVoiceInitProgress: (p: TtsInitProgress) => void;
  onStageChange: (
    stage: 'dialogue_prep' | 'voice_init' | 'narration_tts' | 'dialogue_tts' | 'music_sfx' | 'audio_mix',
    status: 'active' | 'complete' | 'error',
    detail?: string
  ) => void;
  onSegmentsUpdate: (segments: SpeechAudioSegment[], engineLabel: string) => void;
}

export async function generateSynchronizedStoryAudio(
  story: StoryProject,
  hooks: BuildAudioPlanHooks
): Promise<{
  plan: GeneratedAudioPlan;
  timeline: ProductionTimeline;
  engineLabel: string;
}> {
  const { signal } = hooks;
  const checkAborted = () => {
    if (signal?.aborted) throw new Error('Audio generation cancelled.');
  };

  // Stage A: Text preparation & permanent voice assignment
  hooks.onStageChange('dialogue_prep', 'active');
  const voiceAssignments = assignProjectVoices(story);

  const segments: SpeechAudioSegment[] = [];
  for (const scene of story.scenes) {
    const prepared = prepareSceneDialogueSegments(scene.id, scene.lines);
    for (const item of prepared) {
      const voice =
        voiceAssignments[item.speakerId] ||
        (item.speakerType === 'narrator'
          ? voiceAssignments.narrator
          : Object.values(voiceAssignments)[1] || voiceAssignments.narrator);

      segments.push({
        id: item.id,
        sceneId: item.sceneId,
        lineId: item.lineId,
        speakerId: item.speakerId,
        speakerType: item.speakerType,
        speakerName: item.speakerName,
        text: item.displayText,
        spokenText: item.spokenText,
        emotion: item.emotion,
        startTimeSec: 0,
        endTimeSec: 0,
        durationSec: 2.0,
        voiceAssignment: voice,
        playbackSpeed: voice.speed,
        status: 'pending',
        audioBuffer: null,
      });
    }
  }

  if (segments.length === 0) {
    hooks.onStageChange('dialogue_prep', 'error', 'No narration or dialogue lines found in script.');
    throw new Error('The story script has no narration or dialogue lines to voice.');
  }

  hooks.onSegmentsUpdate(segments, 'Preparing voices');
  hooks.onStageChange('dialogue_prep', 'complete');
  checkAborted();

  // Stage B: Initialize TTS engine
  const storyLanguage = story.input.language || 'English';
  hooks.onStageChange('voice_init', 'active');
  let activeEngine: TtsEngineUsed;
  let engineLabel: string;
  try {
    const res = await initializeSpeechEngine(
      hooks.preference,
      storyLanguage,
      hooks.onVoiceInitProgress,
      signal
    );
    activeEngine = res.engine;
    engineLabel = res.note;
    hooks.onSegmentsUpdate(segments, engineLabel);
    hooks.onStageChange('voice_init', 'complete');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Voice engine initialization failed.';
    hooks.onStageChange('voice_init', 'error', msg);
    throw err;
  }
  checkAborted();

  // Stage C: Generate narration speech clips
  hooks.onStageChange('narration_tts', 'active');
  const narratorSegments = segments.filter((s) => s.speakerType === 'narrator');
  try {
    for (const seg of narratorSegments) {
      checkAborted();
      seg.status = 'generating';
      hooks.onSegmentsUpdate([...segments], engineLabel);

      const buf = await synthesizeSpeechSegmentBuffer(
        seg.spokenText,
        seg.voiceAssignment,
        seg.emotion,
        activeEngine,
        storyLanguage,
        signal
      );
      seg.audioBuffer = buf;
      seg.mouthEnvelope = extractSpeechMouthEnvelope(buf, seg.spokenText);
      seg.mouthSampleRateHz = LIP_SYNC_HZ;
      seg.durationSec = buf.duration;
      seg.engineUsed = activeEngine;
      seg.status = 'ready';
      hooks.onSegmentsUpdate([...segments], engineLabel);
    }
    hooks.onStageChange('narration_tts', 'complete');
  } catch (err: unknown) {
    const failed = narratorSegments.find((s) => s.status === 'generating');
    if (failed) failed.status = 'error';
    const msg = err instanceof Error ? err.message : 'Narrator speech generation failed.';
    hooks.onSegmentsUpdate([...segments], engineLabel);
    hooks.onStageChange('narration_tts', 'error', msg);
    throw err;
  }
  checkAborted();

  // Stage D: Generate character dialogue clips
  hooks.onStageChange('dialogue_tts', 'active');
  const charSegments = segments.filter((s) => s.speakerType === 'character');
  try {
    for (const seg of charSegments) {
      checkAborted();
      seg.status = 'generating';
      hooks.onSegmentsUpdate([...segments], engineLabel);

      const buf = await synthesizeSpeechSegmentBuffer(
        seg.spokenText,
        seg.voiceAssignment,
        seg.emotion,
        activeEngine,
        storyLanguage,
        signal
      );
      seg.audioBuffer = buf;
      seg.mouthEnvelope = extractSpeechMouthEnvelope(buf, seg.spokenText);
      seg.mouthSampleRateHz = LIP_SYNC_HZ;
      seg.durationSec = buf.duration;
      seg.engineUsed = activeEngine;
      seg.status = 'ready';
      hooks.onSegmentsUpdate([...segments], engineLabel);
    }
    hooks.onStageChange('dialogue_tts', 'complete');
  } catch (err: unknown) {
    const failed = charSegments.find((s) => s.status === 'generating');
    if (failed) failed.status = 'error';
    const msg = err instanceof Error ? err.message : 'Character dialogue generation failed.';
    hooks.onSegmentsUpdate([...segments], engineLabel);
    hooks.onStageChange('dialogue_tts', 'error', msg);
    throw err;
  }
  checkAborted();

  // Stage E: Audio timing synchronization + load real CC0 music, ambience & SFX assets
  hooks.onStageChange('music_sfx', 'active');
  const { syncedSegments, sceneTimings, timeline } = buildAudioSyncedTimeline(story, segments);
  const soundscapePlan: StorySoundscapePlan = buildStorySoundscapePlan(timeline.scenes);
  const preloadResult = await preloadStoryAudioAssets(soundscapePlan, signal);
  if (preloadResult.loadedCount === 0 && soundscapePlan.requiredUrls.length > 0) {
    const msg = 'Failed to load background music and environmental sound assets.';
    hooks.onStageChange('music_sfx', 'error', msg);
    throw new Error(msg);
  }
  if (preloadResult.failedUrls.length > 0) {
    console.warn(
      `[AudioEngine] Some optional audio assets failed to load (${preloadResult.failedUrls.length}):`,
      preloadResult.failedUrls
    );
  }
  hooks.onSegmentsUpdate(syncedSegments, engineLabel);
  hooks.onStageChange('music_sfx', 'complete', soundscapePlan.summaryText);
  checkAborted();

  // Stage F: Mix narration + dialogue + ducked music + environmental ambience + SFX into master stereo AudioBuffer
  hooks.onStageChange('audio_mix', 'active');
  let mixedMasterBuffer: AudioBuffer;
  let previewMixWavBlob: Blob;
  try {
    mixedMasterBuffer = await mixMasterAudioTrack({
      totalDurationSec: timeline.totalDurationSec,
      segments: syncedSegments,
      timelineScenes: timeline.scenes,
      soundscapePlan,
    });
    previewMixWavBlob = audioBufferToWavBlob(mixedMasterBuffer);
    hooks.onStageChange('audio_mix', 'complete');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Audio mixing failed.';
    hooks.onStageChange('audio_mix', 'error', msg);
    throw err;
  }

  return {
    plan: {
      projectId: story.id,
      engineUsed: activeEngine,
      voiceAssignments,
      segments: syncedSegments,
      sceneTimings,
      totalDurationSec: timeline.totalDurationSec,
      mixedMasterBuffer,
      previewMixWavBlob,
      audioBedSummary: soundscapePlan.summaryText,
    },
    timeline,
    engineLabel,
  };
}
