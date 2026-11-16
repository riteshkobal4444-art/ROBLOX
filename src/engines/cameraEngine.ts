import * as THREE from 'three';
import type { CharacterRig } from './characterEngine';
import type { SceneSpec, TimelineSubtitle } from '../types/story';

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3(0, 1.0, 0);
const _groupBox = new THREE.Box3();
const _rigBox = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
let _hasLookInit = false;

/**
 * Computes tight world-space bounding box of one character rig, grounded cleanly at y >= 0.
 */
function expandBoxWithRig(targetBox: THREE.Box3, rig: CharacterRig): void {
  rig.root.updateMatrixWorld(true);
  _rigBox.makeEmpty();
  const meshBox = new THREE.Box3();
  rig.root.traverse((obj) => {
    if (obj.name === 'contact_shadow') return;
    if ((obj as THREE.Mesh).isMesh) {
      meshBox.setFromObject(obj);
      _rigBox.union(meshBox);
    }
  });

  if (_rigBox.isEmpty() || !Number.isFinite(_rigBox.min.x)) {
    const p = rig.root.position;
    const s = rig.spec.appearance.bodyScale || 1;
    _rigBox.set(
      new THREE.Vector3(p.x - 0.65 * s, 0, p.z - 0.55 * s),
      new THREE.Vector3(p.x + 0.65 * s, 2.25 * s, p.z + 0.55 * s)
    );
  } else {
    _rigBox.min.y = Math.max(0, Math.min(_rigBox.min.y, 0));
  }
  targetBox.union(_rigBox);
}

export function computeCharactersBoundingBox(
  rigs: Map<string, CharacterRig>,
  subjectIds?: string[]
): THREE.Box3 | null {
  _groupBox.makeEmpty();
  let count = 0;

  if (subjectIds && subjectIds.length > 0) {
    for (const id of subjectIds) {
      const rig = rigs.get(id);
      if (rig && rig.root.visible) {
        expandBoxWithRig(_groupBox, rig);
        count++;
      }
    }
  }

  if (count === 0) {
    for (const rig of rigs.values()) {
      if (rig.root.visible) {
        expandBoxWithRig(_groupBox, rig);
        count++;
      }
    }
  }

  return count > 0 ? _groupBox.clone() : null;
}

export function updateCameraForScene(
  camera: THREE.PerspectiveCamera,
  scene: SceneSpec,
  rigs: Map<string, CharacterRig>,
  sceneLocalTime: number,
  deltaSec: number,
  activeSubtitle: TimelineSubtitle | undefined,
  snapImmediate = false
): void {
  const progress = Math.max(0, Math.min(1, sceneLocalTime / Math.max(0.1, scene.durationSec)));

  const visibleIds: string[] = [];
  for (const [id, rig] of rigs.entries()) {
    if (rig.root.visible) visibleIds.push(id);
  }

  const activeSpeakerId =
    activeSubtitle && !activeSubtitle.isNarration && activeSubtitle.speakerId
      ? activeSubtitle.speakerId
      : undefined;

  // For close-up shots with an active speaker, frame that speaker cleanly;
  // for all multi-character, establishing, pan, push, and tracking shots, keep ALL visible characters inside frame!
  const subjectIds =
    scene.cameraShot === 'close_up_speaker' &&
    activeSpeakerId &&
    visibleIds.includes(activeSpeakerId)
      ? [activeSpeakerId]
      : visibleIds;

  const box = computeCharactersBoundingBox(rigs, subjectIds);

  if (!box) {
    _center.set(0, 1.05, 0);
    _size.set(1.8, 2.1, 1.2);
  } else {
    box.getCenter(_center);
    box.getSize(_size);
  }

  // Shot-calibrated framing parameters (always keeping full head-to-feet & sides clear of subtitles and edges)
  let yawAngle = 0;
  let fillV = 0.56;
  let fillH = 0.8;
  let pitchRatio = 0.14;
  let minDist = 3.6;

  switch (scene.cameraShot) {
    case 'close_up_speaker':
      yawAngle = 0.14;
      fillV = 0.62;
      fillH = 0.78;
      pitchRatio = 0.12;
      minDist = 3.4;
      break;
    case 'medium_two_shot':
      yawAngle = 0.08 * Math.sin(progress * Math.PI);
      fillV = 0.56;
      fillH = 0.8;
      pitchRatio = 0.14;
      minDist = 4.0;
      break;
    case 'tracking_follow':
      yawAngle = -0.16;
      fillV = 0.55;
      fillH = 0.78;
      pitchRatio = 0.16;
      minDist = 4.1;
      break;
    case 'slow_pan':
      yawAngle = THREE.MathUtils.lerp(-0.2, 0.2, progress);
      fillV = 0.52;
      fillH = 0.78;
      pitchRatio = 0.16;
      minDist = 4.4;
      break;
    case 'dramatic_push':
      yawAngle = THREE.MathUtils.lerp(0.15, 0.05, progress);
      fillV = THREE.MathUtils.lerp(0.5, 0.62, progress);
      fillH = 0.8;
      pitchRatio = THREE.MathUtils.lerp(0.17, 0.12, progress);
      minDist = 3.5;
      break;
    case 'wide_establishing':
    default:
      yawAngle = THREE.MathUtils.lerp(-0.12, 0.12, progress);
      fillV = 0.49;
      fillH = 0.8;
      pitchRatio = 0.18;
      minDist = 4.8;
      break;
  }

  const halfTanV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const halfTanH = halfTanV * Math.max(0.35, camera.aspect);

  const padX = 0.26;
  const padYTop = 0.22;
  const padYBot = 0.08;
  const padZ = 0.26;

  const absCos = Math.abs(Math.cos(yawAngle));
  const absSin = Math.abs(Math.sin(yawAngle));

  const projW = _size.x * absCos + _size.z * absSin + padX * 2;
  const frontHalfD = (_size.x * absSin + _size.z * absCos) * 0.5 + padZ;
  const projH = Math.max(1.85, _size.y + padYTop + padYBot);

  const dV = (projH * 0.5) / (fillV * halfTanV) + frontHalfD;
  const dH = (projW * 0.5) / (fillH * halfTanH) + frontHalfD;
  const dist = THREE.MathUtils.clamp(Math.max(minDist, dV, dH), 3.4, 13.5);

  // Shift lookY slightly lower than geometric center so characters sit in upper-middle viewport, clear of bottom subtitles
  const halfFrustumY = dist * halfTanV;
  const subtitleClearanceShift = 0.16 * halfFrustumY;
  const lookY = THREE.MathUtils.clamp(_center.y - subtitleClearanceShift, 0.42, _center.y);

  _targetLook.set(_center.x, lookY, _center.z);

  let camX = _targetLook.x + Math.sin(yawAngle) * dist;
  let camZ = _targetLook.z + Math.cos(yawAngle) * dist;
  const camY = THREE.MathUtils.clamp(lookY + dist * pitchRatio, 1.5, 4.2);

  // Respect indoor lateral wall boundaries while keeping open front (+Z) unobstructed
  const isIndoor =
    scene.environmentType === 'cozy_house_interior' ||
    scene.environmentType === 'modern_house_interior' ||
    scene.environmentType === 'school_hallway' ||
    scene.environmentType === 'school_classroom';
  if (isIndoor) {
    camX = THREE.MathUtils.clamp(camX, -6.2, 6.2);
    camZ = THREE.MathUtils.clamp(camZ, 2.2, 13.5);
  }

  _targetPos.set(camX, camY, camZ);

  if (snapImmediate || !_hasLookInit) {
    camera.position.copy(_targetPos);
    _currentLook.copy(_targetLook);
    _hasLookInit = true;
    camera.lookAt(_currentLook);
    camera.updateMatrixWorld(true);
    return;
  }

  const dt = Math.max(1 / 120, Math.min(0.1, deltaSec));
  const lambda = 5.2;
  camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetPos.x, lambda, dt);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetPos.y, lambda, dt);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetPos.z, lambda, dt);

  _currentLook.x = THREE.MathUtils.damp(_currentLook.x, _targetLook.x, lambda, dt);
  _currentLook.y = THREE.MathUtils.damp(_currentLook.y, _targetLook.y, lambda, dt);
  _currentLook.z = THREE.MathUtils.damp(_currentLook.z, _targetLook.z, lambda, dt);

  camera.lookAt(_currentLook);
  camera.updateMatrixWorld(true);
}
