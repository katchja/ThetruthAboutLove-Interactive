import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  ChevronRight,
  Send,
  Archive,
  Flame,
  Copy,
  Check,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  Heart
} from 'lucide-react';
import { BookMetadata, Source, ChatMessage, Citation, ChatModelTier, getSourceSection } from '../types';
import { LabsFlowerShape, LabsCloudShape, Labs3DBlobShape } from './LabsFloatingShapes';
import { FAIR_DISCLOSURE_SHORT_TEXT } from '../utils/chatGuardrails';

const BOOK_COVER_SRC = '/assets/aistudio/Book_cover_8c0e35cc.png';

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
    quote: 'Love never wounds. What wounds is a distortion of love.',
    contextLabel: 'Chapter 1 · The Nature of Love',
  },
  {
    id: 'truth-3',
    quote: 'When we offload thinking to AI, we become lazier lovers, not fiercer ones.',
    contextLabel: 'The Lovers Manifesto',
  },
  {
    id: 'truth-4',
    quote: 'True love of self cannot be programmed. It is an inborn state of being.',
    contextLabel: 'Chapter 3 · Unprogrammable self-love',
  },
  {
    id: 'truth-5',
    quote: 'The answer to power dynamics in love is self-regulation. Is is mastery of self, never power over another.',
    contextLabel: 'Chapter 4 · The Love of Another',
  },
  {
    id: 'truth-6',
    quote: 'Love expands the adjacent possible. You expand into a much larger life and love it!',
    contextLabel: 'Chapter 2 · The Purpose of Love',
  },
  {
    id: 'truth-7',
    quote: 'The love of life cannot rest on zen nor stoicism. It never rests, like syntropy, it expands. Always',
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
  chatModel?: ChatModelTier;
  isOfflineMode: boolean;
  onOpenSafetyModal?: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  sources,
  onOpenArchive,
  onSelectSource,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
  chatModel = 'gemini-3.1-flash-lite',
  onOpenSafetyModal,
}) => {
  const [quickQuery, setQuickQuery] = useState('');
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
    const formattedPrompt = `"${quoteText}"Chat with Manuscript`;
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

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim() || isChatLoading) return;
    const q = quickQuery.trim();
    setQuickQuery('');
    await onSendMessage(q);
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
                className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-[#C83E0B] hover:bg-[#A93207] text-white transition-colors align-baseline cursor-pointer"
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
      <section className="relative overflow-hidden pt-20 pb-24 bg-[#F4F4F9]/65">
        {/* Outer-Left Margin Cloud Gradient Backdrop — offset away from central quote for crisp readability */}
        <LabsCloudShape
          variant="yellow-pink"
          className="absolute -left-32 sm:-left-20 -bottom-28 w-[380px] sm:w-[500px] md:w-[560px] h-[350px] sm:h-[460px] md:h-[510px] opacity-75 labs-shape-float-breathe"
        />

        {/* Upper-Left Outer Margin 8-Petal Flower Shape */}
        <LabsFlowerShape
          variant="pink-yellow"
          className="hidden md:block absolute -left-24 -top-24 w-[250px] lg:w-[290px] h-[250px] lg:h-[290px] opacity-70 labs-shape-float-rotate"
        />

        {/* Upper-Right Outer Margin 3D Golden Sculptural Blob */}
        <Labs3DBlobShape
          variant="default"
          className="absolute -right-24 sm:-right-16 lg:-right-10 -top-16 sm:-top-14 w-[240px] sm:w-[320px] lg:w-[380px] h-[240px] sm:h-[320px] lg:h-[380px] opacity-85 labs-shape-float-rotate"
        />

        {/* Lower-Right Outer Corner 8-Petal Flower Shape */}
        <LabsFlowerShape
          variant="soft-bloom"
          className="hidden sm:block absolute -right-24 -bottom-28 w-[240px] lg:w-[280px] h-[240px] lg:h-[280px] opacity-65 labs-shape-slow-spin"
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="space-y-10 py-10 sm:py-14">
            {/* Kicker */}
            <div className="inline-flex items-center gap-3 text-xs font-mono font-medium uppercase tracking-[0.22em] text-[#202124] pb-2">
              <Flame className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>Truths About Love</span>
            </div>

            {/* Google Sans Display Rotating Quote */}
            <div className="min-h-[180px] sm:min-h-[220px] flex flex-col items-center justify-center px-4 sm:px-10">
              <blockquote
                key={currentTruth.id}
                className="font-display font-medium text-2xl sm:text-4xl md:text-5xl text-[#1E1F18] leading-[1.2] tracking-tight max-w-4xl mx-auto transition-opacity duration-500"
              >
                &ldquo;{currentTruth.quote}&rdquo;
              </blockquote>
            </div>

            {/* Primary Interactive Trigger */}
            <div className="flex flex-col items-center justify-center pt-4">
              <button
                type="button"
                onClick={() => handleWhyShouldICare(currentTruth.quote)}
                className="px-8 py-4 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white font-sans font-medium text-sm transition-all inline-flex items-center gap-3 cursor-pointer group"
              >
                <span>Ask Manuscript</span>
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
                <div className="flex items-center gap-3 text-xs font-mono font-medium text-[#202124] pb-1">
                  <div className="w-7 h-7 rounded-lg bg-[#0B0B0C] flex items-center justify-center shrink-0">
                    <Heart className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                  <span className="tracking-wide uppercase">Conversational Manuscript</span>
                  <span className="text-[#80868B]">·</span>
                  <span className="text-[#5F6368] font-mono">
                    {sources.length} Sources
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-normal text-[#0B0B0C] tracking-tight leading-snug">
                  Chat with The Truth About Love
                </h2>
                <p className="text-sm sm:text-base text-[#5F6368] leading-relaxed pt-1 font-sans">
                  Chat with the manuscript. Every response is grounded in the author's manuscript, author notes, research literature and research.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start lg:self-center text-xs font-mono text-[#5F6368]">
                <ShieldCheck className="w-4 h-4 text-[#C83E0B] shrink-0" />
                <span className="text-[#0B0B0C] font-medium">Gemini Flash-Lite</span>
                <span aria-hidden="true">·</span>
                <span>Safeguarded Companion</span>
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
                    className="px-7 py-3.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] disabled:opacity-50 disabled:hover:bg-[#C83E0B] text-white font-medium text-sm transition-all flex items-center gap-2.5 cursor-pointer"
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

              {/* Subtle Inline Fair AI Disclosure & Wellbeing Notice */}
              <div className="mt-5 pt-4 border-t border-[#E8EAED] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] sm:text-xs text-[#5F6368] leading-relaxed font-sans">
                <p className="max-w-3xl">
                  <strong className="font-medium text-[#202124]">Fair Disclosure:</strong>{' '}
                  {FAIR_DISCLOSURE_SHORT_TEXT}
                </p>
                {onOpenSafetyModal && (
                  <button
                    type="button"
                    onClick={onOpenSafetyModal}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C83E0B] hover:text-[#A93207] underline underline-offset-4 shrink-0 self-start sm:self-center cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Safety &amp; Fair Disclosure</span>
                  </button>
                )}
              </div>
            </form>

            {/* Quick Inquiry Bar (always accessible for one-click exploration) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-medium text-[#5F6368]">
                  Manuscript prompts
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
                    className="px-4 py-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#C83E0B] text-[#202124] hover:text-white text-xs sm:text-sm font-sans font-medium transition-all flex items-center gap-2 text-left cursor-pointer group"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#0B0B0C] group-hover:text-white shrink-0 transition-colors" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ==============================================================
                CONVERSATION STAGE: Live Thread
                ============================================================== */}
            {messages.length > 0 && (
              <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-[#5F6368]">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-[#0B0B0C] font-display">
                      Chat({messages.length} {messages.length === 1 ? 'exchange' : 'exchanges'})
                    </span>
                    <span>·</span>
                    <span className="text-[#5F6368] font-sans">
                      Click to open note
                    </span>
                  </div>
                  {onClearChat && (
                    <button
                      onClick={onClearChat}
                      className="text-xs font-medium text-white bg-[#C83E0B] hover:bg-[#A93207] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Go back</span>
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
                            <div className="flex items-center gap-2.5 font-mono font-medium text-[#0B0B0C] flex-wrap">
                              <div className="w-7 h-7 rounded-lg bg-[#0B0B0C] flex items-center justify-center shrink-0">
                                <Heart className="w-3.5 h-3.5 text-white fill-white" />
                              </div>
                              {message.guardrailCategory && message.guardrailCategory !== 'safe' ? (
                                <>
                                  <ShieldCheck className="w-4 h-4 text-[#C83E0B]" />
                                  <span>Conversational Safety Guardrail</span>
                                </>
                              ) : (
                                <span>Manuscript Chat · {message.model || chatModel}</span>
                              )}
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
                                Citations (click to open):
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
                                    className="px-3.5 py-2 rounded-full bg-[#F1F3F4] hover:bg-[#C83E0B] text-[#0B0B0C] hover:text-white text-xs font-mono font-medium transition-colors flex items-center gap-2 cursor-pointer"
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
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('manuscript-composer');
                                  if (el) el.focus();
                                }}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-current" />
                                <span>Follow-Up</span>
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
                          <div className="w-7 h-7 rounded-lg bg-[#0B0B0C] flex items-center justify-center shrink-0">
                            <Heart className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                          </div>
                          <span>Searching manuscript and archive...</span>
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
        {/* Subtle Corner-Offset 3D Golden Blob in Far Right Margin (away from left manifesto copy) */}
        <Labs3DBlobShape
          variant="tilted"
          className="hidden lg:block absolute -right-32 -bottom-20 w-[320px] h-[320px] opacity-60 labs-shape-float-breathe"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
            {/* Left copy in Catalina's tone: brief, punchy, fierce */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2.5 text-xs font-mono font-medium uppercase tracking-wider text-[#5F6368] pb-1">
                <Flame className="w-3.5 h-3.5 text-[#0B0B0C]" />
                <span>The Truth About Love · Interactive Manuscript</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-normal tracking-tight text-[#0B0B0C] leading-[1.15]">
                The Truth About Love
              </h1>

              <p className="text-xl sm:text-2xl font-display font-normal text-[#202124] leading-snug">
                This is an interactive manuscript and a book-in-the-making. Join me in my journey to write and discover the truth about love.
              </p>
              {/* Exact manifesto copy in brief, fierce sentences */}
              <div className="space-y-5 text-sm sm:text-base text-[#5F6368] leading-relaxed font-sans">
                <p className="pt-2 text-sm sm:text-base font-display font-medium text-[#0B0B0C] flex items-center gap-2.5">
                  <Flame className="w-4 h-4 text-[#0B0B0C] shrink-0" />
                  <span>This book is for you, fierce lovers!</span>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 text-xs font-mono text-[#5F6368]">
                <div className="w-7 h-7 rounded-lg bg-[#0B0B0C] flex items-center justify-center shrink-0">
                  <Heart className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <span>By <strong className="text-[#0B0B0C] font-medium">Catalina Butnaru</strong></span>
                <span>·</span>
                <span>Self-published interactive manuscript</span>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-3">
                <a
                  href="#conversational-archive"
                  className="px-7 py-4 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white font-sans font-medium text-sm transition-all flex items-center gap-2.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ask Manuscript</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

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
              <div className="relative real-published-book bg-[#FFFFFF] flex items-center justify-center w-full max-w-[430px] min-h-[500px] p-8 sm:p-10">
                {/* Flat-Positioned Physical Hardcover Book on Invisible Surface */}
                <div className="published-book-flat relative z-10 w-[280px] sm:w-[316px] aspect-[1414/2000] select-none">
                  {/* Back Hardcover Board & Invisible-Surface Contact Shadow */}
                  <div className="published-book-back-board" aria-hidden="true" />

                  {/* Subtle Paper Page Block Edge */}
                  <div className="published-book-flat-pages" aria-hidden="true" />

                  {/* Front Hardcover Board with Clearly Visible Unobstructed Cover */}
                  <div className="published-book-front">
                    <img
                      src={BOOK_COVER_SRC}
                      alt="The Truth About Love — A memoir & manifesto for fierce lovers in the age of AI — By Catalina Butnaru"
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
          SECTION 4: THE FIERCE LOVERS MANIFESTO CALLOUT (Google Labs Light Canvas + Giant Flower & 3D Blob)
          ======================================================================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16">
        <div className="p-10 sm:p-16 lg:p-20 rounded-[2.5rem] bg-[#F3F3FA] text-[#0B0B0C] relative overflow-hidden">
          {/* Giant Edge-Cropped 8-Petal Scalloped Flower pushed into Far Right Margin for clear text readability */}
          <LabsFlowerShape
            variant="yellow-pink"
            className="absolute -right-36 sm:-right-44 lg:-right-36 -top-24 sm:-top-28 w-[360px] sm:w-[520px] lg:w-[600px] h-[360px] sm:h-[520px] lg:h-[600px] opacity-85 labs-shape-float-rotate"
          />

          {/* 3D Golden Sculptural Blob nested in Far Bottom-Right Margin */}
          <Labs3DBlobShape
            variant="mirrored"
            className="hidden sm:block absolute -right-20 lg:-right-12 -bottom-24 w-[240px] sm:w-[300px] lg:w-[340px] h-[240px] sm:h-[300px] lg:h-[340px] opacity-85 labs-shape-slow-spin"
          />

          {/* Subtle Secondary Floating Cloud-Clover in Far Bottom-Left Corner */}
          <LabsCloudShape
            variant="pink-yellow"
            className="hidden sm:block absolute -left-36 -bottom-36 w-[300px] h-[280px] opacity-50 labs-shape-float-breathe"
          />

          <div className="max-w-2xl space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold uppercase tracking-widest bg-[#FFFFFF]/85 text-[#1E1F18]">
              <Flame className="w-3.5 h-3.5 text-[#0B0B0C]" />
              <span>THE FIERCE LOVERS MANIFESTO</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-medium text-[#1E1F18] leading-[1.12] tracking-tight">
              &ldquo;Love is not an emotion. It is a fundamental life force.&rdquo;
            </h2>

            <div className="space-y-5 text-sm sm:text-base text-[#202124] leading-relaxed font-sans max-w-xl">
              <p>
                It expands who you are and dissolves distortions: power dynamics, control disguised as connection, synthetic and programmatic content replacing your truth.
              </p>
              <p>
                To protect your truth and reclaim your power to love, here&apos;s a place to start.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="text-base font-display font-medium text-[#0B0B0C]">
                  This manifesto is for you, fierce lovers!
                </p>
                <p className="text-xs font-mono text-[#5F6368]">
                  — <strong className="text-[#0B0B0C] font-medium">Catalina Butnaru</strong>, author of <em>The Truth About Love</em>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Five Dimensions of Love Overview */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-4 sm:px-6 pt-28">
        {/* Outer-Left Margin Floating Flower (shifted away from central title for crisp readability) */}
        <LabsFlowerShape
          variant="soft-bloom"
          className="hidden md:block pointer-events-none absolute -left-28 lg:-left-20 top-0 w-[260px] lg:w-[310px] h-[260px] lg:h-[310px] opacity-55 labs-shape-float-breathe"
        />

        {/* Outer-Right Margin 3D Golden Sculptural Blob */}
        <Labs3DBlobShape
          variant="tilted"
          className="hidden md:block pointer-events-none absolute -right-24 lg:-right-16 top-2 w-[240px] lg:w-[290px] h-[240px] lg:h-[290px] opacity-75 labs-shape-float-rotate"
        />

        <div className="relative z-10 text-center max-w-2xl mx-auto space-y-5 mb-16">
          <span className="text-xs font-mono font-medium text-[#5F6368] uppercase tracking-widest block pb-1">
            THE ARCHITECTURE OF LOVE
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-medium text-[#0B0B0C]">
            The Five Dimensions of Love
          </h2>
          <p className="text-xs sm:text-sm text-[#202124] leading-relaxed pt-1 font-sans">
            Love expands what theoretical biologist Stuart Kauffman calls the adjacent possible. It is much more like syntropy than an emotion. Here&apos;s how love expands us across five dimensions of our existence.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'The Love of Self',
              subtitle: 'Unprogrammable Self-love',
              desc: "Self-love is not a 30-day program, it is an inborn drive towards joyful expansion. Like syntropy. It is achieved through self mastery and regulation.",
              tag: 'Chapter 3',
            },
            {
              title: 'The Love of Another',
              subtitle: 'Expand By Loving Another',
              desc: "Romantic love surges from an powerful archetypal force, Eros. It provides the energy to expand and grow with another human being, become exquisitly thrilling to both.",
              tag: 'Chapter 4',
            },
            {
              title: 'The Love of Life',
              subtitle: 'Expansion Through Change',
              desc: 'Love of life cannot thrive on comfort and survival, it asks that you expand who you are and emerge victorious from whatever life throws at you. It is the victory of the Self over death and decay.',
              tag: 'Chapter 5',
            },
            {
              title: 'The Love of Humanity',
              subtitle: 'Beyond Power Games',
              desc: 'On loving all ways of being human and freeing ourselves from the laws of social dominance and collective labels.',
              tag: 'Chapter 6',
            },
            {
              title: 'The Love of the Divine',
              subtitle: 'Expand Into Oneness',
              desc: 'Gathering all loves into One Love. Explore love through the lens of mystics, spirituality, and philosophy without collapsing into AI-induced psychosis.',
              tag: 'Chapter 7',
              isFeatured: false,
            },
            {
              title: 'Practical exercises',
              subtitle: 'Explore the truth of your love life',
              desc: 'Develop your love intelligence and discover your love standards.',
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
                    className="mt-4 px-5 py-3 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-sans font-medium transition-all flex items-center justify-between group relative z-10 cursor-pointer"
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
                    className="self-start px-4 py-2.5 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-sans font-medium transition-all flex items-center gap-2 mt-2 group cursor-pointer"
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

      {/*Interactive Archive*/}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
        <div className="relative overflow-hidden p-10 sm:p-14 rounded-3xl bg-[#F4F4F9] space-y-10">
          {/* Floating Cloud-Flower Accent in Far Top-Right Corner */}
          <LabsCloudShape
            variant="yellow-pink"
            className="absolute -right-32 -top-24 w-[320px] sm:w-[400px] h-[300px] sm:h-[370px] opacity-65 labs-shape-float-rotate"
          />

          {/* Companion 3D Golden Blob in Far Bottom-Right Margin */}
          <Labs3DBlobShape
            variant="default"
            className="hidden sm:block absolute -right-20 -bottom-24 w-[240px] sm:w-[280px] h-[240px] sm:h-[280px] opacity-75 labs-shape-float-breathe"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-display font-normal text-[#0B0B0C]">
                Interactive Archive
              </h2>
              <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed pt-1 font-sans">
                Manuscript chapters, author notes, reference literature and citations live on the separate Interactive Archive. Explore at your leisure. Original documents are protected to respect intellectual property.
              </p>
            </div>

            <button
              onClick={onOpenArchive}
              className="px-7 py-4 rounded-full bg-[#C83E0B] hover:bg-[#A93207] text-white font-sans font-medium text-sm transition-all flex items-center gap-2.5 shrink-0 self-start md:self-auto cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Explore ({sources.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Archive Section breakdown highlights */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {[
              {
                label: 'Authored by Catalina',
                sublabel: 'Book chapters, Substack & author notes',
                count: sources.filter((s) => getSourceSection(s) === 'authored').length,
              },
              {
                label: 'Literature, References and Quotations',
                sublabel: 'Explore the archive',
                count: sources.filter((s) => getSourceSection(s) === 'references').length,
              },
            ].map((cat, i) => (
              <button
                key={i}
                onClick={onOpenArchive}
                className="p-6 rounded-2xl bg-[#FFFFFF]/90 hover:bg-[#FFFFFF] text-left transition-all group space-y-1.5 cursor-pointer"
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
        </div>
      </section>
    </div>
  );
};
