import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCharacterRig, disposeCharacterRig, type CharacterRig } from '../engines/characterEngine';
import { buildEnvironment, disposeEnvironment } from '../engines/environmentEngine';
import { updateCharactersForSceneTime } from '../engines/animationEngine';
import { updateCameraForScene } from '../engines/cameraEngine';
import type { CharacterSpec, EnvironmentType, SceneSpec, TimeOfDay } from '../types/story';

interface StagePreviewCanvasProps {
  characters: CharacterSpec[];
  environmentType?: EnvironmentType;
  timeOfDay?: TimeOfDay;
  className?: string;
}

export const StagePreviewCanvas: React.FC<StagePreviewCanvasProps> = ({
  characters,
  environmentType = 'town_square',
  timeOfDay = 'sunset',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frameId = 0;
    let disposed = false;

    const width = Math.max(240, container.clientWidth || 360);
    const height = Math.max(200, container.clientHeight || 280);

    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    let isSoftwareGl = true;
    if (probeGl) {
      const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
      const gpu = String(
        ext ? probeGl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : probeGl.getParameter(probeGl.RENDERER)
      );
      probeGl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvas);

    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const env = buildEnvironment(environmentType, timeOfDay, {
      isSoftwareGl,
      seed: 'stage_preview',
    });
    scene.add(env.group);
    scene.background = env.skyColor;
    scene.fog = new THREE.FogExp2(env.skyColor.getHex(), env.fogDensity);

    const rigs = new Map<string, CharacterRig>();
    const activeChars = characters.slice(0, 3);
    activeChars.forEach((ch) => {
      const rig = buildCharacterRig(ch);
      rigs.set(ch.id, rig);
      scene.add(rig.root);
    });

    const spacing = activeChars.length >= 3 ? 1.25 : 1.45;
    const previewScene: SceneSpec = {
      id: 'preview',
      index: 1,
      title: 'Live Stage',
      environmentType,
      timeOfDay,
      mood: 'upbeat',
      durationSec: 12,
      cameraShot: 'medium_two_shot',
      actionBeats: activeChars.map((ch, idx) => ({
        characterId: ch.id,
        action: idx === 0 ? 'wave' : idx === 1 ? 'talk' : 'look_around',
        startOffsetSec: 0,
        endOffsetSec: 12,
        fromX: activeChars.length === 1 ? 0 : (idx - (activeChars.length - 1) / 2) * spacing,
        fromZ: idx === 1 && activeChars.length === 3 ? -0.25 : 0.35,
        toX: activeChars.length === 1 ? 0 : (idx - (activeChars.length - 1) / 2) * spacing,
        toZ: idx === 1 && activeChars.length === 3 ? -0.25 : 0.35,
        facingYawDeg: idx === 0 ? 18 : idx === activeChars.length - 1 ? -18 : 0,
      })),
      lines: [],
      sfxCues: [],
    };

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    updateCharactersForSceneTime(rigs, previewScene, 0, 0, undefined);
    updateCameraForScene(camera, previewScene, rigs, 0, 0.05, undefined, true);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const startMs = performance.now();
    let lastT = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (sync) {
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const t = (performance.now() - startMs) / 1000;
      const dt = Math.max(0.016, Math.min(0.1, t - lastT));
      lastT = t;

      env.update?.(t, dt);
      updateCharactersForSceneTime(rigs, previewScene, t % 12, t, undefined, undefined, dt);
      updateCameraForScene(camera, previewScene, rigs, t % 12, dt, undefined, false);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const onResize = () => {
      if (!container || disposed) return;
      const nw = Math.max(240, container.clientWidth);
      const nh = Math.max(200, container.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const rig of rigs.values()) {
        disposeCharacterRig(rig);
      }
      disposeEnvironment(env);
      envRT.dispose();
      renderer.dispose();
    };
  }, [characters, environmentType, timeOfDay]);

  return (
    <div className={`relative overflow-hidden bg-[#0a0e16] ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e16]/90 p-4 text-center text-sm text-[#cbd5e1]">
          3D WebGL context paused. Restoring stage preview...
        </div>
      )}
    </div>
  );
};
