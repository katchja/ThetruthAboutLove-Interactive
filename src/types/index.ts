export type SourceType = 'chapter' | 'article' | 'note' | 'scan' | 'citation' | 'book';
export type ArchiveSection = 'authored' | 'references';
export type AppView = 'landing' | 'archive';

export type ChatModelTier =
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.8-flash'
  | 'gemini-4-argon';

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  section?: ArchiveSection; // 'authored' ("Authored by Catalina") | 'references' ("Literature, References and Quotations")
  reference?: string; // e.g., "Chapter 2, pp. 45-62" or "DOI: 10.1016/..."
  author?: string;
  year?: string;
  summary: string;
  content: string; // Transcribed/full text used for local vector search
  externalUrl?: string; // External buy or read link for readers
  imageUrl?: string; // Archival scan or manuscript image preview
  images?: string[]; // Additional or multiple pictures attached to the card
  ocrData?: {
    rawTranscription: string;
    detectedPage?: string;
    documentType?: string;
    confidence?: number;
  };
  tags: string[];
  isProtected?: boolean; // If true, readers only see metadata & citations, full text stays in vector index
  createdAt: number;
  updatedAt?: number;
}

export function getSourceImages(source: Source): string[] {
  const list: string[] = [];
  if (source.images && Array.isArray(source.images)) {
    for (const img of source.images) {
      if (img && !list.includes(img)) list.push(img);
    }
  }
  if (source.imageUrl && !list.includes(source.imageUrl)) {
    list.unshift(source.imageUrl);
  }
  return list;
}

export function getSourceSection(source: Source): ArchiveSection {
  if (source.section) return source.section;
  if (source.type === 'citation' || source.type === 'book') return 'references';
  if (
    source.type === 'chapter' ||
    source.type === 'article' ||
    (source.author && source.author.toLowerCase().includes('catalina'))
  ) {
    return 'authored';
  }
  return 'references';
}

export interface VectorChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  reference?: string;
  text: string;
  vector: number[]; // 256-dim normalized vector
  tokenCount: number;
}

export interface SearchResult {
  chunk: VectorChunk;
  similarity: number; // 0 to 1
  matchedTerms: string[];
}

export interface Citation {
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  reference?: string;
  snippet: string;
  index: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: Citation[];
  model?: string;
  isOffline?: boolean;
}

export interface StudioArtifact {
  id: string;
  title: string;
  type: 'study_guide' | 'faq' | 'timeline' | 'briefing_doc' | 'mindmap';
  content: string;
  createdAt: number;
}

export interface AudioOverviewData {
  title: string;
  script: string;
  style: 'podcast' | 'author_monologue';
  durationEstimateSeconds: number;
  generatedAt: number;
}

export interface BookMetadata {
  title: string;
  subtitle: string;
  author: string;
  authorRole: string;
  authorBio: string;
  isbn?: string;
  publisher?: string;
  publicationYear: string;
  description: string;
  coverAccent: string;
  purchaseUrl?: string;
}

export interface VoiceSettings {
  engine: 'cloned_author' | 'browser';
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  style: 'author_monologue' | 'podcast';
  voiceCloningKey?: string;
  voicePersonaPrompt?: string;
  prebuiltBaseVoice?: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';
  referenceAudioDataUrl?: string;
  consentRecordedAt?: number;
  isClonedVoiceActive?: boolean;
  cloudAccessToken?: string;
}
