import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Eye,
  FolderUp,
  Layers,
  RotateCcw,
  Sun,
  Trash2,
  Trees,
  Upload,
} from 'lucide-react';
import {
  EXPERIMENT_COLLECTION_PRESETS,
  importLocal3DAssetFiles,
  type ExperimentSlotId,
  type RegisteredImportedAssetRecord,
} from '../engines/world/localAssetImporter';
import {
  clearTemporaryExperimentAssets,
  getRegisteredExperimentAssets,
  instantiateExperimentAsset,
  registerImportedExperimentAsset,
  removeImportedExperimentAsset,
  updateImportedAssetTransform,
} from '../engines/world/assetRegistry';
import { createPbrMaterial, createWorldTracker } from '../engines/world/pbrMaterials';
import { buildAtmosphereAndLighting } from '../engines/world/atmosphereAndLighting';
import { buildOutdoorTerrainAndWater } from '../engines/world/terrainAndWater';
import type { TimeOfDay } from '../types/story';

interface AssetTestWorkspaceProps {
  onBackHome: () => void;
}

type ViewMode = 'village_scene' | 'single_asset';

const SLOT_ORDER: ExperimentSlotId[] = [
  'Village_School',
  'Tree_Type_A',
  'Tree_Type_B',
  'Tree_Type_C',
];

interface OverlapPair {
  a: string;
  b: string;
}

export const AssetTestWorkspace: React.FC<AssetTestWorkspaceProps> = ({ onBackHome }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [assets, setAssets] = useState<RegisteredImportedAssetRecord[]>(() =>
    getRegisteredExperimentAssets()
  );
  const [selectedSlot, setSelectedSlot] = useState<ExperimentSlotId | 'custom'>('Village_School');
  const [activeAssetId, setActiveAssetId] = useState<string>('Village_School');
  const [viewMode, setViewMode] = useState<ViewMode>('village_scene');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [overlaps, setOverlaps] = useState<OverlapPair[]>([]);
  const [sceneRevision, setSceneRevision] = useState(0);

  // Refs for stable Three.js lifecycle & throttled transforms
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const worldGroupRef = useRef<THREE.Group | null>(null);
  const worldDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const isSoftwareGlRef = useRef(true);

  const refreshAssetsState = useCallback((focusId?: string) => {
    const next = getRegisteredExperimentAssets();
    setAssets(next);
    if (focusId) {
      setActiveAssetId(focusId);
    } else if (next.length > 0 && !next.some((a) => a.id === activeAssetId)) {
      setActiveAssetId(next[0].id);
    }
    setSceneRevision((r) => r + 1);
  }, [activeAssetId]);

  const handleImportFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      setImportError(null);
      setIsImporting(true);
      try {
        const slotId =
          selectedSlot === 'custom'
            ? undefined
            : selectedSlot;
        const payload = await importLocal3DAssetFiles(files, { slotId });
        registerImportedExperimentAsset(payload);
        refreshAssetsState(payload.record.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to import 3D asset files.';
        setImportError(msg);
      } finally {
        setIsImporting(false);
      }
    },
    [selectedSlot, refreshAssetsState]
  );

  const handleRemoveAsset = useCallback(
    (id: string) => {
      removeImportedExperimentAsset(id);
      refreshAssetsState();
    },
    [refreshAssetsState]
  );

  const handleClearAll = useCallback(() => {
    clearTemporaryExperimentAssets();
    setImportError(null);
    refreshAssetsState();
  }, [refreshAssetsState]);

  const activeAsset = useMemo(
    () => assets.find((a) => a.id === activeAssetId) || assets[0] || null,
    [assets, activeAssetId]
  );

  const handleTransformChange = useCallback(
    (
      id: string,
      patch: Partial<Pick<RegisteredImportedAssetRecord, 'position' | 'rotationDeg' | 'scale'>>
    ) => {
      updateImportedAssetTransform(id, patch);
      setAssets(getRegisteredExperimentAssets());
      setSceneRevision((r) => r + 1);
    },
    []
  );

  const handleResetSlotTransform = useCallback(
    (id: string) => {
      const preset =
        id in EXPERIMENT_COLLECTION_PRESETS
          ? EXPERIMENT_COLLECTION_PRESETS[id as ExperimentSlotId]
          : undefined;
      const target = assets.find((a) => a.id === id);
      if (!target) return;
      handleTransformChange(id, {
        position: preset ? { ...preset.defaultPosition } : { x: 0, y: 0, z: 0 },
        rotationDeg: preset ? { ...preset.defaultRotationDeg } : { x: 0, y: 0, z: 0 },
        scale: target.defaultScale,
      });
    },
    [assets, handleTransformChange]
  );

  const resetCameraToScene = useCallback(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (viewMode === 'single_asset') {
      cam.position.set(6.5, 4.2, 8.2);
      ctrl.target.set(0, 1.8, 0);
    } else {
      cam.position.set(0, 8.5, 16.5);
      ctrl.target.set(0, 2.0, -5.0);
    }
    ctrl.update();
    requestRenderRef.current?.();
  }, [viewMode]);

  // Initialize Three.js WebGL Viewport once
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth || 720);
    const height = Math.max(320, container.clientHeight || 480);

    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    let isSoftwareGl = true;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = String(
        ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      );
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }
    isSoftwareGlRef.current = isSoftwareGl;

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

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 180);
    camera.position.set(0, 8.5, 16.5);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 2.0, -5.0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    controlsRef.current = controls;

    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    const afterDraw = (cb: () => void) => {
      const glCtx = renderer.getContext() as WebGL2RenderingContext;
      const sync = glCtx.fenceSync ? glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (sync) {
        glCtx.flush();
        const poll = () => {
          if (disposed) return;
          const state = glCtx.getSyncParameter(sync, glCtx.SYNC_STATUS);
          if (state === glCtx.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            glCtx.deleteSync(sync);
            frameId = window.setTimeout(cb, 32);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 45);
      }
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };
    requestRenderRef.current = requestRender;

    const onControlChange = () => requestRender();
    controls.addEventListener('change', onControlChange);

    const onResize = () => {
      if (!container || disposed) return;
      const nw = Math.max(320, container.clientWidth);
      const nh = Math.max(320, container.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      if (worldGroupRef.current) {
        scene.remove(worldGroupRef.current);
        worldGroupRef.current = null;
      }
      for (const d of worldDisposablesRef.current) d.dispose();
      worldDisposablesRef.current = [];
      envRT.dispose();
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      requestRenderRef.current = null;
    };
  }, []);

  // Rebuild 3D test scene whenever assets, viewMode, or timeOfDay change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (worldGroupRef.current) {
      scene.remove(worldGroupRef.current);
      worldGroupRef.current = null;
    }
    for (const d of worldDisposablesRef.current) d.dispose();
    worldDisposablesRef.current = [];

    const tracker = createWorldTracker();
    const root = new THREE.Group();
    root.name = 'asset_test_world';

    // Use existing lighting & atmosphere rig
    const atmo = buildAtmosphereAndLighting(
      tracker,
      'town_square',
      timeOfDay,
      'clear',
      'upbeat',
      'asset_test_lab',
      isSoftwareGlRef.current
    );
    root.add(atmo.group);
    scene.background = atmo.skyColor;
    scene.fog = new THREE.FogExp2(atmo.skyColor.getHex(), atmo.fogDensity);

    if (viewMode === 'village_scene') {
      // Clean village terrain + road/plaza base (no procedural school/trees so imported ones take stage)
      const terrain = buildOutdoorTerrainAndWater(
        tracker,
        'town_square',
        timeOfDay,
        'clear',
        'asset_test_lab',
        isSoftwareGlRef.current
      );
      root.add(terrain.group);

      // Subtle reference plaza pad around Village School
      const padMat = createPbrMaterial(tracker, {
        kind: 'cobble',
        baseColor: '#cbd5e1',
        accentColor: '#94a3b8',
        repeatX: 6,
        repeatY: 4,
        polygonOffset: true,
      });
      const schoolApron = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(10.5, 0.08, 7.0)),
        padMat
      );
      schoolApron.position.set(0, 0.03, -6.2);
      schoolApron.receiveShadow = true;
      root.add(schoolApron);

      const placedBoxes: Array<{ id: string; box: THREE.Box3 }> = [];
      for (const rec of assets) {
        const inst = instantiateExperimentAsset(
          tracker,
          { assetId: rec.id },
          isSoftwareGlRef.current
        );
        if (inst) {
          root.add(inst.root);
          inst.root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(inst.root);
          if (!box.isEmpty()) {
            placedBoxes.push({ id: rec.id, box });
          }
        }
      }

      const foundOverlaps: OverlapPair[] = [];
      for (let i = 0; i < placedBoxes.length; i++) {
        for (let j = i + 1; j < placedBoxes.length; j++) {
          if (placedBoxes[i].box.intersectsBox(placedBoxes[j].box)) {
            foundOverlaps.push({ a: placedBoxes[i].id, b: placedBoxes[j].id });
          }
        }
      }
      setOverlaps(foundOverlaps);
    } else {
      setOverlaps([]);
      // Single Asset Studio Stage
      const floor = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(8, 8, 0.14, 32)),
        createPbrMaterial(tracker, {
          kind: 'sidewalk',
          baseColor: '#334155',
          accentColor: '#1e293b',
          repeatX: 6,
          repeatY: 6,
        })
      );
      floor.position.y = -0.07;
      floor.receiveShadow = true;
      const grid = new THREE.GridHelper(16, 16, 0x38bdf8, 0x475569);
      grid.position.y = 0.01;
      tracker.track(grid);
      root.add(floor, grid);

      if (activeAsset) {
        const inst = instantiateExperimentAsset(
          tracker,
          {
            assetId: activeAsset.id,
            position: { x: 0, y: 0, z: 0 },
          },
          isSoftwareGlRef.current
        );
        if (inst) {
          root.add(inst.root);
        }
      }
    }

    scene.add(root);
    worldGroupRef.current = root;
    worldDisposablesRef.current = tracker.disposables;
    requestRenderRef.current?.();
  }, [assets, activeAsset, viewMode, timeOfDay, sceneRevision]);

  const importedBySlot = useMemo(() => {
    const map = new Map<string, RegisteredImportedAssetRecord>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  return (
    <div className="space-y-4">
      {/* Compact Developer Workspace Header */}
      <div className="bg-[#181c24] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="h-9 px-3 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#f8fafc] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#f8fafc]">
              3D Asset Import Lab (Experimental)
            </h1>
            <p className="text-xs text-[#94a3b8]">
              Temporary local workspace for testing Roblox Studio .glb / .gltf + external textures
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#0f131c] p-0.5 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setViewMode('village_scene');
                setTimeout(resetCameraToScene, 0);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'village_scene'
                  ? 'bg-[#f59e0b] text-[#0a0e16]'
                  : 'text-[#cbd5e1] hover:text-white'
              }`}
            >
              <Trees className="w-3.5 h-3.5" />
              <span>Village Scene (School + 3 Trees)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('single_asset');
                setTimeout(resetCameraToScene, 0);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'single_asset'
                  ? 'bg-[#06b6d4] text-[#0a0e16]'
                  : 'text-[#cbd5e1] hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Single Asset</span>
            </button>
          </div>

          <select
            aria-label="Lighting Time of Day"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
            className="h-9 px-2.5 rounded-lg bg-[#0f131c] border border-white/10 text-xs font-semibold text-[#f8fafc]"
          >
            <option value="morning">Morning Light</option>
            <option value="day">Daylight</option>
            <option value="sunset">Sunset Light</option>
            <option value="night">Night Light</option>
          </select>

          <button
            type="button"
            onClick={resetCameraToScene}
            className="h-9 px-3 rounded-lg bg-[#262a33] hover:bg-[#31353e] border border-white/10 text-xs font-semibold text-[#dfe2ee] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>

          {assets.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="h-9 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-xs font-semibold text-rose-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Lab</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split: 3D Viewport + Controls/Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Real WebGL Orbit Viewport */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-[#181c24] border border-white/[0.08] rounded-xl overflow-hidden">
            <div
              ref={viewportRef}
              className="w-full h-[440px] lg:h-[520px] bg-[#0a0e16]"
            />
            <div className="px-4 py-2.5 bg-[#141821] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8]">
              <span>
                Drag to rotate · Scroll/Pinch to zoom · Right-drag to pan
              </span>
              <span className="flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>{assets.length} asset(s) mounted</span>
              </span>
            </div>
          </div>

          {/* Collision / Assembly Verification Strip */}
          {viewMode === 'village_scene' && (
            <div className="bg-[#181c24] border border-white/[0.08] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#cbd5e1] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#4cd7f6]" />
                  <span>First Asset Collection Readiness (School + 3 Trees)</span>
                </span>
                {overlaps.length === 0 && assets.length >= 2 ? (
                  <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No Bounding Overlap
                  </span>
                ) : overlaps.length > 0 ? (
                  <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Overlap: {overlaps.map((o) => `${o.a}↔${o.b}`).join(', ')}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SLOT_ORDER.map((slotId) => {
                  const rec = importedBySlot.get(slotId);
                  const preset = EXPERIMENT_COLLECTION_PRESETS[slotId];
                  const isSelected = activeAsset?.id === slotId;
                  return (
                    <button
                      key={slotId}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(slotId);
                        if (rec) setActiveAssetId(rec.id);
                      }}
                      className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#262a33] border-[#f59e0b]/70'
                          : 'bg-[#0f131c] border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#f8fafc] truncate">
                          {preset.displayName}
                        </span>
                        {rec ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#94a3b8] truncate mt-0.5">
                        {rec ? rec.sourceFile : 'Not imported yet'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Importer + Transform + Material/Texture Inspector */}
        <div className="lg:col-span-5 space-y-3">
          {/* Importer Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.length) {
                void handleImportFiles(e.dataTransfer.files);
              }
            }}
            className={`bg-[#181c24] border rounded-xl p-4 space-y-3 transition-colors ${
              isDragOver ? 'border-[#f59e0b] bg-[#1e232e]' : 'border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-[#f8fafc] flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#f59e0b]" />
                <span>Import Local 3D Asset</span>
              </h2>
              <select
                aria-label="Target Asset Slot"
                value={selectedSlot}
                onChange={(e) =>
                  setSelectedSlot(e.target.value as ExperimentSlotId | 'custom')
                }
                className="h-8 px-2 rounded-lg bg-[#0f131c] border border-white/10 text-xs font-semibold text-[#f8fafc]"
              >
                <option value="Village_School">Slot: Village_School</option>
                <option value="Tree_Type_A">Slot: Tree_Type_A</option>
                <option value="Tree_Type_B">Slot: Tree_Type_B</option>
                <option value="Tree_Type_C">Slot: Tree_Type_C</option>
                <option value="custom">Custom Asset ID</option>
              </select>
            </div>

            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Select a <code className="text-[#dfe2ee]">.glb</code> file, or select a{' '}
              <code className="text-[#dfe2ee]">.gltf</code> together with its{' '}
              <code className="text-[#dfe2ee]">.bin</code> and texture files (
              <code className="text-[#dfe2ee]">.png/.jpg/.webp</code>). Runs locally in memory.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void handleImportFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />

            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-10 rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#0a0e16] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 cursor-pointer"
            >
              <FolderUp className="w-4 h-4" />
              <span>
                {isImporting
                  ? 'Parsing 3D Asset...'
                  : `Choose .glb / .gltf (+ textures) for ${selectedSlot}`}
              </span>
            </button>

            {importError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{importError}</span>
              </div>
            )}
          </div>

          {/* Registered Assets List */}
          {assets.length > 0 && (
            <div className="bg-[#181c24] border border-white/[0.08] rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-[#cbd5e1]">
                  Registered Temporary Assets ({assets.length})
                </h2>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {assets.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                      activeAsset?.id === item.id
                        ? 'bg-[#262a33] border-[#f59e0b]/60 text-[#f8fafc]'
                        : 'bg-[#0f131c] border-white/[0.06] text-[#cbd5e1]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveAssetId(item.id)}
                      className="flex-1 text-left truncate cursor-pointer"
                    >
                      <span className="font-bold">{item.id}</span>
                      <span className="text-[#94a3b8] ml-2">
                        ({item.format.toUpperCase()} · {item.meshCount}m · {item.triangleCount} tris)
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Inspect in Single View"
                      onClick={() => {
                        setActiveAssetId(item.id);
                        setViewMode('single_asset');
                      }}
                      className="p-1 text-[#94a3b8] hover:text-[#4cd7f6] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove & Dispose Asset"
                      onClick={() => handleRemoveAsset(item.id)}
                      className="p-1 text-[#94a3b8] hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Asset Transform + Material/Texture Inspector */}
          {activeAsset ? (
            <div className="bg-[#181c24] border border-white/[0.08] rounded-xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#f8fafc]">
                    {activeAsset.displayName}{' '}
                    <span className="text-xs font-normal text-[#94a3b8]">({activeAsset.id})</span>
                  </h2>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Raw Size: {activeAsset.dimensions.width}m × {activeAsset.dimensions.height}m ×{' '}
                    {activeAsset.dimensions.depth}m · Category: {activeAsset.category}
                  </p>
                  <p className="text-[11px] text-[#4cd7f6] mt-0.5">
                    Tags: {activeAsset.tags.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetSlotTransform(activeAsset.id)}
                  className="px-2.5 py-1 rounded bg-[#262a33] hover:bg-[#31353e] text-[11px] font-semibold text-[#dfe2ee] cursor-pointer"
                >
                  Reset Slot
                </button>
              </div>

              {activeAsset.warnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 space-y-1">
                  {activeAsset.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transform Sliders & Numeric Inputs */}
              <div className="space-y-2.5 border-t border-white/[0.06] pt-3">
                <div className="text-xs font-bold text-[#cbd5e1]">
                  Transform (Position · Rotation · Scale)
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`pos_${axis}`} className="block text-[11px] text-[#94a3b8]">
                      Pos {axis.toUpperCase()} (m)
                      <input
                        type="number"
                        step="0.25"
                        value={activeAsset.position[axis]}
                        onChange={(e) =>
                          handleTransformChange(activeAsset.id, {
                            position: {
                              ...activeAsset.position,
                              [axis]: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="mt-1 w-full h-8 px-2 rounded bg-[#0f131c] border border-white/10 text-xs text-[#f8fafc]"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <label key={`rot_${axis}`} className="block text-[11px] text-[#94a3b8]">
                      Rot {axis.toUpperCase()} (°)
                      <input
                        type="number"
                        step="5"
                        value={activeAsset.rotationDeg[axis]}
                        onChange={(e) =>
                          handleTransformChange(activeAsset.id, {
                            rotationDeg: {
                              ...activeAsset.rotationDeg,
                              [axis]: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="mt-1 w-full h-8 px-2 rounded bg-[#0f131c] border border-white/10 text-xs text-[#f8fafc]"
                      />
                    </label>
                  ))}
                </div>

                <label className="block text-[11px] text-[#94a3b8]">
                  Scale Multiplier ({activeAsset.scale.toFixed(3)}× · Default:{' '}
                  {activeAsset.defaultScale})
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0.02"
                      max={Math.max(4, activeAsset.defaultScale * 3)}
                      step="0.01"
                      value={activeAsset.scale}
                      onChange={(e) =>
                        handleTransformChange(activeAsset.id, {
                          scale: Math.max(0.005, Number(e.target.value) || 1),
                        })
                      }
                      className="flex-1 accent-[#f59e0b]"
                    />
                    <input
                      type="number"
                      step="0.05"
                      min="0.005"
                      value={activeAsset.scale}
                      onChange={(e) =>
                        handleTransformChange(activeAsset.id, {
                          scale: Math.max(0.005, Number(e.target.value) || 1),
                        })
                      }
                      className="w-20 h-8 px-2 rounded bg-[#0f131c] border border-white/10 text-xs text-[#f8fafc]"
                    />
                  </div>
                </label>
              </div>

              {/* Materials & Textures Inspector */}
              <div className="space-y-2 border-t border-white/[0.06] pt-3">
                <div className="text-xs font-bold text-[#cbd5e1]">
                  Materials ({activeAsset.materialRefs.length}) &amp; Textures (
                  {activeAsset.textureRefs.length})
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {activeAsset.materialRefs.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[#0f131c] border border-white/[0.06] space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#f8fafc] flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm border border-white/20"
                            style={{ backgroundColor: m.colorHex }}
                          />
                          {m.name}
                        </span>
                        <span className="text-[#94a3b8]">{m.type}</span>
                      </div>
                      <div className="text-[#94a3b8]">
                        Roughness: {m.roughness ?? 'n/a'} · Metalness: {m.metalness ?? 'n/a'} ·
                        DoubleSide: {m.doubleSided ? 'Yes' : 'No'}
                      </div>
                      {m.textureSlots.length > 0 && (
                        <div className="text-[#4cd7f6] truncate">
                          Maps: {m.textureSlots.join(' | ')}
                        </div>
                      )}
                    </div>
                  ))}

                  {activeAsset.textureRefs.map((t, idx) => (
                    <div
                      key={`tex_${idx}`}
                      className="px-2 py-1.5 rounded bg-[#141821] border border-white/[0.05] text-[#cbd5e1] flex items-center justify-between"
                    >
                      <span className="truncate">
                        Tex [{t.slot}]: {t.name}
                      </span>
                      <span className="text-[#94a3b8] shrink-0 ml-2">
                        {t.width}×{t.height} · {t.colorSpace || 'linear'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#181c24] border border-white/[0.08] rounded-xl p-5 text-center space-y-1.5">
              <p className="text-xs font-semibold text-[#dfe2ee]">No local 3D assets loaded yet</p>
              <p className="text-xs text-[#94a3b8]">
                Select a slot above (Village_School, Tree_Type_A, Tree_Type_B, Tree_Type_C) and
                import your Roblox Studio .glb or .gltf model files to preview and inspect them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
