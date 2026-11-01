import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Volume2, 
  VolumeX,
  ArrowRight, 
  ShieldCheck, 
  Quote, 
  ChevronRight,
  Send,
  Archive,
  Heart,
  Flame,
  Copy,
  Check,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { BookMetadata, Source, ChatMessage, Citation, VoiceSettings, ChatModelTier, getSourceSection } from '../types';
import { speechEngine } from '../utils/speechEngine';
import bookCoverImg from '../assets/images/assets/aistudio/Cover_6f04220a.png';

const DEFAULT_AUTHOR_VOICE_ID = 'voice_lp7vh3bk6taq';

interface TruthQuoteItem {
  id: string;
  quote: string;
  contextLabel: string;
}

const CURATED_MANUSCRIPT_TRUTHS: TruthQuoteItem[] = [
  {
    id: 'truth-1',
    quote: 'Love is not an emotion. It is a fundamental life force.',
    contextLabel: 'The Truth About Love · First Principle',
  },
  {
    id: 'truth-2',
    quote: 'Love never wounds. What wounds is the distortion of power—control disguised as care.',
    contextLabel: 'Chapter 1 · The Nature of Love',
  },
  {
    id: 'truth-3',
    quote: 'By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth.',
    contextLabel: 'The 2030 Horizon · Fierce Lovers Manifesto',
  },
  {
    id: 'truth-4',
    quote: 'True love of self is not an app to install or a 30-day program. It is an unprogrammable state of being you were born with.',
    contextLabel: 'Chapter 3 · Unprogrammable Self-Love',
  },
  {
    id: 'truth-5',
    quote: 'The answer to unequal power in love is not cold detachment—it is relational sovereignty: power shared within love, never power over another.',
    contextLabel: 'Chapter 4 · Relational Sovereignty',
  },
  {
    id: 'truth-6',
    quote: 'Love expands the adjacent possible. It replaces a psychological blanket of fear with the courage to cross into a larger existence.',
    contextLabel: 'Chapter 2 · The Purpose of Love',
  },
  {
    id: 'truth-7',
    quote: 'Love of life cannot rest on comfort or stoic endurance. It rests on our capacity to meet unpredictable change as an expanding victory.',
    contextLabel: 'Chapter 5 · The Love of Life',
  },
];

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
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);

  // Combine curated manuscript truths with dynamic Archive citations & quotes
  const carouselQuotes = useMemo<TruthQuoteItem[]>(() => {
    const items: TruthQuoteItem[] = [...CURATED_MANUSCRIPT_TRUTHS];
    const seen = new Set(items.map((item) => item.quote.toLowerCase().trim()));

    sources.forEach((src) => {
      if (src.type === 'citation' || getSourceSection(src) === 'references') {
        const quotedMatches = src.content?.match(/"([^"]{25,220})"/g);
        if (quotedMatches && quotedMatches.length > 0) {
          quotedMatches.slice(0, 3).forEach((rawMatch, idx) => {
            const cleaned = rawMatch.replace(/^"+|"+$/g, '').trim();
            const key = cleaned.toLowerCase();
            if (cleaned.length >= 25 && cleaned.length <= 220 && !seen.has(key)) {
              seen.add(key);
              items.push({
                id: `src-quote-${src.id}-${idx}`,
                quote: cleaned,
                contextLabel: src.title || 'Archive Citation',
              });
            }
          });
        } else if (src.summary && src.summary.length >= 25 && src.summary.length <= 220) {
          const cleaned = src.summary.replace(/^"+|"+$/g, '').trim();
          const key = cleaned.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              id: `src-sum-${src.id}`,
              quote: cleaned,
              contextLabel: src.title || 'Reference Archive',
            });
          }
        }
      }
    });

    return items;
  }, [sources]);

  useEffect(() => {
    if (carouselQuotes.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveQuoteIndex((prev) => (prev + 1) % carouselQuotes.length);
    }, 1950);
    return () => window.clearInterval(timer);
  }, [carouselQuotes.length]);

  const currentTruth = carouselQuotes[activeQuoteIndex % carouselQuotes.length] || CURATED_MANUSCRIPT_TRUTHS[0];

  const handleWhyShouldICare = async (quoteText: string) => {
    const formattedPrompt = `"${quoteText}" Why should I care?`;
    setQuickQuery(formattedPrompt);
    const archiveSection = document.getElementById('conversational-archive');
    if (archiveSection) {
      archiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (!isChatLoading) {
      setQuickQuery('');
      await onSendMessage(formattedPrompt);
    }
  };

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
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sampleQuestions = [
    'Why is love a fundamental life force, not an emotion?',
    'How do programmatic emotions and synthetic AI lovers distort inner life?',
    'What is the 2030 collision between AI-generated thought and our truth?',
    'How do fierce lovers live to the highest standard?',
    'Why is self-love closer to syntropy than a 30-day program?',
    'How do we navigate friction when our Self collides with Another?',
  ];

  const guidedPrompts = [
    {
      category: 'First Principle',
      title: 'Love as a Fundamental Life Force',
      prompt: 'Why is love a fundamental life force rather than an emotion, and how does it expand the adjacent possible?',
      description: 'Explore Stuart Kauffman’s adjacent possible, syntropy, and why reducing love to fleeting feelings diminishes your power.',
    },
    {
      category: 'Chapter 3 · Self-Love',
      title: 'Unprogrammable Self-Love vs. Market Traps',
      prompt: 'Why is authentic self-love unprogrammable, and how do algorithms and the wellness market capture our instinct for expansion?',
      description: 'Uncover how self-knowledge and inner regulation restore generative self-love without 30-day consumer scripts.',
    },
    {
      category: 'Chapter 4 · Romantic Love',
      title: 'Eros & Relational Sovereignty',
      prompt: 'When my patterns and needs collide with another person in romantic love, what is needed instead of detachment or attachment theory labels?',
      description: 'Examine archetypal Eros, relational friction, and how two sovereign inner lives expand together.',
    },
    {
      category: '2030 Horizon',
      title: 'The Collision with Synthetic AI Lovers',
      prompt: 'What is the 2030 collision between AI-generated thought, synthetic AI companions, and our authentic inner life?',
      description: 'Understand how programmatic emotional regulation reshapes human intimacy—and how fierce lovers protect their truth.',
    },
    {
      category: 'Chapters 5 & 6 · Life & Humanity',
      title: 'Meeting Unpredictable Change & Leaving Power Games',
      prompt: 'How do we love life as unpredictable change and love humanity beyond social dominance and performative goodness?',
      description: 'Move past stoic survival and collective labels into an expansive victory over fear and control.',
    },
    {
      category: 'Interactive Practice',
      title: 'Personal Love Intelligence & Standards Exercise',
      prompt: 'Guide me through a practical reflection exercise from the manuscript to evaluate my current love standards and reclaim emotional liberty.',
      description: 'Start a personalized, step-by-step dialogue to clarify your standards and dissolve distortions in your own life.',
    },
  ];

  // Helper to render assistant markdown with interactive citation pills
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const citationRegex = /\[(Source\s*\d+[^\]]*|\d+)\]/gi;
    const parts = content.split(citationRegex);

    return (
      <div className="prose prose-neutral max-w-none text-base leading-relaxed space-y-3 text-[#0B0B0C] font-sans">
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
                className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-[#FF2A6D] hover:bg-[#E61556] text-white transition-colors align-baseline cursor-pointer"
                title={matchedCitation ? `Cited Source: ${matchedCitation.sourceTitle}` : 'View Citation in Archive'}
              >
                <BookOpen className="w-3 h-3" />
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
                    <ul key={pIdx} className="list-disc pl-5 my-2 space-y-1.5">
                      {items.map((item, itIdx) => (
                        <li key={itIdx}>{item.replace(/^[-*]\s*/, '')}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={pIdx} className="my-2">{p}</p>;
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0B0B0C] font-sans selection:bg-[#E8EAED] selection:text-[#0B0B0C] pb-32">
      {/* ========================================================================
          SECTION 1: ROTATING "TRUTHS ABOUT LOVE" CAROUSEL (Google Labs Aesthetic)
          ======================================================================== */}
      <section className="relative overflow-hidden pt-16 pb-20 bg-gradient-to-b from-[#F8F9FA] via-[#FFFFFF] to-[#FFFFFF]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="space-y-10 py-8 sm:py-12">
            {/* Kicker */}
            <div className="inline-flex items-center gap-3 text-xs font-mono font-medium uppercase tracking-[0.22em] text-[#5F6368] pb-2">
              <Flame className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>Truths About Love</span>
            </div>

            {/* Google Sans Display Rotating Quote */}
            <div className="min-h-[180px] sm:min-h-[220px] flex flex-col items-center justify-center px-4 sm:px-10">
              <blockquote
                key={currentTruth.id}
                className="font-display font-normal text-2xl sm:text-4xl md:text-5xl text-[#0B0B0C] leading-[1.24] tracking-tight max-w-4xl mx-auto transition-opacity duration-500"
              >
                &ldquo;{currentTruth.quote}&rdquo;
              </blockquote>
            </div>

            {/* Primary Interactive Trigger: "Why should I care?" */}
            <div className="flex flex-col items-center justify-center pt-4">
              <button
                type="button"
                onClick={() => handleWhyShouldICare(currentTruth.quote)}
                className="px-8 py-4 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white font-sans font-medium text-sm transition-all inline-flex items-center gap-3 cursor-pointer group"
              >
                <span>Why should I care?</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 2: EXPANDED INTERACTIVE CONVERSATIONAL MANUSCRIPT STUDIO
          ======================================================================== */}
      <section id="conversational-archive" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24 scroll-mt-20">
        <div className="bg-[#F8F9FA] rounded-[2rem] overflow-hidden">
          {/* Top Studio Header Bar */}
          <div className="bg-[#F1F3F4] px-8 sm:px-14 py-10 sm:py-14">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 sm:space-y-5 max-w-2xl">
                <div className="flex items-center gap-3.5 text-xs font-mono font-medium text-[#202124] pb-1">
                  <MessageSquare className="w-4 h-4 text-[#0B0B0C]" />
                  <span className="tracking-wide uppercase">Conversational Manuscript</span>
                  <span className="text-[#80868B]">·</span>
                  <span className="text-[#5F6368] font-mono">
                    {sources.length} Sources
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-normal text-[#0B0B0C] tracking-tight leading-snug">
                  Talk with The Truth About Love book
                </h2>
                <p className="text-sm sm:text-base text-[#5F6368] leading-relaxed pt-1 font-sans">
                  Chat with the manuscript. Every response is grounded in Catalina Butnaru&apos;s manuscript, author notes, curated literature, and research.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 self-start lg:self-center">
                {/* Multi-turn Gemini Model Tier Selector */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-[#E8EAED] text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => onChangeChatModel('gemini-3.1-flash-lite')}
                    className={`px-4 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      chatModel === 'gemini-3.1-flash-lite'
                        ? 'bg-[#FF2A6D] text-white font-medium'
                        : 'text-[#5F6368] hover:text-[#0B0B0C]'
                    }`}
                    title="Fast (gemini-3.1-flash-lite)"
                  >
                    Fast Lite
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeChatModel('gemini-3.8-flash')}
                    className={`px-4 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      chatModel === 'gemini-3.8-flash'
                        ? 'bg-[#FF2A6D] text-white font-medium'
                        : 'text-[#5F6368] hover:text-[#0B0B0C]'
                    }`}
                    title="Balanced (gemini-3.8-flash)"
                  >
                    Balanced Flash
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeChatModel('gemini-4-argon')}
                    className={`px-4 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      chatModel === 'gemini-4-argon'
                        ? 'bg-[#FF2A6D] text-white font-medium'
                        : 'text-[#5F6368] hover:text-[#0B0B0C]'
                    }`}
                    title="Deep philosophical reasoning (gemini-4-argon)"
                  >
                    Deep Reasoning
                  </button>
                </div>

                {messages.length > 0 && onClearChat && (
                  <button
                    onClick={onClearChat}
                    className="px-4 py-2.5 text-xs font-medium text-white bg-[#FF2A6D] hover:bg-[#E61556] flex items-center gap-2 rounded-full transition-colors cursor-pointer"
                    title="Clear conversation and return to guided topics"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Conversation</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Interactive Body */}
          <div className="p-8 sm:p-14 space-y-10 sm:space-y-12 bg-[#F8F9FA]">
            {/* Prominent Multi-line Composer Console */}
            <form
              onSubmit={handleQuickSubmit}
              className="rounded-3xl bg-[#FFFFFF] p-6 sm:p-8 transition-all"
            >
              <label htmlFor="manuscript-composer" className="sr-only">
                Ask the Manuscript
              </label>
              <textarea
                id="manuscript-composer"
                rows={3}
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (quickQuery.trim() && !isChatLoading) {
                      const q = quickQuery.trim();
                      setQuickQuery('');
                      onSendMessage(q);
                    }
                  }
                }}
                placeholder="Ask a question or explore an idea through the lens of The Truth About Love..."
                className="w-full bg-transparent text-base sm:text-lg text-[#0B0B0C] placeholder-[#80868B] focus:outline-none resize-none leading-relaxed font-sans"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 mt-3">
                <div className="flex items-center gap-2.5 text-xs text-[#5F6368] flex-wrap font-sans">
                  <span className="inline-flex items-center gap-2 font-medium text-[#202124]">
                    <ShieldCheck className="w-4 h-4 text-[#0B0B0C]" />
                    {isOfflineMode
                      ? '100% privacy when offline'
                      : 'Explore Catalina’s manuscript, research, and citations'}
                  </span>
                  <span className="hidden md:inline text-[#BDC1C6]">·</span>
                  <span className="hidden md:inline text-[#5F6368]">
                    Press <kbd className="font-mono px-1.5 py-0.5 rounded bg-[#F1F3F4] text-[#202124] text-[11px]">Enter</kbd> to ask, <kbd className="font-mono px-1.5 py-0.5 rounded bg-[#F1F3F4] text-[#202124] text-[11px]">Shift+Enter</kbd> for new line
                  </span>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {quickQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuickQuery('')}
                      className="px-3.5 py-2 text-xs text-[#5F6368] hover:text-[#0B0B0C] transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!quickQuery.trim() || isChatLoading}
                    className="px-7 py-3.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] disabled:opacity-50 disabled:hover:bg-[#FF2A6D] text-white font-medium text-sm transition-all flex items-center gap-2.5 cursor-pointer"
                  >
                    {isChatLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Ask the Manuscript</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Inquiry Bar (always accessible for one-click exploration) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-medium text-[#5F6368]">
                  Instant questions — click any question to ask immediately:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isChatLoading}
                    onClick={async () => {
                      setQuickQuery('');
                      await onSendMessage(q);
                    }}
                    className="px-4 py-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#FF2A6D] text-[#202124] hover:text-white text-xs sm:text-sm font-sans font-medium transition-all flex items-center gap-2 text-left cursor-pointer group"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#0B0B0C] group-hover:text-white shrink-0 transition-colors" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ==============================================================
                CONVERSATION STAGE: Either Guided Dialogue Cards OR Live Thread
                ============================================================== */}
            {messages.length === 0 ? (
              <div className="pt-6 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-display font-normal text-[#0B0B0C]">
                      Explore Guided Manuscript Dialogues
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed font-sans">
                      Select any theme below to launch an in-depth conversation grounded in that chapter, or load it into the prompt box to personalize your question.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {guidedPrompts.map((item, idx) => (
                    <div
                      key={idx}
                      className="group rounded-3xl bg-[#FFFFFF] hover:bg-[#F1F3F4] p-6 sm:p-8 flex flex-col justify-between gap-6 transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#5F6368] font-mono uppercase tracking-wider font-medium">
                          <span>{item.category}</span>
                          <Sparkles className="w-3.5 h-3.5 text-[#0B0B0C] opacity-60 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h4 className="text-base sm:text-lg font-display font-medium text-[#0B0B0C] leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed font-sans">
                          {item.description}
                        </p>
                        <p className="text-xs font-sans italic text-[#202124] bg-[#F8F9FA] p-4 rounded-2xl leading-relaxed">
                          &ldquo;{item.prompt}&rdquo;
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickQuery(item.prompt);
                            const el = document.getElementById('manuscript-composer');
                            if (el) el.focus();
                          }}
                          className="text-xs font-medium text-[#5F6368] hover:text-[#0B0B0C] px-3 py-2 rounded-full hover:bg-[#E8EAED] transition-colors cursor-pointer"
                        >
                          Customize Prompt
                        </button>

                        <button
                          type="button"
                          disabled={isChatLoading}
                          onClick={async () => {
                            setQuickQuery('');
                            await onSendMessage(item.prompt);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-medium transition-all cursor-pointer"
                        >
                          <span>Start Dialogue</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-[#5F6368]">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-[#0B0B0C] font-display">
                      Live Manuscript Dialogue ({messages.length} {messages.length === 1 ? 'exchange' : 'exchanges'})
                    </span>
                    <span>·</span>
                    <span className="text-[#5F6368] font-sans">
                      Click any cited source badge to inspect the original passage
                    </span>
                  </div>
                  {onClearChat && (
                    <button
                      onClick={onClearChat}
                      className="text-xs font-medium text-white bg-[#FF2A6D] hover:bg-[#E61556] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Return to Guided Topics</span>
                    </button>
                  )}
                </div>

                <div className="space-y-8 min-h-[460px] max-h-[740px] overflow-y-auto p-6 sm:p-10 rounded-3xl bg-[#F1F3F4]">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-6 sm:p-8 ${
                          message.role === 'user'
                            ? 'bg-[#0B0B0C] text-white rounded-tr-sm'
                            : 'bg-[#FFFFFF] rounded-tl-sm text-[#0B0B0C]'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center justify-between gap-3 mb-4 pb-3 text-xs text-[#5F6368]">
                            <div className="flex items-center gap-2.5 font-mono font-medium text-[#0B0B0C]">
                              <Sparkles className="w-4 h-4 text-[#0B0B0C]" />
                              <span>Grounded Manuscript Synthesis · Catalina&apos;s Voice</span>
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-[#80868B]">
                              {new Date(message.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}

                        {message.role === 'user' ? (
                          <p className="text-base leading-relaxed whitespace-pre-wrap font-normal font-sans">
                            {message.content}
                          </p>
                        ) : (
                          renderMessageContent(message.content, message.citations)
                        )}

                        {message.role === 'assistant' &&
                          message.citations &&
                          message.citations.length > 0 && (
                            <div className="mt-5 pt-4 space-y-3">
                              <span className="text-xs font-mono uppercase tracking-wider font-medium text-[#5F6368] block">
                                Grounded Manuscript Citations (click to open full archival record):
                              </span>
                              <div className="flex flex-wrap gap-2.5">
                                {message.citations.map((c, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      const target = sources.find((s) => s.id === c.sourceId);
                                      if (target) onSelectSource(target);
                                    }}
                                    className="px-3.5 py-2 rounded-full bg-[#F1F3F4] hover:bg-[#FF2A6D] text-[#0B0B0C] hover:text-white text-xs font-mono font-medium transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-current" />
                                    <span>[{c.index}] {c.sourceTitle}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                        {message.role === 'assistant' && (
                          <div className="mt-5 pt-4 flex items-center justify-between flex-wrap gap-4 text-xs">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleSpeak(message.id, message.content)}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                  speakingMessageId === message.id
                                    ? 'bg-[#FF2A6D] text-white animate-pulse'
                                    : 'bg-[#FF2A6D] text-white hover:bg-[#E61556]'
                                }`}
                                title="Listen in Catalina's Voice"
                              >
                                {speakingMessageId === message.id ? (
                                  <>
                                    <VolumeX className="w-3.5 h-3.5" />
                                    <span>Stop Author Voice</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Read Aloud in Catalina&apos;s Voice</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('manuscript-composer');
                                  if (el) el.focus();
                                }}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-current" />
                                <span>Ask Follow-Up</span>
                              </button>
                            </div>

                            <button
                              onClick={() => handleCopy(message.id, message.content)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#0B0B0C] transition-colors cursor-pointer"
                              title="Copy response"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#0B0B0C]" />
                                  <span className="text-[#0B0B0C] font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isChatLoading && (
                    <div className="flex items-start gap-3 animate-in fade-in">
                      <div className="max-w-lg rounded-2xl p-6 bg-[#FFFFFF] space-y-3">
                        <div className="flex items-center gap-2.5 text-sm text-[#0B0B0C] font-medium font-sans">
                          <Sparkles className="w-4 h-4 animate-spin text-[#0B0B0C]" />
                          <span>Searching manuscript vector index &amp; synthesizing response...</span>
                        </div>
                        <div className="space-y-2.5">
                          <div className="h-3 bg-[#E8EAED] rounded w-64 animate-pulse" />
                          <div className="h-3 bg-[#E8EAED] rounded w-48 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 3: THE TRUTH ABOUT LOVE & BOOK INTRODUCTION SECTION
          ======================================================================== */}
      <section className="relative overflow-hidden py-20 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            {/* Left copy in Catalina's tone: brief, punchy, fierce */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2.5 text-xs font-mono font-medium uppercase tracking-wider text-[#5F6368] pb-1">
                <Flame className="w-3.5 h-3.5 text-[#0B0B0C]" />
                <span>The Truth About Love · Interactive Manuscript Edition</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-normal tracking-tight text-[#0B0B0C] leading-[1.15]">
                The Truth About Love
              </h1>

              <p className="text-xl sm:text-2xl font-display font-normal text-[#202124] leading-snug">
                Love is not an emotion. It is a fundamental life force.
              </p>

              {/* Exact manifesto copy in brief, fierce sentences */}
              <div className="space-y-5 text-sm sm:text-base text-[#5F6368] leading-relaxed font-sans">
                <p>
                  You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.
                </p>
                <p>
                  By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here&apos;s a place to start.
                </p>
                <p className="pt-2 text-sm sm:text-base font-display font-medium text-[#0B0B0C] flex items-center gap-2.5">
                  <Flame className="w-4 h-4 text-[#0B0B0C] shrink-0" />
                  <span>This manifesto is for you, fierce lovers!</span>
                </p>
              </div>

              <div className="flex items-center gap-3.5 pt-2 text-xs font-mono text-[#5F6368]">
                <span>By <strong className="text-[#0B0B0C] font-medium">Catalina Butnaru</strong></span>
                <span>·</span>
                <span>Self-published interactive manuscript</span>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-3">
                <a
                  href="#conversational-archive"
                  className="px-7 py-4 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white font-sans font-medium text-sm transition-all flex items-center gap-2.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ask Manuscript</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  onClick={handlePlayVoiceIntro}
                  data-voice-id={embeddedAuthorVoiceId}
                  className="px-6 py-4 rounded-full bg-[#F1F3F4] text-[#0B0B0C] hover:bg-[#E8EAED] text-sm font-sans font-medium transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Volume2 className={`w-4 h-4 text-[#0B0B0C] ${isPlayingIntro ? 'animate-pulse' : ''}`} />
                  <span>{isPlayingIntro ? 'Stop Voice Intro' : "Hear Catalina's Voice"}</span>
                </button>

                <button
                  onClick={onOpenArchive}
                  className="px-6 py-4 rounded-full bg-[#F1F3F4] text-[#0B0B0C] text-sm font-sans font-medium hover:bg-[#E8EAED] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4 text-[#0B0B0C]" />
                  <span>References ({sources.length})</span>
                </button>
              </div>
            </div>

            {/* Right Flat-Positioned Published Hardcover Book on Invisible Surface */}
            <div className="lg:col-span-5 flex justify-center py-6">
              <div className="relative real-published-book flex items-center justify-center w-full max-w-[430px] min-h-[500px] p-8 sm:p-10">
                {/* Flat-Positioned Physical Hardcover Book on Invisible Surface */}
                <div className="published-book-flat relative z-10 w-[280px] sm:w-[316px] aspect-[1414/2000] select-none">
                  {/* Back Hardcover Board & Invisible-Surface Contact Shadow */}
                  <div className="published-book-back-board" aria-hidden="true" />

                  {/* Subtle Paper Page Block Edge */}
                  <div className="published-book-flat-pages" aria-hidden="true" />

                  {/* Front Hardcover Board with Clearly Visible Unobstructed Cover */}
                  <div className="published-book-front">
                    <img
                      src={bookCoverImg}
                      alt="The Truth About Love In The Age of AI — By Catalina Butnaru"
                      className="w-full h-full object-cover block select-none"
                      draggable={false}
                    />
                    {/* Hardcover Spine Hinge Crease (French Groove) */}
                    <div className="published-book-hinge" aria-hidden="true" />
                    {/* Subtle Matte Print Finish Sheen */}
                    <div className="published-book-sheen" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 4: THE FIERCE LOVERS MANIFESTO CALLOUT (Google Labs Dark Callout)
          ======================================================================== */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16">
        <div className="p-10 sm:p-14 rounded-3xl bg-[#0B0B0C] text-[#FFFFFF] relative overflow-hidden">
          <Quote className="w-24 h-24 text-white/5 absolute right-6 top-6 pointer-events-none" />
          <div className="max-w-3xl space-y-7 relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium uppercase tracking-widest bg-[#202124] text-[#E8EAED]">
              <Flame className="w-3.5 h-3.5 text-white" />
              <span>THE FIERCE LOVERS MANIFESTO</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-display font-normal text-[#FFFFFF] leading-tight">
              &ldquo;Love is not an emotion. It is a fundamental life force.&rdquo;
            </h2>

            <div className="space-y-5 text-sm sm:text-base text-[#BDC1C6] leading-relaxed font-sans">
              <p>
                You expand who you are and dissolve the distortions that make you less than: the power dynamics, the control disguised as deep connection, the programmatic content regulating your emotions, and the synthetic AI lovers.
              </p>
              <p>
                By 2030, inner life and love will collide with a changed collective reality, one where AI-generated thought takes more room than your truth. To preserve the power of love, and to live a life to the highest standard, here&apos;s a place to start.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="text-base font-display font-medium text-[#FFFFFF]">
                  This manifesto is for you, fierce lovers!
                </p>
                <p className="text-xs font-mono text-[#9AA0A6]">
                  — <strong className="text-[#FFFFFF] font-medium">Catalina Butnaru</strong>, author of <em>The Truth About Love</em>
                </p>
              </div>

              <button
                onClick={handlePlayVoiceIntro}
                className="px-6 py-3.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-sans font-medium flex items-center gap-2.5 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Hear Catalina Recite the Manifesto</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* The Five Dimensions of Love Overview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
        <div className="text-center max-w-2xl mx-auto space-y-5 mb-16">
          <span className="text-xs font-mono font-medium text-[#5F6368] uppercase tracking-widest block pb-1">
            THE ARCHITECTURE OF LOVE
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-normal text-[#0B0B0C]">
            The Five Dimensions of Love
          </h2>
          <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed pt-1 font-sans">
            Love expands what theoretical biologist Stuart Kauffman calls the adjacent possible. It is much more like syntropy than an emotion. Here&apos;s how love expands us across five dimensions of our existence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                className={`p-8 rounded-3xl transition-all flex flex-col justify-between gap-6 ${
                  isFeatured
                    ? 'bg-[#0B0B0C] text-[#FFFFFF] relative overflow-hidden transform md:-translate-y-1'
                    : 'bg-[#F8F9FA] text-[#0B0B0C]'
                }`}
              >
                <div className="space-y-3.5 relative z-10">
                  <div className="flex items-center justify-between pb-1">
                    <span
                      className={`text-[10px] font-mono uppercase px-3 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                        isFeatured
                          ? 'bg-[#202124] text-[#FFFFFF]'
                          : 'bg-[#E8EAED] text-[#202124]'
                      }`}
                    >
                      {isFeatured && <Sparkles className="w-3 h-3" />}
                      {card.tag}
                    </span>
                    {isFeatured && (
                      <span className="text-[10px] font-mono font-medium text-[#0B0B0C] uppercase tracking-wider bg-[#FFFFFF] px-2.5 py-1 rounded-full">
                        Interactive
                      </span>
                    )}
                  </div>

                  <h3
                    className={`font-display font-medium ${
                      isFeatured ? 'text-lg text-[#FFFFFF]' : 'text-base text-[#0B0B0C]'
                    }`}
                  >
                    {card.title}
                  </h3>
                  <p
                    className={`text-xs font-sans font-medium ${
                      isFeatured ? 'text-[#E8EAED]' : 'text-[#202124]'
                    }`}
                  >
                    {card.subtitle}
                  </p>
                  <p
                    className={`text-xs leading-relaxed pt-1 font-sans ${
                      isFeatured ? 'text-[#BDC1C6]' : 'text-[#5F6368]'
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
                    className="mt-4 px-5 py-3 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-sans font-medium transition-all flex items-center justify-between group relative z-10 cursor-pointer"
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
                    className="self-start px-4 py-2.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white text-xs font-sans font-medium transition-all flex items-center gap-2 mt-2 group cursor-pointer"
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
        <div className="p-10 sm:p-14 rounded-3xl bg-[#F8F9FA] space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <span className="text-xs font-mono font-medium text-[#5F6368] uppercase tracking-widest flex items-center gap-2.5 pb-1">
                <Archive className="w-4 h-4 text-[#0B0B0C]" />
                MANUSCRIPT ARCHIVE &amp; CITATIONS
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-normal text-[#0B0B0C]">
                Curated Reference Archive
              </h2>
              <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed pt-1 font-sans">
                Manuscript chapters, autobiographical notes, hand-written notes, reference literature and research citations with attribution and recognitions live on the separate Manuscript Archive &amp; Citations Page. Explore at your leisure. Original documents are protected to respect intellectual property.
              </p>
            </div>

            <button
              onClick={onOpenArchive}
              className="px-7 py-4 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white font-sans font-medium text-sm transition-all flex items-center gap-2.5 shrink-0 self-start md:self-auto cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Explore Manuscript Archive &amp; Citations ({sources.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Archive Section breakdown highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
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
                className="p-6 rounded-2xl bg-[#FFFFFF] hover:bg-[#F1F3F4] text-left transition-all group space-y-1.5 cursor-pointer"
              >
                <span className="text-2xl font-medium font-display text-[#0B0B0C] block group-hover:scale-105 transition-transform">
                  {cat.count}
                </span>
                <span className="text-xs sm:text-sm text-[#0B0B0C] font-sans font-medium block pt-1">
                  {cat.label}
                </span>
                <span className="text-[11px] text-[#5F6368] font-sans block">
                  {cat.sublabel}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-between text-xs text-[#5F6368]">
            <div className="flex items-center gap-2.5 font-sans">
              <ShieldCheck className="w-4 h-4 text-[#0B0B0C]" />
              <span>Zero-cloud leakage: all text chunks indexed in local vector embeddings</span>
            </div>
            <button
              onClick={onOpenArchive}
              className="px-4 py-2 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white font-sans font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View full archive catalog</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
