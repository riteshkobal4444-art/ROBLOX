import type { SpeechAudioSegment } from '../../types/audio';
import type { TimelineScene } from '../../types/story';
import {
  buildStorySoundscapePlan,
  scheduleAmbienceFromAssets,
  scheduleBackgroundMusicFromAssets,
  scheduleSfxFromAssets,
  type StorySoundscapePlan,
} from './musicAndSfx';

const SAMPLE_RATE = 48000;

export interface MixAudioOptions {
  totalDurationSec: number;
  segments: SpeechAudioSegment[];
  timelineScenes: TimelineScene[];
  soundscapePlan?: StorySoundscapePlan;
  musicVolume?: number;
  ambienceVolume?: number;
  sfxVolume?: number;
}

interface SpeechWindow {
  startSec: number;
  endSec: number;
}

/**
 * Merges speech clips separated by brief conversational gaps (< 0.55s) into smooth
 * ducking windows so music and ambience do not pump up and down between rapid lines.
 */
function buildMergedSpeechDuckWindows(segments: SpeechAudioSegment[]): SpeechWindow[] {
  const active = segments
    .filter((s) => Boolean(s.audioBuffer))
    .map((s) => ({ startSec: s.startTimeSec, endSec: s.endTimeSec }))
    .sort((a, b) => a.startSec - b.startSec);

  const merged: SpeechWindow[] = [];
  for (const w of active) {
    const prev = merged[merged.length - 1];
    if (prev && w.startSec - prev.endSec < 0.55) {
      prev.endSec = Math.max(prev.endSec, w.endSec);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

function scheduleDuckingAutomation(
  param: AudioParam,
  windows: SpeechWindow[],
  baseGain: number,
  duckedGain: number,
  totalDurationSec: number
): void {
  param.setValueAtTime(baseGain, 0);
  let cursor = 0;

  for (const w of windows) {
    const duckDownStart = Math.max(cursor + 0.005, w.startSec - 0.16);
    const duckDownEnd = Math.max(duckDownStart + 0.04, Math.min(totalDurationSec, w.startSec + 0.04));
    const holdEnd = Math.max(duckDownEnd + 0.02, Math.min(totalDurationSec - 0.05, w.endSec + 0.06));
    const restoreEnd = Math.min(totalDurationSec, holdEnd + 0.34);

    if (duckDownStart >= totalDurationSec - 0.05) break;

    param.setValueAtTime(baseGain, duckDownStart);
    param.linearRampToValueAtTime(duckedGain, duckDownEnd);
    param.setValueAtTime(duckedGain, holdEnd);
    param.linearRampToValueAtTime(baseGain, restoreEnd);
    cursor = restoreEnd;
  }
}

export async function mixMasterAudioTrack({
  totalDurationSec,
  segments,
  timelineScenes,
  soundscapePlan,
  musicVolume = 0.28,
  ambienceVolume = 0.24,
  sfxVolume = 0.58,
}: MixAudioOptions): Promise<AudioBuffer> {
  const safeDuration = Math.max(2, totalDurationSec);
  const totalSamples = Math.ceil(safeDuration * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, totalSamples, SAMPLE_RATE);

  const plan = soundscapePlan ?? buildStorySoundscapePlan(timelineScenes);
  const speechWindows = buildMergedSpeechDuckWindows(segments);

  // Master limiter to prevent any clipping across all 5 layered audio buses
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -2.2;
  compressor.knee.value = 8;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.14;
  compressor.connect(ctx.destination);

  // 1. Background Music Bus with smooth multi-scene continuity + speech ducking
  const musicBus = ctx.createGain();
  scheduleDuckingAutomation(
    musicBus.gain,
    speechWindows,
    musicVolume,
    Math.max(0.06, musicVolume * 0.28),
    safeDuration
  );
  musicBus.connect(compressor);
  scheduleBackgroundMusicFromAssets(ctx, musicBus, plan);

  // 2. Environmental Ambience Bus (gently ducked during speech so environment feels alive yet unobtrusive)
  const ambienceBus = ctx.createGain();
  scheduleDuckingAutomation(
    ambienceBus.gain,
    speechWindows,
    ambienceVolume,
    Math.max(0.08, ambienceVolume * 0.52),
    safeDuration
  );
  ambienceBus.connect(compressor);
  scheduleAmbienceFromAssets(ctx, ambienceBus, plan);

  // 3. Contextual Sound Effects Bus
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVolume;
  sfxBus.connect(compressor);
  scheduleSfxFromAssets(ctx, sfxBus, plan);

  // 4. Narrator & Character Dialogue Speech Bus
  const speechBus = ctx.createGain();
  speechBus.gain.value = 1.08;
  speechBus.connect(compressor);

  // Gentle stereo spread per character so voices stay distinct and clear
  const speakerPan = new Map<string, number>();
  let charCounter = 0;

  for (const seg of segments) {
    if (!seg.audioBuffer) continue;

    let panVal = 0;
    if (seg.speakerType === 'character') {
      if (!speakerPan.has(seg.speakerId)) {
        speakerPan.set(seg.speakerId, charCounter % 2 === 0 ? -0.14 : 0.14);
        charCounter++;
      }
      panVal = speakerPan.get(seg.speakerId) || 0;
    }

    const src = ctx.createBufferSource();
    src.buffer = seg.audioBuffer;

    const panner = ctx.createStereoPanner();
    panner.pan.value = panVal;

    const gain = ctx.createGain();
    // Slight fade-in/out to prevent clicks at segment edges
    gain.gain.setValueAtTime(0.001, seg.startTimeSec);
    gain.gain.linearRampToValueAtTime(1.0, seg.startTimeSec + 0.015);
    gain.gain.setValueAtTime(1.0, Math.max(seg.startTimeSec + 0.02, seg.endTimeSec - 0.02));
    gain.gain.linearRampToValueAtTime(0.001, seg.endTimeSec);

    src.connect(panner);
    panner.connect(gain);
    gain.connect(speechBus);

    src.start(seg.startTimeSec);
  }

  return await ctx.startRendering();
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
