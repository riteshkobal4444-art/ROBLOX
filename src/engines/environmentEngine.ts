import * as THREE from 'three';
import {
  createSeededRng,
  createWorldTracker,
  type WorldTracker,
} from './world/pbrMaterials';
import {
  buildOutdoorTerrainAndWater,
  sampleTerrainHeight,
} from './world/terrainAndWater';
import { buildArchitecturalBuilding } from './world/buildings';
import {
  buildFenceRun,
  buildInstancedNatureScatter,
  buildParkBench,
  buildStoneFountain,
  buildStreetLamp,
  buildStylizedTree,
  isClearOfCameraCorridor,
  type TreeSpecies,
} from './world/vegetationAndProps';
import { buildDetailedInterior } from './world/interiors';
import {
  buildAtmosphereAndLighting,
  isIndoorBiome,
} from './world/atmosphereAndLighting';
import {
  instantiateExperimentAsset,
  mountRegisteredAsset,
  preloadBuiltinGlbAssets,
  type ExplicitImportedPlacement,
} from './world/assetRegistry';
import type {
  EnvironmentType,
  SceneMood,
  SceneWeather,
  TimeOfDay,
} from '../types/story';

export interface BuildEnvironmentOptions {
  weather?: SceneWeather;
  mood?: SceneMood;
  seed?: string;
  isSoftwareGl?: boolean;
  explicitImportedAssets?: ExplicitImportedPlacement[];
}

export interface BuiltEnvironment {
  group: THREE.Group;
  skyColor: THREE.Color;
  fogDensity: number;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  disposables: Array<{ dispose: () => void }>;
  update?: (timeSec: number, deltaSec: number) => void;
  groundHeightAt?: (x: number, z: number) => number;
  _disposedRef?: { value: boolean };
}

export async function preloadEnvironmentAssets(): Promise<void> {
  await preloadBuiltinGlbAssets();
}

export function buildEnvironment(
  envType: EnvironmentType,
  timeOfDay: TimeOfDay,
  options: BuildEnvironmentOptions = {}
): BuiltEnvironment {
  const tracker: WorldTracker = createWorldTracker();
  const seed = options.seed ?? `${envType}_default_world`;
  const isSoftwareGl = options.isSoftwareGl ?? false;
  const disposedRef = { value: false };
  const rng = createSeededRng(`${seed}_${envType}`);

  const group = new THREE.Group();
  group.name = `env_${envType}`;

  const atmosphere = buildAtmosphereAndLighting(
    tracker,
    envType,
    timeOfDay,
    options.weather,
    options.mood,
    seed,
    isSoftwareGl
  );
  group.add(atmosphere.group);

  const swayTargets: THREE.Object3D[] = [];
  const activeMixers: THREE.AnimationMixer[] = [];
  let updateWater: ((t: number) => void) | null = null;
  let groundHeightAt: (x: number, z: number) => number = () => 0;

  if (isIndoorBiome(envType)) {
    const interior = buildDetailedInterior(tracker, envType, timeOfDay, isSoftwareGl);
    group.add(interior);
  } else {
    const terrain = buildOutdoorTerrainAndWater(
      tracker,
      envType,
      timeOfDay,
      options.weather,
      seed,
      isSoftwareGl
    );
    group.add(terrain.group);
    updateWater = terrain.updateWater;
    groundHeightAt = terrain.groundHeightAt;

    const nature = buildInstancedNatureScatter(tracker, envType, seed, isSoftwareGl);
    group.add(nature.group);

    const placeTree = (
      species: TreeSpecies,
      x: number,
      z: number,
      scale?: number
    ) => {
      if (!isClearOfCameraCorridor(x, z)) return;
      const y = sampleTerrainHeight(x, z, envType);
      const s = scale ?? 0.88 + rng() * 0.28;
      const tree = buildStylizedTree(
        tracker,
        species,
        x,
        y,
        z,
        s,
        rng() * Math.PI * 2,
        swayTargets,
        true
      );
      group.add(tree);
    };

    const mountGlb = (assetId: string, x: number, z: number, yaw: number, targetHeight: number) => {
      const y = sampleTerrainHeight(x, z, envType);
      mountRegisteredAsset(group, tracker, assetId, {
        x,
        y,
        z,
        yaw,
        targetHeight,
        isSoftwareGl,
        isEnvironmentDisposed: () => disposedRef.value,
        onMounted: (inst) => {
          if (inst.mixer) activeMixers.push(inst.mixer);
        },
      });
    };

    if (envType === 'town_square') {
      // Public Town Hall centerpiece + Cafe/Restaurant + Village Shop + Village Houses
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'public_hall',
          x: 0,
          z: -9.4,
          wallColor: '#f1f5f9',
          roofColor: '#1e3a8a',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'restaurant',
          x: -6.8,
          z: -8.8,
          yaw: 0.14,
          wallColor: '#9f1239',
          accentColor: '#dc2626',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'village_house',
          x: 6.8,
          z: -8.8,
          yaw: -0.14,
          wallColor: '#fef3c7',
          roofColor: '#b45309',
          accentColor: '#15803d',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'village_house',
          x: -13.2,
          z: -6.2,
          yaw: 0.45,
          wallColor: '#e0f2fe',
          roofColor: '#7c2d12',
          accentColor: '#1e3a8a',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'shop',
          x: 13.0,
          z: -6.0,
          yaw: -0.45,
          wallColor: '#0284c7',
          accentColor: '#f59e0b',
          timeOfDay,
          isSoftwareGl,
        })
      );

      // Stone fountain in plaza back-left & Benches & Streetlamps
      group.add(buildStoneFountain(tracker, -4.4, 0.04, -3.1, timeOfDay));
      group.add(buildParkBench(tracker, 3.6, 0.04, -3.5, -0.25));
      group.add(buildParkBench(tracker, -5.8, 0.04, -2.2, 1.35));

      group.add(buildStreetLamp(tracker, -3.5, 0.04, -4.1, timeOfDay, true));
      group.add(buildStreetLamp(tracker, 3.5, 0.04, -4.1, timeOfDay, true));

      // Wooden fence bordering pond edge
      group.add(buildFenceRun(tracker, -10.5, -4.2, -7.2, -3.4, 5, envType));

      // Real GLB Roblox Test Building + Environmental Prop placed cleanly in the square
      mountGlb('roblox_test_market_stall', 5.6, -3.4, -0.35, 2.7);
      mountGlb('roblox_test_cypress_planter', -2.6, -5.8, 0, 2.35);
      mountGlb('roblox_test_cypress_planter', 2.6, -5.8, 0.7, 2.35);

      // Varied perimeter trees
      placeTree('oak', -10.8, -9.2, 1.15);
      placeTree('birch', 10.6, -9.4, 1.05);
      placeTree('pine', -15.5, -1.8, 1.25);
      placeTree('oak', 15.2, -1.5, 1.15);
      placeTree('autumn', -9.2, 4.5, 0.95);
      placeTree('oak', 9.2, 4.8, 1.0);
    } else if (envType === 'suburban_street') {
      // Mix of modern houses, village/suburban cottages, and corner apartment
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'modern_house',
          x: 0,
          z: -8.6,
          wallColor: '#f8fafc',
          accentColor: '#b45309',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'village_house',
          x: -7.2,
          z: -8.4,
          wallColor: '#fef3c7',
          roofColor: '#991b1b',
          accentColor: '#0f766e',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'modern_house',
          x: 7.4,
          z: -8.4,
          wallColor: '#e2e8f0',
          accentColor: '#334155',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'apartment',
          x: -14.2,
          z: -8.6,
          wallColor: '#9a3412',
          timeOfDay,
          isSoftwareGl,
        })
      );

      // White suburban picket fences + benches + lamps + GLB planter props
      group.add(buildFenceRun(tracker, -10.0, -5.8, -4.5, -5.8, 6, envType));
      group.add(buildFenceRun(tracker, 4.5, -5.8, 10.0, -5.8, 6, envType));
      group.add(buildStreetLamp(tracker, -3.6, 0.1, -3.2, timeOfDay, true));
      group.add(buildStreetLamp(tracker, 3.6, 0.1, -3.2, timeOfDay, true));
      group.add(buildParkBench(tracker, 1.8, 0.1, -3.4, 0));

      mountGlb('roblox_test_cypress_planter', -3.4, -5.5, 0.2, 2.2);
      mountGlb('roblox_test_cypress_planter', 3.4, -5.5, -0.2, 2.2);

      placeTree('birch', -4.2, -5.6, 1.0);
      placeTree('oak', 4.3, -5.6, 1.05);
      placeTree('autumn', -11.2, -4.6, 1.1);
      placeTree('oak', 11.4, -4.6, 1.12);
      placeTree('birch', -9.2, 5.4, 0.98);
      placeTree('oak', 9.2, 5.2, 1.02);
    } else if (envType === 'city_street') {
      // Downtown avenue: glass office tower, brick apartment, shop & restaurant
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'office',
          x: 0,
          z: -9.2,
          wallColor: '#334155',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'restaurant',
          x: -6.6,
          z: -8.6,
          wallColor: '#7f1d1d',
          accentColor: '#dc2626',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'shop',
          x: 6.4,
          z: -8.6,
          wallColor: '#0369a1',
          accentColor: '#f59e0b',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'apartment',
          x: -13.4,
          z: -9.0,
          wallColor: '#9a3412',
          timeOfDay,
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'office',
          x: 13.4,
          z: -9.4,
          wallColor: '#1e293b',
          timeOfDay,
          isSoftwareGl,
        })
      );

      group.add(buildStreetLamp(tracker, -3.5, 0.12, -3.1, timeOfDay, true));
      group.add(buildStreetLamp(tracker, 3.5, 0.12, -3.1, timeOfDay, true));
      group.add(buildParkBench(tracker, 0, 0.12, -3.5, 0));

      // GLB test market kiosk & boulevard planters
      mountGlb('roblox_test_market_stall', 9.4, -4.4, -0.4, 2.65);
      mountGlb('roblox_test_cypress_planter', -3.1, -4.9, 0, 2.25);
      mountGlb('roblox_test_cypress_planter', 3.1, -4.9, 0.5, 2.25);

      placeTree('birch', -10.2, -4.2, 0.95);
      placeTree('birch', 10.6, -4.2, 0.95);
    } else if (envType === 'forest_park') {
      // Park bench + GLB park planter + multi-species LOD forest grove wrapping clearing & stream
      group.add(buildParkBench(tracker, -1.6, 0.02, -2.9, 0.15));
      mountGlb('roblox_test_cypress_planter', 6.4, -3.4, -0.4, 2.4);

      const forestTrees: Array<[TreeSpecies, number, number, number]> = [
        ['pine', -7.2, -4.5, 1.25],
        ['oak', -4.2, -9.2, 1.2],
        ['birch', -0.4, -9.8, 1.1],
        ['pine', 6.8, -9.2, 1.32],
        ['oak', 10.4, -4.8, 1.15],
        ['pine', -12.4, -7.8, 1.35],
        ['autumn', -10.5, -1.6, 1.05],
        ['birch', 12.2, -8.2, 1.18],
        ['pine', 11.4, -1.2, 1.22],
        ['oak', -8.8, 4.4, 1.1],
        ['pine', 8.8, 4.6, 1.18],
        ['pine', -15.5, -12.5, 1.45],
        ['oak', 0.8, -14.2, 1.35],
        ['pine', 14.5, -12.8, 1.4],
      ];
      for (const [sp, tx, tz, ts] of forestTrees) {
        placeTree(sp, tx, tz, ts);
      }

      // Cozy ranger cabin peeking in distant trees
      const cabinY = sampleTerrainHeight(-11.5, -12.2, envType);
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'village_house',
          x: -11.5,
          y: cabinY,
          z: -12.2,
          yaw: 0.42,
          scale: 0.9,
          wallColor: '#92400e',
          roofColor: '#14532d',
          accentColor: '#78350f',
          timeOfDay,
          isSoftwareGl,
        })
      );
    } else if (envType === 'sci_fi_plaza') {
      // Glowing portal arch + futuristic office towers + neon pylons
      const hullMat = tracker.track(
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.32, metalness: 0.72 })
      );
      const cyanMat = tracker.track(
        new THREE.MeshStandardMaterial({
          color: '#22d3ee',
          emissive: '#06b6d4',
          emissiveIntensity: 1.65,
          roughness: 0.18,
        })
      );
      const amberMat = tracker.track(
        new THREE.MeshStandardMaterial({
          color: '#fbbf24',
          emissive: '#f59e0b',
          emissiveIntensity: 1.4,
          roughness: 0.2,
        })
      );

      for (const px of [-4.4, 4.4]) {
        const pylon = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.15, 5.6, 1.15)), hullMat);
        pylon.position.set(px, 2.8, -4.4);
        pylon.castShadow = true;
        const strip = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.18, 5.0, 1.2)), cyanMat);
        strip.position.set(px, 2.8, -4.4);
        group.add(pylon, strip);
      }
      const archTop = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(10.0, 0.92, 1.24)), hullMat);
      archTop.position.set(0, 5.65, -4.4);
      const archTrim = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(9.2, 0.16, 1.3)), amberMat);
      archTrim.position.set(0, 5.2, -4.4);
      group.add(archTop, archTrim);

      // Distant futuristic office towers
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'office',
          x: -9.5,
          z: -11.5,
          yaw: 0.25,
          wallColor: '#0f172a',
          timeOfDay: 'night',
          isSoftwareGl,
        })
      );
      group.add(
        buildArchitecturalBuilding(tracker, {
          archetype: 'office',
          x: 9.5,
          z: -11.5,
          yaw: -0.25,
          wallColor: '#0f172a',
          timeOfDay: 'night',
          isSoftwareGl,
        })
      );
      mountGlb('roblox_test_cypress_planter', -6.4, -3.8, 0, 2.1);
      mountGlb('roblox_test_cypress_planter', 6.4, -3.8, 0.5, 2.1);
    }

    // Mount any explicitly requested imported experiment assets without changing default world generation
    if (options.explicitImportedAssets && options.explicitImportedAssets.length > 0) {
      for (const placement of options.explicitImportedAssets) {
        const inst = instantiateExperimentAsset(tracker, placement, isSoftwareGl);
        if (inst) {
          group.add(inst.root);
          if (inst.mixer) activeMixers.push(inst.mixer);
        }
      }
    }

    // Wind strength multiplier for foliage sway
    const windStrength =
      options.weather === 'storm' ? 2.4 : options.weather === 'windy' ? 1.85 : 0.7;

    return {
      group,
      skyColor: atmosphere.skyColor,
      fogDensity: atmosphere.fogDensity,
      sunLight: atmosphere.sunLight,
      hemiLight: atmosphere.hemiLight,
      disposables: tracker.disposables,
      groundHeightAt,
      _disposedRef: disposedRef,
      update: (timeSec: number, deltaSec: number) => {
        atmosphere.updateAtmosphere(timeSec, deltaSec);
        updateWater?.(timeSec);
        for (let i = 0; i < swayTargets.length; i++) {
          swayTargets[i].rotation.z =
            Math.sin(timeSec * 1.45 + i * 1.15) * 0.032 * windStrength;
        }
        for (let i = 0; i < activeMixers.length; i++) {
          activeMixers[i].update(deltaSec);
        }
      },
    };
  }

  return {
    group,
    skyColor: atmosphere.skyColor,
    fogDensity: atmosphere.fogDensity,
    sunLight: atmosphere.sunLight,
    hemiLight: atmosphere.hemiLight,
    disposables: tracker.disposables,
    groundHeightAt: () => 0,
    _disposedRef: disposedRef,
    update: (timeSec: number, deltaSec: number) => {
      atmosphere.updateAtmosphere(timeSec, deltaSec);
    },
  };
}

export function disposeEnvironment(env: BuiltEnvironment): void {
  if (env._disposedRef) {
    env._disposedRef.value = true;
  }
  for (const item of env.disposables) {
    item.dispose();
  }
}
