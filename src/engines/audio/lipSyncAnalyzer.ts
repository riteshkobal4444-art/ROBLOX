import type { MouthEnvelopeFrame, MouthVisemeShape, SpeechAudioSegment } from '../../types/audio';

export const LIP_SYNC_HZ = 40; // 25ms windows per frame for crisp 24fps/30fps video sync

/**
 * Extracts a lightweight, frame-accurate mouth openness & viseme shape envelope
 * directly from a generated speech AudioBuffer. Uses RMS amplitude + zero-crossing
 * rate + smoothed vowel hints from the spoken text so pauses are silent (closed)
 * and syllables match real audio peaks cleanly.
 */
export function extractSpeechMouthEnvelope(
  audioBuffer: AudioBuffer,
  spokenText = ''
): MouthEnvelopeFrame[] {
  const sampleRate = audioBuffer.sampleRate;
  const channel = audioBuffer.getChannelData(0);
  const totalSamples = channel.length;

  if (totalSamples === 0 || audioBuffer.duration <= 0) {
    return [];
  }

  const windowSize = Math.max(1, Math.floor(sampleRate / LIP_SYNC_HZ));
  const frameCount = Math.max(1, Math.ceil(totalSamples / windowSize));

  // Pre-compute raw RMS and zero-crossing rate per 25ms window
  const rawRms = new Float32Array(frameCount);
  const rawZcr = new Float32Array(frameCount);
  const activeRmsSamples: number[] = [];
  let peakRms = 0.0001;

  for (let f = 0; f < frameCount; f++) {
    const start = f * windowSize;
    const end = Math.min(totalSamples, start + windowSize);
    const len = Math.max(1, end - start);

    let sumSq = 0;
    let zeroCrossings = 0;
    let prev = channel[start];

    for (let i = start; i < end; i++) {
      const s = channel[i];
      sumSq += s * s;
      if ((s >= 0 && prev < 0) || (s < 0 && prev >= 0)) {
        zeroCrossings++;
      }
      prev = s;
    }

    const rms = Math.sqrt(sumSq / len);
    rawRms[f] = rms;
    rawZcr[f] = zeroCrossings / len;
    if (rms > peakRms) peakRms = rms;
    if (rms > 0.0025) {
      activeRmsSamples.push(rms);
    }
  }

  // Normalize against 88th percentile of active voiced frames so one loud plosive/click never suppresses normal speech
  let refRms = peakRms * 0.72;
  if (activeRmsSamples.length > 0) {
    activeRmsSamples.sort((a, b) => a - b);
    const p88Index = Math.min(
      activeRmsSamples.length - 1,
      Math.floor(activeRmsSamples.length * 0.88)
    );
    refRms = Math.max(0.01, activeRmsSamples[p88Index]);
  } else {
    refRms = Math.max(0.01, peakRms);
  }

  // Extract vowel character sequence from text to enrich wide vs round viseme variety
  const vowelStream = spokenText.toLowerCase().replace(/[^aeiouy]/g, '');

  const frames: MouthEnvelopeFrame[] = [];
  let prevOpen = 0;

  for (let f = 0; f < frameCount; f++) {
    const norm = Math.min(1.25, rawRms[f] / refRms);

    // Noise/silence gate: keep mouth strictly closed during quiet pauses & trailing decay
    if (norm < 0.065) {
      const decayed = prevOpen * 0.32;
      const open = decayed < 0.04 ? 0 : decayed;
      prevOpen = open;
      frames.push({
        open,
        shape: open > 0.12 ? 'half' : 'closed',
      });
      continue;
    }

    // Nonlinear loudness curve so normal speech reads expressively without single-spike suppression
    const targetOpen = Math.min(1, Math.pow((norm - 0.065) / 0.68, 0.68));
    // Responsive smoothing while preserving syllable articulation at 24fps
    const smoothed = Math.min(1, prevOpen * 0.22 + targetOpen * 0.78);
    prevOpen = smoothed;

    // Zero-crossing heuristic: lower ZCR (~voiced open/round vowels) vs high ZCR (fricatives/wide vowels)
    const zcr = rawZcr[f];
    const textProgress = frameCount > 1 ? f / (frameCount - 1) : 0;
    const vowelChar =
      vowelStream.length > 0
        ? vowelStream[Math.min(vowelStream.length - 1, Math.floor(textProgress * vowelStream.length))]
        : 'a';

    let shape: MouthVisemeShape = 'half';
    if (smoothed < 0.13) {
      shape = 'closed';
    } else if (smoothed < 0.36) {
      shape = 'half';
    } else if (vowelChar === 'o' || vowelChar === 'u' || (zcr < 0.075 && smoothed > 0.55)) {
      shape = 'round';
    } else {
      shape = 'wide';
    }

    frames.push({
      open: Number(smoothed.toFixed(3)),
      shape,
    });
  }

  return frames;
}

/**
 * Samples the mouth envelope for a specific speaker at globalTime.
 * Guarantees 0 / 'closed' when not speaking or during silence windows.
 */
export function sampleSegmentMouthAtTime(
  segment: SpeechAudioSegment | undefined,
  globalTimeSec: number
): MouthEnvelopeFrame {
  if (
    !segment ||
    segment.speakerType !== 'character' ||
    globalTimeSec < segment.startTimeSec ||
    globalTimeSec > segment.endTimeSec
  ) {
    return { open: 0, shape: 'closed' };
  }

  const localSec = globalTimeSec - segment.startTimeSec;
  const env = segment.mouthEnvelope;
  const hz = segment.mouthSampleRateHz || LIP_SYNC_HZ;

  if (env && env.length > 0) {
    const idxFloat = localSec * hz;
    const idx0 = Math.max(0, Math.min(env.length - 1, Math.floor(idxFloat)));
    const idx1 = Math.min(env.length - 1, idx0 + 1);
    const frac = idxFloat - idx0;
    const open = env[idx0].open * (1 - frac) + env[idx1].open * frac;
    const shape = open < 0.12 ? 'closed' : env[Math.round(idxFloat) < env.length ? Math.round(idxFloat) : idx0].shape;
    return { open, shape };
  }

  // Fallback only if segment has audioBuffer without pre-extracted envelope (never runs in silence)
  if (!segment.audioBuffer) {
    return { open: 0, shape: 'closed' };
  }

  const wave = Math.max(0, Math.sin(localSec * 16) * 0.55 + 0.35);
  return {
    open: wave,
    shape: wave > 0.5 ? 'wide' : wave > 0.18 ? 'half' : 'closed',
  };
}
