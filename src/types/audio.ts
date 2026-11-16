import type { FaceExpression } from './story';

export type TtsEnginePreference = 'auto' | 'kokoro-local' | 'gemini-tts';
export type TtsEngineUsed = 'kokoro-local' | 'gemini-tts';

export type KokoroEnglishLanguageCode = 'en-us' | 'en-gb';

export type KokoroVoiceId =
  | 'af_heart'
  | 'af_alloy'
  | 'af_aoede'
  | 'af_bella'
  | 'af_jessica'
  | 'af_kore'
  | 'af_nicole'
  | 'af_nova'
  | 'af_river'
  | 'af_sarah'
  | 'af_sky'
  | 'am_adam'
  | 'am_echo'
  | 'am_eric'
  | 'am_fenrir'
  | 'am_liam'
  | 'am_michael'
  | 'am_onyx'
  | 'am_puck'
  | 'bf_alice'
  | 'bf_emma'
  | 'bf_isabella'
  | 'bf_lily'
  | 'bm_daniel'
  | 'bm_fable'
  | 'bm_george'
  | 'bm_lewis';

export type GeminiVoiceId = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface VoiceAssignment {
  speakerId: string;
  speakerType: 'narrator' | 'character';
  speakerName: string;
  voiceLabel: string;
  kokoroVoice: KokoroVoiceId;
  kokoroLanguage: KokoroEnglishLanguageCode;
  geminiVoice: GeminiVoiceId;
  stylePrompt: string;
  speed: number;
}

export type AudioSegmentStatus = 'pending' | 'generating' | 'ready' | 'error';

export type MouthVisemeShape = 'closed' | 'half' | 'wide' | 'round';

export interface MouthEnvelopeFrame {
  open: number; // 0..1 normalized jaw/mouth openness
  shape: MouthVisemeShape;
}

export interface SpeechAudioSegment {
  id: string;
  sceneId: string;
  lineId: string;
  speakerId: string;
  speakerType: 'narrator' | 'character';
  speakerName: string;
  text: string;
  spokenText: string;
  emotion: FaceExpression;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  voiceAssignment: VoiceAssignment;
  playbackSpeed: number;
  status: AudioSegmentStatus;
  audioBuffer: AudioBuffer | null;
  mouthEnvelope?: MouthEnvelopeFrame[];
  mouthSampleRateHz?: number;
  engineUsed?: TtsEngineUsed;
  error?: string;
}

export interface AudioSyncedSceneTiming {
  sceneId: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface GeneratedAudioPlan {
  projectId: string;
  engineUsed: TtsEngineUsed;
  voiceAssignments: Record<string, VoiceAssignment>;
  segments: SpeechAudioSegment[];
  sceneTimings: AudioSyncedSceneTiming[];
  totalDurationSec: number;
  mixedMasterBuffer: AudioBuffer | null;
  previewMixWavBlob: Blob | null;
  audioBedSummary?: string;
}

export interface TtsInitProgress {
  phase: 'checking' | 'downloading' | 'initializing' | 'ready' | 'fallback';
  progressPct: number;
  message: string;
}
