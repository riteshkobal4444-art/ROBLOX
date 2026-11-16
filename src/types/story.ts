export type GenreOption =
  | 'Adventure'
  | 'Comedy'
  | 'Mystery'
  | 'Sci-Fi'
  | 'Slice of Life'
  | 'Horror';

export type AspectRatioOption = '9:16' | '16:9' | '1:1';

export type LanguageOption =
  | 'English'
  | 'Spanish'
  | 'French'
  | 'Portuguese'
  | 'Japanese'
  | 'Hindi';

export type EnvironmentType =
  | 'town_square'
  | 'suburban_street'
  | 'city_street'
  | 'cozy_house_interior'
  | 'modern_house_interior'
  | 'forest_park'
  | 'sci_fi_plaza'
  | 'school_hallway'
  | 'school_classroom';

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export type CameraShotType =
  | 'wide_establishing'
  | 'medium_two_shot'
  | 'close_up_speaker'
  | 'tracking_follow'
  | 'slow_pan'
  | 'dramatic_push';

export type CharacterActionType =
  | 'walk'
  | 'run'
  | 'talk'
  | 'listen'
  | 'stand'
  | 'sit'
  | 'wave'
  | 'point'
  | 'react_surprise'
  | 'react_happy'
  | 'look_around'
  | 'turn'
  | 'fall';

export type HairStyle =
  | 'spiky'
  | 'bob'
  | 'ponytail'
  | 'curly'
  | 'cap'
  | 'hoodie'
  | 'side_part'
  | 'long_wavy'
  | 'twin_pigtails'
  | 'bun'
  | 'fade';

export type CharacterStylePreset = 'boy' | 'girl' | 'neutral';

export type OutfitStyle =
  | 'casual_tee'
  | 'jacket'
  | 'varsity'
  | 'hoodie_outfit'
  | 'dress'
  | 'skirt_top'
  | 'overalls';

export type FaceStyle = 'classic' | 'lashes_bright' | 'freckles' | 'cheeky';

export type AccessoryType = 'none' | 'glasses' | 'backpack' | 'crown' | 'headphones' | 'scarf';

export type FaceExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'scared'
  | 'excited'
  | 'determined'
  | 'worried';

export type SfxType =
  | 'footsteps'
  | 'door'
  | 'door_close'
  | 'chime'
  | 'whoosh'
  | 'pop'
  | 'gasp'
  | 'impact'
  | 'vehicle'
  | 'thunder';

export type SceneMood =
  | 'upbeat'
  | 'tense'
  | 'heartwarming'
  | 'mysterious'
  | 'chaotic'
  | 'sad'
  | 'calm'
  | 'dramatic'
  | 'playful'
  | 'action';

export type SceneWeather = 'clear' | 'rain' | 'storm' | 'windy';

import type { TtsEnginePreference } from './audio';

export interface StoryFormInput {
  prompt: string;
  title?: string;
  genre: GenreOption;
  targetDurationSec: 15 | 30 | 45 | 60;
  language: LanguageOption;
  aspectRatio: AspectRatioOption;
  ttsPreference?: TtsEnginePreference;
}

export interface CharacterAppearance {
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  faceExpression: FaceExpression;
  accessory: AccessoryType;
  bodyScale: number;
  stylePreset?: CharacterStylePreset;
  outfitStyle?: OutfitStyle;
  faceStyle?: FaceStyle;
  shoeColor?: string;
  accentColor?: string;
}

export interface CharacterVoiceProfile {
  pitchHz: number;
  speed: number;
  timbre: 'bright' | 'warm' | 'deep' | 'energetic';
}

export interface CharacterSpec {
  id: string;
  name: string;
  role: string;
  personality: string;
  appearance: CharacterAppearance;
  voiceProfile: CharacterVoiceProfile;
}

export interface ActionBeat {
  characterId: string;
  action: CharacterActionType;
  startOffsetSec: number;
  endOffsetSec: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  facingYawDeg: number;
}

export interface ScriptLine {
  id: string;
  type: 'narration' | 'dialogue';
  speakerId?: string;
  speakerName: string;
  text: string;
  emotion: FaceExpression;
  startOffsetSec: number;
  durationSec: number;
}

export interface SfxCue {
  type: SfxType;
  offsetSec: number;
}

export interface SceneSpec {
  id: string;
  index: number;
  title: string;
  environmentType: EnvironmentType;
  timeOfDay: TimeOfDay;
  mood: SceneMood;
  weather?: SceneWeather;
  durationSec: number;
  cameraShot: CameraShotType;
  focusCharacterId?: string;
  actionBeats: ActionBeat[];
  lines: ScriptLine[];
  sfxCues: SfxCue[];
}

export interface StoryProject {
  id: string;
  createdAt: number;
  source: 'gemini-ai' | 'local-template';
  input: StoryFormInput;
  title: string;
  summary: string;
  characters: CharacterSpec[];
  scenes: SceneSpec[];
  approved: boolean;
}

export interface TimelineSubtitle {
  id: string;
  speakerName: string;
  isNarration: boolean;
  speakerColor: string;
  text: string;
  startSec: number;
  endSec: number;
  speakerId?: string;
  emotion: FaceExpression;
}

export interface TimelineScene {
  scene: SceneSpec;
  startSec: number;
  endSec: number;
}

export interface ProductionTimeline {
  totalDurationSec: number;
  scenes: TimelineScene[];
  subtitles: TimelineSubtitle[];
}

export type ProductionStageId =
  | 'dialogue_prep'
  | 'voice_init'
  | 'narration_tts'
  | 'dialogue_tts'
  | 'music_sfx'
  | 'audio_mix'
  | 'scene_sync'
  | 'rendering'
  | 'finalizing';

export interface ProductionStageState {
  id: ProductionStageId;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  errorMessage?: string;
}

export interface AudioSegmentPreviewInfo {
  id: string;
  speakerName: string;
  speakerType: 'narrator' | 'character';
  voiceLabel: string;
  text: string;
  startTimeSec: number;
  durationSec: number;
  status: 'pending' | 'generating' | 'ready' | 'error';
}

export interface ProductionProgress {
  stages: ProductionStageState[];
  currentFrame: number;
  totalFrames: number;
  currentSceneTitle: string;
  elapsedMs: number;
  isComplete: boolean;
  ttsEngineLabel?: string;
  modelLoadProgressPct?: number;
  modelLoadStatus?: string;
  audioSegments?: AudioSegmentPreviewInfo[];
  audioMixWavBlob?: Blob | null;
  audioBedSummary?: string;
  error?: string;
}

export type ExportFormat = 'webm' | 'mp4';

export interface RenderedVideoResult {
  id: string;
  projectId: string;
  title: string;
  blob: Blob;
  mimeType: string;
  format: ExportFormat;
  codecSummary: string;
  ttsSummary?: string;
  audioBedSummary?: string;
  durationSec: number;
  width: number;
  height: number;
  aspectRatio: AspectRatioOption;
  fileSizeBytes: number;
  createdAt: number;
}

export type AppRoute = 'home' | 'create' | 'review' | 'production' | 'preview' | 'projects' | 'asset_lab';

export interface SessionWorkspace {
  draftInput: StoryFormInput;
  story: StoryProject | null;
  renderedVideo: RenderedVideoResult | null;
  activeRoute: AppRoute;
  updatedAt: number;
}
