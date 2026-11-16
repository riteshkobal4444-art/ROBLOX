import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WorldTracker } from './pbrMaterials';
import {
  disposeGltfTree,
  type LocalImportPayload,
  type RegisteredImportedAssetRecord,
} from './localAssetImporter';

export interface RegisteredGlbSpec {
  id: string;
  label: string;
  category: 'building' | 'prop' | 'character' | 'foliage';
  defaultHeightMeters: number;
  buffer?: ArrayBuffer;
  url?: string;
}

export interface InstantiatedAsset {
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  animations: THREE.AnimationClip[];
  hasSkeleton: boolean;
  sourceAssetId: string;
}

interface RawBoxPart {
  name: string;
  size: [number, number, number];
  position: [number, number, number];
  color: [number, number, number, number];
  roughness: number;
  metalness: number;
}

const registrySpecs = new Map<string, RegisteredGlbSpec>();
const parsedGltfCache = new Map<string, GLTF>();
const pendingLoads = new Map<string, Promise<GLTF>>();
const sharedLoader = new GLTFLoader();

/**
 * Encodes multi-part 3D geometry & PBR materials into a valid binary glTF 2.0 (.glb) ArrayBuffer.
 * Zero external files or network fetches required — parsed identically via GLTFLoader.
 */
function buildBinaryGlbFromBoxParts(parts: RawBoxPart[], assetName: string): ArrayBuffer {
  const binChunks: number[] = [];
  const bufferViews: Array<Record<string, unknown>> = [];
  const accessors: Array<Record<string, unknown>> = [];
  const materials: Array<Record<string, unknown>> = [];
  const meshes: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];

  const padTo4 = (arr: number[]) => {
    while (arr.length % 4 !== 0) arr.push(0);
  };

  parts.forEach((part, idx) => {
    const geo = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
    geo.translate(part.position[0], part.position[1], part.position[2]);

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const normAttr = geo.attributes.normal as THREE.BufferAttribute;
    const indexAttr = geo.getIndex()!;

    // Compute tight bounds for glTF POSITION accessor
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      min[0] = Math.min(min[0], x);
      min[1] = Math.min(min[1], y);
      min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], x);
      max[1] = Math.max(max[1], y);
      max[2] = Math.max(max[2], z);
    }

    // Write POSITION Float32
    padTo4(binChunks);
    const posOffset = binChunks.length;
    const posF32 = new Float32Array(posAttr.array);
    const posBytes = new Uint8Array(posF32.buffer);
    for (let i = 0; i < posBytes.length; i++) binChunks.push(posBytes[i]);

    const posViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: posOffset,
      byteLength: posBytes.byteLength,
      target: 34962,
    });
    const posAccIdx = accessors.length;
    accessors.push({
      bufferView: posViewIdx,
      componentType: 5126,
      count: posAttr.count,
      type: 'VEC3',
      min,
      max,
    });

    // Write NORMAL Float32
    padTo4(binChunks);
    const normOffset = binChunks.length;
    const normF32 = new Float32Array(normAttr.array);
    const normBytes = new Uint8Array(normF32.buffer);
    for (let i = 0; i < normBytes.length; i++) binChunks.push(normBytes[i]);

    const normViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: normOffset,
      byteLength: normBytes.byteLength,
      target: 34962,
    });
    const normAccIdx = accessors.length;
    accessors.push({
      bufferView: normViewIdx,
      componentType: 5126,
      count: normAttr.count,
      type: 'VEC3',
    });

    // Write INDICES Uint16
    padTo4(binChunks);
    const idxOffset = binChunks.length;
    const idxU16 = new Uint16Array(indexAttr.array);
    const idxBytes = new Uint8Array(idxU16.buffer);
    for (let i = 0; i < idxBytes.length; i++) binChunks.push(idxBytes[i]);

    const idxViewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: idxOffset,
      byteLength: idxBytes.byteLength,
      target: 34963,
    });
    const idxAccIdx = accessors.length;
    accessors.push({
      bufferView: idxViewIdx,
      componentType: 5123,
      count: indexAttr.count,
      type: 'SCALAR',
    });

    geo.dispose();

    materials.push({
      name: `${part.name}_mat`,
      pbrMetallicRoughness: {
        baseColorFactor: part.color,
        metallicFactor: part.metalness,
        roughnessFactor: part.roughness,
      },
    });

    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
          indices: idxAccIdx,
          material: idx,
        },
      ],
    });

    nodes.push({
      name: part.name,
      mesh: idx,
    });
  });

  padTo4(binChunks);

  const gltfJson = {
    asset: { version: '2.0', generator: 'StoryForge-RobloxAssetBridge' },
    scene: 0,
    scenes: [{ name: assetName, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binChunks.length }],
  };

  const jsonStr = JSON.stringify(gltfJson);
  const encoder = new TextEncoder();
  const jsonRaw = encoder.encode(jsonStr);
  const jsonPaddedLen = Math.ceil(jsonRaw.length / 4) * 4;
  const totalLength = 12 + 8 + jsonPaddedLen + 8 + binChunks.length;

  const out = new ArrayBuffer(totalLength);
  const view = new DataView(out);
  const u8 = new Uint8Array(out);

  // GLB Header: magic ('glTF'), version (2), total byteLength
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  // JSON chunk header
  view.setUint32(12, jsonPaddedLen, true);
  view.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonRaw, 20);
  for (let i = jsonRaw.length; i < jsonPaddedLen; i++) {
    u8[20 + i] = 0x20; // space padding per glTF spec
  }

  // BIN chunk header
  const binChunkStart = 20 + jsonPaddedLen;
  view.setUint32(binChunkStart, binChunks.length, true);
  view.setUint32(binChunkStart + 4, 0x004e4942, true);
  u8.set(binChunks, binChunkStart + 8);

  return out;
}

let builtinsRegistered = false;

export function ensureBuiltinRobloxTestAssetsRegistered(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;

  // 1. Test Building Asset GLB: Village Timber Market Stall
  const stallGlb = buildBinaryGlbFromBoxParts(
    [
      {
        name: 'stall_stone_plinth',
        size: [2.6, 0.16, 1.6],
        position: [0, 0.08, 0],
        color: [0.55, 0.58, 0.62, 1],
        roughness: 0.85,
        metalness: 0.05,
      },
      {
        name: 'stall_counter',
        size: [2.35, 0.85, 0.85],
        position: [0, 0.58, 0.2],
        color: [0.48, 0.25, 0.1, 1],
        roughness: 0.72,
        metalness: 0.04,
      },
      {
        name: 'stall_countertop',
        size: [2.5, 0.1, 0.96],
        position: [0, 1.04, 0.2],
        color: [0.76, 0.53, 0.28, 1],
        roughness: 0.58,
        metalness: 0.05,
      },
      {
        name: 'stall_post_fl',
        size: [0.14, 2.25, 0.14],
        position: [-1.1, 1.28, 0.58],
        color: [0.35, 0.18, 0.08, 1],
        roughness: 0.75,
        metalness: 0.04,
      },
      {
        name: 'stall_post_fr',
        size: [0.14, 2.25, 0.14],
        position: [1.1, 1.28, 0.58],
        color: [0.35, 0.18, 0.08, 1],
        roughness: 0.75,
        metalness: 0.04,
      },
      {
        name: 'stall_post_bl',
        size: [0.14, 2.45, 0.14],
        position: [-1.1, 1.38, -0.58],
        color: [0.35, 0.18, 0.08, 1],
        roughness: 0.75,
        metalness: 0.04,
      },
      {
        name: 'stall_post_br',
        size: [0.14, 2.45, 0.14],
        position: [1.1, 1.38, -0.58],
        color: [0.35, 0.18, 0.08, 1],
        roughness: 0.75,
        metalness: 0.04,
      },
      {
        name: 'stall_awning_red',
        size: [2.7, 0.14, 1.55],
        position: [0, 2.52, 0.05],
        color: [0.8, 0.18, 0.18, 1],
        roughness: 0.78,
        metalness: 0.02,
      },
      {
        name: 'stall_awning_stripe',
        size: [1.1, 0.16, 1.56],
        position: [0, 2.53, 0.05],
        color: [0.96, 0.94, 0.88, 1],
        roughness: 0.8,
        metalness: 0.02,
      },
      {
        name: 'stall_crate_prop',
        size: [0.48, 0.44, 0.48],
        position: [-0.72, 1.31, 0.2],
        color: [0.82, 0.55, 0.16, 1],
        roughness: 0.65,
        metalness: 0.05,
      },
    ],
    'RobloxMarketStall'
  );

  // 2. Test Environmental Asset GLB: Stone Planter + Tiered Stylized Shrub
  const planterGlb = buildBinaryGlbFromBoxParts(
    [
      {
        name: 'planter_stone_rim',
        size: [1.35, 0.48, 1.35],
        position: [0, 0.24, 0],
        color: [0.62, 0.66, 0.72, 1],
        roughness: 0.84,
        metalness: 0.05,
      },
      {
        name: 'planter_soil',
        size: [1.12, 0.12, 1.12],
        position: [0, 0.46, 0],
        color: [0.28, 0.16, 0.08, 1],
        roughness: 0.95,
        metalness: 0.0,
      },
      {
        name: 'cypress_trunk',
        size: [0.24, 0.68, 0.24],
        position: [0, 0.8, 0],
        color: [0.38, 0.22, 0.1, 1],
        roughness: 0.88,
        metalness: 0.02,
      },
      {
        name: 'cypress_foliage_lower',
        size: [0.95, 0.82, 0.95],
        position: [0, 1.32, 0],
        color: [0.1, 0.48, 0.22, 1],
        roughness: 0.78,
        metalness: 0.02,
      },
      {
        name: 'cypress_foliage_mid',
        size: [0.68, 0.76, 0.68],
        position: [0, 1.98, 0],
        color: [0.13, 0.58, 0.27, 1],
        roughness: 0.76,
        metalness: 0.02,
      },
      {
        name: 'cypress_foliage_top',
        size: [0.38, 0.56, 0.38],
        position: [0, 2.54, 0],
        color: [0.18, 0.66, 0.32, 1],
        roughness: 0.75,
        metalness: 0.02,
      },
    ],
    'RobloxPlanterTree'
  );

  registerGlbAsset({
    id: 'roblox_test_market_stall',
    label: 'Roblox Test Building (Market Stall)',
    category: 'building',
    defaultHeightMeters: 2.75,
    buffer: stallGlb,
  });

  registerGlbAsset({
    id: 'roblox_test_cypress_planter',
    label: 'Roblox Test Environmental Prop (Stone Planter)',
    category: 'prop',
    defaultHeightMeters: 2.45,
    buffer: planterGlb,
  });
}

export function registerGlbAsset(spec: RegisteredGlbSpec): void {
  registrySpecs.set(spec.id, spec);
  parsedGltfCache.delete(spec.id);
}

export async function importRobloxStudioGlbFile(
  file: File,
  category: RegisteredGlbSpec['category'] = 'prop',
  defaultHeightMeters = 2.5
): Promise<RegisteredGlbSpec> {
  const buffer = await file.arrayBuffer();
  const id = `user_glb_${file.name.replace(/[^\w]+/g, '_').toLowerCase()}_${Date.now()}`;
  const spec: RegisteredGlbSpec = {
    id,
    label: file.name,
    category,
    defaultHeightMeters,
    buffer,
  };
  registerGlbAsset(spec);
  await loadRegisteredGlb(id);
  return spec;
}

export function getRegisteredAssetIds(): string[] {
  ensureBuiltinRobloxTestAssetsRegistered();
  return Array.from(registrySpecs.keys());
}

export async function loadRegisteredGlb(assetId: string): Promise<GLTF> {
  ensureBuiltinRobloxTestAssetsRegistered();
  const cached = parsedGltfCache.get(assetId);
  if (cached) return cached;

  const existing = pendingLoads.get(assetId);
  if (existing) return existing;

  const spec = registrySpecs.get(assetId);
  if (!spec) {
    throw new Error(`Registered GLB asset "${assetId}" not found.`);
  }

  const loadPromise = (async () => {
    let gltf: GLTF;
    if (spec.buffer) {
      gltf = await sharedLoader.parseAsync(spec.buffer.slice(0), '');
    } else if (spec.url) {
      gltf = await sharedLoader.loadAsync(spec.url);
    } else {
      throw new Error(`GLB asset "${assetId}" has neither buffer nor url.`);
    }
    parsedGltfCache.set(assetId, gltf);
    return gltf;
  })();

  pendingLoads.set(assetId, loadPromise);
  try {
    return await loadPromise;
  } finally {
    pendingLoads.delete(assetId);
  }
}

export async function preloadBuiltinGlbAssets(): Promise<void> {
  ensureBuiltinRobloxTestAssetsRegistered();
  await Promise.all([
    loadRegisteredGlb('roblox_test_market_stall'),
    loadRegisteredGlb('roblox_test_cypress_planter'),
  ]);
}

function buildInstantiatedFromGltf(
  gltf: GLTF,
  spec: RegisteredGlbSpec,
  tracker: WorldTracker,
  targetHeight?: number,
  isSoftwareGl = false
): InstantiatedAsset {
  let hasSkeleton = false;
  gltf.scene.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkeleton = true;
  });

  const clonedScene = (hasSkeleton ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true)) as THREE.Group;

  // Compute bounds to auto-scale & ground bottom-center at y = 0
  clonedScene.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(clonedScene);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const desiredH = targetHeight ?? spec.defaultHeightMeters;
  const scaleFactor = rawSize.y > 0.001 ? desiredH / rawSize.y : 1;

  const wrapper = new THREE.Group();
  wrapper.name = `glb_${spec.id}`;
  clonedScene.scale.setScalar(scaleFactor);
  clonedScene.position.set(
    -rawCenter.x * scaleFactor,
    -rawBox.min.y * scaleFactor,
    -rawCenter.z * scaleFactor
  );
  wrapper.add(clonedScene);

  clonedScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = true;
      if (mesh.geometry) {
        mesh.geometry = tracker.track(mesh.geometry.clone());
      }
      const adaptMaterial = (m: THREE.Material): THREE.Material => {
        const c = m.clone();
        if (isSoftwareGl && c instanceof THREE.MeshPhysicalMaterial) {
          c.transmission = 0;
        }
        return tracker.track(c);
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(adaptMaterial);
      } else if (mesh.material) {
        mesh.material = adaptMaterial(mesh.material);
      }
    }
  });

  const animations = gltf.animations ?? [];
  let mixer: THREE.AnimationMixer | undefined;
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(clonedScene);
    mixer.clipAction(animations[0]).play();
  }

  return {
    root: wrapper,
    mixer,
    animations,
    hasSkeleton,
    sourceAssetId: spec.id,
  };
}

export function instantiateRegisteredAssetIfCached(
  tracker: WorldTracker,
  assetId: string,
  targetHeight?: number,
  isSoftwareGl = false
): InstantiatedAsset | null {
  ensureBuiltinRobloxTestAssetsRegistered();
  const spec = registrySpecs.get(assetId);
  const gltf = parsedGltfCache.get(assetId);
  if (!spec || !gltf) return null;
  return buildInstantiatedFromGltf(gltf, spec, tracker, targetHeight, isSoftwareGl);
}

/**
 * Mounts a registered GLB asset into `parent` synchronously if parsed, or asynchronously as soon as
 * `GLTFLoader` completes parsing (respecting `isDisposed` so unmounted environments never leak).
 */
export function mountRegisteredAsset(
  parent: THREE.Group,
  tracker: WorldTracker,
  assetId: string,
  options: {
    x: number;
    y?: number;
    z: number;
    yaw?: number;
    targetHeight?: number;
    isSoftwareGl?: boolean;
    isEnvironmentDisposed?: () => boolean;
    onMounted?: (inst: InstantiatedAsset) => void;
  }
): THREE.Group {
  const anchor = new THREE.Group();
  anchor.name = `glb_anchor_${assetId}`;
  anchor.position.set(options.x, options.y ?? 0, options.z);
  if (options.yaw) anchor.rotation.y = options.yaw;
  parent.add(anchor);

  const cachedInst = instantiateRegisteredAssetIfCached(
    tracker,
    assetId,
    options.targetHeight,
    options.isSoftwareGl
  );
  if (cachedInst) {
    anchor.add(cachedInst.root);
    options.onMounted?.(cachedInst);
    return anchor;
  }

  loadRegisteredGlb(assetId)
    .then((gltf) => {
      if (options.isEnvironmentDisposed?.()) return;
      const spec = registrySpecs.get(assetId);
      if (!spec) return;
      const inst = buildInstantiatedFromGltf(
        gltf,
        spec,
        tracker,
        options.targetHeight,
        options.isSoftwareGl
      );
      anchor.add(inst.root);
      options.onMounted?.(inst);
    })
    .catch(() => {
      // Ignore if environment unmounted before parse finished
    });

  return anchor;
}

export function clearAssetRegistryCache(): void {
  parsedGltfCache.clear();
  pendingLoads.clear();
}

// ============================================================================
// Temporary Experiment Asset Collection Registry (Village_School + Trees + Custom)
// ============================================================================

interface StoredExperimentEntry {
  record: RegisteredImportedAssetRecord;
  gltf: GLTF;
}

const temporaryExperimentAssets = new Map<string, StoredExperimentEntry>();

export function registerImportedExperimentAsset(
  payload: LocalImportPayload
): RegisteredImportedAssetRecord {
  const existing = temporaryExperimentAssets.get(payload.record.id);
  if (existing) {
    disposeGltfTree(existing.gltf.scene);
    temporaryExperimentAssets.delete(payload.record.id);
  }
  temporaryExperimentAssets.set(payload.record.id, {
    record: { ...payload.record },
    gltf: payload.gltf,
  });
  return payload.record;
}

export function getRegisteredExperimentAssets(): RegisteredImportedAssetRecord[] {
  return Array.from(temporaryExperimentAssets.values()).map((e) => ({
    ...e.record,
    position: { ...e.record.position },
    rotationDeg: { ...e.record.rotationDeg },
  }));
}

export function getRegisteredExperimentAsset(
  id: string
): StoredExperimentEntry | undefined {
  return temporaryExperimentAssets.get(id);
}

export function updateImportedAssetTransform(
  id: string,
  patch: Partial<
    Pick<
      RegisteredImportedAssetRecord,
      'position' | 'rotationDeg' | 'scale' | 'displayName' | 'tags'
    >
  >
): RegisteredImportedAssetRecord | null {
  const entry = temporaryExperimentAssets.get(id);
  if (!entry) return null;
  entry.record = {
    ...entry.record,
    ...patch,
    position: patch.position ? { ...patch.position } : entry.record.position,
    rotationDeg: patch.rotationDeg ? { ...patch.rotationDeg } : entry.record.rotationDeg,
  };
  return entry.record;
}

export function removeImportedExperimentAsset(id: string): boolean {
  const entry = temporaryExperimentAssets.get(id);
  if (!entry) return false;
  disposeGltfTree(entry.gltf.scene);
  temporaryExperimentAssets.delete(id);
  return true;
}

export function clearTemporaryExperimentAssets(): void {
  for (const entry of temporaryExperimentAssets.values()) {
    disposeGltfTree(entry.gltf.scene);
  }
  temporaryExperimentAssets.clear();
}

export interface ExplicitImportedPlacement {
  assetId: string;
  position?: { x: number; y: number; z: number };
  rotationDeg?: { x: number; y: number; z: number };
  scale?: number;
}

/**
 * Instantiates a registered temporary imported asset using its raw scale, bottom-center grounding,
 * transform, and shadows, ready to mount into any Three.js scene or environmentGroup.
 */
export function instantiateExperimentAsset(
  tracker: WorldTracker,
  placement: ExplicitImportedPlacement,
  isSoftwareGl = false
): InstantiatedAsset | null {
  const entry = temporaryExperimentAssets.get(placement.assetId);
  if (!entry) return null;

  const { gltf, record } = entry;
  let hasSkeleton = false;
  gltf.scene.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkeleton = true;
  });

  const clonedScene = (
    hasSkeleton ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true)
  ) as THREE.Group;

  clonedScene.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(clonedScene);
  const rawCenter = new THREE.Vector3();
  if (!rawBox.isEmpty()) {
    rawBox.getCenter(rawCenter);
  }

  const activeScale = placement.scale ?? record.scale;
  const pos = placement.position ?? record.position;
  const rotDeg = placement.rotationDeg ?? record.rotationDeg;

  const wrapper = new THREE.Group();
  wrapper.name = `imported_asset_${record.id}`;
  wrapper.userData.assetId = record.id;

  // Pivot cleanly at bottom-center (y = 0) so scale & rotation stay grounded
  clonedScene.scale.setScalar(activeScale);
  if (!rawBox.isEmpty()) {
    clonedScene.position.set(
      -rawCenter.x * activeScale,
      -rawBox.min.y * activeScale,
      -rawCenter.z * activeScale
    );
  }
  wrapper.add(clonedScene);

  wrapper.position.set(pos.x, pos.y, pos.z);
  wrapper.rotation.set(
    THREE.MathUtils.degToRad(rotDeg.x),
    THREE.MathUtils.degToRad(rotDeg.y),
    THREE.MathUtils.degToRad(rotDeg.z)
  );

  clonedScene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = true;
      if (mesh.geometry) {
        mesh.geometry = tracker.track(mesh.geometry.clone());
      }
      const adaptMaterial = (m: THREE.Material): THREE.Material => {
        const c = m.clone();
        if (isSoftwareGl && c instanceof THREE.MeshPhysicalMaterial) {
          c.transmission = 0;
        }
        return tracker.track(c);
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(adaptMaterial);
      } else if (mesh.material) {
        mesh.material = adaptMaterial(mesh.material);
      }
    }
  });

  const animations = gltf.animations ?? [];
  let mixer: THREE.AnimationMixer | undefined;
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(clonedScene);
    mixer.clipAction(animations[0]).play();
  }

  return {
    root: wrapper,
    mixer,
    animations,
    hasSkeleton,
    sourceAssetId: record.id,
  };
}

