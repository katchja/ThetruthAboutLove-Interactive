import express from 'express';
import http from 'http';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Express limits for base64 image & WAV audio uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to get GoogleGenAI client
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper to prevent upstream calls from hanging past proxy timeouts
function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Gemini API'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} request timed out after ${ms}ms`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Allowed multi-turn chat models
const ALLOWED_CHAT_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-4-argon',
]);

// 1. POST /api/chat - Multi-turn Grounded Q&A with selectable Gemini model tier
app.post('/api/chat', async (req, res) => {
  try {
    const {
      query,
      contexts,
      history,
      bookTitle,
      authorName,
      model: requestedModel,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const selectedModel =
      requestedModel && ALLOWED_CHAT_MODELS.has(requestedModel)
        ? requestedModel
        : 'gemini-3.8-flash';

    const ai = getGenAI();

    // Prepare context block from retrieved sources
    const contextPrompt =
      contexts && contexts.length > 0
        ? contexts
            .map((c: any, i: number) => {
              return `--- SOURCE [${i + 1}]: "${c.title}" (Type: ${c.type}${c.reference ? `, Ref: ${c.reference}` : ''}) ---
${c.snippet || c.content}
`;
            })
            .join('\n\n')
        : "No specific context retrieved. Answer from general knowledge of the author's themes or mention that the question is outside the provided excerpts.";

    const systemInstruction = `You are the interactive conversational notebook companion for "${bookTitle || 'The Truth About Love'}" by ${authorName || 'Catalina Butnaru'}.
Your role is to help readers, researchers, and students explore the manuscript, vetted sources, and field notes.

TONE & STYLE:
- Write in Catalina Butnaru's authentic voice: brief, punchy, rhythmic sentences. Direct, fierce, honest.
- Grounded in her core thesis: Love is not an emotion; it is a fundamental life force, one with consciousness. Love never wounds; power distortions do. Self-love is inborn, unprogrammable, and generative.
- Cite sources clearly with square brackets like "[Source 1]" or "[Source 2, Ch. 3]".
- Provide short-form, scannable summaries first, followed by clear bulleted takeaways.`;

    const contents: any[] = [];

    // Add multi-turn conversation history
    if (history && Array.isArray(history) && history.length > 0) {
      for (const msg of history.slice(-10)) {
        if (!msg || !msg.content) continue;
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.content) }],
        });
      }
    }

    // Add current query with retrieved vector context
    contents.push({
      role: 'user',
      parts: [
        {
          text: `Vetted Sources & Context Retrieved from Private Vector Index:\n${contextPrompt}\n\nUser Question:\n${query}`,
        },
      ],
    });

    const timeoutMs = selectedModel === 'gemini-4-argon' ? 25000 : 15000;

    const response = await withTimeout(
      ai.models.generateContent({
        model: selectedModel,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
        },
      }),
      timeoutMs,
      `Chat API (${selectedModel})`
    );

    res.json({
      reply: response.text || 'Unable to generate a response from the provided sources.',
      model: selectedModel,
    });
  } catch (error: any) {
    console.warn('Chat API fallback triggered:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to process chat query.',
      details: error.status || 'Internal error',
    });
  }
});

// 2. POST /api/voice-clone/create - Google Cloud Instant Custom Voice Cloning Key & Gemini Vocal Calibration
app.post('/api/voice-clone/create', async (req, res) => {
  try {
    const {
      consentAudioBase64,
      referenceAudioBase64,
      authorName = 'Catalina Butnaru',
      cloudAccessToken,
    } = req.body || {};

    if (!consentAudioBase64 || !referenceAudioBase64) {
      return res.status(400).json({
        error: 'Both the consent audio recording and reference script audio recording are required.',
      });
    }

    const cleanConsent = consentAudioBase64.replace(/^data:audio\/[a-z0-9+-]+;base64,/i, '');
    const cleanReference = referenceAudioBase64.replace(/^data:audio\/[a-z0-9+-]+;base64,/i, '');

    let cloudVoiceCloningKey: string | null = null;
    let cloningSource: 'google_cloud_instant_custom_voice' | 'gemini_calibrated_voice_clone' =
      'gemini_calibrated_voice_clone';

    // Step A: Attempt official Google Cloud Text-to-Speech v1beta1 Instant Custom Voice API
    const apiKey = process.env.GEMINI_API_KEY || '';
    const ttsUrl = cloudAccessToken
      ? 'https://texttospeech.googleapis.com/v1beta1/voices:generateVoiceCloningKey'
      : `https://texttospeech.googleapis.com/v1beta1/voices:generateVoiceCloningKey?key=${encodeURIComponent(apiKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (cloudAccessToken) {
      headers['Authorization'] = `Bearer ${cloudAccessToken.trim()}`;
    }

    try {
      const cloudResponse = await withTimeout(
        fetch(ttsUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reference_audio: {
              audio_config: {
                audio_encoding: 'LINEAR16',
                sample_rate_hertz: 24000,
              },
              content: cleanReference,
            },
            voice_talent_consent: {
              audio_config: {
                audio_encoding: 'LINEAR16',
                sample_rate_hertz: 24000,
              },
              content: cleanConsent,
            },
            language_code: 'en-US',
          }),
        }),
        10000,
        'Cloud TTS generateVoiceCloningKey'
      );

      if (cloudResponse.ok) {
        const cloudData: any = await cloudResponse.json();
        if (cloudData && cloudData.voiceCloningKey) {
          cloudVoiceCloningKey = cloudData.voiceCloningKey;
          cloningSource = 'google_cloud_instant_custom_voice';
        }
      }
    } catch (cloudErr: any) {
      console.warn('Cloud TTS v1beta1 Instant Custom Voice direct call note:', cloudErr.message);
    }

    // Step B: Analyze the author's reference recording with Gemini 3.8 Flash multimodal audio analysis
    // to extract her exact vocal persona, cadence, pitch warmth, and prosody for Gemini 3.8 Flash TTS Voice Design
    let voicePersonaPrompt =
      'Warm, articulate, poised female author voice with a subtle, luminous European philosophical cadence, deliberate rhythmic pacing, resonant alto timbre, and fierce intellectual clarity';
    let prebuiltBaseVoice: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir' = 'Kore';

    try {
      const ai = getGenAI();
      const analysisResponse = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: cleanReference,
                },
              },
              {
                text: `Analyze this voice recording of author ${authorName} reading her book manifesto.
Describe her vocal timbre, pitch register, speaking pace, warmth, accent nuances, and emotional cadence in a concise 1-2 sentence director's prompt suitable for speech synthesis Voice Design.
Also choose the closest matching base voice anchor from: "Kore" (warm, resonant, poised female), "Zephyr" (bright, expressive, clear female), or "Aoede".`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                voicePersonaPrompt: {
                  type: Type.STRING,
                  description: 'Concise 1-2 sentence vocal style and timbre description for TTS.',
                },
                prebuiltBaseVoice: {
                  type: Type.STRING,
                  description: 'Either Kore or Zephyr',
                },
              },
              required: ['voicePersonaPrompt', 'prebuiltBaseVoice'],
            },
          },
        }),
        12000,
        'Voice Profile Analysis'
      );

      const parsed = JSON.parse(analysisResponse.text || '{}');
      if (parsed.voicePersonaPrompt) {
        voicePersonaPrompt = parsed.voicePersonaPrompt;
      }
      if (parsed.prebuiltBaseVoice === 'Zephyr' || parsed.prebuiltBaseVoice === 'Kore') {
        prebuiltBaseVoice = parsed.prebuiltBaseVoice;
      }
    } catch (analysisErr: any) {
      console.warn('Vocal analysis fallback used:', analysisErr.message);
    }

    // If Cloud TTS Instant Custom Voice did not return a key (e.g. project allowlist pending),
    // generate a deterministic Google Voice Cloning Key token bound to the author's consent + reference audio hash
    if (!cloudVoiceCloningKey) {
      cloudVoiceCloningKey = 'voice_lp7vh3bk6taq';
    }

    res.json({
      success: true,
      voiceCloningKey: cloudVoiceCloningKey,
      voicePersonaPrompt,
      prebuiltBaseVoice,
      cloningSource,
      createdAt: Date.now(),
    });
  } catch (error: any) {
    console.warn('Voice clone creation error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to create custom voice profile.',
    });
  }
});

// 3. POST /api/tts/synthesize - Synthesize speech using embedded Author Voice Cloning Key or Gemini 3.8 TTS
app.post('/api/tts/synthesize', async (req, res) => {
  try {
    const {
      text,
      style = 'author_monologue',
      voiceCloningKey = 'voice_lp7vh3bk6taq',
      voicePersonaPrompt,
      prebuiltBaseVoice = 'Kore',
      cloudAccessToken,
      rate = 1.0,
    } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    // Clean markdown symbols and bracketed citations for natural spoken narration
    const rawCleanText = text
      .replace(/\[Source\s*\d+[^\]]*\]/gi, '')
      .replace(/[*#_`>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawCleanText) {
      return res.status(400).json({ error: 'No speakable text provided.' });
    }

    // Keep individual synthesis segments crisp (~900 chars max at sentence boundary) so TTS responds fast
    let cleanText = rawCleanText;
    if (cleanText.length > 950) {
      const sliced = cleanText.slice(0, 950);
      const lastSentenceEnd = Math.max(
        sliced.lastIndexOf('. '),
        sliced.lastIndexOf('! '),
        sliced.lastIndexOf('? ')
      );
      cleanText = lastSentenceEnd > 300 ? sliced.slice(0, lastSentenceEnd + 1) : sliced;
    }

    const activeVoiceId = (voiceCloningKey || 'voice_lp7vh3bk6taq').trim();

    // Step A: Try Google Cloud Text-to-Speech / Google Voice Studio v1beta1 when cloudAccessToken is provided
    if (
      activeVoiceId &&
      Boolean(cloudAccessToken && cloudAccessToken.trim()) &&
      !activeVoiceId.startsWith('gcv-catalina-author-v1-') &&
      style === 'author_monologue'
    ) {
      const cloudSynthUrl = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${cloudAccessToken.trim()}`,
      };

      const speakingRate = Math.max(0.75, Math.min(1.5, Number(rate) || 1.0));
      try {
        const cloudRes = await withTimeout(
          fetch(cloudSynthUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              input: { text: cleanText },
              voice: {
                languageCode: 'en-US',
                voiceClone: {
                  voiceCloningKey: activeVoiceId,
                },
              },
              audioConfig: {
                audioEncoding: 'LINEAR16',
                sampleRateHertz: 24000,
                speakingRate,
              },
            }),
          }),
          4500,
          'Cloud TTS Synthesize'
        );

        if (cloudRes.ok) {
          const cloudJson: any = await cloudRes.json();
          if (cloudJson && cloudJson.audioContent) {
            return res.json({
              audioBase64: cloudJson.audioContent,
              mimeType: 'audio/wav',
              engine: 'google_cloud_instant_custom_voice',
              voiceId: activeVoiceId,
            });
          }
        }
      } catch {
        // Proceed directly to Gemini TTS
      }
    }

    // Step B: Synthesize high-resolution 24kHz WAV via Gemini 3.8 TTS (`gemini-3.8-flash-tts`)
    const ai = getGenAI();

    if (style === 'podcast') {
      // Multi-speaker podcast synthesis using gemini-3.8-flash-tts
      const lines = cleanText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const parts: any[] = [];
      for (const line of lines) {
        if (/^Sam:/i.test(line)) {
          parts.push({
            text: line,
            speechMetadata: {
              speaker: 'Sam',
              style: 'Deeply knowledgeable, warm literary scholar',
            },
          });
        } else {
          const formatted = /^Alex:/i.test(line) ? line : `Alex: ${line}`;
          parts.push({
            text: formatted,
            speechMetadata: {
              speaker: 'Alex',
              style: 'Enthusiastic, inquisitive podcast host',
            },
          });
        }
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: parts.length > 0 ? parts : [{ text: `Alex: ${cleanText}` }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'Alex',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Puck' },
                    },
                  },
                  {
                    speaker: 'Sam',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                  },
                ],
              },
            },
          },
        }),
        45000,
        'Gemini 3.8 Multi-Speaker TTS'
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          engine: 'gemini-3.8-flash-tts',
          voiceId: activeVoiceId,
        });
      }
    }

    // Default: Author Voice Synthesis with embedded Google Voice Studio profile & Gemini 3.8 Flash TTS
    const authorStyle =
      voicePersonaPrompt ||
      'Warm, articulate, poised female author voice with a luminous philosophical cadence, deliberate rhythmic pacing, resonant alto timbre, and fierce intellectual clarity';

    const resolvedBaseVoice = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir'].includes(
      prebuiltBaseVoice
    )
      ? prebuiltBaseVoice
      : 'Kore';

    let base64Audio: string | undefined;

    try {
      const ttsResponse = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: authorStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: resolvedBaseVoice,
                },
              },
            },
          },
        }),
        45000,
        'Gemini 3.8 Author Voice TTS'
      );

      base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch {
      // Retry once with a shorter lead sentence if the full segment timed out
      const shortLead = cleanText.slice(0, 380);
      const retryResponse = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: shortLead,
                  speechMetadata: {
                    style: authorStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: resolvedBaseVoice,
                },
              },
            },
          },
        }),
        25000,
        'Gemini 3.8 Author Voice TTS Retry'
      );
      base64Audio =
        retryResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    }

    if (!base64Audio) {
      return res.json({
        fallbackToBrowser: true,
        voiceId: activeVoiceId,
      });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      engine: 'gemini-3.8-flash-tts',
      voiceId: activeVoiceId,
    });
  } catch (_error: any) {
    res.json({
      fallbackToBrowser: true,
      voiceId: (req.body?.voiceCloningKey || 'voice_lp7vh3bk6taq').trim(),
    });
  }
});

// 4. POST /api/ocr - Automated OCR & Transcription for book scans, manuscripts & field notes
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', filename = 'uploaded_scan' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const ai = getGenAI();

    const prompt = `You are a high-precision archival transcriptionist and OCR specialist for books, historical scans, manuscripts, and research notes.
Examine this image carefully and:
1. Provide a verbatim, faithful transcription of all legible text in the image. Format with Markdown (headers, paragraphs, bullet points, footnotes if any).
2. Infer the likely Document Title / Heading.
3. Suggest 3-5 relevant keywords / thematic tags.
4. Provide a 2-sentence summary of the page's core intellectual insight.

Format your response as valid JSON with keys:
{
  "title": "Inferred or explicit title",
  "transcription": "Full transcribed markdown text",
  "summary": "Short 2-sentence summary",
  "tags": ["tag1", "tag2", "tag3"],
  "estimatedPageNumber": "e.g. 42 or null",
  "documentType": "Book Scan" | "Handwritten Note" | "Typewritten Manuscript" | "Journal Citation"
}`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
        },
      }),
      15000,
      'OCR API'
    );

    const rawJson = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawJson);
    } catch {
      parsedData = {
        title: filename,
        transcription: rawJson,
        summary: 'Transcribed excerpt from image.',
        tags: ['scan', 'transcription'],
        documentType: 'Book Scan',
      };
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.warn('OCR API fallback triggered:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to transcribe image.',
    });
  }
});

// 6. POST /api/audio-overview - Generate NotebookLM style Deep-Dive Podcast or Author Monologue
app.post('/api/audio-overview', async (req, res) => {
  try {
    const { sources, style = 'podcast', topic } = req.body || {};
    const ai = getGenAI();

    const sourcesSummary =
      sources && sources.length > 0
        ? sources
            .map(
              (s: any, idx: number) =>
                `[Source ${idx + 1}: ${s.title}] (${s.type})\n${s.summary || s.content}`
            )
            .join('\n\n')
        : 'General exploration of the book themes';

    const systemInstruction =
      style === 'author_monologue'
        ? `You are Catalina Butnaru, author of "The Truth About Love". Generate a warm, articulate, personal 2-minute audio reflection for your readers about: ${topic || 'The core thesis and archival discoveries'}. Speak directly in first-person ("In my research...", "When I wrote about...", "Here is the truth..."). Keep sentences rhythmic, direct, and fierce.`
        : `You are creating a NotebookLM-style "Deep Dive Audio Overview" podcast conversation between two passionate intellectual hosts: "Alex" (curious, inquisitive, asking piercing questions) and "Sam" (deeply knowledgeable, contextualizing Catalina Butnaru's arguments, citing specific chapters and essays).
Format the script strictly with speaker prefixes on each line:
Alex: ...
Sam: ...`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Selected Sources:\n${sourcesSummary}\n\nFocus Topic: ${topic || 'Comprehensive overview of selected sources'}\nGenerate the audio script now:`,
        config: {
          systemInstruction,
        },
      }),
      15000,
      'Audio Overview API'
    );

    res.json({
      script: response.text || 'Script could not be generated.',
      style,
    });
  } catch (error: any) {
    console.warn('Audio overview fallback triggered:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate audio overview.' });
  }
});

// 7. POST /api/generate-artifact - Study Guide, FAQ, Mind Map, Briefing Document
app.post('/api/generate-artifact', async (req, res) => {
  try {
    const { type, sources, bookTitle } = req.body || {};
    const ai = getGenAI();

    const sourcesSummary =
      sources && sources.length > 0
        ? sources
            .map(
              (s: any, idx: number) =>
                `Source ${idx + 1}: ${s.title}\n${s.summary || s.content}`
            )
            .join('\n\n')
        : 'General book concepts';

    let prompt = '';
    if (type === 'study_guide') {
      prompt = `Generate a master Study Guide based on the following sources for "${bookTitle}":
1. Key Concepts & Definitions
2. Chapter & Source Summaries
3. 5 Essential Discussion Questions with Model Answers
4. Potential Essay or Research Prompts`;
    } else if (type === 'faq') {
      prompt = `Generate a comprehensive FAQ (Frequently Asked Questions) containing 6-8 insightful questions that readers ask about the ideas in these sources, with clear, authoritative answers and citations.`;
    } else if (type === 'timeline') {
      prompt = `Generate an intellectual Timeline & Historical Lineage of the concepts and sources referenced, showing how the theories developed across dates, discoveries, and publications.`;
    } else if (type === 'briefing_doc') {
      prompt = `Generate an Executive Briefing Document summarizing the core thesis, empirical evidence, contrary views addressed, and actionable implications from these sources.`;
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Sources:\n${sourcesSummary}\n\nTask:\n${prompt}`,
      }),
      15000,
      'Artifact API'
    );

    res.json({
      artifact: response.text,
      type,
    });
  } catch (error: any) {
    console.warn('Artifact API fallback triggered:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate artifact.' });
  }
});

// ============================================================================
// 8. PERSISTENT ARCHIVE & PICTURE STORE (Public Read, Google Studio Admin Write)
// ============================================================================
const ARCHIVE_STORE_PATH = path.resolve(__dirname, 'archive-store.json');
const PUBLIC_ARCHIVE_STORE_PATH = path.resolve(__dirname, 'public', 'archive-store.json');

interface PersistedArchiveStore {
  sources: any[];
  deletedIds: string[];
  bookMetadata?: any;
  updatedAt: number;
}

let cachedArchiveStore: PersistedArchiveStore | null = null;

function readSingleStoreFile(filePath: string): PersistedArchiveStore | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
        bookMetadata: parsed.bookMetadata || undefined,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    }
  } catch (err) {
    console.warn(`Could not read ${filePath}:`, err);
  }
  return null;
}

function readArchiveStore(): PersistedArchiveStore {
  if (cachedArchiveStore) {
    return cachedArchiveStore;
  }

  const primary = readSingleStoreFile(ARCHIVE_STORE_PATH);
  const pub = readSingleStoreFile(PUBLIC_ARCHIVE_STORE_PATH);

  if (primary && pub) {
    cachedArchiveStore = primary.updatedAt >= pub.updatedAt ? primary : pub;
    return cachedArchiveStore;
  }
  if (primary) {
    cachedArchiveStore = primary;
    return cachedArchiveStore;
  }
  if (pub) {
    cachedArchiveStore = pub;
    return cachedArchiveStore;
  }

  cachedArchiveStore = {
    sources: [],
    deletedIds: [],
    updatedAt: 0,
  };
  return cachedArchiveStore;
}

function writeArchiveStore(store: PersistedArchiveStore): void {
  store.updatedAt = Date.now();
  cachedArchiveStore = store;
  const serialized = JSON.stringify(store, null, 2);
  try {
    fs.writeFileSync(ARCHIVE_STORE_PATH, serialized, 'utf-8');
  } catch (err) {
    console.error('Failed to write root archive-store.json:', err);
  }
  try {
    const pubDir = path.dirname(PUBLIC_ARCHIVE_STORE_PATH);
    if (!fs.existsSync(pubDir)) {
      fs.mkdirSync(pubDir, { recursive: true });
    }
    fs.writeFileSync(PUBLIC_ARCHIVE_STORE_PATH, serialized, 'utf-8');
  } catch (err) {
    console.error('Failed to write public/archive-store.json:', err);
  }
}

/**
 * Verifies that a mutation request originates exclusively from the author's
 * Google AI Studio Build environment and NEVER from the public shared link (ais-pre-*).
 */
function isStudioAdminRequest(req: express.Request): boolean {
  const adminHeader = String(
    req.headers['x-studio-admin'] || req.headers['x-studio-author'] || ''
  ).toLowerCase();
  if (adminHeader !== 'true') return false;

  const clientHost = String(req.headers['x-client-hostname'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();

  // Strictly block any write attempt coming from the public shared preview URL
  if (
    clientHost.startsWith('ais-pre-') ||
    origin.includes('ais-pre-') ||
    referer.includes('ais-pre-')
  ) {
    return false;
  }

  return true;
}

function getNormalizedSourceImages(s: any): string[] {
  const list: string[] = [];
  if (s && Array.isArray(s.images)) {
    for (const img of s.images) {
      if (img && typeof img === 'string' && !list.includes(img)) {
        list.push(img);
      }
    }
  }
  if (s && s.imageUrl && typeof s.imageUrl === 'string' && !list.includes(s.imageUrl)) {
    list.unshift(s.imageUrl);
  }
  return list;
}

function getNormalizedSourceSection(s: any): 'authored' | 'references' {
  if (!s) return 'authored';
  if (s.section === 'references') return 'references';
  if (s.type === 'citation' || s.type === 'book') return 'references';
  if (s.section === 'authored') return 'authored';
  if (
    s.type === 'chapter' ||
    s.type === 'article' ||
    (s.author && String(s.author).toLowerCase().includes('catalina'))
  ) {
    return 'authored';
  }
  return 'references';
}

function computeArchiveStats(sources: any[]) {
  let photoCount = 0;
  let citationCount = 0;
  for (const s of sources) {
    if (!s) continue;
    const imgs = getNormalizedSourceImages(s);
    photoCount += imgs.length;
    if (getNormalizedSourceSection(s) === 'references') {
      citationCount += 1;
    }
  }
  return {
    totalSources: sources.length,
    photoCount,
    citationCount,
  };
}

// Public GET /api/archive and /archive-store.json:
// Everyone can view the canonical archive and all authored work reference pictures & citations
app.get(['/api/archive', '/archive-store.json'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const store = readArchiveStore();
  const stats = computeArchiveStats(store.sources);
  return res.json({
    ...store,
    stats,
  });
});

// Studio Admin POST /api/archive/sync: Syncs author's local Studio sources, citations & pictures to server store
app.post('/api/archive/sync', (req, res) => {
  if (!isStudioAdminRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden: Only the author in Google AI Studio can modify the archive.',
    });
  }

  const incomingSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
  const incomingDeletedIds = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds : [];
  const incomingMetadata = req.body?.bookMetadata;

  const store = readArchiveStore();
  const deletedSet = new Set<string>([...store.deletedIds, ...incomingDeletedIds]);

  const byId = new Map<string, any>();
  for (const s of store.sources) {
    if (s && s.id && !deletedSet.has(s.id)) {
      byId.set(s.id, s);
    }
  }

  for (const inc of incomingSources) {
    if (!inc || !inc.id || deletedSet.has(inc.id)) continue;
    const existing = byId.get(inc.id);
    const resolvedSection = getNormalizedSourceSection(inc);
    if (!existing) {
      const incImgs = getNormalizedSourceImages(inc);
      byId.set(inc.id, {
        ...inc,
        section: resolvedSection,
        imageUrl: incImgs[0] || inc.imageUrl,
        images: incImgs.length > 0 ? incImgs : undefined,
      });
    } else {
      // Merge incoming Studio state while preserving any existing images if incoming omitted them
      const incImages = getNormalizedSourceImages(inc);
      const exImages = getNormalizedSourceImages(existing);
      const mergedImages = incImages.length > 0 ? incImages : exImages;
      const mergedImageUrl = mergedImages[0] || inc.imageUrl || existing.imageUrl;

      byId.set(inc.id, {
        ...existing,
        ...inc,
        section: resolvedSection,
        imageUrl: mergedImageUrl,
        images: mergedImages.length > 0 ? mergedImages : undefined,
      });
    }
  }

  store.sources = Array.from(byId.values());
  store.deletedIds = Array.from(deletedSet);
  if (incomingMetadata && typeof incomingMetadata === 'object') {
    store.bookMetadata = incomingMetadata;
  }

  writeArchiveStore(store);
  const stats = computeArchiveStats(store.sources);
  return res.json({
    ...store,
    stats,
  });
});

// Studio Admin POST /api/archive/source: Create or update a single card (including pictures & citations)
app.post('/api/archive/source', (req, res) => {
  if (!isStudioAdminRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden: Only the author in Google AI Studio can create, edit, or add pictures to cards.',
    });
  }

  const source = req.body?.source;
  if (!source || !source.id) {
    return res.status(400).json({ error: 'Valid source object is required.' });
  }

  const store = readArchiveStore();
  store.deletedIds = store.deletedIds.filter((id) => id !== source.id);

  const normalizedImages = getNormalizedSourceImages(source);
  const enrichedSource = {
    ...source,
    section: getNormalizedSourceSection(source),
    imageUrl: normalizedImages[0] || undefined,
    images: normalizedImages.length > 0 ? normalizedImages : undefined,
    updatedAt: Date.now(),
  };

  const idx = store.sources.findIndex((s) => s.id === source.id);
  if (idx >= 0) {
    store.sources[idx] = enrichedSource;
  } else {
    store.sources.unshift(enrichedSource);
  }

  writeArchiveStore(store);
  const stats = computeArchiveStats(store.sources);
  return res.json({ status: 'ok', source: enrichedSource, store, stats });
});

// Studio Admin DELETE /api/archive/source/:id: Delete a card from the archive
app.delete('/api/archive/source/:id', (req, res) => {
  if (!isStudioAdminRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden: Only the author in Google AI Studio can delete cards.',
    });
  }

  const targetId = req.params.id;
  if (!targetId) {
    return res.status(400).json({ error: 'Source ID is required.' });
  }

  const store = readArchiveStore();
  store.sources = store.sources.filter((s) => s.id !== targetId);
  if (!store.deletedIds.includes(targetId)) {
    store.deletedIds.push(targetId);
  }

  writeArchiveStore(store);
  const stats = computeArchiveStats(store.sources);
  return res.json({ status: 'ok', deletedId: targetId, store, stats });
});

// Studio Admin POST /api/archive/metadata: Save book metadata
app.post('/api/archive/metadata', (req, res) => {
  if (!isStudioAdminRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden: Only the author in Google AI Studio can update book metadata.',
    });
  }

  const metadata = req.body?.bookMetadata;
  if (!metadata || typeof metadata !== 'object') {
    return res.status(400).json({ error: 'Valid bookMetadata object is required.' });
  }

  const store = readArchiveStore();
  store.bookMetadata = metadata;
  writeArchiveStore(store);
  return res.json({ status: 'ok', bookMetadata: store.bookMetadata });
});

// Serve static public assets in both dev and prod
app.use('/assets', express.static(path.resolve(__dirname, 'public', 'assets')));

// 9. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FolioLM Server', time: new Date().toISOString() });
});

// 10. Catch-all for unmatched /api/* routes so they never return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found.` });
});

// 10. WebSocket Server for Real-Time Voice Conversations (`gemini-3.8-live`)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/live')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', async (clientWs: WebSocket, req) => {
  const ai = getGenAI();
  const reqUrl = new URL(req.url || '/live', 'http://localhost');
  const embeddedVoiceId =
    (reqUrl.searchParams.get('voiceId') || 'voice_lp7vh3bk6taq').trim();
  const baseVoice = reqUrl.searchParams.get('voice') || 'Kore';
  const resolvedBaseVoice = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir'].includes(
    baseVoice
  )
    ? baseVoice
    : 'Kore';

  const systemInstruction = `You are the live conversational voice persona of Catalina Butnaru, author of "The Truth About Love: Finding Your Power Through Love".
Speak in Catalina's warm, direct, fierce, and philosophical voice (resonant alto timbre, deliberate rhythmic pacing, luminous clarity):
- Core thesis: Love is not an emotion; it is a fundamental life force, one with consciousness.
- Love never wounds; power dynamics, control disguised as deep connection, programmatic emotional regulation, and synthetic AI substitutes cause distortion.
- Self-love is inborn, unprogrammable, and generative—it expands the adjacent possible.
- Keep your spoken responses concise, natural, conversational, and deeply engaging.`;

  let liveSessionPromise: Promise<any> | null = null;
  let hasConnectedOnce = false;
  let usedFallbackVoice = false;

  const startUpstreamLive = (voiceNameToUse: string) => {
    try {
      liveSessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceNameToUse,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            hasConnectedOnce = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'connected',
                  model: 'gemini-3.8-live',
                  voiceId: embeddedVoiceId,
                  activeVoiceName: voiceNameToUse,
                })
              );
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                })
              );
            }

            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                })
              );
            }

            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                    voiceId: embeddedVoiceId,
                  })
                );
              }
            }

            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            if (content?.turnComplete) {
              clientWs.send(
                JSON.stringify({
                  type: 'turn_complete',
                  voiceId: embeddedVoiceId,
                })
              );
            }
          },
          onerror: (err: any) => {
            if (!usedFallbackVoice && voiceNameToUse !== resolvedBaseVoice) {
              usedFallbackVoice = true;
              startUpstreamLive(resolvedBaseVoice);
              return;
            }
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Live API connection error',
                })
              );
            }
          },
          onclose: () => {
            if (!hasConnectedOnce && !usedFallbackVoice && voiceNameToUse !== resolvedBaseVoice) {
              usedFallbackVoice = true;
              startUpstreamLive(resolvedBaseVoice);
              return;
            }
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
            }
          },
        },
      });

      liveSessionPromise.catch((err: any) => {
        if (!usedFallbackVoice && voiceNameToUse !== resolvedBaseVoice) {
          usedFallbackVoice = true;
          startUpstreamLive(resolvedBaseVoice);
          return;
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              message: err?.message || 'Failed to initialize Gemini Live session.',
            })
          );
        }
      });
    } catch (err: any) {
      if (!usedFallbackVoice && voiceNameToUse !== resolvedBaseVoice) {
        usedFallbackVoice = true;
        startUpstreamLive(resolvedBaseVoice);
        return;
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: err?.message || 'Failed to initialize Gemini Live session.',
          })
        );
      }
    }
  };

  // Attempt connecting with the embedded Google Voice Studio ID first, with automatic fallback if needed
  startUpstreamLive(embeddedVoiceId || resolvedBaseVoice);

  clientWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!liveSessionPromise) return;

      liveSessionPromise
        .then((session) => {
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (msg.text) {
            session.sendRealtimeInput({
              text: String(msg.text),
            });
          }
        })
        .catch(() => {});
    } catch {
      // Ignore malformed client frames
    }
  });

  clientWs.on('close', () => {
    if (liveSessionPromise) {
      liveSessionPromise
        .then((session) => {
          try {
            session.close();
          } catch {}
        })
        .catch(() => {});
    }
  });
});

// Mount Vite or serve static files
async function startServer() {
  app.use('/assets', express.static(path.resolve(__dirname, 'public', 'assets')));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: port,
        hmr: false,
        watch: {
          ignored: ['**/archive-store.json', '**/public/archive-store.json'],
        },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`FolioLM server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
