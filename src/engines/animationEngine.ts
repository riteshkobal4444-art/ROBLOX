import * as THREE from 'three';
import { sampleSegmentMouthAtTime } from './audio/lipSyncAnalyzer';
import { applySmoothFaceState, type CharacterRig } from './characterEngine';
import type { SpeechAudioSegment } from '../types/audio';
import type {
  ActionBeat,
  FaceExpression,
  SceneSpec,
  TimelineSubtitle,
} from '../types/story';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function clampAngle(rad: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, rad));
}

function normalizeAngleRad(rad: number): number {
  let a = (rad + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

function dampAngleRad(current: number, target: number, lambda: number, deltaSec: number): number {
  const diff = normalizeAngleRad(target - current);
  const factor = 1 - Math.exp(-lambda * deltaSec);
  return current + diff * factor;
}

/**
 * Resolves a consistent emotional expression from explicit emotion tags and dialogue context.
 * Ensures sad, angry, scared, confused, and excited lines map faithfully even on older/neutral tags.
 */
export function resolveLineContextualEmotion(
  rawEmotion: FaceExpression | undefined,
  text: string,
  sceneMood: SceneSpec['mood']
): FaceExpression {
  const lower = text.toLowerCase();

  // Respect explicit primary emotions if already specified
  if (
    rawEmotion &&
    ['happy', 'sad', 'angry', 'surprised', 'confused', 'scared', 'excited'].includes(rawEmotion)
  ) {
    return rawEmotion;
  }

  // Contextual emotional inference when line emotion is neutral or a legacy tag ('determined' | 'worried')
  if (
    /\b(angry|furious|stop it|how dare|unfair|your fault|leave me alone|shut up|never forgive|mad at)\b/.test(
      lower
    )
  ) {
    return 'angry';
  }

  if (
    /\b(scared|afraid|terrified|run away|watch out|help me|monster|ghost|trapped|panic|horrified)\b/.test(
      lower
    )
  ) {
    return 'scared';
  }

  if (
    /\b(confused|wait what|makes no sense|huh\b|why would|what do you mean|how is that possible)\b/.test(
      lower
    )
  ) {
    return 'confused';
  }

  if (
    /\b(sad|sorry|cry|crying|tears|miss you|goodbye|lonely|heartbroken|grief|lost everything)\b/.test(
      lower
    )
  ) {
    return 'sad';
  }

  if (
    /\b(awesome|amazing|can't wait|let's go|woohoo|incredible|best day|pulled that off)\b/.test(
      lower
    )
  ) {
    return 'excited';
  }

  if (rawEmotion && rawEmotion !== 'neutral') {
    if (rawEmotion === 'worried' && sceneMood === 'sad') return 'sad';
    return rawEmotion;
  }

  // Fallback to scene mood subtly if dialogue had 'neutral' without strong words
  if (sceneMood === 'sad') return 'sad';
  if (sceneMood === 'tense') return 'worried';
  if (sceneMood === 'mysterious') return 'confused';
  return 'neutral';
}

function resolveListenerReaction(
  listenerIdx: number,
  listenerSpec: CharacterRig['spec'],
  speakerEmotion: FaceExpression,
  sceneMood: SceneSpec['mood']
): {
  expression: FaceExpression;
  nodStrength: number;
  tiltZ: number;
  leanBackX: number;
} {
  const personality = listenerSpec.personality.toLowerCase();
  const bold = /bold|fierce|stubborn|rival|brave|hotheaded|protective/.test(personality);

  switch (speakerEmotion) {
    case 'angry':
      // Argument: differentiated reactions rather than clones
      return bold || listenerIdx % 2 === 1
        ? { expression: 'angry', nodStrength: 0.04, tiltZ: -0.05, leanBackX: 0.08 }
        : { expression: 'worried', nodStrength: 0.02, tiltZ: 0.08, leanBackX: -0.1 };
    case 'surprised':
    case 'scared':
      return {
        expression: speakerEmotion === 'scared' && !bold ? 'scared' : 'surprised',
        nodStrength: 0.01,
        tiltZ: listenerIdx % 2 === 0 ? -0.06 : 0.06,
        leanBackX: -0.12,
      };
    case 'confused':
      return {
        expression: 'confused',
        nodStrength: 0.02,
        tiltZ: 0.14,
        leanBackX: -0.03,
      };
    case 'sad':
    case 'worried':
      return {
        expression: 'sad',
        nodStrength: 0.045,
        tiltZ: 0.1,
        leanBackX: 0.06,
      };
    case 'happy':
    case 'excited':
      return {
        expression: 'happy',
        nodStrength: 0.065,
        tiltZ: listenerIdx % 2 === 0 ? -0.05 : 0.05,
        leanBackX: -0.02,
      };
    case 'neutral':
    case 'determined':
    default:
      return {
        expression: sceneMood === 'sad' ? 'sad' : 'neutral',
        nodStrength: 0.045,
        tiltZ: listenerIdx % 2 === 0 ? 0.06 : -0.04,
        leanBackX: 0.02,
      };
  }
}

export function updateCharactersForSceneTime(
  rigs: Map<string, CharacterRig>,
  scene: SceneSpec,
  sceneLocalTime: number,
  globalTime: number,
  activeSubtitle: TimelineSubtitle | undefined,
  activeSegment?: SpeechAudioSegment,
  deltaSec = 1 / 24
): void {
  const dt = Math.max(1 / 120, Math.min(0.1, deltaSec));

  // Find active beat per character
  const activeBeats = new Map<string, ActionBeat>();
  const fallbackBeats = new Map<string, ActionBeat>();

  for (const beat of scene.actionBeats) {
    if (!fallbackBeats.has(beat.characterId)) {
      fallbackBeats.set(beat.characterId, beat);
    }
    if (sceneLocalTime >= beat.startOffsetSec && sceneLocalTime <= beat.endOffsetSec) {
      activeBeats.set(beat.characterId, beat);
    }
  }

  // First pass: position visible characters & compute speaker world location for gaze tracking
  const speakerId =
    activeSubtitle && !activeSubtitle.isNarration && activeSubtitle.speakerId
      ? activeSubtitle.speakerId
      : undefined;

  const charPositions = new Map<string, { x: number; z: number }>();

  for (const [charId, rig] of rigs.entries()) {
    const beat = activeBeats.get(charId) ?? fallbackBeats.get(charId);
    if (!beat) {
      rig.root.visible = false;
      continue;
    }
    rig.root.visible = true;

    const span = Math.max(0.01, beat.endOffsetSec - beat.startOffsetSec);
    const smoothT = Math.max(0, Math.min(1, (sceneLocalTime - beat.startOffsetSec) / span));
    const posX = lerp(beat.fromX, beat.toX, smoothT);
    const posZ = lerp(beat.fromZ, beat.toZ, smoothT);

    rig.root.position.x = posX;
    rig.root.position.y = 0;
    rig.root.position.z = posZ;
    charPositions.set(charId, { x: posX, z: posZ });
  }

  const speakerPos = speakerId ? charPositions.get(speakerId) : undefined;
  const speakerEmotion: FaceExpression = activeSubtitle
    ? resolveLineContextualEmotion(activeSubtitle.emotion, activeSubtitle.text, scene.mood)
    : 'neutral';

  let idx = 0;
  for (const [charId, rig] of rigs.entries()) {
    const beat = activeBeats.get(charId) ?? fallbackBeats.get(charId);
    if (!beat || !rig.root.visible) {
      idx++;
      continue;
    }

    const isSceneCut = rig.animState.lastSceneId !== scene.id;
    rig.animState.lastSceneId = scene.id;

    const isSpeaking = Boolean(speakerId && speakerId === charId);
    const isSomeoneElseSpeaking = Boolean(speakerId && speakerId !== charId);

    // Real audio-driven lip-sync: STRICTLY zero during narration or silence
    const mouthSample = isSpeaking
      ? sampleSegmentMouthAtTime(
          activeSegment && activeSegment.speakerId === charId ? activeSegment : undefined,
          globalTime
        )
      : { open: 0, shape: 'closed' as const };
    const speechEnergy = isSpeaking ? mouthSample.open : 0;

    const span = Math.max(0.01, beat.endOffsetSec - beat.startOffsetSec);
    const smoothT = Math.max(0, Math.min(1, (sceneLocalTime - beat.startOffsetSec) / span));

    const dx = beat.toX - beat.fromX;
    const dz = beat.toZ - beat.fromZ;
    const isMovingAction = beat.action === 'walk' || beat.action === 'run';

    // Determine facing yaw (look toward movement while walking/running, else script facingYawDeg + gentle turn toward speaker)
    let targetYaw = THREE.MathUtils.degToRad(beat.facingYawDeg);
    if (isMovingAction && Math.hypot(dx, dz) > 0.15) {
      targetYaw = Math.atan2(dx, dz);
    } else if (speakerPos && isSomeoneElseSpeaking && beat.action !== 'turn' && beat.action !== 'fall') {
      const selfPos = charPositions.get(charId)!;
      const toSpeakerYaw = Math.atan2(speakerPos.x - selfPos.x, speakerPos.z - selfPos.z);
      // Turn body halfway toward speaker while preserving natural staging
      const diff = normalizeAngleRad(toSpeakerYaw - targetYaw);
      targetYaw += clampAngle(diff * 0.45, 0.55);
    }

    if (beat.action === 'turn') {
      targetYaw = THREE.MathUtils.degToRad(beat.facingYawDeg) + smoothT * Math.PI;
    }

    if (isSceneCut) {
      rig.animState.rootYaw = targetYaw;
    } else {
      rig.animState.rootYaw = dampAngleRad(rig.animState.rootYaw, targetYaw, 8, dt);
    }
    rig.root.rotation.y = rig.animState.rootYaw;

    // Gaze offset for neck/head toward speaker or partner character
    let desiredHeadYaw = 0;
    if (speakerPos && isSomeoneElseSpeaking) {
      const selfPos = charPositions.get(charId)!;
      const worldYawToSpeaker = Math.atan2(speakerPos.x - selfPos.x, speakerPos.z - selfPos.z);
      desiredHeadYaw = clampAngle(normalizeAngleRad(worldYawToSpeaker - rig.animState.rootYaw), 0.68);
    } else if (isSpeaking) {
      // Speaker glances toward nearest other visible character
      const selfPos = charPositions.get(charId)!;
      let nearestDiff: number | null = null;
      let nearestDist = Infinity;
      for (const [otherId, otherPos] of charPositions.entries()) {
        if (otherId === charId) continue;
        const d = Math.hypot(otherPos.x - selfPos.x, otherPos.z - selfPos.z);
        if (d < nearestDist) {
          nearestDist = d;
          const worldYaw = Math.atan2(otherPos.x - selfPos.x, otherPos.z - selfPos.z);
          nearestDiff = normalizeAngleRad(worldYaw - rig.animState.rootYaw);
        }
      }
      if (nearestDiff !== null) {
        desiredHeadYaw = clampAngle(nearestDiff * 0.65, 0.5);
      }
    }

    // Target joint poses (preserving walk/run + speaking harmony!)
    let targetPelvisY = 0.78;
    let targetPelvisRotX = 0;
    let targetTorsoRotX = 0;
    let targetTorsoRotY = 0;
    let targetHeadRotX = 0;
    let targetHeadRotY = desiredHeadYaw;
    let targetHeadRotZ = 0;
    let targetLeftArmX = 0;
    let targetLeftArmZ = 0.08;
    let targetRightArmX = 0;
    let targetRightArmZ = -0.08;
    let targetLeftLegX = 0;
    let targetRightLegX = 0;

    // Determine effective expression
    let targetEmotion: FaceExpression = rig.spec.appearance.faceExpression;

    // 1. Primary Locomotion & Scripted Action Layer
    const action = isSpeaking && beat.action === 'stand' ? 'talk' : beat.action;

    if (action === 'walk' || action === 'run') {
      const freq = action === 'run' ? 11 : 6.5;
      const amp = action === 'run' ? 0.85 : 0.55;
      const phase = globalTime * freq + idx * 0.7;
      const swing = Math.sin(phase) * amp;
      targetLeftLegX = swing;
      targetRightLegX = -swing;
      targetLeftArmX = -swing * 0.82;
      targetRightArmX = swing * 0.82;
      targetPelvisY = 0.78 + Math.abs(Math.sin(phase)) * (action === 'run' ? 0.1 : 0.05);
      targetTorsoRotX = action === 'run' ? 0.16 : 0.06;

      // Conflict-free speaking while walking/running: subtle upper-head nod + one conversational hand if walking
      if (isSpeaking) {
        targetEmotion = speakerEmotion;
        targetHeadRotX += Math.sin(globalTime * 5.2) * (0.04 + speechEnergy * 0.06);
        if (action === 'walk') {
          targetRightArmX = -0.32 + Math.sin(globalTime * 4.1) * (0.14 + speechEnergy * 0.18);
        }
      } else if (scene.mood === 'sad') {
        targetEmotion = 'sad';
      } else if (scene.mood === 'upbeat' || scene.mood === 'heartwarming' || scene.mood === 'playful') {
        targetEmotion = 'happy';
      }
    } else if (action === 'wave') {
      targetRightArmZ = -2.55;
      targetRightArmX = Math.sin(globalTime * 8) * 0.35;
      targetHeadRotZ = Math.sin(globalTime * 4) * 0.08;
      targetEmotion = isSpeaking ? speakerEmotion : 'happy';
    } else if (action === 'point') {
      targetRightArmX = -1.45;
      targetRightArmZ = -0.12;
      targetTorsoRotY = -0.18;
      if (isSpeaking) targetEmotion = speakerEmotion;
    } else if (action === 'sit') {
      targetPelvisY = 0.44;
      targetLeftLegX = -1.35;
      targetRightLegX = -1.35;
      targetLeftArmX = -0.35;
      targetRightArmX = -0.35;
      if (isSpeaking) {
        targetEmotion = speakerEmotion;
        targetRightArmX = -0.55 - speechEnergy * 0.35;
        targetHeadRotX = Math.sin(globalTime * 4.8) * (0.03 + speechEnergy * 0.05);
      }
    } else if (action === 'react_surprise') {
      const hop = Math.abs(Math.sin(Math.min(1, smoothT * 2.5) * Math.PI)) * 0.32;
      targetPelvisY = 0.78 + hop;
      targetLeftArmZ = 2.05;
      targetRightArmZ = -2.05;
      targetTorsoRotX = -0.14;
      targetHeadRotX = -0.16;
      targetEmotion = isSpeaking ? speakerEmotion : 'surprised';
    } else if (action === 'react_happy') {
      const bounce = Math.abs(Math.sin(globalTime * 7)) * 0.22;
      targetPelvisY = 0.78 + bounce;
      targetLeftArmZ = 2.35 + Math.sin(globalTime * 10) * 0.2;
      targetRightArmZ = -2.35 - Math.sin(globalTime * 10) * 0.2;
      targetEmotion = isSpeaking ? speakerEmotion : 'excited';
    } else if (action === 'look_around') {
      targetHeadRotY = Math.sin(globalTime * 2.1 + idx) * 0.55;
      targetTorsoRotY = Math.sin(globalTime * 1.3 + idx) * 0.16;
      targetEmotion = isSpeaking ? speakerEmotion : scene.mood === 'mysterious' ? 'confused' : 'neutral';
    } else if (action === 'fall') {
      const fallT = Math.min(1, smoothT * 1.6);
      targetPelvisY = lerp(0.78, 0.22, fallT);
      targetPelvisRotX = lerp(0, -1.42, fallT);
      targetLeftArmZ = 1.1;
      targetRightArmZ = -1.1;
      targetEmotion = 'scared';
    } else if (isSpeaking || action === 'talk') {
      // Expressive emotion-consistent speaking gestures driven by real audio speechEnergy
      targetEmotion = isSpeaking ? speakerEmotion : 'neutral';
      const talkAmp = isSpeaking ? 0.35 + speechEnergy * 0.65 : 0.25;
      const gestureA = Math.sin(globalTime * 3.1 + idx) * 0.65 + Math.sin(globalTime * 5.3) * 0.35;
      const gestureB = Math.cos(globalTime * 2.7 + idx * 0.8) * 0.65 + Math.sin(globalTime * 4.4) * 0.35;

      if (targetEmotion === 'angry') {
        // Argument posture: forward lean, sharp emphatic gestures, firm head shakes
        targetTorsoRotX = 0.13;
        targetRightArmX = -0.85 - Math.abs(gestureA) * 0.45 * talkAmp;
        targetRightArmZ = -0.22 - Math.abs(gestureA) * 0.15;
        targetLeftArmX = -0.45 + gestureB * 0.2 * talkAmp;
        targetLeftArmZ = 0.24;
        targetHeadRotY += Math.sin(globalTime * 7.2) * 0.1 * talkAmp;
        targetHeadRotX = 0.08 + Math.sin(globalTime * 5.6) * 0.06 * talkAmp;
      } else if (targetEmotion === 'sad' || targetEmotion === 'worried') {
        // Sad posture: slight slump, lowered head, gentle inward arms, subdued movement
        targetTorsoRotX = 0.14;
        targetHeadRotX = 0.18 + Math.sin(globalTime * 2.1) * 0.03;
        targetHeadRotZ = 0.08 * Math.sin(globalTime * 1.2);
        targetLeftArmX = -0.18 + gestureB * 0.07 * talkAmp;
        targetRightArmX = -0.22 + gestureA * 0.09 * talkAmp;
        targetLeftArmZ = -0.05;
        targetRightArmZ = 0.05;
      } else if (targetEmotion === 'scared') {
        // Scared posture: slight crouch, protective raised hands, quick nervous glances
        targetPelvisY = 0.72;
        targetTorsoRotX = -0.08;
        targetLeftArmX = -0.95;
        targetRightArmX = -0.95;
        targetLeftArmZ = -0.28;
        targetRightArmZ = 0.28;
        targetHeadRotY += Math.sin(globalTime * 6.5) * 0.14;
      } else if (targetEmotion === 'confused') {
        // Confused: head tilt + single-hand shrug
        targetHeadRotZ = 0.2;
        targetRightArmX = -0.68 - Math.abs(gestureA) * 0.2 * talkAmp;
        targetRightArmZ = -0.45;
        targetLeftArmX = -0.15;
        targetLeftArmZ = 0.18;
      } else if (targetEmotion === 'excited' || targetEmotion === 'happy') {
        // Happy/excited: lifted chest, lively open hand gestures, upbeat bounce
        targetPelvisY = 0.78 + Math.abs(Math.sin(globalTime * 4.5)) * 0.035 * talkAmp;
        targetTorsoRotX = -0.04;
        targetLeftArmX = -0.58 + gestureB * 0.34 * talkAmp;
        targetRightArmX = -0.68 + gestureA * 0.38 * talkAmp;
        targetLeftArmZ = 0.26 + Math.abs(gestureB) * 0.18 * talkAmp;
        targetRightArmZ = -0.26 - Math.abs(gestureA) * 0.18 * talkAmp;
        targetHeadRotX = Math.sin(globalTime * 4.8) * 0.06 * talkAmp;
        targetHeadRotZ = Math.sin(globalTime * 2.4) * 0.06;
      } else if (targetEmotion === 'surprised') {
        // Surprised speaking: raised palms, slight lean back
        targetTorsoRotX = -0.1;
        targetLeftArmX = -0.85;
        targetRightArmX = -0.85;
        targetLeftArmZ = 0.45;
        targetRightArmZ = -0.45;
        targetHeadRotX = -0.1;
      } else {
        // Calm/neutral conversation: natural moderate single-hand emphasis + subtle nods
        targetRightArmX = -0.42 + gestureA * 0.22 * talkAmp;
        targetRightArmZ = -0.16;
        targetLeftArmX = -0.14 + gestureB * 0.08 * talkAmp;
        targetHeadRotX = Math.sin(globalTime * 3.8) * 0.05 * talkAmp;
        targetHeadRotZ = Math.sin(globalTime * 1.9) * 0.04;
      }
    } else if (isSomeoneElseSpeaking && (action === 'listen' || action === 'stand')) {
      // Listening & differentiated emotional reaction to speaker!
      const reaction = resolveListenerReaction(
        idx,
        rig.spec,
        speakerEmotion,
        scene.mood
      );
      targetEmotion = reaction.expression;
      targetTorsoRotX = reaction.leanBackX;
      targetHeadRotZ = reaction.tiltZ;

      // Natural periodic nodding (non-repetitive burst envelope)
      const nodWindow = Math.max(0, Math.sin(globalTime * 1.35 + idx * 1.7));
      targetHeadRotX = Math.sin(globalTime * 5.2 + idx) * reaction.nodStrength * nodWindow;

      const breath = Math.sin(globalTime * 2.1 + idx * 1.3) * 0.022;
      targetPelvisY = 0.78 + breath;

      if (reaction.expression === 'angry') {
        // Crossed/tense defensive stance during argument
        targetLeftArmX = -0.42;
        targetRightArmX = -0.42;
        targetLeftArmZ = -0.22;
        targetRightArmZ = 0.22;
      } else if (reaction.expression === 'scared' || reaction.expression === 'surprised') {
        targetLeftArmX = -0.55;
        targetRightArmX = -0.55;
        targetLeftArmZ = 0.35;
        targetRightArmZ = -0.35;
      } else {
        targetLeftArmX = Math.sin(globalTime * 1.7 + idx) * 0.04;
        targetRightArmX = -Math.sin(globalTime * 1.7 + idx) * 0.04;
      }
    } else {
      // Natural idle breathing & weight shift when silent
      const breath = Math.sin(globalTime * 2.1 + idx * 1.4) * 0.024;
      targetPelvisY = 0.78 + breath;
      targetLeftArmX = Math.sin(globalTime * 1.5 + idx) * 0.045;
      targetRightArmX = -Math.sin(globalTime * 1.5 + idx) * 0.045;
      targetHeadRotY += Math.sin(globalTime * 0.9 + idx * 2.1) * 0.06;
      targetHeadRotZ = Math.sin(globalTime * 1.1 + idx) * 0.03;

      // Scene-mood ambient expression during silent moments
      if (scene.mood === 'sad') targetEmotion = 'sad';
      else if (scene.mood === 'upbeat' || scene.mood === 'heartwarming' || scene.mood === 'playful')
        targetEmotion = 'happy';
    }

    // Smoothly damp joint transforms (snap on scene cut so characters don't slide from prior scene's pose)
    const poseLambda = isSceneCut ? 1000 : 12;
    const s = rig.animState;
    s.pelvisY = THREE.MathUtils.damp(s.pelvisY, targetPelvisY, poseLambda, dt);
    s.pelvisRotX = THREE.MathUtils.damp(s.pelvisRotX, targetPelvisRotX, poseLambda, dt);
    s.torsoRotX = THREE.MathUtils.damp(s.torsoRotX, targetTorsoRotX, poseLambda, dt);
    s.torsoRotY = THREE.MathUtils.damp(s.torsoRotY, targetTorsoRotY, poseLambda, dt);
    s.headRotX = THREE.MathUtils.damp(s.headRotX, targetHeadRotX, poseLambda, dt);
    s.headRotY = THREE.MathUtils.damp(s.headRotY, targetHeadRotY, poseLambda, dt);
    s.headRotZ = THREE.MathUtils.damp(s.headRotZ, targetHeadRotZ, poseLambda, dt);
    s.leftArmX = THREE.MathUtils.damp(s.leftArmX, targetLeftArmX, poseLambda, dt);
    s.leftArmZ = THREE.MathUtils.damp(s.leftArmZ, targetLeftArmZ, poseLambda, dt);
    s.rightArmX = THREE.MathUtils.damp(s.rightArmX, targetRightArmX, poseLambda, dt);
    s.rightArmZ = THREE.MathUtils.damp(s.rightArmZ, targetRightArmZ, poseLambda, dt);
    s.leftLegX = THREE.MathUtils.damp(s.leftLegX, targetLeftLegX, poseLambda, dt);
    s.rightLegX = THREE.MathUtils.damp(s.rightLegX, targetRightLegX, poseLambda, dt);

    rig.pelvis.position.y = s.pelvisY;
    rig.pelvis.rotation.set(s.pelvisRotX, 0, 0);
    rig.torso.rotation.set(s.torsoRotX, s.torsoRotY, 0);
    rig.headGroup.rotation.set(s.headRotX, s.headRotY, s.headRotZ);
    rig.leftArmPivot.rotation.set(s.leftArmX, 0, s.leftArmZ);
    rig.rightArmPivot.rotation.set(s.rightArmX, 0, s.rightArmZ);
    rig.leftLegPivot.rotation.set(s.leftLegX, 0, 0);
    rig.rightLegPivot.rotation.set(s.rightLegX, 0, 0);

    // Subtle natural blink cycle staggered per character (~every 3.4s, 140ms blink)
    const blinkCycle = (globalTime + idx * 1.37) % 3.4;
    const blinkAmount =
      targetEmotion === 'surprised' || targetEmotion === 'scared'
        ? 0
        : blinkCycle < 0.14
          ? Math.sin((blinkCycle / 0.14) * Math.PI)
          : 0;

    // Smooth expression + real-time audio-driven lip-sync
    applySmoothFaceState(
      rig,
      targetEmotion,
      mouthSample.open,
      mouthSample.shape,
      blinkAmount,
      isSceneCut ? 0.5 : dt
    );

    idx++;
  }
}
