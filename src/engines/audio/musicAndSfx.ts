import type {
  SceneSpec,
  SceneWeather,
  SfxType,
  TimelineScene,
} from '../../types/story';
import {
  AMBIENCE_ASSETS,
  MUSIC_ASSETS,
  SFX_ASSETS,
  getCachedAudioBufferForContext,
  preloadAudioAssetUrls,
  type AmbienceKey,
  type MusicMoodKey,
  type SfxAssetKey,
} from './audioAssetManager';

export interface MusicSpanPlan {
  moodKey: MusicMoodKey;
  label: string;
  url: string;
  startSec: number;
  endSec: number;
  sceneIds: string[];
}

export interface AmbienceLayerPlan {
  sceneId: string;
  primaryKey: AmbienceKey;
  secondaryKey?: AmbienceKey;
  secondaryGain?: number;
  lowpassHz?: number;
  label: string;
  startSec: number;
  endSec: number;
}

export interface ScheduledSfxEvent {
  assetKey: SfxAssetKey;
  url: string;
  whenSec: number;
  gain: number;
  playbackRate: number;
  pan: number;
  reason: string;
}

export interface StorySoundscapePlan {
  musicSpans: MusicSpanPlan[];
  ambienceLayers: AmbienceLayerPlan[];
  sfxEvents: ScheduledSfxEvent[];
  requiredUrls: string[];
  summaryText: string;
}

function getSceneCombinedText(scene: SceneSpec): string {
  const linesText = scene.lines.map((l) => l.text).join(' ');
  return `${scene.title} ${linesText}`.toLowerCase();
}

export function resolveMusicMoodForScene(scene: SceneSpec): MusicMoodKey {
  const text = getSceneCombinedText(scene);

  // Explicit or keyword emotional/sad check
  if (
    scene.mood === 'sad' ||
    /\b(sad|cry|crying|tears|sorry|lonely|goodbye|miss you|heartbroken|grief|worried sick|lost everything)\b/.test(
      text
    )
  ) {
    return 'emotional_sad';
  }

  // Dramatic / cinematic moments
  if (
    scene.mood === 'dramatic' ||
    /\b(destiny|reveal|truth|forever|betrayal|stand together|final moment|everything changed)\b/.test(
      text
    )
  ) {
    return 'dramatic_cinematic';
  }

  // Adventure & action
  if (
    scene.mood === 'action' ||
    scene.actionBeats.filter((b) => b.action === 'run').length >= 2 ||
    /\b(chase|sprint|escape|rescue|mission|race|hurry|dash|fast|adventure|quest)\b/.test(text)
  ) {
    return 'adventure_action';
  }

  // Funny & playful
  if (scene.mood === 'playful' || scene.mood === 'chaotic') {
    return 'funny_playful';
  }

  // Suspense & mystery
  if (scene.mood === 'mysterious' || scene.mood === 'tense') {
    return 'suspense_mystery';
  }

  // Calm & peaceful
  if (
    scene.mood === 'calm' ||
    (scene.mood === 'heartwarming' &&
      /\b(quiet|calm|peace|gentle|breeze|sunset|rest|sleep|stars)\b/.test(text))
  ) {
    return 'calm_peaceful';
  }

  if (scene.mood === 'heartwarming') {
    return 'calm_peaceful';
  }

  return 'happy_cheerful';
}

export function inferSceneWeather(scene: SceneSpec): SceneWeather {
  if (scene.weather) return scene.weather;
  const text = getSceneCombinedText(scene);
  if (/\b(thunder|lightning|storm|tempest)\b/.test(text)) return 'storm';
  if (/\b(rain|raining|rainy|downpour|drizzle|umbrella|puddle|soaked|wet)\b/.test(text)) {
    return 'rain';
  }
  if (/\b(wind|windy|gust|breeze|howling)\b/.test(text)) return 'windy';
  return 'clear';
}

function isIndoorEnvironment(env: SceneSpec['environmentType']): boolean {
  return (
    env === 'cozy_house_interior' ||
    env === 'modern_house_interior' ||
    env === 'school_hallway' ||
    env === 'school_classroom'
  );
}

export function resolveAmbienceForScene(
  scene: SceneSpec,
  startSec: number,
  endSec: number
): AmbienceLayerPlan {
  const weather = inferSceneWeather(scene);
  const indoor = isIndoorEnvironment(scene.environmentType);
  const text = getSceneCombinedText(scene);

  // Indoor scenes never play loud birds/traffic/crickets; subtle room tone (plus optional muffled rain outside)
  if (indoor) {
    if (weather === 'rain' || weather === 'storm') {
      return {
        sceneId: scene.id,
        primaryKey: 'indoor_room',
        secondaryKey: 'rain_loop',
        secondaryGain: 0.25,
        lowpassHz: 620,
        label: 'Indoor Room + Muffled Rain',
        startSec,
        endSec,
      };
    }
    return {
      sceneId: scene.id,
      primaryKey: 'indoor_room',
      label: 'Indoor Room Ambience',
      startSec,
      endSec,
    };
  }

  // Rainy or stormy outdoor scenes (no daytime birds during rain)
  if (weather === 'rain' || weather === 'storm') {
    return {
      sceneId: scene.id,
      primaryKey: 'rain_loop',
      secondaryKey: weather === 'storm' ? 'wind_loop' : undefined,
      secondaryGain: 0.28,
      label: weather === 'storm' ? 'Storm Rain & Wind' : 'Outdoor Rain',
      startSec,
      endSec,
    };
  }

  // Sci-fi environment
  if (scene.environmentType === 'sci_fi_plaza') {
    return {
      sceneId: scene.id,
      primaryKey: 'scifi_hum',
      secondaryKey: weather === 'windy' ? 'wind_loop' : undefined,
      secondaryGain: 0.22,
      label: 'Sci-Fi Plaza Atmosphere',
      startSec,
      endSec,
    };
  }

  // Nighttime outdoor scenes: crickets & nighttime breeze, never daytime birds
  if (scene.timeOfDay === 'night') {
    const urban =
      scene.environmentType === 'suburban_street' || scene.environmentType === 'city_street';
    return {
      sceneId: scene.id,
      primaryKey: 'night_crickets',
      secondaryKey: urban ? 'street_traffic' : 'wind_loop',
      secondaryGain: urban ? 0.2 : 0.16,
      label: urban ? 'Night Crickets & Distant Street' : 'Night Crickets & Breeze',
      startSec,
      endSec,
    };
  }

  // Daytime / sunset outdoor environments
  if (scene.environmentType === 'forest_park') {
    return {
      sceneId: scene.id,
      primaryKey: 'forest_birds_wind',
      secondaryKey: weather === 'windy' ? 'wind_loop' : undefined,
      secondaryGain: 0.28,
      label: 'Forest Birds & Wind',
      startSec,
      endSec,
    };
  }

  if (scene.environmentType === 'suburban_street' || scene.environmentType === 'city_street') {
    const busyStreet =
      scene.environmentType === 'city_street' ||
      /\b(busy|city|traffic|street|car|cars|bus|highway|crosswalk)\b/.test(text);
    return {
      sceneId: scene.id,
      primaryKey: 'street_traffic',
      secondaryKey: busyStreet ? undefined : 'town_outdoor',
      secondaryGain: 0.35,
      label: busyStreet ? 'Street & Traffic Ambience' : 'Neighborhood Street & Birds',
      startSec,
      endSec,
    };
  }

  // Default outdoor town_square
  return {
    sceneId: scene.id,
    primaryKey: 'town_outdoor',
    secondaryKey: weather === 'windy' ? 'wind_loop' : 'street_traffic',
    secondaryGain: weather === 'windy' ? 0.25 : 0.18,
    label: 'Outdoor Town & Birds',
    startSec,
    endSec,
  };
}

function getFootstepAssetForScene(scene: SceneSpec): SfxAssetKey {
  const weather = inferSceneWeather(scene);
  if (!isIndoorEnvironment(scene.environmentType) && (weather === 'rain' || weather === 'storm')) {
    return 'footstep_wet';
  }
  if (isIndoorEnvironment(scene.environmentType)) {
    return 'footstep_wood';
  }
  return 'footstep_stone';
}

function mapSfxCueToAsset(type: SfxType, scene: SceneSpec): SfxAssetKey {
  switch (type) {
    case 'footsteps':
      return getFootstepAssetForScene(scene);
    case 'door':
      return 'door_open';
    case 'door_close':
      return 'door_close';
    case 'vehicle':
      return 'vehicle_pass';
    case 'impact':
      return 'impact_fall';
    case 'thunder':
      return 'thunder';
    case 'chime':
      return 'interact_chime';
    case 'pop':
      return 'interact_pop';
    case 'gasp':
      return 'interact_pop';
    case 'whoosh':
    default:
      return 'whoosh';
  }
}

export function buildStorySoundscapePlan(timelineScenes: TimelineScene[]): StorySoundscapePlan {
  // 1. Group consecutive scenes with the same resolved MusicMoodKey into continuous spans (no abrupt cuts!)
  const musicSpans: MusicSpanPlan[] = [];
  for (const ts of timelineScenes) {
    const moodKey = resolveMusicMoodForScene(ts.scene);
    const asset = MUSIC_ASSETS[moodKey];
    const prev = musicSpans[musicSpans.length - 1];
    if (prev && prev.moodKey === moodKey) {
      prev.endSec = ts.endSec;
      prev.sceneIds.push(ts.scene.id);
    } else {
      musicSpans.push({
        moodKey,
        label: asset.label,
        url: asset.url,
        startSec: ts.startSec,
        endSec: ts.endSec,
        sceneIds: [ts.scene.id],
      });
    }
  }

  // 2. Scene-matched environmental ambience
  const ambienceLayers: AmbienceLayerPlan[] = timelineScenes.map((ts) =>
    resolveAmbienceForScene(ts.scene, ts.startSec, ts.endSec)
  );

  // 3. Contextual SFX (explicit cues + action-beat footsteps/falls + contextual environmental events)
  const sfxEvents: ScheduledSfxEvent[] = [];

  timelineScenes.forEach((ts, sceneIdx) => {
    const scene = ts.scene;
    const text = getSceneCombinedText(scene);
    const weather = inferSceneWeather(scene);
    const footstepAsset = getFootstepAssetForScene(scene);

    // Track timestamps already covered by footsteps so we don't double-trigger
    const footstepRanges: Array<[number, number]> = [];

    // Explicit script sfxCues
    for (const cue of scene.sfxCues) {
      const when = Math.min(ts.endSec - 0.15, ts.startSec + Math.max(0.02, cue.offsetSec));
      if (cue.type === 'footsteps') {
        footstepRanges.push([when - 0.2, when + 1.6]);
        for (let step = 0; step < 4; step++) {
          const stepAt = when + step * 0.34;
          if (stepAt >= ts.endSec - 0.1) break;
          sfxEvents.push({
            assetKey: footstepAsset,
            url: SFX_ASSETS[footstepAsset].url,
            whenSec: stepAt,
            gain: 0.42 - (step % 2) * 0.05,
            playbackRate: 0.96 + (step % 3) * 0.04,
            pan: step % 2 === 0 ? -0.06 : 0.06,
            reason: `Script footsteps (${footstepAsset})`,
          });
        }
      } else {
        const assetKey = mapSfxCueToAsset(cue.type, scene);
        sfxEvents.push({
          assetKey,
          url: SFX_ASSETS[assetKey].url,
          whenSec: when,
          gain: cue.type === 'thunder' ? 0.52 : cue.type === 'whoosh' ? 0.24 : 0.44,
          playbackRate: 1.0,
          pan: 0,
          reason: `Script cue (${cue.type})`,
        });
      }
    }

    // Subtle scene transition whoosh on cuts (skip if door/impact already happens at cut)
    if (sceneIdx > 0) {
      const hasImmediateCutSfx = sfxEvents.some(
        (ev) => Math.abs(ev.whenSec - ts.startSec) < 0.35
      );
      if (!hasImmediateCutSfx) {
        sfxEvents.push({
          assetKey: 'whoosh',
          url: SFX_ASSETS.whoosh.url,
          whenSec: ts.startSec + 0.02,
          gain: 0.18,
          playbackRate: 1.02,
          pan: 0,
          reason: 'Scene transition swish',
        });
      }
    }

    // Action-beat driven footsteps & physical impacts (strictly when action happens)
    for (const beat of scene.actionBeats) {
      const beatStart = ts.startSec + beat.startOffsetSec;
      const beatEnd = Math.min(ts.endSec - 0.12, ts.startSec + beat.endOffsetSec);

      if (beat.action === 'walk' || beat.action === 'run') {
        const covered = footstepRanges.some(
          ([rStart, rEnd]) => beatStart >= rStart && beatStart <= rEnd
        );
        if (!covered && beatEnd - beatStart > 0.35) {
          const interval = beat.action === 'run' ? 0.27 : 0.42;
          const maxSteps = beat.action === 'run' ? 8 : 6;
          let stepCursor = beatStart + 0.08;
          let count = 0;
          while (stepCursor < beatEnd && count < maxSteps) {
            sfxEvents.push({
              assetKey: footstepAsset,
              url: SFX_ASSETS[footstepAsset].url,
              whenSec: stepCursor,
              gain: beat.action === 'run' ? 0.42 : 0.32,
              playbackRate: (beat.action === 'run' ? 1.08 : 0.96) + (count % 2) * 0.04,
              pan: count % 2 === 0 ? -0.07 : 0.07,
              reason: `Action ${beat.action} (${footstepAsset})`,
            });
            stepCursor += interval;
            count++;
          }
          footstepRanges.push([beatStart, beatEnd]);
        }
      } else if (beat.action === 'fall') {
        sfxEvents.push({
          assetKey: 'impact_fall',
          url: SFX_ASSETS.impact_fall.url,
          whenSec: Math.min(ts.endSec - 0.15, beatStart + 0.2),
          gain: 0.5,
          playbackRate: 0.95,
          pan: 0,
          reason: 'Action fall impact',
        });
      }
    }

    // Contextual script/environment events (doors, vehicles, storm thunder) if not already explicitly cued
    const hasDoorCue = scene.sfxCues.some((c) => c.type === 'door' || c.type === 'door_close');
    if (!hasDoorCue) {
      if (/\b(open(?:ed|s|ing)? the door|opened door|entered|stepped inside|knocked)\b/.test(text)) {
        sfxEvents.push({
          assetKey: 'door_open',
          url: SFX_ASSETS.door_open.url,
          whenSec: ts.startSec + 0.15,
          gain: 0.42,
          playbackRate: 1.0,
          pan: -0.1,
          reason: 'Contextual door open',
        });
      } else if (/\b(clos(?:ed|es|ing)? the door|shut the door|slammed)\b/.test(text)) {
        sfxEvents.push({
          assetKey: 'door_close',
          url: SFX_ASSETS.door_close.url,
          whenSec: Math.min(ts.endSec - 0.4, ts.startSec + 0.5),
          gain: 0.44,
          playbackRate: 1.0,
          pan: 0.1,
          reason: 'Contextual door close',
        });
      }
    }

    const hasVehicleCue = scene.sfxCues.some((c) => c.type === 'vehicle');
    if (
      !hasVehicleCue &&
      !isIndoorEnvironment(scene.environmentType) &&
      /\b(car|bus|truck|van|motorcycle|engine|drove|driving|vehicle)\b/.test(text)
    ) {
      sfxEvents.push({
        assetKey: 'vehicle_pass',
        url: SFX_ASSETS.vehicle_pass.url,
        whenSec: ts.startSec + 0.3,
        gain: 0.28,
        playbackRate: 1.0,
        pan: 0.15,
        reason: 'Contextual vehicle',
      });
    }

    const hasThunderCue = scene.sfxCues.some((c) => c.type === 'thunder');
    if (!hasThunderCue && weather === 'storm') {
      sfxEvents.push({
        assetKey: 'thunder',
        url: SFX_ASSETS.thunder.url,
        whenSec: Math.min(ts.endSec - 1.2, ts.startSec + 0.8),
        gain: isIndoorEnvironment(scene.environmentType) ? 0.25 : 0.48,
        playbackRate: 1.0,
        pan: 0,
        reason: 'Storm weather thunder',
      });
    }
  });

  // Collect distinct asset URLs needed for this story
  const requiredUrls = new Set<string>();
  for (const span of musicSpans) requiredUrls.add(span.url);
  for (const amb of ambienceLayers) {
    requiredUrls.add(AMBIENCE_ASSETS[amb.primaryKey].url);
    if (amb.secondaryKey) requiredUrls.add(AMBIENCE_ASSETS[amb.secondaryKey].url);
  }
  for (const ev of sfxEvents) requiredUrls.add(ev.url);

  const uniqueMoods = Array.from(new Set(musicSpans.map((s) => s.label)));
  const uniqueAmb = Array.from(new Set(ambienceLayers.map((a) => a.label)));
  const summaryText = `Music: ${uniqueMoods.join(', ')} · Ambience: ${uniqueAmb.join(', ')} · ${sfxEvents.length} SFX cues`;

  return {
    musicSpans,
    ambienceLayers,
    sfxEvents,
    requiredUrls: Array.from(requiredUrls),
    summaryText,
  };
}

export async function preloadStoryAudioAssets(
  plan: StorySoundscapePlan,
  signal?: AbortSignal
): Promise<{ loadedCount: number; failedUrls: string[] }> {
  const res = await preloadAudioAssetUrls(plan.requiredUrls, signal, 48000);
  return {
    loadedCount: res.loadedUrls.length,
    failedUrls: res.failedUrls,
  };
}

export function scheduleBackgroundMusicFromAssets(
  ctx: OfflineAudioContext,
  musicBus: GainNode,
  plan: StorySoundscapePlan
): number {
  let scheduledCount = 0;
  const spans = plan.musicSpans;
  const totalEnd = spans.length > 0 ? spans[spans.length - 1].endSec : 0;

  spans.forEach((span, idx) => {
    const buffer = getCachedAudioBufferForContext(ctx, span.url);
    if (!buffer) return;

    const isFirst = idx === 0;
    const isLast = idx === spans.length - 1;

    // Slight crossfade overlap between different mood spans for seamless continuity
    const fadeInDur = isFirst ? Math.min(0.8, (span.endSec - span.startSec) * 0.25) : 0.75;
    const fadeOutDur = isLast ? Math.min(1.4, (span.endSec - span.startSec) * 0.35) : 0.75;

    const startAt = isFirst ? span.startSec : Math.max(0, span.startSec - 0.35);
    const stopAt = isLast ? span.endSec : Math.min(totalEnd, span.endSec + 0.35);
    const dur = Math.max(0.2, stopAt - startAt);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Leave tiny margin at MP3 file edges when looping
    if (buffer.duration > 2.5) {
      src.loopStart = 0.65;
      src.loopEnd = buffer.duration - 1.55;
    }

    const spanGain = ctx.createGain();
    spanGain.gain.setValueAtTime(0.0001, startAt);
    spanGain.gain.linearRampToValueAtTime(1.0, Math.min(stopAt, startAt + fadeInDur));
    spanGain.gain.setValueAtTime(1.0, Math.max(startAt + fadeInDur, stopAt - fadeOutDur));
    spanGain.gain.linearRampToValueAtTime(0.0001, stopAt);

    src.connect(spanGain);
    spanGain.connect(musicBus);

    src.start(startAt, 0);
    src.stop(startAt + dur + 0.05);
    scheduledCount++;
  });

  return scheduledCount;
}

export function scheduleAmbienceFromAssets(
  ctx: OfflineAudioContext,
  ambienceBus: GainNode,
  plan: StorySoundscapePlan
): number {
  let scheduledCount = 0;

  const scheduleBed = (
    url: string,
    startSec: number,
    endSec: number,
    targetGain: number,
    lowpassHz?: number
  ) => {
    const buffer = getCachedAudioBufferForContext(ctx, url);
    if (!buffer) return;

    const startAt = Math.max(0, startSec - 0.18);
    const stopAt = endSec + 0.18;
    const dur = Math.max(0.25, stopAt - startAt);
    const fade = Math.min(0.55, dur * 0.25);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    if (buffer.duration > 2.0) {
      src.loopStart = 0.45;
      src.loopEnd = buffer.duration - 0.65;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(targetGain, startAt + fade);
    gain.gain.setValueAtTime(targetGain, Math.max(startAt + fade, stopAt - fade));
    gain.gain.linearRampToValueAtTime(0.0001, stopAt);

    if (lowpassHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassHz;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }

    gain.connect(ambienceBus);
    src.start(startAt, 0);
    src.stop(stopAt + 0.05);
    scheduledCount++;
  };

  for (const layer of plan.ambienceLayers) {
    const primaryUrl = AMBIENCE_ASSETS[layer.primaryKey].url;
    scheduleBed(primaryUrl, layer.startSec, layer.endSec, 0.85, layer.lowpassHz);

    if (layer.secondaryKey) {
      const secUrl = AMBIENCE_ASSETS[layer.secondaryKey].url;
      scheduleBed(
        secUrl,
        layer.startSec,
        layer.endSec,
        layer.secondaryGain ?? 0.25,
        layer.lowpassHz
      );
    }
  }

  return scheduledCount;
}

export function scheduleSfxFromAssets(
  ctx: OfflineAudioContext,
  sfxBus: GainNode,
  plan: StorySoundscapePlan
): number {
  let scheduledCount = 0;

  for (const ev of plan.sfxEvents) {
    const buffer = getCachedAudioBufferForContext(ctx, ev.url);
    if (!buffer) continue;

    const when = Math.max(0.01, ev.whenSec);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = ev.playbackRate;

    const panner = ctx.createStereoPanner();
    panner.pan.value = ev.pan;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(ev.gain, when);

    src.connect(panner);
    panner.connect(gain);
    gain.connect(sfxBus);

    src.start(when);
    scheduledCount++;
  }

  return scheduledCount;
}
