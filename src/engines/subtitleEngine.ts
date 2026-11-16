import type { TimelineSubtitle } from '../types/story';

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function drawCompositedFrame(
  ctx: CanvasRenderingContext2D,
  webglCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  globalTimeSec: number,
  totalDurationSec: number,
  sceneTitle: string,
  sceneLocalTimeSec: number,
  sceneDurationSec: number,
  activeSubtitle: TimelineSubtitle | undefined,
  storyTitle: string
): void {
  // 1. Copy rendered 3D WebGL frame
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(webglCanvas, 0, 0, width, height);

  // 2. Subtle top & bottom cinema vignette for subtitle contrast
  const bottomGrad = ctx.createLinearGradient(0, height * 0.65, 0, height);
  bottomGrad.addColorStop(0, 'rgba(10, 14, 22, 0)');
  bottomGrad.addColorStop(1, 'rgba(10, 14, 22, 0.72)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height * 0.65, width, height * 0.35);

  // 3. Opening title slate during first 1.5 seconds
  if (globalTimeSec < 1.5) {
    const alpha =
      globalTimeSec < 0.25
        ? globalTimeSec / 0.25
        : globalTimeSec > 1.15
          ? (1.5 - globalTimeSec) / 0.35
          : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(15, 19, 28, 0.75)';
    const boxW = Math.min(width * 0.86, 520);
    const boxH = 68;
    const boxX = (width - boxW) / 2;
    const boxY = height * 0.08;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffc174';
    ctx.font = `700 ${Math.round(width * 0.032)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storyTitle.slice(0, 38), width / 2, boxY + boxH / 2);
    ctx.restore();
  }

  // 4. Synchronized Subtitles
  if (activeSubtitle) {
    const padX = Math.round(width * 0.07);
    const maxTextW = width - padX * 2 - 28;
    const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.042));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const wrapped = wrapTextLines(ctx, activeSubtitle.text, maxTextW);

    const lineHeight = Math.round(fontSize * 1.28);
    const cardPadY = 14;
    const speakerRowH = Math.round(fontSize * 0.95);
    const boxH = cardPadY * 2 + speakerRowH + wrapped.length * lineHeight;
    const boxW = width - padX * 2;
    const boxY = height - boxH - Math.round(height * 0.065);

    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.84)';
    ctx.beginPath();
    ctx.roundRect(padX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Speaker label
    ctx.fillStyle = activeSubtitle.speakerColor;
    ctx.font = `700 ${Math.round(fontSize * 0.68)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      activeSubtitle.speakerName.toUpperCase(),
      width / 2,
      boxY + cardPadY
    );

    // Spoken / Narrated line
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    wrapped.forEach((line, idx) => {
      ctx.fillText(
        line,
        width / 2,
        boxY + cardPadY + speakerRowH + idx * lineHeight
      );
    });
    ctx.restore();
  }

  // 5. Scene transitions (smooth black crossfade at start/end of scenes and video)
  let fadeAlpha = 0;
  if (sceneLocalTimeSec < 0.25) {
    fadeAlpha = 1 - sceneLocalTimeSec / 0.25;
  } else if (sceneDurationSec - sceneLocalTimeSec < 0.22) {
    fadeAlpha = 1 - (sceneDurationSec - sceneLocalTimeSec) / 0.22;
  }
  if (totalDurationSec - globalTimeSec < 0.35) {
    fadeAlpha = Math.max(fadeAlpha, 1 - (totalDurationSec - globalTimeSec) / 0.35);
  }

  if (fadeAlpha > 0.01) {
    ctx.fillStyle = `rgba(10, 14, 22, ${Math.min(1, Math.max(0, fadeAlpha)).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Suppress unused variable warning while keeping sceneTitle available for future slate options
  void sceneTitle;
}
