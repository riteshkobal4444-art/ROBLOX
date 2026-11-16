import type {
  ActionBeat,
  CharacterSpec,
  CharacterStylePreset,
  EnvironmentType,
  FaceExpression,
  FaceStyle,
  HairStyle,
  OutfitStyle,
  ProductionTimeline,
  SceneMood,
  SceneSpec,
  SceneWeather,
  ScriptLine,
  SfxType,
  StoryFormInput,
  StoryProject,
  TimelineScene,
  TimelineSubtitle,
} from '../types/story';

const VALID_ENVIRONMENTS: EnvironmentType[] = [
  'town_square',
  'suburban_street',
  'city_street',
  'cozy_house_interior',
  'modern_house_interior',
  'forest_park',
  'sci_fi_plaza',
  'school_hallway',
  'school_classroom',
];

const VALID_HAIR_STYLES: HairStyle[] = [
  'spiky',
  'bob',
  'ponytail',
  'curly',
  'cap',
  'hoodie',
  'side_part',
  'long_wavy',
  'twin_pigtails',
  'bun',
  'fade',
];

const VALID_OUTFIT_STYLES: OutfitStyle[] = [
  'casual_tee',
  'jacket',
  'varsity',
  'hoodie_outfit',
  'dress',
  'skirt_top',
  'overalls',
];

const VALID_FACE_STYLES: FaceStyle[] = ['classic', 'lashes_bright', 'freckles', 'cheeky'];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sanitizeHex(hex: unknown, fallback: string): string {
  if (typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return fallback;
}

function inferStylePreset(
  rawPreset: unknown,
  name: string,
  role: string,
  personality: string,
  hairStyle: HairStyle,
  outfitStyleRaw: unknown,
  pitchHz: number,
  idx: number
): CharacterStylePreset {
  if (rawPreset === 'boy' || rawPreset === 'girl' || rawPreset === 'neutral') {
    return rawPreset;
  }
  const blob = `${name} ${role} ${personality}`.toLowerCase();
  if (
    /\b(girl|female|sister|daughter|mom|mother|queen|princess|her|she|maya|mia|lily|emma|sophia|chloe|ella|zoe|ava|nina|claire|hanna)\b/.test(
      blob
    ) ||
    ['bob', 'ponytail', 'long_wavy', 'twin_pigtails', 'bun'].includes(hairStyle) ||
    outfitStyleRaw === 'dress' ||
    outfitStyleRaw === 'skirt_top' ||
    pitchHz >= 220
  ) {
    return 'girl';
  }
  if (
    /\b(boy|male|brother|son|dad|father|king|prince|him|he|kai|leo|sam|max|noah|liam|alex|lucas|ethan|toby|ryan|jake)\b/.test(
      blob
    ) ||
    ['spiky', 'fade', 'side_part', 'cap'].includes(hairStyle) ||
    pitchHz <= 190
  ) {
    return 'boy';
  }
  return idx % 2 === 1 ? 'girl' : 'boy';
}

function resolveCharacterId(
  rawId: unknown,
  rawName: unknown,
  characters: CharacterSpec[],
  fallbackId: string
): string {
  const byId = typeof rawId === 'string' ? rawId.trim() : '';
  if (byId && characters.some((c) => c.id === byId)) {
    return byId;
  }
  const normId = byId.toLowerCase();
  const normName = typeof rawName === 'string' ? rawName.trim().toLowerCase() : '';
  for (const ch of characters) {
    const chName = ch.name.trim().toLowerCase();
    if ((normId && (chName === normId || ch.id.toLowerCase() === normId)) || (normName && chName === normName)) {
      return ch.id;
    }
  }
  return fallbackId;
}

export function normalizeStoryProject(
  raw: Record<string, unknown>,
  input: StoryFormInput,
  source: 'gemini-ai' | 'local-template'
): StoryProject {
  // Tasteful varied wardrobe palettes (forest green, terracotta, indigo slate, mustard, burgundy, teal — zero pink/blue clichés)
  const boyWardrobes: Array<{
    shirt: string;
    pants: string;
    shoe: string;
    accent: string;
    hair: HairStyle;
    outfit: OutfitStyle;
    face: FaceStyle;
  }> = [
    {
      shirt: '#d97706',
      pants: '#1e293b',
      shoe: '#f8fafc',
      accent: '#fef3c7',
      hair: 'spiky',
      outfit: 'jacket',
      face: 'classic',
    },
    {
      shirt: '#15803d',
      pants: '#334155',
      shoe: '#111827',
      accent: '#fde68a',
      hair: 'fade',
      outfit: 'varsity',
      face: 'freckles',
    },
    {
      shirt: '#4338ca',
      pants: '#1f2937',
      shoe: '#e2e8f0',
      accent: '#38bdf8',
      hair: 'side_part',
      outfit: 'hoodie_outfit',
      face: 'classic',
    },
  ];

  const girlWardrobes: Array<{
    shirt: string;
    pants: string;
    shoe: string;
    accent: string;
    hair: HairStyle;
    outfit: OutfitStyle;
    face: FaceStyle;
  }> = [
    {
      shirt: '#0f766e',
      pants: '#1e293b',
      shoe: '#fef3c7',
      accent: '#f59e0b',
      hair: 'long_wavy',
      outfit: 'overalls',
      face: 'lashes_bright',
    },
    {
      shirt: '#b45309',
      pants: '#312e81',
      shoe: '#f8fafc',
      accent: '#fde68a',
      hair: 'ponytail',
      outfit: 'skirt_top',
      face: 'lashes_bright',
    },
    {
      shirt: '#7c2d12',
      pants: '#0f172a',
      shoe: '#f1f5f9',
      accent: '#fbbf24',
      hair: 'bob',
      outfit: 'dress',
      face: 'freckles',
    },
  ];

  const skinPalette = ['#f3cfb3', '#e0ac82', '#9c6848', '#f6dcc5'];

  const rawChars = Array.isArray(raw.characters) ? raw.characters : [];
  let boyCounter = 0;
  let girlCounter = 0;

  const characters: CharacterSpec[] = rawChars.slice(0, 4).map((c: unknown, idx: number) => {
    const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const app = (item.appearance && typeof item.appearance === 'object'
      ? item.appearance
      : {}) as Record<string, unknown>;
    const voice = (item.voiceProfile && typeof item.voiceProfile === 'object'
      ? item.voiceProfile
      : {}) as Record<string, unknown>;

    const charName =
      typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Player ${idx + 1}`;
    const charRole =
      typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Character';
    const charPersonality =
      typeof item.personality === 'string' && item.personality.trim()
        ? item.personality.trim()
        : 'Resourceful and expressive';

    const rawHair = VALID_HAIR_STYLES.includes(app.hairStyle as HairStyle)
      ? (app.hairStyle as HairStyle)
      : undefined;
    const rawPitch = Number(voice.pitchHz) || 0;

    const stylePreset = inferStylePreset(
      app.stylePreset,
      charName,
      charRole,
      charPersonality,
      rawHair || (idx % 2 === 1 ? 'ponytail' : 'spiky'),
      app.outfitStyle,
      rawPitch,
      idx
    );

    const wardrobe =
      stylePreset === 'girl'
        ? girlWardrobes[girlCounter++ % girlWardrobes.length]
        : boyWardrobes[boyCounter++ % boyWardrobes.length];

    const hairStyle: HairStyle = rawHair || wardrobe.hair;
    const outfitStyle: OutfitStyle = VALID_OUTFIT_STYLES.includes(app.outfitStyle as OutfitStyle)
      ? (app.outfitStyle as OutfitStyle)
      : wardrobe.outfit;
    const faceStyle: FaceStyle = VALID_FACE_STYLES.includes(app.faceStyle as FaceStyle)
      ? (app.faceStyle as FaceStyle)
      : wardrobe.face;

    const defaultPitch = stylePreset === 'girl' ? 240 : 172;
    const pitchHz = clamp(rawPitch || defaultPitch, 130, 300);

    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `char_${idx + 1}`,
      name: charName,
      role: charRole,
      personality: charPersonality,
      appearance: {
        skinColor: sanitizeHex(app.skinColor, skinPalette[idx % skinPalette.length]),
        shirtColor: sanitizeHex(app.shirtColor, wardrobe.shirt),
        pantsColor: sanitizeHex(app.pantsColor, wardrobe.pants),
        hairStyle,
        hairColor: sanitizeHex(app.hairColor, idx % 2 === 0 ? '#2d1b0e' : '#3f2a1d'),
        faceExpression: ([
          'neutral',
          'happy',
          'sad',
          'angry',
          'surprised',
          'confused',
          'scared',
          'excited',
          'determined',
          'worried',
        ].includes(String(app.faceExpression))
          ? app.faceExpression
          : 'neutral') as FaceExpression,
        accessory: (['none', 'glasses', 'backpack', 'crown', 'headphones', 'scarf'].includes(
          String(app.accessory)
        )
          ? app.accessory
          : idx === 0
            ? 'backpack'
            : 'none') as CharacterSpec['appearance']['accessory'],
        bodyScale: clamp(Number(app.bodyScale) || (stylePreset === 'girl' ? 0.96 : 1.02), 0.9, 1.12),
        stylePreset,
        outfitStyle,
        faceStyle,
        shoeColor: sanitizeHex(app.shoeColor, wardrobe.shoe),
        accentColor: sanitizeHex(app.accentColor, wardrobe.accent),
      },
      voiceProfile: {
        pitchHz,
        speed: clamp(Number(voice.speed) || 1, 0.88, 1.18),
        timbre: (['bright', 'warm', 'deep', 'energetic'].includes(String(voice.timbre))
          ? voice.timbre
          : stylePreset === 'girl'
            ? 'bright'
            : 'warm') as CharacterSpec['voiceProfile']['timbre'],
      },
    };
  });

  if (characters.length === 0) {
    characters.push({
      id: 'char_1',
      name: 'Alex',
      role: 'Protagonist',
      personality: 'Curious explorer',
      appearance: {
        skinColor: '#f3cfb3',
        shirtColor: '#d97706',
        pantsColor: '#1e293b',
        hairStyle: 'spiky',
        hairColor: '#2d1b0e',
        faceExpression: 'determined',
        accessory: 'backpack',
        bodyScale: 1,
        stylePreset: 'boy',
        outfitStyle: 'jacket',
        faceStyle: 'classic',
        shoeColor: '#f8fafc',
        accentColor: '#fef3c7',
      },
      voiceProfile: { pitchHz: 185, speed: 1, timbre: 'energetic' },
    });
  }

  const charIds = new Set(characters.map((c) => c.id));
  const fallbackCharId = characters[0].id;
  const usedSceneIds = new Set<string>();

  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const scenes: SceneSpec[] = rawScenes.slice(0, 6).map((s: unknown, idx: number) => {
    const item = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const durationSec = clamp(Number(item.durationSec) || 7, 4, 18);
    const envType = VALID_ENVIRONMENTS.includes(item.environmentType as EnvironmentType)
      ? (item.environmentType as EnvironmentType)
      : 'town_square';

    let sceneId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `scene_${idx + 1}`;
    if (usedSceneIds.has(sceneId)) {
      sceneId = `${sceneId}_${idx + 1}`;
    }
    usedSceneIds.add(sceneId);

    const rawBeats = Array.isArray(item.actionBeats) ? item.actionBeats : [];
    const actionBeats: ActionBeat[] = rawBeats.map((b: unknown, bIdx: number) => {
      const beat = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      const charId = resolveCharacterId(
        beat.characterId,
        undefined,
        characters,
        characters[bIdx % characters.length].id
      );
      const startOffsetSec = clamp(Number(beat.startOffsetSec) || 0, 0, durationSec - 0.5);
      const endOffsetSec = clamp(
        Number(beat.endOffsetSec) || durationSec,
        startOffsetSec + 0.5,
        durationSec
      );
      const rawFromX = Number(beat.fromX);
      const rawToX = Number(beat.toX);
      const defaultX = (bIdx - Math.max(0, (Math.min(3, characters.length) - 1) / 2)) * 1.15;
      return {
        characterId: charId,
        action: (beat.action || 'stand') as ActionBeat['action'],
        startOffsetSec,
        endOffsetSec,
        fromX: clamp(Number.isFinite(rawFromX) ? rawFromX : defaultX, -2.9, 2.9),
        fromZ: clamp(Number(beat.fromZ) || 0, -1.7, 1.7),
        toX: clamp(Number.isFinite(rawToX) ? rawToX : defaultX, -2.9, 2.9),
        toZ: clamp(Number(beat.toZ) || 0, -1.7, 1.7),
        facingYawDeg: Number.isFinite(Number(beat.facingYawDeg))
          ? Number(beat.facingYawDeg)
          : bIdx % 2 === 0
            ? 24
            : -24,
      };
    });

    if (actionBeats.length === 0) {
      const castCount = Math.min(3, characters.length);
      characters.slice(0, castCount).forEach((ch, cIdx) => {
        const slotX =
          castCount === 1 ? 0 : (cIdx - (castCount - 1) / 2) * (castCount === 3 ? 1.15 : 1.35);
        actionBeats.push({
          characterId: ch.id,
          action: cIdx === 0 ? 'talk' : 'listen',
          startOffsetSec: 0,
          endOffsetSec: durationSec,
          fromX: slotX,
          fromZ: cIdx === 1 && castCount === 3 ? -0.3 : 0.25,
          toX: slotX,
          toZ: cIdx === 1 && castCount === 3 ? -0.3 : 0.25,
          facingYawDeg: slotX < 0 ? 26 : slotX > 0 ? -26 : 0,
        });
      });
    } else {
      // Prevent simultaneous character overlap at exact same coordinates
      for (let i = 0; i < actionBeats.length; i++) {
        for (let j = i + 1; j < actionBeats.length; j++) {
          const a = actionBeats[i];
          const b = actionBeats[j];
          if (a.characterId === b.characterId) continue;
          const overlapsTime = a.startOffsetSec < b.endOffsetSec && b.startOffsetSec < a.endOffsetSec;
          if (!overlapsTime) continue;
          const dFrom = Math.hypot(b.fromX - a.fromX, b.fromZ - a.fromZ);
          if (dFrom < 0.85) {
            const shift = b.fromX >= a.fromX ? 0.55 : -0.55;
            b.fromX = clamp(b.fromX + shift, -2.8, 2.8);
          }
          const dTo = Math.hypot(b.toX - a.toX, b.toZ - a.toZ);
          if (dTo < 0.85) {
            const shift = b.toX >= a.toX ? 0.55 : -0.55;
            b.toX = clamp(b.toX + shift, -2.8, 2.8);
          }
        }
      }
    }

    const rawLines = Array.isArray(item.lines) ? item.lines : [];
    let cursorSec = 0.35;
    const usedLineIds = new Set<string>();
    const lines: ScriptLine[] = rawLines.map((l: unknown, lIdx: number) => {
      const line = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      const isNarration = line.type === 'narration';
      const speakerId = !isNarration
        ? resolveCharacterId(line.speakerId, line.speakerName, characters, fallbackCharId)
        : undefined;
      const speakerChar = characters.find((c) => c.id === speakerId);
      const rawStart = Number(line.startOffsetSec);
      const startOffsetSec = clamp(
        Number.isFinite(rawStart) ? Math.max(rawStart, cursorSec) : cursorSec,
        0,
        Math.max(0.2, durationSec - 1.2)
      );
      const maxRemaining = Math.max(1.0, durationSec - startOffsetSec - 0.15);
      const lineDur = clamp(Number(line.durationSec) || 2.8, 1.2, maxRemaining);
      cursorSec = Math.min(durationSec - 0.4, startOffsetSec + lineDur + 0.15);

      let lineId =
        typeof line.id === 'string' && line.id.trim()
          ? line.id.trim()
          : `${sceneId}_line_${lIdx + 1}`;
      if (usedLineIds.has(lineId)) {
        lineId = `${sceneId}_${lineId}_${lIdx + 1}`;
      }
      usedLineIds.add(lineId);

      return {
        id: lineId,
        type: isNarration ? 'narration' : 'dialogue',
        speakerId,
        speakerName: isNarration
          ? 'Narrator'
          : typeof line.speakerName === 'string' && line.speakerName.trim()
            ? line.speakerName.trim()
            : speakerChar?.name || 'Character',
        text: typeof line.text === 'string' && line.text.trim() ? line.text.trim() : '...',
        emotion: ([
          'neutral',
          'happy',
          'sad',
          'angry',
          'surprised',
          'confused',
          'scared',
          'excited',
          'determined',
          'worried',
        ].includes(String(line.emotion))
          ? line.emotion
          : 'neutral') as FaceExpression,
        startOffsetSec,
        durationSec: lineDur,
      };
    });

    const validSfx: SfxType[] = [
      'footsteps',
      'door',
      'door_close',
      'chime',
      'whoosh',
      'pop',
      'gasp',
      'impact',
      'vehicle',
      'thunder',
    ];
    const validMoods: SceneMood[] = [
      'upbeat',
      'tense',
      'heartwarming',
      'mysterious',
      'chaotic',
      'sad',
      'calm',
      'dramatic',
      'playful',
      'action',
    ];
    const validWeather: SceneWeather[] = ['clear', 'rain', 'storm', 'windy'];

    const rawSfx = Array.isArray(item.sfxCues) ? item.sfxCues : [];
    const sfxCues = rawSfx.map((cue: unknown) => {
      const c = (cue && typeof cue === 'object' ? cue : {}) as Record<string, unknown>;
      return {
        type: (validSfx.includes(String(c.type) as SfxType)
          ? c.type
          : 'chime') as SfxType,
        offsetSec: clamp(Number(c.offsetSec) || 0.2, 0, durationSec - 0.2),
      };
    });

    return {
      id: sceneId,
      index: idx + 1,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Scene ${idx + 1}`,
      environmentType: envType,
      timeOfDay: (['morning', 'day', 'sunset', 'night'].includes(String(item.timeOfDay))
        ? item.timeOfDay
        : 'day') as SceneSpec['timeOfDay'],
      mood: (validMoods.includes(String(item.mood) as SceneMood)
        ? item.mood
        : 'upbeat') as SceneMood,
      weather: validWeather.includes(String(item.weather) as SceneWeather)
        ? (item.weather as SceneWeather)
        : undefined,
      durationSec,
      cameraShot: ([
        'wide_establishing',
        'medium_two_shot',
        'close_up_speaker',
        'tracking_follow',
        'slow_pan',
        'dramatic_push',
      ].includes(String(item.cameraShot))
        ? item.cameraShot
        : idx === 0
          ? 'wide_establishing'
          : 'medium_two_shot') as SceneSpec['cameraShot'],
      focusCharacterId: charIds.has(String(item.focusCharacterId))
        ? String(item.focusCharacterId)
        : fallbackCharId,
      actionBeats,
      lines,
      sfxCues,
    };
  });

  return {
    id: `proj_${Date.now()}`,
    createdAt: Date.now(),
    source,
    input,
    title:
      input.title?.trim() ||
      (typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled Blocky Tale'),
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : `A ${input.genre.toLowerCase()} story inspired by: ${input.prompt.slice(0, 110)}.`,
    characters,
    scenes,
    approved: false,
  };
}

export async function generateStoryWithAI(input: StoryFormInput): Promise<StoryProject> {
  const response = await fetch('/api/story/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    story?: Record<string, unknown>;
    error?: string;
    code?: string;
  };

  if (!response.ok || !payload.story) {
    const err = new Error(payload.error || `Story generation failed (HTTP ${response.status}).`);
    (err as Error & { code?: string }).code = payload.code;
    throw err;
  }

  return normalizeStoryProject(payload.story, input, 'gemini-ai');
}

export function buildLocalStructuredStory(input: StoryFormInput): StoryProject {
  const promptLower = input.prompt.toLowerCase();
  const pickEnv = (): EnvironmentType => {
    if (/space|robot|laser|portal|cyber|sci-fi|future|station/.test(promptLower)) {
      return 'sci_fi_plaza';
    }
    if (/classroom|desk|chalkboard|whiteboard|teacher|lecture|lesson/.test(promptLower)) {
      return 'school_classroom';
    }
    if (/school|class|locker|hall|exam|academy/.test(promptLower)) {
      return 'school_hallway';
    }
    if (/forest|woods|camp|park|tree|river|pond|stream|trail|treasure|island/.test(promptLower)) {
      return 'forest_park';
    }
    if (/modern house|living room|apartment interior|sofa|kitchen|dining/.test(promptLower)) {
      return 'modern_house_interior';
    }
    if (/house|home|room|basement|door|bedroom/.test(promptLower)) {
      return 'cozy_house_interior';
    }
    if (/city|downtown|office|restaurant|cafe|bakery|shop|store|mall|apartment/.test(promptLower)) {
      return 'city_street';
    }
    if (/street|neighbor|car|bike|road|bus|suburb/.test(promptLower)) {
      return 'suburban_street';
    }
    return 'town_square';
  };

  const primaryEnv = pickEnv();
  const secondaryEnv: EnvironmentType =
    primaryEnv === 'cozy_house_interior' || primaryEnv === 'modern_house_interior'
      ? 'suburban_street'
      : primaryEnv === 'school_hallway'
        ? 'school_classroom'
        : primaryEnv === 'forest_park'
          ? 'town_square'
          : primaryEnv === 'city_street'
            ? 'modern_house_interior'
            : 'town_square';
  const timeOfDay: SceneSpec['timeOfDay'] = /night|midnight|dark|ghost|haunt|moon|stars/.test(promptLower)
    ? 'night'
    : /sunset|evening|dusk|golden/.test(promptLower)
      ? 'sunset'
      : /morning|sunrise|dawn|breakfast/.test(promptLower)
        ? 'morning'
        : 'day';
  const weather: SceneSpec['weather'] = /thunder|lightning|storm|tempest/.test(promptLower)
    ? 'storm'
    : /rain|rainy|raining|drizzle|puddle/.test(promptLower)
      ? 'rain'
      : /wind|windy|breeze|gust/.test(promptLower)
        ? 'windy'
        : 'clear';

  const mood: SceneSpec['mood'] =
    input.genre === 'Mystery' || input.genre === 'Horror'
      ? 'mysterious'
      : input.genre === 'Comedy'
        ? 'chaotic'
        : input.genre === 'Slice of Life'
          ? 'heartwarming'
          : 'upbeat';

  const sceneCount = input.targetDurationSec <= 15 ? 3 : input.targetDurationSec <= 30 ? 4 : 5;
  const perSceneDur = Math.max(4.5, Number((input.targetDurationSec / sceneCount).toFixed(1)));

  const words = input.prompt
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const topicSnippet = words.slice(0, 7).join(' ') || 'the unexpected discovery';

  const wantsThree = /\b(three|3|trio|two boys|two brothers|team|squad|group)\b/.test(promptLower);

  const characters: CharacterSpec[] = [
    {
      id: 'char_1',
      name: 'Leo',
      role: 'Lead Explorer',
      personality: 'Bold and curious',
      appearance: {
        skinColor: '#f3cfb3',
        shirtColor: '#d97706',
        pantsColor: '#1e293b',
        hairStyle: 'spiky',
        hairColor: '#2d1b0e',
        faceExpression: 'determined',
        accessory: 'backpack',
        bodyScale: 1.03,
        stylePreset: 'boy',
        outfitStyle: 'jacket',
        faceStyle: 'classic',
        shoeColor: '#f8fafc',
        accentColor: '#fef3c7',
      },
      voiceProfile: { pitchHz: 175, speed: 1, timbre: 'energetic' },
    },
    {
      id: 'char_2',
      name: 'Maya',
      role: 'Strategist',
      personality: 'Quick-witted planner',
      appearance: {
        skinColor: '#e0ac82',
        shirtColor: '#0f766e',
        pantsColor: '#1e293b',
        hairStyle: 'long_wavy',
        hairColor: '#1f2937',
        faceExpression: 'happy',
        accessory: 'headphones',
        bodyScale: 0.97,
        stylePreset: 'girl',
        outfitStyle: 'overalls',
        faceStyle: 'lashes_bright',
        shoeColor: '#fef3c7',
        accentColor: '#f59e0b',
      },
      voiceProfile: { pitchHz: 245, speed: 1.03, timbre: 'bright' },
    },
  ];

  if (wantsThree) {
    characters.push({
      id: 'char_3',
      name: 'Sam',
      role: 'Best Friend',
      personality: 'Loyal and observant',
      appearance: {
        skinColor: '#9c6848',
        shirtColor: '#15803d',
        pantsColor: '#334155',
        hairStyle: 'fade',
        hairColor: '#111827',
        faceExpression: 'happy',
        accessory: 'none',
        bodyScale: 0.99,
        stylePreset: 'boy',
        outfitStyle: 'varsity',
        faceStyle: 'freckles',
        shoeColor: '#111827',
        accentColor: '#fde68a',
      },
      voiceProfile: { pitchHz: 162, speed: 0.98, timbre: 'warm' },
    });
  }

  const templates: Array<{
    title: string;
    env: EnvironmentType;
    shot: SceneSpec['cameraShot'];
    narration: string;
    speakerIdx: number;
    dialogue: string;
    emotion: FaceExpression;
    a1: ActionBeat['action'];
    a2: ActionBeat['action'];
    a3: ActionBeat['action'];
    sfx: SceneSpec['sfxCues'][number]['type'];
  }> = [
    {
      title: 'The Spark',
      env: primaryEnv,
      shot: 'wide_establishing',
      narration: `It started with ${topicSnippet}, right when nobody expected trouble.`,
      speakerIdx: 0,
      dialogue: `${characters[1].name}, look over here! Something strange is happening.`,
      emotion: 'excited',
      a1: 'walk',
      a2: 'look_around',
      a3: 'stand',
      sfx: 'whoosh',
    },
    {
      title: 'Closer Inspection',
      env: primaryEnv,
      shot: 'medium_two_shot',
      narration: 'The friends stepped closer to check out the clues.',
      speakerIdx: 1,
      dialogue: 'Whoa, wait a second... this is bigger than we thought!',
      emotion: 'surprised',
      a1: 'point',
      a2: 'react_surprise',
      a3: 'listen',
      sfx: 'chime',
    },
    {
      title: 'The Turning Point',
      env: secondaryEnv,
      shot: 'tracking_follow',
      narration: 'With no time to waste, they hurried across the block together.',
      speakerIdx: characters.length > 2 ? 2 : 0,
      dialogue: 'Stay together—we can solve this before sunset!',
      emotion: 'determined',
      a1: 'walk',
      a2: 'walk',
      a3: 'walk',
      sfx: 'footsteps',
    },
    {
      title: 'The Big Reaction',
      env: secondaryEnv,
      shot: 'close_up_speaker',
      narration: 'Against the odds, their quick teamwork changed everything.',
      speakerIdx: 1,
      dialogue: 'Did we actually pull that off?! That was amazing!',
      emotion: 'happy',
      a1: 'react_happy',
      a2: 'wave',
      a3: 'react_happy',
      sfx: 'pop',
    },
    {
      title: 'New Horizon',
      env: primaryEnv,
      shot: 'slow_pan',
      narration: 'And just like that, a brand-new adventure was only beginning.',
      speakerIdx: 0,
      dialogue: 'Next time, let us bring extra snacks.',
      emotion: 'happy',
      a1: 'wave',
      a2: 'react_happy',
      a3: 'wave',
      sfx: 'chime',
    },
  ];

  const scenes: SceneSpec[] = templates.slice(0, sceneCount).map((tpl, idx) => {
    const speaker = characters[tpl.speakerIdx % characters.length];
    const half = Number((perSceneDur * 0.45).toFixed(2));
    const beats: ActionBeat[] = characters.map((ch, cIdx) => {
      const action = cIdx === 0 ? tpl.a1 : cIdx === 1 ? tpl.a2 : tpl.a3;
      const isWalkScene = idx === 2;
      const slotSpacing = characters.length === 3 ? 1.15 : 1.35;
      const baseX = (cIdx - (characters.length - 1) / 2) * slotSpacing;
      return {
        characterId: ch.id,
        action,
        startOffsetSec: 0,
        endOffsetSec: perSceneDur,
        fromX: isWalkScene ? baseX - 1.4 : baseX,
        fromZ: cIdx === 1 && characters.length === 3 ? -0.35 : 0.2,
        toX: isWalkScene ? baseX + 1.1 : baseX * 0.85,
        toZ: cIdx === 1 && characters.length === 3 ? -0.25 : 0.15,
        facingYawDeg: isWalkScene ? 82 : baseX < 0 ? 28 : baseX > 0 ? -28 : 0,
      };
    });

    return {
      id: `scene_${idx + 1}`,
      index: idx + 1,
      title: tpl.title,
      environmentType: tpl.env,
      timeOfDay,
      mood,
      weather,
      durationSec: perSceneDur,
      cameraShot: tpl.shot,
      focusCharacterId: speaker.id,
      actionBeats: beats,
      lines: [
        {
          id: `s${idx + 1}_line_1`,
          type: 'narration',
          speakerName: 'Narrator',
          text: tpl.narration,
          emotion: 'neutral',
          startOffsetSec: 0.25,
          durationSec: Math.max(1.5, half - 0.3),
        },
        {
          id: `s${idx + 1}_line_2`,
          type: 'dialogue',
          speakerId: speaker.id,
          speakerName: speaker.name,
          text: tpl.dialogue,
          emotion: tpl.emotion,
          startOffsetSec: half + 0.1,
          durationSec: Math.max(1.5, perSceneDur - half - 0.35),
        },
      ],
      sfxCues: [{ type: tpl.sfx, offsetSec: 0.2 }],
    };
  });

  return {
    id: `proj_${Date.now()}`,
    createdAt: Date.now(),
    source: 'local-template',
    input,
    title: input.title?.trim() || `${input.genre}: ${words.slice(0, 4).join(' ') || 'Blocky Quest'}`,
    summary: `On-device structured ${input.genre.toLowerCase()} story based on "${input.prompt.trim()}".`,
    characters,
    scenes,
    approved: false,
  };
}

export function computeProductionTimeline(story: StoryProject): ProductionTimeline {
  const scenes: TimelineScene[] = [];
  const subtitles: TimelineSubtitle[] = [];
  let cursor = 0;

  const colorMap = new Map<string, string>();
  story.characters.forEach((c) => {
    colorMap.set(c.id, c.appearance.shirtColor);
  });

  for (const scene of story.scenes) {
    const startSec = cursor;
    const endSec = startSec + scene.durationSec;
    scenes.push({ scene, startSec, endSec });

    for (const line of scene.lines) {
      const lineStart = startSec + line.startOffsetSec;
      const lineEnd = Math.min(endSec - 0.05, lineStart + line.durationSec);
      if (lineEnd > lineStart) {
        subtitles.push({
          id: `${scene.id}__${line.id}`,
          speakerName: line.speakerName,
          isNarration: line.type === 'narration',
          speakerColor:
            line.type === 'narration'
              ? '#ffc174'
              : (line.speakerId && colorMap.get(line.speakerId)) || '#4cd7f6',
          text: line.text,
          startSec: lineStart,
          endSec: lineEnd,
          speakerId: line.speakerId,
          emotion: line.emotion,
        });
      }
    }

    cursor = endSec;
  }

  return {
    totalDurationSec: cursor,
    scenes,
    subtitles,
  };
}
