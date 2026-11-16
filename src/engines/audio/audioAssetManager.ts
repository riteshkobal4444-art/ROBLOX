export type MusicMoodKey =
  | 'happy_cheerful'
  | 'emotional_sad'
  | 'suspense_mystery'
  | 'adventure_action'
  | 'calm_peaceful'
  | 'dramatic_cinematic'
  | 'funny_playful';

export type AmbienceKey =
  | 'town_outdoor'
  | 'forest_birds_wind'
  | 'rain_loop'
  | 'indoor_room'
  | 'night_crickets'
  | 'street_traffic'
  | 'scifi_hum'
  | 'wind_loop';

export type SfxAssetKey =
  | 'footstep_stone'
  | 'footstep_wood'
  | 'footstep_wet'
  | 'door_open'
  | 'door_close'
  | 'vehicle_pass'
  | 'interact_chime'
  | 'interact_pop'
  | 'impact_fall'
  | 'whoosh'
  | 'thunder';

export interface AudioAssetEntry {
  url: string;
  label: string;
  license: string;
}

export const MUSIC_ASSETS: Record<MusicMoodKey, AudioAssetEntry> = {
  happy_cheerful: {
    url: '/audio/music/happy_cheerful.mp3',
    label: 'Happy & Cheerful (Chocolate Valley)',
    license: 'CC0 1.0',
  },
  emotional_sad: {
    url: '/audio/music/emotional_sad.mp3',
    label: 'Emotional & Sad (Sad Walk Piano)',
    license: 'CC0 1.0',
  },
  suspense_mystery: {
    url: '/audio/music/suspense_mystery.mp3',
    label: 'Suspense & Mystery (The Secret)',
    license: 'CC0 1.0',
  },
  adventure_action: {
    url: '/audio/music/adventure_action.mp3',
    label: 'Adventure & Action (Intro)',
    license: 'CC0 1.0',
  },
  calm_peaceful: {
    url: '/audio/music/calm_peaceful.mp3',
    label: 'Calm & Peaceful (Chillin Poupi)',
    license: 'CC0 1.0',
  },
  dramatic_cinematic: {
    url: '/audio/music/dramatic_cinematic.mp3',
    label: 'Dramatic & Cinematic (Queen)',
    license: 'CC0 1.0',
  },
  funny_playful: {
    url: '/audio/music/funny_playful.mp3',
    label: 'Funny & Playful (Fetch Fever)',
    license: 'CC0 1.0',
  },
};

export const AMBIENCE_ASSETS: Record<AmbienceKey, AudioAssetEntry> = {
  town_outdoor: {
    url: '/audio/ambience/town_outdoor.mp3',
    label: 'Outdoor Town & Birds',
    license: 'Public Domain',
  },
  forest_birds_wind: {
    url: '/audio/ambience/forest_birds_wind.mp3',
    label: 'Forest Birds & Breeze',
    license: 'Public Domain',
  },
  rain_loop: {
    url: '/audio/ambience/rain_loop.mp3',
    label: 'Steady Rainfall',
    license: 'CC0 1.0',
  },
  indoor_room: {
    url: '/audio/ambience/indoor_room.mp3',
    label: 'Subtle Room Ambience',
    license: 'CC0 1.0',
  },
  night_crickets: {
    url: '/audio/ambience/night_crickets.mp3',
    label: 'Nighttime Crickets',
    license: 'CC0 1.0',
  },
  street_traffic: {
    url: '/audio/ambience/street_traffic.mp3',
    label: 'Distant Street Traffic',
    license: 'Public Domain',
  },
  scifi_hum: {
    url: '/audio/ambience/scifi_hum.mp3',
    label: 'Sci-Fi Plaza Hum',
    license: 'CC0 1.0',
  },
  wind_loop: {
    url: '/audio/ambience/wind_loop.mp3',
    label: 'Outdoor Wind',
    license: 'CC0 1.0',
  },
};

export const SFX_ASSETS: Record<SfxAssetKey, AudioAssetEntry> = {
  footstep_stone: {
    url: '/audio/sfx/footstep_stone.mp3',
    label: 'Footsteps (Outdoor)',
    license: 'CC0 1.0',
  },
  footstep_wood: {
    url: '/audio/sfx/footstep_wood.mp3',
    label: 'Footsteps (Wood/Indoor)',
    license: 'CC0 1.0',
  },
  footstep_wet: {
    url: '/audio/sfx/footstep_wet.mp3',
    label: 'Footsteps (Wet/Rain)',
    license: 'CC0 1.0',
  },
  door_open: {
    url: '/audio/sfx/door_open.mp3',
    label: 'Door Open',
    license: 'CC0 1.0',
  },
  door_close: {
    url: '/audio/sfx/door_close.mp3',
    label: 'Door Close',
    license: 'CC0 1.0',
  },
  vehicle_pass: {
    url: '/audio/sfx/vehicle_pass.mp3',
    label: 'Vehicle Engine',
    license: 'CC0 1.0',
  },
  interact_chime: {
    url: '/audio/sfx/interact_chime.mp3',
    label: 'Discovery Chime',
    license: 'CC0 1.0',
  },
  interact_pop: {
    url: '/audio/sfx/interact_pop.mp3',
    label: 'Object Interaction Pop',
    license: 'CC0 1.0',
  },
  impact_fall: {
    url: '/audio/sfx/impact_fall.mp3',
    label: 'Impact / Collision',
    license: 'CC0 1.0',
  },
  whoosh: {
    url: '/audio/sfx/whoosh.mp3',
    label: 'Movement Swish',
    license: 'CC0 1.0',
  },
  thunder: {
    url: '/audio/sfx/thunder.mp3',
    label: 'Storm Thunder',
    license: 'CC0 1.0',
  },
};

interface CachedDecodedPcm {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channels: Float32Array<ArrayBuffer>[];
}

const rawBytesCache = new Map<string, ArrayBuffer>();
const inFlightFetch = new Map<string, Promise<ArrayBuffer | null>>();
const decodedPcmCache = new Map<string, CachedDecodedPcm>();

async function fetchAssetBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer | null> {
  const existing = rawBytesCache.get(url);
  if (existing) return existing;

  const inflight = inFlightFetch.get(url);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const response = await fetch(url, { signal, cache: 'force-cache' });
      if (!response.ok) {
        console.warn(`[AudioAssetManager] HTTP ${response.status} loading ${url}`);
        return null;
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 256) {
        console.warn(`[AudioAssetManager] Suspiciously small audio asset (${bytes.byteLength}B): ${url}`);
        return null;
      }
      rawBytesCache.set(url, bytes);
      return bytes;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      console.warn(`[AudioAssetManager] Failed to fetch ${url}:`, err);
      return null;
    } finally {
      inFlightFetch.delete(url);
    }
  })();

  inFlightFetch.set(url, promise);
  return promise;
}

function pcmToAudioBuffer(ctx: BaseAudioContext, pcm: CachedDecodedPcm): AudioBuffer {
  const buf = ctx.createBuffer(pcm.numberOfChannels, pcm.length, pcm.sampleRate);
  for (let ch = 0; ch < pcm.numberOfChannels; ch++) {
    buf.copyToChannel(pcm.channels[ch], ch);
  }
  return buf;
}

export async function loadDecodedAudioAsset(
  ctx: BaseAudioContext,
  url: string,
  signal?: AbortSignal
): Promise<AudioBuffer | null> {
  const cachedPcm = decodedPcmCache.get(url);
  if (cachedPcm) {
    return pcmToAudioBuffer(ctx, cachedPcm);
  }

  const bytes = await fetchAssetBytes(url, signal);
  if (!bytes) return null;

  try {
    // Pass a copy so decodeAudioData detaching its input never invalidates rawBytesCache
    const decoded = await ctx.decodeAudioData(bytes.slice(0));
    if (!decoded || decoded.length === 0) return null;

    const channels: Float32Array<ArrayBuffer>[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const srcData = decoded.getChannelData(c);
      const copy = new Float32Array(new ArrayBuffer(srcData.length * 4));
      copy.set(srcData);
      channels.push(copy);
    }
    decodedPcmCache.set(url, {
      sampleRate: decoded.sampleRate,
      numberOfChannels: decoded.numberOfChannels,
      length: decoded.length,
      channels,
    });
    return decoded;
  } catch (err) {
    console.warn(`[AudioAssetManager] Failed to decode ${url}:`, err);
    return null;
  }
}

export async function preloadAudioAssetUrls(
  urls: string[],
  signal?: AbortSignal,
  sampleRate = 48000
): Promise<{
  loadedUrls: string[];
  failedUrls: string[];
}> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (uniqueUrls.length === 0) {
    return { loadedUrls: [], failedUrls: [] };
  }

  // Decode using a tiny 1-sample OfflineAudioContext so zero hardware AudioContext is required
  const decodeCtx = new OfflineAudioContext(2, 1, sampleRate);
  const loadedUrls: string[] = [];
  const failedUrls: string[] = [];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const buf = await loadDecodedAudioAsset(decodeCtx, url, signal);
      if (buf) {
        loadedUrls.push(url);
      } else {
        failedUrls.push(url);
      }
    })
  );

  return { loadedUrls, failedUrls };
}

export function getCachedAudioBufferForContext(
  ctx: BaseAudioContext,
  url: string
): AudioBuffer | null {
  const pcm = decodedPcmCache.get(url);
  if (!pcm) return null;
  return pcmToAudioBuffer(ctx, pcm);
}

export function clearAudioAssetSessionCache(): void {
  rawBytesCache.clear();
  decodedPcmCache.clear();
}
