import * as THREE from 'three';
import type { MouthVisemeShape } from '../types/audio';
import type {
  CharacterSpec,
  CharacterStylePreset,
  FaceExpression,
  FaceStyle,
  HairStyle,
  OutfitStyle,
} from '../types/story';

export interface FaceParamTarget {
  browLeftY: number;     // vertical offset (-10 down to +14 up)
  browRightY: number;
  browLeftTilt: number;  // positive = inner end higher (sad/worried), negative = inner end lower (angry)
  browRightTilt: number;
  eyeScaleY: number;     // 0.65 (happy squint / angry) to 1.38 (surprised / scared)
  pupilScale: number;    // 0.65 (scared) to 1.15 (happy/excited)
  eyeSparkle: number;    // 0..1 extra catchlight for excited/happy
  upperLidDrop: number;  // 0..0.45 heavy lid / angry/sad weight
  angryFurrow: number;   // 0..1 brow crease lines
  tearGlisten: number;   // 0..1 subtle tear highlight for sad
  mouthCurve: number;    // -1 (frown) .. 0 (flat) .. +1 (smile)
  mouthWidth: number;    // 0.65 .. 1.3
  mouthTilt: number;     // -0.25 .. +0.25 asymmetric slant (confused)
  blushAlpha: number;    // 0..0.38
  sweatDrop: number;     // 0..1 (scared/nervous cue)
}

export interface FaceStyleOptions {
  faceStyle: FaceStyle;
  hairColor: string;
  eyeColor: string;
}

export interface CharacterAnimState {
  lastSceneId: string;
  pelvisY: number;
  pelvisRotX: number;
  torsoRotX: number;
  torsoRotY: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  leftArmX: number;
  leftArmZ: number;
  rightArmX: number;
  rightArmZ: number;
  leftLegX: number;
  rightLegX: number;
  rootYaw: number;
  // Smooth parametric facial state
  face: FaceParamTarget;
  mouthOpen: number;
  mouthShape: MouthVisemeShape;
  blinkAmount: number;
  lastRenderSignature: string;
}

export interface CharacterRig {
  spec: CharacterSpec;
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  faceMaterial: THREE.MeshStandardMaterial;
  faceCanvas: HTMLCanvasElement;
  faceCtx: CanvasRenderingContext2D;
  faceTexture: THREE.CanvasTexture;
  faceStyleOptions: FaceStyleOptions;
  currentFaceKey: string;
  animState: CharacterAnimState;
  disposables: Array<{ dispose: () => void }>;
}

export function getExpressionFaceTarget(expression: FaceExpression): FaceParamTarget {
  switch (expression) {
    case 'happy':
      return {
        browLeftY: 6,
        browRightY: 6,
        browLeftTilt: 0.16,
        browRightTilt: 0.16,
        eyeScaleY: 0.9,
        pupilScale: 1.08,
        eyeSparkle: 0.55,
        upperLidDrop: 0,
        angryFurrow: 0,
        tearGlisten: 0,
        mouthCurve: 0.95,
        mouthWidth: 1.18,
        mouthTilt: 0,
        blushAlpha: 0.28,
        sweatDrop: 0,
      };
    case 'excited':
      return {
        browLeftY: 11,
        browRightY: 11,
        browLeftTilt: 0.22,
        browRightTilt: 0.22,
        eyeScaleY: 1.26,
        pupilScale: 1.14,
        eyeSparkle: 1.0,
        upperLidDrop: 0,
        angryFurrow: 0,
        tearGlisten: 0,
        mouthCurve: 1.0,
        mouthWidth: 1.28,
        mouthTilt: 0,
        blushAlpha: 0.34,
        sweatDrop: 0,
      };
    case 'sad':
    case 'worried':
      return {
        browLeftY: 1,
        browRightY: 1,
        browLeftTilt: 0.72,
        browRightTilt: 0.72,
        eyeScaleY: 0.86,
        pupilScale: 1.0,
        eyeSparkle: 0.25,
        upperLidDrop: 0.22,
        angryFurrow: 0,
        tearGlisten: expression === 'sad' ? 0.9 : 0.35,
        mouthCurve: -0.92,
        mouthWidth: 0.95,
        mouthTilt: 0,
        blushAlpha: 0.08,
        sweatDrop: 0,
      };
    case 'angry':
      return {
        browLeftY: -6.5,
        browRightY: -6.5,
        browLeftTilt: -0.88,
        browRightTilt: -0.88,
        eyeScaleY: 0.8,
        pupilScale: 0.88,
        eyeSparkle: 0,
        upperLidDrop: 0.34,
        angryFurrow: 1.0,
        tearGlisten: 0,
        mouthCurve: -0.84,
        mouthWidth: 1.08,
        mouthTilt: -0.06,
        blushAlpha: 0.22,
        sweatDrop: 0,
      };
    case 'determined':
      return {
        browLeftY: -3,
        browRightY: -3,
        browLeftTilt: -0.45,
        browRightTilt: -0.45,
        eyeScaleY: 0.94,
        pupilScale: 1.0,
        eyeSparkle: 0.15,
        upperLidDrop: 0.12,
        angryFurrow: 0.2,
        tearGlisten: 0,
        mouthCurve: 0.22,
        mouthWidth: 1.0,
        mouthTilt: 0,
        blushAlpha: 0.12,
        sweatDrop: 0,
      };
    case 'surprised':
      return {
        browLeftY: 13.5,
        browRightY: 13.5,
        browLeftTilt: 0.22,
        browRightTilt: 0.22,
        eyeScaleY: 1.38,
        pupilScale: 0.74,
        eyeSparkle: 0.5,
        upperLidDrop: 0,
        angryFurrow: 0,
        tearGlisten: 0,
        mouthCurve: -0.08,
        mouthWidth: 0.7,
        mouthTilt: 0,
        blushAlpha: 0.16,
        sweatDrop: 0,
      };
    case 'confused':
      return {
        browLeftY: 9.5,
        browRightY: -4.5,
        browLeftTilt: 0.35,
        browRightTilt: -0.55,
        eyeScaleY: 1.04,
        pupilScale: 0.94,
        eyeSparkle: 0,
        upperLidDrop: 0.08,
        angryFurrow: 0.15,
        tearGlisten: 0,
        mouthCurve: -0.15,
        mouthWidth: 0.9,
        mouthTilt: 0.28,
        blushAlpha: 0.12,
        sweatDrop: 0.3,
      };
    case 'scared':
      return {
        browLeftY: 11.5,
        browRightY: 11.5,
        browLeftTilt: 0.78,
        browRightTilt: 0.78,
        eyeScaleY: 1.38,
        pupilScale: 0.62,
        eyeSparkle: 0,
        upperLidDrop: 0,
        angryFurrow: 0,
        tearGlisten: 0.25,
        mouthCurve: -0.76,
        mouthWidth: 0.86,
        mouthTilt: 0,
        blushAlpha: 0.05,
        sweatDrop: 1.0,
      };
    case 'neutral':
    default:
      return {
        browLeftY: 0,
        browRightY: 0,
        browLeftTilt: 0,
        browRightTilt: 0,
        eyeScaleY: 1.0,
        pupilScale: 1.0,
        eyeSparkle: 0.2,
        upperLidDrop: 0,
        angryFurrow: 0,
        tearGlisten: 0,
        mouthCurve: 0.22,
        mouthWidth: 0.98,
        mouthTilt: 0,
        blushAlpha: 0.16,
        sweatDrop: 0,
      };
  }
}

export function drawDynamicFace(
  ctx: CanvasRenderingContext2D,
  skinColor: string,
  face: FaceParamTarget,
  mouthOpen: number,
  mouthShape: MouthVisemeShape,
  blinkAmount: number,
  options: FaceStyleOptions = { faceStyle: 'classic', hairColor: '#1f2937', eyeColor: '#1e3a5f' }
): void {
  const canvasW = ctx.canvas.width || 512;
  const scale = canvasW / 256;

  ctx.save();
  ctx.scale(scale, scale);

  // Skin base + gentle top-to-bottom shading for subtle facial depth
  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, 256, 256);

  const shadeGrad = ctx.createLinearGradient(0, 0, 0, 256);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
  shadeGrad.addColorStop(0.75, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Cheek blush (high contrast so warm happy/excited reads clearly)
  const blushBoost = options.faceStyle === 'cheeky' ? 0.12 : 0;
  const blushAlpha = Math.min(0.45, face.blushAlpha + blushBoost);
  if (blushAlpha > 0.02) {
    ctx.fillStyle = `rgba(244, 114, 182, ${blushAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(58, 150, 24, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(198, 150, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Optional cute freckles
  if (options.faceStyle === 'freckles') {
    ctx.fillStyle = 'rgba(146, 64, 14, 0.48)';
    const dots: Array<[number, number]> = [
      [54, 142], [66, 146], [60, 154],
      [190, 146], [202, 142], [196, 154],
    ];
    for (const [fx, fy] of dots) {
      ctx.beginPath();
      ctx.arc(fx, fy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nervous sweat drop for scared/confused
  if (face.sweatDrop > 0.2) {
    ctx.fillStyle = `rgba(125, 211, 252, ${Math.min(0.95, face.sweatDrop).toFixed(2)})`;
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.75)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(218, 52);
    ctx.quadraticCurveTo(234, 78, 218, 92);
    ctx.quadraticCurveTo(202, 78, 218, 52);
    ctx.fill();
    ctx.stroke();
  }

  // Eyes (bold, stylized Roblox eyes with sclera + iris + pupil + animated lids)
  const openFactor = Math.max(0.08, 1 - blinkAmount * 0.92);
  const eyeRx = 20;
  const eyeRy = Math.max(3, 21 * face.eyeScaleY * openFactor);
  const eyeY = 104 - (face.eyeScaleY - 1) * 9;
  const leftEyeX = 82;
  const rightEyeX = 174;

  if (blinkAmount > 0.78) {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 18, eyeY + 2);
    ctx.quadraticCurveTo(leftEyeX, eyeY + 9, leftEyeX + 18, eyeY + 2);
    ctx.moveTo(rightEyeX - 18, eyeY + 2);
    ctx.quadraticCurveTo(rightEyeX, eyeY + 9, rightEyeX + 18, eyeY + 2);
    ctx.stroke();
  } else {
    for (const [side, ex] of [[-1, leftEyeX], [1, rightEyeX]] as Array<[-1 | 1, number]>) {
      ctx.save();
      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.38)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Clip interior iris & pupil cleanly inside eye sclera
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx - 1, eyeRy - 1, 0, 0, Math.PI * 2);
      ctx.clip();

      // Colored iris ring
      const irisRx = Math.min(eyeRx - 2, 13.8 * face.pupilScale);
      const irisRy = Math.max(2.5, Math.min(eyeRy - 1, 15.8 * face.pupilScale));
      ctx.fillStyle = options.eyeColor;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, irisRx, irisRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep dark pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, irisRx * 0.64, irisRy * 0.64, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp bright specular catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 5, eyeY - Math.min(6, eyeRy * 0.34), 4.6, 0, Math.PI * 2);
      ctx.fill();

      if (face.eyeSparkle > 0.3 && openFactor > 0.55) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, 0.4 + face.eyeSparkle * 0.6).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(ex - 5, eyeY + Math.min(5.5, eyeRy * 0.3), 2.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Upper eyelid shading / angry & sad tilt inside clipped sclera
      if (face.upperLidDrop > 0.04) {
        ctx.fillStyle = skinColor;
        const dropPx = eyeRy * face.upperLidDrop * 1.4;
        const innerOffset = face.browLeftTilt < -0.2 ? 9 : face.browLeftTilt > 0.2 ? -8 : 0;
        ctx.beginPath();
        ctx.moveTo(ex - eyeRx - 4, eyeY - eyeRy - 4);
        ctx.lineTo(ex + eyeRx + 4, eyeY - eyeRy - 4);
        ctx.lineTo(
          ex + eyeRx + 4,
          eyeY - eyeRy + dropPx + (side === -1 ? innerOffset : -innerOffset)
        );
        ctx.lineTo(
          ex - eyeRx - 4,
          eyeY - eyeRy + dropPx + (side === -1 ? -innerOffset : innerOffset)
        );
        ctx.closePath();
        ctx.fill();
      }

      // Sad tear glisten at lower corner
      if (face.tearGlisten > 0.25) {
        ctx.fillStyle = `rgba(125, 211, 252, ${(face.tearGlisten * 0.85).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(ex + side * 8, eyeY + eyeRy * 0.68, 6.5, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Bold upper lash line + expressive corner lashes when lashes_bright
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = options.faceStyle === 'lashes_bright' ? 5.2 : 3.8;
      ctx.lineCap = 'round';
      const innerLift = face.browLeftTilt < -0.2 ? 7 : face.browLeftTilt > 0.2 ? -5 : 0;
      const outerY = eyeY - eyeRy * 0.55 - (side === -1 ? innerLift : innerLift);
      const innerY = eyeY - eyeRy * 0.55 + (side === -1 ? innerLift : innerLift);
      ctx.beginPath();
      ctx.moveTo(ex - side * (eyeRx - 1), outerY + (face.upperLidDrop > 0.1 ? 3 : 0));
      ctx.quadraticCurveTo(
        ex,
        eyeY - eyeRy - 1 + face.upperLidDrop * eyeRy * 1.1,
        ex + side * (eyeRx - 1),
        innerY
      );
      if (options.faceStyle === 'lashes_bright') {
        const wingX = ex + side * (eyeRx + 5);
        const wingY = outerY - 4;
        ctx.moveTo(ex + side * (eyeRx - 2), outerY + 1);
        ctx.lineTo(wingX, wingY);
      }
      ctx.stroke();
    }
  }

  // Stylized subtle nose bridge mark
  ctx.fillStyle = 'rgba(120, 53, 15, 0.28)';
  ctx.beginPath();
  ctx.ellipse(128, 134, 4.2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Expressive thick eyebrows
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  const baseBrowY = 67;

  const lOuterY = baseBrowY - face.browLeftY + face.browLeftTilt * 13;
  const lInnerY = baseBrowY - face.browLeftY - face.browLeftTilt * 13;
  const lMidY = (lOuterY + lInnerY) * 0.5 - Math.max(0, face.browLeftY) * 0.35;
  ctx.beginPath();
  ctx.moveTo(57, lOuterY);
  ctx.quadraticCurveTo(82, lMidY, 106, lInnerY);
  ctx.stroke();

  const rOuterY = baseBrowY - face.browRightY + face.browRightTilt * 13;
  const rInnerY = baseBrowY - face.browRightY - face.browRightTilt * 13;
  const rMidY = (rOuterY + rInnerY) * 0.5 - Math.max(0, face.browRightY) * 0.35;
  ctx.beginPath();
  ctx.moveTo(199, rOuterY);
  ctx.quadraticCurveTo(174, rMidY, 150, rInnerY);
  ctx.stroke();

  // Angry furrow lines between brows
  if (face.angryFurrow > 0.25) {
    ctx.strokeStyle = `rgba(17, 24, 39, ${(face.angryFurrow * 0.78).toFixed(2)})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(121, 66);
    ctx.lineTo(124, 78);
    ctx.moveTo(135, 66);
    ctx.lineTo(132, 78);
    ctx.stroke();
  }

  // Mouth (high-contrast audio-driven mouth visemes + emotional expression shapes)
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';

  const mouthY = 175;
  const halfW = 28 * face.mouthWidth;
  const tiltPx = face.mouthTilt * 15;
  const clampedOpen = Math.max(0, Math.min(1, mouthOpen));

  if (clampedOpen > 0.1) {
    const rx =
      mouthShape === 'round'
        ? Math.max(13, halfW * 0.58)
        : mouthShape === 'wide'
          ? halfW * 1.02
          : halfW * 0.82;
    const ry =
      mouthShape === 'round'
        ? 12 + clampedOpen * 12
        : mouthShape === 'wide'
          ? 7 + clampedOpen * 16
          : 6 + clampedOpen * 11;

    const cornerLift = face.mouthCurve * 8;

    ctx.fillStyle = '#5c1218';
    ctx.beginPath();
    ctx.moveTo(128 - rx, mouthY - cornerLift * 0.4 - tiltPx * 0.3);
    ctx.quadraticCurveTo(
      128,
      mouthY - ry * 0.55 + face.mouthCurve * 4,
      128 + rx,
      mouthY - cornerLift * 0.4 + tiltPx * 0.3
    );
    ctx.quadraticCurveTo(
      128,
      mouthY + Math.max(7, ry * 1.35) - Math.min(0, face.mouthCurve) * 4,
      128 - rx,
      mouthY - cornerLift * 0.4 - tiltPx * 0.3
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright upper teeth highlight
    if ((mouthShape === 'wide' || face.mouthCurve > 0.2) && ry > 8) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(128, mouthY - ry * 0.14, rx * 0.62, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tongue
    if (ry > 9) {
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.ellipse(128, mouthY + ry * 0.5, rx * 0.52, Math.min(7.5, ry * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Silent expressive mouth
    if (face.mouthWidth < 0.78 && Math.abs(face.mouthCurve) < 0.25) {
      // Surprised 'O' mouth
      ctx.fillStyle = '#5c1218';
      ctx.beginPath();
      ctx.ellipse(128, mouthY + 2, 13.5, 16.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (face.mouthCurve > 0.78) {
      // Big cheerful beaming smile with crisp teeth fill
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(128 - halfW, mouthY - 5);
      ctx.quadraticCurveTo(128, mouthY - 2, 128 + halfW, mouthY - 5);
      ctx.quadraticCurveTo(128, mouthY + 28 * face.mouthCurve, 128 - halfW, mouthY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const curveOffset = face.mouthCurve * 24;
      const baseEndY = mouthY - face.mouthCurve * 5;
      ctx.beginPath();
      ctx.moveTo(128 - halfW, baseEndY - tiltPx);
      ctx.quadraticCurveTo(128, mouthY + curveOffset, 128 + halfW, baseEndY + tiltPx);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function buildFaceRenderSignature(
  face: FaceParamTarget,
  mouthOpen: number,
  mouthShape: MouthVisemeShape,
  blinkAmount: number
): string {
  const q = (v: number, scale = 20) => Math.round(v * scale);
  return [
    q(face.browLeftY, 2),
    q(face.browRightY, 2),
    q(face.browLeftTilt, 15),
    q(face.browRightTilt, 15),
    q(face.eyeScaleY, 20),
    q(face.pupilScale, 15),
    q(face.eyeSparkle, 10),
    q(face.upperLidDrop, 15),
    q(face.angryFurrow, 10),
    q(face.tearGlisten, 10),
    q(face.mouthCurve, 20),
    q(face.mouthWidth, 15),
    q(face.mouthTilt, 15),
    q(face.sweatDrop, 10),
    q(mouthOpen, 40),
    mouthShape,
    q(blinkAmount, 12),
  ].join('|');
}

function resolveStylePreset(spec: CharacterSpec): CharacterStylePreset {
  if (spec.appearance.stylePreset) return spec.appearance.stylePreset;
  const h = spec.appearance.hairStyle;
  if (['bob', 'ponytail', 'long_wavy', 'twin_pigtails', 'bun'].includes(h)) {
    return 'girl';
  }
  return 'boy';
}

function resolveOutfitStyle(spec: CharacterSpec, preset: CharacterStylePreset): OutfitStyle {
  if (spec.appearance.outfitStyle) return spec.appearance.outfitStyle;
  if (preset === 'girl') return 'overalls';
  return 'jacket';
}

function resolveEyeColor(spec: CharacterSpec): string {
  const palette = ['#1e3a5f', '#3f2e21', '#0f766e', '#312e81', '#7c2d12'];
  let hash = 0;
  for (let i = 0; i < spec.id.length; i++) {
    hash = (hash * 31 + spec.id.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export function buildCharacterRig(spec: CharacterSpec): CharacterRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const preset = resolveStylePreset(spec);
  const outfitStyle = resolveOutfitStyle(spec, preset);
  const faceStyle: FaceStyle = spec.appearance.faceStyle || (preset === 'girl' ? 'lashes_bright' : 'classic');
  const eyeColor = resolveEyeColor(spec);
  const accentHex = spec.appearance.accentColor || '#fef3c7';
  const shoeHex = spec.appearance.shoeColor || '#f8fafc';

  const root = new THREE.Group();
  root.name = `character_${spec.id}`;
  const scale = spec.appearance.bodyScale || 1;
  root.scale.setScalar(scale);

  // Calibrated PBR materials with clear roughness/sheen contrast
  const skinMat = track(
    new THREE.MeshStandardMaterial({
      color: spec.appearance.skinColor,
      roughness: 0.6,
      metalness: 0.03,
    })
  );
  const shirtMat = track(
    new THREE.MeshStandardMaterial({
      color: spec.appearance.shirtColor,
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const shirtTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.appearance.shirtColor).offsetHSL(0, 0.04, -0.18),
      roughness: 0.44,
      metalness: 0.16,
    })
  );
  const accentMat = track(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.56,
      metalness: 0.1,
    })
  );
  const pantsMat = track(
    new THREE.MeshStandardMaterial({
      color: spec.appearance.pantsColor,
      roughness: 0.86,
      metalness: 0.03,
    })
  );
  const shoeUpperMat = track(
    new THREE.MeshStandardMaterial({
      color: shoeHex,
      roughness: 0.42,
      metalness: 0.12,
    })
  );
  const shoeSoleMat = track(
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.55,
      metalness: 0.04,
    })
  );
  const hairMat = track(
    new THREE.MeshStandardMaterial({
      color: spec.appearance.hairColor,
      roughness: 0.46,
      metalness: 0.1,
    })
  );
  const hairHighlightMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.appearance.hairColor).offsetHSL(0, 0, 0.08),
      roughness: 0.4,
      metalness: 0.12,
    })
  );
  const hardwareMat = track(
    new THREE.MeshStandardMaterial({
      color: '#eab308',
      roughness: 0.25,
      metalness: 0.78,
    })
  );

  // Proportion calibration differentiating boy / girl / neutral silhouettes cleanly
  const dims =
    preset === 'girl'
      ? {
          torsoW: 0.74,
          torsoH: 0.74,
          torsoD: 0.4,
          shoulderX: 0.51,
          armW: 0.24,
          armD: 0.26,
          legW: 0.3,
          legD: 0.34,
          legOffsetX: 0.175,
        }
      : preset === 'boy'
        ? {
            torsoW: 0.86,
            torsoH: 0.76,
            torsoD: 0.45,
            shoulderX: 0.59,
            armW: 0.3,
            armD: 0.32,
            legW: 0.35,
            legD: 0.38,
            legOffsetX: 0.21,
          }
        : {
            torsoW: 0.8,
            torsoH: 0.75,
            torsoD: 0.42,
            shoulderX: 0.55,
            armW: 0.27,
            armD: 0.29,
            legW: 0.32,
            legD: 0.36,
            legOffsetX: 0.19,
          };

  // Contact shadow disc grounded at y = 0.015
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.48)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
  const shadowPlane = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.32, 1.32)),
    track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    )
  );
  shadowPlane.name = 'contact_shadow';
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // Pelvis pivot at hip height y = 0.78
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.78, 0);
  root.add(pelvis);

  // Waist belt + buckle OR flared pleated skirt/dress hem on pelvis
  if (outfitStyle === 'dress' || outfitStyle === 'skirt_top') {
    const skirtMat = outfitStyle === 'dress' ? shirtMat : pantsMat;
    const upperTier = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.08, 0.16, dims.torsoD + 0.1)),
      skirtMat
    );
    upperTier.position.y = 0.02;
    upperTier.castShadow = true;

    const midTier = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.18, 0.18, dims.torsoD + 0.2)),
      skirtMat
    );
    midTier.position.y = -0.12;
    midTier.castShadow = true;

    const hemTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.2, 0.05, dims.torsoD + 0.22)),
      accentMat
    );
    hemTrim.position.y = -0.22;

    const sash = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.06, 0.08, dims.torsoD + 0.06)),
      accentMat
    );
    sash.position.y = 0.1;
    pelvis.add(upperTier, midTier, hemTrim, sash);
  } else {
    const beltMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.03, 0.1, dims.torsoD + 0.03)),
      shirtTrimMat
    );
    beltMesh.position.y = 0.04;
    beltMesh.castShadow = true;
    const buckle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 0.09, 0.04)),
      hardwareMat
    );
    buckle.position.set(0, 0.04, (dims.torsoD + 0.04) * 0.5);
    pelvis.add(beltMesh, buckle);
  }

  // Torso group
  const torso = new THREE.Group();
  torso.position.set(0, 0.46, 0);
  pelvis.add(torso);

  const torsoBase = new THREE.Mesh(
    track(new THREE.BoxGeometry(dims.torsoW, dims.torsoH, dims.torsoD)),
    outfitStyle === 'overalls' || outfitStyle === 'jacket' ? accentMat : shirtMat
  );
  torsoBase.castShadow = true;
  torsoBase.receiveShadow = true;
  torso.add(torsoBase);

  // Neck ring
  const neckCollar = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.18, 0.2, 0.09, 12)),
    skinMat
  );
  neckCollar.position.y = dims.torsoH * 0.5 + 0.02;
  torso.add(neckCollar);

  // Layered clothing geometry on torso
  if (outfitStyle === 'jacket') {
    // Open front zip jacket panels + collar lapels + pocket trim
    const panelW = dims.torsoW * 0.36;
    const leftPanel = new THREE.Mesh(
      track(new THREE.BoxGeometry(panelW, dims.torsoH * 0.94, dims.torsoD + 0.05)),
      shirtMat
    );
    leftPanel.position.set(-dims.torsoW * 0.33, -0.01, 0);
    leftPanel.castShadow = true;

    const rightPanel = new THREE.Mesh(
      track(new THREE.BoxGeometry(panelW, dims.torsoH * 0.94, dims.torsoD + 0.05)),
      shirtMat
    );
    rightPanel.position.set(dims.torsoW * 0.33, -0.01, 0);
    rightPanel.castShadow = true;

    const backPanel = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.03, dims.torsoH * 0.94, dims.torsoD * 0.55)),
      shirtMat
    );
    backPanel.position.set(0, -0.01, -dims.torsoD * 0.24);

    const collar = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.72, 0.12, dims.torsoD + 0.07)),
      shirtTrimMat
    );
    collar.position.set(0, dims.torsoH * 0.45, -0.02);

    const zipLine = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, dims.torsoH * 0.65, 0.03)),
      hardwareMat
    );
    zipLine.position.set(-dims.torsoW * 0.15, -0.02, dims.torsoD * 0.52 + 0.02);

    torso.add(leftPanel, rightPanel, backPanel, collar, zipLine);
  } else if (outfitStyle === 'varsity') {
    const chestBand = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.04, 0.12, dims.torsoD + 0.04)),
      accentMat
    );
    chestBand.position.y = -dims.torsoH * 0.38;
    const collarRib = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.65, 0.1, dims.torsoD + 0.06)),
      accentMat
    );
    collarRib.position.y = dims.torsoH * 0.46;
    const badge = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.2, 0.04)),
      accentMat
    );
    badge.position.set(dims.torsoW * 0.22, 0.12, dims.torsoD * 0.5 + 0.02);
    const snapButtons = [-0.18, 0, 0.18].map((by) => {
      const btn = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8)), hardwareMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, by, dims.torsoD * 0.5 + 0.02);
      return btn;
    });
    torso.add(chestBand, collarRib, badge, ...snapButtons);
  } else if (outfitStyle === 'hoodie_outfit') {
    const kangarooPocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.62, 0.24, 0.08)),
      shirtTrimMat
    );
    kangarooPocket.position.set(0, -0.2, dims.torsoD * 0.5 + 0.02);
    const backHood = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.72, 0.24, 0.22)),
      shirtTrimMat
    );
    backHood.position.set(0, dims.torsoH * 0.44, -dims.torsoD * 0.52);
    for (const dx of [-0.1, 0.1]) {
      const cord = new THREE.Mesh(track(new THREE.BoxGeometry(0.035, 0.22, 0.03)), accentMat);
      cord.position.set(dx, 0.2, dims.torsoD * 0.5 + 0.02);
      torso.add(cord);
    }
    torso.add(kangarooPocket, backHood);
  } else if (outfitStyle === 'overalls') {
    // Denim/canvas bib + straps over inner accent shirt
    const bib = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.76, dims.torsoH * 0.62, dims.torsoD + 0.05)),
      pantsMat
    );
    bib.position.set(0, -0.14, 0.01);
    bib.castShadow = true;

    const pocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.42, 0.18, 0.06)),
      shirtMat
    );
    pocket.position.set(0, -0.02, dims.torsoD * 0.5 + 0.03);

    for (const sx of [-dims.torsoW * 0.26, dims.torsoW * 0.26]) {
      const strap = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.11, dims.torsoH * 0.98, dims.torsoD + 0.06)),
        pantsMat
      );
      strap.position.set(sx, 0.01, 0);
      const btn = new THREE.Mesh(track(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 10)), hardwareMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(sx, 0.12, dims.torsoD * 0.5 + 0.04);
      torso.add(strap, btn);
    }
    torso.add(bib, pocket);
  } else if (outfitStyle === 'dress' || outfitStyle === 'skirt_top') {
    const collarL = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.22, 0.08, 0.06)),
      accentMat
    );
    collarL.position.set(-0.14, dims.torsoH * 0.46, dims.torsoD * 0.46);
    collarL.rotation.z = -0.2;
    const collarR = collarL.clone();
    collarR.position.set(0.14, dims.torsoH * 0.46, dims.torsoD * 0.46);
    collarR.rotation.z = 0.2;
    const stripe = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.03, 0.1, dims.torsoD + 0.03)),
      shirtTrimMat
    );
    stripe.position.y = 0.05;
    torso.add(collarL, collarR, stripe);
  } else {
    // casual_tee
    const stripeMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW + 0.03, 0.13, dims.torsoD + 0.03)),
      shirtTrimMat
    );
    stripeMesh.position.y = 0.08;
    const pocket = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.16, 0.16, 0.04)),
      accentMat
    );
    pocket.position.set(dims.torsoW * 0.24, 0.16, dims.torsoD * 0.5 + 0.01);
    torso.add(stripeMesh, pocket);
  }

  // Head group at neck y = 0.44 above torso center
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.44, 0);
  torso.add(headGroup);

  // High-resolution 512x512 dynamic face CanvasTexture
  const faceStyleOptions: FaceStyleOptions = {
    faceStyle,
    hairColor: spec.appearance.hairColor,
    eyeColor,
  };
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512;
  faceCanvas.height = 512;
  const faceCtx = faceCanvas.getContext('2d')!;
  const initialFace = getExpressionFaceTarget(spec.appearance.faceExpression);
  drawDynamicFace(faceCtx, spec.appearance.skinColor, initialFace, 0, 'closed', 0, faceStyleOptions);

  const faceTexture = track(new THREE.CanvasTexture(faceCanvas));
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.generateMipmaps = false;
  faceTexture.minFilter = THREE.LinearFilter;
  faceTexture.magFilter = THREE.LinearFilter;
  faceTexture.anisotropy = 4;
  faceTexture.needsUpdate = true;

  const initialKey = `${spec.appearance.faceExpression}_closed`;
  const faceMaterial = track(
    new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.54,
      metalness: 0.02,
    })
  );

  // Blocky Roblox-style head (front +Z uses crisp 512x512 faceMaterial)
  const headMesh = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.58, 0.62)), [
    skinMat,
    skinMat,
    skinMat,
    skinMat,
    faceMaterial,
    skinMat,
  ]);
  headMesh.position.y = 0.29;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Subtle 3D side ears for sculptural depth
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.16, 0.12)), skinMat);
    ear.position.set(side * 0.325, 0.28, 0.0);
    ear.castShadow = true;
    headGroup.add(ear);
  }

  // Roblox-style top stud on head
  const studMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12)), skinMat);
  studMesh.position.y = 0.61;
  headGroup.add(studMesh);

  // Multi-part sculpted 3D Hair styles (bangs kept at y >= 0.49 so eyebrows/eyes remain 100% visible)
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);
  const style: HairStyle = spec.appearance.hairStyle;

  if (style === 'spiky') {
    const baseCap = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.16, 0.66)), hairMat);
    baseCap.position.y = 0.56;
    const backTrim = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.28, 0.12)), hairMat);
    backTrim.position.set(0, 0.42, -0.3);
    const frontFringe = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.09, 0.1)), hairHighlightMat);
    frontFringe.position.set(0, 0.53, 0.31);
    hairGroup.add(baseCap, backTrim, frontFringe);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(track(new THREE.ConeGeometry(0.13, 0.28, 6)), hairMat);
      spike.position.set(i * 0.18, 0.72, 0.06);
      spike.rotation.x = -0.22;
      spike.rotation.z = -i * 0.12;
      spike.castShadow = true;
      hairGroup.add(spike);
    }
  } else if (style === 'fade') {
    const crown = new THREE.Mesh(track(new THREE.BoxGeometry(0.64, 0.18, 0.64)), hairMat);
    crown.position.y = 0.57;
    const topFade = new THREE.Mesh(track(new THREE.BoxGeometry(0.56, 0.1, 0.56)), hairHighlightMat);
    topFade.position.y = 0.65;
    const backFade = new THREE.Mesh(track(new THREE.BoxGeometry(0.64, 0.24, 0.09)), hairMat);
    backFade.position.set(0, 0.43, -0.3);
    hairGroup.add(crown, topFade, backFade);
  } else if (style === 'side_part') {
    const crown = new THREE.Mesh(track(new THREE.BoxGeometry(0.67, 0.17, 0.66)), hairMat);
    crown.position.y = 0.56;
    const sweptBang = new THREE.Mesh(track(new THREE.BoxGeometry(0.46, 0.11, 0.13)), hairHighlightMat);
    sweptBang.position.set(0.08, 0.53, 0.31);
    sweptBang.rotation.z = -0.14;
    const sideL = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.26, 0.42)), hairMat);
    sideL.position.set(-0.33, 0.43, -0.06);
    const sideR = sideL.clone();
    sideR.position.x = 0.33;
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(0.65, 0.32, 0.11)), hairMat);
    back.position.set(0, 0.4, -0.31);
    hairGroup.add(crown, sweptBang, sideL, sideR, back);
  } else if (style === 'bob') {
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.17, 0.68)), hairMat);
    top.position.y = 0.56;
    const bangs = new THREE.Mesh(track(new THREE.BoxGeometry(0.64, 0.08, 0.1)), hairHighlightMat);
    bangs.position.set(0, 0.53, 0.31);
    const leftSide = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.46, 0.56)), hairMat);
    leftSide.position.set(-0.33, 0.34, -0.05);
    const rightSide = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.46, 0.56)), hairMat);
    rightSide.position.set(0.33, 0.34, -0.05);
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.48, 0.14)), hairMat);
    back.position.set(0, 0.33, -0.33);
    hairGroup.add(top, bangs, leftSide, rightSide, back);
  } else if (style === 'long_wavy') {
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.17, 0.68)), hairMat);
    top.position.y = 0.56;
    const crownPart = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.08, 0.11)), hairHighlightMat);
    crownPart.position.set(-0.14, 0.53, 0.31);
    crownPart.rotation.z = 0.15;
    const crownPartR = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.08, 0.11)), hairHighlightMat);
    crownPartR.position.set(0.14, 0.53, 0.31);
    crownPartR.rotation.z = -0.15;
    const leftLock = new THREE.Mesh(track(new THREE.BoxGeometry(0.13, 0.66, 0.32)), hairMat);
    leftLock.position.set(-0.34, 0.22, -0.12);
    const rightLock = new THREE.Mesh(track(new THREE.BoxGeometry(0.13, 0.66, 0.32)), hairMat);
    rightLock.position.set(0.34, 0.22, -0.12);
    const backDrape = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.72, 0.16)), hairMat);
    backDrape.position.set(0, 0.2, -0.34);
    const lowerWave = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.24, 0.18)), hairHighlightMat);
    lowerWave.position.set(0, -0.06, -0.37);
    hairGroup.add(top, crownPart, crownPartR, leftLock, rightLock, backDrape, lowerWave);
  } else if (style === 'ponytail') {
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.16, 0.66)), hairMat);
    top.position.y = 0.56;
    const sideLockL = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.24, 0.14)), hairHighlightMat);
    sideLockL.position.set(-0.32, 0.42, 0.22);
    const sideLockR = sideLockL.clone();
    sideLockR.position.x = 0.32;
    const tie = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10)), accentMat);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(0, 0.49, -0.35);
    const tailUpper = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.36, 0.2)), hairMat);
    tailUpper.position.set(0, 0.34, -0.45);
    tailUpper.rotation.x = 0.28;
    const tailTip = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.24, 0.16)), hairHighlightMat);
    tailTip.position.set(0, 0.11, -0.52);
    tailTip.rotation.x = 0.16;
    hairGroup.add(top, sideLockL, sideLockR, tie, tailUpper, tailTip);
  } else if (style === 'twin_pigtails') {
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.16, 0.66)), hairMat);
    top.position.y = 0.56;
    const bangs = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.08, 0.1)), hairHighlightMat);
    bangs.position.set(0, 0.53, 0.31);
    for (const side of [-1, 1]) {
      const tie = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10)), accentMat);
      tie.rotation.z = Math.PI / 2;
      tie.position.set(side * 0.36, 0.46, -0.08);
      const tail = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.42, 0.18)), hairMat);
      tail.position.set(side * 0.45, 0.28, -0.1);
      tail.rotation.z = side * -0.18;
      hairGroup.add(tie, tail);
    }
    hairGroup.add(top, bangs);
  } else if (style === 'bun') {
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(0.66, 0.16, 0.66)), hairMat);
    top.position.y = 0.56;
    const tie = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12)), accentMat);
    tie.position.set(0, 0.66, -0.16);
    const bunMesh = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.22, 0.28)), hairHighlightMat);
    bunMesh.position.set(0, 0.74, -0.16);
    const sideLockL = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.22, 0.12)), hairHighlightMat);
    sideLockL.position.set(-0.32, 0.42, 0.22);
    const sideLockR = sideLockL.clone();
    sideLockR.position.x = 0.32;
    hairGroup.add(top, tie, bunMesh, sideLockL, sideLockR);
  } else if (style === 'curly') {
    const puffGeo = track(new THREE.BoxGeometry(0.24, 0.24, 0.24));
    const offsets: Array<[number, number, number]> = [
      [-0.22, 0.59, 0.12],
      [0.22, 0.59, 0.12],
      [0, 0.64, 0.02],
      [-0.25, 0.55, -0.18],
      [0.25, 0.55, -0.18],
      [0, 0.57, -0.25],
      [-0.31, 0.42, -0.14],
      [0.31, 0.42, -0.14],
    ];
    for (const [hx, hy, hz] of offsets) {
      const puff = new THREE.Mesh(puffGeo, hairMat);
      puff.position.set(hx, hy, hz);
      puff.castShadow = true;
      hairGroup.add(puff);
    }
  } else if (style === 'cap') {
    // Raised crown + subtly angled visor so eyes & eyebrows are completely visible and brightly lit
    const dome = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.22, 0.68)), shirtTrimMat);
    dome.position.y = 0.58;
    const crownBand = new THREE.Mesh(track(new THREE.BoxGeometry(0.69, 0.06, 0.69)), accentMat);
    crownBand.position.y = 0.51;
    const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.64, 0.05, 0.3)), shirtMat);
    visor.position.set(0, 0.53, 0.39);
    visor.rotation.x = -0.14;
    hairGroup.add(dome, crownBand, visor);
  } else if (style === 'hoodie') {
    const hoodTop = new THREE.Mesh(track(new THREE.BoxGeometry(0.72, 0.14, 0.72)), shirtTrimMat);
    hoodTop.position.set(0, 0.59, -0.04);
    const hoodBack = new THREE.Mesh(track(new THREE.BoxGeometry(0.72, 0.58, 0.14)), shirtTrimMat);
    hoodBack.position.set(0, 0.31, -0.34);
    const hairPeak = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.08, 0.1)), hairMat);
    hairPeak.position.set(0, 0.52, 0.3);
    hairGroup.add(hoodTop, hoodBack, hairPeak);
  }

  // Accessories (glasses redesigned with open frames + transparent lenses so eyes remain 100% clear)
  const acc = spec.appearance.accessory;
  if (acc === 'glasses') {
    const frameMat = track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.25, metalness: 0.65 })
    );
    const lensMat = track(
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
        metalness: 0.1,
      })
    );

    const addFrameEye = (cx: number) => {
      const w = 0.2;
      const h = 0.15;
      const t = 0.022;
      const z = 0.328;
      const cy = 0.325;
      const topBar = new THREE.Mesh(track(new THREE.BoxGeometry(w, t, 0.03)), frameMat);
      topBar.position.set(cx, cy + h * 0.5, z);
      const botBar = new THREE.Mesh(track(new THREE.BoxGeometry(w, t, 0.03)), frameMat);
      botBar.position.set(cx, cy - h * 0.5, z);
      const leftBar = new THREE.Mesh(track(new THREE.BoxGeometry(t, h, 0.03)), frameMat);
      leftBar.position.set(cx - w * 0.5, cy, z);
      const rightBar = new THREE.Mesh(track(new THREE.BoxGeometry(t, h, 0.03)), frameMat);
      rightBar.position.set(cx + w * 0.5, cy, z);
      const lens = new THREE.Mesh(track(new THREE.PlaneGeometry(w - t, h - t)), lensMat);
      lens.position.set(cx, cy, z - 0.004);
      headGroup.add(topBar, botBar, leftBar, rightBar, lens);
    };

    addFrameEye(-0.145);
    addFrameEye(0.145);
    const bridge = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.025, 0.03)), frameMat);
    bridge.position.set(0, 0.34, 0.328);
    headGroup.add(bridge);
  } else if (acc === 'crown') {
    const goldMat = track(
      new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.22, metalness: 0.85 })
    );
    const crownBand = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 8)), goldMat);
    crownBand.position.set(0, 0.72, 0);
    headGroup.add(crownBand);
  } else if (acc === 'headphones') {
    const hpMat = track(
      new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.3, metalness: 0.45 })
    );
    const band = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.07, 0.12)), hpMat);
    band.position.set(0, 0.67, 0);
    const earL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 12)), hpMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.37, 0.32, 0);
    const earR = earL.clone();
    earR.position.set(0.37, 0.32, 0);
    headGroup.add(band, earL, earR);
  } else if (acc === 'backpack') {
    const packMat = track(
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72, metalness: 0.08 })
    );
    const pack = new THREE.Mesh(track(new THREE.BoxGeometry(0.56, 0.58, 0.26)), packMat);
    pack.position.set(0, 0.02, -(dims.torsoD * 0.5 + 0.13));
    pack.castShadow = true;
    const flap = new THREE.Mesh(track(new THREE.BoxGeometry(0.58, 0.18, 0.28)), accentMat);
    flap.position.set(0, 0.22, -(dims.torsoD * 0.5 + 0.13));
    torso.add(pack, flap);
  } else if (acc === 'scarf') {
    const scarfMat = track(
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.86, metalness: 0.02 })
    );
    const neckWrap = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.torsoW * 0.68, 0.13, dims.torsoD + 0.12)),
      scarfMat
    );
    neckWrap.position.set(0, dims.torsoH * 0.5 + 0.01, 0);
    const tail = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.36, 0.07)), scarfMat);
    tail.position.set(0.14, 0.2, dims.torsoD * 0.5 + 0.05);
    torso.add(neckWrap, tail);
  }

  // Arms with sleeve + cuff + forearm + sculpted hand
  const sleeveMat = outfitStyle === 'varsity' ? accentMat : shirtMat;
  const createArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * dims.shoulderX, 0.3, 0);

    const sleeveLen = outfitStyle === 'jacket' || outfitStyle === 'hoodie_outfit' || outfitStyle === 'varsity' ? 0.44 : 0.34;
    const sleeve = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.armW, sleeveLen, dims.armD)),
      sleeveMat
    );
    sleeve.position.y = -sleeveLen * 0.5 + 0.04;
    sleeve.castShadow = true;

    const cuff = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.armW + 0.02, 0.06, dims.armD + 0.02)),
      shirtTrimMat
    );
    cuff.position.y = -sleeveLen + 0.04;

    const forearmLen = 0.62 - sleeveLen;
    const forearm = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.armW * 0.88, forearmLen, dims.armD * 0.86)),
      skinMat
    );
    forearm.position.y = -sleeveLen + 0.04 - forearmLen * 0.5;
    forearm.castShadow = true;

    const hand = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.armW * 0.84, 0.14, dims.armD * 0.84)),
      skinMat
    );
    hand.position.y = -0.64;
    hand.castShadow = true;

    pivot.add(sleeve, cuff, forearm, hand);
    torso.add(pivot);
    return pivot;
  };

  const leftArmPivot = createArm(-1);
  const rightArmPivot = createArm(1);

  // Legs with trousers + sock/ankle cuff + multi-part shoe (midsole + upper + toe cap)
  const createLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * dims.legOffsetX, 0, 0);

    const leg = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.legW, 0.58, dims.legD)),
      pantsMat
    );
    leg.position.y = -0.29;
    leg.castShadow = true;

    const ankleTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.legW + 0.02, 0.07, dims.legD + 0.02)),
      accentMat
    );
    ankleTrim.position.y = -0.59;

    const shoeUpper = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.legW + 0.03, 0.11, dims.legD + 0.09)),
      shoeUpperMat
    );
    shoeUpper.position.set(0, -0.665, 0.035);
    shoeUpper.castShadow = true;

    const shoeSole = new THREE.Mesh(
      track(new THREE.BoxGeometry(dims.legW + 0.04, 0.06, dims.legD + 0.11)),
      shoeSoleMat
    );
    shoeSole.position.set(0, -0.75, 0.038);
    shoeSole.castShadow = true;

    pivot.add(leg, ankleTrim, shoeUpper, shoeSole);
    pelvis.add(pivot);
    return pivot;
  };

  const leftLegPivot = createLeg(-1);
  const rightLegPivot = createLeg(1);

  const animState: CharacterAnimState = {
    lastSceneId: '',
    pelvisY: 0.78,
    pelvisRotX: 0,
    torsoRotX: 0,
    torsoRotY: 0,
    headRotX: 0,
    headRotY: 0,
    headRotZ: 0,
    leftArmX: 0,
    leftArmZ: 0.08,
    rightArmX: 0,
    rightArmZ: -0.08,
    leftLegX: 0,
    rightLegX: 0,
    rootYaw: 0,
    face: { ...initialFace },
    mouthOpen: 0,
    mouthShape: 'closed',
    blinkAmount: 0,
    lastRenderSignature: buildFaceRenderSignature(initialFace, 0, 'closed', 0),
  };

  return {
    spec,
    root,
    pelvis,
    torso,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    faceMaterial,
    faceCanvas,
    faceCtx,
    faceTexture,
    faceStyleOptions,
    currentFaceKey: initialKey,
    animState,
    disposables,
  };
}

export function applySmoothFaceState(
  rig: CharacterRig,
  targetExpression: FaceExpression,
  targetMouthOpen: number,
  targetMouthShape: MouthVisemeShape,
  blinkAmount: number,
  deltaSec: number
): void {
  const target = getExpressionFaceTarget(targetExpression);
  const cur = rig.animState.face;
  const lambda = 12; // ~0.22s smooth expression transition without abrupt pops

  cur.browLeftY = THREE.MathUtils.damp(cur.browLeftY, target.browLeftY, lambda, deltaSec);
  cur.browRightY = THREE.MathUtils.damp(cur.browRightY, target.browRightY, lambda, deltaSec);
  cur.browLeftTilt = THREE.MathUtils.damp(cur.browLeftTilt, target.browLeftTilt, lambda, deltaSec);
  cur.browRightTilt = THREE.MathUtils.damp(cur.browRightTilt, target.browRightTilt, lambda, deltaSec);
  cur.eyeScaleY = THREE.MathUtils.damp(cur.eyeScaleY, target.eyeScaleY, lambda, deltaSec);
  cur.pupilScale = THREE.MathUtils.damp(cur.pupilScale, target.pupilScale, lambda, deltaSec);
  cur.eyeSparkle = THREE.MathUtils.damp(cur.eyeSparkle, target.eyeSparkle, lambda, deltaSec);
  cur.upperLidDrop = THREE.MathUtils.damp(cur.upperLidDrop, target.upperLidDrop, lambda, deltaSec);
  cur.angryFurrow = THREE.MathUtils.damp(cur.angryFurrow, target.angryFurrow, lambda, deltaSec);
  cur.tearGlisten = THREE.MathUtils.damp(cur.tearGlisten, target.tearGlisten, lambda, deltaSec);
  cur.mouthCurve = THREE.MathUtils.damp(cur.mouthCurve, target.mouthCurve, lambda, deltaSec);
  cur.mouthWidth = THREE.MathUtils.damp(cur.mouthWidth, target.mouthWidth, lambda, deltaSec);
  cur.mouthTilt = THREE.MathUtils.damp(cur.mouthTilt, target.mouthTilt, lambda, deltaSec);
  cur.blushAlpha = THREE.MathUtils.damp(cur.blushAlpha, target.blushAlpha, lambda, deltaSec);
  cur.sweatDrop = THREE.MathUtils.damp(cur.sweatDrop, target.sweatDrop, lambda, deltaSec);

  // Mouth damps tightly (lambda = 44) so syllables track speech closely and shut cleanly on silence
  rig.animState.mouthOpen = THREE.MathUtils.damp(
    rig.animState.mouthOpen,
    targetMouthOpen,
    44,
    deltaSec
  );
  if (rig.animState.mouthOpen < 0.035 && targetMouthOpen === 0) {
    rig.animState.mouthOpen = 0;
  }
  rig.animState.mouthShape = rig.animState.mouthOpen <= 0.1 ? 'closed' : targetMouthShape;
  rig.animState.blinkAmount = blinkAmount;
  rig.currentFaceKey = `${targetExpression}_${rig.animState.mouthShape}`;

  const sig = buildFaceRenderSignature(
    cur,
    rig.animState.mouthOpen,
    rig.animState.mouthShape,
    blinkAmount
  );
  if (sig === rig.animState.lastRenderSignature) return;

  rig.animState.lastRenderSignature = sig;
  drawDynamicFace(
    rig.faceCtx,
    rig.spec.appearance.skinColor,
    cur,
    rig.animState.mouthOpen,
    rig.animState.mouthShape,
    blinkAmount,
    rig.faceStyleOptions
  );
  rig.faceTexture.needsUpdate = true;
}

export function setCharacterFace(
  rig: CharacterRig,
  expression: FaceExpression,
  mouthOpen: boolean
): void {
  const target = getExpressionFaceTarget(expression);
  rig.animState.face = { ...target };
  const openVal = mouthOpen ? 0.78 : 0;
  const shape: MouthVisemeShape = mouthOpen ? 'wide' : 'closed';
  rig.animState.mouthOpen = openVal;
  rig.animState.mouthShape = shape;
  rig.currentFaceKey = `${expression}_${mouthOpen ? 'open' : 'closed'}`;
  const sig = buildFaceRenderSignature(target, openVal, shape, 0);
  if (sig !== rig.animState.lastRenderSignature) {
    rig.animState.lastRenderSignature = sig;
    drawDynamicFace(
      rig.faceCtx,
      rig.spec.appearance.skinColor,
      target,
      openVal,
      shape,
      0,
      rig.faceStyleOptions
    );
    rig.faceTexture.needsUpdate = true;
  }
}

export function disposeCharacterRig(rig: CharacterRig): void {
  for (const item of rig.disposables) {
    item.dispose();
  }
}
