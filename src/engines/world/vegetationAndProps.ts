import * as THREE from 'three';
import {
  createPbrMaterial,
  createSeededRng,
  type WorldTracker,
} from './pbrMaterials';
import { sampleTerrainHeight } from './terrainAndWater';
import type { EnvironmentType, TimeOfDay } from '../../types/story';

export type TreeSpecies = 'oak' | 'pine' | 'birch' | 'autumn';

export interface VegetationBuildResult {
  group: THREE.Group;
  instancedMeshes: THREE.InstancedMesh[];
  updateSway: (timeSec: number, windStrength: number) => void;
}

export function isClearOfCameraCorridor(x: number, z: number): boolean {
  // Never place foreground tall obstacles in +Z camera lane facing origin
  if (z > 1.2 && z < 15.0 && Math.abs(x) < 6.0) return false;
  // Also keep central character acting pad clean
  if (Math.abs(x) < 3.45 && Math.abs(z) < 2.25) return false;
  return true;
}

export function buildStylizedTree(
  tracker: WorldTracker,
  species: TreeSpecies,
  x: number,
  y: number,
  z: number,
  scale: number,
  yaw: number,
  swayTargets: THREE.Object3D[],
  useLod = true
): THREE.Object3D {
  const highDetail = new THREE.Group();

  const barkColor =
    species === 'birch' ? '#e2e8f0' : species === 'pine' ? '#4a2c16' : '#6b3e1f';
  const barkAccent =
    species === 'birch' ? '#475569' : '#3d220e';
  const trunkMat = createPbrMaterial(tracker, {
    kind: 'wood',
    baseColor: barkColor,
    accentColor: barkAccent,
    repeatX: 1,
    repeatY: 3,
    roughness: 0.88,
  });

  if (species === 'pine') {
    const trunk = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.14, 0.28, 2.2, 7)),
      trunkMat
    );
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    highDetail.add(trunk);

    const crown = new THREE.Group();
    crown.position.y = 1.5;
    const pineDark = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.85, flatShading: true })
    );
    const pineMid = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.82, flatShading: true })
    );
    const tiers = [
      { r: 1.45, h: 1.75, y: 0.85, mat: pineDark },
      { r: 1.15, h: 1.55, y: 1.85, mat: pineMid },
      { r: 0.78, h: 1.35, y: 2.75, mat: pineDark },
    ];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const cone = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(t.r, t.h, 7)), t.mat);
      cone.position.y = t.y;
      cone.rotation.y = i * 0.45;
      cone.castShadow = true;
      crown.add(cone);
    }
    highDetail.add(crown);
    swayTargets.push(crown);
  } else {
    const trunk = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.18, 0.34, 2.35, 7)),
      trunkMat
    );
    trunk.position.y = 1.15;
    trunk.castShadow = true;
    highDetail.add(trunk);

    // Side limb fork for organic silhouette
    const limb = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.08, 0.14, 1.05, 6)),
      trunkMat
    );
    limb.position.set(0.32, 1.75, 0.1);
    limb.rotation.z = -0.65;
    highDetail.add(limb);

    const crown = new THREE.Group();
    crown.position.y = 2.65;
    const leafHexA =
      species === 'autumn' ? '#ea580c' : species === 'birch' ? '#65a30d' : '#16a34a';
    const leafHexB =
      species === 'autumn' ? '#d97706' : species === 'birch' ? '#84cc16' : '#15803d';

    const matA = tracker.track(
      new THREE.MeshStandardMaterial({ color: leafHexA, roughness: 0.78, flatShading: true })
    );
    const matB = tracker.track(
      new THREE.MeshStandardMaterial({ color: leafHexB, roughness: 0.82, flatShading: true })
    );

    const lobes: Array<[number, number, number, number, boolean]> = [
      [0, 0.35, 0, 1.25, true],
      [-0.78, -0.05, 0.35, 0.86, false],
      [0.82, 0.05, -0.25, 0.9, true],
      [0.15, 0.15, 0.78, 0.82, false],
      [-0.25, 0.95, -0.15, 0.78, true],
    ];
    for (const [lx, ly, lz, lr, useA] of lobes) {
      const puff = new THREE.Mesh(
        tracker.track(new THREE.IcosahedronGeometry(lr, 1)),
        useA ? matA : matB
      );
      puff.position.set(lx, ly, lz);
      puff.castShadow = true;
      crown.add(puff);
    }
    highDetail.add(crown);
    swayTargets.push(crown);
  }

  let container: THREE.Object3D = highDetail;
  if (useLod) {
    const lod = new THREE.LOD();
    lod.addLevel(highDetail, 0);

    // Simplified distant tree LOD (2 primitives)
    const lowDetail = new THREE.Group();
    const simpleTrunk = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.18, 0.28, 2.1, 5)),
      trunkMat
    );
    simpleTrunk.position.y = 1.05;
    const simpleColor =
      species === 'pine' ? '#14532d' : species === 'autumn' ? '#d97706' : '#16a34a';
    const simpleCrown = new THREE.Mesh(
      tracker.track(
        species === 'pine'
          ? new THREE.ConeGeometry(1.35, 2.9, 6)
          : new THREE.IcosahedronGeometry(1.4, 0)
      ),
      tracker.track(new THREE.MeshStandardMaterial({ color: simpleColor, roughness: 0.85 }))
    );
    simpleCrown.position.y = species === 'pine' ? 2.6 : 2.95;
    lowDetail.add(simpleTrunk, simpleCrown);
    lod.addLevel(lowDetail, 22);
    container = lod;
  }

  container.position.set(x, y, z);
  container.rotation.y = yaw;
  container.scale.setScalar(scale);
  return container;
}

export function buildStreetLamp(
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  timeOfDay: TimeOfDay,
  castPointLight = false
): THREE.Group {
  const lamp = new THREE.Group();
  lamp.position.set(x, y, z);

  const ironMat = createPbrMaterial(tracker, {
    kind: 'metal',
    baseColor: '#1e293b',
    accentColor: '#0f172a',
    repeatX: 1,
    repeatY: 2,
    roughness: 0.35,
    metalness: 0.8,
  });

  const plinth = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 8)), ironMat);
  plinth.position.y = 0.225;
  const pole = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.07, 0.11, 3.4, 8)), ironMat);
  pole.position.y = 1.9;
  pole.castShadow = true;
  const crossArm = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.75, 0.08, 0.08)), ironMat);
  crossArm.position.set(0.3, 3.55, 0);

  const isLit = timeOfDay === 'night' || timeOfDay === 'sunset';
  const lanternCap = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(0.28, 0.2, 6)), ironMat);
  lanternCap.position.set(0.58, 3.65, 0);
  const bulb = new THREE.Mesh(
    tracker.track(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 6)),
    tracker.track(
      new THREE.MeshStandardMaterial({
        color: '#fef9c3',
        emissive: '#f59e0b',
        emissiveIntensity: isLit ? 2.2 : 0.18,
        roughness: 0.2,
      })
    )
  );
  bulb.position.set(0.58, 3.42, 0);

  lamp.add(plinth, pole, crossArm, lanternCap, bulb);

  if (castPointLight && isLit) {
    const pt = new THREE.PointLight('#fbbf24', timeOfDay === 'night' ? 4.5 : 2.2, 11, 1.8);
    pt.position.set(0.58, 3.25, 0);
    lamp.add(pt);
  }

  return lamp;
}

export function buildParkBench(
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  yaw = 0
): THREE.Group {
  const bench = new THREE.Group();
  bench.position.set(x, y, z);
  bench.rotation.y = yaw;

  const woodMat = createPbrMaterial(tracker, {
    kind: 'wood',
    baseColor: '#92400e',
    accentColor: '#78350f',
    repeatX: 2,
    repeatY: 1,
    roughness: 0.7,
  });
  const ironMat = createPbrMaterial(tracker, {
    kind: 'metal',
    baseColor: '#1e293b',
    accentColor: '#0f172a',
    repeatX: 1,
    repeatY: 1,
  });

  const seat = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.0, 0.08, 0.56)), woodMat);
  seat.position.set(0, 0.44, 0);
  seat.castShadow = true;
  const back = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.0, 0.42, 0.08)), woodMat);
  back.position.set(0, 0.78, -0.24);
  back.rotation.x = -0.14;
  back.castShadow = true;

  for (const lx of [-0.82, 0.82]) {
    const leg = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.1, 0.45, 0.52)), ironMat);
    leg.position.set(lx, 0.225, 0);
    const arm = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 0.22, 0.52)), ironMat);
    arm.position.set(lx, 0.56, 0);
    bench.add(leg, arm);
  }
  bench.add(seat, back);
  return bench;
}

export function buildStoneFountain(
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  timeOfDay: TimeOfDay
): THREE.Group {
  const f = new THREE.Group();
  f.position.set(x, y, z);

  const stoneMat = createPbrMaterial(tracker, {
    kind: 'cobble',
    baseColor: '#cbd5e1',
    accentColor: '#94a3b8',
    repeatX: 3,
    repeatY: 1,
    roughness: 0.72,
  });
  const waterMat = createPbrMaterial(tracker, {
    kind: 'water',
    baseColor: timeOfDay === 'night' ? '#0369a1' : '#0ea5e9',
    accentColor: '#bae6fd',
    repeatX: 2,
    repeatY: 2,
    roughness: 0.12,
    metalness: 0.3,
  });

  const rim = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(1.75, 1.9, 0.42, 16)), stoneMat);
  rim.position.y = 0.21;
  rim.castShadow = true;
  rim.receiveShadow = true;

  const pool = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(1.5, 1.5, 0.34, 16)), waterMat);
  pool.position.y = 0.28;

  const pillar = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.34, 0.48, 1.15, 12)), stoneMat);
  pillar.position.y = 0.75;
  const bowl = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.88, 0.45, 0.24, 14)), stoneMat);
  bowl.position.y = 1.32;
  const finial = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.14, 0.22, 0.6, 10)), stoneMat);
  finial.position.y = 1.65;
  const splash = new THREE.Mesh(
    tracker.track(new THREE.SphereGeometry(0.24, 10, 8)),
    tracker.track(
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#38bdf8',
        emissiveIntensity: 0.25,
        roughness: 0.2,
      })
    )
  );
  splash.position.y = 2.02;

  f.add(rim, pool, pillar, bowl, finial, splash);
  return f;
}

export function buildFenceRun(
  tracker: WorldTracker,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  postsCount: number,
  biome: EnvironmentType
): THREE.Group {
  const fence = new THREE.Group();
  const mat = createPbrMaterial(tracker, {
    kind: 'wood',
    baseColor: biome === 'suburban_street' ? '#f8fafc' : '#854d0e',
    accentColor: biome === 'suburban_street' ? '#cbd5e1' : '#522f17',
    repeatX: 2,
    repeatY: 1,
    roughness: 0.78,
  });

  const dx = endX - startX;
  const dz = endZ - startZ;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);

  for (let i = 0; i < postsCount; i++) {
    const t = postsCount === 1 ? 0 : i / (postsCount - 1);
    const px = startX + dx * t;
    const pz = startZ + dz * t;
    const py = sampleTerrainHeight(px, pz, biome);
    const post = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.14, 0.92, 0.14)), mat);
    post.position.set(px, py + 0.46, pz);
    post.castShadow = true;
    fence.add(post);
  }

  for (const ry of [0.32, 0.72]) {
    const rail = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 0.09, len)), mat);
    const midY = sampleTerrainHeight((startX + endX) * 0.5, (startZ + endZ) * 0.5, biome);
    rail.position.set((startX + endX) * 0.5, midY + ry, (startZ + endZ) * 0.5);
    rail.rotation.y = yaw;
    fence.add(rail);
  }

  return fence;
}

export function buildInstancedNatureScatter(
  tracker: WorldTracker,
  envType: EnvironmentType,
  seed: string,
  isSoftwareGl: boolean
): VegetationBuildResult {
  const group = new THREE.Group();
  group.name = `nature_scatter_${envType}`;
  const instancedMeshes: THREE.InstancedMesh[] = [];
  const swayTargets: THREE.Object3D[] = [];
  const rng = createSeededRng(`${seed}_${envType}_nature`);

  if (envType === 'sci_fi_plaza') {
    return { group, instancedMeshes, updateSway: () => {} };
  }

  const grassCount =
    envType === 'forest_park'
      ? isSoftwareGl
        ? 110
        : 220
      : envType === 'town_square'
        ? isSoftwareGl
          ? 70
          : 130
        : envType === 'suburban_street'
          ? isSoftwareGl
            ? 50
            : 100
          : 0;

  if (grassCount > 0) {
    const grassGeo = tracker.track(new THREE.ConeGeometry(0.13, 0.46, 4));
    grassGeo.translate(0, 0.23, 0);
    const grassMat = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, flatShading: true })
    );
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    let placed = 0;
    let attempts = 0;
    while (placed < grassCount && attempts < grassCount * 5) {
      attempts++;
      const gx = (rng() - 0.5) * 42;
      const gz = (rng() - 0.5) * 34 - 4;
      if (Math.abs(gx) < 3.6 && Math.abs(gz) < 2.5) continue;
      if (envType === 'suburban_street' && Math.abs(gz) < 4.5) continue;
      if (envType === 'town_square' && Math.abs(gx) < 8.2 && gz > -4.6 && gz < 3.5) continue;
      const gy = sampleTerrainHeight(gx, gz, envType);
      if (gy < -0.1) continue;

      dummy.position.set(gx, gy, gz);
      dummy.rotation.set((rng() - 0.5) * 0.22, rng() * Math.PI * 2, (rng() - 0.5) * 0.22);
      const s = 0.78 + rng() * 0.55;
      dummy.scale.set(s, s * (0.85 + rng() * 0.45), s);
      dummy.updateMatrix();
      grassInst.setMatrixAt(placed, dummy.matrix);

      color.setHSL(0.28 + rng() * 0.08, 0.48 + rng() * 0.16, 0.26 + rng() * 0.18);
      grassInst.setColorAt(placed, color);
      placed++;
    }
    grassInst.count = placed;
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    group.add(grassInst);
    instancedMeshes.push(grassInst);
  }

  // Faceted rocks & boulders (InstancedMesh)
  const rockCount =
    envType === 'forest_park' ? 28 : envType === 'town_square' ? 14 : 6;
  const rockGeo = tracker.track(new THREE.DodecahedronGeometry(0.55, 0));
  const rockMat = createPbrMaterial(tracker, {
    kind: 'cobble',
    baseColor: '#cbd5e1',
    accentColor: '#64748b',
    repeatX: 1,
    repeatY: 1,
    roughness: 0.9,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const rDummy = new THREE.Object3D();
  const rColor = new THREE.Color();
  let rPlaced = 0;
  for (let i = 0; i < rockCount * 3 && rPlaced < rockCount; i++) {
    const rx = (rng() - 0.5) * 32;
    const rz = -3.4 - rng() * 14;
    if (!isClearOfCameraCorridor(rx, rz)) continue;
    const ry = sampleTerrainHeight(rx, rz, envType);
    const sx = 0.65 + rng() * 0.85;
    const sy = 0.45 + rng() * 0.65;
    const sz = 0.65 + rng() * 0.85;
    rDummy.position.set(rx, ry + sy * 0.26, rz);
    rDummy.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    rDummy.scale.set(sx, sy, sz);
    rDummy.updateMatrix();
    rockInst.setMatrixAt(rPlaced, rDummy.matrix);
    rColor.setHSL(0.58, 0.08, 0.48 + rng() * 0.24);
    rockInst.setColorAt(rPlaced, rColor);
    rPlaced++;
  }
  rockInst.count = rPlaced;
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);
  instancedMeshes.push(rockInst);

  // Wildflowers (InstancedMesh) in park & village edges
  if (envType === 'forest_park' || envType === 'town_square' || envType === 'suburban_street') {
    const flowerCount = isSoftwareGl ? 36 : 72;
    const flowerGeo = tracker.track(new THREE.DodecahedronGeometry(0.11, 0));
    flowerGeo.translate(0, 0.25, 0);
    const flowerMat = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 })
    );
    const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    const fDummy = new THREE.Object3D();
    const fCol = new THREE.Color();
    const palette = ['#f43f5e', '#facc15', '#a855f7', '#fb923c', '#f8fafc'];
    let fPlaced = 0;
    for (let i = 0; i < flowerCount * 3 && fPlaced < flowerCount; i++) {
      const fx = (rng() - 0.5) * 28;
      const fz = -2.8 - rng() * 11;
      if (!isClearOfCameraCorridor(fx, fz)) continue;
      if (envType === 'town_square' && Math.abs(fx) < 7.6 && fz > -4.3) continue;
      const fy = sampleTerrainHeight(fx, fz, envType);
      if (fy < -0.05) continue;
      fDummy.position.set(fx, fy, fz);
      fDummy.rotation.y = rng() * Math.PI * 2;
      fDummy.scale.setScalar(0.8 + rng() * 0.5);
      fDummy.updateMatrix();
      flowerInst.setMatrixAt(fPlaced, fDummy.matrix);
      fCol.set(palette[Math.floor(rng() * palette.length)]);
      flowerInst.setColorAt(fPlaced, fCol);
      fPlaced++;
    }
    flowerInst.count = fPlaced;
    flowerInst.instanceMatrix.needsUpdate = true;
    if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
    flowerInst.computeBoundingSphere();
    group.add(flowerInst);
    instancedMeshes.push(flowerInst);
  }

  return {
    group,
    instancedMeshes,
    updateSway: (timeSec: number, windStrength: number) => {
      for (let i = 0; i < swayTargets.length; i++) {
        const target = swayTargets[i];
        target.rotation.z = Math.sin(timeSec * 1.4 + i * 1.1) * 0.03 * windStrength;
      }
    },
  };
}
