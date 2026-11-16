import type {
  KokoroEnglishLanguageCode,
  KokoroVoiceId,
  TtsEnginePreference,
  TtsEngineUsed,
  TtsInitProgress,
  VoiceAssignment,
} from '../../types/audio';
import type { FaceExpression, LanguageOption } from '../../types/story';
import { assertVerifiedKokoroEnglishVoice } from './voiceAssignment';

// Session-scoped cache so generated speech clips are never re-synthesized unnecessarily
const clipCache = new Map<string, AudioBuffer>();

let sharedAudioCtx: AudioContext | null = null;
function getDecodeAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  return sharedAudioCtx;
}

// Persistent Kokoro Web Worker singleton across the session (prevents repeated 86MB downloads)
let kokoroWorker: Worker | null = null;
let kokoroInitialized = false;

function getKokoroWorker(): Worker {
  if (!kokoroWorker) {
    kokoroWorker = new Worker(
      new URL('../../workers/kokoroTts.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return kokoroWorker;
}

function makeReqId(): string {
  return `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function initKokoroWorker(
  onProgress: (p: TtsInitProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  if (kokoroInitialized) {
    onProgress({
      phase: 'ready',
      progressPct: 100,
      message: 'Kokoro English voice model ready (cached in session)',
    });
    return;
  }

  const worker = getKokoroWorker();
  const reqId = makeReqId();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error('Voice engine initialization cancelled.'));
    };

    const onError = (ev: ErrorEvent) => {
      cleanup();
      reject(new Error(ev.message || 'Kokoro Web Worker failed to start.'));
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.id !== reqId) return;
      if (data.type === 'progress') {
        onProgress({
          phase: data.pct < 100 ? 'downloading' : 'initializing',
          progressPct: data.pct,
          message: data.status || 'Loading Kokoro English model...',
        });
      } else if (data.type === 'init_done') {
        kokoroInitialized = true;
        cleanup();
        onProgress({
          phase: 'ready',
          progressPct: 100,
          message: 'Kokoro English voice model ready',
        });
        resolve();
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.error || 'Kokoro model initialization failed.'));
      }
    };

    signal?.addEventListener('abort', onAbort);
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ id: reqId, type: 'init' });
  });
}

async function generateKokoroClip(
  text: string,
  voice: KokoroVoiceId,
  expectedKokoroLang: KokoroEnglishLanguageCode,
  language: LanguageOption,
  speed: number,
  signal?: AbortSignal
): Promise<AudioBuffer> {
  if (language !== 'English') {
    throw new Error(
      `Local Kokoro-82M only supports English speech. Cannot synthesize "${language}" locally.`
    );
  }

  const verified = assertVerifiedKokoroEnglishVoice(voice);
  if (verified.language !== expectedKokoroLang) {
    throw new Error(
      `Kokoro voice "${voice}" is "${verified.language}", expected "${expectedKokoroLang}".`
    );
  }

  const worker = getKokoroWorker();
  const reqId = makeReqId();

  const { pcmBuffer, samplingRate } = await new Promise<{
    pcmBuffer: ArrayBuffer;
    samplingRate: number;
  }>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error('Speech generation cancelled.'));
    };

    const onError = (ev: ErrorEvent) => {
      cleanup();
      reject(new Error(ev.message || 'Kokoro worker crashed during generation.'));
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.id !== reqId) return;
      if (data.type === 'audio_done') {
        cleanup();
        resolve({
          pcmBuffer: data.pcmBuffer as ArrayBuffer,
          samplingRate: Number(data.samplingRate) || 24000,
        });
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.error || 'Kokoro speech synthesis failed.'));
      }
    };

    signal?.addEventListener('abort', onAbort);
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({
      id: reqId,
      type: 'generate',
      text,
      voice: verified.voiceId,
      language: 'English',
      expectedKokoroLang: verified.language,
      speed,
    });
  });

  const floatSamples = new Float32Array(pcmBuffer);
  if (floatSamples.length === 0) {
    throw new Error('Kokoro generated an empty audio buffer.');
  }

  const ctx = getDecodeAudioContext();
  const audioBuffer = ctx.createBuffer(1, floatSamples.length, samplingRate);
  audioBuffer.copyToChannel(floatSamples, 0);
  return audioBuffer;
}

async function generateGeminiClip(
  text: string,
  voiceAssignment: VoiceAssignment,
  emotion: FaceExpression,
  language: LanguageOption,
  signal?: AbortSignal
): Promise<AudioBuffer> {
  const emotionNote =
    emotion === 'neutral' ? '' : `, delivered with a ${emotion} tone`;
  const style = `${voiceAssignment.stylePrompt}${emotionNote}`;

  const response = await fetch('/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceName: voiceAssignment.geminiVoice,
      style,
      language,
    }),
    signal,
  });

  if (!response.ok) {
    const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Speech API failed (HTTP ${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 64) {
    throw new Error('Speech API returned invalid WAV audio.');
  }

  const ctx = getDecodeAudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  if (!decoded || decoded.duration <= 0.05) {
    throw new Error('Decoded speech clip was empty.');
  }
  return decoded;
}

export async function initializeSpeechEngine(
  preference: TtsEnginePreference,
  language: LanguageOption = 'English',
  onProgress: (p: TtsInitProgress) => void,
  signal?: AbortSignal
): Promise<{ engine: TtsEngineUsed; note: string }> {
  const effectiveLang: LanguageOption = language || 'English';

  if (effectiveLang !== 'English' && preference === 'kokoro-local') {
    throw new Error(
      `Local Kokoro-82M only supports English ('en-us' / 'en-gb') voices. Switch Speech Voice Engine to "Auto" or "Gemini Speech" for ${effectiveLang}.`
    );
  }

  // Kokoro v1.0 JS phonemizer supports English cleanly; non-English stories in Auto mode route to Gemini Speech
  if (effectiveLang !== 'English' && preference === 'auto') {
    onProgress({
      phase: 'ready',
      progressPct: 100,
      message: `Using multilingual Gemini Speech for ${effectiveLang}`,
    });
    return {
      engine: 'gemini-tts',
      note: `Gemini Neural Speech (${effectiveLang})`,
    };
  }

  if (preference === 'gemini-tts') {
    onProgress({
      phase: 'ready',
      progressPct: 100,
      message: `Using Gemini Neural Speech (${effectiveLang})`,
    });
    return {
      engine: 'gemini-tts',
      note: `Gemini Neural Speech (${effectiveLang})`,
    };
  }

  // Primary local open-source Kokoro English TTS path
  try {
    onProgress({
      phase: 'checking',
      progressPct: 5,
      message: 'Initializing browser-local Kokoro English TTS (WASM)...',
    });
    await initKokoroWorker(onProgress, signal);
    return {
      engine: 'kokoro-local',
      note: 'Kokoro-82M Local English (en-us / en-gb)',
    };
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    const reason = err instanceof Error ? err.message : 'Local TTS unavailable';

    if (preference === 'kokoro-local') {
      throw new Error(
        `Local Kokoro English TTS failed to initialize (${reason}). You can switch to Gemini Speech or retry.`
      );
    }

    // Auto fallback to server-side Gemini TTS if local Kokoro cannot initialize
    const healthRes = await fetch('/api/health', { signal }).catch(() => null);
    const health = healthRes
      ? ((await healthRes.json().catch(() => null)) as { aiConfigured?: boolean } | null)
      : null;
    if (health?.aiConfigured) {
      onProgress({
        phase: 'fallback',
        progressPct: 100,
        message: `Local Kokoro unavailable (${reason}); switched to Gemini English Speech`,
      });
      return {
        engine: 'gemini-tts',
        note: 'Gemini Neural Speech (English Fallback)',
      };
    }

    throw new Error(
      `Could not initialize Kokoro local TTS (${reason}) and server speech fallback is not configured.`
    );
  }
}

export async function synthesizeSpeechSegmentBuffer(
  text: string,
  voiceAssignment: VoiceAssignment,
  emotion: FaceExpression,
  engine: TtsEngineUsed,
  language: LanguageOption = 'English',
  signal?: AbortSignal
): Promise<AudioBuffer> {
  const effectiveLang: LanguageOption = language || 'English';

  if (engine === 'kokoro-local') {
    assertVerifiedKokoroEnglishVoice(voiceAssignment.kokoroVoice);
  }

  const voiceKey =
    engine === 'kokoro-local'
      ? `${voiceAssignment.kokoroVoice}:${voiceAssignment.kokoroLanguage}`
      : voiceAssignment.geminiVoice;
  const cacheKey = `${engine}:${effectiveLang}:${voiceKey}:${voiceAssignment.speed.toFixed(2)}:${emotion}:${text}`;

  const cached = clipCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const buffer =
    engine === 'kokoro-local'
      ? await generateKokoroClip(
          text,
          voiceAssignment.kokoroVoice,
          voiceAssignment.kokoroLanguage,
          effectiveLang,
          voiceAssignment.speed,
          signal
        )
      : await generateGeminiClip(text, voiceAssignment, emotion, effectiveLang, signal);

  clipCache.set(cacheKey, buffer);
  return buffer;
}

export async function previewVoiceLine(
  text: string,
  voiceAssignment: VoiceAssignment,
  language: LanguageOption = 'English',
  preference: TtsEnginePreference = 'auto'
): Promise<{ engine: TtsEngineUsed; durationSec: number }> {
  const effectiveLang: LanguageOption = language || 'English';
  const { engine } = await initializeSpeechEngine(preference, effectiveLang, () => {});
  const buffer = await synthesizeSpeechSegmentBuffer(
    text,
    voiceAssignment,
    'neutral',
    engine,
    effectiveLang
  );
  const ctx = getDecodeAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return { engine, durationSec: buffer.duration };
}

export function clearSpeechClipCache(): void {
  clipCache.clear();
}
