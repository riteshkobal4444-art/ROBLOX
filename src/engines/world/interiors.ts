import * as THREE from 'three';
import {
  createGlassMaterial,
  createPbrMaterial,
  type WorldTracker,
} from './pbrMaterials';
import type { EnvironmentType, TimeOfDay } from '../../types/story';

function addInteriorWindow(
  group: THREE.Group,
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  timeOfDay: TimeOfDay,
  curtainHex: string,
  isSoftwareGl: boolean
): void {
  const skyColor =
    timeOfDay === 'night'
      ? '#0f172a'
      : timeOfDay === 'sunset'
        ? '#fb923c'
        : timeOfDay === 'morning'
          ? '#fde68a'
          : '#7dd3fc';
  const skyIntensity = timeOfDay === 'night' ? 0.35 : 0.85;

  const frameMat = tracker.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45 }));
  const glassMat = createGlassMaterial(tracker, {
    tintColor: skyColor,
    emissiveColor: skyColor,
    emissiveIntensity: skyIntensity,
    opacity: 0.92,
    isSoftwareGl,
  });
  const curtainMat = createPbrMaterial(tracker, {
    kind: 'rug',
    baseColor: curtainHex,
    accentColor: '#ffffff',
    repeatX: 1,
    repeatY: 2,
    roughness: 0.9,
  });

  const pane = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, h, 0.08)), glassMat);
  pane.position.set(x, y, z + 0.08);
  const topTrim = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.25, 0.14, 0.18)), frameMat);
  topTrim.position.set(x, y + h * 0.5 + 0.05, z + 0.1);
  const sill = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w + 0.28, 0.1, 0.24)), frameMat);
  sill.position.set(x, y - h * 0.5 - 0.04, z + 0.12);
  const vBar = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.06, h, 0.12)), frameMat);
  vBar.position.set(x, y, z + 0.11);
  const hBar = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(w, 0.06, 0.12)), frameMat);
  hBar.position.set(x, y, z + 0.11);

  group.add(pane, topTrim, sill, vBar, hBar);

  // Draped side curtains + rod
  const rod = new THREE.Mesh(
    tracker.track(new THREE.CylinderGeometry(0.03, 0.03, w + 1.1, 8)),
    tracker.track(new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.3 }))
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(x, y + h * 0.5 + 0.18, z + 0.22);
  group.add(rod);

  for (const side of [-1, 1]) {
    const drape = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.36, h + 0.45, 0.14)), curtainMat);
    drape.position.set(x + side * (w * 0.5 + 0.22), y - 0.1, z + 0.2);
    group.add(drape);
  }
}

function addPottedPlant(
  group: THREE.Group,
  tracker: WorldTracker,
  x: number,
  z: number,
  scale = 1
): void {
  const p = new THREE.Group();
  p.position.set(x, 0, z);
  p.scale.setScalar(scale);

  const pot = new THREE.Mesh(
    tracker.track(new THREE.CylinderGeometry(0.28, 0.2, 0.46, 10)),
    tracker.track(new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.72 }))
  );
  pot.position.y = 0.23;
  pot.castShadow = true;
  const soil = new THREE.Mesh(
    tracker.track(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 10)),
    tracker.track(new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.95 }))
  );
  soil.position.y = 0.44;
  p.add(pot, soil);

  const leafMat = tracker.track(
    new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.65, flatShading: true })
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(tracker.track(new THREE.ConeGeometry(0.16, 0.62, 5)), leafMat);
    leaf.position.set(Math.cos(a) * 0.14, 0.72 + (i % 2) * 0.12, Math.sin(a) * 0.14);
    leaf.rotation.z = -Math.cos(a) * 0.48;
    leaf.rotation.x = Math.sin(a) * 0.48;
    p.add(leaf);
  }

  group.add(p);
}

function addBookshelf(
  group: THREE.Group,
  tracker: WorldTracker,
  x: number,
  z: number,
  yaw = 0
): void {
  const shelf = new THREE.Group();
  shelf.position.set(x, 0, z);
  shelf.rotation.y = yaw;

  const woodMat = createPbrMaterial(tracker, {
    kind: 'wood',
    baseColor: '#78350f',
    accentColor: '#451a03',
    repeatX: 2,
    repeatY: 2,
  });
  const back = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.75, 2.35, 0.08)), woodMat);
  back.position.set(0, 1.175, -0.2);
  shelf.add(back);

  for (const sx of [-0.84, 0.84]) {
    const side = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 2.35, 0.44)), woodMat);
    side.position.set(sx, 1.175, 0);
    side.castShadow = true;
    shelf.add(side);
  }

  const bookColors = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#8b5cf6', '#f97316'];
  for (let row = 0; row < 4; row++) {
    const sy = 0.18 + row * 0.68;
    const plank = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.68, 0.07, 0.44)), woodMat);
    plank.position.set(0, sy, 0);
    shelf.add(plank);

    if (row < 3) {
      for (let b = 0; b < 7; b++) {
        const bh = 0.28 + ((b + row) % 3) * 0.06;
        const book = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(0.11, bh, 0.26)),
          tracker.track(
            new THREE.MeshStandardMaterial({
              color: bookColors[(b + row * 2) % bookColors.length],
              roughness: 0.72,
            })
          )
        );
        book.position.set(-0.62 + b * 0.18, sy + 0.04 + bh * 0.5, 0.03);
        shelf.add(book);
      }
    }
  }
  group.add(shelf);
}

function addFramedWallArt(
  group: THREE.Group,
  tracker: WorldTracker,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  artColor: string
): void {
  const frame = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.06)),
    tracker.track(new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.5 }))
  );
  frame.position.set(x, y, z + 0.03);
  const canvas = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(w, h, 0.07)),
    tracker.track(new THREE.MeshStandardMaterial({ color: artColor, roughness: 0.8 }))
  );
  canvas.position.set(x, y, z + 0.04);
  group.add(frame, canvas);
}

function addChairAndTable(
  group: THREE.Group,
  tracker: WorldTracker,
  x: number,
  z: number,
  woodMat: THREE.Material,
  chairColor: string
): void {
  const tableTop = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.7, 0.08, 1.05)), woodMat);
  tableTop.position.set(x, 0.78, z);
  tableTop.castShadow = true;
  group.add(tableTop);

  for (const lx of [-0.72, 0.72]) {
    for (const lz of [-0.42, 0.42]) {
      const leg = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 0.76, 0.08)), woodMat);
      leg.position.set(x + lx, 0.38, z + lz);
      group.add(leg);
    }
  }

  const seatMat = tracker.track(new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.7 }));
  for (const [cx, cz, yaw] of [
    [x - 1.05, z, Math.PI / 2],
    [x + 1.05, z, -Math.PI / 2],
  ]) {
    const chair = new THREE.Group();
    chair.position.set(cx, 0, cz);
    chair.rotation.y = yaw;
    const seat = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.48, 0.07, 0.48)), seatMat);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.48, 0.48, 0.07)), seatMat);
    back.position.set(0, 0.72, -0.2);
    for (const clx of [-0.19, 0.19]) {
      for (const clz of [-0.19, 0.19]) {
        const cleg = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.05, 0.45, 0.05)), woodMat);
        cleg.position.set(clx, 0.225, clz);
        chair.add(cleg);
      }
    }
    chair.add(seat, back);
    group.add(chair);
  }
}

export function buildDetailedInterior(
  tracker: WorldTracker,
  envType: EnvironmentType,
  timeOfDay: TimeOfDay,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = `interior_${envType}`;

  const isHouse = envType === 'cozy_house_interior' || envType === 'modern_house_interior';

  if (isHouse) {
    const isModern = envType === 'modern_house_interior';
    const floorMat = createPbrMaterial(tracker, {
      kind: 'wood',
      baseColor: isModern ? '#b48a60' : '#92400e',
      accentColor: isModern ? '#8a623c' : '#652a08',
      repeatX: 6,
      repeatY: 5,
      roughness: 0.56,
    });
    const floor = new THREE.Mesh(tracker.track(new THREE.PlaneGeometry(20, 16)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const wallMat = createPbrMaterial(tracker, {
      kind: 'plaster',
      baseColor: isModern ? '#f1f5f9' : '#fef3c7',
      accentColor: isModern ? '#e2e8f0' : '#fde68a',
      repeatX: 5,
      repeatY: 2,
      roughness: 0.86,
    });
    const baseboardMat = tracker.track(
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 })
    );

    // Back wall + left/right walls + ceiling well above camera frustum (y = 6.6)
    const backWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(20, 6.8, 0.35)), wallMat);
    backWall.position.set(0, 3.4, -4.9);
    backWall.receiveShadow = true;
    const leftWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.35, 6.8, 16)), wallMat);
    leftWall.position.set(-8.6, 3.4, 0.2);
    const rightWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.35, 6.8, 16)), wallMat);
    rightWall.position.set(8.6, 3.4, 0.2);
    const baseboard = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(17.5, 0.22, 0.08)), baseboardMat);
    baseboard.position.set(0, 0.11, -4.68);
    const ceiling = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(20, 0.25, 16)), baseboardMat);
    ceiling.position.set(0, 6.85, 0.2);
    group.add(backWall, leftWall, rightWall, baseboard, ceiling);

    // Woven area rug under central acting zone (flat at y = 0.015 so characters walk cleanly over it)
    const rugMat = createPbrMaterial(tracker, {
      kind: 'rug',
      baseColor: isModern ? '#334155' : '#4338ca',
      accentColor: isModern ? '#cbd5e1' : '#a5b4fc',
      repeatX: 2,
      repeatY: 2,
      roughness: 0.94,
      polygonOffset: true,
    });
    const rug = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(5.6, 0.03, 3.4)), rugMat);
    rug.position.set(0, 0.015, -0.2);
    rug.receiveShadow = true;
    group.add(rug);

    // Curtained sunlit/moonlit windows on back wall
    addInteriorWindow(group, tracker, -3.5, 2.8, -4.72, 2.2, 1.8, timeOfDay, isModern ? '#475569' : '#0f766e', isSoftwareGl);
    addInteriorWindow(group, tracker, 3.5, 2.8, -4.72, 2.2, 1.8, timeOfDay, isModern ? '#475569' : '#0f766e', isSoftwareGl);

    // Sofa + throw pillows + low coffee table behind character pad (z around -3.6)
    const sofaMat = createPbrMaterial(tracker, {
      kind: 'rug',
      baseColor: isModern ? '#475569' : '#0ea5e9',
      accentColor: isModern ? '#64748b' : '#38bdf8',
      repeatX: 3,
      repeatY: 2,
    });
    const sofaSeat = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.4, 0.48, 1.05)), sofaMat);
    sofaSeat.position.set(0, 0.3, -3.85);
    sofaSeat.castShadow = true;
    const sofaBack = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(3.4, 0.98, 0.28)), sofaMat);
    sofaBack.position.set(0, 0.72, -4.25);
    sofaBack.castShadow = true;
    for (const ax of [-1.6, 1.6]) {
      const arm = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.24, 0.68, 1.05)), sofaMat);
      arm.position.set(ax, 0.42, -3.85);
      group.add(arm);
    }
    const pillowMat = tracker.track(new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.85 }));
    for (const px of [-1.1, 1.1]) {
      const pillow = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.45, 0.4, 0.18)), pillowMat);
      pillow.position.set(px, 0.72, -3.95);
      pillow.rotation.z = px < 0 ? 0.18 : -0.18;
      group.add(pillow);
    }
    group.add(sofaSeat, sofaBack);

    const coffeeWood = createPbrMaterial(tracker, {
      kind: 'wood',
      baseColor: '#5c3317',
      accentColor: '#3d220e',
      repeatX: 2,
      repeatY: 1,
    });
    const coffeeTable = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.9, 0.1, 0.82)), coffeeWood);
    coffeeTable.position.set(0, 0.4, -2.55);
    coffeeTable.castShadow = true;
    for (const lx of [-0.78, 0.78]) {
      const leg = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 0.38, 0.65)), coffeeWood);
      leg.position.set(lx, 0.19, -2.55);
      group.add(leg);
    }
    group.add(coffeeTable);

    // Standing floor lamp (left-back) with warm point light
    const lampBase = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 12)),
      tracker.track(new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 }))
    );
    lampBase.position.set(-2.35, 0.04, -3.95);
    const lampPole = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.04, 0.05, 1.85, 8)),
      lampBase.material
    );
    lampPole.position.set(-2.35, 0.96, -3.95);
    const lampShade = new THREE.Mesh(
      tracker.track(new THREE.CylinderGeometry(0.24, 0.36, 0.38, 12)),
      tracker.track(
        new THREE.MeshStandardMaterial({
          color: '#fef3c7',
          emissive: '#fbbf24',
          emissiveIntensity: timeOfDay === 'night' ? 1.6 : 0.65,
          roughness: 0.7,
        })
      )
    );
    lampShade.position.set(-2.35, 1.92, -3.95);
    const warmLamp = new THREE.PointLight('#fde68a', timeOfDay === 'night' ? 5.5 : 2.6, 12, 1.6);
    warmLamp.position.set(-2.35, 1.85, -3.65);
    group.add(lampBase, lampPole, lampShade, warmLamp);

    // Dining / Kitchen nook on right flank (x = 5.4, z = -3.4) & Bookshelf + Bed/Study nook on left flank
    addChairAndTable(group, tracker, 5.4, -3.1, coffeeWood, isModern ? '#0f766e' : '#b45309');
    addBookshelf(group, tracker, -5.6, -4.3, 0);

    if (isModern) {
      // Kitchen counter + upper cabinets + stainless fridge against back-right wall
      const counterMat = createPbrMaterial(tracker, {
        kind: 'plaster',
        baseColor: '#f8fafc',
        accentColor: '#cbd5e1',
        repeatX: 2,
        repeatY: 1,
      });
      const counter = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.6, 0.92, 0.8)), counterMat);
      counter.position.set(6.4, 0.46, -4.35);
      const upperCab = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(2.4, 0.85, 0.45)), coffeeWood);
      upperCab.position.set(6.4, 2.35, -4.52);
      const fridge = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(0.95, 2.15, 0.88)),
        createPbrMaterial(tracker, {
          kind: 'metal',
          baseColor: '#cbd5e1',
          accentColor: '#94a3b8',
          repeatX: 1,
          repeatY: 2,
        })
      );
      fridge.position.set(4.5, 1.075, -4.32);
      group.add(counter, upperCab, fridge);
    } else {
      // Cozy door with architrave on left wall
      const door = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.14, 2.25, 1.1)), coffeeWood);
      door.position.set(-8.38, 1.125, -2.5);
      group.add(door);
    }

    addFramedWallArt(group, tracker, 0, 2.9, -4.72, 1.5, 1.05, '#0284c7');
    addPottedPlant(group, tracker, 2.35, -3.95, 1.05);
    addPottedPlant(group, tracker, -6.9, -3.9, 1.15);
  } else {
    // school_hallway or school_classroom
    const isClassroom = envType === 'school_classroom';
    const tileMat = createPbrMaterial(tracker, {
      kind: 'tile',
      baseColor: '#f1f5f9',
      accentColor: '#cbd5e1',
      repeatX: 8,
      repeatY: 6,
      roughness: 0.36,
    });
    const floor = new THREE.Mesh(tracker.track(new THREE.PlaneGeometry(24, 16)), tileMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const wallMat = createPbrMaterial(tracker, {
      kind: 'plaster',
      baseColor: '#f8fafc',
      accentColor: '#e2e8f0',
      repeatX: 6,
      repeatY: 2,
    });
    const wainscotMat = createPbrMaterial(tracker, {
      kind: 'brick',
      baseColor: '#d97706',
      accentColor: '#f1f5f9',
      repeatX: 8,
      repeatY: 2,
    });

    const backWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(24, 6.4, 0.36)), wallMat);
    backWall.position.set(0, 3.2, -4.8);
    backWall.receiveShadow = true;
    const wainscot = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(24, 1.25, 0.42)), wainscotMat);
    wainscot.position.set(0, 0.625, -4.78);
    const leftWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.36, 6.4, 16)), wallMat);
    leftWall.position.set(-9.5, 3.2, 0.2);
    const rightWall = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.36, 6.4, 16)), wallMat);
    rightWall.position.set(9.5, 3.2, 0.2);
    group.add(backWall, wainscot, leftWall, rightWall);

    // Overhead glowing school light troffers (high above camera at y = 6.1)
    for (const lx of [-4.2, 0, 4.2]) {
      const fixture = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.2, 0.12, 0.55)),
        tracker.track(
          new THREE.MeshStandardMaterial({
            color: '#ffffff',
            emissive: '#fef9c3',
            emissiveIntensity: 1.4,
          })
        )
      );
      fixture.position.set(lx, 6.15, -1.5);
      group.add(fixture);
    }

    if (isClassroom) {
      // Green chalkboard + chalk tray + clock + wall map + teacher desk + student desk rows
      const boardFrame = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(4.8, 1.9, 0.1)),
        createPbrMaterial(tracker, { kind: 'wood', baseColor: '#78350f', accentColor: '#451a03' })
      );
      boardFrame.position.set(0, 2.55, -4.58);
      const boardSurface = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(4.5, 1.65, 0.12)),
        tracker.track(new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.78 }))
      );
      boardSurface.position.set(0, 2.55, -4.56);

      const clock = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16)),
        tracker.track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }))
      );
      clock.rotation.x = Math.PI / 2;
      clock.position.set(0, 4.0, -4.56);

      group.add(boardFrame, boardSurface, clock);

      addInteriorWindow(group, tracker, -5.2, 2.6, -4.58, 2.1, 1.8, timeOfDay, '#1d4ed8', isSoftwareGl);
      addInteriorWindow(group, tracker, 5.2, 2.6, -4.58, 2.1, 1.8, timeOfDay, '#1d4ed8', isSoftwareGl);
      addBookshelf(group, tracker, 6.8, -4.2, 0);

      const deskWood = createPbrMaterial(tracker, {
        kind: 'wood',
        baseColor: '#d97706',
        accentColor: '#b45309',
      });
      const metalLeg = createPbrMaterial(tracker, {
        kind: 'metal',
        baseColor: '#334155',
        accentColor: '#1e293b',
      });

      // Teacher desk (back-left)
      const tDesk = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.9, 0.8, 0.9)), deskWood);
      tDesk.position.set(-2.4, 0.4, -3.5);
      tDesk.castShadow = true;
      group.add(tDesk);

      // Student desks + chairs arranged neatly flanking acting zone (x <= -3.5 or x >= 3.5 or z <= -2.6)
      for (const [dx, dz] of [
        [-4.2, -2.5],
        [4.2, -2.5],
        [0.4, -3.3],
        [2.4, -3.3],
      ]) {
        const dTop = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.05, 0.06, 0.68)), deskWood);
        dTop.position.set(dx, 0.72, dz);
        dTop.castShadow = true;
        const dBase = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.9, 0.7, 0.5)), metalLeg);
        dBase.position.set(dx, 0.35, dz);
        const cSeat = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(0.45, 0.44, 0.45)),
          tracker.track(new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.6 }))
        );
        cSeat.position.set(dx, 0.22, dz + 0.52);
        group.add(dTop, dBase, cSeat);
      }
    } else {
      // School Hallway: Detailed metal locker banks with louvered vents + bulletin boards + classroom door + sunlit windows
      const lockerMat = createPbrMaterial(tracker, {
        kind: 'metal',
        baseColor: '#1d4ed8',
        accentColor: '#1e40af',
        repeatX: 1,
        repeatY: 2,
        roughness: 0.35,
        metalness: 0.72,
      });
      const lockerTrimMat = tracker.track(
        new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.85, roughness: 0.25 })
      );

      for (let i = -5; i <= 5; i++) {
        // Leave center gap for double classroom door & bulletin board
        if (i === -1 || i === 0 || i === 1) continue;
        const lx = i * 1.12;
        const body = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.02, 2.55, 0.68)), lockerMat);
        body.position.set(lx, 1.275, -4.22);
        body.castShadow = true;
        const vent = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.55, 0.22, 0.04)), lockerTrimMat);
        vent.position.set(lx, 2.12, -3.86);
        const handle = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.08, 0.22, 0.06)), lockerTrimMat);
        handle.position.set(lx + 0.32, 1.35, -3.86);
        group.add(body, vent, handle);
      }

      // Double classroom wooden doors with glass transoms at center
      const doorWood = createPbrMaterial(tracker, {
        kind: 'wood',
        baseColor: '#92400e',
        accentColor: '#78350f',
      });
      const doorGlass = createGlassMaterial(tracker, {
        tintColor: '#bae6fd',
        emissiveColor: '#fef3c7',
        emissiveIntensity: 0.45,
        isSoftwareGl,
      });
      for (const side of [-0.56, 0.56]) {
        const doorLeaf = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(1.05, 2.45, 0.12)), doorWood);
        doorLeaf.position.set(side, 1.225, -4.55);
        const transom = new THREE.Mesh(tracker.track(new THREE.BoxGeometry(0.45, 0.85, 0.14)), doorGlass);
        transom.position.set(side, 1.68, -4.54);
        group.add(doorLeaf, transom);
      }

      // Cork bulletin board with pinned colorful flyers above lockers/doors
      const cork = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.6, 1.05, 0.08)),
        tracker.track(new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.92 }))
      );
      cork.position.set(0, 3.35, -4.56);
      group.add(cork);
      const flyerColors = ['#fef08a', '#fda4af', '#bae6fd', '#bbf7d0'];
      for (let f = 0; f < 4; f++) {
        const flyer = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(0.42, 0.52, 0.09)),
          tracker.track(new THREE.MeshStandardMaterial({ color: flyerColors[f], roughness: 0.85 }))
        );
        flyer.position.set(-0.85 + f * 0.56, 3.35 + (f % 2 === 0 ? 0.08 : -0.06), -4.54);
        flyer.rotation.z = (f - 1.5) * 0.05;
        group.add(flyer);
      }

      addInteriorWindow(group, tracker, -7.2, 2.5, -4.56, 1.6, 1.6, timeOfDay, '#1e3a8a', isSoftwareGl);
      addInteriorWindow(group, tracker, 7.2, 2.5, -4.56, 1.6, 1.6, timeOfDay, '#1e3a8a', isSoftwareGl);
      addPottedPlant(group, tracker, -2.0, -4.1, 0.95);
      addPottedPlant(group, tracker, 2.0, -4.1, 0.95);
    }
  }

  return group;
}
