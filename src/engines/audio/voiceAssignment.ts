import type {
  GeminiVoiceId,
  KokoroEnglishLanguageCode,
  KokoroVoiceId,
  VoiceAssignment,
} from '../../types/audio';
import type { CharacterSpec, StoryProject } from '../../types/story';

/**
 * Verified English-only voice registry matching kokoro-js VOICES metadata.
 * Every voice here uses either 'en-us' (prefix 'a') or 'en-gb' (prefix 'b').
 * Non-English voice groups (z*, j*, e*, f*, h*, i*, p*) are strictly excluded.
 */
export const VERIFIED_KOKORO_ENGLISH_VOICES: Record<
  KokoroVoiceId,
  {
    language: KokoroEnglishLanguageCode;
    phonemizerLang: 'a' | 'b';
    espeakLang: 'en-us' | 'en';
    gender: 'Female' | 'Male';
  }
> = {
  af_heart: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_alloy: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_aoede: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_bella: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_jessica: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_kore: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_nicole: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_nova: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_river: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_sarah: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  af_sky: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Female' },
  am_adam: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_echo: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_eric: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_fenrir: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_liam: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_michael: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_onyx: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  am_puck: { language: 'en-us', phonemizerLang: 'a', espeakLang: 'en-us', gender: 'Male' },
  bf_alice: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Female' },
  bf_emma: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Female' },
  bf_isabella: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Female' },
  bf_lily: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Female' },
  bm_daniel: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Male' },
  bm_fable: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Male' },
  bm_george: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Male' },
  bm_lewis: { language: 'en-gb', phonemizerLang: 'b', espeakLang: 'en', gender: 'Male' },
};

export function assertVerifiedKokoroEnglishVoice(voiceId: string): {
  voiceId: KokoroVoiceId;
  language: KokoroEnglishLanguageCode;
} {
  if (
    !Object.prototype.hasOwnProperty.call(VERIFIED_KOKORO_ENGLISH_VOICES, voiceId)
  ) {
    throw new Error(
      `Unsupported Kokoro voice "${voiceId}". Only verified English ('en-us' / 'en-gb') voices are permitted.`
    );
  }
  const typedId = voiceId as KokoroVoiceId;
  return {
    voiceId: typedId,
    language: VERIFIED_KOKORO_ENGLISH_VOICES[typedId].language,
  };
}

// Curated highest-grade English character voices (A, A-, B-, C+ grades in Kokoro v1.0)
const CHARACTER_KOKORO_POOL: Array<{
  kokoro: KokoroVoiceId;
  gemini: GeminiVoiceId;
  label: string;
}> = [
  { kokoro: 'am_puck', gemini: 'Puck', label: 'Puck (English US · Expressive)' },
  { kokoro: 'af_heart', gemini: 'Kore', label: 'Heart (English US · Warm)' },
  { kokoro: 'am_michael', gemini: 'Fenrir', label: 'Michael (English US · Confident)' },
  { kokoro: 'af_bella', gemini: 'Kore', label: 'Bella (English US · Cheerful)' },
  { kokoro: 'bf_emma', gemini: 'Zephyr', label: 'Emma (English UK · Poised)' },
  { kokoro: 'am_fenrir', gemini: 'Charon', label: 'Fenrir (English US · Bold)' },
  { kokoro: 'af_nicole', gemini: 'Zephyr', label: 'Nicole (English US · Calm)' },
  { kokoro: 'af_nova', gemini: 'Zephyr', label: 'Nova (English US · Crisp)' },
];

export function getNarratorVoiceAssignment(story: StoryProject): VoiceAssignment {
  const genreStyle: Record<string, string> = {
    Adventure: 'Engaging, cinematic English adventure storyteller',
    Comedy: 'Lively, playful English animated narrator',
    Mystery: 'Intriguing, suspenseful English mystery narrator',
    'Sci-Fi': 'Crisp, imaginative English sci-fi narrator',
    'Slice of Life': 'Warm, friendly English everyday storyteller',
    Horror: 'Atmospheric, tense English suspense narrator',
  };

  const narratorVoice: KokoroVoiceId = 'bm_george';
  const verified = assertVerifiedKokoroEnglishVoice(narratorVoice);

  return {
    speakerId: 'narrator',
    speakerType: 'narrator',
    speakerName: 'Narrator',
    voiceLabel: 'George (English UK · Storyteller)',
    kokoroVoice: verified.voiceId,
    kokoroLanguage: verified.language,
    geminiVoice: 'Charon',
    stylePrompt:
      genreStyle[story.input.genre] || 'Warm, clear English cinematic storyteller',
    speed: 1.0,
  };
}

function pickCharacterVoiceIndex(character: CharacterSpec, fallbackIdx: number): number {
  const { pitchHz, timbre } = character.voiceProfile;
  const preset = character.appearance.stylePreset;

  // Respect explicit girl/boy style preset first, then voice pitch/timbre
  if (preset === 'girl' || (preset !== 'boy' && (pitchHz >= 215 || timbre === 'bright'))) {
    const brightIndices = [1, 3, 4, 6, 7];
    return brightIndices[fallbackIdx % brightIndices.length];
  }
  if (preset === 'boy' || pitchHz <= 185 || timbre === 'deep') {
    const deepIndices = [0, 2, 5];
    return deepIndices[fallbackIdx % deepIndices.length];
  }
  return fallbackIdx % CHARACTER_KOKORO_POOL.length;
}

export function assignProjectVoices(
  story: StoryProject
): Record<string, VoiceAssignment> {
  const assignments: Record<string, VoiceAssignment> = {
    narrator: getNarratorVoiceAssignment(story),
  };

  const usedKokoro = new Set<KokoroVoiceId>([assignments.narrator.kokoroVoice]);

  story.characters.forEach((char, idx) => {
    const poolIdx = pickCharacterVoiceIndex(char, idx);
    let candidate = CHARACTER_KOKORO_POOL[poolIdx];

    // Ensure every character gets a unique verified English voice identity
    if (usedKokoro.has(candidate.kokoro)) {
      const alt = CHARACTER_KOKORO_POOL.find((p) => !usedKokoro.has(p.kokoro));
      if (alt) candidate = alt;
    }

    const verified = assertVerifiedKokoroEnglishVoice(candidate.kokoro);
    usedKokoro.add(verified.voiceId);

    assignments[char.id] = {
      speakerId: char.id,
      speakerType: 'character',
      speakerName: char.name,
      voiceLabel: candidate.label,
      kokoroVoice: verified.voiceId,
      kokoroLanguage: verified.language,
      geminiVoice: candidate.gemini,
      stylePrompt: `Clear natural English voice, ${char.personality}, ${char.role}`,
      speed: Math.max(0.92, Math.min(1.12, char.voiceProfile.speed || 1.0)),
    };
  });

  return assignments;
}
