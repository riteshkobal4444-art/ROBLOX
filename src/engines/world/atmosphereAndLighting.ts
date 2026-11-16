import * as THREE from 'three';
import { createSeededRng, type WorldTracker } from './pbrMaterials';
import type {
  EnvironmentType,
  SceneMood,
  SceneWeather,
  TimeOfDay,
} from '../../types/story';

export interface AtmosphereBuildResult {
  group: THREE.Group;
  skyColor: THREE.Color;
  fogDensity: number;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  updateAtmosphere: (timeSec: number, deltaSec: number) => void;
}

interface TimeLightingConfig {
  zenith: string;
  horizon: string;
  sunColor: number;
  sunInt: number;
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  sunPos: THREE.Vector3;
  fogDensity: number;
}

const TIME_CONFIGS: Record<TimeOfDay, TimeLightingConfig> = {
  morning: {
    zenith: '#3b82f6',
    horizon: '#fed7aa',
    sunColor: 0xffedd5,
    sunInt: 2.0,
    hemiSky: 0xbae6fd,
    hemiGround: 0x475569,
    hemiInt: 0.92,
    sunPos: new THREE.Vector3(18, 9, 10),
    fogDensity: 0.015,
  },
  day: {
    zenith: '#2563eb',
    horizon: '#93c5fd',
    sunColor: 0xfff8e7,
    sunInt: 2.2,
    hemiSky: 0x93c5fd,
    hemiGround: 0x334155,
    hemiInt: 0.95,
    sunPos: new THREE.Vector3(12, 19, 11),
    fogDensity: 0.011,
  },
  sunset: {
    zenith: '#312e81',
    horizon: '#fb923c',
    sunColor: 0xff9e5e,
    sunInt: 1.9,
    hemiSky: 0xfdba74,
    hemiGround: 0x312e81,
    hemiInt: 0.82,
    sunPos: new THREE.Vector3(-18, 7.5, 11),
    fogDensity: 0.015,
  },
  night: {
    zenith: '#020617',
    horizon: '#0f172a',
    sunColor: 0x93c5fd,
    sunInt: 0.92,
    hemiSky: 0x1e293b,
    hemiGround: 0x090d16,
    hemiInt: 0.68,
    sunPos: new THREE.Vector3(-12, 17, 9),
    fogDensity: 0.016,
  },
};

export function isIndoorBiome(envType: EnvironmentType): boolean {
  return (
    envType === 'cozy_house_interior' ||
    envType === 'modern_house_interior' ||
    envType === 'school_hallway' ||
    envType === 'school_classroom'
  );
}

export function buildAtmosphereAndLighting(
  tracker: WorldTracker,
  envType: EnvironmentType,
  timeOfDay: TimeOfDay,
  weather: SceneWeather | undefined,
  mood: SceneMood | undefined,
  seed: string,
  isSoftwareGl: boolean
): AtmosphereBuildResult {
  const group = new THREE.Group();
  group.name = `atmosphere_${envType}_${timeOfDay}`;

  const indoor = isIndoorBiome(envType);
  const cfg = TIME_CONFIGS[timeOfDay];
  const activeWeather: SceneWeather = weather ?? 'clear';
  const isRainy = activeWeather === 'rain' || activeWeather === 'storm';
  const isStorm = activeWeather === 'storm';
  const isWindy = activeWeather === 'windy';
  const rng = createSeededRng(`${seed}_${envType}_atmo`);

  // Adjust horizon/fog cleanly for sci-fi or rainy weather
  const skyColor = new THREE.Color(
    indoor
      ? '#161a23'
      : envType === 'sci_fi_plaza'
        ? '#090f21'
        : isRainy
          ? timeOfDay === 'night'
            ? '#0a0f1c'
            : '#475569'
          : cfg.horizon
  );
  const zenithColor = new THREE.Color(
    envType === 'sci_fi_plaza'
      ? '#030712'
      : isRainy
        ? timeOfDay === 'night'
          ? '#020617'
          : '#334155'
        : cfg.zenith
  );

  // Hemispheric ambient light
  const hemiLight = new THREE.HemisphereLight(
    cfg.hemiSky,
    cfg.hemiGround,
    indoor ? 1.15 : isRainy ? cfg.hemiInt * 0.78 : cfg.hemiInt
  );
  group.add(hemiLight);

  // Key directional sun / moon light
  const baseSunInt = indoor ? 1.3 : isRainy ? cfg.sunInt * 0.62 : cfg.sunInt;
  const sunLight = new THREE.DirectionalLight(cfg.sunColor, baseSunInt);
  sunLight.position.copy(cfg.sunPos);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 48;
  const shadowSpan = 16;
  sunLight.shadow.camera.left = -shadowSpan;
  sunLight.shadow.camera.right = shadowSpan;
  sunLight.shadow.camera.top = shadowSpan;
  sunLight.shadow.camera.bottom = -shadowSpan;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  group.add(sunLight);

  // Subtle cool/warm rim backlight for 3D character separation
  const rimLight = new THREE.DirectionalLight(
    timeOfDay === 'sunset' ? 0xfb923c : timeOfDay === 'night' ? 0x38bdf8 : 0xe0f2fe,
    indoor ? 0.55 : 0.45
  );
  rimLight.position.set(-8, 6, -12);
  group.add(rimLight);

  const cloudGroups: THREE.Group[] = [];
  let rainInst: THREE.InstancedMesh | null = null;
  let rainDrops: Array<{ x: number; y: number; z: number; speed: number }> = [];
  let leafInst: THREE.InstancedMesh | null = null;
  let leaves: Array<{ x: number; y: number; z: number; speedX: number; phase: number }> = [];
  let motePoints: THREE.Points | null = null;
  let moteBasePos: Float32Array | null = null;
  const dummy = new THREE.Object3D();

  if (!indoor) {
    // Procedural gradient sky dome
    const skyGeo = tracker.track(new THREE.SphereGeometry(78, 24, 16));
    const sPos = skyGeo.attributes.position as THREE.BufferAttribute;
    const sCols = new Float32Array(sPos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < sPos.count; i++) {
      const ny = Math.max(0, Math.min(1, (sPos.getY(i) + 12) / 78));
      tmp.copy(skyColor).lerp(zenithColor, Math.pow(ny, 0.72));
      sCols[i * 3] = tmp.r;
      sCols[i * 3 + 1] = tmp.g;
      sCols[i * 3 + 2] = tmp.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(sCols, 3));
    const skyMat = tracker.track(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.name = 'procedural_sky_dome';
    group.add(skyDome);

    // Sun or Moon celestial disc visible in background sky
    if (!isRainy) {
      const celestialPos = cfg.sunPos.clone().normalize().multiplyScalar(58);
      const celestialMat = tracker.track(
        new THREE.MeshBasicMaterial({
          color:
            timeOfDay === 'night'
              ? '#e2e8f0'
              : timeOfDay === 'sunset'
                ? '#fb923c'
                : '#fef08a',
          fog: false,
        })
      );
      const celestial = new THREE.Mesh(
        tracker.track(new THREE.SphereGeometry(timeOfDay === 'night' ? 2.1 : 3.0, 14, 10)),
        celestialMat
      );
      celestial.position.copy(celestialPos);
      // Place sky backdrop behind -Z horizon so camera looking from +Z sees it
      celestial.position.z = -Math.abs(celestial.position.z) - 24;
      group.add(celestial);
    }

    // Starfield on clear nights or sci-fi skies
    if (timeOfDay === 'night' || envType === 'sci_fi_plaza') {
      const starCount = isSoftwareGl ? 90 : 180;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = rng() * Math.PI * 2;
        const phi = rng() * Math.PI * 0.42;
        const r = 64;
        starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
        starPositions[i * 3 + 1] = Math.cos(phi) * r + 4;
        starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      }
      const starGeo = tracker.track(new THREE.BufferGeometry());
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = tracker.track(
        new THREE.PointsMaterial({
          color: '#f8fafc',
          size: 0.45,
          transparent: true,
          opacity: 0.85,
          fog: false,
        })
      );
      group.add(new THREE.Points(starGeo, starMat));
    }

    // Volumetric stylized cloud clusters in distant sky
    const cloudMat = tracker.track(
      new THREE.MeshStandardMaterial({
        color: isRainy
          ? '#64748b'
          : timeOfDay === 'sunset'
            ? '#fed7aa'
            : timeOfDay === 'night'
              ? '#334155'
              : '#ffffff',
        roughness: 0.92,
        transparent: true,
        opacity: isRainy ? 0.9 : 0.85,
        flatShading: true,
      })
    );
    const cloudCount = isSoftwareGl ? 5 : 9;
    for (let c = 0; c < cloudCount; c++) {
      const cg = new THREE.Group();
      cg.position.set(-34 + c * 9 + (rng() - 0.5) * 4, 15 + rng() * 6, -24 - rng() * 18);
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(
          tracker.track(new THREE.IcosahedronGeometry(1.5 + rng() * 0.8, 1)),
          cloudMat
        );
        puff.position.set((p - 1) * 1.45, (p === 1 ? 0.55 : 0) + (rng() - 0.5) * 0.2, (rng() - 0.5) * 0.6);
        puff.scale.set(1.25, 0.72, 0.9);
        cg.add(puff);
      }
      group.add(cg);
      cloudGroups.push(cg);
    }

    // Conditional Weather: Rain / Storm streaks
    if (isRainy) {
      const dropCount = isSoftwareGl ? 120 : 240;
      const dropGeo = tracker.track(new THREE.BoxGeometry(0.024, 0.75, 0.024));
      const dropMat = tracker.track(
        new THREE.MeshBasicMaterial({
          color: '#bae6fd',
          transparent: true,
          opacity: 0.55,
        })
      );
      rainInst = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
      rainDrops = [];
      for (let i = 0; i < dropCount; i++) {
        const d = {
          x: (rng() - 0.5) * 24,
          y: rng() * 14,
          z: -10 + rng() * 16,
          speed: (isStorm ? 18 : 13) + rng() * 5,
        };
        rainDrops.push(d);
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(0, 0, isStorm ? 0.16 : 0.07);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        rainInst.setMatrixAt(i, dummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
      rainInst.computeBoundingSphere();
      group.add(rainInst);
    }

    // Conditional Weather: Wind-blown drifting leaves
    if (isWindy || (envType === 'forest_park' && !isRainy && (timeOfDay === 'sunset' || mood === 'calm'))) {
      const leafCount = isSoftwareGl ? 24 : 44;
      const leafGeo = tracker.track(new THREE.BoxGeometry(0.14, 0.02, 0.09));
      const leafMat = tracker.track(
        new THREE.MeshStandardMaterial({
          color: timeOfDay === 'sunset' ? '#f59e0b' : '#4ade80',
          roughness: 0.8,
        })
      );
      leafInst = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
      leaves = [];
      for (let i = 0; i < leafCount; i++) {
        const lf = {
          x: (rng() - 0.5) * 22,
          y: 0.6 + rng() * 5.2,
          z: -7 + rng() * 11,
          speedX: (isWindy ? 2.6 : 0.9) + rng() * 1.1,
          phase: rng() * Math.PI * 2,
        };
        leaves.push(lf);
        dummy.position.set(lf.x, lf.y, lf.z);
        dummy.rotation.set(rng(), rng(), rng());
        dummy.updateMatrix();
        leafInst.setMatrixAt(i, dummy.matrix);
      }
      leafInst.instanceMatrix.needsUpdate = true;
      leafInst.computeBoundingSphere();
      group.add(leafInst);
    }

    // Subtle morning/sunset volumetric light shafts & forest dust/fireflies (background only)
    if (!isRainy && (timeOfDay === 'morning' || timeOfDay === 'sunset')) {
      const rayMat = tracker.track(
        new THREE.MeshBasicMaterial({
          color: timeOfDay === 'sunset' ? '#fdba74' : '#fef3c7',
          transparent: true,
          opacity: 0.075,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
      );
      for (const rx of [-5.5, 4.5]) {
        const beam = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(2.6, 14, 12, 1, true)), rayMat);
        beam.position.set(rx, 5.5, -7.8);
        beam.rotation.z = timeOfDay === 'sunset' ? 0.35 : -0.35;
        group.add(beam);
      }
    }

    if ((envType === 'forest_park' || mood === 'mysterious') && !isRainy) {
      const count = isSoftwareGl ? 28 : 54;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (rng() - 0.5) * 18;
        positions[i * 3 + 1] = 0.5 + rng() * 3.8;
        positions[i * 3 + 2] = -7.5 + rng() * 8.5;
      }
      moteBasePos = new Float32Array(positions);
      const mGeo = tracker.track(new THREE.BufferGeometry());
      mGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mMat = tracker.track(
        new THREE.PointsMaterial({
          color: timeOfDay === 'night' ? '#fde047' : '#fef9c3',
          size: timeOfDay === 'night' ? 0.16 : 0.1,
          transparent: true,
          opacity: timeOfDay === 'night' ? 0.85 : 0.55,
        })
      );
      motePoints = new THREE.Points(mGeo, mMat);
      group.add(motePoints);
    }
  }

  const fogDensity = indoor
    ? 0.008
    : isRainy
      ? cfg.fogDensity + 0.008
      : cfg.fogDensity;

  return {
    group,
    skyColor,
    fogDensity,
    sunLight,
    hemiLight,
    updateAtmosphere: (timeSec: number, deltaSec: number) => {
      const dt = Math.max(0.001, Math.min(0.1, deltaSec));

      // Gentle cloud drift
      for (let i = 0; i < cloudGroups.length; i++) {
        const cg = cloudGroups[i];
        cg.position.x += dt * (isWindy ? 0.75 : 0.28);
        if (cg.position.x > 42) cg.position.x = -42;
      }

      // Falling rain streaks
      if (rainInst) {
        const tilt = isStorm ? 0.16 : 0.07;
        for (let i = 0; i < rainDrops.length; i++) {
          const d = rainDrops[i];
          d.y -= d.speed * dt;
          d.x -= d.speed * tilt * dt;
          if (d.y < 0) {
            d.y += 14;
            d.x = ((d.x + 12) % 24) - 12;
          }
          dummy.position.set(d.x, d.y, d.z);
          dummy.rotation.set(0, 0, tilt);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          rainInst.setMatrixAt(i, dummy.matrix);
        }
        rainInst.instanceMatrix.needsUpdate = true;
      }

      // Storm lightning flash pulse
      if (isStorm && !indoor) {
        const pulse = Math.sin(timeSec * 3.7) * Math.sin(timeSec * 11.3);
        sunLight.intensity = pulse > 0.94 ? baseSunInt * 2.4 : baseSunInt;
      }

      // Drifting leaves
      if (leafInst) {
        for (let i = 0; i < leaves.length; i++) {
          const lf = leaves[i];
          lf.x += lf.speedX * dt;
          if (lf.x > 11) lf.x = -11;
          const ly = lf.y + Math.sin(timeSec * 2.2 + lf.phase) * 0.25;
          dummy.position.set(lf.x, ly, lf.z);
          dummy.rotation.set(timeSec * 1.4 + lf.phase, timeSec * 1.1, lf.phase);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          leafInst.setMatrixAt(i, dummy.matrix);
        }
        leafInst.instanceMatrix.needsUpdate = true;
      }

      // Dust motes / night fireflies
      if (motePoints && moteBasePos) {
        const pos = motePoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const bx = moteBasePos[i * 3];
          const by = moteBasePos[i * 3 + 1];
          const bz = moteBasePos[i * 3 + 2];
          pos.setXYZ(
            i,
            bx + Math.sin(timeSec * 0.8 + i) * 0.35,
            by + Math.cos(timeSec * 1.1 + i * 0.7) * 0.25,
            bz + Math.sin(timeSec * 0.6 + i * 1.3) * 0.25
          );
        }
        pos.needsUpdate = true;
      }
    },
  };
}
