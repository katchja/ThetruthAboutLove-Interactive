import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  BookmarkPlus, 
  ShieldCheck, 
  RotateCcw,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Info,
  Layers
} from 'lucide-react';
import { ChatMessage, Citation, Source, VoiceSettings } from '../types';
import { speechEngine } from '../utils/speechEngine';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  isLoading: boolean;
  selectedSources: Source[];
  allSources: Source[];
  onSelectSourceById: (sourceId: string) => void;
  onPinToNotes: (text: string, title?: string) => void;
  isOfflineMode: boolean;
  voiceSettings: VoiceSettings;
  bookTitle: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedSources,
  allSources,
  onSelectSourceById,
  onPinToNotes,
  isOfflineMode,
  voiceSettings,
  bookTitle,
}) => {
  const [input, setInput] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const query = input.trim();
    setInput('');
    await onSendMessage(query);
  };

  const handleSpeak = (messageId: string, content: string) => {
    if (speakingMessageId === messageId) {
      speechEngine.stop();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(messageId);
    speechEngine.speak(content, voiceSettings, {
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePin = (id: string, content: string) => {
    onPinToNotes(content, 'Notebook Insight');
    setPinnedId(id);
    setTimeout(() => setPinnedId(null), 2000);
  };

  // Quick suggestion chips
  const suggestionPrompts = [
    'Why is love a fundamental life force rather than an emotion?',
    'Explain why programmable self-love is a $5 trillion market trap.',
    'How do the 35 velvet hearts illustrate generative self-love?',
    'What is relational sovereignty in romantic love?',
  ];

  // Helper to render text with clickable citation badges
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    // Regex matching [Source X: ...] or [Source X] or [X]
    const citationRegex = /\[(Source\s*\d+[^\]]*|\d+)\]/gi;
    const parts = content.split(citationRegex);

    return (
      <div className="prose prose-stone dark:prose-invert max-w-none text-sm leading-relaxed space-y-2">
        {parts.map((part, i) => {
          // Check if this part is a citation reference
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
                  if (sourceId) {
                    onSelectSourceById(sourceId);
                  } else if (selectedSources[sourceIndex]) {
                    onSelectSourceById(selectedSources[sourceIndex].id);
                  }
                }}
                className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 transition-colors align-baseline"
                title={matchedCitation ? `Cited Source: ${matchedCitation.sourceTitle}` : 'View Citation'}
              >
                <BookOpen className="w-2.5 h-2.5" />
                <span>Source {match[1]}{extraRef ? ` ${extraRef}` : ''}</span>
              </button>
            );
          }

          // Plain text rendering with bullet & paragraph formatting
          const paragraphs = part.split('\n\n');
          return (
            <React.Fragment key={i}>
              {paragraphs.map((p, pIdx) => {
                if (!p.trim()) return null;
                // Render list items if starting with - or *
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
    <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-stone-900/40 relative">
      {/* Top status bar */}
      <div className="px-4 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur-sm flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-stone-700 dark:text-stone-300">
            Notebook LM Active
          </span>
          <span className="text-stone-400">•</span>
          <span>
            {selectedSources.length} of {allSources.length} sources queried
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOfflineMode ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
              <ShieldCheck className="w-3 h-3" />
              100% Offline Vector Search
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Grounded Gemini 3.8 Flash
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto py-8 text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-serif-book font-bold text-stone-900 dark:text-stone-100">
                Interactive Conversational Notebook
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto mt-1 leading-relaxed">
                Ask questions about <span className="font-semibold text-stone-800 dark:text-stone-200">"{bookTitle}"</span>, author field notes, archival scans, and vetted external papers. All responses are verified against your local vector archive with interactive citations.
              </p>
            </div>

            {/* Suggestion prompt chips */}
            <div className="pt-2 text-left">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2 text-center">
                Recommended Questions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestionPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(prompt)}
                    className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left text-xs text-stone-700 dark:text-stone-300 hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all flex items-start justify-between group shadow-sm"
                  >
                    <span className="line-clamp-2 leading-relaxed">{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-600 shrink-0 mt-0.5 ml-1 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-amber-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-tl-sm text-stone-900 dark:text-stone-100'
                }`}
              >
                {/* Header for assistant message */}
                {message.role === 'assistant' && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-stone-100 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Notebook Synthesis</span>
                      {message.isOffline && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1 rounded">
                          Offline Vector
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {/* Content */}
                {message.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                ) : (
                  renderMessageContent(message.content, message.citations)
                )}

                {/* Assistant footer actions */}
                {message.role === 'assistant' && (
                  <div className="mt-3 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => handleSpeak(message.id, message.content)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        speakingMessageId === message.id
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'text-stone-600 dark:text-stone-400 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                      title="Listen in Author's Voice"
                    >
                      {speakingMessageId === message.id ? (
                        <>
                          <VolumeX className="w-3 h-3" />
                          <span>Stop Voice</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3 text-amber-500" />
                          <span>Read in Author's Voice</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 text-stone-400">
                      <button
                        onClick={() => handlePin(message.id, message.content)}
                        className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                        title="Pin insight to Studio Notes"
                      >
                        {pinnedId === message.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(message.id, message.content)}
                        className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                        title="Copy text"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-3 animate-in fade-in">
            <div className="max-w-md rounded-2xl p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Searching private vector index & synthesizing...</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-5/6 animate-pulse" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-4/6 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={`Ask about ${bookTitle}, field notes, or citations...`}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none leading-relaxed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3.5 p-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="font-mono">Enter</span> to send • <span className="font-mono">Shift + Enter</span> for new line
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Local embeddings ensure raw source text remains private</span>
          </div>
        </div>
      </div>
    </div>
  );
};
