import type {
  AudioSyncedSceneTiming,
  SpeechAudioSegment,
} from '../../types/audio';
import type {
  ProductionTimeline,
  SceneSpec,
  StoryProject,
  TimelineScene,
  TimelineSubtitle,
} from '../../types/story';

const SCENE_LEAD_IN_SEC = 0.4;
const LINE_GAP_SEC = 0.28;
const SCENE_TAIL_SEC = 0.45;

export function buildAudioSyncedTimeline(
  story: StoryProject,
  segments: SpeechAudioSegment[]
): {
  syncedSegments: SpeechAudioSegment[];
  sceneTimings: AudioSyncedSceneTiming[];
  timeline: ProductionTimeline;
} {
  const segmentsByScene = new Map<string, SpeechAudioSegment[]>();
  for (const seg of segments) {
    const list = segmentsByScene.get(seg.sceneId) || [];
    list.push(seg);
    segmentsByScene.set(seg.sceneId, list);
  }

  const colorMap = new Map<string, string>();
  story.characters.forEach((c) => {
    colorMap.set(c.id, c.appearance.shirtColor);
  });

  const syncedSegments: SpeechAudioSegment[] = [];
  const sceneTimings: AudioSyncedSceneTiming[] = [];
  const timelineScenes: TimelineScene[] = [];
  const subtitles: TimelineSubtitle[] = [];

  let globalCursor = 0;

  for (const scene of story.scenes) {
    const sceneStart = globalCursor;
    const sceneSegs = segmentsByScene.get(scene.id) || [];

    let localCursor = SCENE_LEAD_IN_SEC;

    for (const seg of sceneSegs) {
      const actualDur = Math.max(
        0.5,
        seg.audioBuffer ? seg.audioBuffer.duration : seg.durationSec || 2.0
      );
      const startTimeSec = sceneStart + localCursor;
      const endTimeSec = startTimeSec + actualDur;

      const updatedSeg: SpeechAudioSegment = {
        ...seg,
        startTimeSec,
        endTimeSec,
        durationSec: actualDur,
      };
      syncedSegments.push(updatedSeg);

      subtitles.push({
        id: updatedSeg.id,
        speakerName: updatedSeg.speakerName,
        isNarration: updatedSeg.speakerType === 'narrator',
        speakerColor:
          updatedSeg.speakerType === 'narrator'
            ? '#ffc174'
            : colorMap.get(updatedSeg.speakerId) || '#4cd7f6',
        text: updatedSeg.text,
        startSec: startTimeSec,
        endSec: endTimeSec,
        speakerId:
          updatedSeg.speakerType === 'character' ? updatedSeg.speakerId : undefined,
        emotion: updatedSeg.emotion,
      });

      localCursor += actualDur + LINE_GAP_SEC;
    }

    // Scene duration fits all generated speech cleanly (minimum 3.5s or original scene duration if speech is shorter)
    const minSpeechDuration =
      sceneSegs.length > 0 ? localCursor - LINE_GAP_SEC + SCENE_TAIL_SEC : 3.5;
    const finalSceneDuration = Math.max(
      3.5,
      Math.max(scene.durationSec, minSpeechDuration)
    );
    const sceneEnd = sceneStart + finalSceneDuration;

    // Scale actionBeats proportionally if scene expanded so character motion spans the full scene
    const ratio =
      scene.durationSec > 0 ? finalSceneDuration / scene.durationSec : 1;
    const scaledScene: SceneSpec = {
      ...scene,
      durationSec: finalSceneDuration,
      actionBeats: scene.actionBeats.map((b) => ({
        ...b,
        startOffsetSec: Number((b.startOffsetSec * ratio).toFixed(3)),
        endOffsetSec: Number((b.endOffsetSec * ratio).toFixed(3)),
      })),
    };

    sceneTimings.push({
      sceneId: scene.id,
      startSec: sceneStart,
      endSec: sceneEnd,
      durationSec: finalSceneDuration,
    });

    timelineScenes.push({
      scene: scaledScene,
      startSec: sceneStart,
      endSec: sceneEnd,
    });

    globalCursor = sceneEnd;
  }

  return {
    syncedSegments,
    sceneTimings,
    timeline: {
      totalDurationSec: globalCursor,
      scenes: timelineScenes,
      subtitles,
    },
  };
}
