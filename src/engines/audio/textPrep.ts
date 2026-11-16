import type { FaceExpression, ScriptLine } from '../../types/story';

export interface PreparedLineItem {
  id: string;
  sceneId: string;
  lineId: string;
  speakerId: string;
  speakerType: 'narrator' | 'character';
  speakerName: string;
  displayText: string;
  spokenText: string;
  emotion: FaceExpression;
}

export function cleanTextForSpeech(rawText: string): string {
  let text = rawText
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/["“”]/g, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*--\s*/g, ', ')
    .replace(/\.\.\.+/g, '...')
    .trim();

  // Common readability expansions for clear pronunciation
  text = text
    .replace(/\bMr\./g, 'Mister')
    .replace(/\bMrs\./g, 'Missus')
    .replace(/\bDr\./g, 'Doctor')
    .replace(/\bSt\./g, 'Saint')
    .replace(/&/g, ' and ');

  if (text && !/[.!?]$/.test(text)) {
    text = `${text}.`;
  }
  return text;
}

export function splitLongDisplayText(text: string, maxChars = 190): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]?/g) || [trimmed];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const part = s.trim();
    if (!part) continue;
    if ((current + ' ' + part).trim().length <= maxChars) {
      current = (current + ' ' + part).trim();
    } else {
      if (current) chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [trimmed];
}

export function prepareSceneDialogueSegments(
  sceneId: string,
  lines: ScriptLine[]
): PreparedLineItem[] {
  const result: PreparedLineItem[] = [];
  const usedIds = new Set<string>();

  lines.forEach((line, lIdx) => {
    const chunks = splitLongDisplayText(line.text);
    const isNarration = line.type === 'narration';
    const speakerId = isNarration ? 'narrator' : line.speakerId || 'char_1';
    const speakerName = isNarration ? 'Narrator' : line.speakerName || 'Character';
    const safeLineId = String(line.id || `line_${lIdx + 1}`).trim();

    chunks.forEach((chunkText, cIdx) => {
      const spokenText = cleanTextForSpeech(chunkText);
      if (!spokenText) return;

      let candidateId =
        chunks.length > 1
          ? `${sceneId}__${safeLineId}_part_${cIdx + 1}`
          : `${sceneId}__${safeLineId}`;
      if (usedIds.has(candidateId)) {
        candidateId = `${candidateId}_${lIdx + 1}`;
      }
      usedIds.add(candidateId);

      result.push({
        id: candidateId,
        sceneId,
        lineId: line.id,
        speakerId,
        speakerType: isNarration ? 'narrator' : 'character',
        speakerName,
        displayText: chunkText,
        spokenText,
        emotion: line.emotion,
      });
    });
  });

  return result;
}
