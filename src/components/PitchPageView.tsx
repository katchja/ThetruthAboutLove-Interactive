import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MessageCircle,
  Mic,
  Send,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Activity,
  RefreshCw,
  Volume2,
  Lock,
  Layers,
} from 'lucide-react';
import { Source, TractionMetrics, WhatsAppWebhookEventLog } from '../types';
import { VoiceNotePlayerBubble, VoiceNoteRecorderButton } from './VoiceNoteControls';
import { SubscriberWaitlistSection } from './SubscriberWaitlistSection';
import { LabsCloudShape, Labs3DBlobShape, LabsFlowerShape } from './LabsFloatingShapes';
import { RunaHeroFallenFoliageBed } from './RunaHeroFallenFoliageBed';

interface PitchPageViewProps {
  sources: Source[];
  onReturnToManuscript: () => void;
  onOpenArchive: () => void;
  onOpenWhatsAppModal: () => void;
  completedDimensionsCount: number;
}

const RUNA_HERO_ORB_PATHS = (() => {
  const N = 48;

  const buildClosedBezierPath = (
    pts: Array<{ x: number; y: number }>,
    smoothness = 1
  ) => {
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];

      const linCp1x = p1.x + (p2.x - p1.x) / 3;
      const linCp1y = p1.y + (p2.y - p1.y) / 3;
      const linCp2x = p1.x + ((p2.x - p1.x) * 2) / 3;
      const linCp2y = p1.y + ((p2.y - p1.y) * 2) / 3;

      const smCp1x = p1.x + (p2.x - p0.x) / 6;
      const smCp1y = p1.y + (p2.y - p0.y) / 6;
      const smCp2x = p2.x - (p3.x - p1.x) / 6;
      const smCp2y = p2.y - (p3.y - p1.y) / 6;

      const cp1x = linCp1x + (smCp1x - linCp1x) * smoothness;
      const cp1y = linCp1y + (smCp1y - linCp1y) * smoothness;
      const cp2x = linCp2x + (smCp2x - linCp2x) * smoothness;
      const cp2y = linCp2y + (smCp2y - linCp2y) * smoothness;

      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return `${d} Z`;
  };

  const samplePolyline = (waypoints: Array<{ x: number; y: number }>) => {
    const segLen = N / waypoints.length;
    const pts: Array<{ x: number; y: number }> = [];
    for (let s = 0; s < waypoints.length; s++) {
      const a = waypoints[s];
      const b = waypoints[(s + 1) % waypoints.length];
      for (let k = 0; k < segLen; k++) {
        const u = k / segLen;
        pts.push({
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
        });
      }
    }
    return buildClosedBezierPath(pts, 0);
  };

  // 1. ᛗ (Mannaz Rune — twin vertical staves with upper crossing X)
  const mannazPath = samplePolyline([
    { x: 26, y: 20 }, // Top-left
    { x: 74, y: 54 }, // Mid-right (crossing diagonal \)
    { x: 74, y: 80 }, // Bottom-right leg
    { x: 74, y: 20 }, // Full right vertical stave up
    { x: 26, y: 54 }, // Mid-left (crossing diagonal /)
    { x: 26, y: 80 }, // Bottom-left leg (closes back up full left stave to top-left)
  ]);

  // 2. ᛞ (Dagaz Rune — twin vertical staves with full corner-to-corner X)
  const dagazPath = samplePolyline([
    { x: 26, y: 20 }, // Top-left
    { x: 74, y: 80 }, // Bottom-right (full diagonal \)
    { x: 74, y: 80 }, // Anchored bottom-right
    { x: 74, y: 20 }, // Full right vertical stave up
    { x: 26, y: 80 }, // Bottom-left (full diagonal /)
    { x: 26, y: 80 }, // Anchored bottom-left (closes back up full left stave to top-left)
  ]);

  // 3. Round (Smooth circle)
  const roundPts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 4;
    roundPts.push({
      x: 50 + 27 * Math.sin(angle),
      y: 50 - 27 * Math.cos(angle),
    });
  }
  const roundPath = buildClosedBezierPath(roundPts, 1);

  const keyframes = [
    mannazPath,
    mannazPath,
    dagazPath,
    dagazPath,
    roundPath,
    roundPath,
    mannazPath,
  ];

  return {
    originPath: mannazPath,
    values: keyframes.join(';'),
    keyTimes: '0;0.18;0.36;0.52;0.70;0.84;1',
    keySplines: Array(keyframes.length - 1)
      .fill('0.42 0 0.58 1')
      .join(';'),
  };
})();

const RunaHeroMorphingOrb: React.FC = () => (
  <div
    className="runa-orb-float relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center overflow-hidden select-none"
    style={{
      background:
        'radial-gradient(circle at 32% 28%, #2E2E32 0%, #141413 48%, #050506 100%)',
    }}
    aria-label="Runa Floating Morphing Orb (ᛗ to ᛞ to round)"
  >
    <svg
      viewBox="0 0 100 100"
      className="w-9 h-9 sm:w-11 sm:h-11 overflow-visible"
      fill="none"
    >
      <path
        d={RUNA_HERO_ORB_PATHS.originPath}
        stroke="#FFFFFF"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate
          attributeName="d"
          values={RUNA_HERO_ORB_PATHS.values}
          keyTimes={RUNA_HERO_ORB_PATHS.keyTimes}
          keySplines={RUNA_HERO_ORB_PATHS.keySplines}
          calcMode="spline"
          dur="5.4s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  </div>
);

interface HeroDialogueSample {
  id: string;
  dimension: string;
  chapterRef: string;
  question: string;
  manuscriptQuote: string;
  runaReply: string;
}

const HERO_COEXISTENCE_DIALOGUES: HeroDialogueSample[] = [
  {
    id: 'syntropy',
    dimension: 'Dimension I · Life Force & Syntropy',
    chapterRef: 'Part I · Love as a Fundamental Life Force [Source 1]',
    question: 'Why does the book define love as syntropy rather than an emotion?',
    manuscriptQuote:
      '“Love is not an emotion. It is a fundamental life force. Love is like syntropy, tending towards life, and is experienced as joy, authenticity and a surplus of energy.”',
    runaReply:
      'Emotions fluctuate with circumstance, whereas syntropy is the organizing force in nature that builds complexity, coherence, and vitality [Source 1]. In the manuscript, love is that exact surplus of life energy—experienced whenever you act from your authentic core rather than fear.',
  },
  {
    id: 'sovereignty',
    dimension: 'Dimension III · Power & Sovereignty',
    chapterRef: 'Part III · The Answer to Power Dynamics [Source 4]',
    question: 'How do two fierce lovers coexist without one dominating the other?',
    manuscriptQuote:
      '“The answer to power dynamics in romantic love is self-regulation: mastery of self, never power over another.”',
    runaReply:
      'Coexistence in love requires trading control for self-regulation [Source 4]. When both partners hold inner sovereignty instead of trying to govern the other, intimacy stops being a negotiation of power and becomes a shared surplus of freedom.',
  },
  {
    id: 'ai-age',
    dimension: 'Dimension V · Love in the Age of AI',
    chapterRef: 'Part V · Fierce Lovers & Artificial Minds [Source 7]',
    question: 'What belongs solely to human authors in an age of synthetic intelligence?',
    manuscriptQuote:
      '“True love of self cannot be programmed. It is an inborn state of being... What is born of lived vulnerability cannot be synthesized by statistical prediction.”',
    runaReply:
      'Statistical models can recombine language, but they cannot risk heartbreak or live a philosophical truth in the body [Source 7]. Runa exists to protect and converse with that lived human originality—never to flatten it into training weights.',
  },
];

const PRESET_UNTRAINED_ARTEFACTS = [
  {
    id: 'catalina-love',
    badge: 'Flagship Manuscript',
    title: 'The Truth About Love',
    author: 'Catalina Butnaru',
    excerpt:
      'Love is not an emotion. It is a fundamental life force. Love is like syntropy, tending towards life, and is experienced as joy, authenticity and a surplus of energy. True love of self cannot be programmed. It is an inborn state of being. The answer to power dynamics in romantic love is self-regulation: mastery of self, never power over another.',
    defaultQuestion: 'Why is self-love closer to syntropy than a 30-day habit program?',
    defaultReply:
      'Self-love is not a mechanical 30-day routine you install like software—it is an inborn, syntropic life force toward coherence and joy [Source 1]. You awaken it through self-regulation and inner sovereignty, never by outsourcing your truth.',
  },
  {
    id: 'custom-artefact',
    badge: 'Bring Your Own Untrained Text',
    title: 'Notes on Cultural Coexistence',
    author: 'Independent Author Manuscript',
    excerpt:
      'A book is not a dataset to be scraped and discarded; it is an architectural space where a human mind spent years distilling lived reality into form. When conversational intelligence respects the boundary of the work, the reader does not consume a summary—they enter a living dialogue with the text itself.',
    defaultQuestion: 'Why shouldn’t an AI just summarize a book into bullet points?',
    defaultReply:
      'Summarizing a book into generic bullet points destroys the architectural space the author built over years of lived inquiry [Source 1]. Coexistence means entering a living, cited dialogue with the manuscript so the reader experiences the depth of the original work.',
  },
];

export const PitchPageView: React.FC<PitchPageViewProps> = ({
  sources,
  onReturnToManuscript,
  onOpenArchive,
  onOpenWhatsAppModal,
  completedDimensionsCount,
}) => {
  const [metrics, setMetrics] = useState<TractionMetrics>({
    totalInquiries: 148,
    voiceNotesGenerated: 64,
    whatsappCompanionSessions: 42,
    dimensionsCompleted: 95 + completedDimensionsCount,
    subscriberCount: 38,
    humanVerifiedChecks: 87,
    updatedAt: Date.now(),
  });

  // Hero Interactive Coexistence Card State
  const [activeHeroDialogueId, setActiveHeroDialogueId] = useState<string>(
    HERO_COEXISTENCE_DIALOGUES[0].id
  );
  const activeHeroDialogue =
    HERO_COEXISTENCE_DIALOGUES.find((d) => d.id === activeHeroDialogueId) ||
    HERO_COEXISTENCE_DIALOGUES[0];

  // Live Studio Sandbox State
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    PRESET_UNTRAINED_ARTEFACTS[0].id
  );
  const [sandboxTitle, setSandboxTitle] = useState(PRESET_UNTRAINED_ARTEFACTS[0].title);
  const [sandboxAuthor, setSandboxAuthor] = useState(PRESET_UNTRAINED_ARTEFACTS[0].author);
  const [sandboxExcerpt, setSandboxExcerpt] = useState(PRESET_UNTRAINED_ARTEFACTS[0].excerpt);
  const [sandboxQuery, setSandboxQuery] = useState(PRESET_UNTRAINED_ARTEFACTS[0].defaultQuestion);
  const [sandboxReply, setSandboxReply] = useState<string>(
    PRESET_UNTRAINED_ARTEFACTS[0].defaultReply
  );
  const [sandboxAudioUrl, setSandboxAudioUrl] = useState<string | undefined>(undefined);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);

  // Live WhatsApp Webhook Inspector State
  const [webhookLogs, setWebhookLogs] = useState<WhatsAppWebhookEventLog[]>([]);
  const [webhookTestQuery, setWebhookTestQuery] = useState(
    'How do fierce lovers protect their truth in the age of AI?'
  );
  const [webhookTestMode, setWebhookTestMode] = useState<'audio' | 'text'>('audio');
  const [isWebhookTesting, setIsWebhookTesting] = useState(false);

  const fetchTractionAndLogs = async () => {
    try {
      const [tracRes, logsRes] = await Promise.all([
        fetch('/api/traction'),
        fetch('/api/whatsapp/logs'),
      ]);
      if (tracRes.ok) {
        const tracData = await tracRes.json();
        if (tracData?.metrics) {
          setMetrics(tracData.metrics);
        }
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (Array.isArray(logsData?.logs)) {
          setWebhookLogs(logsData.logs);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchTractionAndLogs();
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_UNTRAINED_ARTEFACTS.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setSandboxTitle(found.title);
    setSandboxAuthor(found.author);
    setSandboxExcerpt(found.excerpt);
    setSandboxQuery(found.defaultQuestion);
    setSandboxReply(found.defaultReply);
    setSandboxAudioUrl(undefined);
  };

  const runSandboxTest = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? sandboxQuery).trim();
    if (!q || isSandboxLoading) return;
    setIsSandboxLoading(true);
    setSandboxAudioUrl(undefined);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          bookTitle: sandboxTitle,
          authorName: sandboxAuthor,
          customManuscriptContext: sandboxExcerpt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reply) {
          setSandboxReply(data.reply);
        }
      }
      fetchTractionAndLogs();
    } catch {
      // Keep current reply on error
    } finally {
      setIsSandboxLoading(false);
    }
  };

  const runWebhookSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookTestQuery.trim() || isWebhookTesting) return;
    setIsWebhookTesting(true);
    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: webhookTestQuery.trim(),
          messageType: webhookTestMode,
          includeVoiceNote: true,
        }),
      });
      if (res.ok) {
        await fetchTractionAndLogs();
      }
    } catch {
    } finally {
      setIsWebhookTesting(false);
    }
  };

  return (
    <div
      className="relative min-h-screen bg-[#E8EBEF] text-[#141413] font-sans pb-28 selection:bg-[#141413]/10 selection:text-[#0B0B0C] overflow-x-hidden"
    >
      {/* ========================================================================
          SECTION 1: RUNA EDITORIAL HERO
          ======================================================================== */}
      <section className="relative z-10 overflow-hidden pt-12 sm:pt-20 pb-36 sm:pb-44 bg-[#ff6900]">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Headline, Thesis & Primary Editorial CTAs */}
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center space-y-6">
            <RunaHeroMorphingOrb />

            <h1 className="text-5xl sm:text-6xl lg:text-[4.75rem] font-['Georgia',serif] font-medium text-[#141413] leading-[1.02] tracking-[-0.03em] text-center">
              Love Chatting to Books, Not Bots.
            </h1>


            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={onOpenWhatsAppModal}
                className="runa-glass-btn runa-glass-black px-6 py-3.5 rounded-full text-white text-sm font-semibold inline-flex items-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                <span>Runa on WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={onReturnToManuscript}
                className="runa-glass-btn runa-glass-pill px-5 py-3.5 rounded-full text-[#0B0B0C] text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#0B0B0C]" />
                <span>Ask Manuscript</span>
              </button>
            </div>
          </div>

          {/* Horizontally Aligned Wide Section: Live Interactive Coexistence Specimen */}
          <div className="mt-12 sm:mt-14 w-full">
            <div className="p-6 sm:p-8 lg:p-10 rounded-[2rem] bg-[#f9f9f9] text-[#141413] font-['Georgia',serif] space-y-6">
              {/* Top Horizontal Header & Inquiry Tabs */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.16em] text-[#5E5D59] font-semibold">
                      BOOK
                    </span>
                  </div>
                </div>

                {/* Dialogue Selector Tabs */}
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-[11px] font-['Georgia',serif] text-[#73726C] uppercase tracking-wider">
                    Select Inquiry:
                  </span>
                  {HERO_COEXISTENCE_DIALOGUES.map((sample, idx) => {
                    const active = sample.id === activeHeroDialogue.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setActiveHeroDialogueId(sample.id)}
                        className={`bg-transparent px-0.5 py-1 text-xs font-['Georgia',serif] transition-colors cursor-pointer ${
                          active
                            ? 'text-[#141413] font-medium underline underline-offset-4 decoration-[#141413]'
                            : 'text-[#73726C] hover:text-[#141413]'
                        }`}
                      >
                        0{idx + 1} · {sample.dimension.split('·')[1]?.trim()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px w-full bg-[#141413]/10" />

              {/* Horizontally Aligned 2-Column Content: Cultural Artefact (Left) + Runa Dialogue (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left Column: The Untrained Cultural Artefact */}
                <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#5E5D59]">
                      <span>HUMAN-WRITTEN MANUSCRIPT</span>
                      <span className="text-[#0098A6] font-medium">The Truth About Love</span>
                    </div>
                    <p className="text-sm sm:text-base font-['Georgia',serif] italic text-[#141413] leading-relaxed">
                      {activeHeroDialogue.manuscriptQuote}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#73726C] block pt-2">
                    — Catalina Butnaru · {activeHeroDialogue.chapterRef}
                  </span>
                </div>

                {/* Right Column: Reader Inquiry + Runa Coexisting Agent Response */}
                <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E5D59] block">
                      READER INQUIRY
                    </span>
                    <p className="text-sm sm:text-base font-['Georgia',serif] font-medium text-[#141413]">
                      “{activeHeroDialogue.question}”
                    </p>
                  </div>

                  <div className="h-px w-full bg-[#141413]/10" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#0098A6] font-semibold">
                        RUNA
                      </span>
                      <span className="text-[10px] font-mono text-[#73726C]">
                        {activeHeroDialogue.runaReply.split(/\s+/).length} words
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#3D3C38] leading-relaxed font-['Georgia',serif]">
                      {activeHeroDialogue.runaReply}
                    </p>

                    <div className="pt-1">
                      <VoiceNotePlayerBubble
                        text={activeHeroDialogue.runaReply}
                        variant="runa"
                        label="Listen to Runa Voice Note (24kHz)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editorial Telemetry Ledger Strip */}
          <div className="mt-16 pt-8">
            <div className="h-px w-full bg-[#141413]/12 mb-8" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  label: 'Books',
                  value: `${sources.length} Chapters`,
                  sub: 'Protected Manuscript',
                },
                {
                  label: 'Reader Chats',
                  value: metrics.totalInquiries.toLocaleString(),
                },
                {
                  label: 'WhatsApp Voice Notes',
                  value: metrics.voiceNotesGenerated.toLocaleString(),
                  sub: '24kHz audio',
                },
                {
                  label: 'WhatsApp chats',
                  value: metrics.whatsappCompanionSessions.toLocaleString(),
                  sub: 'Runa in your DMs',
                },
                {
                  label: 'Dimensions Explored',
                  value: metrics.dimensionsCompleted.toLocaleString(),
                  sub: '5-Dimension reading journey',
                },
                {
                  label: 'RAG-based conversation',
                  sub: 'Author IP remains sovereign',
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F1F2F6]/90 space-y-1"
                >
                  <span className="text-2xl sm:text-3xl font-display font-semibold text-[#141413] tabular-nums block">
                    {stat.value}
                  </span>
                  <span className="text-xs font-sans font-semibold text-[#141413] block">
                    {stat.label}
                  </span>
                  <span className="text-[11px] font-mono text-[#73726C] block">
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thick Interactive Bed of Fallen Flowers & Foliage at the Very Bottom */}
        <RunaHeroFallenFoliageBed />
      </section>

      {/* ========================================================================
          SECTION 2: THE THREE PILLARS OF CULTURAL COEXISTENCE (ANTHROPIC RESEARCH STYLE)
          ======================================================================== */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="max-w-3xl space-y-4 mb-14">
          <h2 className="text-3xl sm:text-5xl font-display font-medium text-[#141413] tracking-tight leading-[1.12]">
            The Agent For The Dedicated Reader And AI-Native Author
          </h2>
          <p className="text-base sm:text-lg text-[#4A4944] leading-relaxed font-['Georgia',serif]">
            For thousands of years, a book was a silent monologue read in solitude. Fast-forward to 2018, generative transformers trained on millions of open-source content, books, and unique human heritage, decimating authorship and creating AI slop instead of original ideas.
           Runa redeems AI, authorship and book-reading. This conversational agent only chats if the original book was purchased. And, for the 
            every word of the human work intact.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              meta: 'UNTRAINED CULTURAL ARTEFACTS',
              title: 'Inquire into books AI has never been trained on',
              body: 'Foundation models only know the scraped public web, blurring distinct thinkers into statistical averages. Runa pairs directly with private manuscripts, newly written books, and curated literary archives—answering strictly from the author’s actual chapters with inline [Source N] citations.',
              footnote: 'Zero weight-training leakage · Private subcollection vault',
            },
            {
              num: '02',
              meta: 'COEXISTENCE OVER REPLACEMENT',
              title: 'The book remains untouched. The dialogue comes alive.',
              body: 'Runa never rewrites the author or generates 800-word synthetic essays pretending to be literature. Instead, it coexists with the manuscript as a respectful interlocutor—helping readers question, connect, and apply the author’s original ideas to their own lives.',
              footnote: '100% human-authored corpus · Citation-locked retrieval',
            },
            {
              num: '03',
              meta: 'INTIMATE VOICE-NOTE & SHORT-CHAT CADENCE',
              title: 'Spoken voice notes & 2–4 sentence exchanges',
              body: 'Real intellectual inquiry feels like exchanging voice notes with a thoughtful friend late at night. Every Runa turn is crafted as a 2–4 sentence written reflection paired with a warm 24kHz playable voice note—on the web or directly inside WhatsApp.',
              footnote: 'Gemini 2.5 Native Audio · Meta WhatsApp Cloud Bridge',
            },
          ].map((pillar) => (
            <div
              key={pillar.num}
              className={`p-8 rounded-[2rem] ${
                pillar.num === '03' ? 'bg-[#E8EBEF]' : 'bg-[#ffffff]'
              } flex flex-col justify-between space-y-8`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-serif italic text-[#0098A6]">{pillar.num}</span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#5E5D59]">
                    {pillar.meta}
                  </span>
                </div>
                <div className="h-px w-full bg-[#141413]/10" />
                <h3 className="text-xl sm:text-2xl font-display font-medium text-[#141413] leading-snug">
                  {pillar.title}
                </h3>
                <p className="text-sm sm:text-base text-[#4A4944] leading-relaxed font-['Georgia',serif]">
                  {pillar.body}
                </p>
              </div>

              <div className="pt-2">
                <div className="h-px w-full bg-[#141413]/10 mb-3" />
                <span className="text-xs font-mono text-[#5E5D59] block">{pillar.footnote}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Paradigm Contrast Table: Extraction vs. Coexistence */}
        <div className="mt-10 p-8 sm:p-10 rounded-[2rem] bg-[#E8EBEF] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#0098A6] font-semibold">
                PARADIGM SHIFT
              </span>
              <h3 className="text-xl sm:text-2xl font-display font-medium text-[#141413]">
                Why Coexistence Beats Generic AI Extraction
              </h3>
            </div>
            <span className="text-xs font-mono text-[#5E5D59]">
              CULTURE AND AI
            </span>
          </div>

          <div className="h-px w-full bg-[#141413]/10" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#FFFFFF] space-y-2">
              <span className="text-xs font-mono uppercase text-[#73726C] block">
                01 ·STATIC E-BOOKS &amp; PDFS
              </span>
              <p className="text-sm font-semibold text-[#141413] font-['Georgia',serif]">
                High depth, zero dialogue
              </p>
              <p className="text-xs text-[#5E5D59] leading-relaxed font-['Georgia',serif]">
                100% human originality, but readers cannot ask follow-up questions when a passage
                challenges their worldview. Completion rates average under 18%.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#FFFFFF] space-y-2">
              <span className="text-xs font-mono uppercase text-[#73726C] block">
                02 · GENERIC PUBLIC LLMS
              </span>
              <p className="text-sm font-semibold text-[#141413] font-['Georgia',serif]">
                Trained on scraped web averages
              </p>
              <p className="text-xs text-[#5E5D59] leading-relaxed font-['Georgia',serif]">
                Have never read private or newly authored manuscripts. Produce 800-word walls of
                generic platitudes, hallucinated quotes, and zero author attribution.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#141413] text-[#FAF8F5] space-y-2">
              <span className="text-xs font-mono uppercase text-[#00F0FF] block">
                03 · RUNA CULTURAL COEXISTENCE
              </span>
              <p className="text-sm font-semibold text-white font-['Georgia',serif]">
                Untrained books + living voice-note dialogue
              </p>
              <p className="text-xs text-[#CFCBC2] leading-relaxed font-['Georgia',serif]">
                Coexists directly with the author&apos;s protected manuscript. Replies in 2–4
                grounded sentences with inline citations and playable 24kHz voice notes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 3: LIVE COEXISTENCE STUDIO — INQUIRE INTO ANY UNTRAINED BOOK
          ======================================================================== */}
      <section
        id="coexistence-studio"
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 scroll-mt-20"
      >
        <div className="p-8 sm:p-12 rounded-[2.25rem] bg-[#E8EBEF] space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#0098A6] font-semibold">
                INTERACTIVE COEXISTENCE STUDIO
              </span>
              <h2 className="text-2xl sm:text-4xl font-display font-medium text-[#141413] tracking-tight">
                Pair Runa with any book AI has never been trained on
              </h2>
              <p className="text-sm sm:text-base text-[#4A4944] font-['Georgia',serif] leading-relaxed">
                Test Runa on Catalina Butnaru&apos;s flagship manuscript—or paste an excerpt from
                your own unpublished book, essay, or cultural archive. Ask a question by{' '}
                <strong>written chat</strong> or <strong>spoken voice note</strong>, and watch Runa
                coexist with your text in real time.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESET_UNTRAINED_ARTEFACTS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`runa-glass-btn px-4 py-2.5 rounded-full text-xs font-medium cursor-pointer ${
                    selectedPresetId === preset.id
                      ? 'runa-glass-black text-white font-semibold'
                      : 'runa-glass-pill text-[#141413]'
                  }`}
                >
                  {preset.badge}: {preset.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Untrained Cultural Artefact Input */}
            <div className="lg:col-span-6 space-y-4 bg-[#FFFFFF] p-6 sm:p-7 rounded-3xl">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[#5E5D59] font-semibold">
                  1. Untrained Cultural Artefact (Human Manuscript)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0098A6]">
                  <Lock className="w-3 h-3" />
                  <span>Excluded from LLM training</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#73726C] mb-1">
                    Artefact / Book Title
                  </label>
                  <input
                    type="text"
                    value={sandboxTitle}
                    onChange={(e) => setSandboxTitle(e.target.value)}
                    placeholder="Book or Manuscript Title"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5F8] text-xs font-medium text-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#73726C] mb-1">
                    Human Author
                  </label>
                  <input
                    type="text"
                    value={sandboxAuthor}
                    onChange={(e) => setSandboxAuthor(e.target.value)}
                    placeholder="Author Name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5F8] text-xs font-medium text-[#141413] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#73726C] mb-1">
                  Authored Passage (Paste any untrained paragraph or chapter excerpt)
                </label>
                <textarea
                  rows={5}
                  value={sandboxExcerpt}
                  onChange={(e) => setSandboxExcerpt(e.target.value)}
                  placeholder="Paste any human-written book chapter excerpt, philosophy essay, or cultural note here..."
                  className="w-full p-4 rounded-2xl bg-[#F4F5F8] text-xs sm:text-sm font-['Georgia',serif] text-[#141413] leading-relaxed focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5E5D59] font-semibold">
                  2. Inquire Into This Book (Written or Voice Note)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sandboxQuery}
                    onChange={(e) => setSandboxQuery(e.target.value)}
                    placeholder="Ask a deep question about this passage..."
                    className="flex-1 px-4 py-3 rounded-full bg-[#F4F5F8] text-sm text-[#141413] focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <VoiceNoteRecorderButton
                      compact
                      accentTheme="runa"
                      disabled={isSandboxLoading}
                      onTranscriptReady={(transcript) => {
                        setSandboxQuery(transcript);
                        runSandboxTest(transcript);
                      }}
                    />
                    <button
                      type="button"
                      disabled={isSandboxLoading}
                      onClick={() => runSandboxTest()}
                      className="runa-glass-btn runa-glass-black px-5 py-3 rounded-full text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSandboxLoading ? (
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Inquire</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Coexisting Runa Conversational Output */}
            <div className="lg:col-span-6 bg-[#FFFFFF] p-6 sm:p-7 rounded-3xl flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]" />
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#141413]">
                      3. Runa Coexisting Response (Chat + Voice Note)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#73726C] tabular-nums">
                    {sandboxReply.split(/\s+/).filter(Boolean).length} words · Grounded Dialogue
                  </span>
                </div>

                <div className="h-px w-full bg-[#141413]/10" />

                <div className="p-5 sm:p-6 rounded-2xl bg-[#F4F5F8] space-y-4">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#73726C]">
                    <span>COEXISTING WITH: {sandboxTitle.toUpperCase()}</span>
                    <span>BY {sandboxAuthor.toUpperCase()}</span>
                  </div>

                  <p className="text-sm sm:text-base text-[#141413] leading-relaxed font-['Georgia',serif]">
                    {sandboxReply}
                  </p>

                  <VoiceNotePlayerBubble
                    text={sandboxReply}
                    initialAudioDataUrl={sandboxAudioUrl}
                    variant="runa"
                    surfaceClassName="bg-[#FFFFFF]"
                    label={`${sandboxAuthor} · Runa Voice Note`}
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F5F8] text-xs text-[#3D3C38] space-y-1.5">
                <div className="font-mono font-semibold text-[#141413] flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#0098A6]" />
                  <span>Why Short Conversational Cadence Matters for Culture:</span>
                </div>
                <p className="text-[#5E5D59] leading-relaxed font-['Georgia',serif]">
                  Instead of drowning the author&apos;s book in a generic 800-word AI essay, Runa
                  responds in <strong>2–4 grounded sentences (40–75 words)</strong> with a playable
                  voice note—inviting the reader back into the original manuscript.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 4: FLAGSHIP CASE STUDY — "THE TRUTH ABOUT LOVE" BY CATALINA BUTNARU
          ======================================================================== */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="p-8 sm:p-12 rounded-[2.25rem] bg-[#141413] text-[#FAF8F5] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#00F0FF] font-semibold block">
              ARTEFACT NO. 01 · LIVE COEXISTENCE IN PRODUCTION
            </span>
            <h2 className="text-2xl sm:text-4xl font-display font-medium text-white leading-tight">
              Experience Runa coexisting with <em>The Truth About Love</em> by Catalina Butnaru
            </h2>
            <p className="text-sm sm:text-base text-[#CFCBC2] leading-relaxed max-w-2xl font-['Georgia',serif]">
              Explore {sources.length} indexed manuscript chapters and curated philosophical
              literature across 5 Guided Reading Dimensions. Chat with the untrained manuscript via
              short written reflections or spoken voice notes.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              type="button"
              onClick={onReturnToManuscript}
              className="runa-glass-btn runa-glass-pill w-full px-6 py-4 rounded-full text-[#0B0B0C] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Chat with The Manuscript</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenArchive}
              className="runa-glass-btn runa-glass-pill w-full px-6 py-4 rounded-full text-[#0B0B0C] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#0B0B0C]" />
              <span>Explore Curated Literature ({sources.length})</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 5: WHATSAPP VOICE-NOTE & CHAT PIPELINE (META CLOUD API v21.0)
          ======================================================================== */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="p-8 sm:p-12 rounded-[2.25rem] bg-[#E8EBEF] text-[#141413] space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#0098A6] font-semibold block">
                UBIQUITOUS CULTURAL ACCESS · META WHATSAPP CLOUD API v21.0
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-medium text-[#141413]">
                Carry the books you love inside your WhatsApp voice notes
              </h2>
              <p className="text-sm text-[#4A4944] leading-relaxed font-['Georgia',serif]">
                Coexistence happens where readers already think and talk. Through Runa&apos;s live
                Express webhook (<code className="font-mono text-[#141413]">/api/whatsapp/webhook</code>
                ), readers send a spoken <code className="font-mono text-[#141413]">audio/ogg</code>{' '}
                voice note or text message in WhatsApp and receive a cited short chat &amp; playable
                voice note back from the book.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenWhatsAppModal}
              className="runa-glass-btn runa-glass-black px-5 py-3.5 rounded-full text-white text-xs font-mono font-semibold inline-flex items-center gap-2 self-start lg:self-center cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Open Full WhatsApp Simulator</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Webhook Trigger Form */}
            <form
              onSubmit={runWebhookSimulation}
              className="lg:col-span-5 p-6 rounded-3xl bg-[#FFFFFF] space-y-4"
            >
              <div className="flex items-center justify-between text-xs font-mono text-[#5E5D59]">
                <span>DISPATCH TEST WEBHOOK PAYLOAD</span>
                <span className="text-[#0098A6] font-medium">POST /api/whatsapp/webhook</span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F4F5F8] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setWebhookTestMode('audio')}
                  className={`py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    webhookTestMode === 'audio'
                      ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                      : 'text-[#5E5D59] hover:text-[#141413]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voice Note (ogg)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWebhookTestMode('text')}
                  className={`py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    webhookTestMode === 'text'
                      ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                      : 'text-[#5E5D59] hover:text-[#141413]'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Written Text</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#5E5D59] mb-1.5">
                  Inbound Reader Inquiry / Spoken Voice Transcript:
                </label>
                <input
                  type="text"
                  value={webhookTestQuery}
                  onChange={(e) => setWebhookTestQuery(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5F8] text-xs text-[#141413] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isWebhookTesting}
                className="runa-glass-btn runa-glass-black w-full py-3 rounded-full text-white text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isWebhookTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Webhook...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    <span>Trigger Live Webhook Event</span>
                  </>
                )}
              </button>
            </form>

            {/* Live Webhook Event Log & Audio Output */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-[#FFFFFF] space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#141413] font-semibold">
                  RECENT WHATSAPP COEXISTENCE EVENTS ({webhookLogs.length})
                </span>
                <span className="text-[#0098A6] font-medium">HTTP 200 EVENT_RECEIVED</span>
              </div>

              {webhookLogs.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#F4F5F8] space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#5E5D59]">
                      <span>
                        From: {webhookLogs[0].senderPhone} · Mode:{' '}
                        <strong className="text-[#0098A6]">
                          {webhookLogs[0].messageType.toUpperCase()}
                        </strong>
                      </span>
                      <span>
                        {new Date(webhookLogs[0].timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#5E5D59] italic font-['Georgia',serif]">
                      Reader Inquiry: &ldquo;{webhookLogs[0].textContent}&rdquo;
                    </p>
                    <p className="text-xs sm:text-sm text-[#141413] font-['Georgia',serif] leading-relaxed">
                      Runa Response: {webhookLogs[0].replyText}
                    </p>
                    {webhookLogs[0].replyText && (
                      <div className="pt-1">
                        <VoiceNotePlayerBubble
                          text={webhookLogs[0].replyText}
                          initialAudioDataUrl={webhookLogs[0].audioDataUrl}
                          variant="runa"
                          surfaceClassName="bg-[#FFFFFF]"
                          label="WhatsApp Synthesized Runa Voice Note"
                        />
                      </div>
                    )}
                  </div>

                  <pre className="p-3.5 rounded-2xl bg-[#F4F5F8] text-[11px] font-mono text-[#4A4944] overflow-x-auto max-h-36">
                    {JSON.stringify(webhookLogs[0].webhookPayload, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-[#5E5D59] font-['Georgia',serif]">
                  Click &ldquo;Trigger Live Webhook Event&rdquo; to inspect the real-time Meta
                  WhatsApp Cloud API payload and synthesized voice note.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SECTION 6: FOR AUTHORS, THINKERS & CULTURAL INSTITUTIONS (TIERS)
          ======================================================================== */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="max-w-2xl space-y-3 mb-12">
          <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#0098A6] font-semibold">
            FOR AUTHORS, PUBLISHERS &amp; CULTURAL ARCHIVES
          </span>
          <h2 className="text-2xl sm:text-4xl font-display font-medium text-[#141413] tracking-tight">
            Let your book coexist with a conversational agent—without surrendering your IP
          </h2>
          <p className="text-sm sm:text-base text-[#4A4944] leading-relaxed font-['Georgia',serif]">
            Built with client-side 256-dim vector indexing, SHA-256 cached Gemini 24kHz voice notes,
            and protected Firestore manuscript subcollections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              tier: '01 · Independent Author',
              price: '$0',
              period: 'forever starter',
              desc: 'For essayists, Substack writers, and manifesto authors pairing their first untrained manuscript with Runa.',
              features: [
                '1 Untrained Book or Essay Collection',
                'Short Written Chats + Cited Passages [Source N]',
                'Zero LLM Training Exposure Guarantee',
                'Reader Waitlist & Inquiry Analytics',
              ],
              featured: false,
            },
            {
              tier: '02 · Runa Coexistence Pro',
              price: '$29',
              period: 'per month',
              desc: 'For published authors and independent thinkers giving readers a 24/7 voice-note & WhatsApp interlocutor.',
              features: [
                'Unlimited Playable 24kHz Voice Notes',
                'Dedicated WhatsApp Runa Companion Bridge',
                '5-Dimension Guided Reading Journey Tracker',
                'Protected Manuscript Subcollection Vault',
              ],
              featured: true,
            },
            {
              tier: '03 · Literary Press & Archive',
              price: '$149',
              period: 'per month',
              desc: 'For publishing houses, cultural foundations, and multi-book estates preserving unique human thought.',
              features: [
                'Up to 25 Untrained Books & Cultural Archives',
                'Custom Meta WhatsApp Business Phone Number ID',
                'Bespoke Author Voice Profiles & Lexicon Rules',
                'Full Citation Telemetry & /llms.txt Discovery',
              ],
              featured: false,
            },
          ].map((plan, idx) => (
            <div
              key={idx}
              className={`p-8 rounded-[2rem] flex flex-col justify-between gap-6 ${
                plan.featured
                  ? 'bg-[#141413] text-[#FAF8F5]'
                  : 'bg-[#E8EBEF] text-[#141413]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono uppercase tracking-wider font-semibold ${
                      plan.featured ? 'text-[#00F0FF]' : 'text-[#0098A6]'
                    }`}
                  >
                    {plan.tier}
                  </span>
                  {plan.featured && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#00F0FF] text-[#0B0B0C] text-[10px] font-mono font-semibold uppercase">
                      Flagship
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-semibold tabular-nums">
                    {plan.price}
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      plan.featured ? 'text-[#A8A69E]' : 'text-[#5E5D59]'
                    }`}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm leading-relaxed font-['Georgia',serif] ${
                    plan.featured ? 'text-[#CFCBC2]' : 'text-[#4A4944]'
                  }`}
                >
                  {plan.desc}
                </p>
                <div
                  className={`h-px w-full ${
                    plan.featured ? 'bg-white/10' : 'bg-[#141413]/10'
                  }`}
                />
                <ul className="space-y-2.5 pt-1 text-xs sm:text-sm">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================
          SECTION 7: READER, AUTHOR & PARTNER COEXISTENCE WAITLIST
          ======================================================================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <SubscriberWaitlistSection
          completedDimensionsCount={completedDimensionsCount}
          defaultRole="investor"
          accentTheme="runa"
          onSubscribed={fetchTractionAndLogs}
          onOpenWhatsAppModal={onOpenWhatsAppModal}
        />
      </section>
    </div>
  );
};
