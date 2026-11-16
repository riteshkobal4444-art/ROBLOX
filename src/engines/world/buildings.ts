import * as THREE from 'three';
import {
  createGlassMaterial,
  createPbrMaterial,
  type WorldTracker,
} from './pbrMaterials';
import type { TimeOfDay } from '../../types/story';

export type BuildingArchetype =
  | 'village_house'
  | 'modern_house'
  | 'apartment'
  | 'school'
  | 'shop'
  | 'restaurant'
  | 'office'
  | 'public_hall';

export interface BuildingOptions {
  archetype: BuildingArchetype;
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  scale?: number;
  wallColor?: string;
  accentColor?: string;
  roofColor?: string;
  timeOfDay: TimeOfDay;
  isSoftwareGl?: boolean;
}

function addWindowUnit(
  parent: THREE.Group,
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  frameMat: THREE.Material,
  glassMat: THREE.Material,
  withShutters = false,
  shutterMat?: THREE.Material,
  withFlowerBox = false
): void {
  // Deep outer frame + sill + mullions + recessed pane
  const outer = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.14)), frameMat);
  outer.position.set(x, y, z + 0.04);
  const sill = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.24, 0.08, 0.2)), frameMat);
  sill.position.set(x, y - h * 0.5 - 0.06, z + 0.08);
  const pane = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.06)), glassMat);
  pane.position.set(x, y, z + 0.06);
  const vBar = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.05, h, 0.1)), frameMat);
  vBar.position.set(x, y, z + 0.08);
  const hBar = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, 0.05, 0.1)), frameMat);
  hBar.position.set(x, y, z + 0.08);

  parent.add(outer, sill, pane, vBar, hBar);

  if (withShutters && shutterMat) {
    for (const side of [-1, 1]) {
      const shutter = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(w * 0.34, h + 0.04, 0.07)),
        shutterMat
      );
      shutter.position.set(x + side * (w * 0.5 + 0.12 + w * 0.17), y, z + 0.06);
      parent.add(shutter);
    }
  }

  if (withFlowerBox) {
    const box = new THREE.Mesh(
      tracker.track(new THREE.BoxGeometry(w + 0.14, 0.16, 0.2)),
      tracker.track(new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.85 }))
    );
    box.position.set(x, y - h * 0.5 - 0.16, z + 0.13);
    const bush = new THREE.Mesh(
      tracker.track(new THREE.BoxGeometry(w + 0.06, 0.16, 0.16)),
      tracker.track(new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.8 }))
    );
    bush.position.set(x, y - h * 0.5 - 0.04, z + 0.14);
    parent.add(box, bush);
  }
}

function addPitchedGableRoof(
  parent: THREE.Group,
  tracker: WorldTracker,
  w: number,
  hBase: number,
  depth: number,
  pitchHeight: number,
  roofMat: THREE.Material,
  trimMat: THREE.Material
): void {
  const halfW = w * 0.5 + 0.36;
  const slopeLen = Math.hypot(halfW, pitchHeight);
  const angle = Math.atan2(pitchHeight, halfW);

  const leftSlope = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(slopeLen, 0.16, depth + 0.65)),
    roofMat
  );
  leftSlope.position.set(-halfW * 0.5, hBase + pitchHeight * 0.5, 0);
  leftSlope.rotation.z = angle;
  leftSlope.castShadow = true;
  leftSlope.receiveShadow = true;

  const rightSlope = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(slopeLen, 0.16, depth + 0.65)),
    roofMat
  );
  rightSlope.position.set(halfW * 0.5, hBase + pitchHeight * 0.5, 0);
  rightSlope.rotation.z = -angle;
  rightSlope.castShadow = true;
  rightSlope.receiveShadow = true;

  // Triangular gable wall infill (extruded shape for solid watertight roof gable)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-w * 0.5, 0);
  gableShape.lineTo(w * 0.5, 0);
  gableShape.lineTo(0, pitchHeight - 0.05);
  gableShape.closePath();

  const gableGeo = tracker.track(
    new THREE.ExtrudeGeometry(gableShape, { depth: depth - 0.04, bevelEnabled: false })
  );
  gableGeo.translate(0, hBase - 0.02, -(depth - 0.04) * 0.5);
  const gableMesh = new THREE.Mesh(gableGeo, trimMat);
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;

  // Ridge beam cap
  const ridge = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(0.22, 0.2, depth + 0.7)),
    trimMat
  );
  ridge.position.set(0, hBase + pitchHeight, 0);

  parent.add(gableMesh, leftSlope, rightSlope, ridge);
}

function getWindowGlow(timeOfDay: TimeOfDay): { color: string; intensity: number; tint: string } {
  if (timeOfDay === 'night') {
    return { color: '#fde047', intensity: 1.35, tint: '#fef08a' };
  }
  if (timeOfDay === 'sunset') {
    return { color: '#fb923c', intensity: 0.72, tint: '#fed7aa' };
  }
  if (timeOfDay === 'morning') {
    return { color: '#fef3c7', intensity: 0.35, tint: '#bae6fd' };
  }
  return { color: '#1e293b', intensity: 0.14, tint: '#93c5fd' };
}

export function buildArchitecturalBuilding(
  tracker: WorldTracker,
  opts: BuildingOptions
): THREE.Group {
  const b = new THREE.Group();
  b.name = `building_${opts.archetype}`;
  b.position.set(opts.x, opts.y ?? 0, opts.z);
  if (opts.yaw) b.rotation.y = opts.yaw;
  if (opts.scale) b.scale.setScalar(opts.scale);

  const glow = getWindowGlow(opts.timeOfDay);
  const glassMat = createGlassMaterial(tracker, {
    tintColor: glow.tint,
    emissiveColor: glow.color,
    emissiveIntensity: glow.intensity,
    opacity: 0.88,
    isSoftwareGl: opts.isSoftwareGl,
  });

  const stoneMat = createPbrMaterial(tracker, {
    kind: 'cobble',
    baseColor: '#94a3b8',
    accentColor: '#64748b',
    repeatX: 3,
    repeatY: 2,
    roughness: 0.82,
  });
  const trimMat = createPbrMaterial(tracker, {
    kind: 'plaster',
    baseColor: '#f1f5f9',
    accentColor: '#e2e8f0',
    repeatX: 2,
    repeatY: 2,
    roughness: 0.68,
  });
  const woodMat = createPbrMaterial(tracker, {
    kind: 'wood',
    baseColor: '#78350f',
    accentColor: '#451a03',
    repeatX: 2,
    repeatY: 2,
    roughness: 0.65,
  });
  const metalMat = createPbrMaterial(tracker, {
    kind: 'metal',
    baseColor: '#334155',
    accentColor: '#1e293b',
    repeatX: 2,
    repeatY: 2,
    roughness: 0.35,
    metalness: 0.78,
  });

  switch (opts.archetype) {
    case 'village_house': {
      const w = 4.6;
      const h = 3.2;
      const d = 3.8;
      const wallMat = createPbrMaterial(tracker, {
        kind: 'plaster',
        baseColor: opts.wallColor ?? '#fef3c7',
        accentColor: '#f5e6c8',
        repeatX: 3,
        repeatY: 2,
        roughness: 0.86,
      });
      const roofMat = createPbrMaterial(tracker, {
        kind: 'shingle',
        baseColor: opts.roofColor ?? '#b45309',
        accentColor: '#7c2d12',
        repeatX: 4,
        repeatY: 3,
        roughness: 0.72,
      });

      // Stone foundation plinth
      const plinth = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.25, 0.42, d + 0.25)), stoneMat);
      plinth.position.y = 0.21;
      plinth.castShadow = true;
      plinth.receiveShadow = true;

      const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), wallMat);
      body.position.y = 0.4 + h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      b.add(plinth, body);

      // Timber-frame Tudor vertical & horizontal facade beams
      for (const tx of [-w * 0.47, 0, w * 0.47]) {
        const beam = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.16, h, 0.12)), woodMat);
        beam.position.set(tx, 0.4 + h * 0.5, d * 0.5 + 0.02);
        b.add(beam);
      }
      const midBeam = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.08, 0.16, 0.14)), woodMat);
      midBeam.position.set(0, 2.2, d * 0.5 + 0.02);
      b.add(midBeam);

      addPitchedGableRoof(b, tracker, w, 0.4 + h, d, 1.55, roofMat, wallMat);

      // Chimney + Brick cap
      const brickMat = createPbrMaterial(tracker, {
        kind: 'brick',
        baseColor: '#991b1b',
        accentColor: '#cbd5e1',
        repeatX: 2,
        repeatY: 3,
      });
      const chimney = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.62, 1.85, 0.62)), brickMat);
      chimney.position.set(w * 0.28, 0.4 + h + 1.1, -d * 0.22);
      chimney.castShadow = true;
      b.add(chimney);

      // Entry door + wooden awning + stone stoop stairs
      const door = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.92, 1.82, 0.12)), woodMat);
      door.position.set(0, 0.42 + 0.91, d * 0.5 + 0.03);
      const step1 = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.45, 0.22, 0.65)), stoneMat);
      step1.position.set(0, 0.11, d * 0.5 + 0.35);
      const step2 = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.25, 0.22, 0.45)), stoneMat);
      step2.position.set(0, 0.31, d * 0.5 + 0.24);
      const porchRoof = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.5, 0.12, 0.72)), roofMat);
      porchRoof.position.set(0, 2.48, d * 0.5 + 0.34);
      porchRoof.rotation.x = 0.22;
      b.add(door, step1, step2, porchRoof);

      const shutterMat = createPbrMaterial(tracker, {
        kind: 'wood',
        baseColor: opts.accentColor ?? '#15803d',
        accentColor: '#14532d',
        repeatX: 1,
        repeatY: 1,
      });
      addWindowUnit(b, tracker, -1.4, 1.65, d * 0.5, 0.82, 0.88, trimMat, glassMat, true, shutterMat, true);
      addWindowUnit(b, tracker, 1.4, 1.65, d * 0.5, 0.82, 0.88, trimMat, glassMat, true, shutterMat, true);
      break;
    }

    case 'modern_house': {
      const w = 5.4;
      const d = 4.2;
      const stuccoMat = createPbrMaterial(tracker, {
        kind: 'plaster',
        baseColor: opts.wallColor ?? '#f8fafc',
        accentColor: '#e2e8f0',
        repeatX: 3,
        repeatY: 2,
        roughness: 0.74,
      });
      const cedarMat = createPbrMaterial(tracker, {
        kind: 'wood',
        baseColor: opts.accentColor ?? '#b45309',
        accentColor: '#78350f',
        repeatX: 3,
        repeatY: 2,
        roughness: 0.6,
      });
      const darkRoofMat = createPbrMaterial(tracker, {
        kind: 'metal',
        baseColor: opts.roofColor ?? '#1e293b',
        accentColor: '#0f172a',
        repeatX: 3,
        repeatY: 2,
        roughness: 0.42,
        metalness: 0.5,
      });

      // Ground floor + cantilevered upper floor + side garage/alcove
      const lower = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, 2.55, d)), stuccoMat);
      lower.position.set(0, 1.275, 0);
      lower.castShadow = true;
      lower.receiveShadow = true;

      const upper = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w * 0.72, 2.35, d + 0.5)), cedarMat);
      upper.position.set(-w * 0.14, 2.55 + 1.175, 0.18);
      upper.castShadow = true;
      upper.receiveShadow = true;

      const roofOverhang = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w * 0.78, 0.24, d + 1.0)), darkRoofMat);
      roofOverhang.position.set(-w * 0.14, 5.02, 0.28);
      roofOverhang.castShadow = true;

      // Balcony deck & glass balustrade on right upper terrace
      const balconyDeck = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w * 0.32, 0.18, d + 0.3)), darkRoofMat);
      balconyDeck.position.set(w * 0.35, 2.6, 0.15);
      const railBar = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w * 0.32, 0.06, 0.08)), metalMat);
      railBar.position.set(w * 0.35, 3.45, d * 0.5 + 0.26);
      const railGlass = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w * 0.3, 0.72, 0.05)), glassMat);
      railGlass.position.set(w * 0.35, 3.06, d * 0.5 + 0.26);

      // Modern recessed front door + concrete steps + steel canopy
      const door = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.05, 2.05, 0.12)), woodMat);
      door.position.set(w * 0.22, 1.12, d * 0.5 + 0.03);
      const entryCanopy = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.85, 0.12, 0.95)), darkRoofMat);
      entryCanopy.position.set(w * 0.22, 2.32, d * 0.5 + 0.42);
      const step = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.8, 0.18, 0.75)), stoneMat);
      step.position.set(w * 0.22, 0.09, d * 0.5 + 0.38);

      b.add(lower, upper, roofOverhang, balconyDeck, railBar, railGlass, door, entryCanopy, step);

      // Wide modern picture windows
      addWindowUnit(b, tracker, -1.25, 1.35, d * 0.5, 1.75, 1.35, metalMat, glassMat);
      addWindowUnit(b, tracker, -1.2, 3.7, d * 0.5 + 0.43, 1.65, 1.2, metalMat, glassMat);
      addWindowUnit(b, tracker, -0.05, 3.7, d * 0.5 + 0.43, 0.85, 1.2, metalMat, glassMat);
      break;
    }

    case 'apartment': {
      const w = 5.6;
      const h = 7.4;
      const d = 4.4;
      const brickMat = createPbrMaterial(tracker, {
        kind: 'brick',
        baseColor: opts.wallColor ?? '#9a3412',
        accentColor: '#e2e8f0',
        repeatX: 4,
        repeatY: 5,
        roughness: 0.82,
      });

      const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), brickMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;

      // Stone base + decorative roof cornice
      const base = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.16, 0.65, d + 0.16)), stoneMat);
      base.position.y = 0.325;
      const cornice = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.45, 0.35, d + 0.45)), stoneMat);
      cornice.position.y = h + 0.14;
      const roofTop = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w - 0.2, 0.35, d - 0.2)), metalMat);
      roofTop.position.y = h + 0.45;
      b.add(body, base, cornice, roofTop);

      // Lobby awning & double glass door
      const lobbyAwning = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.1, 0.16, 1.0)),
        tracker.track(new THREE.MeshStandardMaterial({ color: opts.accentColor ?? '#1e3a8a', roughness: 0.5 }))
      );
      lobbyAwning.position.set(0, 2.35, d * 0.5 + 0.48);
      const lobbyDoor = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.5, 2.05, 0.12)), glassMat);
      lobbyDoor.position.set(0, 1.05, d * 0.5 + 0.04);
      b.add(lobbyAwning, lobbyDoor);

      // 3 upper floors of windows + balconies
      for (const floorY of [3.55, 5.75]) {
        for (const wx of [-1.7, 0, 1.7]) {
          addWindowUnit(b, tracker, wx, floorY, d * 0.5, 0.92, 1.15, trimMat, glassMat);
        }
        // Wrought-iron balcony slab & rail on center window
        const balSlab = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.9, 0.12, 0.65)), stoneMat);
        balSlab.position.set(0, floorY - 0.65, d * 0.5 + 0.32);
        const balRail = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.9, 0.45, 0.06)), metalMat);
        balRail.position.set(0, floorY - 0.36, d * 0.5 + 0.62);
        b.add(balSlab, balRail);
      }
      break;
    }

    case 'school': {
      const w = 8.4;
      const h = 4.6;
      const d = 4.6;
      const brickMat = createPbrMaterial(tracker, {
        kind: 'brick',
        baseColor: opts.wallColor ?? '#b91c1c',
        accentColor: '#f1f5f9',
        repeatX: 6,
        repeatY: 3,
      });

      const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), brickMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;

      // Classical portico columns + triangular pediment + roof clock cupola
      const porticoRoof = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.4, 0.28, 1.25)), trimMat);
      porticoRoof.position.set(0, 3.6, d * 0.5 + 0.6);
      const pediment = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(1.9, 1.1, 4)), trimMat);
      pediment.rotation.y = Math.PI / 4;
      pediment.scale.set(1.2, 1, 0.55);
      pediment.position.set(0, 4.2, d * 0.5 + 0.55);

      for (const cx of [-1.25, 1.25]) {
        const col = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.18, 0.22, 3.2, 12)), trimMat);
        col.position.set(cx, 1.85, d * 0.5 + 0.95);
        col.castShadow = true;
        b.add(col);
      }

      // Stairs + double doors
      const steps = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.2, 0.32, 1.2)), stoneMat);
      steps.position.set(0, 0.16, d * 0.5 + 0.6);
      const doubleDoor = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.6, 2.2, 0.14)), woodMat);
      doubleDoor.position.set(0, 1.4, d * 0.5 + 0.04);

      // Clock tower dome on roof
      const tower = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.6, 1.6, 1.6)), trimMat);
      tower.position.set(0, h + 0.8, 0);
      const clockFace = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16)),
        tracker.track(
          new THREE.MeshStandardMaterial({
            color: '#fefce8',
            emissive: '#fef08a',
            emissiveIntensity: opts.timeOfDay === 'night' ? 1.1 : 0.2,
          })
        )
      );
      clockFace.rotation.x = Math.PI / 2;
      clockFace.position.set(0, h + 0.9, 0.82);

      const roof = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.4, 0.32, d + 0.4)), stoneMat);
      roof.position.y = h + 0.14;

      b.add(body, porticoRoof, pediment, steps, doubleDoor, roof, tower, clockFace);

      for (const wx of [-3.1, -1.95, 1.95, 3.1]) {
        addWindowUnit(b, tracker, wx, 1.55, d * 0.5, 0.82, 1.2, trimMat, glassMat);
        addWindowUnit(b, tracker, wx, 3.35, d * 0.5, 0.82, 1.1, trimMat, glassMat);
      }
      break;
    }

    case 'shop':
    case 'restaurant': {
      const isCafe = opts.archetype === 'restaurant';
      const w = 4.8;
      const h = 4.4;
      const d = 4.0;
      const wallMat = createPbrMaterial(tracker, {
        kind: isCafe ? 'brick' : 'plaster',
        baseColor: opts.wallColor ?? (isCafe ? '#9f1239' : '#0284c7'),
        accentColor: isCafe ? '#fecdd3' : '#e0f2fe',
        repeatX: 3,
        repeatY: 3,
      });

      const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), wallMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      const cornice = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.35, 0.28, d + 0.35)), trimMat);
      cornice.position.y = h + 0.12;

      // Striped shop/cafe canopy awning + illuminated sign fascia
      const awningColor = opts.accentColor ?? (isCafe ? '#dc2626' : '#f59e0b');
      const awningMat = tracker.track(new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.7 }));
      const awning = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w - 0.3, 0.16, 1.05)), awningMat);
      awning.position.set(0, 2.35, d * 0.5 + 0.48);
      awning.rotation.x = 0.25;
      awning.castShadow = true;

      const signBoard = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.6, 0.52, 0.14)),
        tracker.track(
          new THREE.MeshStandardMaterial({
            color: '#1e293b',
            emissive: isCafe ? '#fb923c' : '#38bdf8',
            emissiveIntensity: opts.timeOfDay === 'night' ? 0.9 : 0.25,
            roughness: 0.4,
          })
        )
      );
      signBoard.position.set(0, 2.75, d * 0.5 + 0.08);

      // Display storefront windows + glass entry door
      const shopGlass = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.2, 1.55, 0.1)), glassMat);
      shopGlass.position.set(-0.75, 1.15, d * 0.5 + 0.04);
      const shopDoor = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.95, 1.95, 0.12)), glassMat);
      shopDoor.position.set(1.35, 1.0, d * 0.5 + 0.05);

      b.add(body, cornice, awning, signBoard, shopGlass, shopDoor);

      for (const wx of [-1.35, 0, 1.35]) {
        addWindowUnit(b, tracker, wx, 3.55, d * 0.5, 0.72, 0.82, trimMat, glassMat);
      }

      if (isCafe) {
        // Outdoor patio cafe table + 2 chairs in front of facade
        const tableTop = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12)), woodMat);
        tableTop.position.set(-1.1, 0.72, d * 0.5 + 1.1);
        const leg = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8)), metalMat);
        leg.position.set(-1.1, 0.35, d * 0.5 + 1.1);
        const umbrellaPole = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8)), metalMat);
        umbrellaPole.position.set(-1.1, 1.35, d * 0.5 + 1.1);
        const umbrella = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(0.95, 0.45, 8)), awningMat);
        umbrella.position.set(-1.1, 2.35, d * 0.5 + 1.1);
        b.add(tableTop, leg, umbrellaPole, umbrella);
      }
      break;
    }

    case 'office': {
      const w = 5.8;
      const h = 9.5;
      const d = 4.8;
      const concreteMat = createPbrMaterial(tracker, {
        kind: 'concrete',
        baseColor: opts.wallColor ?? '#334155',
        accentColor: '#1e293b',
        repeatX: 3,
        repeatY: 6,
        roughness: 0.55,
        metalness: 0.2,
      });
      const curtainGlass = createGlassMaterial(tracker, {
        tintColor: opts.timeOfDay === 'night' ? '#fef08a' : '#7dd3fc',
        emissiveColor: opts.timeOfDay === 'night' ? '#f59e0b' : '#0284c7',
        emissiveIntensity: opts.timeOfDay === 'night' ? 0.75 : 0.25,
        opacity: 0.9,
        isSoftwareGl: opts.isSoftwareGl,
      });

      const core = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), concreteMat);
      core.position.y = h * 0.5;
      core.castShadow = true;
      core.receiveShadow = true;

      // Recessed reflective curtain wall ribbons across floors
      for (const fy of [3.2, 5.1, 7.0, 8.6]) {
        const band = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w - 0.5, 1.15, d + 0.08)), curtainGlass);
        band.position.y = fy;
        b.add(band);
      }

      // Steel structural vertical mullions + glass entrance vestibule
      for (const mx of [-2.4, -0.8, 0.8, 2.4]) {
        const pilaster = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.24, h, 0.22)), metalMat);
        pilaster.position.set(mx, h * 0.5, d * 0.5 + 0.05);
        b.add(pilaster);
      }

      const canopy = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.2, 0.18, 1.3)), metalMat);
      canopy.position.set(0, 2.35, d * 0.5 + 0.6);
      const entryDoor = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.8, 2.1, 0.15)), glassMat);
      entryDoor.position.set(0, 1.05, d * 0.5 + 0.05);
      const penthouse = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.2, 1.1, 2.6)), metalMat);
      penthouse.position.set(0, h + 0.55, 0);

      b.add(core, canopy, entryDoor, penthouse);
      break;
    }

    case 'public_hall':
    default: {
      const w = 6.2;
      const h = 4.6;
      const d = 4.4;
      const hallMat = createPbrMaterial(tracker, {
        kind: 'plaster',
        baseColor: opts.wallColor ?? '#f1f5f9',
        accentColor: '#cbd5e1',
        repeatX: 4,
        repeatY: 3,
      });
      const roofMat = createPbrMaterial(tracker, {
        kind: 'shingle',
        baseColor: opts.roofColor ?? '#1e3a8a',
        accentColor: '#1e293b',
        repeatX: 4,
        repeatY: 3,
      });

      const plinth = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.8, 0.45, d + 1.2)), stoneMat);
      plinth.position.set(0, 0.225, 0.25);
      plinth.receiveShadow = true;

      const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, d)), hallMat);
      body.position.y = 0.45 + h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;

      // 4 front stone columns
      for (const cx of [-2.2, -0.85, 0.85, 2.2]) {
        const col = new THREE.Mesh(tracker.track(new THREE.CylinderGeometry(0.2, 0.24, 3.8, 12)), trimMat);
        col.position.set(cx, 2.35, d * 0.5 + 0.55);
        col.castShadow = true;
        b.add(col);
      }

      addPitchedGableRoof(b, tracker, w + 0.4, 0.45 + h, d + 0.5, 1.4, roofMat, hallMat);

      // Clock belfry tower
      const belfry = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.8, 2.4, 1.8)), hallMat);
      belfry.position.set(0, 0.45 + h + 1.6, 0);
      const spire = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(1.35, 1.8, 4)), roofMat);
      spire.rotation.y = Math.PI / 4;
      spire.position.set(0, 0.45 + h + 3.6, 0);
      const clock = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.52, 0.52, 0.1, 16)),
        tracker.track(
          new THREE.MeshStandardMaterial({
            color: '#fefce8',
            emissive: '#fde047',
            emissiveIntensity: opts.timeOfDay === 'night' ? 1.25 : 0.2,
          })
        )
      );
      clock.rotation.x = Math.PI / 2;
      clock.position.set(0, 0.45 + h + 1.9, 0.93);

      const doubleDoor = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.4, 2.2, 0.14)), woodMat);
      doubleDoor.position.set(0, 1.55, d * 0.5 + 0.04);

      b.add(plinth, body, belfry, spire, clock, doubleDoor);

      addWindowUnit(b, tracker, -1.8, 2.4, d * 0.5, 0.85, 1.3, trimMat, glassMat);
      addWindowUnit(b, tracker, 1.8, 2.4, d * 0.5, 0.85, 1.3, trimMat, glassMat);
      break;
    }
  }

  return b;
}
