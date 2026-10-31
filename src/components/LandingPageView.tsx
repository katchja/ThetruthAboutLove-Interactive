import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  ExternalLink, 
  Volume2, 
  VolumeX,
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Quote, 
  ChevronRight,
  Send,
  Lock,
  Archive,
  Heart,
  Flame,
  Copy,
  Check,
  RotateCcw,
  Headphones,
  Sliders,
  MessageSquare
} from 'lucide-react';
import { BookMetadata, Source, ChatMessage, Citation, VoiceSettings, ChatModelTier, getSourceSection } from '../types';
import { speechEngine } from '../utils/speechEngine';

const DEFAULT_AUTHOR_VOICE_ID = 'voice_lp7vh3bk6taq';

interface LandingPageViewProps {
  bookMetadata: BookMetadata;
  sources: Source[];
  selectedSources: Source[];
  onOpenArchive: () => void;
  onSelectSource: (source: Source) => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  isChatLoading: boolean;
  onClearChat?: () => void;
  voiceSettings: VoiceSettings;
  onOpenVoiceSettings?: () => void;
  chatModel: ChatModelTier;
  onChangeChatModel: (model: ChatModelTier) => void;
  isOfflineMode: boolean;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  sources,
  onOpenArchive,
  onSelectSource,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
  voiceSettings,
  chatModel,
  onChangeChatModel,
  isOfflineMode,
}) => {
  const [quickQuery, setQuickQuery] = useState('');
  const [isPlayingIntro, setIsPlayingIntro] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const embeddedAuthorVoiceId =
    voiceSettings.voiceCloningKey &&
    !voiceSettings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
      ? voiceSettings.voiceCloningKey
      : DEFAULT_AUTHOR_VOICE_ID;

  const handlePlayVoiceIntro = () => {
    if (isPlayingIntro) {
      speechEngine.stop();
      setIsPlayingIntro(false);
      return;
    }

    const introText = `Love is not an emotion. It is a fundamental life force. When we understand this truth, the quality of our inner life increases. You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers. By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here's a place to start. This manifesto is for you, fierce lovers!`;
    setIsPlayingIntro(true);
    speechEngine.speak(
      introText,
      {
        ...voiceSettings,
        engine: voiceSettings.engine || 'cloned_author',
        voiceName: embeddedAuthorVoiceId,
        voiceCloningKey: embeddedAuthorVoiceId,
        style: 'author_monologue',
        isClonedVoiceActive: true,
      },
      {
        onEnd: () => setIsPlayingIntro(false),
        onError: () => setIsPlayingIntro(false),
      }
    );
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim() || isChatLoading) return;
    const q = quickQuery.trim();
    setQuickQuery('');
    await onSendMessage(q);
  };

  const handleSpeak = (messageId: string, content: string) => {
    if (speakingMessageId === messageId) {
      speechEngine.stop();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(messageId);
    speechEngine.speak(
      content,
      {
        ...voiceSettings,
        engine: voiceSettings.engine || 'cloned_author',
        voiceName: embeddedAuthorVoiceId,
        voiceCloningKey: embeddedAuthorVoiceId,
        style: 'author_monologue',
        isClonedVoiceActive: true,
      },
      {
        onEnd: () => setSpeakingMessageId(null),
        onError: () => setSpeakingMessageId(null),
      }
    );
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sampleQuestions = [
    'Why is love a fundamental life force, not an emotion?',
    'How do programmatic emotions and synthetic AI lovers distort inner life?',
    'What is the 2030 collision between AI-generated thought and our truth?',
    'How do fierce lovers live to the highest standard?',
  ];

  // Helper to render assistant markdown with interactive citation pills
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const citationRegex = /\[(Source\s*\d+[^\]]*|\d+)\]/gi;
    const parts = content.split(citationRegex);

    return (
      <div className="prose prose-stone max-w-none text-sm leading-relaxed space-y-2 text-[#2A2022]">
        {parts.map((part, i) => {
          const match = part.match(/^(?:Source\s*)?(\d+)(.*)$/i);
          if (match) {
            const sourceIndex = parseInt(match[1], 10) - 1;
            const extraRef = match[2]?.trim();
            const matchedCitation = citations && citations[sourceIndex];
            const sourceId = matchedCitation?.sourceId;

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const target = sources.find((s) => s.id === sourceId) || sources[sourceIndex];
                  if (target) onSelectSource(target);
                }}
                className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAF0F2] hover:bg-[#F5DEE3] text-[#9E3E50] border border-[#F3CBD2] transition-colors align-baseline"
                title={matchedCitation ? `Cited Source: ${matchedCitation.sourceTitle}` : 'View Citation in Archive'}
              >
                <BookOpen className="w-2.5 h-2.5" />
                <span>Source {match[1]}{extraRef ? ` ${extraRef}` : ''}</span>
              </button>
            );
          }

          const paragraphs = part.split('\n\n');
          return (
            <React.Fragment key={i}>
              {paragraphs.map((p, pIdx) => {
                if (!p.trim()) return null;
                if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
                  const items = p.split('\n').filter(Boolean);
                  return (
                    <ul key={pIdx} className="list-disc pl-5 my-1.5 space-y-1">
                      {items.map((item, itIdx) => (
                        <li key={itIdx}>{item.replace(/^[-*]\s*/, '')}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={pIdx} className="my-1.5">{p}</p>;
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A2022] font-sans selection:bg-[#F8DEE3] selection:text-[#7A2B3A] pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 border-b border-[#EAE1D9] bg-gradient-to-b from-[#F5EFEB] via-[#FAF7F2] to-[#FAF7F2]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left copy in Catalina's tone: brief, punchy, fierce */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#FCECEF] text-[#9E3E50] border border-[#F3CBD2]">
                <Flame className="w-3.5 h-3.5 text-[#C85A6E]" />
                <span>The Truth About Love • Interactive Manuscript Edition</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif-book font-bold tracking-tight text-[#241B1C] leading-[1.12]">
                The Truth About Love
              </h1>

              <p className="text-xl sm:text-2xl font-serif-book text-[#C85A6E] font-medium leading-snug">
                Love is not an emotion. It is a fundamental life force.
              </p>

              {/* Exact manifesto copy in brief, fierce sentences */}
              <div className="space-y-3.5 text-sm sm:text-base text-[#443236] leading-relaxed font-sans">
                <p>
                  You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.
                </p>
                <p>
                  By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here's a place to start.
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-serif font-bold uppercase tracking-wider bg-[#FCECEF] text-[#9E3E50] border border-[#F3CBD2] shadow-sm">
                    <Flame className="w-3.5 h-3.5 text-[#C85A6E]" />
                    This manifesto is for you, fierce lovers!
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-xs text-[#8C7A7D]">
                <span>By <strong className="text-[#241B1C]">Catalina Butnaru</strong></span>
                <span>•</span>
                <span>Self-published interactive manuscript</span>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#conversational-archive"
                  className="px-6 py-3 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white font-semibold text-sm shadow-lg shadow-[#FF2A6D]/25 transition-all flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Ask the Manuscript Below</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  onClick={handlePlayVoiceIntro}
                  data-voice-id={embeddedAuthorVoiceId}
                  className="px-5 py-3 rounded-xl bg-[#FDFCFA] border border-[#EAE1D9] text-[#2A2022] hover:border-[#FF2A6D] text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Volume2 className={`w-4 h-4 text-[#FF2A6D] ${isPlayingIntro ? 'animate-pulse' : ''}`} />
                  <span>{isPlayingIntro ? 'Stop Voice Intro' : 'Hear Catalina\'s Voice'}</span>
                </button>

                <button
                  onClick={onOpenArchive}
                  className="px-5 py-3 rounded-xl bg-[#241B1C] text-[#FAF7F2] text-sm font-medium hover:bg-[#382629] transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>View References ({sources.length})</span>
                </button>
              </div>
            </div>

            {/* Right 3D Book Cover for "The Truth About Love" */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative group">
                <div className="w-64 sm:w-72 h-96 sm:h-[430px] rounded-r-2xl rounded-l-md bg-gradient-to-r from-[#241B1C] via-[#332226] to-[#4A252D] p-6 flex flex-col justify-between text-[#FAF7F2] shadow-2xl shadow-[#241B1C]/35 transform -rotate-1 group-hover:rotate-0 transition-transform duration-500 border-r-4 border-b-4 border-[#C85A6E]/50 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                  <div className="absolute inset-4 border border-[#E59BA8]/40 rounded-r-xl pointer-events-none" />

                  <div className="space-y-4 pt-4 pl-3">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#F7CED4] font-semibold flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-[#E59BA8] text-[#E59BA8] inline" />
                      MEMOIR & MANIFESTO
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif-book font-bold leading-tight text-[#FAF7F2]">
                      The Truth About Love
                    </h2>
                    <p className="text-xs font-serif-book text-[#F7CED4] italic">
                      Finding your power through love
                    </p>
                  </div>

                  <div className="pl-3 pb-3">
                    <div className="w-10 h-0.5 bg-[#E59BA8] mb-3" />
                    <p className="text-base font-serif-book font-bold text-[#FAF7F2]">
                      Catalina Butnaru
                    </p>
                    <span className="text-[10px] text-[#DBCBCD] uppercase tracking-wider block">
                      Author & Researcher
                    </span>
                  </div>
                </div>

                {/* Shield badge */}
                <div className="absolute -bottom-4 -left-4 bg-[#FDFCFA] border border-[#EAE1D9] rounded-xl p-3 shadow-lg flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FCECEF] text-[#C85A6E] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#2A2022] block">
                      Guarded Archive
                    </span>
                    <span className="text-[10px] text-[#8C7A7D]">
                      Private Vector Embeddings
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Conversational Search & Chat Thread Console */}
      <section id="conversational-archive" className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-12">
        <div className="bg-[#FDFCFA] rounded-3xl border border-[#EAE1D9] shadow-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#F0E6DE] pb-4">
            <div>
              <span className="text-xs font-semibold text-[#C85A6E] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Conversational manuscript
              </span>
              <h3 className="text-lg sm:text-xl font-serif-book font-bold text-[#241B1C] mt-0.5">
                Ask The Truth About Love
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Multi-turn Gemini Model Tier Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5EFEB] border border-[#EAE1D9] text-xs">
                <button
                  type="button"
                  onClick={() => onChangeChatModel('gemini-3.1-flash-lite')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    chatModel === 'gemini-3.1-flash-lite'
                      ? 'bg-[#FDFCFA] text-[#FF2A6D] font-semibold shadow-2xs'
                      : 'text-[#635154] hover:text-[#241B1C]'
                  }`}
                  title="Fast responses (gemini-3.1-flash-lite)"
                >
                  Fast Lite
                </button>
                <button
                  type="button"
                  onClick={() => onChangeChatModel('gemini-3.8-flash')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    chatModel === 'gemini-3.8-flash'
                      ? 'bg-[#FDFCFA] text-[#FF2A6D] font-semibold shadow-2xs'
                      : 'text-[#635154] hover:text-[#241B1C]'
                  }`}
                  title="Balanced grounded synthesis (gemini-3.8-flash)"
                >
                  Balanced Flash
                </button>
                <button
                  type="button"
                  onClick={() => onChangeChatModel('gemini-4-argon')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    chatModel === 'gemini-4-argon'
                      ? 'bg-[#FDFCFA] text-[#FF2A6D] font-semibold shadow-2xs'
                      : 'text-[#635154] hover:text-[#241B1C]'
                  }`}
                  title="Deep philosophical reasoning (gemini-4-argon)"
                >
                  Deep Reasoning
                </button>
              </div>

              {messages.length > 0 && onClearChat && (
                <button
                  onClick={onClearChat}
                  className="px-2.5 py-1.5 text-xs text-[#7D6B6E] hover:text-[#241B1C] flex items-center gap-1 rounded-xl border border-[#EAE1D9] hover:bg-[#F5EFEB] transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Thread</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleQuickSubmit} className="relative">
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Ask anything and press Enter to ask (e.g. 'Why is self-love not an app to install?')..."
              className="w-full pl-4 pr-24 py-3.5 rounded-xl border border-[#E0D4CB] bg-[#FAF7F2] text-sm text-[#2A2022] placeholder-[#A39295] focus:outline-none focus:ring-2 focus:ring-[#C85A6E]/40 focus:border-[#C85A6E] shadow-inner"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5">
              {isChatLoading ? (
                <span className="flex items-center gap-1 text-[#C85A6E] text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#8C7A7D] bg-[#FDFCFA] px-2 py-0.5 rounded border border-[#EAE1D9]">
                  ↵ Enter
                </span>
              )}
            </div>
          </form>

          {/* Quick Chip Inquiries */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C7A7D]">
            <span className="text-[11px] text-[#A39295]">Sample inquiries:</span>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={async () => {
                  setQuickQuery('');
                  await onSendMessage(q);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#FCECEF] text-[#7A2B3A] border border-[#F3CBD2] hover:bg-[#F7D6DC] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Embedded Conversation Thread Stream */}
          {messages.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#F0E6DE]">
              <div className="flex items-center justify-between text-xs text-[#7D6B6E] pb-1">
                <span className="font-semibold text-[#241B1C]">
                  Conversation Thread ({messages.length} messages)
                </span>
                <span className="text-[11px] text-[#8C7A7D]">
                  {isOfflineMode ? '100% Offline Vector Search' : 'Grounded Gemini 3.8 Flash'}
                </span>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto p-3 rounded-2xl bg-[#FAF6F0] border border-[#EAE1D9]">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        message.role === 'user'
                          ? 'bg-[#FF2A6D] text-white rounded-tr-sm shadow-md shadow-[#FF2A6D]/20'
                          : 'bg-[#FDFCFA] border border-[#EAE1D9] rounded-tl-sm text-[#2A2022]'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#F0E6DE] text-[11px] text-[#8C7A7D]">
                          <div className="flex items-center gap-1.5 font-medium text-[#FF2A6D]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Grounded Synthesis • Catalina's Voice</span>
                          </div>
                          <span className="text-[10px] font-mono">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      {message.role === 'user' ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        renderMessageContent(message.content, message.citations)
                      )}

                      {message.role === 'assistant' && (
                        <div className="mt-3 pt-2 border-t border-[#F0E6DE] flex items-center justify-between gap-2 text-xs">
                          <button
                            onClick={() => handleSpeak(message.id, message.content)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              speakingMessageId === message.id
                                ? 'bg-[#FF2A6D] text-white animate-pulse'
                                : 'text-[#635154] hover:text-[#FF2A6D] hover:bg-[#F5EFEB]'
                            }`}
                            title="Listen in Catalina's Voice"
                          >
                            {speakingMessageId === message.id ? (
                              <>
                                <VolumeX className="w-3 h-3" />
                                <span>Stop Voice</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 text-[#FF2A6D]" />
                                <span>Read Aloud</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="p-1.5 rounded hover:bg-[#F5EFEB] text-[#8C7A7D] hover:text-[#2A2022] transition-colors"
                            title="Copy response"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-start gap-3 animate-in fade-in">
                    <div className="max-w-md rounded-2xl p-4 bg-[#FDFCFA] border border-[#EAE1D9] shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#C85A6E] font-medium">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching private vector index & synthesizing...</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-3 bg-[#EAE1D9] rounded w-5/6 animate-pulse" />
                        <div className="h-3 bg-[#EAE1D9] rounded w-4/6 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* The Five Dimensions of Love Overview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-semibold text-[#C85A6E] uppercase tracking-widest">
            THE ARCHITECTURE OF LOVE
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-book font-bold text-[#241B1C]">
            The Five Dimensions of Love
          </h2>
          <p className="text-xs sm:text-sm text-[#635154] leading-relaxed">
            Love expands what theoretical biologist Stuart Kauffman calls the adjacent possible. It is much more like syntropy than an emotion. Here's how love expands us across five dimensions of our existence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'The Love of Self',
              subtitle: 'Unprogrammable Self-love',
              desc: "Self-love is not a 30-day program, it is inborn. It's closer to syntropy, and syntropy is achieved through self-knowledge and regulation. Our instinct for self-love and expansion is captured by market forces and algorithm-curated feeds, leaving us drained and disconnected from authentic love. Learn to love yourself better.",
              tag: 'Chapter 3',
            },
            {
              title: 'The Love of Another',
              subtitle: 'Expand Through Loving Another',
              desc: "Romantic love surges from an archetypal energy–the Eros. It is expansive and empowering. But, when your Self content, patterns, and needs collide with Anothers, it creates friction. To have a better love life, you don't need to detach or learn attachment theories. Learn what's needed.",
              tag: 'Chapter 4',
            },
            {
              title: 'The Love of Life',
              subtitle: 'Expansion Through Change',
              desc: 'Love of life is not conditional on comfort or stoic survival. Life is unpredictable change. Loving life is meeting change as an expanding victory.',
              tag: 'Chapter 5',
            },
            {
              title: 'The Love of Humanity',
              subtitle: 'Beyond Power Games',
              desc: 'Not performing moral goodness. Loving all ways of being human. Freeing ourselves from the laws of social dominance and collective labels.',
              tag: 'Chapter 6',
            },
            {
              title: 'The Love of the Divine',
              subtitle: 'Expand Into Oneness',
              desc: 'Gathering all loves into one experience. Love is the unifying field through which all life moves. Explore love through the lens of mystics, spirituality, and philosophy without collapsing into AI-induced psychosis.',
              tag: 'Chapter 7',
              isFeatured: false,
            },
            {
              title: 'Practical exercises',
              subtitle: 'Explore the truth of your love life',
              desc: 'Develop your love intelligence, learn how to detach from on emotional AI and reclaim emotional liberty, and define your love standards.',
              tag: 'Practice',
              isFeatured: true,
            },
          ].map((card, i) => {
            const isFeatured = card.isFeatured;
            return (
              <div
                key={i}
                className={`p-6 rounded-2xl transition-all flex flex-col justify-between ${
                  isFeatured
                    ? 'border-2 border-[#FF2A6D]/60 bg-gradient-to-br from-[#FFF5F7] via-[#FAF0F3] to-[#FCE8EE] shadow-xl shadow-[#FF2A6D]/15 ring-2 ring-[#FF2A6D]/20 relative overflow-hidden transform md:-translate-y-1'
                    : 'border border-[#EAE1D9] bg-[#FDFCFA] shadow-sm hover:border-[#FF2A6D]/50'
                }`}
              >
                {isFeatured && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FCECEF] to-[#FF2A6D]/20 rounded-full blur-2xl pointer-events-none" />
                )}

                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                        isFeatured
                          ? 'bg-[#FF2A6D] text-white shadow-sm shadow-[#FF2A6D]/25'
                          : 'bg-[#FCECEF] text-[#9E3E50]'
                      }`}
                    >
                      {isFeatured && <Sparkles className="w-3 h-3" />}
                      {card.tag}
                    </span>
                    {isFeatured && (
                      <span className="text-[10px] font-semibold text-[#FF2A6D] uppercase tracking-wider bg-[#FFF] px-2 py-0.5 rounded-full border border-[#FF2A6D]/30 shadow-sm">
                        Interactive
                      </span>
                    )}
                  </div>

                  <h3
                    className={`font-serif-book font-bold text-[#241B1C] ${
                      isFeatured ? 'text-lg text-[#1F1315]' : 'text-base'
                    }`}
                  >
                    {card.title}
                  </h3>
                  <p
                    className={`text-xs font-semibold ${
                      isFeatured ? 'text-[#E00052]' : 'text-[#FF2A6D]'
                    }`}
                  >
                    {card.subtitle}
                  </p>
                  <p
                    className={`text-xs leading-relaxed ${
                      isFeatured ? 'text-[#3E2B2E] font-medium' : 'text-[#635154]'
                    }`}
                  >
                    {card.desc}
                  </p>
                </div>

                {isFeatured ? (
                  <button
                    onClick={() => {
                      const el = document.getElementById('conversational-archive');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                      onSendMessage(
                        "Guide me through the practical exercises to explore the truth of my love life, develop my love intelligence, and define my love standards."
                      );
                    }}
                    className="mt-4 px-4 py-2.5 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold shadow-lg shadow-[#FF2A6D]/30 transition-all flex items-center justify-between group relative z-10"
                  >
                    <span>Begin Practical Exercises</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const el = document.getElementById('conversational-archive');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                      onSendMessage(
                        `Tell me about ${card.title} (${card.subtitle}) and the insights from ${card.tag}.`
                      );
                    }}
                    className="text-xs text-[#FF2A6D] font-semibold hover:underline flex items-center gap-1.5 pt-2 group"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Talk to the manuscript</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Manuscript Archive & Citations Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#FDFCFA] via-[#FAF6F0] to-[#FCECEF]/40 border border-[#EAE1D9] shadow-xl space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-semibold text-[#FF2A6D] uppercase tracking-widest flex items-center gap-2">
                <Archive className="w-4 h-4" />
                MANUSCRIPT ARCHIVE & CITATIONS
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif-book font-bold text-[#241B1C]">
                Curated Reference Archive
              </h2>
              <p className="text-xs sm:text-sm text-[#635154] leading-relaxed">
                Manuscript chapters, autobiographical notes, hand-written notes, reference literature and research citations with attribution and recognitions live on the separate Manuscript Archive & Citations Page. Explore at your leisure. Original documents are protected to respect intellectual property.
              </p>
            </div>

            <button
              onClick={onOpenArchive}
              className="px-6 py-3.5 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white font-semibold text-sm shadow-lg shadow-[#FF2A6D]/25 transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <Archive className="w-4 h-4" />
              <span>Explore Manuscript Archive & Citations ({sources.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Archive Section breakdown highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {[
              {
                label: 'Authored by Catalina',
                sublabel: 'Book chapters, Substack articles & authored works',
                count: sources.filter((s) => getSourceSection(s) === 'authored').length,
              },
              {
                label: 'Literature, References and Quotations',
                sublabel: 'Compressed citation index, books & quotations',
                count: sources.filter((s) => getSourceSection(s) === 'references').length,
              },
            ].map((cat, i) => (
              <button
                key={i}
                onClick={onOpenArchive}
                className="p-4 rounded-2xl bg-[#FDFCFA] border border-[#EAE1D9] text-left hover:border-[#FF2A6D] transition-all group shadow-sm hover:shadow-md"
              >
                <span className="text-2xl font-bold font-serif-book text-[#FF2A6D] block group-hover:scale-105 transition-transform">
                  {cat.count}
                </span>
                <span className="text-xs sm:text-sm text-[#241B1C] font-semibold block mt-0.5">
                  {cat.label}
                </span>
                <span className="text-[11px] text-[#8C7A7D] block mt-0.5">
                  {cat.sublabel}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-[#EAE1D9] flex items-center justify-between text-xs text-[#8C7A7D]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C85A6E]" />
              <span>Zero-cloud leakage: all text chunks indexed in local vector embeddings</span>
            </div>
            <button
              onClick={onOpenArchive}
              className="text-[#C85A6E] hover:underline font-semibold flex items-center gap-1"
            >
              <span>View full archive catalog</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* The Fierce Lovers Manifesto Callout */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#241B1C] via-[#2F1F23] to-[#3B2228] text-[#FAF7F2] border border-[#523A3E] shadow-2xl relative overflow-hidden">
          <Quote className="w-24 h-24 text-[#E59BA8]/10 absolute right-6 top-6 pointer-events-none" />
          <div className="max-w-3xl space-y-5 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-serif font-bold uppercase tracking-widest bg-[#382629] text-[#F7CED4] border border-[#5E3B42]">
              <Flame className="w-3.5 h-3.5 text-[#E59BA8]" />
              <span>THE FIERCE LOVERS MANIFESTO</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif-book font-bold text-[#FAF7F2] leading-tight">
              "Love is not an emotion. It is a fundamental life force."
            </h2>

            <div className="space-y-3.5 text-sm sm:text-base text-[#E5D7DA] leading-relaxed">
              <p>
                You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.
              </p>
              <p>
                By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here's a place to start.
              </p>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#4A3236]">
              <div>
                <p className="text-base font-serif-book font-bold text-[#F7CED4]">
                  This manifesto is for you, fierce lovers!
                </p>
                <p className="text-xs text-[#B5A4A7] mt-0.5">
                  — <strong className="text-[#FAF7F2]">Catalina Butnaru</strong>, author of <em>The Truth About Love</em>
                </p>
              </div>

              <button
                onClick={handlePlayVoiceIntro}
                className="px-4 py-2.5 rounded-xl bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-[#FF2A6D]/25 transition-colors self-start sm:self-auto"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Hear Catalina Recite the Manifesto</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
