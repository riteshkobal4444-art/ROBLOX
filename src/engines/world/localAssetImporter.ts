import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ExperimentSlotId =
  | 'Village_School'
  | 'Tree_Type_A'
  | 'Tree_Type_B'
  | 'Tree_Type_C';

export type ImportedAssetCategory = 'building' | 'foliage' | 'prop' | 'character';

export interface AssetVector3 {
  x: number;
  y: number;
  z: number;
}

export interface InspectedTextureRef {
  name: string;
  slot: string;
  width: number;
  height: number;
  colorSpace: string;
  sourceUri?: string;
}

export interface InspectedMaterialRef {
  name: string;
  type: string;
  colorHex: string;
  roughness: number | null;
  metalness: number | null;
  doubleSided: boolean;
  transparent: boolean;
  opacity: number;
  textureSlots: string[];
}

export interface RegisteredImportedAssetRecord {
  id: string;
  displayName: string;
  category: ImportedAssetCategory;
  sourceFile: string;
  associatedFiles: string[];
  format: 'glb' | 'gltf';
  dimensions: { width: number; height: number; depth: number };
  defaultScale: number;
  scale: number;
  position: AssetVector3;
  rotationDeg: AssetVector3;
  materialRefs: InspectedMaterialRef[];
  textureRefs: InspectedTextureRef[];
  meshCount: number;
  triangleCount: number;
  tags: string[];
  missingDependencies: string[];
  warnings: string[];
  isTemporary: true;
  importedAt: number;
}

export interface ExperimentSlotPreset {
  id: ExperimentSlotId;
  displayName: string;
  category: ImportedAssetCategory;
  targetHeightMeters: number;
  defaultPosition: AssetVector3;
  defaultRotationDeg: AssetVector3;
  tags: string[];
}

export const EXPERIMENT_COLLECTION_PRESETS: Record<ExperimentSlotId, ExperimentSlotPreset> = {
  Village_School: {
    id: 'Village_School',
    displayName: 'Village School',
    category: 'building',
    targetHeightMeters: 6.2,
    defaultPosition: { x: 0, y: 0, z: -6.2 },
    defaultRotationDeg: { x: 0, y: 0, z: 0 },
    tags: ['village', 'school', 'building', 'central', 'roblox_studio_import'],
  },
  Tree_Type_A: {
    id: 'Tree_Type_A',
    displayName: 'Tree Type A',
    category: 'foliage',
    targetHeightMeters: 4.8,
    defaultPosition: { x: -7.4, y: 0, z: -4.2 },
    defaultRotationDeg: { x: 0, y: 20, z: 0 },
    tags: ['tree', 'foliage', 'nature', 'village', 'type_a'],
  },
  Tree_Type_B: {
    id: 'Tree_Type_B',
    displayName: 'Tree Type B',
    category: 'foliage',
    targetHeightMeters: 5.1,
    defaultPosition: { x: 7.4, y: 0, z: -4.2 },
    defaultRotationDeg: { x: 0, y: -28, z: 0 },
    tags: ['tree', 'foliage', 'nature', 'village', 'type_b'],
  },
  Tree_Type_C: {
    id: 'Tree_Type_C',
    displayName: 'Tree Type C',
    category: 'foliage',
    targetHeightMeters: 5.4,
    defaultPosition: { x: -8.6, y: 0, z: -9.6 },
    defaultRotationDeg: { x: 0, y: 65, z: 0 },
    tags: ['tree', 'foliage', 'nature', 'village', 'type_c'],
  },
};

export interface LocalImportPayload {
  record: RegisteredImportedAssetRecord;
  gltf: GLTF;
}

const SUPPORTED_MODEL_EXT = /\.(glb|gltf)$/i;
const TEXTURE_SLOTS: Array<keyof THREE.MeshStandardMaterial> = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
];

function normalizePathKey(raw: string): string {
  return decodeURIComponent(raw)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();
}

function getBasename(pathStr: string): string {
  const clean = normalizePathKey(pathStr);
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

export function extractGltfExternalDependencies(gltfJsonText: string): string[] {
  const deps: string[] = [];
  try {
    const parsed = JSON.parse(gltfJsonText) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    for (const buf of parsed.buffers ?? []) {
      if (buf.uri && !buf.uri.startsWith('data:')) {
        deps.push(buf.uri);
      }
    }
    for (const img of parsed.images ?? []) {
      if (img.uri && !img.uri.startsWith('data:')) {
        deps.push(img.uri);
      }
    }
  } catch {
    // JSON parse errors will be surfaced cleanly by GLTFLoader / preflight validation
  }
  return Array.from(new Set(deps));
}

export function disposeGltfTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const mat of mats) {
      materials.add(mat);
      for (const slot of TEXTURE_SLOTS) {
        const tex = (mat as unknown as Record<string, unknown>)[slot];
        if (tex instanceof THREE.Texture) {
          textures.add(tex);
        }
      }
    }
  });

  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}

function inspectLoadedScene(scene: THREE.Object3D): {
  dimensions: { width: number; height: number; depth: number };
  meshCount: number;
  triangleCount: number;
  materialRefs: InspectedMaterialRef[];
  textureRefs: InspectedTextureRef[];
  warnings: string[];
} {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getSize(size);
  }

  let meshCount = 0;
  let triangleCount = 0;
  const seenMaterials = new Map<THREE.Material, InspectedMaterialRef>();
  const seenTextures = new Map<THREE.Texture, InspectedTextureRef>();
  const warnings: string[] = [];

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount++;

    if (mesh.geometry) {
      if (mesh.geometry.index) {
        triangleCount += Math.floor(mesh.geometry.index.count / 3);
      } else if (mesh.geometry.attributes.position) {
        triangleCount += Math.floor(mesh.geometry.attributes.position.count / 3);
      }
    }

    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];

    for (const mat of mats) {
      if (!seenMaterials.has(mat)) {
        const std = mat as THREE.MeshStandardMaterial;
        const textureSlots: string[] = [];

        for (const slot of TEXTURE_SLOTS) {
          const val = (std as unknown as Record<string, unknown>)[slot];
          if (val instanceof THREE.Texture) {
            textureSlots.push(`${String(slot)}: ${val.name || 'embedded'}`);

            // Ensure albedo maps stay sRGB and normal/roughness stay linear
            if ((slot === 'map' || slot === 'emissiveMap') && val.colorSpace !== THREE.SRGBColorSpace) {
              val.colorSpace = THREE.SRGBColorSpace;
              val.needsUpdate = true;
            } else if (
              (slot === 'normalMap' || slot === 'roughnessMap' || slot === 'metalnessMap') &&
              val.colorSpace === THREE.SRGBColorSpace
            ) {
              val.colorSpace = THREE.NoColorSpace;
              val.needsUpdate = true;
            }

            if (!seenTextures.has(val)) {
              const img = val.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
              const w = img?.naturalWidth || img?.width || 0;
              const h = img?.naturalHeight || img?.height || 0;
              seenTextures.set(val, {
                name: val.name || `${mat.name || 'mat'}_${String(slot)}`,
                slot: String(slot),
                width: w,
                height: h,
                colorSpace: val.colorSpace || 'NoColorSpace',
              });
              if (w === 0 || h === 0) {
                warnings.push(`Texture "${val.name || String(slot)}" has 0x0 pixel image data.`);
              }
            }
          }
        }

        const colorHex =
          std.color instanceof THREE.Color ? `#${std.color.getHexString()}` : '#ffffff';

        seenMaterials.set(mat, {
          name: mat.name || `Material_${seenMaterials.size + 1}`,
          type: mat.type,
          colorHex,
          roughness: typeof std.roughness === 'number' ? Number(std.roughness.toFixed(2)) : null,
          metalness: typeof std.metalness === 'number' ? Number(std.metalness.toFixed(2)) : null,
          doubleSided: mat.side === THREE.DoubleSide,
          transparent: mat.transparent,
          opacity: Number(mat.opacity.toFixed(2)),
          textureSlots,
        });
      }
    }
  });

  if (meshCount === 0) {
    warnings.push('Imported file contains 0 renderable meshes.');
  }

  return {
    dimensions: {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3)),
    },
    meshCount,
    triangleCount,
    materialRefs: Array.from(seenMaterials.values()),
    textureRefs: Array.from(seenTextures.values()),
    warnings,
  };
}

export interface ImportAssetOptions {
  slotId?: ExperimentSlotId | string;
  displayName?: string;
  category?: ImportedAssetCategory;
  targetHeightMeters?: number;
  tags?: string[];
}

/**
 * Loads a local .glb or .gltf asset along with any selected external dependencies (.bin, .png, .jpg, .webp).
 * Revokes all temporary Blob URLs cleanly after parsing.
 */
export async function importLocal3DAssetFiles(
  files: File[],
  options: ImportAssetOptions = {}
): Promise<LocalImportPayload> {
  if (!files || files.length === 0) {
    throw new Error('No files selected. Choose a .glb or .gltf file (plus any external textures/.bin).');
  }

  const primaryFile = files.find((f) => SUPPORTED_MODEL_EXT.test(f.name));
  if (!primaryFile) {
    throw new Error(
      `Unsupported file format (${files.map((f) => f.name).join(', ')}). Select a .glb or .gltf model.`
    );
  }

  const isGlb = /\.glb$/i.test(primaryFile.name);
  const format: 'glb' | 'gltf' = isGlb ? 'glb' : 'gltf';

  // Map relative paths & basenames of companion files (.bin / textures) to temporary Blob URLs
  const blobUrls: string[] = [];
  const exactLookup = new Map<string, string>();
  const basenameLookup = new Map<string, string>();

  const associatedFiles: string[] = [];
  for (const file of files) {
    if (file === primaryFile) continue;
    associatedFiles.push(file.name);
    const blobUrl = URL.createObjectURL(file);
    blobUrls.push(blobUrl);

    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (relPath) {
      exactLookup.set(normalizePathKey(relPath).toLowerCase(), blobUrl);
      // Also strip top folder segment if uploaded via folder picker
      const slashIdx = relPath.indexOf('/');
      if (slashIdx >= 0) {
        exactLookup.set(normalizePathKey(relPath.slice(slashIdx + 1)).toLowerCase(), blobUrl);
      }
    }
    exactLookup.set(normalizePathKey(file.name).toLowerCase(), blobUrl);
    basenameLookup.set(getBasename(file.name).toLowerCase(), blobUrl);
  }

  const failedUrls: string[] = [];
  const missingDependencies: string[] = [];

  try {
    const primaryBuffer = await primaryFile.arrayBuffer();
    if (primaryBuffer.byteLength < 12) {
      throw new Error(`File "${primaryFile.name}" is empty or truncated.`);
    }

    if (isGlb) {
      const magic = new DataView(primaryBuffer).getUint32(0, true);
      if (magic !== 0x46546c67) {
        throw new Error(`File "${primaryFile.name}" is not a valid binary .glb (missing glTF header).`);
      }
    } else {
      const jsonText = new TextDecoder().decode(primaryBuffer);
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(jsonText);
      } catch {
        throw new Error(`File "${primaryFile.name}" is not valid JSON glTF.`);
      }
      if (!parsedJson || typeof parsedJson !== 'object' || !('asset' in parsedJson)) {
        throw new Error(`File "${primaryFile.name}" is missing required glTF "asset" metadata.`);
      }

      const externalDeps = extractGltfExternalDependencies(jsonText);
      for (const dep of externalDeps) {
        const clean = normalizePathKey(dep).toLowerCase();
        const base = getBasename(dep).toLowerCase();
        if (!exactLookup.has(clean) && !basenameLookup.has(base)) {
          missingDependencies.push(dep);
        }
      }
      const missingBins = missingDependencies.filter((d) => /\.bin$/i.test(d));
      if (missingBins.length > 0) {
        throw new Error(
          `Missing required binary file(s) for ${primaryFile.name}: ${missingBins.join(', ')}. Please select the .gltf and its .bin/texture files together.`
        );
      }
    }

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (url.startsWith('data:') || url.startsWith('blob:')) return url;
      const clean = normalizePathKey(url).toLowerCase();
      const base = getBasename(url).toLowerCase();
      return exactLookup.get(clean) || basenameLookup.get(base) || url;
    });
    manager.onError = (url) => {
      failedUrls.push(getBasename(url));
    };

    const loader = new GLTFLoader(manager);
    const gltf = await loader.parseAsync(primaryBuffer, '');
    const inspected = inspectLoadedScene(gltf.scene);

    const preset =
      options.slotId && options.slotId in EXPERIMENT_COLLECTION_PRESETS
        ? EXPERIMENT_COLLECTION_PRESETS[options.slotId as ExperimentSlotId]
        : undefined;

    const id =
      options.slotId?.trim() ||
      `import_${primaryFile.name.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')}`;
    const displayName =
      options.displayName?.trim() ||
      preset?.displayName ||
      primaryFile.name.replace(SUPPORTED_MODEL_EXT, '');
    const category: ImportedAssetCategory =
      options.category || preset?.category || 'prop';

    const targetH = options.targetHeightMeters ?? preset?.targetHeightMeters ?? 3.5;
    const rawH = inspected.dimensions.height;
    const defaultScale = rawH > 0.001 ? Number((targetH / rawH).toFixed(4)) : 1;

    const warnings = [...inspected.warnings];
    if (missingDependencies.length > 0) {
      warnings.push(
        `Missing external texture(s): ${missingDependencies.join(', ')}. Re-import together with these files.`
      );
    }
    if (failedUrls.length > 0) {
      warnings.push(`Failed to decode external resource(s): ${Array.from(new Set(failedUrls)).join(', ')}`);
    }

    const record: RegisteredImportedAssetRecord = {
      id,
      displayName,
      category,
      sourceFile: primaryFile.name,
      associatedFiles,
      format,
      dimensions: inspected.dimensions,
      defaultScale,
      scale: defaultScale,
      position: preset ? { ...preset.defaultPosition } : { x: 0, y: 0, z: 0 },
      rotationDeg: preset ? { ...preset.defaultRotationDeg } : { x: 0, y: 0, z: 0 },
      materialRefs: inspected.materialRefs,
      textureRefs: inspected.textureRefs,
      meshCount: inspected.meshCount,
      triangleCount: inspected.triangleCount,
      tags: options.tags || preset?.tags || [category, 'imported', format],
      missingDependencies: Array.from(new Set([...missingDependencies, ...failedUrls])),
      warnings,
      isTemporary: true,
      importedAt: Date.now(),
    };

    return { record, gltf };
  } finally {
    for (const url of blobUrls) {
      URL.revokeObjectURL(url);
    }
  }
}
