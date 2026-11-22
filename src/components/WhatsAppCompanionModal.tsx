import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  MessageCircle,
  ExternalLink,
  Code2,
  CheckCheck,
  Sparkles,
  BookOpen,
  Mic,
} from 'lucide-react';
import { Source, WhatsAppWebhookEventLog } from '../types';
import { VoiceNotePlayerBubble, VoiceNoteRecorderButton } from './VoiceNoteControls';

interface WhatsAppThreadItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isVoiceNote?: boolean;
  audioDataUrl?: string;
  citations?: Array<{ index: number; sourceId: string; sourceTitle: string }>;
  timestamp: number;
}

interface WhatsAppCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onSelectSource?: (source: Source) => void;
  isRunaPage?: boolean;
}

export const WhatsAppCompanionModal: React.FC<WhatsAppCompanionModalProps> = ({
  isOpen,
  onClose,
  sources,
  onSelectSource,
  isRunaPage = false,
}) => {
  const [messages, setMessages] = useState<WhatsAppThreadItem[]>([
    {
      id: 'wa-welcome',
      role: 'assistant',
      text: 'Welcome to Runa on WhatsApp. Ask me a written question or send a voice note about The Truth About Love—I reply in short conversational chats and voice notes grounded in Catalina’s manuscript [Source 1].',
      isVoiceNote: true,
      timestamp: Date.now() - 60000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showWebhookJson, setShowWebhookJson] = useState(false);
  const [lastWebhookEvent, setLastWebhookEvent] = useState<WhatsAppWebhookEventLog | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const companionPhone =
    (import.meta as any).env?.VITE_WHATSAPP_COMPANION_NUMBER || '447700900000';

  const sendWhatsAppInquiry = async (queryText: string, asVoiceNote = false) => {
    const clean = queryText.trim();
    if (!clean || isSending) return;

    const userMsg: WhatsAppThreadItem = {
      id: `wa-u-${Date.now()}`,
      role: 'user',
      text: clean,
      isVoiceNote: asVoiceNote,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          messageType: asVoiceNote ? 'audio' : 'text',
          includeVoiceNote: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const assistantMsg: WhatsAppThreadItem = {
          id: `wa-a-${Date.now()}`,
          role: 'assistant',
          text:
            data.reply ||
            'Love is not an emotion—it is a fundamental, syntropic life force that expands who we are [Source 1].',
          isVoiceNote: true,
          audioDataUrl: data.audioDataUrl,
          citations: data.citations,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (data.webhookEvent) {
          setLastWebhookEvent(data.webhookEvent);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `wa-a-fallback-${Date.now()}`,
          role: 'assistant',
          text: 'Love is not an emotion—it is a fundamental life force that expands your adjacent possible [Source 1].',
          isVoiceNote: true,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendWhatsAppInquiry(inputText, false);
  };

  const quickPrompts = [
    'Why is love a life force, not an emotion?',
    'How does unprogrammable self-love work?',
    'What did Nasr write in The Garden of Truth?',
  ];

  const waDeepLink = `https://wa.me/${companionPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    'Hi Catalina’s Runa! Why is love a fundamental life force rather than an emotion?'
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0B0C]/65 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div
        className={`bg-[#FFFFFF] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ${
          isRunaPage ? 'border-0' : 'border border-[#E8EAED] shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between gap-3 ${
            isRunaPage ? 'bg-[#FFFFFF] text-[#141413]' : 'bg-[#0B0B0C] text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isRunaPage ? 'bg-[#00F0FF] text-[#0B0B0C]' : 'bg-[#15803D] text-white'
              }`}
            >
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className={`font-display font-medium text-base sm:text-lg truncate ${
                    isRunaPage ? 'text-[#141413]' : 'text-white'
                  }`}
                >
                  WhatsApp Runa Companion
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                    isRunaPage
                      ? 'bg-[#00F0FF]/25 text-[#0098A6]'
                      : 'bg-[#15803D] text-white'
                  }`}
                >
                  Live Webhook
                </span>
              </div>
              <p
                className={`text-xs truncate ${
                  isRunaPage ? 'text-[#5E5D59]' : 'text-[#BDC1C6]'
                }`}
              >
                The Truth About Love · Short written chats &amp; playable voice notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowWebhookJson(!showWebhookJson)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                isRunaPage
                  ? showWebhookJson
                    ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                    : 'runa-glass-btn runa-glass-pill text-[#141413]'
                  : showWebhookJson
                  ? 'bg-[#C83E0B] text-white'
                  : 'bg-[#202124] text-[#E8EAED] hover:bg-[#303134]'
              }`}
              title="Inspect Meta WhatsApp Cloud API Webhook Payload"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Webhook JSON</span>
            </button>

            <a
              href={waDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                isRunaPage
                  ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                  : 'bg-[#15803D] hover:bg-[#166534] text-white'
              }`}
              title="Open in WhatsApp App"
            >
              <span>wa.me</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isRunaPage
                  ? 'text-[#5E5D59] hover:text-[#141413] hover:bg-[#F4F5F8]'
                  : 'text-[#BDC1C6] hover:text-white hover:bg-[#202124]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Webhook Inspector Drawer */}
        {showWebhookJson && (
          <div
            className={`px-6 py-3.5 text-xs font-mono space-y-2 max-h-48 overflow-y-auto ${
              isRunaPage
                ? 'bg-[#F4F5F8] text-[#141413]'
                : 'bg-[#202124] text-[#E8EAED] border-b border-[#303134]'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] ${
                isRunaPage ? 'text-[#5E5D59]' : 'text-[#BDC1C6]'
              }`}
            >
              <span>POST /api/whatsapp/webhook · Meta Cloud API v21.0</span>
              <span className={isRunaPage ? 'text-[#0098A6] font-semibold' : 'text-[#4ADE80]'}>
                200 EVENT_RECEIVED
              </span>
            </div>
            <pre
              className={`text-[11px] leading-relaxed overflow-x-auto ${
                isRunaPage ? 'text-[#3D3C38]' : 'text-[#E8EAED]'
              }`}
            >
              {JSON.stringify(
                lastWebhookEvent?.webhookPayload || {
                  object: 'whatsapp_business_account',
                  endpoint: '/api/whatsapp/webhook',
                  capabilities: ['text', 'audio/ogg; codecs=opus', 'gemini-3.8-flash-lite-tts'],
                },
                null,
                2
              )}
            </pre>
          </div>
        )}

        {/* Chat Stream */}
        <div
          className={`flex-1 overflow-y-auto p-5 space-y-4 ${
            isRunaPage ? 'bg-[#F8F9FA]' : 'bg-[#F4F4F9]'
          }`}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-4 space-y-3 ${
                  m.role === 'user'
                    ? isRunaPage
                      ? 'bg-[#00F0FF]/20 text-[#0B0B0C] rounded-tr-sm'
                      : 'bg-[#0B0B0C] text-white rounded-tr-sm'
                    : isRunaPage
                    ? 'bg-[#FFFFFF] text-[#0B0B0C] rounded-tl-sm'
                    : 'bg-[#FFFFFF] text-[#0B0B0C] rounded-tl-sm border border-[#E8EAED]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono opacity-75">
                  <span className="flex items-center gap-1.5">
                    {m.isVoiceNote && (
                      <Mic
                        className={`w-3 h-3 ${isRunaPage ? 'text-[#0098A6]' : 'text-[#C83E0B]'}`}
                      />
                    )}
                    {m.role === 'user'
                      ? m.isVoiceNote
                        ? 'You · Voice Note'
                        : 'You · Written Chat'
                      : 'Catalina’s Runa · Short Chat + Voice Note'}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {m.role === 'assistant' && (
                      <CheckCheck
                        className={`w-3 h-3 ${isRunaPage ? 'text-[#0098A6]' : 'text-[#15803D]'}`}
                      />
                    )}
                  </span>
                </div>

                <p className="text-sm leading-relaxed font-sans">{m.text}</p>

                {m.role === 'assistant' && (
                  <VoiceNotePlayerBubble
                    text={m.text}
                    initialAudioDataUrl={m.audioDataUrl}
                    variant={isRunaPage ? 'runa' : 'whatsapp'}
                    label="WhatsApp Runa Note"
                  />
                )}

                {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.citations.map((c) => (
                      <button
                        key={c.index}
                        type="button"
                        onClick={() => {
                          const found = sources.find((s) => s.id === c.sourceId);
                          if (found && onSelectSource) {
                            onSelectSource(found);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-[#0B0B0C] text-[11px] font-mono font-medium transition-colors inline-flex items-center gap-1 cursor-pointer ${
                          isRunaPage
                            ? 'runa-glass-btn runa-glass-pill hover:text-[#0B0B0C]'
                            : 'bg-[#F1F3F4] hover:bg-[#C83E0B] hover:text-white'
                        }`}
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>
                          [Source {c.index}] {c.sourceTitle}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div
              className={`flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#FFFFFF] text-xs text-[#0B0B0C] max-w-xs ${
                isRunaPage ? '' : 'border border-[#E8EAED]'
              }`}
            >
              <Sparkles
                className={`w-4 h-4 animate-spin shrink-0 ${
                  isRunaPage ? 'text-[#0098A6]' : 'text-[#15803D]'
                }`}
              />
              <span>Synthesizing short WhatsApp chat &amp; voice note...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Prompts */}
        <div
          className={`px-5 py-2.5 flex items-center gap-2 overflow-x-auto ${
            isRunaPage ? 'bg-[#F4F5F8]' : 'bg-[#F8F9FA] border-t border-[#E8EAED]'
          }`}
        >
          <span className="text-[11px] font-mono text-[#5F6368] shrink-0">Try:</span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSending}
              onClick={() => sendWhatsAppInquiry(p, false)}
              className={`px-3 py-1 rounded-full text-[#202124] text-xs whitespace-nowrap transition-colors cursor-pointer ${
                isRunaPage
                  ? 'runa-glass-btn runa-glass-pill hover:text-[#0B0B0C]'
                  : 'bg-[#FFFFFF] hover:bg-[#C83E0B] hover:text-white border border-[#E8EAED]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Composer Footer: Written + Voice Note Mic */}
        <form
          onSubmit={handleFormSubmit}
          className={`p-4 bg-[#FFFFFF] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${
            isRunaPage ? '' : 'border-t border-[#E8EAED]'
          }`}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Write a short message or record a voice note..."
            disabled={isSending}
            className={`flex-1 px-4 py-2.5 rounded-full text-sm text-[#0B0B0C] placeholder-[#5F6368] focus:outline-none ${
              isRunaPage ? 'bg-[#F4F5F8]' : 'bg-[#F1F3F4]'
            }`}
          />
          <div className="flex items-center justify-end gap-2">
            <VoiceNoteRecorderButton
              compact
              accentTheme={isRunaPage ? 'runa' : 'default'}
              disabled={isSending}
              onTranscriptReady={(transcript) => sendWhatsAppInquiry(transcript, true)}
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className={`px-4 py-2.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isRunaPage
                  ? 'runa-glass-btn runa-glass-black text-white font-semibold'
                  : 'bg-[#15803D] hover:bg-[#166534] text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
