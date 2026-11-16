import * as THREE from 'three';

export interface WorldTracker {
  track: <T extends { dispose: () => void }>(item: T) => T;
  disposables: Array<{ dispose: () => void }>;
}

export function createWorldTracker(): WorldTracker {
  const disposables: Array<{ dispose: () => void }> = [];
  return {
    disposables,
    track: <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    },
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number | string): () => number {
  let state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PbrSurfaceKind =
  | 'grass'
  | 'soil'
  | 'sand'
  | 'cobble'
  | 'asphalt'
  | 'sidewalk'
  | 'brick'
  | 'wood'
  | 'plaster'
  | 'concrete'
  | 'shingle'
  | 'metal'
  | 'tile'
  | 'rug'
  | 'water';

interface TextureTriplet {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hash2D(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x: number, y: number, period: number, seed: number): number {
  const fx = ((x % period) + period) % period;
  const fy = ((y % period) + period) % period;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const tx = fx - x0;
  const ty = fy - y0;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);

  const v00 = hash2D(x0, y0, seed);
  const v10 = hash2D(x1, y0, seed);
  const v01 = hash2D(x0, y1, seed);
  const v11 = hash2D(x1, y1, seed);
  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

function fbmTileable(u: number, v: number, baseFreq: number, seed: number): number {
  let sum = 0;
  let amp = 0.55;
  let freq = baseFreq;
  for (let o = 0; o < 3; o++) {
    sum += amp * valueNoise2D(u * freq, v * freq, freq, seed + o * 97);
    freq *= 2;
    amp *= 0.45;
  }
  return sum;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function buildProceduralTextureTriplet(
  kind: PbrSurfaceKind,
  baseHex: string,
  accentHex: string,
  repeatX: number,
  repeatY: number,
  anisotropy = 4
): TextureTriplet {
  const size = 128;
  const albedo = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const heightField = new Float32Array(size * size);

  const [br, bg, bb] = hexToRgb(baseHex);
  const [ar, ag, ab] = hexToRgb(accentHex);
  const seed = hashString(kind);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const fbm = fbmTileable(u, v, 8, seed);
      const fine = valueNoise2D(u * 32, v * 32, 32, seed + 409);

      let mixT = fbm;
      let h = fbm * 0.5;
      let rVal = 0.78;
      let seamDarken = 1.0;

      switch (kind) {
        case 'grass': {
          const blades = valueNoise2D(u * 32, v * 12, 32, seed + 13);
          mixT = 0.55 * fbm + 0.45 * blades;
          h = 0.4 + mixT * 0.55;
          rVal = 0.84 + (1 - blades) * 0.12;
          break;
        }
        case 'soil': {
          const pebble = fine > 0.78 ? 0.3 : 0;
          mixT = fbm * 0.7 + pebble;
          h = 0.35 + fbm * 0.45 + pebble * 0.4;
          rVal = 0.9 + (1 - fine) * 0.08;
          break;
        }
        case 'sand': {
          const ripple = Math.sin((u * 3 + v * 6 + fbm * 0.8) * Math.PI * 2) * 0.5 + 0.5;
          mixT = 0.6 * ripple + 0.4 * fine;
          h = 0.45 + ripple * 0.35 + fine * 0.1;
          rVal = 0.82 + fine * 0.12;
          break;
        }
        case 'cobble': {
          const rows = 4;
          const cols = 4;
          const ry = v * rows;
          const rowIdx = Math.floor(ry);
          const rx = u * cols + (rowIdx % 2 === 1 ? 0.5 : 0);
          const fx = rx - Math.floor(rx);
          const fy = ry - rowIdx;
          const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
          const isGrout = edge < 0.08;
          const stoneShade = hash2D(Math.floor(rx) % cols, rowIdx % rows, seed + 7);
          mixT = isGrout ? 0.08 : 0.35 + stoneShade * 0.45 + fbm * 0.2;
          h = isGrout ? 0.1 : 0.65 + (Math.min(0.28, edge) / 0.28) * 0.25 + fine * 0.08;
          rVal = isGrout ? 0.95 : 0.68 + stoneShade * 0.18;
          if (isGrout) seamDarken = 0.62;
          break;
        }
        case 'brick': {
          const rows = 8;
          const cols = 4;
          const ry = v * rows;
          const rowIdx = Math.floor(ry);
          const rx = u * cols + (rowIdx % 2 === 1 ? 0.5 : 0);
          const fx = rx - Math.floor(rx);
          const fy = ry - rowIdx;
          const isMortar = fx < 0.055 || fx > 0.945 || fy < 0.1 || fy > 0.9;
          const brickVar = hash2D(Math.floor(rx) % cols, rowIdx % rows, seed + 23);
          mixT = isMortar ? 0.92 : 0.18 + brickVar * 0.4 + fine * 0.15;
          h = isMortar ? 0.15 : 0.72 + fine * 0.14;
          rVal = isMortar ? 0.94 : 0.75 + brickVar * 0.14;
          break;
        }
        case 'wood': {
          const planks = 4;
          const py = v * planks;
          const plankIdx = Math.floor(py);
          const fy = py - plankIdx;
          const plankTint = hash2D(plankIdx, 3, seed + 55);
          const grain = Math.sin((u * 4 + fbm * 1.4) * Math.PI * 6) * 0.5 + 0.5;
          const isSeam = fy < 0.05 || (Math.abs(((u + plankIdx * 0.37) % 1) - 0.5) < 0.015);
          mixT = isSeam ? 0.92 : 0.2 + plankTint * 0.35 + grain * 0.28;
          h = isSeam ? 0.15 : 0.62 + grain * 0.16;
          rVal = isSeam ? 0.92 : 0.5 + grain * 0.22;
          if (isSeam) seamDarken = 0.62;
          break;
        }
        case 'shingle': {
          const rows = 6;
          const cols = 6;
          const ry = v * rows;
          const rowIdx = Math.floor(ry);
          const rx = u * cols + (rowIdx % 2 === 1 ? 0.5 : 0);
          const fx = rx - Math.floor(rx);
          const fy = ry - rowIdx;
          const bevel = Math.min(1, fy * 1.15);
          const edge = fx < 0.04 || fy < 0.07;
          mixT = edge ? 0.85 : 0.2 + bevel * 0.45 + fine * 0.2;
          h = edge ? 0.2 : 0.35 + fy * 0.55;
          rVal = 0.62 + fine * 0.2;
          if (edge) seamDarken = 0.68;
          break;
        }
        case 'tile': {
          const grid = 4;
          const gx = (u * grid) % 1;
          const gy = (v * grid) % 1;
          const grout = gx < 0.045 || gy < 0.045;
          const tileAlt = (Math.floor(u * grid) + Math.floor(v * grid)) % 2;
          mixT = grout ? 0.92 : tileAlt ? 0.32 + fine * 0.06 : 0.08 + fine * 0.06;
          h = grout ? 0.22 : 0.78;
          rVal = grout ? 0.88 : 0.32 + fine * 0.08;
          break;
        }
        case 'sidewalk':
        case 'concrete': {
          const slabs = kind === 'sidewalk' ? 2 : 2;
          const gx = (u * slabs) % 1;
          const gy = (v * slabs) % 1;
          const seam = gx < 0.03 || gy < 0.03;
          mixT = seam ? 0.85 : fbm * 0.45 + fine * 0.15;
          h = seam ? 0.22 : 0.65 + fine * 0.12;
          rVal = seam ? 0.92 : 0.76 + fbm * 0.15;
          if (seam) seamDarken = 0.76;
          break;
        }
        case 'asphalt': {
          mixT = fine * 0.6 + fbm * 0.4;
          h = 0.4 + fine * 0.4;
          rVal = 0.82 + (1 - fine) * 0.12;
          break;
        }
        case 'metal': {
          const brush = valueNoise2D(u * 4, v * 48, 48, seed + 88);
          mixT = 0.25 + brush * 0.45;
          h = 0.5 + brush * 0.18;
          rVal = 0.28 + brush * 0.16;
          break;
        }
        case 'rug': {
          const border = u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88;
          const weave = ((x + y) % 4 < 2 ? 0.15 : 0) + fine * 0.25;
          mixT = border ? 0.78 + weave * 0.2 : 0.18 + weave;
          h = 0.45 + weave * 0.45;
          rVal = 0.9 + fine * 0.08;
          break;
        }
        case 'water': {
          const wave1 = Math.sin((u * 4 + v * 2) * Math.PI * 2) * 0.5 + 0.5;
          const wave2 = Math.cos((u * 2 - v * 5 + fbm * 0.4) * Math.PI * 2) * 0.5 + 0.5;
          const w = 0.5 * wave1 + 0.5 * wave2;
          mixT = 0.2 + w * 0.6;
          h = 0.3 + w * 0.65;
          rVal = 0.14 + (1 - w) * 0.14;
          break;
        }
        case 'plaster':
        default: {
          mixT = 0.25 + fbm * 0.5 + fine * 0.12;
          h = 0.5 + fbm * 0.22;
          rVal = 0.82 + fbm * 0.12;
          break;
        }
      }

      heightField[idx] = h;
      const rCol = (br + (ar - br) * mixT) * seamDarken;
      const gCol = (bg + (ag - bg) * mixT) * seamDarken;
      const bCol = (bb + (ab - bb) * mixT) * seamDarken;

      albedo[p4] = clampByte(rCol);
      albedo[p4 + 1] = clampByte(gCol);
      albedo[p4 + 2] = clampByte(bCol);
      albedo[p4 + 3] = 255;

      const rByte = clampByte(rVal * 255);
      rough[p4] = rByte;
      rough[p4 + 1] = rByte;
      rough[p4 + 2] = rByte;
      rough[p4 + 3] = 255;
    }
  }

  // Sobel-style tangent normal derivation from tileable heightField
  const strength = kind === 'water' ? 2.4 : kind === 'cobble' || kind === 'brick' ? 3.2 : 1.9;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heightField[y * size + xp] - heightField[y * size + xm]) * strength;
      const dy = (heightField[yp * size + x] - heightField[ym * size + x]) * strength;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const p4 = (y * size + x) * 4;
      normal[p4] = clampByte((nx * 0.5 + 0.5) * 255);
      normal[p4 + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normal[p4 + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normal[p4 + 3] = 255;
    }
  }

  const configureTex = (
    data: Uint8Array,
    colorSpace: THREE.ColorSpace
  ): THREE.DataTexture => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = anisotropy;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: configureTex(albedo, THREE.SRGBColorSpace),
    normalMap: configureTex(normal, THREE.NoColorSpace),
    roughnessMap: configureTex(rough, THREE.NoColorSpace),
  };
}

export interface PbrMaterialOptions {
  kind: PbrSurfaceKind;
  baseColor: string;
  accentColor: string;
  repeatX?: number;
  repeatY?: number;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  anisotropy?: number;
  emissive?: string;
  emissiveIntensity?: number;
  polygonOffset?: boolean;
}

export function createPbrMaterial(
  tracker: WorldTracker,
  opts: PbrMaterialOptions
): THREE.MeshStandardMaterial {
  const triplet = buildProceduralTextureTriplet(
    opts.kind,
    opts.baseColor,
    opts.accentColor,
    opts.repeatX ?? 4,
    opts.repeatY ?? 4,
    opts.anisotropy ?? 4
  );
  tracker.track(triplet.map);
  tracker.track(triplet.normalMap);
  tracker.track(triplet.roughnessMap);

  const normalScale = opts.normalScale ?? (opts.kind === 'cobble' || opts.kind === 'brick' ? 0.85 : 0.55);

  const mat = new THREE.MeshStandardMaterial({
    map: triplet.map,
    normalMap: triplet.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: triplet.roughnessMap,
    roughness: opts.roughness ?? 1.0,
    metalness: opts.metalness ?? (opts.kind === 'metal' ? 0.78 : 0.04),
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    polygonOffset: opts.polygonOffset ?? false,
    polygonOffsetFactor: opts.polygonOffset ? -1 : 0,
    polygonOffsetUnits: opts.polygonOffset ? -1 : 0,
  });

  return tracker.track(mat);
}

export function createGlassMaterial(
  tracker: WorldTracker,
  options: {
    tintColor?: string;
    emissiveColor?: string;
    emissiveIntensity?: number;
    opacity?: number;
    isSoftwareGl?: boolean;
  }
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const emissive = options.emissiveColor ?? '#1e293b';
  const emissiveInt = options.emissiveIntensity ?? 0.2;
  const opacity = options.opacity ?? 0.72;

  if (options.isSoftwareGl) {
    return tracker.track(
      new THREE.MeshStandardMaterial({
        color: options.tintColor ?? '#7dd3fc',
        emissive,
        emissiveIntensity: emissiveInt,
        roughness: 0.16,
        metalness: 0.35,
        transparent: opacity < 0.99,
        opacity,
      })
    );
  }

  return tracker.track(
    new THREE.MeshPhysicalMaterial({
      color: options.tintColor ?? '#bae6fd',
      emissive,
      emissiveIntensity: emissiveInt,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
      transparent: opacity < 0.99,
      opacity,
    })
  );
}
