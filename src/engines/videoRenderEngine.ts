import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { buildCharacterRig, disposeCharacterRig, type CharacterRig } from './characterEngine';
import {
  buildEnvironment,
  disposeEnvironment,
  preloadEnvironmentAssets,
  type BuiltEnvironment,
} from './environmentEngine';
import { updateCharactersForSceneTime } from './animationEngine';
import { updateCameraForScene } from './cameraEngine';
import { generateSynchronizedStoryAudio } from './audioEngine';
import { drawCompositedFrame } from './subtitleEngine';
import type { SpeechAudioSegment, TtsEnginePreference } from '../types/audio';
import type {
  AspectRatioOption,
  AudioSegmentPreviewInfo,
  ExportFormat,
  ProductionProgress,
  ProductionStageId,
  ProductionStageState,
  RenderedVideoResult,
  StoryProject,
} from '../types/story';

export interface RenderDimensions {
  width: number;
  height: number;
}

export function getRenderDimensions(aspectRatio: AspectRatioOption): RenderDimensions {
  if (aspectRatio === '16:9') return { width: 960, height: 540 };
  if (aspectRatio === '1:1') return { width: 720, height: 720 };
  return { width: 540, height: 960 };
}

export interface BrowserCodecCapabilities {
  webCodecsAvailable: boolean;
  preferredFormat: ExportFormat;
  videoCodec: 'vp9' | 'vp8' | 'avc' | 'mediarecorder';
  audioCodec: 'opus' | 'aac' | 'mediarecorder';
  mp4Supported: boolean;
}

export async function detectExportCapabilities(): Promise<BrowserCodecCapabilities> {
  const hasWebCodecs =
    typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';

  if (hasWebCodecs) {
    try {
      const [vp9, vp8, opus, avc, aac] = await Promise.all([
        canEncodeVideo('vp9'),
        canEncodeVideo('vp8'),
        canEncodeAudio('opus'),
        canEncodeVideo('avc'),
        canEncodeAudio('aac'),
      ]);

      if ((vp9 || vp8) && opus) {
        return {
          webCodecsAvailable: true,
          preferredFormat: 'webm',
          videoCodec: vp9 ? 'vp9' : 'vp8',
          audioCodec: 'opus',
          mp4Supported: Boolean(avc && aac),
        };
      }
      if (avc && aac) {
        return {
          webCodecsAvailable: true,
          preferredFormat: 'mp4',
          videoCodec: 'avc',
          audioCodec: 'aac',
          mp4Supported: true,
        };
      }
    } catch {
      // Fall through to MediaRecorder capability check
    }
  }

  return {
    webCodecsAvailable: false,
    preferredFormat: 'webm',
    videoCodec: 'mediarecorder',
    audioCodec: 'mediarecorder',
    mp4Supported: false,
  };
}

export function createInitialProductionStages(): ProductionStageState[] {
  return [
    {
      id: 'dialogue_prep',
      label: 'Preparing Dialogue & Voices',
      detail: 'Cleaning script lines and assigning permanent narrator & character voices',
      status: 'pending',
    },
    {
      id: 'voice_init',
      label: 'Initializing Voice Engine',
      detail: 'Loading speech synthesis model (cached in browser after first download)',
      status: 'pending',
    },
    {
      id: 'narration_tts',
      label: 'Generating Narration Speech',
      detail: 'Synthesizing story narrator audio clips',
      status: 'pending',
    },
    {
      id: 'dialogue_tts',
      label: 'Generating Character Dialogue',
      detail: 'Synthesizing distinct voice clips for each speaking character',
      status: 'pending',
    },
    {
      id: 'music_sfx',
      label: 'Loading Music, Ambience & SFX',
      detail: 'Loading mood-matched music, environmental ambience, and action sound effects',
      status: 'pending',
    },
    {
      id: 'audio_mix',
      label: 'Mixing Master Audio Track',
      detail: 'Combining narration, dialogue, ducked music, ambience, and SFX',
      status: 'pending',
    },
    {
      id: 'scene_sync',
      label: 'Synchronizing Audio with 3D Scenes',
      detail: 'Assembling 3D characters, worlds, and audio-locked camera cues',
      status: 'pending',
    },
    {
      id: 'rendering',
      label: 'Final Video Rendering',
      detail: 'Rendering 3D animation frames with synchronized captions and audio',
      status: 'pending',
    },
    {
      id: 'finalizing',
      label: 'Muxing Video & Audio Tracks',
      detail: 'Combining video and audio streams into a downloadable file',
      status: 'pending',
    },
  ];
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

export interface ProduceVideoOptions {
  story: StoryProject;
  requestedFormat?: ExportFormat;
  ttsPreference?: TtsEnginePreference;
  previewCanvas?: HTMLCanvasElement | null;
  signal?: AbortSignal;
  onProgress: (progress: ProductionProgress) => void;
}

export async function produceStoryVideo({
  story,
  requestedFormat = 'webm',
  ttsPreference = story.input.ttsPreference || 'auto',
  previewCanvas,
  signal,
  onProgress,
}: ProduceVideoOptions): Promise<RenderedVideoResult> {
  const startTimeMs = performance.now();
  const stages = createInitialProductionStages();
  let currentFrame = 0;
  let totalFrames = 1;
  let currentSceneTitle = 'Preparing Audio';
  let ttsEngineLabel = '';
  let modelLoadProgressPct: number | undefined;
  let modelLoadStatus: string | undefined;
  let audioSegments: AudioSegmentPreviewInfo[] = [];
  let audioMixWavBlob: Blob | null = null;
  let audioBedSummary: string | undefined;

  const emitProgress = (error?: string, isComplete = false) => {
    onProgress({
      stages: stages.map((s) => ({ ...s })),
      currentFrame,
      totalFrames,
      currentSceneTitle,
      elapsedMs: Math.round(performance.now() - startTimeMs),
      isComplete,
      ttsEngineLabel,
      modelLoadProgressPct,
      modelLoadStatus,
      audioSegments,
      audioMixWavBlob,
      audioBedSummary,
      error,
    });
  };

  const setStage = (
    id: ProductionStageId,
    status: ProductionStageState['status'],
    errorMessage?: string
  ) => {
    const target = stages.find((s) => s.id === id);
    if (target) {
      target.status = status;
      target.errorMessage = errorMessage;
    }
    emitProgress(errorMessage);
  };

  const checkAborted = () => {
    if (signal?.aborted) {
      throw new Error('Production was cancelled by user.');
    }
  };

  let renderer: THREE.WebGLRenderer | null = null;
  let envRT: THREE.WebGLRenderTarget | null = null;
  let currentBuiltEnv = null as BuiltEnvironment | null;
  const rigs = new Map<string, CharacterRig>();
  let webglCanvas: HTMLCanvasElement | null = null;

  try {
    // STAGES 1–6: Real Speech Generation, Audio Sync & Master Audio Mixing
    const audioResult = await generateSynchronizedStoryAudio(story, {
      preference: ttsPreference,
      signal,
      onVoiceInitProgress: (p) => {
        modelLoadProgressPct = p.progressPct;
        modelLoadStatus = p.message;
        emitProgress();
      },
      onStageChange: (stage, status, detail) => {
        if (stage === 'music_sfx' && status === 'complete' && detail) {
          const target = stages.find((s) => s.id === stage);
          if (target) target.detail = detail;
          audioBedSummary = detail;
        }
        setStage(stage, status, status === 'error' ? detail : undefined);
      },
      onSegmentsUpdate: (segs, label) => {
        ttsEngineLabel = label;
        audioSegments = segs.map((s) => ({
          id: s.id,
          speakerName: s.speakerName,
          speakerType: s.speakerType,
          voiceLabel: s.voiceAssignment.voiceLabel,
          text: s.text,
          startTimeSec: s.startTimeSec,
          durationSec: s.durationSec,
          status: s.status,
        }));
        emitProgress();
      },
    });

    const { plan, timeline, engineLabel } = audioResult;
    if (!plan.mixedMasterBuffer || plan.mixedMasterBuffer.length === 0) {
      throw new Error('Audio mixing produced an empty audio buffer.');
    }
    audioMixWavBlob = plan.previewMixWavBlob;
    audioBedSummary = plan.audioBedSummary;
    ttsEngineLabel = engineLabel;
    const segmentById = new Map<string, SpeechAudioSegment>(
      plan.segments.map((seg) => [seg.id, seg])
    );

    // STAGE 7: Synchronize 3D Characters & Environments with Audio-Locked Timeline
    setStage('scene_sync', 'active');
    const fps = 24;
    totalFrames = Math.max(24, Math.round(timeline.totalDurationSec * fps));
    const { width, height } = getRenderDimensions(story.input.aspectRatio);

    const isSoftwareGl = detectSoftwareWebGL();
    webglCanvas = document.createElement('canvas');
    webglCanvas.width = width;
    webglCanvas.height = height;

    renderer = new THREE.WebGLRenderer({
      canvas: webglCanvas,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene3D = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    envRT = pmrem.fromScene(roomEnv, 0.04);
    scene3D.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);

    for (const charSpec of story.characters) {
      const rig = buildCharacterRig(charSpec);
      rigs.set(charSpec.id, rig);
      scene3D.add(rig.root);
    }

    await preloadEnvironmentAssets();

    let activeEnvKey = '';
    const loadSceneEnvironment = (sceneSpec: (typeof timeline.scenes)[0]['scene']) => {
      const envType = sceneSpec.environmentType;
      const tod = sceneSpec.timeOfDay;
      const weather = sceneSpec.weather ?? 'clear';
      const mood = sceneSpec.mood ?? 'upbeat';
      const key = `${envType}_${tod}_${weather}`;
      if (key === activeEnvKey && currentBuiltEnv) return;
      if (currentBuiltEnv) {
        scene3D.remove(currentBuiltEnv.group);
        disposeEnvironment(currentBuiltEnv);
        currentBuiltEnv = null;
      }
      currentBuiltEnv = buildEnvironment(envType, tod, {
        weather,
        mood,
        seed: story.id,
        isSoftwareGl,
      });
      scene3D.add(currentBuiltEnv.group);
      scene3D.background = currentBuiltEnv.skyColor;
      scene3D.fog = new THREE.FogExp2(currentBuiltEnv.skyColor.getHex(), currentBuiltEnv.fogDensity);
      activeEnvKey = key;
    };

    if (timeline.scenes.length > 0) {
      loadSceneEnvironment(timeline.scenes[0].scene);
    }
    checkAborted();
    setStage('scene_sync', 'complete');

    // STAGE 8: Render 3D Frames + Synchronized Subtitles + Audio Track
    setStage('rendering', 'active');
    const caps = await detectExportCapabilities();

    const compositorCanvas = previewCanvas ?? document.createElement('canvas');
    compositorCanvas.width = width;
    compositorCanvas.height = height;
    const ctx2d = compositorCanvas.getContext('2d');
    if (!ctx2d) {
      throw new Error('Could not initialize 2D compositing context for video rendering.');
    }

    const useMp4 = requestedFormat === 'mp4' && caps.mp4Supported;
    let finalBlob: Blob;
    let finalMime: string;
    let finalFormat: ExportFormat;
    let codecSummary: string;

    if (caps.webCodecsAvailable) {
      const target = new BufferTarget();
      const format = useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat();
      const output = new Output({ format, target });

      const videoCodec = useMp4 ? 'avc' : caps.videoCodec === 'vp9' ? 'vp9' : 'vp8';
      const audioCodec = useMp4 ? 'aac' : 'opus';

      const videoSource = new CanvasSource(compositorCanvas, {
        codec: videoCodec,
        bitrate: QUALITY_HIGH,
      });
      const audioSource = new AudioBufferSource({
        codec: audioCodec,
        bitrate: QUALITY_HIGH,
      });

      output.addVideoTrack(videoSource, { frameRate: fps });
      output.addAudioTrack(audioSource);

      await output.start();

      const frameDur = 1 / fps;
      let lastSceneId = '';

      for (let f = 0; f < totalFrames; f++) {
        checkAborted();
        currentFrame = f + 1;
        const globalTime = f * frameDur;

        const timelineScene =
          timeline.scenes.find((s) => globalTime >= s.startSec && globalTime < s.endSec) ??
          timeline.scenes[timeline.scenes.length - 1];

        const activeScene = timelineScene.scene;
        const sceneLocalTime = Math.max(0, globalTime - timelineScene.startSec);
        currentSceneTitle = activeScene.title;

        const isSceneCut = activeScene.id !== lastSceneId;
        if (isSceneCut) {
          loadSceneEnvironment(activeScene);
          lastSceneId = activeScene.id;
        }

        const activeSub = timeline.subtitles.find(
          (sub) => globalTime >= sub.startSec && globalTime <= sub.endSec
        );
        const activeSegment = activeSub ? segmentById.get(activeSub.id) : undefined;

        currentBuiltEnv?.update?.(globalTime, frameDur);

        updateCharactersForSceneTime(
          rigs,
          activeScene,
          sceneLocalTime,
          globalTime,
          activeSub,
          activeSegment,
          frameDur
        );
        updateCameraForScene(
          camera,
          activeScene,
          rigs,
          sceneLocalTime,
          frameDur,
          activeSub,
          isSceneCut
        );

        renderer.render(scene3D, camera);

        drawCompositedFrame(
          ctx2d,
          webglCanvas,
          width,
          height,
          globalTime,
          timeline.totalDurationSec,
          activeScene.title,
          sceneLocalTime,
          activeScene.durationSec,
          activeSub,
          story.title
        );

        await videoSource.add(globalTime, frameDur);

        if (f % 3 === 0) {
          emitProgress();
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      checkAborted();
      setStage('rendering', 'complete');
      setStage('finalizing', 'active');

      await audioSource.add(plan.mixedMasterBuffer);
      await output.finalize();

      if (!target.buffer) {
        throw new Error('Video muxing produced an empty output buffer.');
      }

      finalFormat = useMp4 ? 'mp4' : 'webm';
      finalMime = await output.getMimeType().catch(() =>
        finalFormat === 'mp4' ? 'video/mp4' : 'video/webm'
      );
      finalBlob = new Blob([target.buffer], { type: finalMime });
      codecSummary = `${videoCodec.toUpperCase()} + ${audioCodec.toUpperCase()}`;
    } else {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error(
          'Neither WebCodecs nor MediaRecorder is supported in this browser. Please use modern Chrome or Edge.'
        );
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const bufSource = audioCtx.createBufferSource();
      bufSource.buffer = plan.mixedMasterBuffer;
      bufSource.connect(dest);

      const canvasStream = compositorCanvas.captureStream(fps);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const stoppedPromise = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error('MediaRecorder encoding failed.'));
      });

      recorder.start(250);
      bufSource.start();

      const recStart = performance.now();
      let lastTime = 0;
      let lastSceneId = '';

      while (true) {
        checkAborted();
        const globalTime = (performance.now() - recStart) / 1000;
        if (globalTime >= timeline.totalDurationSec) break;
        const dt = Math.max(0.016, globalTime - lastTime);
        lastTime = globalTime;
        currentFrame = Math.min(totalFrames, Math.round(globalTime * fps) + 1);

        const timelineScene =
          timeline.scenes.find((s) => globalTime >= s.startSec && globalTime < s.endSec) ??
          timeline.scenes[timeline.scenes.length - 1];
        const activeScene = timelineScene.scene;
        const sceneLocalTime = Math.max(0, globalTime - timelineScene.startSec);
        currentSceneTitle = activeScene.title;

        const isSceneCut = activeScene.id !== lastSceneId;
        if (isSceneCut) {
          loadSceneEnvironment(activeScene);
          lastSceneId = activeScene.id;
        }

        const activeSub = timeline.subtitles.find(
          (sub) => globalTime >= sub.startSec && globalTime <= sub.endSec
        );
        const activeSegment = activeSub ? segmentById.get(activeSub.id) : undefined;

        currentBuiltEnv?.update?.(globalTime, dt);

        updateCharactersForSceneTime(
          rigs,
          activeScene,
          sceneLocalTime,
          globalTime,
          activeSub,
          activeSegment,
          dt
        );
        updateCameraForScene(
          camera,
          activeScene,
          rigs,
          sceneLocalTime,
          dt,
          activeSub,
          isSceneCut
        );

        renderer.render(scene3D, camera);
        drawCompositedFrame(
          ctx2d,
          webglCanvas,
          width,
          height,
          globalTime,
          timeline.totalDurationSec,
          activeScene.title,
          sceneLocalTime,
          activeScene.durationSec,
          activeSub,
          story.title
        );

        emitProgress();
        await new Promise((r) => requestAnimationFrame(r));
      }

      setStage('rendering', 'complete');
      setStage('finalizing', 'active');

      recorder.stop();
      bufSource.stop();
      await stoppedPromise;
      await audioCtx.close();

      finalFormat = 'webm';
      finalMime = mimeType;
      finalBlob = new Blob(chunks, { type: mimeType });
      codecSummary = 'MediaRecorder WebM';
    }

    if (finalBlob.size < 1024) {
      throw new Error('Generated video file appears invalid or empty. Please try again.');
    }

    setStage('finalizing', 'complete');
    emitProgress(undefined, true);

    return {
      id: `vid_${Date.now()}`,
      projectId: story.id,
      title: story.title,
      blob: finalBlob,
      mimeType: finalMime,
      format: finalFormat,
      codecSummary,
      ttsSummary: `${engineLabel} · ${plan.segments.length} speech clips`,
      audioBedSummary: plan.audioBedSummary,
      durationSec: timeline.totalDurationSec,
      width,
      height,
      aspectRatio: story.input.aspectRatio,
      fileSizeBytes: finalBlob.size,
      createdAt: Date.now(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video rendering failed.';
    const activeStage = stages.find((s) => s.status === 'active');
    if (activeStage) {
      activeStage.status = 'error';
      activeStage.errorMessage = message;
    }
    emitProgress(message, false);
    throw err;
  } finally {
    for (const rig of rigs.values()) {
      disposeCharacterRig(rig);
    }
    rigs.clear();
    if (currentBuiltEnv) {
      disposeEnvironment(currentBuiltEnv);
      currentBuiltEnv = null;
    }
    if (envRT) {
      envRT.dispose();
      envRT = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
  }
}
