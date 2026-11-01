import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  X,
  Minus,
  Sparkles,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { ChatMessage, VoiceSettings, Source, ChatModelTier } from '../types';
import { speechEngine } from '../utils/speechEngine';

const DEFAULT_AUTHOR_VOICE_ID = 'voice_lp7vh3bk6taq';

interface ConversationalPopupWindowProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  isChatLoading: boolean;
  onClearChat?: () => void;
  voiceSettings: VoiceSettings;
  isOfflineMode: boolean;
  onSelectSource?: (source: Source) => void;
  sources: Source[];
  chatModel: ChatModelTier;
  onChangeChatModel: (model: ChatModelTier) => void;
}

export const ConversationalPopupWindow: React.FC<ConversationalPopupWindowProps> = ({
  isOpen,
  onToggle,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
  voiceSettings,
  isOfflineMode,
  onSelectSource,
  sources,
  chatModel,
  onChangeChatModel,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const embeddedAuthorVoiceId =
    voiceSettings.voiceCloningKey &&
    !voiceSettings.voiceCloningKey.startsWith('gcv-catalina-author-v1-')
      ? voiceSettings.voiceCloningKey
      : DEFAULT_AUTHOR_VOICE_ID;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isChatLoading) return;
    const q = inputQuery.trim();
    setInputQuery('');
    await onSendMessage(q);
  };

  const handleSpeak = (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      speechEngine.stop();
      setSpeakingMessageId(null);
      return;
    }

    speechEngine.stop();
    setSpeakingMessageId(messageId);

    speechEngine.speak(
      text,
      {
        ...voiceSettings,
        engine: voiceSettings.engine || 'cloned_author',
        voiceName: embeddedAuthorVoiceId,
        voiceCloningKey: embeddedAuthorVoiceId,
        style: 'author_monologue',
        isClonedVoiceActive: true,
      },
      {
        onStart: () => setSpeakingMessageId(messageId),
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
    'Why is love not an emotion, but a life force?',
    'How does love expand the adjacent possible?',
    'What are the five dimensions of love?',
    'How do algorithms commodify self-love?',
    'What is relational sovereignty?',
  ];

  const handleSampleClick = async (q: string) => {
    await onSendMessage(q);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-5 right-5 z-40 px-5 py-3.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2.5 font-sans font-medium text-xs tracking-wide group cursor-pointer"
          title="Open Conversational Manuscript"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <span className="font-medium font-sans">Ask Manuscript</span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-[#0B0B0C] font-bold font-mono tabular-nums">
              {messages.length}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[520px] h-[680px] max-h-[88vh] rounded-3xl bg-[#F8F9FA] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-[#FFFFFF] text-[#0B0B0C] px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0B0B0C] flex items-center justify-center shrink-0">
                <Heart className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-medium text-base text-[#0B0B0C] truncate">
                  Conversational Manuscript
                </h3>
                <p className="text-[11px] text-[#5F6368] truncate font-sans">
                  The Truth About Love · Catalina Butnaru
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && onClearChat && (
                <button
                  onClick={onClearChat}
                  className="p-1.5 rounded-full text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
                  title="Reset conversation thread"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onToggle}
                className="p-1.5 rounded-full text-[#5F6368] hover:text-[#0B0B0C] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
                title="Minimize window"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                onClick={onToggle}
                className="p-1.5 rounded-full text-[#5F6368] hover:text-white hover:bg-[#FF2A6D] transition-colors cursor-pointer"
                title="Close window"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Model Tier Selector & Subheader Status Bar */}
          <div className="bg-[#F1F3F4] px-5 py-2.5 flex items-center justify-between gap-2 text-[11px] text-[#5F6368] shrink-0">
            <div className="flex items-center gap-1 bg-[#E8EAED] p-1 rounded-full">
              <button
                type="button"
                onClick={() => onChangeChatModel('gemini-3.1-flash-lite')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  chatModel === 'gemini-3.1-flash-lite'
                    ? 'bg-[#FF2A6D] text-white'
                    : 'text-[#5F6368] hover:text-[#0B0B0C]'
                }`}
                title="Fast responses (gemini-3.1-flash-lite)"
              >
                Fast
              </button>
              <button
                type="button"
                onClick={() => onChangeChatModel('gemini-3.8-flash')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  chatModel === 'gemini-3.8-flash'
                    ? 'bg-[#FF2A6D] text-white'
                    : 'text-[#5F6368] hover:text-[#0B0B0C]'
                }`}
                title="General grounded tasks (gemini-3.8-flash)"
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => onChangeChatModel('gemini-4-argon')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  chatModel === 'gemini-4-argon'
                    ? 'bg-[#FF2A6D] text-white'
                    : 'text-[#5F6368] hover:text-[#0B0B0C]'
                }`}
                title="Deep reasoning (gemini-4-argon)"
              >
                Deep Pro
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5F6368] truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0B0B0C] shrink-0" />
              <span className="truncate">
                {isOfflineMode ? 'Offline Index' : `${sources.length} Sources`}
              </span>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8F9FA]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center text-center space-y-4 px-2 py-4">
                <div className="w-12 h-12 rounded-2xl bg-[#0B0B0C] text-white flex items-center justify-center mx-auto">
                  <Heart className="w-6 h-6 fill-current" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-display font-medium text-base text-[#0B0B0C]">
                    Ask The Truth About Love
                  </h4>
                  <p className="text-xs text-[#5F6368] leading-relaxed max-w-xs mx-auto font-sans">
                    Explore the five dimensions of love, unprogrammable sovereignty, syntropy, and vetted archival research.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider font-medium text-[#5F6368] block">
                    Suggested Inquiries
                  </span>
                  <div className="flex flex-col gap-1.5 text-left">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSampleClick(q)}
                        className="p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FF2A6D] text-xs text-[#0B0B0C] hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="line-clamp-1">{q}</span>
                        <ArrowRight className="w-3 h-3 text-[#5F6368] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
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
                    className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed font-sans ${
                      message.role === 'user'
                        ? 'bg-[#0B0B0C] text-white rounded-tr-sm font-normal'
                        : 'bg-[#FFFFFF] rounded-tl-sm text-[#0B0B0C]'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 text-[10px] text-[#5F6368]">
                        <div className="flex items-center gap-1.5 font-mono font-medium text-[#0B0B0C]">
                          <Sparkles className="w-3 h-3" />
                          <span>
                            Catalina&apos;s Synthesis · {message.model || chatModel}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{message.content}</div>

                    {message.role === 'assistant' &&
                      message.citations &&
                      message.citations.length > 0 && (
                        <div className="mt-2.5 pt-2 space-y-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-medium text-[#5F6368] block">
                            Citations:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {message.citations.map((c, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const s = sources.find(
                                    (item) => item.id === c.sourceId
                                  );
                                  if (s && onSelectSource) onSelectSource(s);
                                }}
                                className="px-2.5 py-0.5 rounded-full bg-[#F1F3F4] text-[#0B0B0C] text-[10px] font-mono hover:bg-[#FF2A6D] hover:text-white transition-colors truncate max-w-[200px] cursor-pointer"
                                title={`View ${c.sourceTitle}`}
                              >
                                [{c.index}] {c.sourceTitle}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {message.role === 'assistant' && (
                      <div className="mt-2.5 pt-2 flex items-center justify-between gap-2 text-[11px]">
                        <button
                          onClick={() => handleSpeak(message.id, message.content)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                            speakingMessageId === message.id
                              ? 'bg-[#FF2A6D] text-white animate-pulse'
                              : 'bg-[#FF2A6D] text-white hover:bg-[#E61556]'
                          }`}
                          title="Read Aloud in Catalina's Embedded Author Voice"
                        >
                          {speakingMessageId === message.id ? (
                            <>
                              <VolumeX className="w-3 h-3" />
                              <span>Stop Author Voice</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Read Aloud (Author Voice)</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(message.id, message.content)}
                          className="p-1 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#0B0B0C] transition-colors cursor-pointer"
                          title="Copy text"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-3 h-3 text-[#0B0B0C]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isChatLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#FFFFFF] text-xs text-[#0B0B0C] max-w-[80%]">
                <Sparkles className="w-3.5 h-3.5 text-[#0B0B0C] animate-spin shrink-0" />
                <span>Catalina is contemplating your question...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-[#F1F3F4] shrink-0"
          >
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask anything and press Enter..."
                disabled={isChatLoading}
                className="w-full pl-4 pr-20 py-2.5 rounded-full bg-[#FFFFFF] text-xs text-[#0B0B0C] placeholder-[#80868B] focus:outline-none disabled:opacity-50 font-sans"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {inputQuery.trim() ? (
                  <button
                    type="submit"
                    disabled={isChatLoading}
                    className="p-1.5 rounded-full bg-[#FF2A6D] hover:bg-[#E61556] text-white transition-colors cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-[#5F6368] bg-[#F1F3F4] px-2 py-0.5 rounded-full pointer-events-none">
                    ↵ Enter
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
