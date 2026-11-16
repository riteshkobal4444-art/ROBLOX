import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '1mb' }));

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(getAiClient()),
  });
});

const storyResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Catchy, short cinematic title for the Roblox story video.',
    },
    summary: {
      type: Type.STRING,
      description: '2-sentence summary of the story arc.',
    },
    characters: {
      type: Type.ARRAY,
      description: '2 to 4 distinct recurring blocky Roblox-style characters.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Lowercase slug id like char_1' },
          name: { type: Type.STRING, description: 'Character display name' },
          role: { type: Type.STRING, description: 'Short role like Protagonist, Rival, Mentor' },
          personality: { type: Type.STRING, description: 'Brief personality trait' },
          appearance: {
            type: Type.OBJECT,
            properties: {
              skinColor: { type: Type.STRING, description: 'Hex color like #f2c9a0' },
              shirtColor: { type: Type.STRING, description: 'Hex color like #2563eb' },
              pantsColor: { type: Type.STRING, description: 'Hex color like #1e293b' },
              hairStyle: {
                type: Type.STRING,
                enum: [
                  'spiky',
                  'bob',
                  'ponytail',
                  'curly',
                  'cap',
                  'hoodie',
                  'side_part',
                  'long_wavy',
                  'twin_pigtails',
                  'bun',
                  'fade',
                ],
              },
              hairColor: { type: Type.STRING, description: 'Hex color like #2d1b0e' },
              stylePreset: {
                type: Type.STRING,
                enum: ['boy', 'girl', 'neutral'],
              },
              outfitStyle: {
                type: Type.STRING,
                enum: [
                  'casual_tee',
                  'jacket',
                  'varsity',
                  'hoodie_outfit',
                  'dress',
                  'skirt_top',
                  'overalls',
                ],
              },
              faceStyle: {
                type: Type.STRING,
                enum: ['classic', 'lashes_bright', 'freckles', 'cheeky'],
              },
              shoeColor: { type: Type.STRING, description: 'Hex color for shoes like #f8fafc or #1e293b' },
              accentColor: { type: Type.STRING, description: 'Contrasting outfit accent hex color like #f59e0b' },
              faceExpression: {
                type: Type.STRING,
                enum: [
                  'neutral',
                  'happy',
                  'sad',
                  'angry',
                  'surprised',
                  'confused',
                  'scared',
                  'excited',
                  'determined',
                  'worried',
                ],
              },
              accessory: {
                type: Type.STRING,
                enum: ['none', 'glasses', 'backpack', 'crown', 'headphones', 'scarf'],
              },
              bodyScale: { type: Type.NUMBER, description: 'Scale between 0.92 and 1.1' },
            },
            required: [
              'skinColor',
              'shirtColor',
              'pantsColor',
              'hairStyle',
              'hairColor',
              'stylePreset',
              'outfitStyle',
              'faceStyle',
              'shoeColor',
              'accentColor',
              'faceExpression',
              'accessory',
              'bodyScale',
            ],
          },
          voiceProfile: {
            type: Type.OBJECT,
            properties: {
              pitchHz: { type: Type.NUMBER, description: 'Base voice pitch between 135 and 290' },
              speed: { type: Type.NUMBER, description: 'Speaking speed between 0.9 and 1.15' },
              timbre: {
                type: Type.STRING,
                enum: ['bright', 'warm', 'deep', 'energetic'],
              },
            },
            required: ['pitchHz', 'speed', 'timbre'],
          },
        },
        required: ['id', 'name', 'role', 'personality', 'appearance', 'voiceProfile'],
      },
    },
    scenes: {
      type: Type.ARRAY,
      description: '3 to 5 sequential scenes totaling the target duration.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          index: { type: Type.INTEGER },
          title: { type: Type.STRING },
          environmentType: {
            type: Type.STRING,
            enum: [
              'town_square',
              'suburban_street',
              'city_street',
              'cozy_house_interior',
              'modern_house_interior',
              'forest_park',
              'sci_fi_plaza',
              'school_hallway',
              'school_classroom',
            ],
          },
          timeOfDay: {
            type: Type.STRING,
            enum: ['morning', 'day', 'sunset', 'night'],
          },
          mood: {
            type: Type.STRING,
            enum: [
              'upbeat',
              'tense',
              'heartwarming',
              'mysterious',
              'chaotic',
              'sad',
              'calm',
              'dramatic',
              'playful',
              'action',
            ],
          },
          weather: {
            type: Type.STRING,
            enum: ['clear', 'rain', 'storm', 'windy'],
          },
          durationSec: {
            type: Type.NUMBER,
            description: 'Duration of this scene in seconds (between 4 and 16).',
          },
          cameraShot: {
            type: Type.STRING,
            enum: [
              'wide_establishing',
              'medium_two_shot',
              'close_up_speaker',
              'tracking_follow',
              'slow_pan',
              'dramatic_push',
            ],
          },
          focusCharacterId: { type: Type.STRING },
          actionBeats: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                characterId: { type: Type.STRING },
                action: {
                  type: Type.STRING,
                  enum: [
                    'walk',
                    'run',
                    'talk',
                    'listen',
                    'stand',
                    'sit',
                    'wave',
                    'point',
                    'react_surprise',
                    'react_happy',
                    'look_around',
                    'turn',
                    'fall',
                  ],
                },
                startOffsetSec: { type: Type.NUMBER },
                endOffsetSec: { type: Type.NUMBER },
                fromX: { type: Type.NUMBER, description: 'X coordinate between -2.8 and 2.8' },
                fromZ: { type: Type.NUMBER, description: 'Z coordinate between -1.6 and 1.6' },
                toX: { type: Type.NUMBER, description: 'X coordinate between -2.8 and 2.8' },
                toZ: { type: Type.NUMBER, description: 'Z coordinate between -1.6 and 1.6' },
                facingYawDeg: { type: Type.NUMBER, description: 'Yaw rotation in degrees (-180 to 180)' },
              },
              required: [
                'characterId',
                'action',
                'startOffsetSec',
                'endOffsetSec',
                'fromX',
                'fromZ',
                'toX',
                'toZ',
                'facingYawDeg',
              ],
            },
          },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['narration', 'dialogue'] },
                speakerId: { type: Type.STRING },
                speakerName: { type: Type.STRING },
                text: { type: Type.STRING, description: 'Punchy spoken or narrated line (max 18 words).' },
                emotion: {
                  type: Type.STRING,
                  enum: [
                    'neutral',
                    'happy',
                    'sad',
                    'angry',
                    'surprised',
                    'confused',
                    'scared',
                    'excited',
                    'determined',
                    'worried',
                  ],
                },
                startOffsetSec: { type: Type.NUMBER },
                durationSec: { type: Type.NUMBER },
              },
              required: [
                'id',
                'type',
                'speakerName',
                'text',
                'emotion',
                'startOffsetSec',
                'durationSec',
              ],
            },
          },
          sfxCues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: [
                    'footsteps',
                    'door',
                    'door_close',
                    'chime',
                    'whoosh',
                    'pop',
                    'gasp',
                    'impact',
                    'vehicle',
                    'thunder',
                  ],
                },
                offsetSec: { type: Type.NUMBER },
              },
              required: ['type', 'offsetSec'],
            },
          },
        },
        required: [
          'id',
          'index',
          'title',
          'environmentType',
          'timeOfDay',
          'mood',
          'durationSec',
          'cameraShot',
          'actionBeats',
          'lines',
          'sfxCues',
        ],
      },
    },
  },
  required: ['title', 'summary', 'characters', 'scenes'],
};

app.post('/api/story/generate', async (req, res) => {
  try {
    const body = req.body as {
      prompt?: string;
      title?: string;
      genre?: string;
      targetDurationSec?: number;
      language?: string;
      aspectRatio?: string;
    };

    const promptText = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (promptText.length < 10) {
      res.status(400).json({ error: 'Please provide a story idea with at least 10 characters.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'No Gemini API key is configured on the server. You can configure GEMINI_API_KEY or use the On-Device Story Builder.',
        code: 'NO_API_KEY',
      });
      return;
    }

    const targetDuration = Number(body.targetDurationSec) || 30;
    const sceneCount = targetDuration <= 15 ? 3 : targetDuration <= 30 ? 4 : 5;
    const genre = body.genre || 'Adventure';
    const language = body.language || 'English';
    const optionalTitle = body.title?.trim() || '';

    const systemInstruction = `You are a cinematic Roblox machinima director and screenwriter.
Create an original, engaging, family-friendly story structured for automatic 3D animation.
Rules:
1. Write all title, summary, character roles, scene titles, and script lines in ${language}.
2. Keep dialogue and narration punchy, expressive, and cinematic (max 16 words per line so subtitles read cleanly).
3. Include both 'narration' and 'dialogue' lines across the scenes.
4. Design ${sceneCount} cohesive scenes whose durationSec values sum to roughly ${targetDuration} seconds.
5. Make sure every characterId and speakerId in actionBeats/lines matches one of the ids in characters, and give every scene and every line a unique id (like s1_l1, s2_l1).
6. Stage characters inside visible foreground bounds X [-2.4, 2.4] and Z [-1.4, 1.4], keeping characters at least 1.0m apart so they fit inside portrait & landscape frames without overlapping.
7. Differentiate boy, girl, and neutral characters authentically using varied stylePreset, hairStyle, outfitStyle, faceStyle, bodyScale, shoeColor, and tasteful modern hex color palettes (do NOT rely on stereotypical pink vs blue).
8. Set each scene's environmentType ('town_square', 'suburban_street', 'city_street', 'cozy_house_interior', 'modern_house_interior', 'forest_park', 'sci_fi_plaza', 'school_hallway', 'school_classroom'), timeOfDay ('morning', 'day', 'sunset', 'night'), mood ('upbeat', 'sad', 'mysterious', 'action', 'calm', 'dramatic', 'playful', 'heartwarming', 'tense'), weather ('clear', 'rain', 'storm', 'windy'), line emotion ('happy', 'sad', 'angry', 'surprised', 'confused', 'scared', 'excited', 'neutral'), and matching sfxCues only for events that actually happen.
9. Keep consecutive scenes occurring in the same physical location on the SAME environmentType and coherent timeOfDay; only switch environmentType when characters explicitly travel to a new location.`;

    const userPrompt = `Story idea: "${promptText}"
${optionalTitle ? `Preferred title: "${optionalTitle}"` : 'Create a fitting title.'}
Genre: ${genre}
Target total duration: ${targetDuration} seconds
Aspect ratio: ${body.aspectRatio || '9:16'}
Language: ${language}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: storyResponseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      res.status(502).json({ error: 'The story generator returned an empty response. Please retry.' });
      return;
    }

    const parsed = JSON.parse(rawText);
    res.json({ story: parsed, source: 'gemini-ai' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Story generation failed.';
    console.error('Story generation error:', err);
    res.status(500).json({ error: message });
  }
});

function getTtsAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ALLOWED_GEMINI_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

app.post('/api/tts/generate', async (req, res) => {
  try {
    const body = req.body as {
      text?: string;
      voiceName?: string;
      style?: string;
      language?: string;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Text is required for speech generation.' });
      return;
    }

    const ai = getTtsAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini TTS requires GEMINI_API_KEY on the server.',
        code: 'NO_API_KEY',
      });
      return;
    }

    const voiceName =
      typeof body.voiceName === 'string' && ALLOWED_GEMINI_VOICES.has(body.voiceName)
        ? body.voiceName
        : 'Kore';
    const language =
      typeof body.language === 'string' && body.language.trim()
        ? body.language.trim().slice(0, 32)
        : 'English';
    const baseStyle =
      typeof body.style === 'string' && body.style.trim()
        ? body.style.trim().slice(0, 110)
        : 'Clear, natural storytelling voice';
    const style = `Spoken in natural ${language}. ${baseStyle}`.slice(0, 160);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: { style },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'Speech generator returned no audio data.' });
      return;
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(wavBuffer.length));
    res.send(wavBuffer);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : 'TTS generation failed.';
    console.error('TTS generation error:', err);
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMsg)) {
      res.status(429).json({
        error:
          'Cloud Gemini Speech free-tier daily limit reached. Use Local Browser (Kokoro-82M) for unlimited free English speech.',
      });
      return;
    }
    res.status(500).json({ error: rawMsg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StoryForge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
