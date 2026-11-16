import { KokoroTTS } from 'kokoro-js';
import type { KokoroEnglishLanguageCode, KokoroVoiceId } from '../types/audio';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const VERIFIED_ENGLISH_VOICE_LANGS: Record<KokoroVoiceId, KokoroEnglishLanguageCode> = {
  af_heart: 'en-us',
  af_alloy: 'en-us',
  af_aoede: 'en-us',
  af_bella: 'en-us',
  af_jessica: 'en-us',
  af_kore: 'en-us',
  af_nicole: 'en-us',
  af_nova: 'en-us',
  af_river: 'en-us',
  af_sarah: 'en-us',
  af_sky: 'en-us',
  am_adam: 'en-us',
  am_echo: 'en-us',
  am_eric: 'en-us',
  am_fenrir: 'en-us',
  am_liam: 'en-us',
  am_michael: 'en-us',
  am_onyx: 'en-us',
  am_puck: 'en-us',
  bf_alice: 'en-gb',
  bf_emma: 'en-gb',
  bf_isabella: 'en-gb',
  bf_lily: 'en-gb',
  bm_daniel: 'en-gb',
  bm_fable: 'en-gb',
  bm_george: 'en-gb',
  bm_lewis: 'en-gb',
};

let ttsInstance: KokoroTTS | null = null;
let initPromise: Promise<KokoroTTS> | null = null;

type WorkerRequest =
  | { id: string; type: 'init' }
  | {
      id: string;
      type: 'generate';
      text: string;
      voice: KokoroVoiceId;
      language: string;
      expectedKokoroLang: KokoroEnglishLanguageCode;
      speed: number;
    };

async function getOrInitKokoro(
  onProgress: (pct: number, status: string) => void
): Promise<KokoroTTS> {
  if (ttsInstance) {
    onProgress(100, 'Kokoro English voice model ready (cached)');
    return ttsInstance;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const progressHandler = (info: {
      status?: string;
      progress?: number;
      file?: string;
    }) => {
      if (typeof info.progress === 'number') {
        onProgress(
          Math.max(1, Math.min(99, Math.round(info.progress))),
          `Downloading Kokoro English voice model (${Math.round(info.progress)}%)...`
        );
      } else if (info.status === 'ready') {
        onProgress(100, 'Kokoro English voice model ready');
      } else if (info.status) {
        onProgress(10, `Preparing local English voice engine (${info.status})...`);
      }
    };

    // IMPORTANT: Per kokoro-js documentation, dtype="q8" MUST run on device="wasm".
    // Running q8 quantized ONNX weights on WebGPU causes corrupted/garbled tonal output.
    ttsInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: progressHandler,
    });

    onProgress(100, 'Kokoro English voice model ready (WASM q8)');
    return ttsInstance;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

function validateEnglishVoiceAndText(
  tts: KokoroTTS,
  msg: Extract<WorkerRequest, { type: 'generate' }>
): void {
  if (msg.language !== 'English') {
    throw new Error(
      `Kokoro local voice engine only supports English ('en-us' / 'en-gb'), not "${msg.language}".`
    );
  }

  if (!Object.prototype.hasOwnProperty.call(VERIFIED_ENGLISH_VOICE_LANGS, msg.voice)) {
    throw new Error(
      `Rejected unsupported Kokoro voice "${msg.voice}". Only verified English voices are permitted.`
    );
  }

  const expectedLang = VERIFIED_ENGLISH_VOICE_LANGS[msg.voice];
  if (msg.expectedKokoroLang && msg.expectedKokoroLang !== expectedLang) {
    throw new Error(
      `Voice language mismatch for "${msg.voice}": expected "${expectedLang}", got "${msg.expectedKokoroLang}".`
    );
  }

  const runtimeVoices = tts.voices as Record<
    string,
    { language?: string; name?: string } | undefined
  >;
  const runtimeMeta = runtimeVoices[msg.voice];
  if (!runtimeMeta) {
    throw new Error(
      `Kokoro runtime does not contain verified English voice "${msg.voice}".`
    );
  }
  if (runtimeMeta.language !== 'en-us' && runtimeMeta.language !== 'en-gb') {
    throw new Error(
      `Voice "${msg.voice}" has non-English language "${runtimeMeta.language}". Refusing to synthesize.`
    );
  }
  if (runtimeMeta.language !== expectedLang) {
    throw new Error(
      `Voice "${msg.voice}" runtime language "${runtimeMeta.language}" does not match "${expectedLang}".`
    );
  }

  // _validate_voice returns 'a' (en-us) or 'b' (en-gb) used by kokoro-js phonemizer
  const langPrefix = tts._validate_voice(msg.voice);
  const expectedPrefix = expectedLang === 'en-us' ? 'a' : 'b';
  if (langPrefix !== expectedPrefix) {
    throw new Error(
      `Phonemizer language prefix mismatch for "${msg.voice}": got "${langPrefix}", expected "${expectedPrefix}".`
    );
  }

  const cleanText = msg.text.trim();
  if (!cleanText) {
    throw new Error('Cannot synthesize empty speech text.');
  }
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(cleanText)) {
    throw new Error(
      `Non-English script characters detected in English speech input: "${cleanText.slice(0, 40)}".`
    );
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      await getOrInitKokoro((pct, status) => {
        self.postMessage({ id: msg.id, type: 'progress', pct, status });
      });
      self.postMessage({ id: msg.id, type: 'init_done' });
      return;
    }

    if (msg.type === 'generate') {
      const tts = await getOrInitKokoro((pct, status) => {
        self.postMessage({ id: msg.id, type: 'progress', pct, status });
      });

      validateEnglishVoiceAndText(tts, msg);

      const rawAudio = await tts.generate(msg.text.trim(), {
        voice: msg.voice,
        speed: msg.speed,
      });

      const pcm = new Float32Array(rawAudio.audio);
      if (pcm.length === 0) {
        throw new Error(`Kokoro produced an empty audio buffer for voice "${msg.voice}".`);
      }

      let peak = 0;
      for (let i = 0; i < pcm.length; i++) {
        const v = Math.abs(pcm[i]);
        if (!Number.isFinite(v)) {
          throw new Error(`Kokoro produced invalid NaN/Inf audio samples for voice "${msg.voice}".`);
        }
        if (v > peak) peak = v;
      }
      if (peak < 0.0005) {
        throw new Error(`Kokoro produced silent audio for voice "${msg.voice}".`);
      }

      self.postMessage(
        {
          id: msg.id,
          type: 'audio_done',
          pcmBuffer: pcm.buffer,
          samplingRate: rawAudio.sampling_rate || 24000,
        },
        { transfer: [pcm.buffer] }
      );
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Kokoro TTS worker error';
    self.postMessage({ id: msg.id, type: 'error', error });
  }
};
