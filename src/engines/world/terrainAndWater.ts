import * as THREE from 'three';
import {
  createPbrMaterial,
  createSeededRng,
  type WorldTracker,
} from './pbrMaterials';
import type { EnvironmentType, SceneWeather, TimeOfDay } from '../../types/story';

export interface TerrainBuildResult {
  group: THREE.Group;
  groundHeightAt: (x: number, z: number) => number;
  updateWater: (timeSec: number) => void;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function sampleTerrainHeight(
  x: number,
  z: number,
  biome: EnvironmentType
): number {
  // Keep central actor staging pad cleanly walkable at y = 0
  const padX = smoothstep(3.5, 6.8, Math.abs(x));
  const padZ = smoothstep(2.4, 5.4, Math.abs(z));
  const stageMask = Math.max(padX, padZ);
  if (stageMask <= 0.001) return 0;

  // Keep camera corridor (+Z center) gently sloped low so foreground terrain never blocks low angles
  const frontCameraClear = z > 1.8 && Math.abs(x) < 6.4 ? smoothstep(6.4, 11.0, Math.abs(x)) : 1.0;

  if (biome === 'forest_park') {
    const hillWave =
      Math.sin(x * 0.14 + 0.4) * Math.cos(z * 0.12 - 0.3) * 1.65 +
      Math.sin(x * 0.07 - z * 0.09) * 2.1;
    const perimeterRise = smoothstep(10, 34, Math.hypot(x, z)) * 3.8;
    // Carve natural creek/pond channel along back-left to right-back (z around -6.2)
    const streamCenterZ = -6.2 + Math.sin(x * 0.18) * 1.4;
    const distToStream = Math.abs(z - streamCenterZ);
    const streamCarve = (1 - smoothstep(1.3, 3.6, distToStream)) * 1.15;
    const h = Math.max(-0.62, (Math.max(-0.2, hillWave) + perimeterRise) * stageMask * frontCameraClear - streamCarve);
    return h;
  }

  if (biome === 'town_square') {
    // Gentle rolling village hills around outer perimeter + sunken brook on left-back
    const hill =
      (Math.sin(x * 0.11) * Math.cos(z * 0.11) * 1.1 +
        smoothstep(13, 36, Math.hypot(x, z)) * 2.9) *
      stageMask *
      frontCameraClear;
    const pondDist = Math.hypot(x + 7.2, z + 5.8);
    const pondCarve = (1 - smoothstep(2.2, 4.4, pondDist)) * 0.85;
    return Math.max(-0.55, hill - pondCarve);
  }

  if (biome === 'suburban_street') {
    // Flat street corridor along z in [-5, 4], rolling grassy hills further back
    const corridorClear = smoothstep(5.8, 12.5, Math.abs(z));
    const gentleHill =
      (Math.sin(x * 0.13 + 1.0) * 0.75 + smoothstep(16, 38, Math.hypot(x, z)) * 2.4) *
      corridorClear *
      frontCameraClear;
    return Math.max(0, gentleHill);
  }

  if (biome === 'city_street' || biome === 'sci_fi_plaza') {
    return 0;
  }

  return 0;
}

export function buildOutdoorTerrainAndWater(
  tracker: WorldTracker,
  envType: EnvironmentType,
  timeOfDay: TimeOfDay,
  weather: SceneWeather | undefined,
  seed: string,
  isSoftwareGl: boolean
): TerrainBuildResult {
  const group = new THREE.Group();
  group.name = `terrain_${envType}`;

  const rng = createSeededRng(`${seed}_${envType}_terrain`);
  const isWet = weather === 'rain' || weather === 'storm';
  const size = 96;
  const segs = isSoftwareGl ? 56 : 84;

  const groundGeo = tracker.track(new THREE.PlaneGeometry(size, size, segs, segs));
  groundGeo.rotateX(-Math.PI / 2);

  const posAttr = groundGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);

  const colGrass = new THREE.Color(
    envType === 'forest_park'
      ? timeOfDay === 'night'
        ? '#1a4231'
        : '#2f6f44'
      : '#3b7a4c'
  );
  const colGrassLush = new THREE.Color(envType === 'forest_park' ? '#255c37' : '#4a8c57');
  const colSand = new THREE.Color('#c8b083');
  const colRock = new THREE.Color('#64748b');
  const colSoil = new THREE.Color('#6b4f35');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const h = sampleTerrainHeight(x, z, envType);
    posAttr.setY(i, h);

    // Biome vertex-color terrain blending (soil near paths/banks, sand near water, rocky slopes on high hills)
    const hillBlend = smoothstep(1.1, 3.2, h);
    const waterEdge = smoothstep(0.05, -0.35, h);
    const grassMix = 0.5 + 0.5 * Math.sin(x * 0.25 + z * 0.22);

    tmpColor.copy(colGrass).lerp(colGrassLush, grassMix);
    if (waterEdge > 0.01) {
      tmpColor.lerp(h < -0.2 ? colSoil : colSand, waterEdge * 0.85);
    }
    if (hillBlend > 0.01) {
      tmpColor.lerp(colRock, hillBlend * 0.72);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();

  let groundMat: THREE.MeshStandardMaterial;
  if (envType === 'sci_fi_plaza') {
    groundMat = createPbrMaterial(tracker, {
      kind: 'concrete',
      baseColor: '#111827',
      accentColor: '#1e293b',
      repeatX: 20,
      repeatY: 20,
      roughness: isWet ? 0.28 : 0.42,
      metalness: 0.48,
    });
  } else if (envType === 'city_street') {
    groundMat = createPbrMaterial(tracker, {
      kind: 'sidewalk',
      baseColor: '#475569',
      accentColor: '#334155',
      repeatX: 22,
      repeatY: 22,
      roughness: isWet ? 0.35 : 0.82,
    });
  } else {
    groundMat = createPbrMaterial(tracker, {
      kind: 'grass',
      baseColor: '#ffffff',
      accentColor: '#dce7d8',
      repeatX: 26,
      repeatY: 26,
      roughness: isWet ? 0.48 : 0.94,
    });
    groundMat.vertexColors = true;
  }

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.name = 'sculpted_terrain';
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  let waterMesh: THREE.Mesh | null = null;
  let waterBasePositions: Float32Array | null = null;
  let waterMaterial: THREE.MeshStandardMaterial | null = null;

  // Roads, cobblestone plazas, dirt/stone trails & water features
  if (envType === 'town_square') {
    // Cobblestone plaza pad + stepped stone apron + village road
    const cobbleMat = createPbrMaterial(tracker, {
      kind: 'cobble',
      baseColor: '#94a3b8',
      accentColor: '#64748b',
      repeatX: 7,
      repeatY: 5,
      roughness: isWet ? 0.36 : 0.8,
      polygonOffset: true,
    });
    const plaza = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(15.5, 0.08, 7.6)), cobbleMat);
    plaza.position.set(0, 0.02, -0.4);
    plaza.receiveShadow = true;
    group.add(plaza);

    // Dressed stone plaza border curb
    const curbMat = createPbrMaterial(tracker, {
      kind: 'cobble',
      baseColor: '#cbd5e1',
      accentColor: '#94a3b8',
      repeatX: 6,
      repeatY: 1,
      roughness: 0.78,
    });
    const backCurb = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(15.9, 0.14, 0.35)), curbMat);
    backCurb.position.set(0, 0.05, -4.25);
    backCurb.receiveShadow = true;
    group.add(backCurb);

    // Winding stone walkway to left/right
    const laneMat = createPbrMaterial(tracker, {
      kind: 'cobble',
      baseColor: '#78716c',
      accentColor: '#57534e',
      repeatX: 12,
      repeatY: 2,
      roughness: isWet ? 0.38 : 0.84,
      polygonOffset: true,
    });
    const crossRoad = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(46, 0.06, 3.6)), laneMat);
    crossRoad.position.set(0, 0.015, 0.1);
    crossRoad.receiveShadow = true;
    group.add(crossRoad);

    // Village duck pond & stone embankment in back-left (-7.2, -5.8)
    waterMaterial = createPbrMaterial(tracker, {
      kind: 'water',
      baseColor: timeOfDay === 'night' ? '#0c4a6e' : '#0284c7',
      accentColor: timeOfDay === 'sunset' ? '#38bdf8' : '#7dd3fc',
      repeatX: 3,
      repeatY: 3,
      roughness: 0.14,
      metalness: 0.28,
    });
    waterMaterial.transparent = true;
    waterMaterial.opacity = 0.88;

    const pondGeo = tracker.track(new THREE.CircleGeometry(3.7, 28));
    pondGeo.rotateX(-Math.PI / 2);
    waterMesh = new THREE.Mesh(pondGeo, waterMaterial);
    waterMesh.position.set(-7.2, -0.14, -5.8);
    waterMesh.receiveShadow = true;
    group.add(waterMesh);
  } else if (envType === 'suburban_street' || envType === 'city_street') {
    // Asphalt road + double yellow dashed centerline + crosswalk + concrete sidewalks with curbs
    const asphaltMat = createPbrMaterial(tracker, {
      kind: 'asphalt',
      baseColor: '#1f2937',
      accentColor: '#374151',
      repeatX: 14,
      repeatY: 3,
      roughness: isWet ? 0.32 : 0.86,
      polygonOffset: true,
    });
    const road = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(58, 0.06, 5.4)), asphaltMat);
    road.position.set(0, 0.01, 0.1);
    road.receiveShadow = true;
    group.add(road);

    const stripeMat = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.65 })
    );
    const whiteStripeMat = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.65 })
    );
    for (let sx = -24; sx <= 24; sx += 3.2) {
      const dash = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.5, 0.02, 0.14)), stripeMat);
      dash.position.set(sx, 0.045, 0.1);
      group.add(dash);
    }

    if (envType === 'city_street') {
      // Crosswalk bars
      for (let cz = -2.0; cz <= 2.2; cz += 0.65) {
        const bar = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(1.9, 0.02, 0.32)),
          whiteStripeMat
        );
        bar.position.set(-4.6, 0.046, cz);
        group.add(bar);
      }
    }

    const sidewalkMat = createPbrMaterial(tracker, {
      kind: 'sidewalk',
      baseColor: '#cbd5e1',
      accentColor: '#94a3b8',
      repeatX: 18,
      repeatY: 2,
      roughness: isWet ? 0.4 : 0.82,
    });
    const swBack = new THREE.Mesh(
      tracker.track(new THREE.BoxGeometry(58, 0.14, 3.0)),
      sidewalkMat
    );
    swBack.position.set(0, 0.06, -4.1);
    swBack.receiveShadow = true;
    group.add(swBack);

    const curbMesh = new THREE.Mesh(
      tracker.track(new THREE.BoxGeometry(58, 0.16, 0.24)),
      createPbrMaterial(tracker, {
        kind: 'concrete',
        baseColor: '#94a3b8',
        accentColor: '#64748b',
        repeatX: 20,
        repeatY: 1,
        roughness: 0.85,
      })
    );
    curbMesh.position.set(0, 0.07, -2.6);
    curbMesh.receiveShadow = true;
    group.add(curbMesh);
  } else if (envType === 'forest_park') {
    // Winding packed dirt & stepping-stone trail across central clearing + wooden bridge over stream
    const soilMat = createPbrMaterial(tracker, {
      kind: 'soil',
      baseColor: '#855836',
      accentColor: '#5c3c24',
      repeatX: 10,
      repeatY: 2,
      roughness: isWet ? 0.45 : 0.94,
      polygonOffset: true,
    });

    const pathSegments = 18;
    for (let i = 0; i < pathSegments; i++) {
      const t = i / (pathSegments - 1);
      const px = THREE.MathUtils.lerp(-18, 18, t);
      const pz = Math.sin(px * 0.18) * 0.55;
      const yaw = -Math.atan(0.18 * 0.55 * Math.cos(px * 0.18));
      const segMesh = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.5, 0.05, 2.7)), soilMat);
      segMesh.position.set(px, 0.015, pz);
      segMesh.rotation.y = yaw;
      segMesh.receiveShadow = true;
      group.add(segMesh);
    }

    // Stepping stones scattered neatly along trail edges
    const stoneMat = createPbrMaterial(tracker, {
      kind: 'cobble',
      baseColor: '#94a3b8',
      accentColor: '#64748b',
      repeatX: 1,
      repeatY: 1,
      roughness: 0.85,
    });
    for (let i = 0; i < 14; i++) {
      const sx = -10 + i * 1.55 + (rng() - 0.5) * 0.4;
      const sz = Math.sin(sx * 0.18) * 0.55 + (rng() - 0.5) * 1.5;
      const pebble = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.22 + rng() * 0.14, 0.26 + rng() * 0.14, 0.07, 7)),
        stoneMat
      );
      pebble.position.set(sx, 0.035, sz);
      pebble.rotation.y = rng() * Math.PI;
      pebble.receiveShadow = true;
      group.add(pebble);
    }

    // Forest stream / creek behind clearing (z ≈ -6.2) with animated ripple water mesh
    const streamGeo = tracker.track(new THREE.PlaneGeometry(52, 4.4, 48, 8));
    streamGeo.rotateX(-Math.PI / 2);
    const sPos = streamGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sPos.count; i++) {
      const vx = sPos.getX(i);
      const vz = sPos.getZ(i);
      sPos.setZ(i, vz + Math.sin(vx * 0.18) * 1.4 - 6.2);
    }
    streamGeo.computeVertexNormals();
    waterBasePositions = new Float32Array(sPos.array as Float32Array);

    waterMaterial = createPbrMaterial(tracker, {
      kind: 'water',
      baseColor: timeOfDay === 'night' ? '#0c4a6e' : '#0ea5e9',
      accentColor: timeOfDay === 'sunset' ? '#fb923c' : '#bae6fd',
      repeatX: 12,
      repeatY: 2,
      roughness: 0.14,
      metalness: 0.28,
    });
    waterMaterial.transparent = true;
    waterMaterial.opacity = 0.86;

    waterMesh = new THREE.Mesh(streamGeo, waterMaterial);
    waterMesh.position.y = -0.18;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Arched timber footbridge crossing stream in background right-center (x = 3.2, z = -5.4)
    const bridge = new THREE.Group();
    const bz = Math.sin(3.2 * 0.18) * 1.4 - 6.2;
    bridge.position.set(3.2, 0.05, bz);
    const timberMat = createPbrMaterial(tracker, {
      kind: 'wood',
      baseColor: '#7c4a27',
      accentColor: '#522f17',
      repeatX: 2,
      repeatY: 2,
      roughness: 0.78,
    });
    for (let p = -3; p <= 3; p++) {
      const plank = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.1, 0.1, 0.52)), timberMat);
      const archY = Math.cos((p / 3.4) * (Math.PI / 2)) * 0.36;
      plank.position.set(0, archY, p * 0.58);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridge.add(plank);
    }
    for (const side of [-0.95, 0.95]) {
      for (const pz of [-1.6, 0, 1.6]) {
        const post = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.14, 0.95, 0.14)), timberMat);
        post.position.set(side, 0.52, pz);
        post.castShadow = true;
        bridge.add(post);
      }
      const rail = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.1, 0.1, 3.6)), timberMat);
      rail.position.set(side, 0.95, 0);
      bridge.add(rail);
    }
    group.add(bridge);
  } else if (envType === 'sci_fi_plaza') {
    // Glowing tech plaza walkway + shallow reflective pool
    const walkwayMat = createPbrMaterial(tracker, {
      kind: 'metal',
      baseColor: '#1e293b',
      accentColor: '#334155',
      repeatX: 10,
      repeatY: 4,
      roughness: 0.32,
      metalness: 0.72,
      polygonOffset: true,
    });
    const deck = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(16, 0.08, 6.4)), walkwayMat);
    deck.position.set(0, 0.02, -0.2);
    deck.receiveShadow = true;
    group.add(deck);

    const trimMat = tracker.track(
      new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 1.5,
        roughness: 0.2,
      })
    );
    for (const tz of [-3.3, 2.9]) {
      const strip = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(16, 0.09, 0.12)), trimMat);
      strip.position.set(0, 0.03, tz);
      group.add(strip);
    }

    waterMaterial = createPbrMaterial(tracker, {
      kind: 'water',
      baseColor: '#083344',
      accentColor: '#22d3ee',
      repeatX: 4,
      repeatY: 2,
      roughness: 0.12,
      metalness: 0.45,
    });
    const pool = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(11, 0.06, 2.1)), waterMaterial);
    pool.position.set(0, 0.04, -5.6);
    group.add(pool);
  }

  return {
    group,
    groundHeightAt: (x: number, z: number) => sampleTerrainHeight(x, z, envType),
    updateWater: (timeSec: number) => {
      if (waterMaterial?.normalMap) {
        waterMaterial.normalMap.offset.x = (timeSec * 0.045) % 1;
        waterMaterial.normalMap.offset.y = (timeSec * 0.025) % 1;
      }
      if (waterMaterial?.map) {
        waterMaterial.map.offset.x = (timeSec * 0.02) % 1;
      }
      if (waterMesh && waterBasePositions) {
        const pos = waterMesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const bx = waterBasePositions[i * 3];
          const bz = waterBasePositions[i * 3 + 2];
          pos.setY(i, Math.sin(bx * 0.8 + timeSec * 2.1) * 0.03 + Math.cos(bz * 1.1 + timeSec * 1.6) * 0.02);
        }
        pos.needsUpdate = true;
      }
    },
  };
}
